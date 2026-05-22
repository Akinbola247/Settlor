import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import {
  createInvoiceForUser,
  getInvoiceById,
  getInvoicesForUser,
  linkInvoicesToPayee,
  updateInvoice,
  deleteInvoice,
} from "@/lib/invoices";
import { validateBridgePaymentProof } from "@/lib/payment-proof";

export async function GET(req: NextRequest) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const inv = await getInvoiceById(id, session.user);
    if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(inv);
  }

  await linkInvoicesToPayee({
    id: session.user.id,
    email: session.user.email,
    walletAddress: session.user.walletAddress,
  });
  const data = await getInvoicesForUser(session.user);
  return NextResponse.json(data);
}

const createSchema = z.object({
  recipientAddress: z.string().optional(),
  recipientName: z.string().min(1),
  recipientEmail: z.string().email().optional().or(z.literal("")),
  dueDate: z.string().optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative(),
      })
    )
    .min(1),
  notes: z.string().optional(),
  status: z.enum(["draft", "pending"]).optional(),
  creatorName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = createSchema.parse(await req.json());
    const invoice = await createInvoiceForUser(
      session.user.id,
      session.user.walletAddress,
      {
        ...body,
        recipientEmail: body.recipientEmail || undefined,
        creatorName: body.creatorName ?? session.user.displayName ?? undefined,
      }
    );
    return NextResponse.json(invoice, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

const patchSchema = z.object({
  id: z.string(),
  status: z.enum(["draft", "pending", "paid", "overdue", "cancelled"]).optional(),
  txHash: z.string().optional(),
  paidAt: z.string().optional(),
  notes: z.string().optional(),
  bridgeSteps: z
    .array(
      z.object({
        name: z.string(),
        state: z.string(),
        explorerUrl: z.string().optional(),
      })
    )
    .optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = patchSchema.parse(await req.json());
    const { id, bridgeSteps, ...patch } = body;
    if (patch.status === "paid") {
      if (!patch.txHash || !bridgeSteps?.length) {
        return NextResponse.json(
          { error: "Paid status requires txHash and bridgeSteps proof" },
          { status: 400 }
        );
      }
      const proof = validateBridgePaymentProof(bridgeSteps, patch.txHash);
      if (!proof.ok) {
        return NextResponse.json({ error: proof.error }, { status: 400 });
      }
      patch.txHash = proof.reference;
    }
    const updated = await updateInvoice(id, session.user, patch);
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const ok = await deleteInvoice(id, session.user.walletAddress);
  return NextResponse.json({ ok });
}
