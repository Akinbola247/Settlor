/**
 * bridge.types.ts
 * Safe to import in client components — no Node.js deps, no Circle server SDK.
 */

import { SETTLEMENT_CHAIN_ID } from "@/lib/solana-config";

export type SupportedChainId =
  | "Arc_Testnet"
  | "Ethereum_Sepolia"
  | "Base_Sepolia"
  | "Arbitrum_Sepolia"
  | "Avalanche_Fuji"
  | "Solana_Devnet"
  | "Ethereum"
  | "Base"
  | "Arbitrum"
  | "Avalanche"
  | "Polygon"
  | "Solana";

export interface SupportedChain {
  id: SupportedChainId;
  name: string;
  logo: string;
  isTestnet: boolean;
  type: "evm" | "solana";
}

export const SUPPORTED_CHAINS: SupportedChain[] = [
  { id: "Solana_Devnet", name: "Solana Devnet", logo: "◎", isTestnet: true, type: "solana" },
  { id: "Arc_Testnet", name: "Arc Testnet", logo: "⟁", isTestnet: true, type: "evm" },
  { id: "Ethereum_Sepolia", name: "Ethereum Sepolia", logo: "⟠", isTestnet: true, type: "evm" },
  { id: "Base_Sepolia", name: "Base Sepolia", logo: "🔵", isTestnet: true, type: "evm" },
  { id: "Arbitrum_Sepolia", name: "Arbitrum Sepolia", logo: "🔷", isTestnet: true, type: "evm" },
  { id: "Avalanche_Fuji", name: "Avalanche Fuji", logo: "🔺", isTestnet: true, type: "evm" },
  { id: "Ethereum", name: "Ethereum", logo: "⟠", isTestnet: false, type: "evm" },
  { id: "Base", name: "Base", logo: "🔵", isTestnet: false, type: "evm" },
  { id: "Arbitrum", name: "Arbitrum", logo: "🔷", isTestnet: false, type: "evm" },
  { id: "Avalanche", name: "Avalanche", logo: "🔺", isTestnet: false, type: "evm" },
  { id: "Polygon", name: "Polygon", logo: "🟣", isTestnet: false, type: "evm" },
  { id: "Solana", name: "Solana", logo: "◎", isTestnet: false, type: "solana" },
];

export const SETTLEMENT_CHAIN = SETTLEMENT_CHAIN_ID as SupportedChainId;

const SETTLEMENT_IDS: SupportedChainId[] = ["Solana_Devnet", "Solana"];

function isSettlementChain(id: SupportedChainId): boolean {
  return SETTLEMENT_IDS.includes(id);
}

/** EVM + Arc testnets — bridge USDC into your Solana balance (not from Solana). */
export function depositSourceChains(): SupportedChain[] {
  return SUPPORTED_CHAINS.filter((c) => c.isTestnet && !isSettlementChain(c.id));
}

/** @deprecated Use depositSourceChains */
export const bridgeSourceChains = depositSourceChains;

/** EVM testnets (incl. Arc) — withdraw from Solana balance via CCTP. */
export function withdrawDestinationChains(): SupportedChain[] {
  return SUPPORTED_CHAINS.filter((c) => c.isTestnet && c.type === "evm");
}

/** External wallet invoice pay — EVM CCTP sources plus direct Solana (Phantom). */
export function externalWalletPayChains(): SupportedChain[] {
  const settlement = SUPPORTED_CHAINS.find((c) => c.id === SETTLEMENT_CHAIN);
  return settlement ? [...depositSourceChains(), settlement] : depositSourceChains();
}

export type BridgeStepState = "pending" | "active" | "success" | "error" | "noop";

export interface BridgeStep {
  name: string;
  state: BridgeStepState | "pending" | "success" | "error" | "noop";
  explorerUrl?: string;
  errorMessage?: string;
}

export interface BridgeProgress {
  step: string;
  steps: BridgeStep[];
  error?: string;
}

export const STEP_ORDER = ["approve", "burn", "attestation", "mint"] as const;
export type BridgeStepId = (typeof STEP_ORDER)[number];

export const STEP_LABELS: Record<string, string> = {
  approve: "Approve",
  burn: "Send",
  attestation: "Confirming",
  mint: "Receive",
};

export function userFacingStepTitle(stepName: string): string {
  return STEP_LABELS[stepName] ?? stepName.replace(/_/g, " ");
}

export const STEP_USER_GUIDE: Record<
  BridgeStepId,
  { title: string; description: string; signHint: string; requiresWallet: boolean }
> = {
  approve: {
    title: "Approve USDC",
    description: "Allow the transfer from your wallet.",
    signHint: "Confirm the approval in your wallet.",
    requiresWallet: true,
  },
  burn: {
    title: "Send USDC",
    description: "USDC leaves the network you selected and settles on Solana.",
    signHint: "Confirm the transfer in your wallet.",
    requiresWallet: true,
  },
  attestation: {
    title: "Confirming",
    description: "Usually takes 1–2 minutes. No action needed.",
    signHint: "Keep this tab open.",
    requiresWallet: false,
  },
  mint: {
    title: "Receive",
    description: "USDC is added to your Solana balance.",
    signHint: "Confirm in your wallet if prompted.",
    requiresWallet: true,
  },
};

export type PreBridgePhase = "connect" | "switch_chain" | "ready";

export const PRE_BRIDGE_GUIDE: Record<
  PreBridgePhase,
  { title: string; description: string; actionLabel: string }
> = {
  connect: {
    title: "Connect wallet",
    description: "Link the wallet that holds your USDC.",
    actionLabel: "Connect",
  },
  switch_chain: {
    title: "Switch network",
    description: "Use the same network you selected below.",
    actionLabel: "Switch network",
  },
  ready: {
    title: "Ready",
    description: "Confirm the deposit when you're ready.",
    actionLabel: "Deposit",
  },
};
