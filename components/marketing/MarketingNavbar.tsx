"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/lib/marketing-content";
import Logo from "./Logo";
import MarketingAuthActions from "./MarketingAuthActions";
import { cn } from "@/lib/utils";

export default function MarketingNavbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navHref = (href: string) => {
    if (href.startsWith("/#") && !isHome) return `/${href.slice(1)}`;
    return href;
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "marketing-nav-scrolled border-b border-[var(--color-border)]" : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo href="/" />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={navHref(link.href)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                pathname === link.href || (link.href === "/#product" && isHome)
                  ? "text-[var(--color-ink)]"
                  : "text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-ink)]"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <MarketingAuthActions />

        <button
          type="button"
          className="icon-btn md:hidden"
          aria-expanded={mobileOpen}
          aria-label="Menu"
          onClick={() => setMobileOpen((o) => !o)}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-[var(--color-border)] bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={navHref(link.href)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--color-ink)] hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <MarketingAuthActions mobile />
        </div>
      )}
    </header>
  );
}
