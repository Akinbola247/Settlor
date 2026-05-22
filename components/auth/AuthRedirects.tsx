"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

/** Send OAuth return traffic from `/` to `/login` where the Circle SDK is initialized. */
export function OAuthReturnRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;
    const { search, hash } = window.location;
    const looksLikeOAuth =
      search.includes("code=") ||
      search.includes("state=") ||
      hash.includes("code=") ||
      hash.includes("access_token");
    if (looksLikeOAuth) {
      router.replace(`/login${search}${hash}`);
    }
  }, [pathname, router]);

  return null;
}

/**
 * Optional auto-redirect for signed-in users on marketing pages.
 * Not used on `/` or `/help` — navbar shows "Return to dashboard" instead.
 */
export function SessionRedirect({ fromPath = "/" }: { fromPath?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== fromPath) return;
    void fetch("/api/auth/me", { credentials: "include" }).then((res) => {
      if (res.ok) router.replace("/dashboard");
    });
  }, [pathname, router, fromPath]);

  return null;
}
