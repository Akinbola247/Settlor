import { PublicKey, VersionedTransaction } from "@solana/web3.js";

export type SolanaWireValidation =
  | {
      ok: true;
      feePayer: string;
      sizeBytes: number;
      version: "legacy" | "v0";
    }
  | { ok: false; error: string };

/** Decode a base64 Solana wire transaction and inspect fee payer + size. */
export function validateSolanaWireTransaction(rawBase64: string): SolanaWireValidation {
  try {
    const bytes = Buffer.from(rawBase64, "base64");
    if (bytes.length === 0) {
      return { ok: false, error: "Transaction payload is empty" };
    }
    if (bytes.length > 1232) {
      return {
        ok: false,
        error: `Transaction is ${bytes.length} bytes (Solana limit is 1232). CCTP mint needs address lookup table compression.`,
      };
    }

    const tx = VersionedTransaction.deserialize(bytes);
    const feePayer = tx.message.staticAccountKeys[0];
    if (!feePayer) {
      return { ok: false, error: "Transaction has no fee payer account" };
    }

    return {
      ok: true,
      feePayer: feePayer.toBase58(),
      sizeBytes: bytes.length,
      version: tx.version === "legacy" ? "legacy" : "v0",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not decode transaction";
    return { ok: false, error: message };
  }
}

export function feePayerMatchesWallet(feePayer: string, walletAddress: string): boolean {
  try {
    return new PublicKey(feePayer).equals(new PublicKey(walletAddress));
  } catch {
    return false;
  }
}
