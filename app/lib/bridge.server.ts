/**
 * bridge.server.ts  ← SERVER ONLY. Never import this in a Client Component.
 *
 * Contains all Circle SDK imports that pull in Node.js built-ins (fs, crypto, etc.).
 * Client components must talk to this code exclusively through API routes.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { AppKit, BridgeChain } from "@circle-fin/app-kit";
import { createCircleWalletsAdapter } from "@circle-fin/adapter-circle-wallets";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import type { BridgeProgress, BridgeStep } from "./bridge.types";

// ─── Platform adapter ─────────────────────────────────────────────────────────
// A platform-owned EVM wallet used ONLY to poll for mint confirmation on Arc.
// This wallet needs no funds — it just watches transactions.

function platformArcAdapter() {
  const pk = process.env.PLATFORM_EVM_PRIVATE_KEY;
  if (!pk) throw new Error("PLATFORM_EVM_PRIVATE_KEY not set");
  return createViemAdapterFromPrivateKey({ privateKey: pk as `0x${string}` });
}

// ─── Circle Wallets adapter ───────────────────────────────────────────────────
// Used for outbound transfers: logged-in user's Circle (Arc) wallet → external chain

function circleWalletsAdapter() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret) throw new Error("CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET not set");
  return createCircleWalletsAdapter({ apiKey, entitySecret });
}

// ─── INBOUND: any chain → Arc recipient ───────────────────────────────────────

export interface InboundParams {
  fromChain: BridgeChain;
  recipientArcAddress: string;
  amount: string;
  senderEvmPrivateKey?: string;
  senderSolanaPrivateKey?: string;
}

export async function bridgeInbound(params: InboundParams): Promise<BridgeProgress> {
  const { fromChain, recipientArcAddress, amount, senderEvmPrivateKey, senderSolanaPrivateKey } = params;
  const isSolana = fromChain === BridgeChain.Solana || fromChain === BridgeChain.Solana_Devnet;

  let fromAdapter: any;
  if (isSolana) {
    const { createSolanaKitAdapterFromPrivateKey } = await import("@circle-fin/adapter-solana-kit");
    if (!senderSolanaPrivateKey) throw new Error("Solana private key required");
    fromAdapter = createSolanaKitAdapterFromPrivateKey({ privateKey: senderSolanaPrivateKey });
  } else {
    if (!senderEvmPrivateKey) throw new Error("EVM private key required for source chain");
    fromAdapter = createViemAdapterFromPrivateKey({ privateKey: senderEvmPrivateKey as `0x${string}` });
  }

  const kit = new AppKit();

  const result = await kit.bridge({
    from: { adapter: fromAdapter, chain: fromChain },
    to: {
      adapter: platformArcAdapter(),
      chain: BridgeChain.Arc_Testnet,
      recipientAddress: recipientArcAddress,
      useForwarder: true,
    },
    amount,
  });

  return {
    step: "done",
    steps: (result.steps ?? []).map((s: any): BridgeStep => ({
      name: s.name, state: s.state,
      explorerUrl: s.explorerUrl, errorMessage: s.errorMessage,
    })),
  };
}

// ─── OUTBOUND: Arc → external chain ───────────────────────────────────────────

export interface OutboundParams {
  toChain: BridgeChain;
  recipientAddress: string;
  amount: string;
  senderWalletId: string; // Circle wallet ID of the logged-in user
}

export async function bridgeOutbound(params: OutboundParams): Promise<BridgeProgress> {
  const { toChain, recipientAddress, amount, senderWalletId } = params;

  const kit = new AppKit();

  const result = await kit.bridge({
    from: {
      adapter: circleWalletsAdapter(),
      chain: BridgeChain.Arc_Testnet,
      address: senderWalletId,
    },
    to: {
      adapter: platformArcAdapter(),
      chain: toChain,
      recipientAddress,
      useForwarder: true,
    },
    amount,
  });

  return {
    step: "done",
    steps: (result.steps ?? []).map((s: any): BridgeStep => ({
      name: s.name, state: s.state,
      explorerUrl: s.explorerUrl, errorMessage: s.errorMessage,
    })),
  };
}