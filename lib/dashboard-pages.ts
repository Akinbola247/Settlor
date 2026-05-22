/** Human-readable titles for dashboard breadcrumb navigation */
export const DASHBOARD_PAGES: Record<string, { title: string; description?: string }> = {
  "/dashboard": {
    title: "Overview",
    description: "Balance and activity",
  },
  "/dashboard/activity": {
    title: "Activity",
    description: "Recent invoices and payments",
  },
  "/dashboard/invoices": {
    title: "Invoices",
    description: "To pay and sent",
  },
  "/dashboard/invoices/new": {
    title: "New invoice",
    description: "Create and send a bill",
  },
  "/dashboard/payments": {
    title: "Payments",
    description: "History and summary",
  },
  "/dashboard/deposit": {
    title: "Deposit",
    description: "Add USDC",
  },
  "/dashboard/transfer": {
    title: "Transfer",
    description: "Send USDC to an address",
  },
  "/dashboard/wallet": {
    title: "Wallet",
    description: "Address and balance",
  },
};

export function getDashboardPageMeta(pathname: string): { title: string; description?: string } {
  if (DASHBOARD_PAGES[pathname]) return DASHBOARD_PAGES[pathname];
  if (pathname.startsWith("/dashboard/payments")) {
    return DASHBOARD_PAGES["/dashboard/payments"];
  }
  if (pathname.startsWith("/dashboard/deposit")) {
    return DASHBOARD_PAGES["/dashboard/deposit"];
  }
  if (pathname.startsWith("/dashboard/transfer")) {
    return DASHBOARD_PAGES["/dashboard/transfer"];
  }
  if (pathname.startsWith("/dashboard/invoices/new")) {
    return DASHBOARD_PAGES["/dashboard/invoices/new"];
  }
  if (pathname.startsWith("/dashboard/invoices")) {
    return DASHBOARD_PAGES["/dashboard/invoices"];
  }
  return { title: "Dashboard" };
}
