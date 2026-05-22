import type { ComponentType } from "react";
import {
  IconActivity,
  IconContacts,
  IconDeposit,
  IconInvoice,
  IconOverview,
  IconPayBill,
  IconPayments,
  IconRecurring,
  IconTag,
  IconWallet,
  IconTransfer,
  IconPlus,
} from "./icons";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badgeKey?: "pendingInvoices";
};

export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: IconOverview },
  { href: "/dashboard/activity", label: "Activity", icon: IconActivity },
  { href: "/dashboard/invoices", label: "Invoices", icon: IconInvoice, badgeKey: "pendingInvoices" },
  { href: "/dashboard/payments", label: "Payments", icon: IconPayments },
];

export const QUICK_ACTIONS: NavItem[] = [
  { href: "/dashboard/invoices/new", label: "New invoice", icon: IconPlus },
  { href: "/dashboard/deposit", label: "Deposit", icon: IconDeposit },
  { href: "/dashboard/transfer", label: "Transfer", icon: IconTransfer },
];

export const ACCOUNT_NAV: NavItem[] = [
  { href: "/dashboard/wallet", label: "Arc wallet", icon: IconWallet },
];

export type ComingSoonItem = {
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
};

/** Planned features — shown disabled in the sidebar */
export const COMING_SOON_NAV: ComingSoonItem[] = [
  {
    label: "Pay bill",
    hint: "Scan or enter a bill and pay in USDC from any chain",
    icon: IconPayBill,
  },
  {
    label: "Pay with tag",
    hint: "Send to @handles without wallet addresses",
    icon: IconTag,
  },
  {
    label: "Recurring invoices",
    hint: "Retainers and subscriptions on autopilot",
    icon: IconRecurring,
  },
  {
    label: "Client contacts",
    hint: "Saved payers, tags, and payment history in one place",
    icon: IconContacts,
  },
];
