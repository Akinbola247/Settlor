import { circleFetch, circleErrorMessage } from "@/lib/circle";
import { CIRCLE_SOLANA_BLOCKCHAIN } from "@/lib/solana-config";

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

/** Sign a serialized Solana transaction (base64) via Circle W3S challenge flow. */
export async function createSignSolanaTransactionChallenge(
  userToken: string,
  input: {
    walletId: string;
    rawTransaction: string;
    memo?: string;
  }
): Promise<{ challengeId: string } | { error: string; raw?: unknown }> {
  // Circle docs: provide walletId OR (walletAddress + blockchain), not both.
  const { ok, data, raw } = await circleFetch<{ challengeId: string }>(
    "/v1/w3s/user/sign/transaction",
    {
      method: "POST",
      userToken,
      body: {
        idempotencyKey: crypto.randomUUID(),
        walletId: input.walletId,
        rawTransaction: input.rawTransaction,
        ...(input.memo ? { memo: input.memo.slice(0, 200) } : {}),
      },
    }
  );

  if (!ok || !data.challengeId) {
    return { error: circleErrorMessage(raw, "Could not create Solana sign challenge"), raw };
  }
  return { challengeId: data.challengeId };
}

/** Create a Solana settlement wallet for users who only have legacy (e.g. Arc) wallets. */
export async function createSolanaWalletChallenge(
  userToken: string
): Promise<{ challengeId: string } | { error: string }> {
  const { ok, data, raw } = await circleFetch<{ challengeId: string }>(
    "/v1/w3s/user/wallets",
    {
      method: "POST",
      userToken,
      body: {
        idempotencyKey: crypto.randomUUID(),
        accountType: "EOA",
        blockchains: [CIRCLE_SOLANA_BLOCKCHAIN],
        metadata: [{ name: "Settlor settlement" }],
      },
    }
  );

  if (!ok || !data.challengeId) {
    return { error: circleErrorMessage(raw, "Could not create Solana wallet") };
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
  signedTransaction?: string;
  errorMessage?: string;
}> {
  const { ok, data, raw } = await circleFetch<{
    challenge?: {
      status: ChallengeStatus;
      correlationIds?: string[];
      errorMessage?: string;
      signature?: string;
      signedTransaction?: string;
      data?: { signature?: string; signedTransaction?: string; txHash?: string };
    };
  }>(`/v1/w3s/user/challenges/${challengeId}`, { userToken });

  if (!ok) {
    throw new Error(circleErrorMessage(raw, "Could not load challenge status"));
  }

  const ch = data.challenge;
  const nested = ch?.data;
  return {
    status: ch?.status ?? "PENDING",
    transactionId: ch?.correlationIds?.[0],
    signature: nested?.signature ?? ch?.signature,
    signedTransaction: nested?.signedTransaction ?? ch?.signedTransaction,
    errorMessage: ch?.errorMessage,
  };
}

export type SignTransactionChallengeResult = {
  signature?: string;
  signedTransaction?: string;
  txHash?: string;
};

/** Poll until a W3S sign-transaction challenge yields a signed wire transaction. */
export async function waitForSignTransactionChallenge(
  userToken: string,
  challengeId: string,
  options?: { maxAttempts?: number; intervalMs?: number }
): Promise<SignTransactionChallengeResult> {
  const maxAttempts = options?.maxAttempts ?? 45;
  const intervalMs = options?.intervalMs ?? 1500;

  for (let i = 0; i < maxAttempts; i++) {
    const ch = await getChallenge(userToken, challengeId);
    if (ch.status === "FAILED" || ch.status === "EXPIRED") {
      throw new Error(ch.errorMessage ?? "Signature failed");
    }
    if (ch.status === "COMPLETE") {
      if (ch.signedTransaction) {
        return { signedTransaction: ch.signedTransaction, signature: ch.signature };
      }
      if (ch.signature) {
        return { signature: ch.signature };
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Signature confirmation timed out");
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
