import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import { USDC_MINT, solanaRpcUrl } from "@/lib/solana-config";

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

export type EnsureUsdcAtaResult = {
  ataAddress: string;
  created: boolean;
  signature?: string;
};

/** Create the user's SPL USDC ATA using the platform sponsor as fee payer. */
export async function ensureUsdcAta(ownerAddress: string): Promise<EnsureUsdcAtaResult> {
  const sponsor = parsePlatformKeypair();
  if (!sponsor) {
    throw new Error(
      "PLATFORM_SOL_PRIVATE_KEY is not configured — cannot create USDC token account."
    );
  }

  const connection = new Connection(solanaRpcUrl(), "confirmed");
  const owner = new PublicKey(ownerAddress);
  const mint = new PublicKey(USDC_MINT);
  const ata = await getAssociatedTokenAddress(mint, owner);

  try {
    await getAccount(connection, ata);
    return { ataAddress: ata.toBase58(), created: false };
  } catch {
    /* ATA missing — create below */
  }

  const ix = createAssociatedTokenAccountInstruction(
    sponsor.publicKey,
    ata,
    owner,
    mint
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction({
    feePayer: sponsor.publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(ix);

  const signature = await sendAndConfirmTransaction(connection, tx, [sponsor], {
    commitment: "confirmed",
  });

  return { ataAddress: ata.toBase58(), created: true, signature };
}
