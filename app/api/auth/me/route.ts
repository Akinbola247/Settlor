import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  getWalletBalances,
  extractUsdcBalance,
  listCircleWallets,
} from "@/lib/circle";
import { pickSettlementWallet } from "@/lib/circle-wallet";
import { CIRCLE_SOLANA_BLOCKCHAIN } from "@/lib/solana-config";
import { sponsorSolIfNeeded } from "@/lib/gas-sponsor";
import { isSolanaAddress } from "@/lib/address-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let usdcBalance = "0";
  let gasSponsor: { toppedUp?: boolean } | undefined;
  let user = session.user;

  const circleWallets = await listCircleWallets(session.circleUserToken);
  const settlement = pickSettlementWallet(circleWallets);

  if (
    settlement &&
    (user.walletId !== settlement.id || user.walletAddress !== settlement.address)
  ) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        walletId: settlement.id,
        walletAddress: settlement.address,
      },
    });
  }

  const walletId = settlement?.id ?? user.walletId;

  if (walletId) {
    const balances = await getWalletBalances(session.circleUserToken, walletId);
    if (balances) usdcBalance = extractUsdcBalance(balances);

    if (isSolanaAddress(user.walletAddress)) {
      try {
        gasSponsor = await sponsorSolIfNeeded(user.walletAddress);
      } catch {
        /* non-fatal — user may already have SOL */
      }
    }
  }

  return NextResponse.json({
    user,
    usdcBalance,
    gasSponsor,
    wallet: walletId
      ? {
          id: walletId,
          address: user.walletAddress,
          blockchain: CIRCLE_SOLANA_BLOCKCHAIN,
        }
      : null,
  });
}
