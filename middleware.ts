import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_API_PREFIXES = [
  "/api/invoices/public",
  "/api/auth/session",
  "/api/auth/me",
  "/api/metrics",
];
const PUBLIC_PAGES = ["/", "/login", "/pay"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (pathname === "/api/endpoints" && request.method === "POST") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    const session = request.cookies.get("ipayx_session");
    if (!session?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (pathname.startsWith("/dashboard")) {
    const session = request.cookies.get("ipayx_session");
    if (!session?.value) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/dashboard", "/dashboard/:path*"],
};
