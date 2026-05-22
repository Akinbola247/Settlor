import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUSDC(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function invoiceTotal(items: { quantity: number; unitPrice: number }[]): number {
  return items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
}
