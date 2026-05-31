/**
 * Server-side CCTP helpers (optional / legacy).
 * Live app uses client-side App Kit bridging; /api/bridge returns 410.
 */

import { AppKit, BridgeChain } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import type { SupportedChainId } from "@/app/lib/bridge.types";

function platformEvmAdapter() {
  const key = process.env.PLATFORM_EVM_PRIVATE_KEY;
  if (!key) throw new Error("PLATFORM_EVM_PRIVATE_KEY not set");
  return createViemAdapterFromPrivateKey({ privateKey: key });
}

export type InboundBridgeParams = {
  fromChain: SupportedChainId;
  recipientSolanaAddress: string;
  amount: string;
  senderEvmPrivateKey?: string;
  senderSolanaPrivateKey?: string;
};

export async function runInboundBridgeServer(params: InboundBridgeParams) {
  const { fromChain, recipientSolanaAddress, amount, senderEvmPrivateKey, senderSolanaPrivateKey } =
    params;
  const isSolana = fromChain === "Solana" || fromChain === "Solana_Devnet";

  let fromAdapter;
  if (isSolana) {
    const { createSolanaKitAdapterFromPrivateKey } = await import("@circle-fin/adapter-solana-kit");
    if (!senderSolanaPrivateKey) throw new Error("Solana private key required");
    fromAdapter = createSolanaKitAdapterFromPrivateKey({ privateKey: senderSolanaPrivateKey });
  } else {
    if (!senderEvmPrivateKey) throw new Error("EVM private key required");
    fromAdapter = createViemAdapterFromPrivateKey({ privateKey: senderEvmPrivateKey });
  }

  const kit = new AppKit();
  if (isSolana) {
    throw new Error("Inbound server bridge expects an EVM source chain");
  }

  const { createSolanaKitAdapterFromPrivateKey } = await import("@circle-fin/adapter-solana-kit");
  const solKey = process.env.PLATFORM_SOL_PRIVATE_KEY;
  if (!solKey) throw new Error("PLATFORM_SOL_PRIVATE_KEY required for EVM→Solana server bridge");
  const toAdapter = createSolanaKitAdapterFromPrivateKey({ privateKey: solKey });

  return kit.bridge({
    from: { adapter: fromAdapter, chain: fromChain as BridgeChain },
    to: {
      adapter: toAdapter,
      chain: BridgeChain.Solana_Devnet,
      address: recipientSolanaAddress,
      recipientAddress: recipientSolanaAddress,
    },
    amount,
  });
}

export type OutboundBridgeParams = {
  toChain: SupportedChainId;
  recipientAddress: string;
  amount: string;
  senderSolanaAddress: string;
};

export async function runOutboundBridgeServer(params: OutboundBridgeParams) {
  const { toChain, recipientAddress, amount, senderSolanaAddress } = params;
  const kit = new AppKit();
  return kit.bridge({
    from: {
      adapter: platformEvmAdapter(),
      chain: BridgeChain.Solana_Devnet,
      address: senderSolanaAddress,
    },
    to: { chain: toChain as BridgeChain, recipientAddress, useForwarder: true },
    amount,
  });
}
