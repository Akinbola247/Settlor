import Link from "next/link";
import {
  CHAINS,
  FAQ,
  HERO,
  HOW_IT_WORKS_STEPS,
  PRODUCT_FEATURES,
  STATS,
  TRUST_PARTNERS,
  USER_PATHS,
} from "@/lib/marketing-content";
import type { PlatformMetrics } from "@/lib/platform-metrics";
import FaqAccordion from "./FaqAccordion";
import PlatformMetricsSection from "./PlatformMetricsSection";
import { ScrollReveal } from "./ScrollReveal";

type Props = {
  metrics: PlatformMetrics;
};

export default function LandingPage({ metrics }: Props) {
  return (
    <>
      {/* Hero — extend under fixed nav so transparent bar sits on gradient, not page bg */}
      <section className="relative -mt-16 overflow-hidden gradient-hero pt-16 text-white">
        <div className="pointer-events-none absolute inset-0 mesh-grid opacity-60" />
        <ScrollReveal immediate className="relative mx-auto max-w-6xl px-4 pb-24 pt-20 sm:px-6 lg:pb-32 lg:pt-28">
          <p className="text-sm font-semibold text-[var(--color-brand-light)]">{HERO.eyebrow}</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            {HERO.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">{HERO.subtitle}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/login" className="btn-accent px-8 py-4 text-base">
              {HERO.ctaPrimary}
            </Link>
            <Link href="/how-it-works" className="btn-outline border-slate-600 bg-transparent px-8 py-4 text-base text-white hover:bg-white/10">
              {HERO.ctaSecondary}
            </Link>
          </div>
          <div className="mt-16 flex flex-wrap gap-6 border-t border-white/10 pt-10">
            {TRUST_PARTNERS.map((p) => (
              <div key={p.name} className="min-w-[120px]">
                <p className="text-sm font-bold">{p.name}</p>
                <p className="text-xs text-slate-400">{p.detail}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </section>

      {/* Stats */}
      <section className="border-b border-[var(--color-border)] bg-white py-12">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-3 sm:px-6">
          {STATS.map((s, i) => (
            <ScrollReveal key={s.label} delay={i * 80} className="text-center sm:text-left">
              <p className="font-display text-4xl font-bold text-[var(--color-brand)]">{s.value}</p>
              <p className="mt-1 font-semibold">{s.label}</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{s.hint}</p>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Problem */}
      <section className="section-anchor py-20 lg:py-24">
        <ScrollReveal className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-brand">Why Settlor</p>
              <h2 className="mt-3 font-display text-3xl font-bold lg:text-4xl">
                Stop chasing hashes across five wallets.
              </h2>
              <p className="mt-4 text-[var(--color-muted)] leading-relaxed">
                Traditional invoicing tools don&apos;t speak crypto. Raw wallet transfers don&apos;t scale for
                teams. Settlor sits in the middle: professional invoices for you, guided payment for your
                clients, and one Solana balance when money arrives.
              </p>
            </div>
            <div className="card p-8 lg:p-10">
              <ul className="space-y-4 text-sm">
                {[
                  "Issue invoice #1042 — client pays from Base Sepolia",
                  "CCTP routes USDC to your Solana wallet",
                  "Invoice flips to paid; balance and activity update",
                  "Transfer out when you need funds elsewhere",
                ].map((line, i) => (
                  <li key={line} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-muted text-xs font-bold text-brand-strong">
                      {i + 1}
                    </span>
                    <span className="pt-0.5 text-[var(--color-ink)]">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* Product */}
      <section id="product" className="section-anchor border-t border-[var(--color-border)] bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-widest text-brand">Product</p>
            <h2 className="mt-3 font-display text-3xl font-bold lg:text-4xl">Everything in one workspace</h2>
            <p className="mt-4 text-[var(--color-muted)]">
              From first invoice to Solana settlement — designed so vendors and payers each know their next step.
            </p>
          </ScrollReveal>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PRODUCT_FEATURES.map((f, i) => (
              <ScrollReveal key={f.title} delay={i * 70}>
              <article className="card flex flex-col p-7">
                <h3 className="font-display text-xl font-bold">{f.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--color-muted)]">{f.description}</p>
                <ul className="mt-4 space-y-1.5 border-t border-[var(--color-border)] pt-4">
                  {f.points.map((p) => (
                    <li key={p} className="flex gap-2 text-xs text-[var(--color-ink)]">
                      <span className="text-brand">✓</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works preview */}
      <section id="how-it-works" className="section-anchor py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <p className="text-sm font-bold uppercase tracking-widest text-brand">How it works</p>
              <h2 className="mt-3 font-display text-3xl font-bold">Four steps from sign-in to paid</h2>
            </div>
            <Link href="/how-it-works" className="btn-outline shrink-0">
              Full walkthrough →
            </Link>
          </ScrollReveal>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS_STEPS.map((s, i) => (
              <ScrollReveal key={s.step} delay={i * 90}>
              <div className="card p-6">
                <span className="text-xs font-bold text-brand">{s.step}</span>
                <h3 className="mt-2 font-display text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{s.body}</p>
              </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* For vendors / payers */}
      <section id="for-payers" className="section-anchor border-t border-[var(--color-border)] bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal>
          <h2 className="font-display text-3xl font-bold text-center lg:text-4xl">Built for both sides of the invoice</h2>
          </ScrollReveal>
          <div className="mt-14 grid gap-8 md:grid-cols-2">
            {[USER_PATHS.vendors, USER_PATHS.payers].map((block, i) => (
              <ScrollReveal key={block.title} delay={i * 100}>
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
                <h3 className="font-display text-xl font-bold">{block.title}</h3>
                <ul className="mt-6 space-y-3">
                  {block.items.map((item) => (
                    <li key={item} className="flex gap-3 text-sm text-[var(--color-muted)]">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-subtle0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* New user journey */}
      <section id="getting-started" className="section-anchor py-20 lg:py-28">
        <ScrollReveal className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm font-bold uppercase tracking-widest text-brand">Getting started</p>
          <h2 className="mt-3 font-display text-3xl font-bold">Never get lost in the app</h2>
          <p className="mt-4 max-w-2xl text-[var(--color-muted)]">
            The dashboard sidebar groups everything by purpose. Need help? Visit Help from the footer or
            sidebar anytime.
          </p>
          <div className="mt-10 overflow-x-auto">
            <div className="flex min-w-[640px] gap-4">
              {[
                { label: "Overview", desc: "Balance & quick actions" },
                { label: "Invoices", desc: "To pay vs Sent" },
                { label: "Deposit", desc: "Bridge or Solana receive" },
                { label: "Transfer", desc: "Send USDC out" },
              ].map((step, i, arr) => (
                <div key={step.label} className="flex flex-1 items-center gap-4">
                  <div className="card flex-1 p-5">
                    <p className="text-xs font-bold text-brand">Step {i + 1}</p>
                    <p className="mt-1 font-semibold">{step.label}</p>
                    <p className="text-xs text-[var(--color-muted)]">{step.desc}</p>
                  </div>
                  {i < arr.length - 1 && <span className="text-slate-300">→</span>}
                </div>
              ))}
            </div>
          </div>
          <p className="mt-8 text-center">
            <Link href="/help" className="font-semibold text-brand hover:underline">
              Read the full help guide →
            </Link>
          </p>
        </ScrollReveal>
      </section>

      {/* Chains */}
      <section className="border-t border-[var(--color-border)] bg-white py-16">
        <ScrollReveal className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Supported testnets</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {CHAINS.map((c) => (
              <span
                key={c}
                className="rounded-full border border-[var(--color-border)] bg-slate-50 px-4 py-2 text-sm font-medium"
              >
                {c}
              </span>
            ))}
          </div>
          <p className="mt-6 text-xs text-[var(--color-muted)]">
            Receive tab: share your Solana address — USDC on Solana only to credit your wallet.
          </p>
        </ScrollReveal>
      </section>

      {/* Security */}
      <section className="py-20 lg:py-24">
        <ScrollReveal className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="card grid gap-8 p-8 lg:grid-cols-2 lg:p-12">
            <div>
              <h2 className="font-display text-2xl font-bold">Security & trust</h2>
              <p className="mt-4 text-sm leading-relaxed text-[var(--color-muted)]">
                Sessions use encrypted server-side storage for Circle credentials. Public pay links use
                opaque tokens — payers never see your full wallet admin keys. Always verify amounts on
                MetaMask before confirming.
              </p>
            </div>
            <ul className="space-y-3 text-sm">
              {["Google OAuth via Circle W3S", "HttpOnly session cookies", "Encrypted refresh tokens", "Testnet-only in this build"].map(
                (t) => (
                  <li key={t} className="flex gap-2 rounded-xl bg-slate-50 px-4 py-3">
                    <span className="text-emerald-600">●</span>
                    {t}
                  </li>
                )
              )}
            </ul>
          </div>
        </ScrollReveal>
      </section>

      {/* FAQ */}
      <section id="faq" className="section-anchor border-t border-[var(--color-border)] bg-white py-20 lg:py-28">
        <ScrollReveal className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center font-display text-3xl font-bold">Common questions</h2>
          <div className="mt-10">
            <FaqAccordion items={FAQ} />
          </div>
          <p className="mt-8 text-center text-sm text-[var(--color-muted)]">
            More answers on our <Link href="/help" className="font-semibold text-brand hover:underline">Help</Link> page.
          </p>
        </ScrollReveal>
      </section>

      <PlatformMetricsSection initialMetrics={metrics} />

      {/* CTA */}
      <section className="gradient-hero py-20 text-center text-white lg:py-28">
        <ScrollReveal className="mx-auto max-w-2xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold lg:text-4xl">Your next invoice is one sign-in away</h2>
          <p className="mt-4 text-slate-300">
            Join vendors who bill in USDC without losing payers in bridge tutorials.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/login" className="btn-accent px-8 py-4 text-base">
              Get started free
            </Link>
            <Link href="/about" className="btn-outline border-slate-600 bg-transparent px-8 py-4 text-base text-white hover:bg-white/10">
              About Settlor
            </Link>
          </div>
        </ScrollReveal>
      </section>
    </>
  );
}
