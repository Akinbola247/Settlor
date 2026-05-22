"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { isNavItemActive } from "@/lib/nav-active";
import { ACCOUNT_NAV, COMING_SOON_NAV, MAIN_NAV, QUICK_ACTIONS } from "./sidebar-nav";
import DashboardBreadcrumb from "./DashboardBreadcrumb";
import { IconLogout } from "./icons";

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

  const handleLogout = async () => {
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
      <aside className="sidebar flex w-[260px] shrink-0 flex-col border-r border-[var(--color-border)] bg-white">
        <Link
          href="/dashboard"
          className="flex h-16 items-center gap-2.5 border-b border-[var(--color-border)] px-5 transition hover:bg-slate-50"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-brand)] text-sm font-bold text-white">
            ₿
          </span>
          <span className="font-serif text-xl font-bold tracking-tight text-[var(--color-ink)]">
            iPayX
          </span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="sidebar-section-title">Main menu</p>
          <ul className="space-y-1">
            {MAIN_NAV.map((item) => {
              const Icon = item.icon;
              const badge =
                item.badgeKey === "pendingInvoices" && pendingCount > 0 ? pendingCount : null;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn("sidebar-link", navActive(item.href) && "sidebar-link-active")}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {badge != null && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                        {badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="sidebar-section-title mt-8">Quick actions</p>
          <ul className="space-y-1">
            {QUICK_ACTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn("sidebar-link", navActive(item.href) && "sidebar-link-active")}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="sidebar-section-title mt-8">Account</p>
          <ul className="space-y-1">
            {ACCOUNT_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn("sidebar-link", navActive(item.href) && "sidebar-link-active")}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="sidebar-section-title mt-8">Coming soon</p>
          <ul className="space-y-1">
            {COMING_SOON_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <span
                    title={item.hint}
                    className="sidebar-link-disabled flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400"
                  >
                    <Icon className="h-5 w-5 shrink-0 opacity-60" />
                    <span className="flex-1">{item.label}</span>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Soon
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-[var(--color-border)] p-3 space-y-1">
          <Link href="/help" className="sidebar-link w-full text-[var(--color-muted)]">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-xs font-bold">?</span>
            <span>Help</span>
          </Link>
          <Link href="/" className="sidebar-link w-full text-[var(--color-muted)]">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-xs">⌂</span>
            <span>Home</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="sidebar-link w-full text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <IconLogout className="w-5 h-5 shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[var(--color-border)] bg-white/95 px-6 backdrop-blur-md">
          <DashboardBreadcrumb />

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/dashboard/wallet"
              className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-white py-1.5 pl-1.5 pr-3 transition hover:border-orange-200"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 text-xs font-bold text-white">
                {initials}
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm font-semibold leading-tight">{userName ?? "Account"}</p>
                <p className="truncate text-xs text-[var(--color-muted)] max-w-[140px]">
                  {userEmail ?? "Arc Testnet"}
                </p>
              </div>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 lg:p-8">
          <div className="dashboard-main-inner min-h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function AppShell(props: Props) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="spinner" /></div>}>
      <AppShellInner {...props} />
    </Suspense>
  );
}
