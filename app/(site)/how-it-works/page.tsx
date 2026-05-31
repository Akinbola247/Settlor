import Link from "next/link";
import { HOW_IT_WORKS_STEPS, PRODUCT_FEATURES, SITE } from "@/lib/marketing-content";
import { ScrollReveal } from "@/components/marketing/ScrollReveal";

export const metadata = {
  title: `How it works — ${SITE.name}`,
  description: "Sign in, invoice, collect cross-chain USDC, settle on Solana.",
};

export default function HowItWorksPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-24">
      <ScrollReveal immediate>
        <p className="text-sm font-bold uppercase tracking-widest text-brand">How it works</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">From invoice to Solana balance</h1>
        <p className="mt-6 max-w-2xl text-lg text-[var(--color-muted)]">
          This guide walks through the full flow for vendors and payers. Bookmark it if you&apos;re onboarding
          a client for the first time.
        </p>
      </ScrollReveal>

      <ol className="mt-14 space-y-10">
        {HOW_IT_WORKS_STEPS.map((s, i) => (
          <li
            key={s.step}
            className="border-b border-[var(--color-border)] pb-10 last:border-0"
          >
            <ScrollReveal delay={i * 70} className="flex gap-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-muted font-display text-lg font-bold text-brand-strong">
                {s.step}
              </span>
              <div>
                <h2 className="font-display text-2xl font-bold">{s.title}</h2>
                <p className="mt-3 leading-relaxed text-[var(--color-muted)]">{s.body}</p>
              </div>
            </ScrollReveal>
          </li>
        ))}
      </ol>

      <section className="mt-16">
        <ScrollReveal>
          <h2 className="font-display text-2xl font-bold">Feature deep dive</h2>
        </ScrollReveal>
        <div className="mt-8 space-y-6">
          {PRODUCT_FEATURES.slice(0, 4).map((f, i) => (
            <ScrollReveal key={f.title} delay={i * 80}>
              <div className="card p-6">
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{f.description}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <ScrollReveal delay={100}>
        <section className="mt-16 rounded-2xl border border-brand bg-brand-subtle p-6">
          <h3 className="font-semibold text-[var(--color-ink)]">Payer tip: receive on Solana only</h3>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Settlor settles on Solana. Share your Solana Devnet address from Payments → Receive for native
            USDC. Cross-chain payers can use MetaMask on an EVM testnet and CCTP will mint to the vendor.
          </p>
        </section>
      </ScrollReveal>

      <ScrollReveal delay={120} className="mt-14 flex flex-wrap gap-4">
        <Link href="/login" className="btn-accent">
          Create your account
        </Link>
        <Link href="/help" className="btn-outline">
          Help & FAQ
        </Link>
      </ScrollReveal>
    </article>
  );
}
