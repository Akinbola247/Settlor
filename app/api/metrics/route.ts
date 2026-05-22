import { NextResponse } from "next/server";
import { getPlatformMetrics } from "@/lib/platform-metrics";

/** Public aggregate stats for marketing / landing page (no PII). */
export async function GET() {
  try {
    const metrics = await getPlatformMetrics();
    return NextResponse.json(metrics, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (e) {
    console.error("[iPayX] /api/metrics:", e);
    return NextResponse.json({ error: "Failed to load metrics" }, { status: 500 });
  }
}
