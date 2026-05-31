"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@/hooks/useWallet";
import { useInvoices } from "@/hooks/useInvoices";
import InvoiceForm from "@/components/invoices/InvoiceForm";
import DashboardPageShell from "@/components/layout/DashboardPageShell";

export default function NewInvoicePage() {
  const router = useRouter();
  const { wallet } = useWallet();
  const { create } = useInvoices();

  if (!wallet) return null;

  return (
    <DashboardPageShell size="wide">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav className="mb-2 text-xs text-[var(--color-muted)]">
            <Link href="/dashboard/invoices" className="hover:text-brand">
              Invoices
            </Link>
            <span className="mx-2">/</span>
            <span className="text-[var(--color-ink)]">New</span>
          </nav>
          <h1 className="font-display text-3xl font-bold tracking-tight lg:text-4xl">New invoice</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--color-muted)]">
            Bill a client in USDC. Send now or save as a draft.
          </p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <InvoiceForm
            walletAddress={wallet.address}
            onSave={async (data) => {
              await create(data);
              router.push(
                data.status === "pending"
                  ? "/dashboard/invoices?view=sent"
                  : "/dashboard/invoices?view=sent&filter=draft"
              );
            }}
          />
        </div>

        <aside className="lg:col-span-4 space-y-4">
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
              Send invoice
            </p>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Client gets a pay link by email. They can pay from their wallet or sign in to pay from
              balance.
            </p>
          </div>
          <div className="rounded-2xl border border-brand bg-brand-subtle/80 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-strong">Draft</p>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Save without sending — finish and send later from Sent invoices.
            </p>
          </div>
        </aside>
      </div>
    </DashboardPageShell>
  );
}
