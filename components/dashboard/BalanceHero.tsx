"use client";

import { formatUSDC } from "@/lib/utils";

type Props = {
  balance: number;
  syncing?: boolean;
  label?: string;
  action?: React.ReactNode;
};

export default function BalanceHero({
  balance,
  syncing = false,
  label = "Balance",
  action,
}: Props) {
  return (
    <div className="card-elevated flex flex-wrap items-center justify-between gap-4 p-6 ring-1 ring-[var(--color-brand)]/10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <p className="font-display text-3xl font-bold">${formatUSDC(balance)}</p>
          {syncing && (
            <span className="flex items-center gap-2 text-xs font-medium text-brand">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand border-t-[var(--color-brand)]" />
              Updating…
            </span>
          )}
        </div>
        {syncing && (
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            This can take up to a minute after the transfer completes.
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
