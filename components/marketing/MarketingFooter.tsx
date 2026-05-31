import Link from "next/link";
import Logo from "./Logo";

const FOOTER_LINKS = {
  Product: [
    { href: "/#product", label: "Features" },
    { href: "/how-it-works", label: "How it works" },
    { href: "/#for-payers", label: "For payers" },
  ],
  Company: [
    { href: "/about", label: "About us" },
    { href: "/help", label: "Help & FAQ" },
  ],
  App: [
    { href: "/login", label: "Sign in" },
    { href: "/login", label: "Create account" },
  ],
};

export default function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo href="/" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--color-muted)]">
              Cross-chain USDC invoicing with unified settlement on Solana. Powered by Circle programmable
              wallets and CCTP.
            </p>
          </div>
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</p>
              <ul className="mt-4 space-y-2">
                {links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-[var(--color-muted)] transition hover:text-brand"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-[var(--color-border)] pt-8 text-xs text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Settlor. Testnet POC — not financial advice.</p>
          <p>Circle · Solana · CCTP</p>
        </div>
      </div>
    </footer>
  );
}
