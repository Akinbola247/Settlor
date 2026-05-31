"use client";

import { useEffect } from "react";
import { useInvoices } from "@/hooks/useInvoices";
import { formatUSDC, invoiceTotal } from "@/lib/utils";
import { getStatusBadgeClass } from "@/lib/status";

export default function ActivityPage() {
  const { invoices, refresh } = useInvoices();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const all = [...invoices.sent, ...invoices.received].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Activity</h1>
        <p className="text-sm text-[var(--color-muted)]">Recent invoice and payment events</p>
      </div>

      <div className="card divide-y divide-[var(--color-border)]">
        {all.length === 0 ? (
          <p className="p-12 text-center text-sm text-[var(--color-muted)]">No activity yet.</p>
        ) : (
          all.map((inv) => {
            const isSent = invoices.sent.some((s) => s.id === inv.id);
            return (
              <div key={inv.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-medium">
                    {isSent ? `Invoice to ${inv.recipientName}` : `Invoice from ${inv.creatorName ?? "vendor"}`}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {inv.invoiceNumber} · {new Date(inv.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={getStatusBadgeClass(inv.status)}>{inv.status}</span>
                  <span className="font-semibold">${formatUSDC(invoiceTotal(inv.items))}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
