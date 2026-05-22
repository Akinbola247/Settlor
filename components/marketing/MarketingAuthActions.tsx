"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  /** Stack buttons vertically (mobile menu) */
  mobile?: boolean;
};

export default function MarketingAuthActions({ mobile = false }: Props) {
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

  if (loggedIn) {
    return (
      <div className={cn(wrap, mobile && "mt-4 border-t border-[var(--color-border)] pt-4")}>
        <Link
          href="/dashboard"
          className={cn("btn-primary", mobile && "w-full text-center")}
        >
          Return to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className={cn(wrap, mobile && "mt-4 border-t border-[var(--color-border)] pt-4")}>
      <Link href="/login" className={cn("btn-primary", mobile && "btn-accent w-full text-center")}>
        Get started
      </Link>
    </div>
  );
}
