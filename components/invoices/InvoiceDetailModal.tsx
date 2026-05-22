"use client";

import type { InvoiceDto } from "@/lib/types";
import { formatUSDC, invoiceTotal } from "@/lib/utils";
import { getStatusBadgeClass } from "@/lib/status";
import BridgePayment from "@/components/payments/BridgePayment";
import PayLinkCopy from "@/components/ui/PayLinkCopy";
import { isInvoiceCreator, isInvoicePayee } from "@/lib/invoice-access";

type Props = {
  invoice: InvoiceDto;
  currentUserAddress: string;
  currentUserEmail?: string | null;
  payerWalletId?: string;
  payerArcBalance?: string;
  onPaid: (txSteps: { name: string; explorerUrl?: string }[]) => void;
  onClose: () => void;
};

export default function InvoiceDetailModal({
  invoice,
  currentUserAddress,
  currentUserEmail,
  payerWalletId,
  payerArcBalance = "0",
  onPaid,
  onClose,
}: Props) {
  const total = invoiceTotal(invoice.items);
  const user = { walletAddress: currentUserAddress, email: currentUserEmail };
  const isCreator = isInvoiceCreator(invoice, user);
  const isPayer = !isCreator && isInvoicePayee(invoice, user);
  const canPay = isPayer && (invoice.status === "pending" || invoice.status === "overdue");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="card relative my-8 w-full max-w-lg p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs text-[var(--color-muted)]">{invoice.invoiceNumber}</p>
            <h2 className="font-serif text-xl font-bold">
              {isPayer ? `From ${invoice.creatorName ?? "Vendor"}` : `To ${invoice.recipientName}`}
            </h2>
          </div>
          <span className={getStatusBadgeClass(invoice.status)}>{invoice.status}</span>
        </div>

        <div className="space-y-2 border-b border-[var(--color-border)] pb-4">
          {invoice.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>
                {item.description} × {item.quantity}
              </span>
              <span className="font-medium">${formatUSDC(item.quantity * item.unitPrice)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 font-serif text-lg font-bold">
            <span>Total</span>
            <span>${formatUSDC(total)} USDC</span>
          </div>
        </div>

        {invoice.payUrl && isCreator && invoice.status !== "paid" && (
          <div className="mt-4">
            <PayLinkCopy url={invoice.payUrl} />
          </div>
        )}

        {canPay && (
          <div className="mt-6 border-t border-[var(--color-border)] pt-6">
            <h3 className="mb-3 font-semibold">Pay invoice</h3>
            <BridgePayment
              recipientArcAddress={invoice.creatorAddress}
              amount={total.toFixed(2)}
              isLoggedIn={!!payerWalletId}
              payerWalletId={payerWalletId}
              arcBalance={payerArcBalance}
              buttonLabel={`Pay $${formatUSDC(total)} USDC`}
              onSuccess={async (steps) => {
                const txHash =
                  steps.find((s) => s.name === "arc_transfer")?.explorerUrl ??
                  steps.find((s) => s.name === "mint")?.explorerUrl ??
                  steps.find((s) => s.state === "success")?.explorerUrl ??
                  "";
                const res = await fetch("/api/invoices", {
                  method: "PATCH",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    id: invoice.id,
                    status: "paid",
                    paidAt: new Date().toISOString(),
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
                onPaid(steps);
              }}
            />
          </div>
        )}

        {invoice.status === "paid" && (
          <div className="mt-4 text-sm text-emerald-700">
            Paid {invoice.paidAt ? new Date(invoice.paidAt).toLocaleString() : ""}
            {invoice.txHash && (
              <a href={invoice.txHash} target="_blank" rel="noopener noreferrer" className="ml-2 text-orange-600">
                View tx →
              </a>
            )}
          </div>
        )}

        <button type="button" className="btn-outline mt-6 w-full" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
