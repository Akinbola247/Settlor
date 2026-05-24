"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/hooks/useWallet";
import { useInvoices } from "@/hooks/useInvoices";
import InvoiceDetailModal from "@/components/invoices/InvoiceDetailModal";
import type { InvoiceDto } from "@/lib/types";
import { formatUSDC, invoiceTotal } from "@/lib/utils";
import IncomeChart from "@/components/dashboard/IncomeChart";
import StatCard from "@/components/dashboard/StatCard";
import RecentActivities from "@/components/dashboard/RecentActivities";

export default function DashboardOverviewPage() {
  const { wallet, usdcBalance, user } = useWallet();
  const { invoices, refresh } = useInvoices();
  const [selected, setSelected] = useState<InvoiceDto | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!wallet) return null;

  const balance = parseFloat(usdcBalance) || 0;
  const paidSent = invoices.sent.filter((i) => i.status === "paid");
  const totalCollected = paidSent.reduce((s, i) => s + invoiceTotal(i.items), 0);
  const outstandingOwed = invoices.received
    .filter((i) => i.status === "pending" || i.status === "overdue")
    .reduce((s, i) => s + invoiceTotal(i.items), 0);
  const outstandingToCollect = invoices.sent
    .filter((i) => i.status === "pending" || i.status === "overdue")
    .reduce((s, i) => s + invoiceTotal(i.items), 0);
  const pendingReceived = invoices.received.filter(
    (i) => i.status === "pending" || i.status === "overdue"
  );

  const exposureMax = Math.max(outstandingOwed, balance, 1);
  const owedPct = outstandingOwed > 0 ? (outstandingOwed / exposureMax) * 100 : 0;

  const firstName = user?.displayName?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <div className="mb-6 sm:mb-8">
        <h1 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
          {greeting}, {firstName}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Invoices and USDC balance at a glance.</p>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-12">
        <div className="card p-5 sm:p-6 lg:col-span-5 lg:p-8">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Total balance
            </p>
            <span className="rounded-lg border border-[var(--color-border)] bg-slate-50 px-2 py-1 text-xs font-bold">
              USDC
            </span>
          </div>
          <p className="mt-3 font-serif text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">USDC</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard/deposit" className="btn-primary rounded-full px-6">
              Deposit
            </Link>
            <Link href="/dashboard/transfer" className="btn-outline rounded-full px-6">
              Transfer
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7 xl:grid-cols-3">
          <StatCard
            label="Collected"
            value={`$${formatUSDC(totalCollected)}`}
            delta={`${paidSent.length} paid invoice(s)`}
            deltaPositive
            accent
          />
          <StatCard
            label="You owe"
            value={`$${formatUSDC(outstandingOwed)}`}
            delta={pendingReceived.length ? `${pendingReceived.length} bill(s) open` : "All clear"}
            deltaPositive={outstandingOwed === 0}
          />
          <StatCard
            label="To collect"
            value={`$${formatUSDC(outstandingToCollect)}`}
            delta="Open invoices you sent"
            deltaPositive
          />
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5 space-y-4">
          <Link href="/dashboard/wallet" className="card block p-6 transition hover:border-orange-200">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold">Wallet</h2>
              <span className="badge badge-paid text-[10px]">Active</span>
            </div>
            <p className="mt-2 font-serif text-2xl font-bold">${formatUSDC(balance)}</p>
            <p className="mt-1 font-mono text-xs text-[var(--color-muted)] truncate">
              {wallet.address}
            </p>
            <p className="mt-3 text-xs font-semibold text-orange-600">View wallet →</p>
          </Link>

          <div className="card p-6">
            <h2 className="font-serif text-lg font-bold">Bills to pay</h2>
            {outstandingOwed > 0 ? (
              <>
                <p className="mt-1 text-sm text-amber-700 font-medium">
                  ${formatUSDC(outstandingOwed)} outstanding
                </p>
                <div className="progress-track mt-4">
                  <div className="progress-fill" style={{ width: `${owedPct}%` }} />
                </div>
                <Link
                  href="/dashboard/invoices"
                  className="mt-3 inline-block text-xs font-semibold text-orange-600"
                >
                  Pay invoices →
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-[var(--color-muted)]">No pending bills.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-7">
          <IncomeChart invoices={invoices.sent} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="card p-6">
            <h2 className="font-serif text-lg font-bold">Quick links</h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="/dashboard/invoices" className="font-semibold text-orange-600 hover:underline">
                  Manage invoices
                </Link>
              </li>
              <li>
                <Link href="/dashboard/payments" className="font-semibold text-orange-600 hover:underline">
                  Payments
                </Link>
              </li>
              <li>
                <Link href="/dashboard/deposit" className="font-semibold text-orange-600 hover:underline">
                  Deposit
                </Link>
              </li>
              <li>
                <Link href="/dashboard/wallet" className="font-semibold text-orange-600 hover:underline">
                  Wallet
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="lg:col-span-8">
          <RecentActivities
            sent={invoices.sent}
            received={invoices.received}
            onSelect={setSelected}
          />
        </div>
      </div>

      {selected && wallet && (
        <InvoiceDetailModal
          invoice={selected}
          currentUserAddress={wallet.address}
          currentUserEmail={user?.email}
          payerWalletId={wallet.id}
          payerArcBalance={usdcBalance}
          onPaid={() => {
            setSelected(null);
            void refresh();
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
