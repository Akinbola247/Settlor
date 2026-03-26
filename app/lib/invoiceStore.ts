/**
 * Server-side invoice store.
 * Uses a module-level Map so invoices persist across requests in a single process.
 * In production, replace with Postgres / Supabase / MongoDB.
 *
 * Invoices are keyed by ID, and indexed by:
 *  - creatorAddress   (the person who created = the payee)
 *  - recipientAddress (the person who should pay = the payer)
 */

export type InvoiceStatus = "draft" | "pending" | "paid" | "overdue";

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  dueDate: string;
  status: InvoiceStatus;

  // Creator = the freelancer / payee
  creatorAddress: string;   // Arc wallet address of invoice creator
  creatorName?: string;

  // Recipient = the client / payer
  recipientAddress: string; // Arc wallet address of the person who should pay
  recipientEmail?: string;
  recipientName: string;

  items: InvoiceItem[];
  notes?: string;

  // After payment
  txHash?: string;
  paidAt?: string;
}

// ─── In-memory store ─────────────────────────────────────────────────────────

const store = new Map<string, Invoice>();
let counter = 0;

const pad = (n: number) => String(n).padStart(4, "0");

export function createInvoice(data: Omit<Invoice, "id" | "invoiceNumber" | "createdAt">): Invoice {
  counter += 1;
  const invoice: Invoice = {
    ...data,
    id: crypto.randomUUID(),
    invoiceNumber: `INV-${pad(counter)}`,
    createdAt: new Date().toISOString(),
  };
  store.set(invoice.id, invoice);
  return invoice;
}

export function getInvoice(id: string): Invoice | undefined {
  return store.get(id);
}

export function updateInvoice(id: string, patch: Partial<Invoice>): Invoice | null {
  const existing = store.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  store.set(id, updated);
  return updated;
}

export function deleteInvoice(id: string): boolean {
  return store.delete(id);
}

/** Invoices where creatorAddress matches — invoices YOU sent */
export function getInvoicesByCreator(address: string): Invoice[] {
  return [...store.values()]
    .filter(inv => inv.creatorAddress.toLowerCase() === address.toLowerCase())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Invoices where recipientAddress matches — invoices sent TO YOU */
export function getInvoicesByRecipient(address: string): Invoice[] {
  return [...store.values()]
    .filter(inv => inv.recipientAddress.toLowerCase() === address.toLowerCase())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** All invoices relevant to a user (sent or received) */
export function getInvoicesForUser(address: string): {
  sent: Invoice[];
  received: Invoice[];
} {
  return {
    sent: getInvoicesByCreator(address),
    received: getInvoicesByRecipient(address),
  };
}

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