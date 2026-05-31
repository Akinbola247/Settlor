import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  findEmailWalletConflict,
  formatEmailWalletConflictError,
  getAuthSession,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { linkInvoicesToPayee } from "@/lib/invoices";
import { normalizeEmail } from "@/lib/invoice-access";

const bodySchema = z.object({
  email: z.string().email(),
  displayName: z.string().nullish(),
});

/** Save Google email on account and link pending invoices (for users who logged in before email sync) */
export async function PATCH(req: NextRequest) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await req.json());
    const email = normalizeEmail(body.email);
    if (!email) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const conflict = await findEmailWalletConflict(email, session.user.walletAddress);
    if (conflict.kind === "conflict") {
      throw new Error(formatEmailWalletConflictError(conflict.existing.walletAddress));
    }
    if (conflict.kind === "arc-to-solana" && conflict.legacyUser.id !== session.user.id) {
      await prisma.user.update({
        where: { id: conflict.legacyUser.id },
        data: { email: null },
      });
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        email,
        displayName: body.displayName ?? session.user.displayName ?? undefined,
      },
    });

    const { linked } = await linkInvoicesToPayee({
      id: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        walletAddress: user.walletAddress,
        walletId: user.walletId,
      },
      invoicesLinked: linked,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
