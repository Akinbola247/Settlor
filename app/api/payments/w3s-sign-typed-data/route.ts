import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import { createSignTypedDataChallenge } from "@/lib/circle-challenges";
import {
  applyDeviceIdToSession,
  getFreshCircleCredentials,
  resolvePaymentCredentials,
} from "@/lib/circle-session";
import { validateCircleUserToken } from "@/lib/circle";

const bodySchema = z.object({
  walletId: z.string().uuid(),
  typedData: z.unknown(),
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

    const { walletId, typedData, deviceId, circleUserToken, circleEncryptionKey } =
      parsed.data;

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

    const result = await createSignTypedDataChallenge(fresh.userToken, {
      walletId,
      typedData,
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
    console.error("[/api/payments/w3s-sign-typed-data]", err);
    const message = err instanceof Error ? err.message : "Could not start signature";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
