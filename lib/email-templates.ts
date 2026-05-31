import { formatUSDC } from "@/lib/utils";

type TemplateInput = {
  recipientName: string;
  creatorName: string;
  amount: number;
  invoiceNumber: string;
  payUrl: string;
  dueDate: string | null;
};

function brandLogoUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/settlor-icon.svg`;
}

function layout(title: string, body: string) {
  const logoUrl = brandLogoUrl();
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="background:#0f172a;padding:24px 28px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;padding-right:12px;">
              <span style="display:inline-block;width:40px;height:40px;line-height:40px;text-align:center;background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:10px;color:#fff;font-weight:700;font-size:18px;">S</span>
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:20px;font-weight:700;color:#fff;">Settlor</span>
              <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Invoice in USDC. Settle on Solana.</p>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">${title}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:16px 28px 24px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:11px;color:#94a3b8;">You received this because of an invoice on Settlor.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function invoiceSentEmail(input: TemplateInput) {
  const due = input.dueDate
    ? `<p style="margin:0 0 16px;color:#64748b;font-size:14px;">Due date: <strong>${new Date(input.dueDate).toLocaleDateString("en-US", { dateStyle: "long" })}</strong></p>`
    : "";

  const body = `
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.5;">Hi ${escapeHtml(input.recipientName)},</p>
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.5;">
      <strong>${escapeHtml(input.creatorName)}</strong> sent you invoice
      <strong>${escapeHtml(input.invoiceNumber)}</strong> for
      <strong style="color:#ea580c;">$${formatUSDC(input.amount)} USDC</strong>.
    </p>
    ${due}
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">Pay from MetaMask or Phantom on supported testnets — funds settle on Solana.</p>
    <a href="${input.payUrl}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:12px;">View &amp; pay invoice</a>
    <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;word-break:break-all;">Or copy this link:<br>${input.payUrl}</p>
  `;

  return {
    subject: `Invoice ${input.invoiceNumber} from ${input.creatorName}`,
    html: layout("New invoice", body),
  };
}

export function invoicePaidEmail(input: TemplateInput) {
  const body = `
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.5;">Hi ${escapeHtml(input.recipientName)},</p>
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.5;">
      <strong>${escapeHtml(input.creatorName)}</strong> paid invoice
      <strong>${escapeHtml(input.invoiceNumber)}</strong>
      (<strong style="color:#059669;">$${formatUSDC(input.amount)} USDC</strong>).
    </p>
    <p style="margin:0;color:#64748b;font-size:14px;">The payment was recorded on Settlor.</p>
  `;

  return {
    subject: `Payment received — ${input.invoiceNumber}`,
    html: layout("Payment received", body),
  };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
