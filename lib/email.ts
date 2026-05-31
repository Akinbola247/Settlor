import { invoicePaidEmail, invoiceSentEmail } from "@/lib/email-templates";
import { formatUSDC } from "@/lib/utils";

type InvoiceEmail = {
  to: string;
  recipientName: string;
  creatorName: string;
  amount: number;
  invoiceNumber: string;
  payUrl: string;
  dueDate: string | null;
  type?: "sent" | "paid";
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string; skipped?: boolean };

const RESEND_API = "https://api.resend.com/emails";

/** Default Resend sandbox sender (no domain verification required). */
export const RESEND_SANDBOX_FROM = "onboarding@resend.dev";

function resolveFromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || RESEND_SANDBOX_FROM;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/**
 * Send invoice notification via Resend.
 * Without RESEND_API_KEY, logs to console (dev fallback).
 */
export async function sendInvoiceNotification(
  payload: InvoiceEmail
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = resolveFromAddress();
  const isPaid = payload.type === "paid";

  const templateInput = {
    recipientName: payload.recipientName,
    creatorName: payload.creatorName,
    amount: payload.amount,
    invoiceNumber: payload.invoiceNumber,
    payUrl: payload.payUrl,
    dueDate: payload.dueDate,
  };

  const { subject, html } = isPaid
    ? invoicePaidEmail(templateInput)
    : invoiceSentEmail(templateInput);

  if (!apiKey) {
    console.info(
      "[Settlor email] RESEND_API_KEY not set — would send:",
      subject,
      "→",
      payload.to,
      payload.payUrl
    );
    return { ok: false, error: "Email not configured (missing RESEND_API_KEY)", skipped: true };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject,
        html,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };

    if (!res.ok) {
      const error = data.message ?? data.name ?? `Resend HTTP ${res.status}`;
      console.error("[Settlor email] Resend error:", error, data);
      return { ok: false, error };
    }

    if (!data.id) {
      return { ok: false, error: "Resend returned no message id" };
    }

    console.info("[Settlor email] sent", data.id, subject, "→", payload.to);
    return { ok: true, id: data.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown email error";
    console.error("[Settlor email] failed:", message);
    return { ok: false, error: message };
  }
}

/** Plain-text preview for debugging */
export function previewInvoiceEmail(payload: InvoiceEmail): { subject: string; text: string } {
  const isPaid = payload.type === "paid";
  return {
    subject: isPaid
      ? `Payment received — ${payload.invoiceNumber}`
      : `Invoice ${payload.invoiceNumber} from ${payload.creatorName}`,
    text: isPaid
      ? `${payload.creatorName} paid $${formatUSDC(payload.amount)} on ${payload.invoiceNumber}.`
      : `${payload.creatorName} invoiced $${formatUSDC(payload.amount)}. Pay: ${payload.payUrl}`,
  };
}
