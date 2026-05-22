"use client";

import { useState } from "react";
import Link from "next/link";
import type { SupportedChainId } from "@/app/lib/bridge.types";
import { useWallet } from "@/hooks/useWallet";
import TransferPanel from "@/components/payments/TransferPanel";
import DashboardPageShell from "@/components/layout/DashboardPageShell";
import TransferStats from "@/components/transfer/TransferStats";
import TransferAside from "@/components/transfer/TransferAside";

export default function TransferPage() {
  const { wallet, usdcBalance, balanceSyncing, pollBalanceAfterChange } = useWallet();
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedChainId>("Arc_Testnet");

  if (!wallet) return null;

  const balance = parseFloat(usdcBalance) || 0;

  const handleTransferComplete = () => {
    void pollBalanceAfterChange(balance, "down");
  };

  return (
    <DashboardPageShell size="full">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight lg:text-4xl">Transfer</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--color-muted)]">
            Send USDC to a wallet on Arc or another supported network. Review everything before you
            confirm.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/dashboard/deposit" className="btn-outline text-sm">
            Deposit
          </Link>
          <Link href="/dashboard/wallet" className="btn-ghost text-sm">
            Wallet
          </Link>
        </div>
      </header>

      <TransferStats balance={balance} syncing={balanceSyncing} />

      <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:gap-8">
        <section className="lg:col-span-8">
          <div className="card overflow-hidden shadow-sm">
            <div className="border-b border-[var(--color-border)] bg-slate-50/80 px-6 py-4">
              <h2 className="font-serif text-lg font-bold">Send USDC</h2>
              <p className="text-xs text-[var(--color-muted)]">Step-by-step — takes about a minute on Arc</p>
            </div>
            <div className="p-6 sm:p-8">
              <TransferPanel
                myWalletId={wallet.id}
                myArcAddress={wallet.address}
                usdcBalance={usdcBalance}
                onComplete={handleTransferComplete}
                onNetworkChange={setSelectedNetwork}
              />
            </div>
          </div>
        </section>

        <div className="lg:col-span-4">
          <TransferAside
            arcAddress={wallet.address}
            isArcNetwork={selectedNetwork === "Arc_Testnet"}
          />
        </div>
      </div>
    </DashboardPageShell>
  );
}
