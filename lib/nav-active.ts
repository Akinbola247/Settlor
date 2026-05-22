/** Routes under a nav parent that should not highlight the parent link */
const NAV_PARENT_EXCLUSIONS: Record<string, string[]> = {
  "/dashboard/invoices": ["/dashboard/invoices/new"],
};

function routePathMatches(pathname: string, normalizedPath: string): boolean {
  if (normalizedPath === "/dashboard") {
    return pathname === "/dashboard";
  }

  if (normalizedPath === "/dashboard/invoices") {
    if (pathname === "/dashboard/invoices") return true;
    const excluded = NAV_PARENT_EXCLUSIONS[normalizedPath] ?? [];
    if (excluded.includes(pathname)) return false;
    return pathname.startsWith(`${normalizedPath}/`);
  }

  return pathname === normalizedPath || pathname.startsWith(`${normalizedPath}/`);
}

/** Sidebar active state: pathname + search params (avoids double-highlight on /payments). */
export function isNavItemActive(
  pathname: string,
  searchParams: URLSearchParams,
  href: string
): boolean {
  const [path, queryString] = href.split("?");
  const normalizedPath = path || href;

  if (normalizedPath === "#") return false;

  const pathMatches = routePathMatches(pathname, normalizedPath);

  if (!pathMatches) return false;

  if (queryString) {
    const expected = new URLSearchParams(queryString);
    for (const [key, value] of expected.entries()) {
      if (searchParams.get(key) !== value) return false;
    }
    return true;
  }

  return true;
}
