"use client";

import { cn } from "@/lib/utils";

const STEPS = ["To", "Amount", "Review", "Send"] as const;

type Props = {
  current: number;
};

export default function TransferStepBar({ current }: Props) {
  return (
    <nav className="mb-8 flex items-center gap-2" aria-label="Transfer progress">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const active = stepNum === current;
        const done = stepNum < current;
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition",
                done && "bg-emerald-100 text-emerald-700",
                active && "bg-[var(--color-ink)] text-white",
                !done && !active && "bg-slate-100 text-slate-400"
              )}
            >
              {done ? "✓" : stepNum}
            </div>
            <span
              className={cn(
                "hidden text-xs font-semibold sm:inline",
                active ? "text-[var(--color-ink)]" : "text-[var(--color-muted)]"
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-px flex-1",
                  done ? "bg-emerald-200" : "bg-[var(--color-border)]"
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
