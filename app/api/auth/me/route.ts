import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getWalletBalances, extractUsdcBalance } from "@/lib/circle";

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let usdcBalance = "0";
  if (session.user.walletId) {
    const balances = await getWalletBalances(
      session.circleUserToken,
      session.user.walletId
    );
    if (balances) usdcBalance = extractUsdcBalance(balances);
  }

  return NextResponse.json({
    user: session.user,
    usdcBalance,
    wallet: session.user.walletId
      ? {
          id: session.user.walletId,
          address: session.user.walletAddress,
          blockchain: "ARC-TESTNET",
        }
      : null,
  });
}
