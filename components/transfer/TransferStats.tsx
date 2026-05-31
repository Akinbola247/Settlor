import Link from "next/link";
import { formatUSDC } from "@/lib/utils";

type Props = {
  balance: number;
  syncing?: boolean;
};

export default function TransferStats({ balance, syncing }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="card relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand-muted/80" />
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
          Available
        </p>
        <div className="mt-2 flex items-center gap-2">
          <p className="font-display text-3xl font-bold">${formatUSDC(balance)}</p>
          {syncing && (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-[var(--color-brand)]" />
          )}
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted)]">USDC on your balance</p>
      </div>

      <div className="card p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
          Transfers
        </p>
        <p className="mt-2 text-sm font-medium text-[var(--color-ink)]">Fastest option</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
          Same-network transfers confirm quickly.
        </p>
      </div>

      <div className="card flex flex-col justify-between p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
            Other networks
          </p>
          <p className="mt-2 text-sm font-medium">Ethereum, Base, and more</p>
        </div>
        <Link href="/dashboard/deposit" className="mt-3 text-xs font-bold text-brand hover:underline">
          Add funds →
        </Link>
      </div>
    </div>
  );
}
