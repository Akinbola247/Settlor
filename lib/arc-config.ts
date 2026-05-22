/** Arc Testnet network + USDC (client-safe constants). */
export const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARC_TESTNET_CHAIN_ID_HEX = "0x4cef52";
export const ARC_TESTNET_RPC = "https://rpc.testnet.arc.network";
export const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;
export const ARC_BLOCK_EXPLORER = "https://testnet.arcscan.app";

export function arcTxExplorerUrl(txHash: string): string {
  return `${ARC_BLOCK_EXPLORER}/tx/${txHash}`;
}

export const ARC_TESTNET_METAMASK_PARAMS = {
  chainId: ARC_TESTNET_CHAIN_ID_HEX,
  chainName: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: [ARC_TESTNET_RPC],
  blockExplorerUrls: [ARC_BLOCK_EXPLORER],
};
