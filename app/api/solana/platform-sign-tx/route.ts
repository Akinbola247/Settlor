import { NextResponse } from "next/server";
import { z } from "zod";
import { signPlatformSolanaWireTransaction } from "@/lib/gas-sponsor";

const bodySchema = z.object({
  rawTransaction: z.string().min(1),
});

/** Sign CCTP mint txs where the platform sponsor is fee payer (external EVM invoice pay). */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const signedTransaction = signPlatformSolanaWireTransaction(parsed.data.rawTransaction);
    return NextResponse.json({ signedTransaction });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not sign transaction";
    const status = message.includes("not configured") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
