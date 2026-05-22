const CIRCLE_BASE_URL =
  process.env.NEXT_PUBLIC_CIRCLE_BASE_URL ?? "https://api.circle.com";
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY as string;

export function circleErrorMessage(data: unknown, fallback = "Circle API error"): string {
  if (!data || typeof data !== "object") return fallback;
  const d = data as Record<string, unknown>;
  const msg = d.message ?? d.error;
  if (typeof msg === "string") return msg;
  if (d.code) return `[${d.code}] ${JSON.stringify(d)}`;
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

export async function validateCircleUserToken(userToken: string): Promise<{
  valid: boolean;
  wallets: { id: string; address: string; blockchain: string }[];
  error?: string;
}> {
  const { ok, data, raw } = await circleFetch<{
    wallets?: { id: string; address: string; blockchain: string }[];
  }>("/v1/w3s/wallets", { userToken });

  if (!ok) {
    return { valid: false, wallets: [], error: circleErrorMessage(raw, "Invalid user token") };
  }
  return { valid: true, wallets: data.wallets ?? [] };
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

export function extractUsdcBalance(
  balances: { amount?: string; token?: { symbol?: string; name?: string } }[]
): string {
  const usdc =
    balances.find((t) => {
      const symbol = t.token?.symbol ?? "";
      const name = t.token?.name ?? "";
      return symbol.startsWith("USDC") || name.includes("USDC");
    }) ?? null;
  return usdc?.amount ?? "0";
}
