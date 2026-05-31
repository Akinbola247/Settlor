"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useInvoices } from "@/hooks/useInvoices";
import { formatUSDC, invoiceTotal } from "@/lib/utils";

function PaymentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { wallet, usdcBalance } = useWallet();
  const { invoices, refresh } = useInvoices();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "send" || action === "receive") {
      router.replace("/dashboard/deposit");
    } else if (action === "withdraw") {
      router.replace("/dashboard/transfer");
    }
  }, [searchParams, router]);

  if (!wallet) return null;

  const paid = invoices.sent.filter((i) => i.status === "paid");
  const totalReceived = paid.reduce((s, i) => s + invoiceTotal(i.items), 0);
  const outstanding = invoices.received
    .filter((i) => i.status === "pending" || i.status === "overdue")
    .reduce((s, i) => s + invoiceTotal(i.items), 0);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Payments</h1>
          <p className="text-sm text-[var(--color-muted)]">Summary and history</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/deposit" className="btn-accent">
            Deposit
          </Link>
          <Link href="/dashboard/transfer" className="btn-outline">
            Transfer
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/deposit"
          className="card group p-6 transition hover:border-brand hover:shadow-md"
        >
          <p className="font-display text-lg font-bold group-hover:text-brand-strong">Deposit</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Add USDC to your balance</p>
        </Link>
        <Link
          href="/dashboard/transfer"
          className="card group p-6 transition hover:border-slate-300 hover:shadow-md"
        >
          <p className="font-display text-lg font-bold">Transfer</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Send to any address</p>
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-6">
          <p className="text-xs uppercase text-[var(--color-muted)]">Balance</p>
          <p className="mt-2 font-display text-3xl font-bold">
            ${formatUSDC(parseFloat(usdcBalance) || 0)}
          </p>
          <Link href="/dashboard/wallet" className="mt-2 inline-block text-xs font-semibold text-brand">
            Wallet →
          </Link>
        </div>
        <div className="card p-6">
          <p className="text-xs uppercase text-[var(--color-muted)]">Collected</p>
          <p className="mt-2 font-display text-3xl font-bold text-emerald-600">${formatUSDC(totalReceived)}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">{paid.length} paid</p>
        </div>
        <div className="card p-6">
          <p className="text-xs uppercase text-[var(--color-muted)]">You owe</p>
          <p className="mt-2 font-display text-3xl font-bold text-amber-600">${formatUSDC(outstanding)}</p>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-display text-lg font-bold">Paid invoices</h2>
        {paid.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-muted)]">None yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--color-border)]">
            {paid.map((inv) => (
              <li key={inv.id} className="flex justify-between py-4">
                <div>
                  <p className="font-medium">{inv.recipientName}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {inv.invoiceNumber}
                    {inv.paidAt ? ` · ${new Date(inv.paidAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <span className="font-bold text-emerald-600">
                  +${formatUSDC(invoiceTotal(inv.items))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="spinner" />}>
      <PaymentsContent />
    </Suspense>
  );
}
