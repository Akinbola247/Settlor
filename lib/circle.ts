import {
  findWalletById,
  isSettlementBlockchain,
  pickSettlementWallet,
  type CircleWalletRecord,
} from "@/lib/circle-wallet";
import { CIRCLE_SOLANA_BLOCKCHAIN } from "@/lib/solana-config";

const CIRCLE_BASE_URL =
  process.env.NEXT_PUBLIC_CIRCLE_BASE_URL ?? "https://api.circle.com";
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY as string;

export function circleErrorMessage(data: unknown, fallback = "Circle API error"): string {
  if (!data || typeof data !== "object") return fallback;
  const d = data as Record<string, unknown>;
  const msg = d.message ?? d.error;
  if (typeof msg === "string") {
    if (Array.isArray(d.errors) && d.errors.length > 0) {
      return `${msg}: ${JSON.stringify(d.errors).slice(0, 400)}`;
    }
    return msg;
  }
  if (d.code != null) return `[${String(d.code)}] ${JSON.stringify(d).slice(0, 400)}`;
  return fallback;
}

export async function circleFetch<T>(
  path: string,
  options: {
    method?: string;
    userToken?: string;
    body?: Record<string, unknown>;
  } = {}
): Promise<{ ok: boolean; status: number; data: T; raw: unknown }> {
  const { method = "GET", userToken, body } = options;
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
    Authorization: `Bearer ${CIRCLE_API_KEY}`,
  };
  if (userToken) headers["X-User-Token"] = userToken;

  const res = await fetch(`${CIRCLE_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();
  const data = (json.data ?? json) as T;
  return { ok: res.ok, status: res.status, data, raw: json };
}

export async function listCircleWallets(
  userToken: string
): Promise<CircleWalletRecord[]> {
  const { ok, data } = await circleFetch<{ wallets?: CircleWalletRecord[] }>(
    "/v1/w3s/wallets",
    { userToken }
  );
  if (!ok) return [];
  return data.wallets ?? [];
}

export async function validateCircleUserToken(userToken: string): Promise<{
  valid: boolean;
  wallets: CircleWalletRecord[];
  error?: string;
}> {
  const { ok, data, raw } = await circleFetch<{
    wallets?: CircleWalletRecord[];
  }>("/v1/w3s/wallets", { userToken });

  if (!ok) {
    return { valid: false, wallets: [], error: circleErrorMessage(raw, "Invalid user token") };
  }
  return { valid: true, wallets: data.wallets ?? [] };
}

export async function resolveSettlementWallet(
  userToken: string,
  walletId: string
): Promise<{ wallet: CircleWalletRecord } | { error: string }> {
  const wallets = await listCircleWallets(userToken);
  const wallet = findWalletById(wallets, walletId);
  if (!wallet) {
    return { error: "Wallet not found for this account." };
  }
  if (!isSettlementBlockchain(wallet.blockchain)) {
    const settlement = pickSettlementWallet(wallets);
    if (settlement) {
      return {
        error:
          `Your session wallet is on ${wallet.blockchain}, not ${CIRCLE_SOLANA_BLOCKCHAIN}. ` +
          `Sign out and sign in again to use your Solana wallet (${settlement.address.slice(0, 8)}…).`,
      };
    }
    return {
      error:
        `This wallet is on ${wallet.blockchain}. Settlor needs a Circle Solana wallet — sign out, sign in again, and complete wallet setup.`,
    };
  }
  return { wallet };
}

export async function getWalletBalances(userToken: string, walletId: string) {
  const { ok, data } = await circleFetch<{
    tokenBalances: { amount?: string; token?: { symbol?: string; name?: string } }[];
  }>(`/v1/w3s/wallets/${walletId}/balances`, { userToken });
  if (!ok) return null;
  return data.tokenBalances ?? [];
}

export async function refreshCircleUserToken(input: {
  userToken: string;
  refreshToken: string;
  deviceId: string;
}): Promise<
  | { userToken: string; encryptionKey: string; refreshToken?: string }
  | { error: string }
> {
  const { ok, data, raw } = await circleFetch<{
    userToken: string;
    encryptionKey?: string;
    refreshToken?: string;
  }>("/v1/w3s/users/token/refresh", {
    method: "POST",
    userToken: input.userToken,
    body: {
      idempotencyKey: crypto.randomUUID(),
      refreshToken: input.refreshToken,
      deviceId: input.deviceId,
    },
  });

  if (!ok || !data.userToken) {
    return { error: circleErrorMessage(raw, "Could not refresh Circle session") };
  }

  return {
    userToken: data.userToken,
    encryptionKey: data.encryptionKey ?? "",
    refreshToken: data.refreshToken,
  };
}

export type CircleTokenBalance = {
  amount?: string;
  token?: { id?: string; symbol?: string; name?: string; blockchain?: string };
};

export function findUsdcBalance(balances: CircleTokenBalance[]): CircleTokenBalance | null {
  return (
    balances.find((t) => {
      const symbol = t.token?.symbol ?? "";
      const name = t.token?.name ?? "";
      return symbol.startsWith("USDC") || name.includes("USDC");
    }) ?? null
  );
}

export function extractUsdcBalance(balances: CircleTokenBalance[]): string {
  return findUsdcBalance(balances)?.amount ?? "0";
}

/** Circle token UUID for USDC — required for W3S transfers (blockchain alone sends native SOL). */
export function extractUsdcTokenId(balances: CircleTokenBalance[]): string | null {
  return findUsdcBalance(balances)?.token?.id ?? null;
}
