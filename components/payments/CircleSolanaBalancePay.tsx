/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRef, useState } from "react";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import { readClientCircleCreds } from "@/lib/circle-auth";
import { executeSolanaTransfer } from "@/lib/solana-transfer-client";
import { formatUSDC } from "@/lib/utils";
import type { LiveBridgeStep } from "@/lib/bridge-client";

type Props = {
  recipientSolanaAddress: string;
  amount: string;
  solanaBalance: string;
  payerWalletId: string;
  onSuccess: (steps: LiveBridgeStep[]) => void;
  onError?: (msg: string) => void;
  buttonLabel?: string;
};

function deviceIdFromBrowser(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem("deviceId") ?? undefined;
}

export default function CircleSolanaBalancePay({
  recipientSolanaAddress,
  amount,
  solanaBalance,
  payerWalletId,
  onSuccess,
  onError,
  buttonLabel,
}: Props) {
  const sdkRef = useRef<W3SSdk | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const balanceNum = parseFloat(solanaBalance);
  const amountNum = parseFloat(amount);
  const insufficient = amountNum > balanceNum;

  const handlePay = async () => {
    setError(null);
    setLoading(true);
    try {
      const steps = await executeSolanaTransfer(sdkRef, {
        destinationAddress: recipientSolanaAddress,
        amount,
        walletId: payerWalletId,
        onStatus: setStatusMessage,
      });
      setDone(true);
      setStatusMessage("Payment sent.");
      onSuccess(steps);
    } catch (e: any) {
      const msg = e.message ?? "Payment failed";
      setError(msg);
      onError?.(msg);
      setStatusMessage(null);
    } finally {
      setLoading(false);
    }
  };

  const needsReLogin = !readClientCircleCreds() && !deviceIdFromBrowser();

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
        <p className="font-semibold text-emerald-800">Payment complete</p>
        <p className="mt-1 text-xs text-emerald-700">
          ${amount} USDC sent from your Settlor balance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--color-border)] bg-slate-50 px-4 py-3 text-sm">
        <p className="font-medium">Pay from your balance</p>
        <p className="mt-2 text-sm">
          Available: <strong>${formatUSDC(balanceNum)} USDC</strong>
        </p>
      </div>

      {needsReLogin && (
        <p className="text-sm text-amber-700">
          If payment fails, sign out and sign in again on this browser.
        </p>
      )}

      {insufficient && (
        <p className="text-sm font-medium text-amber-700">
          Not enough USDC (${formatUSDC(balanceNum)} available).{" "}
          <a href="/dashboard/deposit" className="text-brand underline">
            Deposit
          </a>{" "}
          or pay with an external wallet below.
        </p>
      )}

      {statusMessage && <p className="text-sm font-medium text-brand-strong">{statusMessage}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        className="btn-accent w-full"
        disabled={loading || insufficient}
        onClick={handlePay}
      >
        {loading ? "Processing…" : buttonLabel ?? `Pay $${amount} from balance`}
      </button>
    </div>
  );
}
