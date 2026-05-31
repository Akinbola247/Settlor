/**
 * App-wide config. Switch networks via NEXT_PUBLIC_SETTLOR_NETWORK=mainnet|devnet.
 */

export type SettlorNetwork = "devnet" | "mainnet";

export const SETTLOR_NETWORK: SettlorNetwork =
  process.env.NEXT_PUBLIC_SETTLOR_NETWORK === "mainnet" ? "mainnet" : "devnet";

export const IS_MAINNET = SETTLOR_NETWORK === "mainnet";

export const APP = {
  name: "Settlor",
  tagline: "Cross-chain USDC invoicing",
  description:
    "Send invoices, get paid in USDC from any chain, and settle to one balance on Solana.",
  domain: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

/** HttpOnly session cookie (rebrand from ipayx_session). */
export const SESSION_COOKIE = "settlor_session";

/** @deprecated Use SESSION_COOKIE */
export const LEGACY_SESSION_COOKIE = "ipayx_session";
