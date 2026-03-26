/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/invoices/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  createInvoice,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  getInvoicesForUser,
  Invoice,
} from "@/app/lib/invoiceStore";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  const id = searchParams.get("id");

  if (id) {
    const inv = getInvoice(id);
    if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(inv);
  }

  if (!address) {
    return NextResponse.json({ error: "address or id required" }, { status: 400 });
  }

  return NextResponse.json(getInvoicesForUser(address));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      creatorAddress,
      creatorName,
      recipientAddress,
      recipientName,
      recipientEmail,
      dueDate,
      items,
      notes,
      status = "pending",
    } = body;

    if (!creatorAddress || !recipientAddress || !recipientName || !items?.length) {
      return NextResponse.json(
        { error: "Missing required fields: creatorAddress, recipientAddress, recipientName, items" },
        { status: 400 }
      );
    }

    const invoice = createInvoice({
      creatorAddress,
      creatorName,
      recipientAddress,
      recipientName,
      recipientEmail,
      dueDate: dueDate ?? "",
      items,
      notes,
      status,
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...patch } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const updated = updateInvoice(id, patch);
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const ok = deleteInvoice(id);
  return NextResponse.json({ ok });
}