"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { InvoiceDto } from "@/lib/types";
import { invoiceTotal } from "@/lib/utils";

type Props = {
  invoices: InvoiceDto[];
};

export default function IncomeChart({ invoices }: Props) {
  const paid = invoices.filter((i) => i.status === "paid");
  const byMonth = new Map<string, number>();

  for (const inv of paid) {
    const d = inv.paidAt ? new Date(inv.paidAt) : new Date(inv.createdAt);
    const key = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
    byMonth.set(key, (byMonth.get(key) ?? 0) + invoiceTotal(inv.items));
  }

  const data = [...byMonth.entries()].map(([month, amount]) => ({ month, amount }));
  const total = paid.reduce((s, i) => s + invoiceTotal(i.items), 0);
  const hasData = data.length > 0;

  return (
    <div className="card p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold">Total income</h2>
          <p className="text-xs text-[var(--color-muted)]">Paid invoices over time</p>
        </div>
        <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-subtle0" />
              <span className="font-medium text-slate-600">Collected</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-900" />
              <span className="font-medium text-slate-600">Pending</span>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="font-display text-lg font-bold text-emerald-600 sm:text-xl">
              ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>
      {!hasData ? (
        <p className="py-12 text-center text-sm text-[var(--color-muted)]">
          No paid invoices yet — income chart appears after your first payment.
        </p>
      ) : (
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ea580c" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#ea580c" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              formatter={(value) => [
                `$${Number(value ?? 0).toFixed(2)}`,
                "Received",
              ]}
              contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#ea580c"
              strokeWidth={2}
              fill="url(#incomeGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      )}
    </div>
  );
}
