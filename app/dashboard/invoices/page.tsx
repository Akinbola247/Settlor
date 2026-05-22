"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { useInvoices } from "@/hooks/useInvoices";
import InvoiceDetailModal from "@/components/invoices/InvoiceDetailModal";
import InvoiceViewTabs, { type InvoiceView } from "@/components/invoices/InvoiceViewTabs";
import type { InvoiceDto } from "@/lib/types";
import { formatUSDC, invoiceTotal } from "@/lib/utils";
import { getStatusBadgeClass } from "@/lib/status";
import EmailLinkBanner from "@/components/account/EmailLinkBanner";
import { cn } from "@/lib/utils";

type Filter = "all" | "pending" | "paid" | "draft" | "overdue";

const RECEIVED_FILTERS: Filter[] = ["all", "pending", "overdue", "paid"];
const SENT_FILTERS: Filter[] = ["all", "pending", "paid", "draft", "overdue"];

function InvoicesContent() {
  const searchParams = useSearchParams();
  const { wallet, user, usdcBalance } = useWallet();
  const { invoices, refresh, remove } = useInvoices();
  const [view, setView] = useState<InvoiceView>("received");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<InvoiceDto | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const v = searchParams.get("view");
    if (v === "sent" || v === "received") setView(v);
    const f = searchParams.get("filter");
    if (f && ["all", "pending", "paid", "draft", "overdue"].includes(f)) {
      setFilter(f as Filter);
    }
  }, [searchParams]);

  const stats = useMemo(() => {
    const sum = (list: InvoiceDto[], statuses?: string[]) =>
      list
        .filter((i) => !statuses || statuses.includes(i.status))
        .reduce((s, i) => s + invoiceTotal(i.items), 0);

    const toPayOpen = invoices.received.filter(
      (i) => i.status === "pending" || i.status === "overdue"
    );

    return {
      toPayCount: toPayOpen.length,
      toPayDue: sum(invoices.received, ["pending", "overdue"]),
      sentCount: invoices.sent.length,
      sentOutstanding: sum(invoices.sent, ["pending", "overdue"]),
    };
  }, [invoices]);

  const handleViewChange = (next: InvoiceView) => {
    setView(next);
    setFilter("all");
  };

  if (!wallet) return null;

  const list = view === "sent" ? invoices.sent : invoices.received;
  const filtered =
    filter === "all" ? list : list.filter((i) => i.status === filter);
  const filters = view === "sent" ? SENT_FILTERS : RECEIVED_FILTERS;

  const viewTitle = view === "received" ? "Bills to pay" : "Invoices you sent";
  const viewDescription =
    view === "received"
      ? "Invoices from vendors and clients — pay with your Arc balance or an external wallet."
      : "Track what you billed, share pay links, and see who has paid.";

  return (
    <>
      <EmailLinkBanner
        currentEmail={user?.email}
        onLinked={() => void refresh()}
      />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold">Invoices</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--color-muted)]">
            Bills you owe and invoices you sent.
          </p>
        </div>
        <Link href="/dashboard/invoices/new" className="btn-accent shrink-0">
          New invoice
        </Link>
      </div>

      <div className="mb-6">
        <InvoiceViewTabs
          view={view}
          onChange={handleViewChange}
          toPayCount={stats.toPayCount}
          toPayDue={stats.toPayDue}
          sentCount={stats.sentCount}
          sentOutstanding={stats.sentOutstanding}
        />
      </div>

      <div
        className={cn(
          "card mb-4 overflow-hidden border-l-4",
          view === "received" ? "border-l-orange-500" : "border-l-slate-700"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-slate-50/80 px-5 py-3">
          <div>
            <h2 className="font-serif text-lg font-bold">{viewTitle}</h2>
            <p className="text-xs text-[var(--color-muted)]">{viewDescription}</p>
          </div>
          <p className="text-sm text-[var(--color-muted)]">
            <span className="font-semibold text-[var(--color-ink)]">{filtered.length}</span>
            {filtered.length === 1 ? " invoice" : " invoices"}
            {filter !== "all" && (
              <span>
                {" "}
                · <span className="capitalize">{filter}</span>
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 px-5 py-3">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition",
                filter === f
                  ? view === "received"
                    ? "bg-orange-600 text-white"
                    : "bg-slate-800 text-white"
                  : "border border-[var(--color-border)] bg-white text-slate-500 hover:border-slate-300"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div
              className={cn(
                "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl",
                view === "received" ? "bg-orange-50 text-orange-600" : "bg-slate-100 text-slate-600"
              )}
            >
              {view === "received" ? (
                <span className="text-2xl" aria-hidden>
                  ↘
                </span>
              ) : (
                <span className="text-2xl" aria-hidden>
                  ↗
                </span>
              )}
            </div>
            <p className="font-serif text-lg font-bold">
              {view === "received" ? "Nothing to pay right now" : "No sent invoices yet"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-muted)]">
              {view === "received"
                ? filter === "all"
                  ? "When someone emails you an invoice and you sign in with that address, it appears here."
                  : `No ${filter} invoices in To pay. Try another filter or check Sent.`
                : filter === "all"
                  ? "Create an invoice to bill a client and share a pay link."
                  : `No ${filter} sent invoices.`}
            </p>
            {view === "sent" && (
              <Link href="/dashboard/invoices/new" className="btn-accent mt-4 inline-flex">
                New invoice
              </Link>
            )}
            {view === "received" && (
              <button
                type="button"
                className="btn-ghost mt-4 text-orange-600"
                onClick={() => handleViewChange("sent")}
              >
                View sent invoices →
              </button>
            )}
            {view === "sent" && (
              <button
                type="button"
                className="btn-ghost mt-4"
                onClick={() => handleViewChange("received")}
              >
                View bills to pay →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--color-border)] bg-white text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
                <tr>
                  <th className="px-6 py-3">Invoice</th>
                  <th className="px-6 py-3">{view === "sent" ? "Client" : "From"}</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Due</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const total = invoiceTotal(inv.items);
                  const actionable =
                    view === "received" &&
                    (inv.status === "pending" || inv.status === "overdue");
                  return (
                    <tr
                      key={inv.id}
                      className={cn(
                        "border-b border-[var(--color-border)] last:border-0 transition hover:bg-slate-50/80",
                        actionable && "bg-orange-50/30"
                      )}
                    >
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium">
                          {view === "sent" ? inv.recipientName : inv.creatorName ?? "—"}
                        </p>
                        {view === "sent" && inv.recipientEmail && (
                          <p className="text-xs text-[var(--color-muted)]">{inv.recipientEmail}</p>
                        )}
                        {inv.payUrl && view === "sent" && (
                          <p className="max-w-[220px] truncate text-xs text-orange-600">
                            {inv.payUrl}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold tabular-nums">
                        ${formatUSDC(total)}
                      </td>
                      <td className="px-6 py-4 text-[var(--color-muted)]">
                        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={getStatusBadgeClass(inv.status)}>{inv.status}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {actionable ? (
                          <button
                            type="button"
                            className="btn-accent px-4 py-2 text-xs"
                            onClick={() => setSelected(inv)}
                          >
                            Pay now
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="text-sm font-semibold text-orange-600 hover:underline"
                            onClick={() => setSelected(inv)}
                          >
                            View
                          </button>
                        )}
                        {view === "sent" && (
                          <button
                            type="button"
                            className="ml-3 text-sm text-slate-400 hover:text-red-600"
                            onClick={() => remove(inv.id)}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
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

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="spinner mx-auto mt-20" />}>
      <InvoicesContent />
    </Suspense>
  );
}
