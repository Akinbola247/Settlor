import Link from "next/link";
import FaqAccordion from "@/components/marketing/FaqAccordion";
import { FAQ, SITE } from "@/lib/marketing-content";
import { ScrollReveal } from "@/components/marketing/ScrollReveal";

export const metadata = {
  title: `Help — ${SITE.name}`,
  description: "FAQ and navigation guide for Settlor dashboard.",
};

const NAV_GUIDE = [
  {
    title: "Overview",
    href: "/dashboard",
    body: "Your Solana USDC balance, recent activity, and shortcuts to create invoices or open payments.",
  },
  {
    title: "Activity",
    href: "/dashboard/activity",
    body: "Chronological log of invoices and payment events — useful for reconciliation.",
  },
  {
    title: "Invoices → To pay",
    href: "/dashboard/invoices",
    body: "Bills others sent you. Pay from Settlor balance (logged in) or use the pay link with MetaMask.",
  },
  {
    title: "Invoices → Sent",
    href: "/dashboard/invoices",
    body: "Invoices you issued. Copy pay links, check status, and resend emails.",
  },
  {
    title: "Deposit",
    href: "/dashboard/deposit",
    body: "From another network (external wallet) or share your address for USDC on Solana.",
  },
  {
    title: "Transfer",
    href: "/dashboard/transfer",
    body: "Send USDC on Solana or withdraw to EVM testnets via CCTP.",
  },
  {
    title: "Payments",
    href: "/dashboard/payments",
    body: "Summary of Solana balance, amounts owed, and paid invoice history.",
  },
  {
    title: "Solana wallet",
    href: "/dashboard/wallet",
    body: "Circle programmable wallet on Solana — balance, address copy, and receive instructions.",
  },
];

export default function HelpPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
      <ScrollReveal immediate>
        <p className="text-sm font-bold uppercase tracking-widest text-brand">Help</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">Help center</h1>
        <p className="mt-6 text-lg text-[var(--color-muted)]">
          New here? Start with How it works, then use this map to find every section in the dashboard.
        </p>
      </ScrollReveal>

      <ScrollReveal delay={60}>
        <h2 className="mt-14 font-display text-2xl font-bold">Dashboard map</h2>
      </ScrollReveal>
      <ul className="mt-8 space-y-4">
        {NAV_GUIDE.map((item, i) => (
          <li key={item.title}>
            <ScrollReveal delay={i * 50} className="card p-5">
              <Link href={item.href} className="font-semibold text-brand hover:underline">
                {item.title}
              </Link>
              <p className="mt-2 text-sm text-[var(--color-muted)]">{item.body}</p>
            </ScrollReveal>
          </li>
        ))}
      </ul>

      <ScrollReveal delay={80}>
        <h2 className="mt-14 font-display text-2xl font-bold">Frequently asked questions</h2>
        <div className="mt-8">
          <FaqAccordion items={FAQ} />
        </div>
      </ScrollReveal>

      <ScrollReveal delay={100}>
        <p className="mt-10 text-sm text-[var(--color-muted)]">
          Still stuck?{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>{" "}
          and check the email-match banner on Invoices if a bill isn&apos;t showing.
        </p>
      </ScrollReveal>
    </article>
  );
}
