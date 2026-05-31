import { isSolanaAddress } from "@/lib/address-utils";
import { CIRCLE_SOLANA_BLOCKCHAIN } from "@/lib/solana-config";

export type CircleWalletRecord = {
  id: string;
  address: string;
  blockchain: string;
};

export function isSettlementBlockchain(blockchain: string): boolean {
  const normalized = blockchain.trim().toUpperCase();
  return (
    normalized === CIRCLE_SOLANA_BLOCKCHAIN ||
    normalized === "SOL" ||
    normalized === "SOL-DEVNET"
  );
}

/** Prefer the Circle wallet on the configured Solana cluster. */
export function pickSettlementWallet(
  wallets: CircleWalletRecord[]
): CircleWalletRecord | null {
  const solanaByAddress = wallets.filter((wallet) => isSolanaAddress(wallet.address));
  const solanaWallets =
    solanaByAddress.length > 0
      ? solanaByAddress
      : wallets.filter((wallet) => isSettlementBlockchain(wallet.blockchain));

  if (!solanaWallets.length) return null;

  const exact = solanaWallets.find(
    (wallet) => wallet.blockchain === CIRCLE_SOLANA_BLOCKCHAIN
  );
  return exact ?? solanaWallets[0] ?? null;
}

export function findWalletById(
  wallets: CircleWalletRecord[],
  walletId: string
): CircleWalletRecord | null {
  return wallets.find((wallet) => wallet.id === walletId) ?? null;
}
