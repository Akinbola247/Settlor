import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import { createArcTransferChallenge } from "@/lib/circle-transfer";
import { extractUsdcBalance, getWalletBalances } from "@/lib/circle";
import {
  applyDeviceIdToSession,
  getFreshCircleCredentials,
  resolvePaymentCredentials,
} from "@/lib/circle-session";
import { validateCircleUserToken } from "@/lib/circle";

const bodySchema = z.object({
  destinationAddress: z.string().min(10),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/),
  walletId: z.string().uuid().optional(),
  deviceId: z.string().min(1).optional(),
  /** From sessionStorage right after login — keeps userToken + encryptionKey paired */
  circleUserToken: z.string().min(1).optional(),
  circleEncryptionKey: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const {
      destinationAddress,
      amount,
      walletId: bodyWalletId,
      deviceId: bodyDeviceId,
      circleUserToken: bodyUserToken,
      circleEncryptionKey: bodyEncryptionKey,
    } = parsed.data;

    const sessionWithDevice = await applyDeviceIdToSession(session, bodyDeviceId);

    let fresh = resolvePaymentCredentials(sessionWithDevice, {
      userToken: bodyUserToken,
      encryptionKey: bodyEncryptionKey,
    });

    if (fresh) {
      const { valid } = await validateCircleUserToken(fresh.userToken);
      if (!valid) fresh = null;
    }

    if (!fresh) {
      const refreshed = await getFreshCircleCredentials(sessionWithDevice);
      if ("error" in refreshed) {
        return NextResponse.json(
          { error: refreshed.error, reauth: refreshed.reauth ?? true },
          { status: 401 }
        );
      }
      fresh = refreshed;
    }

    const walletId = bodyWalletId ?? session.user.walletId;
    if (!walletId) {
      return NextResponse.json({ error: "No Arc wallet on account" }, { status: 400 });
    }

    const balances = await getWalletBalances(fresh.userToken, walletId);
    if (!balances) {
      return NextResponse.json({ error: "Could not read balance" }, { status: 500 });
    }
    const balance = parseFloat(extractUsdcBalance(balances));
    const payAmount = parseFloat(amount);
    if (payAmount > balance) {
      return NextResponse.json(
        { error: `Insufficient Arc balance ($${balance.toFixed(2)} available)` },
        { status: 400 }
      );
    }

    const result = await createArcTransferChallenge(fresh.userToken, {
      walletId,
      destinationAddress,
      amount,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({
      challengeId: result.challengeId,
      userToken: fresh.userToken,
      encryptionKey: fresh.encryptionKey,
    });
  } catch (err) {
    console.error("[/api/payments/transfer]", err);
    const message =
      err instanceof Error ? err.message : "Payment could not be started";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
