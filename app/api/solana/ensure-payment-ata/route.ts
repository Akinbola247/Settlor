import { NextResponse } from "next/server";
import { z } from "zod";
import { isSolanaAddress } from "@/lib/address-utils";
import { ensureUsdcAta } from "@/lib/ensure-usdc-ata";
import { solanaExplorerTxUrl } from "@/lib/solana-config";

const bodySchema = z.object({
  address: z.string().min(32).max(44),
});

/** Create vendor USDC ATA before CCTP mint (platform pays rent). Used for invoice pay. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { address } = parsed.data;
  if (!isSolanaAddress(address)) {
    return NextResponse.json({ error: "Invalid Solana address" }, { status: 400 });
  }

  try {
    const result = await ensureUsdcAta(address);
    return NextResponse.json({
      ...result,
      explorerUrl: result.signature ? solanaExplorerTxUrl(result.signature) : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not ensure USDC account";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
