/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import {
  prepareSdkForPayment,
  readClientCircleCreds,
  storeClientCircleCreds,
} from "@/lib/circle-auth";
import {
  ARC_TESTNET_CHAIN_ID_HEX,
  ARC_TESTNET_RPC,
} from "@/lib/arc-config";

function deviceIdFromBrowser(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem("deviceId") ?? undefined;
}

async function readResponseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) {
    return { error: res.ok ? "Empty response" : `Request failed (${res.status})` };
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text.slice(0, 200) || `Request failed (${res.status})` };
  }
}

async function runChallenge(
  sdkRef: { current: W3SSdk | null },
  challengeId: string,
  userToken: string,
  encryptionKey: string
): Promise<void> {
  const sdk = await prepareSdkForPayment(sdkRef, userToken, encryptionKey);
  await new Promise<void>((resolve, reject) => {
    sdk.execute(challengeId, (err) => {
      if (err) {
        const code = (err as any)?.code;
        const msg = (err as any)?.message ?? "Cancelled";
        reject(
          new Error(
            code === 155105 || code === 155118 || /credential/i.test(msg)
              ? "Could not verify wallet. Sign in again, then retry."
              : msg
          )
        );
      } else {
        resolve();
      }
    });
  });
}

export type W3sProviderConfig = {
  arcAddress: `0x${string}`;
  walletId: string;
  sdkRef: { current: W3SSdk | null };
};

/** EIP-1193 provider backed by Arc public RPC (reads) and Circle W3S challenges (writes). */
export function createW3sEthereumProvider(config: W3sProviderConfig) {
  const { arcAddress, walletId, sdkRef } = config;
  let publicClientPromise: Promise<any> | null = null;

  async function getPublicClient() {
    if (!publicClientPromise) {
      publicClientPromise = (async () => {
        const { defineChain } = await import("viem");
        const { createBufferedPublicClient } = await import("@/lib/evm-gas-buffer");
        const chain = defineChain({
          id: 5042002,
          name: "Arc Testnet",
          nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
          rpcUrls: { default: { http: [ARC_TESTNET_RPC] } },
        });
        return createBufferedPublicClient(chain, ARC_TESTNET_RPC);
      })();
    }
    return publicClientPromise;
  }

  async function resolveCredentials(
    data: Record<string, unknown>
  ): Promise<{ userToken: string; encryptionKey: string }> {
    const localCreds = readClientCircleCreds();
    const userToken = (data.userToken as string) || localCreds?.userToken || "";
    const encryptionKey =
      (data.encryptionKey as string) || localCreds?.encryptionKey || "";
    if (!userToken || !encryptionKey) {
      throw new Error("Missing wallet session. Sign in again on this browser.");
    }
    storeClientCircleCreds({
      userToken,
      encryptionKey,
      refreshToken: localCreds?.refreshToken,
    });
    return { userToken, encryptionKey };
  }

  async function sendViaChallenge(tx: Record<string, unknown>): Promise<string> {
    const to = tx.to as string;
    const data = (tx.data as string) ?? "0x";
    const value = tx.value as string | undefined;

    const localCreds = readClientCircleCreds();
    const res = await fetch("/api/payments/w3s-send-tx", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletId,
        contractAddress: to,
        callData: data,
        value,
        deviceId: deviceIdFromBrowser(),
        ...(localCreds
          ? {
              circleUserToken: localCreds.userToken,
              circleEncryptionKey: localCreds.encryptionKey,
            }
          : {}),
      }),
    });
    const body = await readResponseJson(res);
    if (!res.ok) {
      if (body.reauth) {
        throw new Error(String(body.error ?? "Session expired. Sign in again."));
      }
      throw new Error(String(body.error ?? "Could not submit transaction"));
    }

    const creds = await resolveCredentials(body);
    const challengeId = String(body.challengeId);
    await runChallenge(sdkRef, challengeId, creds.userToken, creds.encryptionKey);
    return pollChallengeTxHash(challengeId);
  }

  async function pollChallengeTxHash(challengeId: string): Promise<string> {
    for (let i = 0; i < 60; i++) {
      const res = await fetch(
        `/api/payments/challenge-status?challengeId=${encodeURIComponent(challengeId)}&kind=tx`,
        { credentials: "include" }
      );
      const data = await readResponseJson(res);
      if (data.status === "complete" && typeof data.txHash === "string") {
        return data.txHash;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error("Transaction confirmation timed out");
  }

  async function signTypedDataViaChallenge(
    address: string,
    typedData: unknown
  ): Promise<string> {
    if (address.toLowerCase() !== arcAddress.toLowerCase()) {
      throw new Error("Signer address does not match your Arc wallet");
    }

    const localCreds = readClientCircleCreds();
    const res = await fetch("/api/payments/w3s-sign-typed-data", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletId,
        typedData,
        deviceId: deviceIdFromBrowser(),
        ...(localCreds
          ? {
              circleUserToken: localCreds.userToken,
              circleEncryptionKey: localCreds.encryptionKey,
            }
          : {}),
      }),
    });
    const body = await readResponseJson(res);
    if (!res.ok) {
      if (body.reauth) {
        throw new Error(String(body.error ?? "Session expired. Sign in again."));
      }
      throw new Error(String(body.error ?? "Could not start signature"));
    }

    const creds = await resolveCredentials(body);
    const challengeId = String(body.challengeId);
    await runChallenge(sdkRef, challengeId, creds.userToken, creds.encryptionKey);
    return pollChallengeSignature(challengeId);
  }

  async function pollChallengeSignature(challengeId: string): Promise<string> {
    for (let i = 0; i < 45; i++) {
      const res = await fetch(
        `/api/payments/challenge-status?challengeId=${encodeURIComponent(challengeId)}&kind=signature`,
        { credentials: "include" }
      );
      const data = await readResponseJson(res);
      if (data.status === "complete" && typeof data.signature === "string") {
        return data.signature;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error("Signature confirmation timed out");
  }

  return {
    request: async ({ method, params }: { method: string; params?: unknown[] }) => {
      const p = (params ?? []) as any[];

      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [arcAddress];
        case "eth_chainId":
          return ARC_TESTNET_CHAIN_ID_HEX;
        case "wallet_switchEthereumChain":
        case "wallet_addEthereumChain":
          return null;
        case "eth_sendTransaction": {
          const hash = await sendViaChallenge(p[0] ?? {});
          return hash;
        }
        case "eth_signTypedData_v4": {
          const parsed =
            typeof p[1] === "string" ? JSON.parse(p[1] as string) : p[1];
          return signTypedDataViaChallenge(p[0] as string, parsed);
        }
        case "personal_sign":
        case "eth_sign":
          throw new Error(`${method} is not supported for Circle wallet bridge`);
        default: {
          const client = await getPublicClient();
          return client.request({ method, params: p });
        }
      }
    },
  };
}
