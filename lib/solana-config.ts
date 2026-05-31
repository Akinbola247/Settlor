import { IS_MAINNET, SETTLOR_NETWORK } from "@/lib/settlor-config";

/** Circle W3S blockchain enum for wallet + transfers */
export const CIRCLE_SOLANA_BLOCKCHAIN = IS_MAINNET ? "SOL" : "SOL-DEVNET";

/** App Kit chain id for CCTP */
export const SETTLEMENT_CHAIN_ID = IS_MAINNET ? "Solana" : "Solana_Devnet";

export const SETTLEMENT_CHAIN_LABEL = IS_MAINNET ? "Solana" : "Solana Devnet";

/** SPL USDC mint (Circle official) */
export const USDC_MINT = IS_MAINNET
  ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  : "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export const USDC_DECIMALS = 6;

/** CCTP v2 program IDs (devnet + mainnet share v2 addresses per Circle) */
export const CCTP_TOKEN_MESSENGER_MINTER = "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe";
export const CCTP_MESSAGE_TRANSMITTER = "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY?.trim();

function heliusRpc(cluster: "devnet" | "mainnet-beta"): string | null {
  if (!HELIUS_API_KEY) return null;
  const host = cluster === "devnet" ? "devnet.helius-rpc.com" : "mainnet.helius-rpc.com";
  return `https://${host}/?api-key=${HELIUS_API_KEY}`;
}

/** Prefer Helius when configured; falls back to public RPC. */
export function solanaRpcUrl(): string {
  if (IS_MAINNET) {
    return (
      heliusRpc("mainnet-beta") ??
      process.env.SOLANA_RPC_URL?.trim() ??
      "https://api.mainnet-beta.solana.com"
    );
  }
  return (
    heliusRpc("devnet") ??
    process.env.SOLANA_RPC_URL?.trim() ??
    "https://api.devnet.solana.com"
  );
}

export function solanaExplorerTxUrl(signature: string): string {
  const cluster = IS_MAINNET ? "" : "?cluster=devnet";
  return `https://solscan.io/tx/${signature}${cluster}`;
}

export function solanaExplorerAddressUrl(address: string): string {
  const cluster = IS_MAINNET ? "" : "?cluster=devnet";
  return `https://solscan.io/account/${address}${cluster}`;
}

/** Minimum SOL balance before we auto-drip from the gas sponsor (lamports). */
export const MIN_SPONSOR_SOL_LAMPORTS = 5_000_000; // 0.005 SOL

/** Amount to send when topping up gas (lamports). */
export const SPONSOR_TOPUP_LAMPORTS = 20_000_000; // 0.02 SOL

export const NETWORK_ENV_HINT =
  SETTLOR_NETWORK === "mainnet"
    ? "Set NEXT_PUBLIC_SETTLOR_NETWORK=devnet for testnet."
    : "Set NEXT_PUBLIC_SETTLOR_NETWORK=mainnet for production.";
