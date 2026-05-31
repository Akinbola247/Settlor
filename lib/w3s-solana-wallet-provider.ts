/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import {
  prepareSdkForPayment,
  readClientCircleCreds,
  storeClientCircleCreds,
} from "@/lib/circle-auth";
import { createSolanaRpc } from "@solana/kit";
import { solanaRpcUrl } from "@/lib/solana-config";

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

export type W3sSolanaProviderConfig = {
  solanaAddress: string;
  walletId: string;
  sdkRef: { current: W3SSdk | null };
};

/** Minimal Solana wallet provider for Circle App Kit + W3S signing challenges. */
export function createW3sSolanaWalletProvider(config: W3sSolanaProviderConfig) {
  const { solanaAddress, walletId, sdkRef } = config;

  async function runSignTransactionChallenge(
    challengeId: string,
    userToken: string,
    encryptionKey: string
  ): Promise<{ signedTransaction?: string; signature?: string }> {
    const sdk = await prepareSdkForPayment(sdkRef, userToken, encryptionKey);
    let fromSdk: { signedTransaction?: string; signature?: string } = {};

    await new Promise<void>((resolve, reject) => {
      sdk.execute(challengeId, (err, result) => {
        if (err) {
          const msg = (err as any)?.message ?? "Cancelled";
          reject(new Error(msg));
          return;
        }
        const data = (result as { data?: { signedTransaction?: string; signature?: string } } | undefined)
          ?.data;
        if (data?.signedTransaction) {
          fromSdk = {
            signedTransaction: data.signedTransaction,
            signature: data.signature,
          };
        } else if (data?.signature) {
          fromSdk = { signature: data.signature };
        }
        resolve();
      });
    });

    if (fromSdk.signedTransaction) return fromSdk;

    for (let i = 0; i < 45; i++) {
      const res = await fetch(
        `/api/payments/challenge-status?challengeId=${encodeURIComponent(challengeId)}&kind=sign-transaction`,
        { credentials: "include" }
      );
      const data = await readResponseJson(res);
      if (data.status === "complete") {
        if (typeof data.signedTransaction === "string") {
          return {
            signedTransaction: data.signedTransaction,
            signature: typeof data.signature === "string" ? data.signature : undefined,
          };
        }
        if (typeof data.signature === "string") {
          return { signature: data.signature };
        }
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    throw new Error("Solana signing timed out. Complete the Circle popup and try again.");
  }

  async function signTransaction(transaction: unknown): Promise<unknown> {
    const { getBase64EncodedWireTransaction } = await import("@solana/kit");

    let rawBase64: string;
    if (typeof transaction === "string") {
      rawBase64 = transaction;
    } else if (transaction && typeof transaction === "object" && "serialize" in transaction) {
      rawBase64 = Buffer.from((transaction as any).serialize()).toString("base64");
    } else {
      rawBase64 = getBase64EncodedWireTransaction(transaction as any);
    }

    const localCreds = readClientCircleCreds();
    const res = await fetch("/api/payments/w3s-sign-solana-tx", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletId,
        rawTransaction: rawBase64,
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
      throw new Error(String(body.error ?? "Could not start Solana transaction"));
    }

    const userToken = (body.userToken as string) || localCreds?.userToken || "";
    const encryptionKey = (body.encryptionKey as string) || localCreds?.encryptionKey || "";
    if (!userToken || !encryptionKey) {
      throw new Error("Missing wallet session. Sign in again.");
    }

    storeClientCircleCreds({
      userToken,
      encryptionKey,
      refreshToken: localCreds?.refreshToken,
    });

    const { signedTransaction, signature } = await runSignTransactionChallenge(
      String(body.challengeId),
      userToken,
      encryptionKey
    );

    if (signedTransaction) {
      return signedTransaction;
    }

    if (signature) {
      return { __signatureOnly: true, signature, originalWire: rawBase64 };
    }

    throw new Error("Circle did not return a signed Solana transaction. Try again.");
  }

  return {
    isConnected: true,
    address: solanaAddress,
    async connect() {
      return { address: solanaAddress };
    },
    async disconnect() {},
    signTransaction,
    async signAllTransactions(transactions: unknown[]) {
      const out: unknown[] = [];
      for (const tx of transactions) {
        out.push(await signTransaction(tx));
      }
      return out;
    },
    getRpc: () => createSolanaRpc(solanaRpcUrl()),
  };
}
