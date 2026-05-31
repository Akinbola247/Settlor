"use client";

import { useEffect, useState } from "react";
import { buildMetricCards } from "@/lib/platform-metrics-display";
import type { PlatformMetrics } from "@/lib/platform-metrics";
import { ScrollReveal } from "./ScrollReveal";

type Props = {
  initialMetrics: PlatformMetrics;
};

export default function PlatformMetricsSection({ initialMetrics }: Props) {
  const [metrics, setMetrics] = useState(initialMetrics);

  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch("/api/metrics", { cache: "no-store" });
        if (res.ok) setMetrics(await res.json());
      } catch {
        /* keep last good snapshot */
      }
    };
    const id = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const cards = buildMetricCards(metrics);
  const updated = new Date(metrics.updatedAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <section
      id="platform-metrics"
      className="section-anchor border-t border-[var(--color-border)] bg-[var(--color-surface)] py-20 lg:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <ScrollReveal className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-widest text-brand">
            Platform activity
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold lg:text-4xl">
            Live growth on Settlor Testnet
          </h2>
          <p className="mt-4 text-[var(--color-muted)] leading-relaxed">
            Real counts from this environment — invoices, payments, and accounts as teams use the
            product. Refreshes automatically while you browse.
          </p>
        </ScrollReveal>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card, i) => (
            <ScrollReveal key={card.label} delay={i * 70}>
              <div className="card h-full p-6">
                <p className="font-display text-3xl font-bold text-[var(--color-brand)] tabular-nums">
                  {card.value}
                </p>
                <p className="mt-2 font-semibold">{card.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                  {card.hint}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={120} className="mt-8 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--color-muted)]">
          <span>
            Last updated {updated}
            {metrics.pendingInvoices > 0 && (
              <>
                {" "}
                · <strong className="text-[var(--color-ink)]">{metrics.pendingInvoices}</strong>{" "}
                invoice{metrics.pendingInvoices === 1 ? "" : "s"} awaiting payment
              </>
            )}
          </span>
          <span className="rounded-full bg-white px-3 py-1 border border-[var(--color-border)]">
            Solana Devnet · POC
          </span>
        </ScrollReveal>
      </div>
    </section>
  );
}
