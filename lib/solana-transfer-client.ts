/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import {
  prepareSdkForPayment,
  readClientCircleCreds,
  storeClientCircleCreds,
} from "@/lib/circle-auth";
import type { LiveBridgeStep } from "@/lib/bridge-client";

function deviceIdFromBrowser(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem("deviceId") ?? undefined;
}

async function readResponseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) {
    return { error: res.ok ? "Empty response from server" : `Request failed (${res.status})` };
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text.slice(0, 200) || `Request failed (${res.status})` };
  }
}

async function pollTransferStatus(challengeId: string): Promise<LiveBridgeStep[]> {
  for (let i = 0; i < 45; i++) {
    const res = await fetch(
      `/api/payments/transfer-status?challengeId=${encodeURIComponent(challengeId)}`,
      { credentials: "include" }
    );
    const data = await readResponseJson(res);
    if (data.status === "complete" && Array.isArray(data.steps) && data.steps.length) {
      return data.steps as LiveBridgeStep[];
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Transfer confirmation timed out");
}

export async function executeSolanaTransfer(
  sdkRef: { current: W3SSdk | null },
  input: {
    destinationAddress: string;
    amount: string;
    walletId: string;
    onStatus?: (msg: string) => void;
  }
): Promise<LiveBridgeStep[]> {
  const { destinationAddress, amount, walletId, onStatus } = input;
  const localCreds = readClientCircleCreds();

  onStatus?.("Preparing transfer…");

  const transferRes = await fetch("/api/payments/transfer", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      destinationAddress,
      amount,
      walletId,
      deviceId: deviceIdFromBrowser(),
      ...(localCreds
        ? {
            circleUserToken: localCreds.userToken,
            circleEncryptionKey: localCreds.encryptionKey,
          }
        : {}),
    }),
  });

  const transferData = await readResponseJson(transferRes);
  if (!transferRes.ok) {
    if (transferData.reauth) {
      throw new Error(
        String(transferData.error ?? "Session expired. Sign in again, then retry.")
      );
    }
    throw new Error(String(transferData.error ?? "Could not start transfer"));
  }

  const userToken = (transferData.userToken as string) || localCreds?.userToken || "";
  const encryptionKey =
    (transferData.encryptionKey as string) || localCreds?.encryptionKey || "";
  if (!userToken || !encryptionKey) {
    throw new Error("Missing wallet session. Sign in again on this browser.");
  }

  storeClientCircleCreds({
    userToken,
    encryptionKey,
    refreshToken: localCreds?.refreshToken,
  });

  onStatus?.("Confirm in the popup…");
  const sdk = await prepareSdkForPayment(sdkRef, userToken, encryptionKey);

  await new Promise<void>((resolve, reject) => {
    sdk.execute(String(transferData.challengeId), (err) => {
      if (err) {
        const code = (err as any)?.code;
        const msg = (err as any)?.message ?? "Transfer cancelled";
        reject(
          new Error(
            code === 155105 || code === 155118 || /credential/i.test(msg)
              ? `Could not verify wallet. Sign in again, then retry.`
              : msg
          )
        );
      } else {
        resolve();
      }
    });
  });

  onStatus?.("Confirming…");
  return pollTransferStatus(String(transferData.challengeId));
}