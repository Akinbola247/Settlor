"use client";
import { useState, useCallback } from "react";
import { Invoice, InvoiceItem, InvoiceStatus } from "@/app/lib/invoiceStore";

export type { Invoice, InvoiceItem, InvoiceStatus };

export interface InvoiceSet {
  sent: Invoice[];     // invoices I created (I'm the payee)
  received: Invoice[]; // invoices sent to me (I'm the payer)
}

export function useInvoices(walletAddress: string | undefined) {
  const [invoices, setInvoices] = useState<InvoiceSet>({ sent: [], received: [] });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices?address=${walletAddress}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
      }
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  const create = useCallback(async (data: {
    recipientAddress: string;
    recipientName: string;
    recipientEmail?: string;
    dueDate?: string;
    items: InvoiceItem[];
    notes?: string;
    status?: InvoiceStatus;
    creatorName?: string;
  }) => {
    if (!walletAddress) throw new Error("Not logged in");
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, creatorAddress: walletAddress }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error);
    }
    const inv: Invoice = await res.json();
    await refresh();
    return inv;
  }, [walletAddress, refresh]);

  const markPaid = useCallback(async (id: string, txHash?: string) => {
    await fetch("/api/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "paid", paidAt: new Date().toISOString(), txHash }),
    });
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await fetch(`/api/invoices?id=${id}`, { method: "DELETE" });
    await refresh();
  }, [refresh]);

  return { invoices, loading, refresh, create, markPaid, remove };
}

// ── Helpers (shared with components) ─────────────────────────────────────────

export function invoiceTotal(invoice: Invoice): number {
  return invoice.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
}

export function formatUSDC(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getStatusColor(status: InvoiceStatus): string {
  switch (status) {
    case "paid":    return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case "pending": return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    case "overdue": return "text-red-400 bg-red-400/10 border-red-400/20";
    default:        return "text-slate-400 bg-slate-400/10 border-slate-400/20";
  }
}