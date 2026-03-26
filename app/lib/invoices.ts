// ─── Types ────────────────────────────────────────────────────────────────────
//lib.invoices.ts
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
  createdAt: string;          // ISO string
  dueDate: string;            // ISO string
  status: InvoiceStatus;
  clientName: string;
  clientEmail: string;
  clientAddress?: string;     // wallet address to pay to
  items: InvoiceItem[];
  notes?: string;
  // Populated after payment
  txHash?: string;
  paidAt?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const invoiceTotal = (invoice: Invoice): number =>
  invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

export const formatUSDC = (amount: number): string =>
  amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let _counter = 1;
export const nextInvoiceNumber = (): string => {
  if (typeof window !== "undefined") {
    const stored = parseInt(localStorage.getItem("ipayX_invoice_counter") ?? "0", 10);
    _counter = stored + 1;
    localStorage.setItem("ipayX_invoice_counter", String(_counter));
  }
  return `INV-${String(_counter).padStart(4, "0")}`;
};

// ─── Storage ─────────────────────────────────────────────────────────────────

const KEY = "ipayX_invoices";

export const loadInvoices = (): Invoice[] => {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
};

export const saveInvoices = (invoices: Invoice[]): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(invoices));
};

export const createInvoice = (data: Omit<Invoice, "id" | "createdAt" | "invoiceNumber">): Invoice => {
  const invoice: Invoice = {
    ...data,
    id: crypto.randomUUID(),
    invoiceNumber: nextInvoiceNumber(),
    createdAt: new Date().toISOString(),
  };
  const all = loadInvoices();
  saveInvoices([invoice, ...all]);
  return invoice;
};

export const updateInvoice = (id: string, patch: Partial<Invoice>): void => {
  const all = loadInvoices().map((inv) => (inv.id === id ? { ...inv, ...patch } : inv));
  saveInvoices(all);
};

export const deleteInvoice = (id: string): void => {
  saveInvoices(loadInvoices().filter((inv) => inv.id !== id));
};

export const getStatusColor = (status: InvoiceStatus) => {
  switch (status) {
    case "paid":    return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case "pending": return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    case "overdue": return "text-red-400 bg-red-400/10 border-red-400/20";
    default:        return "text-slate-400 bg-slate-400/10 border-slate-400/20";
  }
};