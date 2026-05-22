export type InvoiceStatus = "draft" | "pending" | "paid" | "overdue" | "cancelled";

export interface InvoiceItemDto {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  createdAt: string;
  dueDate: string | null;
  creatorAddress: string;
  creatorName: string | null;
  recipientAddress: string;
  recipientName: string;
  recipientEmail: string | null;
  items: InvoiceItemDto[];
  notes: string | null;
  txHash: string | null;
  paidAt: string | null;
  publicToken: string;
  payUrl?: string;
}

export interface WalletDto {
  id: string;
  address: string;
  blockchain: string;
}
