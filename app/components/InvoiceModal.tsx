/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { InvoiceItem, InvoiceStatus, formatUSDC } from "@/app/lib/useInvoices";

interface Props {
  walletAddress: string;
  walletName?: string;
  onSave: (data: {
    recipientAddress: string;
    recipientName: string;
    recipientEmail?: string;
    dueDate?: string;
    items: InvoiceItem[];
    notes?: string;
    status: InvoiceStatus;
    creatorName?: string;
  }) => Promise<void>;
  onClose: () => void;
}

const emptyItem = (): InvoiceItem => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  unitPrice: 0,
});

export default function InvoiceModal({ walletAddress, walletName, onSave, onClose }: Props) {
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientName,    setRecipientName]    = useState("");
  const [recipientEmail,   setRecipientEmail]   = useState("");
  const [dueDate,          setDueDate]          = useState("");
  const [notes,            setNotes]            = useState("");
  const [items,            setItems]            = useState<InvoiceItem[]>([emptyItem()]);
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState<string | null>(null);

  const addItem    = () => setItems([...items, emptyItem()]);
  const removeItem = (id: string) => setItems(items.filter(i => i.id !== id));
  const updateItem = (id: string, patch: Partial<InvoiceItem>) =>
    setItems(items.map(i => i.id === id ? { ...i, ...patch } : i));

  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const handleSave = async (status: InvoiceStatus) => {
    if (!recipientAddress || !recipientName || items.every(i => !i.description)) {
      setError("Please fill in recipient, name, and at least one item.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ recipientAddress, recipientName, recipientEmail, dueDate, items, notes, status, creatorName: walletName });
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl glass-card rounded-2xl p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">New Invoice</h2>
            <p className="text-slate-500 text-xs mt-0.5">USDC · The recipient pays using their own wallet on any chain</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          {/* Recipient info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Recipient Name *</label>
              <input className="field-input" placeholder="Acme Corp"
                value={recipientName} onChange={e => setRecipientName(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Recipient Email</label>
              <input className="field-input" type="email" placeholder="pay@acme.com"
                value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">
                Recipient Arc Address *
                <span className="ml-1 text-slate-600 normal-case">(their iPayX wallet)</span>
              </label>
              <input className="field-input font-mono text-xs" placeholder="0x..."
                value={recipientAddress} onChange={e => setRecipientAddress(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Due Date</label>
              <input className="field-input" type="date"
                value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="field-label mb-0">Line Items</label>
              <button onClick={addItem} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Add item
              </button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 px-1">
                <span className="col-span-6 text-xs text-slate-600 uppercase tracking-wider">Description</span>
                <span className="col-span-2 text-xs text-slate-600 uppercase tracking-wider text-right">Qty</span>
                <span className="col-span-3 text-xs text-slate-600 uppercase tracking-wider text-right">Unit $</span>
                <span className="col-span-1" />
              </div>
              {items.map(item => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                  <input className="field-input col-span-6 !py-2" placeholder="Service"
                    value={item.description} onChange={e => updateItem(item.id, { description: e.target.value })} />
                  <input className="field-input col-span-2 !py-2 text-right" type="number" min="1"
                    value={item.quantity} onChange={e => updateItem(item.id, { quantity: Number(e.target.value) })} />
                  <input className="field-input col-span-3 !py-2 text-right" type="number" min="0" step="0.01"
                    value={item.unitPrice} onChange={e => updateItem(item.id, { unitPrice: Number(e.target.value) })} />
                  <button onClick={() => removeItem(item.id)}
                    className="col-span-1 flex justify-center text-slate-600 hover:text-red-400">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4 pt-4 border-t border-white/5">
              <div className="text-right">
                <p className="text-xs text-slate-500 mb-1">Total</p>
                <p className="text-2xl font-bold text-white">${formatUSDC(total)} <span className="text-sm text-slate-400">USDC</span></p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="field-label">Notes (optional)</label>
            <textarea className="field-input resize-none" rows={2} placeholder="Payment terms, etc."
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* Your address — the payee */}
          <div className="bg-black/30 border border-white/5 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Payment will be sent to your Arc address</p>
            <code className="text-emerald-400 font-mono text-xs break-all">{walletAddress}</code>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button onClick={() => handleSave("draft")} disabled={saving}
              className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-all">
              Save Draft
            </button>
            <button onClick={() => handleSave("pending")} disabled={saving}
              className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-all">
              {saving ? "Saving…" : "Send Invoice"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}