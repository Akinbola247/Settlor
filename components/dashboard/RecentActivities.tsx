"use client";

import type { InvoiceDto, InvoiceStatus } from "@/lib/types";
import { formatUSDC, invoiceTotal } from "@/lib/utils";
import { getStatusBadgeClass } from "@/lib/status";

type Activity = {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  direction: "in" | "out";
  date: string;
  status?: InvoiceStatus;
};

function buildActivities(sent: InvoiceDto[], received: InvoiceDto[]): Activity[] {
  const items: Activity[] = [];

  for (const inv of sent) {
    if (inv.status !== "paid" && inv.status !== "pending" && inv.status !== "overdue") continue;
    const amt = invoiceTotal(inv.items);
    items.push({
      id: `sent-${inv.id}`,
      title: inv.status === "paid" ? "Payment received" : "Invoice sent",
      subtitle: inv.recipientName || inv.invoiceNumber,
      amount: amt,
      direction: inv.status === "paid" ? "in" : "in",
      date: inv.paidAt ?? inv.createdAt,
      status: inv.status,
    });
  }

  for (const inv of received) {
    if (inv.status === "draft" || inv.status === "cancelled") continue;
    const amt = invoiceTotal(inv.items);
    items.push({
      id: `recv-${inv.id}`,
      title:
        inv.status === "paid"
          ? "Payment sent"
          : inv.status === "overdue"
            ? "Overdue bill"
            : "Bill to pay",
      subtitle: inv.creatorName ?? inv.invoiceNumber,
      amount: amt,
      direction: inv.status === "paid" ? "out" : "out",
      date: inv.paidAt ?? inv.createdAt,
      status: inv.status,
    });
  }

  return items
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

type Props = {
  sent: InvoiceDto[];
  received: InvoiceDto[];
  onSelect?: (invoice: InvoiceDto) => void;
};

export default function RecentActivities({ sent, received, onSelect }: Props) {
  const activities = buildActivities(sent, received);
  const invoiceById = new Map<string, InvoiceDto>();
  for (const i of sent) invoiceById.set(`sent-${i.id}`, i);
  for (const i of received) invoiceById.set(`recv-${i.id}`, i);

  return (
    <div className="card flex flex-col p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Recent activity</h2>
          <p className="text-xs text-[var(--color-muted)]">Invoices and payments</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <input
            type="search"
            placeholder="Search…"
            className="w-full rounded-xl border border-[var(--color-border)] bg-slate-50 px-3 py-2 text-xs outline-none focus:border-brand sm:w-36"
          />
          <button type="button" className="btn-outline px-3 py-2 text-xs sm:shrink-0">
            Filter
          </button>
        </div>
      </div>

      {activities.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-muted)]">
          No activity yet. Send an invoice or transfer USDC.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {activities.map((a) => {
            const inv = invoiceById.get(a.id);
            const isIn = a.title.includes("received") || (a.status === "paid" && a.id.startsWith("sent"));
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => inv && onSelect?.(inv)}
                  className="flex w-full items-center gap-4 py-4 text-left transition hover:bg-slate-50/80"
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${
                      isIn ? "bg-emerald-50" : "bg-brand-subtle"
                    }`}
                  >
                    {isIn ? "↓" : "↑"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{a.title}</p>
                    <p className="truncate text-xs text-[var(--color-muted)]">{a.subtitle}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`font-bold text-sm ${
                        isIn && a.status === "paid" ? "text-emerald-600" : "text-[var(--color-ink)]"
                      }`}
                    >
                      {isIn && a.status === "paid" ? "+" : a.status === "paid" ? "−" : ""}$
                      {formatUSDC(a.amount)}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">{timeAgo(a.date)}</p>
                    {a.status && (
                      <span className={`mt-1 ${getStatusBadgeClass(a.status)}`}>{a.status}</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
