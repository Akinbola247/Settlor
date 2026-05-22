"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { WalletProvider, useWallet } from "@/contexts/WalletContext";
import { useInvoices } from "@/hooks/useInvoices";

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, wallet, loading } = useWallet();
  const { invoices } = useInvoices();

  const pendingCount = invoices.received.filter(
    (i) => i.status === "pending" || i.status === "overdue"
  ).length;

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user || !wallet) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto" />
          <p className="mt-4 text-sm text-[var(--color-muted)]">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      userName={user.displayName ?? "Account"}
      userEmail={user.email ?? wallet.address.slice(0, 10) + "…"}
      pendingCount={pendingCount}
    >
      {children}
    </AppShell>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </WalletProvider>
  );
}
