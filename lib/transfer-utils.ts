export function shortenAddress(addr: string, head = 6, tail = 4): string {
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function isValidEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

/** Trim and lowercase a valid EVM address; returns null if invalid. */
export function normalizeEvmAddress(value: string): string | null {
  const trimmed = value.trim();
  if (!isValidEvmAddress(trimmed)) return null;
  return trimmed.toLowerCase();
}
