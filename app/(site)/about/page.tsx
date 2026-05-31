import Link from "next/link";
import { ABOUT, SITE } from "@/lib/marketing-content";
import { ScrollReveal } from "@/components/marketing/ScrollReveal";

export const metadata = {
  title: `About — ${SITE.name}`,
  description: ABOUT.mission,
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
      <ScrollReveal immediate>
        <p className="text-sm font-bold uppercase tracking-widest text-brand">About us</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">Why we built Settlor</h1>
        <p className="mt-6 text-lg leading-relaxed text-[var(--color-muted)]">{ABOUT.mission}</p>
        <p className="mt-6 leading-relaxed text-[var(--color-muted)]">{ABOUT.story}</p>
      </ScrollReveal>

      <ScrollReveal delay={80}>
        <h2 className="mt-14 font-display text-2xl font-bold">What we believe</h2>
      </ScrollReveal>
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {ABOUT.values.map((v, i) => (
          <ScrollReveal key={v.title} delay={i * 90}>
            <div className="card p-6">
              <h3 className="font-semibold">{v.title}</h3>
              <p className="mt-2 text-sm text-[var(--color-muted)]">{v.body}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>

      <ScrollReveal delay={100}>
        <h2 className="mt-14 font-display text-2xl font-bold">Technology partners</h2>
        <p className="mt-4 text-sm leading-relaxed text-[var(--color-muted)]">
          Settlor is a proof-of-concept built on Circle programmable wallets, Solana settlement, and
          Cross-Chain Transfer Protocol (CCTP) for USDC. We follow UX patterns familiar from Base, Coinbase
          Wallet, and modern L2 onboarding — clarity first, jargon second.
        </p>
      </ScrollReveal>

      <ScrollReveal delay={120} className="mt-14 flex flex-wrap gap-4">
        <Link href="/login" className="btn-accent">
          Get started
        </Link>
        <Link href="/how-it-works" className="btn-outline">
          How it works
        </Link>
      </ScrollReveal>
    </article>
  );
}
