import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";
import { validateCircleUserToken } from "@/lib/circle";
import { linkInvoicesToPayee } from "@/lib/invoices";
import { normalizeEmail } from "@/lib/invoice-access";

export const SESSION_COOKIE = "ipayx_session";
const SESSION_DAYS = 7;

/** Circle treats Google and email OTP as different users — one email must not map to two wallets. */
export async function assertEmailAvailableForWallet(
  email: string | null | undefined,
  walletAddress: string
): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  const existing = await prisma.user.findFirst({
    where: {
      email: normalized,
      walletAddress: { not: walletAddress.toLowerCase() },
    },
  });

  if (existing) {
    const tail = existing.walletAddress.slice(-6);
    throw new Error(
      `This email is already linked to a different wallet (…${tail}). ` +
        `Google sign-in and email verification code are separate Circle accounts, even when the email matches. ` +
        `Sign in the same way you used when you first created your account.`
    );
  }
}

export type AuthUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  walletAddress: string;
  walletId: string | null;
};

export type AuthSession = {
  sessionId: string;
  user: AuthUser;
  circleUserToken: string;
  circleEncryptionKey: string;
  circleRefreshToken: string | null;
  circleDeviceId: string | null;
};

export async function createSession(input: {
  userToken: string;
  encryptionKey: string;
  refreshToken?: string;
  deviceId?: string;
  walletAddress: string;
  walletId?: string;
  email?: string;
  displayName?: string;
}): Promise<{ sessionId: string; user: AuthUser }> {
  const { valid, wallets, error } = await validateCircleUserToken(input.userToken);
  if (!valid) {
    throw new Error(error ?? "Could not verify Circle session");
  }

  const normalized = input.walletAddress.toLowerCase();
  const walletMatch =
    wallets.find((w) => w.address.toLowerCase() === normalized) ?? wallets[0];

  if (!walletMatch) {
    throw new Error("No Circle wallet found for this account");
  }

  const walletAddress = walletMatch.address.toLowerCase();

  const email = normalizeEmail(input.email ?? undefined) ?? undefined;
  const displayName = input.displayName?.trim() || undefined;

  await assertEmailAvailableForWallet(email, walletAddress);

  const user = await prisma.user.upsert({
    where: { walletAddress },
    create: {
      walletAddress,
      walletId: input.walletId ?? walletMatch.id,
      email,
      displayName,
    },
    update: {
      walletId: input.walletId ?? walletMatch.id,
      email: email ?? undefined,
      displayName: displayName ?? undefined,
    },
  });

  await linkInvoicesToPayee({
    id: user.id,
    email: user.email,
    walletAddress,
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      circleUserTokenEnc: encrypt(input.userToken),
      circleEncryptionKeyEnc: encrypt(input.encryptionKey),
      circleRefreshTokenEnc: input.refreshToken
        ? encrypt(input.refreshToken)
        : undefined,
      circleDeviceId: input.deviceId,
      expiresAt,
    },
  });

  return {
    sessionId: session.id,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      walletAddress: user.walletAddress,
      walletId: user.walletId,
    },
  };
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  return {
    sessionId: session.id,
    user: {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      walletAddress: session.user.walletAddress,
      walletId: session.user.walletId,
    },
    circleUserToken: decrypt(session.circleUserTokenEnc),
    circleEncryptionKey: decrypt(session.circleEncryptionKeyEnc),
    circleRefreshToken: session.circleRefreshTokenEnc
      ? decrypt(session.circleRefreshTokenEnc)
      : null,
    circleDeviceId: session.circleDeviceId,
  };
}

/**
 * Removes the iPayX user row, sessions, and invoice links.
 * Does not delete the Circle wallet (Circle has no public delete-user API).
 */
export async function deleteAppUserAccount(userId: string): Promise<void> {
  const sentCount = await prisma.invoice.count({ where: { creatorId: userId } });
  if (sentCount > 0) {
    throw new Error(
      "You have invoices you created. Delete them from Invoices before removing your account."
    );
  }

  await prisma.invoice.updateMany({
    where: { recipientUserId: userId },
    data: { recipientUserId: null },
  });

  await prisma.user.delete({ where: { id: userId } });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
  }
}

export function sessionCookieOptions(sessionId: string, maxAge: number) {
  return {
    name: SESSION_COOKIE,
    value: sessionId,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
