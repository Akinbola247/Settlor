"use client";

import { useState } from "react";
import Link from "next/link";
import { formatUSDC, invoiceTotal } from "@/lib/utils";
import { shortenAddress } from "@/lib/transfer-utils";

type Item = { id: string; description: string; quantity: number; unitPrice: number };

const emptyItem = (): Item => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  unitPrice: 0,
});

export type InvoiceFormPayload = {
  recipientAddress?: string;
  recipientName: string;
  recipientEmail?: string;
  dueDate?: string;
  items: { description: string; quantity: number; unitPrice: number }[];
  notes?: string;
  status: "draft" | "pending";
};

type Props = {
  walletAddress: string;
  onSave: (data: InvoiceFormPayload) => Promise<void>;
  cancelHref?: string;
};

export default function InvoiceForm({
  walletAddress,
  onSave,
  cancelHref = "/dashboard/invoices",
}: Props) {
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = invoiceTotal(items);

  const handleSave = async (status: "draft" | "pending") => {
    if (!recipientName || items.every((i) => !i.description)) {
      setError("Add client name and at least one line item.");
      return;
    }
    if (status === "pending" && !recipientAddress && !recipientEmail) {
      setError("To send, add client email or wallet address.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        recipientAddress: recipientAddress || undefined,
        recipientName,
        recipientEmail: recipientEmail || undefined,
        dueDate: dueDate || undefined,
        items: items.map(({ description, quantity, unitPrice }) => ({
          description,
          quantity,
          unitPrice,
        })),
        notes: notes || undefined,
        status,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="card p-6 sm:p-8">
        <h2 className="font-serif text-lg font-bold">Client</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">Who you are billing</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="inv-name">
              Name *
            </label>
            <input
              id="inv-name"
              className="field-input"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Acme Corp"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="inv-email">
              Email
            </label>
            <input
              id="inv-email"
              className="field-input"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="pay@acme.com"
            />
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              They can pay via link; matching email shows the bill in their account.
            </p>
          </div>
          <div>
            <label className="field-label" htmlFor="inv-due">
              Due date
            </label>
            <input
              id="inv-due"
              className="field-input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="inv-addr">
              Wallet address
            </label>
            <input
              id="inv-addr"
              className="field-input font-mono text-sm"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="0x… (optional if email is set)"
            />
          </div>
        </div>
      </section>

      <section className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-bold">Line items</h2>
            <p className="text-xs text-[var(--color-muted)]">Amounts in USDC</p>
          </div>
          <button
            type="button"
            className="text-sm font-semibold text-orange-600 hover:underline"
            onClick={() => setItems([...items, emptyItem()])}
          >
            + Add line
          </button>
        </div>
        <div className="mt-6 space-y-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="grid grid-cols-12 gap-2 rounded-xl border border-[var(--color-border)] bg-slate-50/50 p-3"
            >
              <div className="col-span-12 flex items-center justify-between sm:col-span-12">
                <span className="text-xs font-bold text-slate-400">Item {index + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-red-600"
                    onClick={() => setItems(items.filter((i) => i.id !== item.id))}
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                className="field-input col-span-12 sm:col-span-6"
                placeholder="Description"
                value={item.description}
                onChange={(e) =>
                  setItems(items.map((i) => (i.id === item.id ? { ...i, description: e.target.value } : i)))
                }
              />
              <input
                className="field-input col-span-4 sm:col-span-2"
                type="number"
                min={1}
                placeholder="Qty"
                value={item.quantity}
                onChange={(e) =>
                  setItems(items.map((i) => (i.id === item.id ? { ...i, quantity: Number(e.target.value) } : i)))
                }
              />
              <input
                className="field-input col-span-8 sm:col-span-3"
                type="number"
                min={0}
                step="0.01"
                placeholder="Price"
                value={item.unitPrice || ""}
                onChange={(e) =>
                  setItems(items.map((i) => (i.id === item.id ? { ...i, unitPrice: Number(e.target.value) } : i)))
                }
              />
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-end justify-between border-t border-[var(--color-border)] pt-6">
          <span className="text-sm font-medium text-[var(--color-muted)]">Total</span>
          <p className="font-serif text-3xl font-bold">
            ${formatUSDC(total)} <span className="text-base font-sans text-slate-500">USDC</span>
          </p>
        </div>
      </section>

      <section className="card p-6 sm:p-8">
        <label className="field-label" htmlFor="inv-notes">
          Notes
        </label>
        <textarea
          id="inv-notes"
          className="field-input mt-1.5 resize-none"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Payment terms, thank-you message…"
        />
        <p className="mt-4 text-xs text-[var(--color-muted)]">
          Payments credit your wallet · <span className="font-mono">{shortenAddress(walletAddress, 8, 6)}</span>
        </p>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href={cancelHref} className="btn-ghost text-center sm:text-left">
          Cancel
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="btn-outline flex-1 sm:flex-none sm:min-w-[140px]"
            disabled={saving}
            onClick={() => void handleSave("draft")}
          >
            Save draft
          </button>
          <button
            type="button"
            className="btn-accent flex-1 sm:flex-none sm:min-w-[160px]"
            disabled={saving}
            onClick={() => void handleSave("pending")}
          >
            {saving ? "Sending…" : "Send invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}
