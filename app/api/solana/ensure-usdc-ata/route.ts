import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import { isSolanaAddress } from "@/lib/address-utils";
import { ensureUsdcAta } from "@/lib/ensure-usdc-ata";
import { solanaExplorerTxUrl } from "@/lib/solana-config";

const bodySchema = z.object({
  address: z.string().min(32).max(44).optional(),
});

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  const address =
    parsed.success && parsed.data.address
      ? parsed.data.address
      : session.user.walletAddress;

  if (!isSolanaAddress(address)) {
    return NextResponse.json({ error: "Invalid Solana address" }, { status: 400 });
  }

  if (address !== session.user.walletAddress) {
    return NextResponse.json({ error: "Address must match your wallet" }, { status: 403 });
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
