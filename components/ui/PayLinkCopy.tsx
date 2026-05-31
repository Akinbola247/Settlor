"use client";

import { useState } from "react";

export default function PayLinkCopy({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="rounded-xl border border-brand bg-brand-subtle p-4">
      <p className="text-sm font-semibold text-brand-strong">Share this pay link with your client</p>
      <p className="mt-1 text-xs text-brand-strong/80">
        They can pay with MetaMask from any supported testnet — no Settlor account required.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          readOnly
          value={url}
          className="field-input flex-1 font-mono text-xs"
          onFocus={(e) => e.target.select()}
        />
        <button type="button" onClick={copy} className="btn-accent shrink-0 px-4">
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
