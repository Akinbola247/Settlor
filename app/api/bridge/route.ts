/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/bridge/route.ts
import { NextRequest, NextResponse } from "next/server";
import { bridgeInbound, bridgeOutbound } from "@/app/lib/bridge.server";
import { BridgeChain } from "@circle-fin/app-kit";
import { updateInvoice } from "@/app/lib/invoiceStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { direction = "inbound", ...params } = body;

    if (direction === "inbound") {
      // ── INBOUND: someone paying (any chain → Arc recipient) ──────────────
      const {
        fromChain,
        recipientArcAddress,
        amount,
        senderEvmPrivateKey,
        senderSolanaPrivateKey,
        invoiceId, // optional — marks invoice as paid after success
      } = params;

      if (!fromChain || !recipientArcAddress || !amount) {
        return NextResponse.json(
          { error: "Missing: fromChain, recipientArcAddress, amount" },
          { status: 400 }
        );
      }

      if (!Object.values(BridgeChain).includes(fromChain)) {
        return NextResponse.json({ error: `Unsupported chain: ${fromChain}` }, { status: 400 });
      }

      const result = await bridgeInbound({
        fromChain,
        recipientArcAddress,
        amount,
        senderEvmPrivateKey,
        senderSolanaPrivateKey,
      });

      // Mark invoice paid if provided
      if (invoiceId) {
        const txHash = result.steps?.find((s: any) => s.name === "mint")?.explorerUrl ?? undefined;
        updateInvoice(invoiceId, {
          status: "paid",
          paidAt: new Date().toISOString(),
          txHash,
        });
      }

      return NextResponse.json(result);
    }

    if (direction === "outbound") {
      // ── OUTBOUND: Circle wallet user sending Arc USDC → external chain ───
      const { toChain, recipientAddress, amount, senderWalletId } = params;

      if (!toChain || !recipientAddress || !amount || !senderWalletId) {
        return NextResponse.json(
          { error: "Missing: toChain, recipientAddress, amount, senderWalletId" },
          { status: 400 }
        );
      }

      if (!Object.values(BridgeChain).includes(toChain)) {
        return NextResponse.json({ error: `Unsupported chain: ${toChain}` }, { status: 400 });
      }

      const result = await bridgeOutbound({
        toChain,
        recipientAddress,
        amount,
        senderWalletId,
      });

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "direction must be inbound or outbound" }, { status: 400 });
  } catch (err: any) {
    console.error("[/api/bridge]", err);
    return NextResponse.json({ error: err?.message ?? "Bridge error" }, { status: 500 });
  }
}