"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { formatUSDC } from "@/lib/utils";
import DashboardPageShell from "@/components/layout/DashboardPageShell";

export default function WalletPage() {
  const router = useRouter();
  const { wallet, usdcBalance, user, refresh } = useWallet();
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!wallet) return null;

  const balance = parseFloat(usdcBalance) || 0;

  return (
    <DashboardPageShell size="default" centeredHeader>
      <header className="mb-8 text-center">
        <h1 className="font-serif text-3xl font-bold">Wallet</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Your USDC balance and address.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-8 text-center lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Balance
          </p>
          <p className="mt-2 font-serif text-5xl font-bold tracking-tight">${formatUSDC(balance)}</p>
          <p className="mt-1 text-sm text-slate-500">USDC</p>

          <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
            <Link href="/dashboard/deposit" className="btn-accent rounded-full">
              Deposit
            </Link>
            <Link href="/dashboard/transfer" className="btn-outline rounded-full">
              Transfer
            </Link>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 p-8 text-white shadow-xl">
          <p className="text-xs uppercase tracking-widest text-slate-400">Address</p>
          <code className="mt-4 block break-all text-center font-mono text-sm leading-relaxed lg:text-left">
            {wallet.address}
          </code>
          <div className="mt-6 flex justify-center lg:justify-start">
            <button
              type="button"
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
              onClick={() => {
                navigator.clipboard.writeText(wallet.address);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-6 text-center text-xs text-slate-400 lg:text-left">
            For deposits on Arc, see{" "}
            <Link href="/dashboard/deposit" className="text-orange-300 hover:underline">
              Deposit
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="card mt-6 p-6">
        <h2 className="font-serif text-lg font-bold">Details</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase text-[var(--color-muted)]">Account</dt>
            <dd className="mt-1">{user?.displayName ?? user?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[var(--color-muted)]">Network</dt>
            <dd className="mt-1">Arc Testnet</dd>
          </div>
        </dl>
        <button
          type="button"
          className="mt-4 text-xs font-semibold text-orange-600"
          onClick={() => void refresh()}
        >
          Refresh balance
        </button>
      </div>

      <div className="card mt-6 border-red-100 p-6">

        <div className="mt-6 border-t border-red-100 pt-6">
          <h3 className="text-sm font-semibold text-red-900">Delete iPayX account</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Removes your profile, sessions, and invoice links from iPayX. Your Circle wallet and
            any USDC on Arc Testnet remain on-chain. You can sign in again later, but that may
            create a new app profile.
          </p>
          {deleteError && (
            <p className="mt-2 text-xs text-red-600">{deleteError}</p>
          )}
          <button
            type="button"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
            disabled={deleting}
            onClick={async () => {
              const ok = window.confirm(
                "Delete your iPayX account on this app? This cannot be undone. Your Circle wallet and funds are not deleted from the blockchain."
              );
              if (!ok) return;
              setDeleting(true);
              setDeleteError(null);
              try {
                const res = await fetch("/api/auth/account", {
                  method: "DELETE",
                  credentials: "include",
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error ?? "Delete failed");
                router.replace("/login");
              } catch (e) {
                setDeleteError(e instanceof Error ? e.message : "Delete failed");
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? "Deleting…" : "Delete my iPayX account"}
          </button>
        </div>
      </div>
    </DashboardPageShell>
  );
}
