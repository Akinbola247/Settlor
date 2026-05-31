"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import SettlorLogo from "@/components/brand/SettlorLogo";
import {
  ACCOUNT_NAV,
  COMING_SOON_NAV,
  MAIN_NAV,
  QUICK_ACTIONS,
} from "./sidebar-nav";
import { IconClose, IconLogout } from "./icons";

type Props = {
  navActive: (href: string) => boolean;
  pendingCount: number;
  onNavigate?: () => void;
  onLogout: () => void;
  className?: string;
  showClose?: boolean;
  onClose?: () => void;
};

export default function DashboardSidebar({
  navActive,
  pendingCount,
  onNavigate,
  onLogout,
  className,
  showClose,
  onClose,
}: Props) {
  const linkProps = { onClick: onNavigate };

  return (
    <aside
      className={cn(
        "sidebar flex h-full w-[min(280px,88vw)] shrink-0 flex-col border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar)] sm:w-[260px]",
        className
      )}
    >
      <div className="relative flex h-16 shrink-0 items-center border-b border-[var(--color-sidebar-border)]">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex h-16 flex-1 items-center px-5 transition hover:bg-white/5"
        >
          <SettlorLogo href={null} size="md" variant="light" />
        </Link>
        {showClose && onClose && (
          <button
            type="button"
            className="icon-btn absolute right-3 top-1/2 -translate-y-1/2 border-white/10 bg-white/5 text-white hover:bg-white/10 lg:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <IconClose className="h-5 w-5" />
          </button>
        )}
      </div>

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
                  {...linkProps}
                  className={cn("sidebar-link", navActive(item.href) && "sidebar-link-active")}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {badge != null && (
                    <span className="rounded-full bg-[var(--color-brand)]/20 px-2 py-0.5 text-xs font-bold text-[var(--color-brand-light)]">
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
                  {...linkProps}
                  className={cn("sidebar-link", navActive(item.href) && "sidebar-link-active")}
                >
                  <Icon className="h-5 w-5 shrink-0" />
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
                  {...linkProps}
                  className={cn("sidebar-link", navActive(item.href) && "sidebar-link-active")}
                >
                  <Icon className="h-5 w-5 shrink-0" />
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
                  className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--color-sidebar-text)] opacity-50"
                >
                  <Icon className="h-5 w-5 shrink-0 opacity-60" />
                  <span className="flex-1">{item.label}</span>
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                    Soon
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-1 border-t border-[var(--color-sidebar-border)] p-3">
        <Link
          href="/help"
          {...linkProps}
          className="sidebar-link w-full"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-xs font-bold">?</span>
          <span>Help</span>
        </Link>
        <Link href="/" {...linkProps} className="sidebar-link w-full">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-xs">⌂</span>
          <span>Home</span>
        </Link>
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            onLogout();
          }}
          className="sidebar-link w-full text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <IconLogout className="h-5 w-5 shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
