/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { direction = "inbound", ...params } = body;

    if (direction === "inbound") {
      return NextResponse.json(
        {
          error:
            "Server inbound bridge is disabled. Use the client pay flow at /pay/[token] with MetaMask.",
        },
        { status: 410 }
      );
    }

    if (direction === "outbound") {
      return NextResponse.json(
        {
          error:
            "Outbound bridge runs in your browser with your Circle wallet. Refresh the page and use Transfer again.",
        },
        { status: 410 }
      );
    }

    return NextResponse.json({ error: "direction must be inbound or outbound" }, { status: 400 });
  } catch (err: any) {
    console.error("[/api/bridge]", err);
    const msg = err?.message ?? "Bridge error";
    const configHint =
      /entitySecret|CIRCLE_ENTITY_SECRET|CIRCLE_API_KEY/i.test(msg)
        ? " Check CIRCLE_API_KEY in .env — use the full TEST_API_KEY line from Circle; the 64-char entity secret is parsed automatically."
        : "";
    const addressHint = /EVM address/i.test(msg)
      ? " Ensure your session wallet has a valid 0x address and the recipient is a full EVM address."
      : "";
    return NextResponse.json({ error: msg + configHint + addressHint }, { status: 500 });
  }
}
