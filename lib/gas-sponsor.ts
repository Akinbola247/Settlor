import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  MIN_SPONSOR_SOL_LAMPORTS,
  SPONSOR_TOPUP_LAMPORTS,
  solanaRpcUrl,
} from "@/lib/solana-config";
import {
  feePayerMatchesWallet,
  validateSolanaWireTransaction,
} from "@/lib/solana-tx-validate";

export type GasSponsorConfig = {
  enabled: boolean;
  publicKey: string | null;
  rpcUrl: string;
  reason?: string;
};

function parsePlatformKeypair(): Keypair | null {
  const raw = process.env.PLATFORM_SOL_PRIVATE_KEY?.trim();
  if (!raw) return null;

  try {
    if (raw.startsWith("[")) {
      const arr = JSON.parse(raw) as number[];
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
  } catch {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bs58 = require("bs58") as { decode: (s: string) => Uint8Array };
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    return null;
  }
}

let cachedKeypair: Keypair | null | undefined;

function getSponsorKeypair(): Keypair | null {
  if (cachedKeypair !== undefined) return cachedKeypair;
  cachedKeypair = parsePlatformKeypair();
  return cachedKeypair;
}

export function getGasSponsorConfig(): GasSponsorConfig {
  const rpcUrl = solanaRpcUrl();
  const kp = getSponsorKeypair();
  if (!kp) {
    return {
      enabled: false,
      publicKey: null,
      rpcUrl,
      reason:
        "Set PLATFORM_SOL_PRIVATE_KEY (JSON byte array from solana-keygen, or base58) to enable gas sponsorship.",
    };
  }
  return {
    enabled: true,
    publicKey: kp.publicKey.toBase58(),
    rpcUrl,
  };
}

export async function getSolBalanceLamports(address: string): Promise<number> {
  const connection = new Connection(solanaRpcUrl(), "confirmed");
  return connection.getBalance(new PublicKey(address), "confirmed");
}

/**
 * Send SOL from the platform sponsor wallet for rent + tx fees.
 * Fund the sponsor with SOL; set HELIUS_API_KEY for production RPC.
 */
export async function sponsorSolIfNeeded(
  recipientAddress: string
): Promise<{ toppedUp: boolean; signature?: string; balanceLamports: number }> {
  const sponsor = getSponsorKeypair();
  if (!sponsor) {
    const balanceLamports = await getSolBalanceLamports(recipientAddress);
    return { toppedUp: false, balanceLamports };
  }

  const connection = new Connection(solanaRpcUrl(), "confirmed");
  const recipient = new PublicKey(recipientAddress);
  const balanceLamports = await connection.getBalance(recipient, "confirmed");

  if (balanceLamports >= MIN_SPONSOR_SOL_LAMPORTS) {
    return { toppedUp: false, balanceLamports };
  }

  const sponsorBalance = await connection.getBalance(sponsor.publicKey, "confirmed");
  if (sponsorBalance < SPONSOR_TOPUP_LAMPORTS + 5000) {
    throw new Error(
      `Gas sponsor wallet is low on SOL (${(sponsorBalance / LAMPORTS_PER_SOL).toFixed(4)}). ` +
        `Fund ${sponsor.publicKey.toBase58()} on the active cluster.`
    );
  }

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: sponsor.publicKey,
      toPubkey: recipient,
      lamports: SPONSOR_TOPUP_LAMPORTS,
    })
  );

  const signature = await sendAndConfirmTransaction(connection, tx, [sponsor], {
    commitment: "confirmed",
  });

  return {
    toppedUp: true,
    signature,
    balanceLamports: balanceLamports + SPONSOR_TOPUP_LAMPORTS,
  };
}

/** Partial-sign a Solana wire tx when the platform sponsor is fee payer (CCTP mint). */
export function signPlatformSolanaWireTransaction(rawBase64: string): string {
  const sponsor = getSponsorKeypair();
  if (!sponsor) {
    throw new Error("PLATFORM_SOL_PRIVATE_KEY is not configured");
  }

  const check = validateSolanaWireTransaction(rawBase64);
  if (!check.ok) {
    throw new Error(check.error);
  }
  if (!feePayerMatchesWallet(check.feePayer, sponsor.publicKey.toBase58())) {
    throw new Error("Transaction fee payer must be the platform sponsor wallet");
  }

  const tx = VersionedTransaction.deserialize(Buffer.from(rawBase64, "base64"));
  tx.sign([sponsor]);
  return Buffer.from(tx.serialize()).toString("base64");
}
