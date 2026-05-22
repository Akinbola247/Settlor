import { NextRequest, NextResponse } from "next/server";
import { getPublicInvoice, markInvoicePaidPublic } from "@/lib/invoices";
import { validateBridgePaymentProof } from "@/lib/payment-proof";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }
  const invoice = await getPublicInvoice(token);
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(invoice);
}

const bridgeStepSchema = z.object({
  name: z.string(),
  state: z.string(),
  explorerUrl: z.string().optional(),
});

const patchSchema = z.object({
  token: z.string(),
  txHash: z.string().min(8),
  bridgeSteps: z.array(bridgeStepSchema).min(1),
});

export async function PATCH(req: NextRequest) {
  try {
    const { token, txHash, bridgeSteps } = patchSchema.parse(await req.json());
    const proof = validateBridgePaymentProof(bridgeSteps, txHash);
    if (!proof.ok) {
      return NextResponse.json({ error: proof.error }, { status: 400 });
    }
    const updated = await markInvoicePaidPublic(token, proof.reference, bridgeSteps);
    if (!updated) {
      return NextResponse.json({ error: "Cannot mark paid" }, { status: 400 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
