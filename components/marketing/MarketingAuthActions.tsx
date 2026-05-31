"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  mobile?: boolean;
  onDark?: boolean;
};

export default function MarketingAuthActions({ mobile = false, onDark = false }: Props) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    void fetch("/api/auth/me", { credentials: "include" }).then((res) => {
      setLoggedIn(res.ok);
    });
  }, []);

  const wrap = mobile ? "flex flex-col gap-2" : "hidden items-center gap-2 sm:flex";

  if (loggedIn === null) {
    return <div className={cn(wrap, mobile && "mt-4")} aria-hidden />;
  }

  const ctaBase = mobile ? "w-full text-center" : "";

  if (loggedIn) {
    return (
      <div className={cn(wrap, mobile && "mt-4 border-t border-[var(--color-border)] pt-4")}>
        <Link
          href="/dashboard"
          className={cn(
            ctaBase,
            onDark && !mobile
              ? "inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
              : "btn-primary"
          )}
        >
          Return to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className={cn(wrap, mobile && "mt-4 border-t border-[var(--color-border)] pt-4")}>
      <Link
        href="/login"
        className={cn(
          onDark && !mobile ? "btn-accent" : "btn-primary",
          ctaBase,
          mobile && "btn-accent"
        )}
      >
        Get started
      </Link>
    </div>
  );
}
