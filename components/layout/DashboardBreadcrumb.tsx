"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDashboardPageMeta } from "@/lib/dashboard-pages";

export default function DashboardBreadcrumb() {
  const pathname = usePathname();
  const meta = getDashboardPageMeta(pathname);

  return (
    <div className="min-w-0 flex-1">
      <nav className="flex items-center gap-2 text-xs text-[var(--color-muted)]" aria-label="Breadcrumb">
        <Link href="/dashboard" className="font-medium hover:text-orange-600">
          Dashboard
        </Link>
        {pathname !== "/dashboard" && (
          <>
            <span aria-hidden>/</span>
            <span className="truncate font-medium text-[var(--color-ink)]">{meta.title}</span>
          </>
        )}
      </nav>
      {meta.description && (
        <p className="mt-0.5 truncate text-sm text-[var(--color-muted)] hidden sm:block">{meta.description}</p>
      )}
    </div>
  );
}
