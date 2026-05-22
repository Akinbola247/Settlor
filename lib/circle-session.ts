import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { refreshCircleUserToken, validateCircleUserToken } from "@/lib/circle";
import type { AuthSession } from "@/lib/auth";

export type FreshCircleCredentials = {
  userToken: string;
  encryptionKey: string;
};

/** Attach browser deviceId to session (persist when DB schema supports it). */
export async function applyDeviceIdToSession(
  session: AuthSession,
  deviceId?: string
): Promise<AuthSession> {
  if (!deviceId?.trim()) return session;
  const trimmed = deviceId.trim();
  if (session.circleDeviceId === trimmed) return session;

  try {
    await prisma.session.update({
      where: { id: session.sessionId },
      data: { circleDeviceId: trimmed },
    });
  } catch (err) {
    console.warn("[circle-session] Could not persist circleDeviceId:", err);
  }

  return { ...session, circleDeviceId: trimmed };
}

/** Refresh Circle user token when possible; persist new credentials on the DB session. */
export async function getFreshCircleCredentials(
  session: AuthSession
): Promise<FreshCircleCredentials | { error: string; reauth?: boolean }> {
  const deviceId = session.circleDeviceId;
  const refreshToken = session.circleRefreshToken;

  if (refreshToken && deviceId) {
    const refreshed = await refreshCircleUserToken({
      userToken: session.circleUserToken,
      refreshToken,
      deviceId,
    });

    if (!("error" in refreshed)) {
      try {
        await prisma.session.update({
          where: { id: session.sessionId },
          data: {
            circleUserTokenEnc: encrypt(refreshed.userToken),
            circleEncryptionKeyEnc: encrypt(
              refreshed.encryptionKey || session.circleEncryptionKey
            ),
            ...(refreshed.refreshToken
              ? { circleRefreshTokenEnc: encrypt(refreshed.refreshToken) }
              : {}),
          },
        });
      } catch (err) {
        console.warn("[circle-session] Could not persist refreshed tokens:", err);
      }

      const encryptionKey =
        refreshed.encryptionKey?.trim() || session.circleEncryptionKey;
      if (!encryptionKey) {
        return {
          error:
            "Circle did not return wallet encryption keys. Sign in again on this browser, then retry.",
          reauth: true,
        };
      }
      return {
        userToken: refreshed.userToken,
        encryptionKey,
      };
    }
  }

  const { valid, error } = await validateCircleUserToken(session.circleUserToken);
  if (valid && session.circleEncryptionKey?.trim()) {
    return {
      userToken: session.circleUserToken,
      encryptionKey: session.circleEncryptionKey,
    };
  }

  if (!refreshToken || !deviceId) {
    return {
      error:
        "Wallet link incomplete for this browser. Sign out, sign in again (stay on this tab until the dashboard loads), then retry.",
      reauth: true,
    };
  }

  return {
    error: error ?? "Could not refresh Circle wallet access. Sign in again and retry.",
    reauth: true,
  };
}

/** Prefer freshly stored browser credentials from the last Google sign-in. */
export function resolvePaymentCredentials(
  session: AuthSession,
  client?: { userToken?: string; encryptionKey?: string } | null
): FreshCircleCredentials | null {
  if (client?.userToken?.trim() && client?.encryptionKey?.trim()) {
    return {
      userToken: client.userToken.trim(),
      encryptionKey: client.encryptionKey.trim(),
    };
  }
  if (session.circleUserToken && session.circleEncryptionKey?.trim()) {
    return {
      userToken: session.circleUserToken,
      encryptionKey: session.circleEncryptionKey,
    };
  }
  return null;
}
