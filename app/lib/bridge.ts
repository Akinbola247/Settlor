/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * lib/bridge.ts
 *
 * Server-side bridge logic.
 *
 * The Circle Programmable Wallet (created via Google login) is a developer-
 * controlled wallet on Arc Testnet. Transactions are signed server-side using
 * the Circle Wallets adapter with the platform API key + entity secret.
 *
 * For INCOMING funds (any chain → Arc):
 *   - The sender calls /api/bridge with their source chain + amount
 *   - We build a fromAdapter using their EIP-1193 provider (passed as a
 *     serialised wallet context) OR use Circle's transfer API if the source
 *     wallet is also a Circle wallet.
 *
 * For OUTGOING funds (Arc → any chain):
 *   - The logged-in user's Arc wallet (Circle-managed) is the source
 *   - We use createCircleWalletsAdapter for the from side
 *   - Destination can be any address on any supported chain
 *
 * Since Circle's W3S SDK manages the private keys entirely and never exposes
 * them to the browser, we cannot get a raw private key. Instead:
 *
 *  INBOUND (someone paying an invoice / sending to Arc):
 *    → Payer connects MetaMask / Phantom on the source chain
 *    → Browser calls /api/bridge with the transaction details
 *    → Server uses createViemAdapterFromPrivateKey with a PLATFORM key for
 *      the DESTINATION (Arc) adapter only (to poll confirmation)
 *    → Source transaction is signed in the browser via window.ethereum injected
 *      EIP-1193 — we use a client-side adapter for the burn step
 *
 *  OUTBOUND (Circle wallet user sending out):
 *    → We use the Circle Wallets adapter (server-side, no private key needed)
 *    → This requires CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET in env
 *
 * IMPORTANT: The Circle Wallets adapter is server-side only.
 */

import { AppKit, BridgeChain } from "@circle-fin/app-kit";
import { createCircleWalletsAdapter } from "@circle-fin/adapter-circle-wallets";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";

// ─── Supported chains exposed to the UI ──────────────────────────────────────

export interface SupportedChain {
  id: BridgeChain;
  name: string;
  logo: string;
  isTestnet: boolean;
  type: "evm" | "solana";
}

export const SUPPORTED_CHAINS: SupportedChain[] = [
  // Testnets
  { id: BridgeChain.Ethereum_Sepolia, name: "Ethereum Sepolia", logo: "⟠",  isTestnet: true,  type: "evm"    },
  { id: BridgeChain.Base_Sepolia,     name: "Base Sepolia",     logo: "🔵", isTestnet: true,  type: "evm"    },
  { id: BridgeChain.Arbitrum_Sepolia, name: "Arbitrum Sepolia", logo: "🔷", isTestnet: true,  type: "evm"    },
  { id: BridgeChain.Avalanche_Fuji,   name: "Avalanche Fuji",   logo: "🔺", isTestnet: true,  type: "evm"    },
  { id: BridgeChain.Solana_Devnet,    name: "Solana Devnet",    logo: "◎",  isTestnet: true,  type: "solana" },
  // Mainnets
  { id: BridgeChain.Ethereum,         name: "Ethereum",         logo: "⟠",  isTestnet: false, type: "evm"    },
  { id: BridgeChain.Base,             name: "Base",             logo: "🔵", isTestnet: false, type: "evm"    },
  { id: BridgeChain.Arbitrum,         name: "Arbitrum",         logo: "🔷", isTestnet: false, type: "evm"    },
  { id: BridgeChain.Avalanche,        name: "Avalanche",        logo: "🔺", isTestnet: false, type: "evm"    },
  { id: BridgeChain.Polygon,          name: "Polygon",          logo: "🟣", isTestnet: false, type: "evm"    },
  { id: BridgeChain.Solana,           name: "Solana",           logo: "◎",  isTestnet: false, type: "solana" },
];

// ─── Bridge step / progress types ────────────────────────────────────────────

export interface BridgeStep {
  name: string;
  state: "pending" | "success" | "error" | "noop";
  explorerUrl?: string;
  errorMessage?: string;
}

export interface BridgeProgress {
  step: string;
  steps: BridgeStep[];
  error?: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const PLATFORM_EVM_KEY = process.env.PLATFORM_EVM_PRIVATE_KEY as string;

/**
 * Platform adapter — used only for DESTINATION polling on Arc Testnet.
 * This is a platform-owned wallet; it's NOT the user's wallet.
 * It just watches for the mint confirmation.
 */
function platformArcAdapter() {
  if (!PLATFORM_EVM_KEY) throw new Error("PLATFORM_EVM_PRIVATE_KEY not set in env");
  return createViemAdapterFromPrivateKey({ privateKey: PLATFORM_EVM_KEY as `0x${string}` });
}

/**
 * Circle Wallets adapter for the logged-in user's Arc wallet.
 * Used for OUTBOUND transfers (Arc → external chain).
 */
function circleWalletsAdapter() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret) throw new Error("CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET not set");
  return createCircleWalletsAdapter({ apiKey, entitySecret });
}

// ─── INBOUND: any chain → Arc (recipient's unified balance) ───────────────────

export interface InboundParams {
  fromChain: BridgeChain;
  recipientArcAddress: string;
  amount: string;
  /**
   * The sender's EVM private key for the SOURCE chain only.
   * This is provided by the payer (not the Circle wallet user).
   * In a production app you'd replace this with MetaMask signing on the client.
   */
  senderEvmPrivateKey?: string;
  senderSolanaPrivateKey?: string;
}

export async function bridgeInbound(params: InboundParams): Promise<BridgeProgress> {
  const { fromChain, recipientArcAddress, amount, senderEvmPrivateKey, senderSolanaPrivateKey } = params;

  const isSolana = fromChain === BridgeChain.Solana || fromChain === BridgeChain.Solana_Devnet;

  let fromAdapter: any;
  if (isSolana) {
    const { createSolanaKitAdapterFromPrivateKey } = await import("@circle-fin/adapter-solana-kit");
    if (!senderSolanaPrivateKey) throw new Error("Solana private key required for Solana source chain");
    fromAdapter = createSolanaKitAdapterFromPrivateKey({ privateKey: senderSolanaPrivateKey });
  } else {
    if (!senderEvmPrivateKey) throw new Error("EVM private key required for EVM source chain");
    fromAdapter = createViemAdapterFromPrivateKey({ privateKey: senderEvmPrivateKey as `0x${string}` });
  }

  const toAdapter = platformArcAdapter();
  const kit = new AppKit();

  const result = await kit.bridge({
    from: { adapter: fromAdapter, chain: fromChain },
    to: {
      adapter: toAdapter,
      chain: BridgeChain.Arc_Testnet,
      recipientAddress: recipientArcAddress,
      useForwarder: true,
    },
    amount,
  });

  return {
    step: "done",
    steps: (result.steps ?? []).map((s: any) => ({
      name: s.name,
      state: s.state,
      explorerUrl: s.explorerUrl,
      errorMessage: s.errorMessage,
    })),
  };
}

// ─── OUTBOUND: Arc → any chain ────────────────────────────────────────────────

export interface OutboundParams {
  toChain: BridgeChain;
  recipientAddress: string; // address on the destination chain
  amount: string;
  /** The Circle wallet ID of the logged-in user (the sender) */
  senderWalletId: string;
}

export async function bridgeOutbound(params: OutboundParams): Promise<BridgeProgress> {
  const { toChain, recipientAddress, amount, senderWalletId } = params;

  const fromAdapter = circleWalletsAdapter();
  const toAdapter = platformArcAdapter(); // used for polling Arc side

  const kit = new AppKit();

  const result = await kit.bridge({
    from: {
      adapter: fromAdapter,
      chain: BridgeChain.Arc_Testnet,
      address: senderWalletId, // Circle wallet ID as the address identifier
    },
    to: {
      adapter: toAdapter,
      chain: toChain,
      recipientAddress,
      useForwarder: true,
    },
    amount,
  });

  return {
    step: "done",
    steps: (result.steps ?? []).map((s: any) => ({
      name: s.name,
      state: s.state,
      explorerUrl: s.explorerUrl,
      errorMessage: s.errorMessage,
    })),
  };
}