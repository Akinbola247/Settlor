import { prisma } from "@/lib/prisma";
import type { InvoiceDto, InvoiceStatus } from "@/lib/types";
import { invoiceTotal } from "@/lib/utils";
import { sendInvoiceNotification } from "@/lib/email";
import {
  canAccessInvoice,
  isInvoicePayee,
  normalizeEmail,
  ZERO_RECIPIENT_ADDRESS,
  type InvoiceUser,
} from "@/lib/invoice-access";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function resolveStatus(status: string, dueDate: Date | null): InvoiceStatus {
  if (status === "pending" && dueDate && dueDate < new Date()) return "overdue";
  return status as InvoiceStatus;
}

function toDto(
  inv: {
    id: string;
    invoiceNumber: string;
    status: string;
    createdAt: Date;
    dueDate: Date | null;
    creatorAddress: string;
    creatorName: string | null;
    recipientAddress: string;
    recipientName: string;
    recipientEmail: string | null;
    notes: string | null;
    txHash: string | null;
    paidAt: Date | null;
    publicToken: string;
    items: { id: string; description: string; quantity: number; unitPrice: number }[];
  },
  includePayUrl = false
): InvoiceDto {
  const status = resolveStatus(inv.status, inv.dueDate);
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status,
    createdAt: inv.createdAt.toISOString(),
    dueDate: inv.dueDate?.toISOString() ?? null,
    creatorAddress: inv.creatorAddress,
    creatorName: inv.creatorName,
    recipientAddress: inv.recipientAddress,
    recipientName: inv.recipientName,
    recipientEmail: inv.recipientEmail,
    items: inv.items.map((i) => ({
      id: i.id,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    notes: inv.notes,
    txHash: inv.txHash,
    paidAt: inv.paidAt?.toISOString() ?? null,
    publicToken: inv.publicToken,
    ...(includePayUrl ? { payUrl: `${appUrl()}/pay/${inv.publicToken}` } : {}),
  };
}

const invoiceInclude = { items: { orderBy: { sortOrder: "asc" as const } } };

const INVOICE_NUMBER_RE = /^INV-(\d+)$/;

async function nextInvoiceNumber(): Promise<string> {
  const invoices = await prisma.invoice.findMany({
    where: { invoiceNumber: { startsWith: "INV-" } },
    select: { invoiceNumber: true },
  });

  let maxNum = 0;
  for (const { invoiceNumber } of invoices) {
    const match = invoiceNumber.match(INVOICE_NUMBER_RE);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }

  return `INV-${String(maxNum + 1).padStart(4, "0")}`;
}

export async function createInvoiceForUser(
  userId: string,
  creatorAddress: string,
  data: {
    creatorName?: string;
    recipientAddress?: string;
    recipientName: string;
    recipientEmail?: string;
    dueDate?: string;
    items: { description: string; quantity: number; unitPrice: number }[];
    notes?: string;
    status?: InvoiceStatus;
  }
): Promise<InvoiceDto> {
  if (!data.recipientAddress && !data.recipientEmail) {
    throw new Error("Provide client wallet address or email");
  }

  const status = data.status ?? "pending";
  const recipientAddress =
    data.recipientAddress?.toLowerCase() || ZERO_RECIPIENT_ADDRESS;
  const recipientEmail = normalizeEmail(data.recipientEmail) ?? undefined;

  const payeeUser = recipientEmail
    ? await prisma.user.findFirst({ where: { email: recipientEmail } })
    : null;

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: await nextInvoiceNumber(),
      status,
      creatorId: userId,
      creatorAddress: creatorAddress.toLowerCase(),
      creatorName: data.creatorName,
      recipientAddress:
        payeeUser?.walletAddress ?? recipientAddress,
      recipientName: data.recipientName,
      recipientEmail,
      recipientUserId: payeeUser?.id,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      notes: data.notes,
      items: {
        create: data.items.map((item, i) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          sortOrder: i,
        })),
      },
    },
    include: invoiceInclude,
  });

  const dto = toDto(invoice, true);

  if (status === "pending" && data.recipientEmail) {
    void sendInvoiceNotification({
      to: data.recipientEmail,
      recipientName: data.recipientName,
      creatorName: data.creatorName ?? "A business",
      amount: invoiceTotal(dto.items),
      invoiceNumber: dto.invoiceNumber,
      payUrl: dto.payUrl!,
      dueDate: dto.dueDate,
    }).then((r) => {
      if (!r.ok && !r.skipped) {
        console.warn("[iPayX] Invoice email failed:", r.error);
      }
    });
  }

  return dto;
}

/** Link invoices addressed by email to the payee account (on login / profile sync) */
export async function linkInvoicesToPayee(user: {
  id: string;
  email?: string | null;
  walletAddress: string;
}): Promise<{ linked: number }> {
  const normalizedEmail = normalizeEmail(user.email);
  const wallet = user.walletAddress.toLowerCase();
  let linked = 0;

  if (normalizedEmail) {
    const byUserId = await prisma.invoice.updateMany({
      where: { recipientEmail: normalizedEmail },
      data: { recipientUserId: user.id },
    });
    linked += byUserId.count;

    const byAddress = await prisma.invoice.updateMany({
      where: {
        recipientEmail: normalizedEmail,
        recipientAddress: ZERO_RECIPIENT_ADDRESS,
        status: { in: ["pending", "overdue"] },
      },
      data: {
        recipientAddress: wallet,
        recipientUserId: user.id,
      },
    });
    linked += byAddress.count;
  }

  return { linked };
}

/** @deprecated Use linkInvoicesToPayee */
export async function linkInvoicesToPayeeByEmail(
  email: string | null | undefined,
  walletAddress: string
) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return 0;
  const user = await prisma.user.findFirst({ where: { email: normalizedEmail } });
  if (!user) return 0;
  const { linked } = await linkInvoicesToPayee(user);
  return linked;
}

export async function getInvoicesForUser(user: InvoiceUser) {
  const normalized = user.walletAddress.toLowerCase();
  const email = normalizeEmail(user.email);

  const receivedOr: { recipientAddress?: string; recipientEmail?: string; recipientUserId?: string }[] = [
    { recipientAddress: normalized },
  ];
  if (email) receivedOr.push({ recipientEmail: email });
  if (user.id) receivedOr.push({ recipientUserId: user.id });

  const receivedWhere = { OR: receivedOr };

  const [sent, received] = await Promise.all([
    prisma.invoice.findMany({
      where: { creatorAddress: normalized },
      include: invoiceInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.findMany({
      where: receivedWhere,
      include: invoiceInclude,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  await syncOverdueStatuses([...sent, ...received]);

  return {
    sent: sent.map((i) => toDto(i)),
    received: received.map((i) => toDto(i, true)),
  };
}

/** @deprecated Use getInvoicesForUser */
export async function getInvoicesForAddress(address: string) {
  return getInvoicesForUser({ walletAddress: address });
}

async function syncOverdueStatuses(
  invoices: { id: string; status: string; dueDate: Date | null }[]
) {
  const overdueIds = invoices
    .filter((i) => i.status === "pending" && i.dueDate && i.dueDate < new Date())
    .map((i) => i.id);
  if (overdueIds.length) {
    await prisma.invoice.updateMany({
      where: { id: { in: overdueIds } },
      data: { status: "overdue" },
    });
  }
}

export async function getInvoiceById(id: string, user?: InvoiceUser) {
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: invoiceInclude,
  });
  if (!inv) return null;
  if (user && !canAccessInvoice(inv, user)) {
    return null;
  }
  return toDto(inv, true);
}

export async function getPublicInvoice(publicToken: string) {
  const inv = await prisma.invoice.findUnique({
    where: { publicToken },
    include: invoiceInclude,
  });
  if (!inv || inv.status === "draft") return null;
  return toDto(inv);
}

export async function updateInvoice(
  id: string,
  user: InvoiceUser,
  patch: {
    status?: InvoiceStatus;
    txHash?: string;
    paidAt?: string;
    notes?: string;
  }
) {
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: invoiceInclude,
  });
  if (!inv) return null;

  const isCreator = inv.creatorAddress === user.walletAddress.toLowerCase();
  const isRecipient = isInvoicePayee(inv, user);

  if (patch.status === "paid") {
    if (!isRecipient) return null;
    if (!patch.txHash) throw new Error("Transaction reference required");
    if (inv.status === "paid") return toDto(inv, true);
  } else if (!isCreator) {
    return null;
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status: patch.status,
      txHash: patch.txHash,
      paidAt: patch.paidAt ? new Date(patch.paidAt) : patch.status === "paid" ? new Date() : undefined,
      notes: patch.notes,
    },
    include: invoiceInclude,
  });

  if (patch.status === "paid" && inv.creatorId) {
    const creator = await prisma.user.findUnique({ where: { id: inv.creatorId } });
    if (creator?.email) {
      void sendInvoiceNotification({
        to: creator.email,
        recipientName: creator.displayName ?? "there",
        creatorName: inv.recipientName,
        amount: invoiceTotal(updated.items),
        invoiceNumber: updated.invoiceNumber,
        payUrl: `${appUrl()}/pay/${updated.publicToken}`,
        dueDate: updated.dueDate?.toISOString() ?? null,
        type: "paid",
      }).then((r) => {
        if (!r.ok && !r.skipped) console.warn("[iPayX] Paid notification email failed:", r.error);
      });
    }
  }

  return toDto(updated);
}

export async function deleteInvoice(id: string, userAddress: string) {
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv || inv.creatorAddress !== userAddress.toLowerCase()) return false;
  await prisma.invoice.delete({ where: { id } });
  return true;
}

export async function markInvoicePaidPublic(
  publicToken: string,
  txHash: string,
  _bridgeSteps?: { name: string; state: string; explorerUrl?: string }[]
) {
  const inv = await prisma.invoice.findUnique({ where: { publicToken } });
  if (!inv || inv.status === "draft") return null;
  if (inv.status === "paid") {
    return toDto(
      await prisma.invoice.findUniqueOrThrow({
        where: { id: inv.id },
        include: invoiceInclude,
      })
    );
  }

  const updated = await prisma.invoice.update({
    where: { id: inv.id },
    data: { status: "paid", txHash, paidAt: new Date() },
    include: invoiceInclude,
  });

  if (inv.creatorId) {
    const creator = await prisma.user.findUnique({ where: { id: inv.creatorId } });
    if (creator?.email) {
      void sendInvoiceNotification({
        to: creator.email,
        recipientName: creator.displayName ?? "there",
        creatorName: inv.recipientName,
        amount: invoiceTotal(updated.items),
        invoiceNumber: updated.invoiceNumber,
        payUrl: `${appUrl()}/pay/${updated.publicToken}`,
        dueDate: updated.dueDate?.toISOString() ?? null,
        type: "paid",
      }).then((r) => {
        if (!r.ok && !r.skipped) console.warn("[iPayX] Paid notification email failed:", r.error);
      });
    }
  }

  return toDto(updated);
}
