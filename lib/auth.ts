import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";
import { validateCircleUserToken } from "@/lib/circle";
import { linkInvoicesToPayee } from "@/lib/invoices";
import { normalizeEmail } from "@/lib/invoice-access";
import { normalizeWalletAddress, walletAddressesEqual, isEvmAddress, isSolanaAddress } from "@/lib/address-utils";
import { pickSettlementWallet } from "@/lib/circle-wallet";
import { LEGACY_SESSION_COOKIE, SESSION_COOKIE } from "@/lib/settlor-config";

export { SESSION_COOKIE };
const SESSION_DAYS = 7;

type EmailWalletConflict =
  | { kind: "none" }
  | { kind: "arc-to-solana"; legacyUser: { id: string; walletAddress: string; displayName: string | null } }
  | { kind: "conflict"; existing: { walletAddress: string } };

/** Detect whether an email is tied to another wallet, or a legacy Arc → Solana migration. */
export async function findEmailWalletConflict(
  email: string | null | undefined,
  walletAddress: string
): Promise<EmailWalletConflict> {
  const normalized = normalizeEmail(email);
  if (!normalized) return { kind: "none" };

  const targetAddress = normalizeWalletAddress(walletAddress);
  const existing = await prisma.user.findFirst({
    where: {
      email: normalized,
      walletAddress: { not: targetAddress },
    },
    select: { id: true, walletAddress: true, displayName: true },
  });

  if (!existing) return { kind: "none" };

  if (isEvmAddress(existing.walletAddress) && isSolanaAddress(targetAddress)) {
    return { kind: "arc-to-solana", legacyUser: existing };
  }

  return { kind: "conflict", existing };
}

export function formatEmailWalletConflictError(existingWalletAddress: string): string {
  const tail = existingWalletAddress.slice(-6);
  const chainHint = isEvmAddress(existingWalletAddress)
    ? " (legacy Arc/EVM wallet)"
    : isSolanaAddress(existingWalletAddress)
      ? " (Solana wallet)"
      : "";
  return (
    `This email is already linked to a different wallet (…${tail}${chainHint}). ` +
    `Google sign-in and email verification code create separate Circle accounts. ` +
    `Sign in the same way you used when you first created your account, or use a different email.`
  );
}

/**
 * Circle treats Google and email OTP as different users — block duplicate email on unrelated wallets.
 * Arc → Solana migration for the same email is handled separately in createSession.
 */
export async function assertEmailAvailableForWallet(
  email: string | null | undefined,
  walletAddress: string
): Promise<void> {
  const conflict = await findEmailWalletConflict(email, walletAddress);
  if (conflict.kind === "none" || conflict.kind === "arc-to-solana") return;
  throw new Error(formatEmailWalletConflictError(conflict.existing.walletAddress));
}

/** Move a legacy Arc user row onto their new Solana settlement wallet (same email, same Settlor account). */
async function migrateLegacyUserToSolanaWallet(input: {
  legacyUserId: string;
  walletAddress: string;
  walletId: string;
  email?: string;
  displayName?: string;
}) {
  const walletAddress = normalizeWalletAddress(input.walletAddress);

  await prisma.$transaction(async (tx) => {
    const orphan = await tx.user.findUnique({ where: { walletAddress } });
    if (orphan && orphan.id !== input.legacyUserId) {
      await tx.invoice.updateMany({
        where: { creatorId: orphan.id },
        data: { creatorId: input.legacyUserId },
      });
      await tx.invoice.updateMany({
        where: { recipientUserId: orphan.id },
        data: { recipientUserId: input.legacyUserId },
      });
      await tx.user.delete({ where: { id: orphan.id } });
    }

    await tx.user.update({
      where: { id: input.legacyUserId },
      data: {
        walletAddress,
        walletId: input.walletId,
        email: input.email,
        displayName: input.displayName,
      },
    });
  });
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

  const normalized = normalizeWalletAddress(input.walletAddress);
  const settlement = pickSettlementWallet(wallets);
  const walletMatch =
    wallets.find((w) => walletAddressesEqual(w.address, normalized)) ??
    settlement ??
    wallets[0];

  if (!walletMatch) {
    throw new Error("No Circle wallet found for this account");
  }

  const walletAddress = normalizeWalletAddress(walletMatch.address);

  const email = normalizeEmail(input.email ?? undefined) ?? undefined;
  const displayName = input.displayName?.trim() || undefined;

  const conflict = await findEmailWalletConflict(email, walletAddress);
  let user;

  if (conflict.kind === "arc-to-solana") {
    await migrateLegacyUserToSolanaWallet({
      legacyUserId: conflict.legacyUser.id,
      walletAddress,
      walletId: input.walletId ?? walletMatch.id,
      email,
      displayName: displayName ?? conflict.legacyUser.displayName ?? undefined,
    });
    user = await prisma.user.findUniqueOrThrow({ where: { walletAddress } });
  } else {
    if (conflict.kind === "conflict") {
      throw new Error(formatEmailWalletConflictError(conflict.existing.walletAddress));
    }

    user = await prisma.user.upsert({
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
  }

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
  const sessionId =
    cookieStore.get(SESSION_COOKIE)?.value ??
    cookieStore.get(LEGACY_SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  try {
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
  } catch {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }
}

/**
 * Removes the Settlor user row, sessions, and invoice links.
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
  const sessionId =
    cookieStore.get(SESSION_COOKIE)?.value ??
    cookieStore.get(LEGACY_SESSION_COOKIE)?.value;
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
