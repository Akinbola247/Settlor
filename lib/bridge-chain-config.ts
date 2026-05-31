import type { SupportedChainId } from "@/app/lib/bridge.types";

/** Circle CCTP USDC on each source testnet (6 decimals). */
export const BRIDGE_USDC_ADDRESS: Partial<Record<SupportedChainId, `0x${string}`>> = {
  Arc_Testnet: "0x3600000000000000000000000000000000000000",
  Ethereum_Sepolia: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  Base_Sepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  Arbitrum_Sepolia: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  Avalanche_Fuji: "0x5425890298aed601595a70AB815c96711a31Bc65",
};

/** MetaMask `wallet_addEthereumChain` params when the network is missing. */
export const METAMASK_ADD_CHAIN: Partial<
  Record<SupportedChainId, Record<string, unknown>>
> = {
  Ethereum_Sepolia: {
    chainId: "0xaa36a7",
    chainName: "Sepolia",
    nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia.drpc.org"],
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
  },
  Base_Sepolia: {
    chainId: "0x14a34",
    chainName: "Base Sepolia",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorerUrls: ["https://sepolia.basescan.org"],
  },
  Arbitrum_Sepolia: {
    chainId: "0x66eee",
    chainName: "Arbitrum Sepolia",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
    blockExplorerUrls: ["https://sepolia.arbiscan.io"],
  },
  Avalanche_Fuji: {
    chainId: "0xa869",
    chainName: "Avalanche Fuji",
    nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
    rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
    blockExplorerUrls: ["https://testnet.snowtrace.io"],
  },
  Arc_Testnet: {
    chainId: "0x4cef52",
    chainName: "Arc Testnet",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
    rpcUrls: ["https://rpc.testnet.arc.network"],
    blockExplorerUrls: ["https://testnet.arcscan.app"],
  },
};
