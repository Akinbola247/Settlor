import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import { createSignSolanaTransactionChallenge } from "@/lib/circle-challenges";
import {
  applyDeviceIdToSession,
  getFreshCircleCredentials,
  resolvePaymentCredentials,
} from "@/lib/circle-session";
import { resolveSettlementWallet, validateCircleUserToken } from "@/lib/circle";
import { walletAddressesEqual } from "@/lib/address-utils";
import {
  feePayerMatchesWallet,
  validateSolanaWireTransaction,
} from "@/lib/solana-tx-validate";

const bodySchema = z.object({
  walletId: z.string().uuid(),
  rawTransaction: z.string().min(1),
  deviceId: z.string().min(1).optional(),
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

    const { walletId, rawTransaction, deviceId, circleUserToken, circleEncryptionKey } =
      parsed.data;

    const txCheck = validateSolanaWireTransaction(rawTransaction);
    if (!txCheck.ok) {
      return NextResponse.json(
        { error: `Invalid Solana mint transaction: ${txCheck.error}` },
        { status: 400 }
      );
    }

    const sessionWithDevice = await applyDeviceIdToSession(session, deviceId);

    let fresh = resolvePaymentCredentials(sessionWithDevice, {
      userToken: circleUserToken,
      encryptionKey: circleEncryptionKey,
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

    if (session.user.walletId && session.user.walletId !== walletId) {
      return NextResponse.json({ error: "Wallet not authorized" }, { status: 403 });
    }

    const walletCheck = await resolveSettlementWallet(fresh.userToken, walletId);
    if ("error" in walletCheck) {
      return NextResponse.json({ error: walletCheck.error, reauth: true }, { status: 400 });
    }

    const { wallet } = walletCheck;
    if (
      session.user.walletAddress &&
      !walletAddressesEqual(session.user.walletAddress, wallet.address)
    ) {
      return NextResponse.json(
        {
          error:
            "Your Settlor session wallet does not match your Circle Solana wallet. Sign out and sign in again.",
          reauth: true,
        },
        { status: 400 }
      );
    }

    if (!feePayerMatchesWallet(txCheck.feePayer, wallet.address)) {
      return NextResponse.json(
        {
          error:
            `Mint transaction fee payer (${txCheck.feePayer.slice(0, 8)}…) does not match your Circle wallet ` +
            `(${wallet.address.slice(0, 8)}…). Sign out and sign in again.`,
          reauth: true,
        },
        { status: 400 }
      );
    }

    const result = await createSignSolanaTransactionChallenge(fresh.userToken, {
      walletId: wallet.id,
      rawTransaction,
      memo: "Confirm USDC mint on Solana",
    });

    if ("error" in result) {
      console.error("[/api/payments/w3s-sign-solana-tx] Circle sign rejected:", {
        walletId: wallet.id,
        walletAddress: wallet.address,
        txVersion: txCheck.version,
        txSizeBytes: txCheck.sizeBytes,
        feePayer: txCheck.feePayer,
        circleRaw: result.raw,
        circleError: result.error,
      });

      let message = result.error;
      if (/API parameter invalid/i.test(message)) {
        message =
          "Circle rejected the mint transaction format. Ensure SOL-DEVNET is enabled in Circle Console, " +
          "your wallet has a small amount of SOL for fees, then retry. " +
          `(tx: ${txCheck.sizeBytes} bytes, ${txCheck.version})`;
      }

      return NextResponse.json({ error: message, circleError: result.error }, { status: 502 });
    }

    return NextResponse.json({
      challengeId: result.challengeId,
      userToken: fresh.userToken,
      encryptionKey: fresh.encryptionKey,
    });
  } catch (err) {
    console.error("[/api/payments/w3s-sign-solana-tx]", err);
    const message = err instanceof Error ? err.message : "Could not start Solana transaction";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
