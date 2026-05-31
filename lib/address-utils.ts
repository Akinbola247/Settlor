/** EVM 0x address (case-insensitive for matching). */
export function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

/** Solana base58 address (32–44 chars, case-sensitive). */
export function isSolanaAddress(value: string): boolean {
  const t = value.trim();
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t);
}

export function isValidWalletAddress(value: string): boolean {
  return isEvmAddress(value) || isSolanaAddress(value);
}

/** Preserve Solana casing; lowercase EVM for storage/compare. */
export function normalizeWalletAddress(value: string): string {
  const trimmed = value.trim();
  if (isEvmAddress(trimmed)) return trimmed.toLowerCase();
  return trimmed;
}

export function walletAddressesEqual(a: string, b: string): boolean {
  if (isEvmAddress(a) || isEvmAddress(b)) {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
  return a.trim() === b.trim();
}
