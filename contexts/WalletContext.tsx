"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { WalletDto } from "@/lib/types";

type WalletUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  walletAddress: string;
};

type WalletContextValue = {
  user: WalletUser | null;
  wallet: WalletDto | null;
  usdcBalance: string;
  loading: boolean;
  balanceSyncing: boolean;
  refresh: (opts?: { silent?: boolean }) => Promise<boolean>;
  /** Poll until balance moves past baseline (on-chain settlement can take ~30s). */
  pollBalanceAfterChange: (
    baseline: number,
    direction?: "up" | "down"
  ) => Promise<boolean>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

const POLL_INTERVALS_MS = [1500, 2000, 2500, 3000, 4000, 5000, 5000, 6000];

async function fetchMe(): Promise<{
  user: WalletUser;
  wallet: WalletDto;
  usdcBalance: string;
} | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.wallet) return null;
  return {
    user: data.user,
    wallet: data.wallet,
    usdcBalance: data.usdcBalance ?? "0",
  };
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<WalletUser | null>(null);
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [loading, setLoading] = useState(true);
  const [balanceSyncing, setBalanceSyncing] = useState(false);

  const applyPayload = useCallback((data: NonNullable<Awaited<ReturnType<typeof fetchMe>>>) => {
    setUser(data.user);
    setWallet(data.wallet);
    setUsdcBalance(data.usdcBalance);
    return parseFloat(data.usdcBalance) || 0;
  }, []);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const data = await fetchMe();
      if (!data) {
        setUser(null);
        setWallet(null);
        setUsdcBalance("0");
        return false;
      }
      applyPayload(data);
      return true;
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [applyPayload]);

  const pollBalanceAfterChange = useCallback(
    async (baseline: number, direction: "up" | "down" = "up") => {
      setBalanceSyncing(true);
      const epsilon = 0.000_001;
      try {
        for (const ms of POLL_INTERVALS_MS) {
          await new Promise((r) => setTimeout(r, ms));
          const data = await fetchMe();
          if (!data) continue;
          const next = applyPayload(data);
          if (direction === "up" && next > baseline + epsilon) return true;
          if (direction === "down" && next < baseline - epsilon) return true;
        }
        await refresh({ silent: true });
        return false;
      } finally {
        setBalanceSyncing(false);
      }
    },
    [applyPayload, refresh]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      user,
      wallet,
      usdcBalance,
      loading,
      balanceSyncing,
      refresh,
      pollBalanceAfterChange,
    }),
    [user, wallet, usdcBalance, loading, balanceSyncing, refresh, pollBalanceAfterChange]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return ctx;
}
