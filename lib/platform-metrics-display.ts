import { formatUSDC } from "@/lib/utils";
import type { PlatformMetrics } from "@/lib/platform-metrics";

export function formatMetricCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString("en-US");
}

export function buildMetricCards(metrics: PlatformMetrics) {
  return [
    {
      value: formatMetricCount(metrics.users),
      label: "Accounts",
      hint: "Users who signed in and created a wallet",
    },
    {
      value: formatMetricCount(metrics.invoicesIssued),
      label: "Invoices issued",
      hint: "Sent or payable bills (excludes drafts)",
    },
    {
      value: formatMetricCount(metrics.paymentsCompleted),
      label: "Payments completed",
      hint: "Invoices marked paid on Solana",
    },
    {
      value: `$${formatUSDC(metrics.volumeUsdc)}`,
      label: "USDC settled",
      hint: "Total from paid invoice line items",
    },
  ] as const;
}
