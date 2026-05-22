import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { applyDeviceIdToSession, getFreshCircleCredentials } from "@/lib/circle-session";

/** Fresh Circle credentials for client SDK challenge execution (invoice pay). */
export async function GET(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deviceId = new URL(request.url).searchParams.get("deviceId") ?? undefined;
    const sessionWithDevice = await applyDeviceIdToSession(session, deviceId);

    const fresh = await getFreshCircleCredentials(sessionWithDevice);
    if ("error" in fresh) {
      return NextResponse.json(
        { error: fresh.error, reauth: fresh.reauth ?? true },
        { status: 401 }
      );
    }

    return NextResponse.json({
      userToken: fresh.userToken,
      encryptionKey: fresh.encryptionKey,
      walletId: session.user.walletId,
      walletAddress: session.user.walletAddress,
    });
  } catch (err) {
    console.error("[/api/payments/circle-sdk]", err);
    const message = err instanceof Error ? err.message : "Could not load wallet credentials";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
