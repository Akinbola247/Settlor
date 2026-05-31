import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import { getGasSponsorConfig, sponsorSolIfNeeded } from "@/lib/gas-sponsor";
import { isSolanaAddress } from "@/lib/address-utils";
import { solanaExplorerTxUrl } from "@/lib/solana-config";

const bodySchema = z.object({
  address: z.string().min(32).max(44),
});

/** GET — sponsor status for dashboard / ops */
export async function GET() {
  const config = getGasSponsorConfig();
  return NextResponse.json({
    ...config,
    provider: config.enabled ? "platform-wallet" : null,
    helius: Boolean(process.env.HELIUS_API_KEY?.trim()),
    hint: config.enabled
      ? "Fund the sponsor public key with SOL on your cluster. Set HELIUS_API_KEY for reliable RPC."
      : config.reason,
  });
}

/** POST — top up SOL for the authenticated user's Circle Solana wallet */
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
    const result = await sponsorSolIfNeeded(address);
    return NextResponse.json({
      ...result,
      explorerUrl: result.signature ? solanaExplorerTxUrl(result.signature) : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gas sponsorship failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
