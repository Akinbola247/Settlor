"use client";

import { useState } from "react";
import { SETTLEMENT_CHAIN_LABEL } from "@/lib/solana-config";

type Props = {
  mySolanaAddress: string;
};

export default function DepositReceivePanel({ mySolanaAddress }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(mySolanaAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Solana + USDC only</p>
        <p className="mt-1 text-xs">
          Send USDC on <strong>{SETTLEMENT_CHAIN_LABEL}</strong> only. Other networks require the
          Bridge tab.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-slate-50 p-4">
        <p className="text-xs font-medium text-[var(--color-muted)]">Your address</p>
        <p className="mt-2 break-all font-mono text-sm">{mySolanaAddress}</p>
        <button type="button" className="btn-outline mt-4 w-full text-sm" onClick={copy}>
          {copied ? "Copied" : "Copy address"}
        </button>
      </div>
    </div>
  );
}
