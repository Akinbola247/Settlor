"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Item = { q: string; a: string };

export default function FaqAccordion({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-white">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              type="button"
              className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-50/80"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <span className="font-semibold text-[var(--color-ink)]">{item.q}</span>
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-xs transition",
                  isOpen && "rotate-45 border-orange-200 bg-orange-50 text-orange-600"
                )}
              >
                +
              </span>
            </button>
            {isOpen && (
              <p className="px-6 pb-5 text-sm leading-relaxed text-[var(--color-muted)]">{item.a}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
