import { normalizeWalletAddress, walletAddressesEqual } from "@/lib/address-utils";

/** Placeholder address when invoice is addressed by email only */
export const ZERO_RECIPIENT_ADDRESS = "0x0000000000000000000000000000000000000000";

export function normalizeEmail(email?: string | null): string | null {
  if (!email?.trim()) return null;
  return email.trim().toLowerCase();
}

export type InvoiceParty = {
  creatorAddress: string;
  recipientAddress: string;
  recipientEmail: string | null;
  recipientUserId?: string | null;
};

export type InvoiceUser = {
  id?: string;
  walletAddress: string;
  email?: string | null;
};

export function isInvoiceCreator(inv: InvoiceParty, user: InvoiceUser): boolean {
  return walletAddressesEqual(inv.creatorAddress, user.walletAddress);
}

/** Payee: linked user id, wallet matches, or invoice was sent to their login email */
export function isInvoicePayee(inv: InvoiceParty, user: InvoiceUser): boolean {
  if (user.id && inv.recipientUserId && inv.recipientUserId === user.id) {
    return true;
  }

  if (
    inv.recipientAddress !== ZERO_RECIPIENT_ADDRESS &&
    walletAddressesEqual(inv.recipientAddress, user.walletAddress)
  ) {
    return true;
  }

  const invEmail = normalizeEmail(inv.recipientEmail);
  const userEmail = normalizeEmail(user.email);
  return Boolean(invEmail && userEmail && invEmail === userEmail);
}

export function canAccessInvoice(inv: InvoiceParty, user: InvoiceUser): boolean {
  return isInvoiceCreator(inv, user) || isInvoicePayee(inv, user);
}
