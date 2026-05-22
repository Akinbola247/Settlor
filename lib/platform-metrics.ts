import { prisma } from "@/lib/prisma";
import { invoiceTotal } from "@/lib/utils";

export type PlatformMetrics = {
  users: number;
  invoicesIssued: number;
  paymentsCompleted: number;
  pendingInvoices: number;
  volumeUsdc: number;
  updatedAt: string;
};

/** Landing-page display scale (actual DB counts × multiplier). */
const METRICS_DISPLAY_MULTIPLIER = 9;

function inflateCount(n: number): number {
  return Math.round(n * METRICS_DISPLAY_MULTIPLIER);
}

function inflateVolume(n: number): number {
  return Math.round(n * METRICS_DISPLAY_MULTIPLIER * 100) / 100;
}

export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  const [users, invoicesIssued, paymentsCompleted, pendingInvoices, paidInvoices] =
    await Promise.all([
      prisma.user.count(),
      prisma.invoice.count({
        where: { status: { notIn: ["draft", "cancelled"] } },
      }),
      prisma.invoice.count({ where: { status: "paid" } }),
      prisma.invoice.count({
        where: { status: { in: ["pending", "overdue"] } },
      }),
      prisma.invoice.findMany({
        where: { status: "paid" },
        select: {
          items: { select: { quantity: true, unitPrice: true } },
        },
      }),
    ]);

  const volumeUsdc = paidInvoices.reduce(
    (sum, inv) => sum + invoiceTotal(inv.items),
    0
  );

  return {
    users: inflateCount(users),
    invoicesIssued: inflateCount(invoicesIssued),
    paymentsCompleted: inflateCount(paymentsCompleted),
    pendingInvoices: inflateCount(pendingInvoices),
    volumeUsdc: inflateVolume(volumeUsdc),
    updatedAt: new Date().toISOString(),
  };
}
