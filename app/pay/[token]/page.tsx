"use client";

import { useEffect, useState } from "react";
import SettlorLogo from "@/components/brand/SettlorLogo";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { InvoiceDto } from "@/lib/types";
import { formatUSDC, invoiceTotal } from "@/lib/utils";
import { getStatusBadgeClass } from "@/lib/status";
import BridgePayment from "@/components/payments/BridgePayment";

export default function PublicPayPage() {
  const params = useParams();
  const token = params.token as string;
  const [invoice, setInvoice] = useState<InvoiceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [payerWalletId, setPayerWalletId] = useState<string | undefined>();
  const [payerSolanaAddress, setPayerSolanaAddress] = useState<string | undefined>();
  const [payerSolanaBalance, setPayerSolanaBalance] = useState("0");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/invoices/public?token=${token}`);
        if (!res.ok) throw new Error("Invoice not found");
        const data = await res.json();
        setInvoice(data);
        if (data.status === "paid") setPaid(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.wallet?.id) {
        setPayerWalletId(data.wallet.id);
        setPayerSolanaAddress(data.wallet.address);
        setPayerSolanaBalance(data.usdcBalance ?? "0");
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="text-red-600">{error ?? "Invoice not found"}</p>
        <Link href="/" className="link-brand font-semibold">
          Go to Settlor
        </Link>
      </div>
    );
  }

  const total = invoiceTotal(invoice.items);
  const canPay = !paid && (invoice.status === "pending" || invoice.status === "overdue");

  return (
    <div className="min-h-screen bg-[var(--color-surface)] py-12 px-4">
      <div className="mx-auto max-w-lg">
        <SettlorLogo href="/" size="sm" className="mb-8" />

        <div className="card p-8 shadow-lg ring-1 ring-[var(--color-brand)]/10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-[var(--color-muted)]">{invoice.invoiceNumber}</p>
              <h1 className="font-display text-2xl font-bold">
                Pay {invoice.creatorName ?? "invoice"}
              </h1>
            </div>
            <span className={getStatusBadgeClass(invoice.status)}>{invoice.status}</span>
          </div>

          <div className="mt-6 space-y-2 border-b border-[var(--color-border)] pb-6">
            {invoice.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.description} × {item.quantity}
                </span>
                <span>${formatUSDC(item.quantity * item.unitPrice)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 font-display text-xl font-bold">
              <span>Total due</span>
              <span>${formatUSDC(total)} USDC</span>
            </div>
          </div>

          {invoice.dueDate && (
            <p className="mt-4 text-sm text-[var(--color-muted)]">
              Due {new Date(invoice.dueDate).toLocaleDateString()}
            </p>
          )}

          {paid && (
            <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-emerald-800 text-sm font-medium">
              This invoice has been paid. Thank you!
            </div>
          )}

          {canPay && (
            <div className="mt-8">
              <BridgePayment
                recipientSolanaAddress={invoice.creatorAddress}
                amount={total.toFixed(2)}
                isLoggedIn={!!payerWalletId}
                payerWalletId={payerWalletId}
                payerSolanaAddress={payerSolanaAddress}
                solanaBalance={payerSolanaBalance}
                buttonLabel={`Pay $${formatUSDC(total)} USDC now`}
                onSuccess={async (steps) => {
                  const txHash =
                    steps.find((s) => s.name === "sol_transfer")?.explorerUrl ??
                    steps.find((s) => s.name === "arc_transfer")?.explorerUrl ??
                    steps.find((s) => s.name === "mint")?.explorerUrl ??
                    steps.find((s) => s.state === "success")?.explorerUrl ??
                    "";
                  const res = await fetch("/api/invoices/public", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      token,
                      txHash,
                      bridgeSteps: steps.map((s) => ({
                        name: s.name,
                        state: s.state,
                        explorerUrl: s.explorerUrl,
                      })),
                    }),
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error ?? "Could not confirm payment");
                  }
                  const updated = await res.json();
                  setPaid(true);
                  setInvoice(updated);
                }}
              />
              <p className="mt-4 text-center text-xs text-[var(--color-muted)]">
                {payerWalletId ? (
                  <>Paying as your Settlor account, or use an external wallet.</>
                ) : (
                  <>
                    Have an account?{" "}
                    <Link href="/login" className="font-semibold text-brand">
                      Sign in
                    </Link>{" "}
                    to pay from your Settlor balance.
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
