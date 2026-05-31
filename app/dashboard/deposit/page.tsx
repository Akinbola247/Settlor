"use client";

import Link from "next/link";
import { useWallet } from "@/hooks/useWallet";
import DepositFromChainPanel from "@/components/payments/DepositFromChainPanel";
import DepositReceivePanel from "@/components/payments/DepositReceivePanel";
import DashboardPageShell from "@/components/layout/DashboardPageShell";
import TransferStats from "@/components/transfer/TransferStats";

export default function DepositPage() {
  const { wallet, usdcBalance, balanceSyncing, pollBalanceAfterChange } = useWallet();

  if (!wallet) return null;

  const balance = parseFloat(usdcBalance) || 0;

  const handleDepositComplete = () => {
    void pollBalanceAfterChange(balance, "up");
  };

  return (
    <DashboardPageShell size="full">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight lg:text-4xl">Deposit</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--color-muted)]">
            Bridge USDC from Arc, Ethereum, Base, and other networks into your Solana balance, or
            receive directly on Solana.
          </p>
        </div>
        <Link href="/dashboard/transfer" className="btn-outline text-sm shrink-0">
          Transfer
        </Link>
      </header>

      <TransferStats balance={balance} syncing={balanceSyncing} />

      <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:gap-8">
        <section className="card overflow-hidden shadow-sm" aria-labelledby="deposit-from-chain-title">
          <div className="border-b border-[var(--color-border)] bg-slate-50/80 px-6 py-4">
            <h2 id="deposit-from-chain-title" className="font-display text-lg font-bold">
              From another network
            </h2>
            <p className="text-xs text-[var(--color-muted)]">
              Arc, Ethereum, Base, Arbitrum, Avalanche — via MetaMask
            </p>
          </div>
          <div className="p-6 lg:p-8">
            <DepositFromChainPanel
              myWalletId={wallet.id}
              mySolanaAddress={wallet.address}
              onComplete={handleDepositComplete}
            />
          </div>
        </section>

        <section className="card overflow-hidden shadow-sm" aria-labelledby="deposit-solana-title">
          <div className="border-b border-[var(--color-border)] bg-slate-50/80 px-6 py-4">
            <h2 id="deposit-solana-title" className="font-display text-lg font-bold">
              Receive on Solana
            </h2>
            <p className="text-xs text-[var(--color-muted)]">Share your address with the sender</p>
          </div>
          <div className="p-6 lg:p-8">
            <DepositReceivePanel mySolanaAddress={wallet.address} />
          </div>
        </section>
      </div>
    </DashboardPageShell>
  );
}
