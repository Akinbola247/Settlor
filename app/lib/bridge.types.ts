/**
 * bridge.types.ts
 * Safe to import in client components — no Node.js deps, no Circle server SDK.
 * Only types and static data live here.
 */

// BridgeChain values we expose to the UI (string literals matching the enum)
export type SupportedChainId =
  | "Ethereum_Sepolia" | "Base_Sepolia" | "Arbitrum_Sepolia"
  | "Avalanche_Fuji"   | "Solana_Devnet"
  | "Ethereum"         | "Base"         | "Arbitrum"
  | "Avalanche"        | "Polygon"      | "Solana";

export interface SupportedChain {
  id: SupportedChainId;
  name: string;
  logo: string;
  isTestnet: boolean;
  type: "evm" | "solana";
}

export const SUPPORTED_CHAINS: SupportedChain[] = [
  { id: "Ethereum_Sepolia", name: "Ethereum Sepolia", logo: "⟠",  isTestnet: true,  type: "evm"    },
  { id: "Base_Sepolia",     name: "Base Sepolia",     logo: "🔵", isTestnet: true,  type: "evm"    },
  { id: "Arbitrum_Sepolia", name: "Arbitrum Sepolia", logo: "🔷", isTestnet: true,  type: "evm"    },
  { id: "Avalanche_Fuji",   name: "Avalanche Fuji",   logo: "🔺", isTestnet: true,  type: "evm"    },
  { id: "Solana_Devnet",    name: "Solana Devnet",    logo: "◎",  isTestnet: true,  type: "solana" },
  { id: "Ethereum",         name: "Ethereum",         logo: "⟠",  isTestnet: false, type: "evm"    },
  { id: "Base",             name: "Base",             logo: "🔵", isTestnet: false, type: "evm"    },
  { id: "Arbitrum",         name: "Arbitrum",         logo: "🔷", isTestnet: false, type: "evm"    },
  { id: "Avalanche",        name: "Avalanche",        logo: "🔺", isTestnet: false, type: "evm"    },
  { id: "Polygon",          name: "Polygon",          logo: "🟣", isTestnet: false, type: "evm"    },
  { id: "Solana",           name: "Solana",           logo: "◎",  isTestnet: false, type: "solana" },
];

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

export const STEP_ORDER = ["approve", "burn", "attestation", "mint"] as const;

export const STEP_LABELS: Record<string, string> = {
  approve:     "Approving token spend",
  burn:        "Burning USDC on source chain",
  attestation: "Waiting for Circle attestation (~2 min)",
  mint:        "Minting USDC on Arc",
};