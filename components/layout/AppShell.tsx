"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { isNavItemActive } from "@/lib/nav-active";
import DashboardBreadcrumb from "./DashboardBreadcrumb";
import DashboardSidebar from "./DashboardSidebar";
import { IconMenu } from "./icons";

type Props = {
  children: React.ReactNode;
  userName?: string | null;
  userEmail?: string | null;
  pendingCount?: number;
};

function AppShellInner({
  children,
  userName,
  userEmail,
  pendingCount = 0,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  useEffect(() => {
    closeMobileNav();
  }, [pathname, searchParams, closeMobileNav]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  const handleLogout = async () => {
    closeMobileNav();
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
  };

  const initials = (userName ?? "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const navActive = (href: string) => isNavItemActive(pathname, searchParams, href);

  return (
    <div className="flex min-h-screen bg-[var(--color-surface)]">
      {/* Desktop sidebar */}
      <div className="hidden shrink-0 lg:block">
        <DashboardSidebar
          navActive={navActive}
          pendingCount={pendingCount}
          onLogout={handleLogout}
          className="sticky top-0 h-screen"
        />
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
          aria-label="Close menu"
          onClick={closeMobileNav}
        />
      )}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out lg:hidden",
          mobileNavOpen ? "translate-x-0" : "pointer-events-none -translate-x-full"
        )}
        aria-hidden={!mobileNavOpen}
      >
        <DashboardSidebar
          navActive={navActive}
          pendingCount={pendingCount}
          onNavigate={closeMobileNav}
          onLogout={handleLogout}
          showClose
          onClose={closeMobileNav}
          className="h-full shadow-xl"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-[var(--color-border)] bg-white/95 px-3 backdrop-blur-md sm:h-16 sm:gap-4 sm:px-4 lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="icon-btn shrink-0 lg:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileNavOpen}
            >
              <IconMenu className="h-5 w-5" />
            </button>
            <DashboardBreadcrumb />
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <Link
              href="/dashboard/wallet"
              className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white py-1.5 pl-1.5 pr-2 transition hover:border-brand sm:gap-3 sm:pr-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand text-xs font-bold text-[var(--color-ink)] sm:h-9 sm:w-9">
                {initials}
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm font-semibold leading-tight">{userName ?? "Account"}</p>
                <p className="max-w-[140px] truncate text-xs text-[var(--color-muted)]">
                  {userEmail ?? "Solana"}
                </p>
              </div>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="dashboard-main-inner min-h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function AppShell(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="spinner" />
        </div>
      }
    >
      <AppShellInner {...props} />
    </Suspense>
  );
}
