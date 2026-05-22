import type { InvoiceStatus } from "@/lib/types";

export function getStatusBadgeClass(status: InvoiceStatus): string {
  switch (status) {
    case "paid":
      return "badge badge-paid";
    case "pending":
      return "badge badge-pending";
    case "overdue":
      return "badge badge-overdue";
    case "draft":
      return "badge badge-draft";
    default:
      return "badge badge-draft";
  }
}
