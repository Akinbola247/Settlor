"use client";

import { cn } from "@/lib/utils";

export type InvoiceView = "received" | "sent";

type Props = {
  view: InvoiceView;
  onChange: (view: InvoiceView) => void;
  toPayCount: number;
  toPayDue: number;
  sentCount: number;
  sentOutstanding: number;
};

function IconInbox({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0H4m16 0l-1.5 3M4 13l1.5 3M9 13h6"
      />
    </svg>
  );
}

function IconSend({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
      />
    </svg>
  );
}

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InvoiceViewTabs({
  view,
  onChange,
  toPayCount,
  toPayDue,
  sentCount,
  sentOutstanding,
}: Props) {
  const tabs: {
    id: InvoiceView;
    label: string;
    hint: string;
    count: number;
    sublabel: string;
    icon: typeof IconInbox;
    activeClass: string;
    iconActiveClass: string;
  }[] = [
    {
      id: "received",
      label: "To pay",
      hint: "Bills from others",
      count: toPayCount,
      sublabel: toPayDue > 0 ? `$${formatMoney(toPayDue)} due` : "Nothing due",
      icon: IconInbox,
      activeClass:
        "border-brand bg-brand-subtle/90 shadow-sm ring-1 ring-brand text-[var(--color-ink)]",
      iconActiveClass: "bg-brand-subtle0 text-white",
    },
    {
      id: "sent",
      label: "Sent",
      hint: "Invoices you issued",
      count: sentCount,
      sublabel:
        sentOutstanding > 0 ? `$${formatMoney(sentOutstanding)} outstanding` : "All collected",
      icon: IconSend,
      activeClass:
        "border-slate-400 bg-slate-100 shadow-sm ring-1 ring-slate-300/80 text-[var(--color-ink)]",
      iconActiveClass: "bg-slate-800 text-white",
    },
  ];

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      role="tablist"
      aria-label="Invoice views"
    >
      {tabs.map((tab) => {
        const active = view === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex w-full items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition",
              active
                ? tab.activeClass
                : "border-transparent bg-white text-[var(--color-muted)] hover:border-[var(--color-border)] hover:bg-white hover:shadow-sm"
            )}
          >
            <span
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition",
                active ? tab.iconActiveClass : "bg-slate-100 text-slate-500"
              )}
            >
              <Icon className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className={cn("font-display text-lg font-bold", active && "text-[var(--color-ink)]")}>
                  {tab.label}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                    active
                      ? tab.id === "received"
                        ? "bg-brand-muted text-brand-strong"
                        : "bg-slate-300 text-slate-900"
                      : "bg-slate-100 text-slate-600"
                  )}
                >
                  {tab.count}
                </span>
              </span>
              <span className="mt-0.5 block text-xs font-medium">{tab.hint}</span>
              <span
                className={cn(
                  "mt-1 block text-sm font-semibold tabular-nums",
                  active ? "text-[var(--color-ink)]" : "text-slate-400"
                )}
              >
                {tab.sublabel}
              </span>
            </span>
            {active && (
              <span
                className={cn(
                  "hidden h-2 w-2 shrink-0 rounded-full sm:block",
                  tab.id === "received" ? "bg-brand-subtle0" : "bg-slate-700"
                )}
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
