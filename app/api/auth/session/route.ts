import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSession, sessionCookieOptions } from "@/lib/auth";

const bodySchema = z.object({
  userToken: z.string().min(1),
  encryptionKey: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  deviceId: z.string().min(1).optional(),
  walletAddress: z.string().min(1),
  walletId: z.string().nullish(),
  email: z.string().email().nullish(),
  displayName: z.string().nullish(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.parse(await req.json());
    const { sessionId, user } = await createSession({
      userToken: parsed.userToken,
      encryptionKey: parsed.encryptionKey,
      refreshToken: parsed.refreshToken,
      deviceId: parsed.deviceId,
      walletAddress: parsed.walletAddress,
      walletId: parsed.walletId ?? undefined,
      email: parsed.email ?? undefined,
      displayName: parsed.displayName ?? undefined,
    });
    const res = NextResponse.json({ user });
    res.cookies.set(sessionCookieOptions(sessionId, 60 * 60 * 24 * 7));
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Session creation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
