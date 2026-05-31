"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/lib/marketing-content";
import SettlorLogo from "@/components/brand/SettlorLogo";
import MarketingAuthActions from "./MarketingAuthActions";
import { cn } from "@/lib/utils";

export default function MarketingNavbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isHome = pathname === "/";
  const onDarkHero = isHome && !scrolled;

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

  const isNavLinkActive = (href: string) =>
    pathname === href || (href === "/#product" && isHome);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow] duration-300",
        onDarkHero
          ? "border-b border-white/10 bg-transparent"
          : "marketing-nav-scrolled"
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <SettlorLogo href="/" variant={onDarkHero ? "light" : "default"} />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={navHref(link.href)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                onDarkHero
                  ? isNavLinkActive(link.href)
                    ? "text-white"
                    : "text-white/85 hover:bg-white/10 hover:text-white"
                  : isNavLinkActive(link.href)
                    ? "text-[var(--color-ink)]"
                    : "text-[var(--color-muted)] hover:bg-[var(--color-brand-subtle)] hover:text-[var(--color-ink)]"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <MarketingAuthActions onDark={onDarkHero} />

        <button
          type="button"
          className={cn("icon-btn md:hidden", onDarkHero && "border-white/20 bg-white/10 text-white hover:bg-white/15")}
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
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-brand-subtle)]"
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
