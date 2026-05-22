"use client";

import { useState } from "react";

type Props = {
  myArcAddress: string;
};

export default function DepositReceivePanel({ myArcAddress }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(myArcAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-semibold">Arc + USDC only</p>
        <p className="mt-1 text-xs text-amber-900/90">
          Other networks won&apos;t show up here. Use &ldquo;From another network&rdquo; instead.
        </p>
      </div>

      <div>
        <p className="field-label">Your address</p>
        <code className="block break-all rounded-xl border border-[var(--color-border)] bg-slate-50 p-4 text-sm">
          {myArcAddress}
        </code>
      </div>

      <button type="button" className="btn-outline w-full sm:w-auto" onClick={copy}>
        {copied ? "Copied" : "Copy address"}
      </button>
    </div>
  );
}
