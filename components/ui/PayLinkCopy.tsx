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
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
      <p className="text-sm font-semibold text-orange-900">Share this pay link with your client</p>
      <p className="mt-1 text-xs text-orange-800/80">
        They can pay with MetaMask from any supported testnet — no iPayX account required.
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
