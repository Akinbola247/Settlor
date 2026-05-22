/**
 * Server-side Circle App Kit credentials.
 * TEST_API_KEY format: TEST_API_KEY:<32-hex>:<32-hex>
 * The wallets adapter needs apiKey = full string, entitySecret = 64 lowercase hex (often both 32-hex parts concatenated).
 */

const HEX64 = /^[a-f0-9]{64}$/;
const HEX32 = /^[a-f0-9]{32}$/;

function normalizeHex(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-f0-9]/g, "");
}

/** Parse entity secret from a TEST_API_KEY line or raw 64-char hex. */
export function parseCircleEntitySecret(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;

  const trimmed = raw.trim();
  const compact = normalizeHex(trimmed);

  if (HEX64.test(compact)) return compact;

  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    const tail = parts[parts.length - 1];
    const tailHex = normalizeHex(tail);
    if (HEX64.test(tailHex)) return tailHex;

    if (parts.length >= 3) {
      const a = normalizeHex(parts[parts.length - 2]);
      const b = normalizeHex(parts[parts.length - 1]);
      if (HEX32.test(a) && HEX32.test(b)) return a + b;
    }
  }

  return null;
}

export function getCircleApiKey(): string {
  const key = process.env.CIRCLE_API_KEY?.trim();
  if (!key) throw new Error("CIRCLE_API_KEY is not set");
  return key;
}

export function getCircleEntitySecret(): string {
  const fromEntity = parseCircleEntitySecret(process.env.CIRCLE_ENTITY_SECRET);
  const fromApiKey = parseCircleEntitySecret(process.env.CIRCLE_API_KEY);
  const secret = fromEntity ?? fromApiKey;

  if (!secret) {
    throw new Error(
      "CIRCLE_ENTITY_SECRET must be a 64-character lowercase hex string, or use a full TEST_API_KEY:…:… value in CIRCLE_API_KEY (secret is extracted automatically)."
    );
  }

  return secret;
}

export function getCircleWalletsAdapterOptions(): { apiKey: string; entitySecret: string } {
  return {
    apiKey: getCircleApiKey(),
    entitySecret: getCircleEntitySecret(),
  };
}
