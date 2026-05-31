"use client";

import { SETTLEMENT_CHAIN_LABEL } from "@/lib/solana-config";

type Props = {
  solanaAddress: string;
  isSameChainTransfer: boolean;
  destinationLabel?: string;
};

export default function TransferAside({
  solanaAddress,
  isSameChainTransfer,
  destinationLabel,
}: Props) {
  return (
    <aside className="space-y-6 lg:sticky lg:top-24">
      <div className="card p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Your Solana wallet
        </p>
        <p className="mt-2 break-all font-mono text-xs">{solanaAddress}</p>
        <button
          type="button"
          className="mt-3 text-xs font-semibold text-brand hover:underline"
          onClick={() => navigator.clipboard.writeText(solanaAddress)}
        >
          Copy address
        </button>
      </div>

      <div className="card p-5 text-sm">
        <p className="font-semibold">
          {isSameChainTransfer ? "Solana transfer" : "Cross-chain withdraw"}
        </p>
        {isSameChainTransfer ? (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[var(--color-muted)]">
            <li>Same-chain USDC on {SETTLEMENT_CHAIN_LABEL}.</li>
            <li>Recipient needs a Solana address.</li>
            <li>Usually confirms in under a minute.</li>
          </ul>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[var(--color-muted)]">
            <li>USDC leaves your Settlor balance on Solana.</li>
            <li>CCTP mints on {destinationLabel ?? "the destination network"}.</li>
            <li>Minimum $3 USDC for cross-chain (protocol fees).</li>
          </ul>
        )}
      </div>

      <p className="text-xs text-[var(--color-muted)]">
        Need more USDC? Bridge from Arc, Ethereum, Base, or other networks on the Deposit page.
      </p>
    </aside>
  );
}
