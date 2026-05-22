"use client";

import Link from "next/link";

type Props = {
  arcAddress: string;
  isArcNetwork: boolean;
};

export default function TransferAside({ arcAddress, isArcNetwork }: Props) {
  return (
    <aside className="space-y-4">
      <div className="card p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
          Your wallet
        </p>
        <p className="mt-2 font-mono text-xs leading-relaxed break-all text-[var(--color-ink)]">
          {arcAddress}
        </p>
        <button
          type="button"
          className="mt-3 text-xs font-semibold text-orange-600 hover:underline"
          onClick={() => navigator.clipboard.writeText(arcAddress)}
        >
          Copy address
        </button>
        <Link href="/dashboard/wallet" className="mt-2 block text-xs font-semibold text-[var(--color-muted)] hover:text-orange-600">
          Wallet details →
        </Link>
      </div>

      <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-700">
          {isArcNetwork ? "Arc transfer" : "Cross-network"}
        </p>
        {isArcNetwork ? (
          <ul className="mt-3 space-y-2 text-sm text-orange-950/90">
            <li>Usually completes in under a minute.</li>
            <li>Recipient must accept USDC on Arc.</li>
            <li>You may confirm once in the popup.</li>
          </ul>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-orange-950/90">
            <li>Can take a few minutes to settle.</li>
            <li>Recipient address must match the network you pick.</li>
            <li>Funds leave your iPayX balance.</li>
          </ul>
        )}
      </div>

      <div className="card p-5">
        <p className="font-semibold text-sm">Need more USDC?</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Bridge in from another network or receive on Arc.
        </p>
        <Link href="/dashboard/deposit" className="btn-accent mt-4 w-full text-center text-sm">
          Deposit
        </Link>
      </div>

      <div className="card p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
          Quick links
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <Link href="/dashboard/invoices" className="font-medium text-orange-600 hover:underline">
              Invoices
            </Link>
          </li>
          <li>
            <Link href="/dashboard/activity" className="font-medium text-orange-600 hover:underline">
              Activity
            </Link>
          </li>
          <li>
            <Link href="/dashboard/payments" className="font-medium text-orange-600 hover:underline">
              Payments history
            </Link>
          </li>
        </ul>
      </div>
    </aside>
  );
}
