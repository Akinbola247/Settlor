import { circleFetch, circleErrorMessage } from "@/lib/circle";

export async function createContractExecutionChallenge(
  userToken: string,
  input: {
    walletId: string;
    contractAddress: string;
    callData: string;
    amount?: string;
  }
): Promise<{ challengeId: string } | { error: string }> {
  const { ok, data, raw } = await circleFetch<{ challengeId: string }>(
    "/v1/w3s/user/transactions/contractExecution",
    {
      method: "POST",
      userToken,
      body: {
        idempotencyKey: crypto.randomUUID(),
        walletId: input.walletId,
        contractAddress: input.contractAddress,
        callData: input.callData,
        feeLevel: "MEDIUM",
        ...(input.amount ? { amount: input.amount } : {}),
      },
    }
  );

  if (!ok || !data.challengeId) {
    return { error: circleErrorMessage(raw, "Could not create contract transaction") };
  }
  return { challengeId: data.challengeId };
}

export async function createSignTypedDataChallenge(
  userToken: string,
  input: {
    walletId: string;
    typedData: unknown;
  }
): Promise<{ challengeId: string } | { error: string }> {
  const { ok, data, raw } = await circleFetch<{ challengeId: string }>(
    "/v1/w3s/user/sign/typedData",
    {
      method: "POST",
      userToken,
      body: {
        idempotencyKey: crypto.randomUUID(),
        walletId: input.walletId,
        data: JSON.stringify(input.typedData),
      },
    }
  );

  if (!ok || !data.challengeId) {
    return { error: circleErrorMessage(raw, "Could not create signature challenge") };
  }
  return { challengeId: data.challengeId };
}

type ChallengeStatus = "PENDING" | "IN_PROGRESS" | "COMPLETE" | "FAILED" | "EXPIRED";

async function getChallenge(
  userToken: string,
  challengeId: string
): Promise<{
  status: ChallengeStatus;
  transactionId?: string;
  signature?: string;
  errorMessage?: string;
}> {
  const { ok, data, raw } = await circleFetch<{
    challenge?: {
      status: ChallengeStatus;
      correlationIds?: string[];
      errorMessage?: string;
      signature?: string;
    };
  }>(`/v1/w3s/user/challenges/${challengeId}`, { userToken });

  if (!ok) {
    throw new Error(circleErrorMessage(raw, "Could not load challenge status"));
  }

  const ch = data.challenge;
  return {
    status: ch?.status ?? "PENDING",
    transactionId: ch?.correlationIds?.[0],
    signature: ch?.signature,
    errorMessage: ch?.errorMessage,
  };
}

export async function waitForChallengeTxHash(
  userToken: string,
  challengeId: string,
  options?: { maxAttempts?: number; intervalMs?: number }
): Promise<string> {
  const maxAttempts = options?.maxAttempts ?? 60;
  const intervalMs = options?.intervalMs ?? 2000;

  for (let i = 0; i < maxAttempts; i++) {
    const ch = await getChallenge(userToken, challengeId);
    if (ch.status === "FAILED" || ch.status === "EXPIRED") {
      throw new Error(ch.errorMessage ?? "Transaction failed");
    }
    if (ch.status === "COMPLETE" && ch.transactionId) {
      const { ok, data, raw } = await circleFetch<{
        transaction?: { txHash?: string; state?: string };
      }>(`/v1/w3s/transactions/${ch.transactionId}`, { userToken });
      if (!ok) {
        throw new Error(circleErrorMessage(raw, "Could not load transaction"));
      }
      if (data.transaction?.txHash) return data.transaction.txHash;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Transaction confirmation timed out");
}

export async function waitForChallengeSignature(
  userToken: string,
  challengeId: string,
  options?: { maxAttempts?: number; intervalMs?: number }
): Promise<string> {
  const maxAttempts = options?.maxAttempts ?? 45;
  const intervalMs = options?.intervalMs ?? 1500;

  for (let i = 0; i < maxAttempts; i++) {
    const ch = await getChallenge(userToken, challengeId);
    if (ch.status === "FAILED" || ch.status === "EXPIRED") {
      throw new Error(ch.errorMessage ?? "Signature failed");
    }
    if (ch.status === "COMPLETE" && ch.signature) {
      return ch.signature;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Signature confirmation timed out");
}
