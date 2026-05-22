"use client";

import { useState, useCallback } from "react";
import type { InvoiceDto } from "@/lib/types";

export interface InvoiceSet {
  sent: InvoiceDto[];
  received: InvoiceDto[];
}

export function useInvoices() {
  const [invoices, setInvoices] = useState<InvoiceSet>({ sent: [], received: [] });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/invoices", { credentials: "include" });
      if (res.ok) setInvoices(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(
    async (data: {
      recipientAddress?: string;
      recipientName: string;
      recipientEmail?: string;
      dueDate?: string;
      items: { description: string; quantity: number; unitPrice: number }[];
      notes?: string;
      status?: "draft" | "pending";
      creatorName?: string;
    }) => {
      const res = await fetch("/api/invoices", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? "Failed to create invoice");
      }
      const inv = await res.json();
      await refresh();
      return inv as InvoiceDto;
    },
    [refresh]
  );

  const markPaid = useCallback(
    async (id: string, txHash?: string) => {
      await fetch("/api/invoices", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: "paid",
          paidAt: new Date().toISOString(),
          txHash,
        }),
      });
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await fetch(`/api/invoices?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      await refresh();
    },
    [refresh]
  );

  return { invoices, loading, refresh, create, markPaid, remove };
}
