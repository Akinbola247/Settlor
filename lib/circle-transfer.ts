import { circleFetch, circleErrorMessage } from "@/lib/circle";
import { arcTxExplorerUrl } from "@/lib/arc-config";

export async function createArcTransferChallenge(
  userToken: string,
  input: {
    walletId: string;
    destinationAddress: string;
    amount: string;
  }
): Promise<{ challengeId: string } | { error: string }> {
  const { ok, data, raw } = await circleFetch<{ challengeId: string }>(
    "/v1/w3s/user/transactions/transfer",
    {
      method: "POST",
      userToken,
      body: {
        idempotencyKey: crypto.randomUUID(),
        walletId: input.walletId,
        destinationAddress: input.destinationAddress,
        amounts: [input.amount],
        feeLevel: "MEDIUM",
        blockchain: "ARC-TESTNET",
      },
    }
  );

  if (!ok || !data.challengeId) {
    return { error: circleErrorMessage(raw, "Could not create transfer") };
  }
  return { challengeId: data.challengeId };
}

type ChallengeStatus = "PENDING" | "IN_PROGRESS" | "COMPLETE" | "FAILED" | "EXPIRED";

export async function getTransferChallenge(
  userToken: string,
  challengeId: string
): Promise<{
  status: ChallengeStatus;
  transactionId?: string;
  errorMessage?: string;
}> {
  const { ok, data, raw } = await circleFetch<{
    challenge?: {
      status: ChallengeStatus;
      correlationIds?: string[];
      errorMessage?: string;
    };
  }>(`/v1/w3s/user/challenges/${challengeId}`, { userToken });

  if (!ok) {
    throw new Error(circleErrorMessage(raw, "Could not load challenge status"));
  }

  const ch = data.challenge;
  return {
    status: ch?.status ?? "PENDING",
    transactionId: ch?.correlationIds?.[0],
    errorMessage: ch?.errorMessage,
  };
}

export async function getCircleTransaction(
  userToken: string,
  transactionId: string
): Promise<{ txHash?: string; state?: string }> {
  const { ok, data, raw } = await circleFetch<{
    transaction?: { txHash?: string; state?: string };
  }>(`/v1/w3s/transactions/${transactionId}`, { userToken });

  if (!ok) {
    throw new Error(circleErrorMessage(raw, "Could not load transaction"));
  }
  return {
    txHash: data.transaction?.txHash,
    state: data.transaction?.state,
  };
}

/** Poll until challenge completes and return explorer URL for proof. */
export async function waitForTransferCompletion(
  userToken: string,
  challengeId: string,
  options?: { maxAttempts?: number; intervalMs?: number }
): Promise<{ txHash: string; explorerUrl: string }> {
  const maxAttempts = options?.maxAttempts ?? 60;
  const intervalMs = options?.intervalMs ?? 2000;

  for (let i = 0; i < maxAttempts; i++) {
    const ch = await getTransferChallenge(userToken, challengeId);
    if (ch.status === "FAILED" || ch.status === "EXPIRED") {
      throw new Error(ch.errorMessage ?? "Transfer failed");
    }
    if (ch.status === "COMPLETE" && ch.transactionId) {
      const tx = await getCircleTransaction(userToken, ch.transactionId);
      if (tx.txHash) {
        return { txHash: tx.txHash, explorerUrl: arcTxExplorerUrl(tx.txHash) };
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Transfer confirmation timed out. Check your Arc wallet activity.");
}
