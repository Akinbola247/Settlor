/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupportedChainId } from "@/app/lib/bridge.types";
import { SUPPORTED_CHAINS } from "@/app/lib/bridge.types";
import {
  SETTLEMENT_CHAIN_ID,
  SETTLEMENT_CHAIN_LABEL,
  USDC_DECIMALS,
  USDC_MINT,
  solanaExplorerTxUrl,
} from "@/lib/solana-config";
import { BRIDGE_USDC_ADDRESS, METAMASK_ADD_CHAIN } from "@/lib/bridge-chain-config";
import {
  createBridgeHttpTransport,
  createBridgePublicClient,
  rpcUrlForBridgeChain,
  wrapWalletProviderForL2Gas,
} from "@/lib/evm-gas-buffer";

/** Minimum native balance (ETH/AVAX) to attempt a CCTP approve + burn. */
const MIN_NATIVE_GAS_ETH = 0.0005;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

const CHAIN_IDS: Partial<Record<SupportedChainId, string>> = {
  Arc_Testnet: "0x4cef52",
  Ethereum_Sepolia: "0xaa36a7",
  Base_Sepolia: "0x14a34",
  Arbitrum_Sepolia: "0x66eee",
  Avalanche_Fuji: "0xa869",
  Ethereum: "0x1",
  Base: "0x2105",
  Arbitrum: "0xa4b1",
  Avalanche: "0xa86a",
  Polygon: "0x89",
};

export type LiveBridgeStep = {
  name: string;
  state: string;
  explorerUrl?: string;
  errorMessage?: string;
};

export function getMetaMaskProvider(): any {
  if (typeof window === "undefined") return null;
  const w = window as any;
  const eth = w.ethereum;
  if (!eth) return null;

  const providers: any[] | undefined = eth.providers;
  if (Array.isArray(providers) && providers.length > 0) {
    const metamask = providers.find((p) => p?.isMetaMask && !p?.isPhantom);
    if (metamask) return metamask;
  }

  if (eth.isMetaMask && !eth.isPhantom) return eth;
  if (eth.isMetaMask) return eth;
  if (!eth.isPhantom) return eth;

  return null;
}

/** @deprecated Prefer getMetaMaskProvider — Phantom can hijack window.ethereum. */
export function getEthereumProvider(): any {
  return getMetaMaskProvider();
}

export function chainName(chainId: SupportedChainId): string {
  return SUPPORTED_CHAINS.find((c) => c.id === chainId)?.name ?? chainId;
}

/** Connect MetaMask and return selected accounts */
export async function connectWallet(): Promise<{ accounts: string[]; provider: any }> {
  const eth = getMetaMaskProvider();
  if (!eth) {
    throw new Error(
      "MetaMask not detected. Install the MetaMask browser extension (disable Phantom as default EVM wallet if both are installed), then refresh."
    );
  }
  const accounts: string[] = await withTimeout(
    eth.request({ method: "eth_requestAccounts" }),
    30_000,
    "MetaMask did not respond. Unlock the extension and try again."
  );
  if (!accounts?.length) {
    throw new Error("No accounts returned. Unlock MetaMask and try connecting again.");
  }
  return { accounts, provider: eth };
}

/**
 * Address MetaMask will actually sign with (matches Circle adapter).
 * Refreshes account selection — eth_accounts alone can disagree with the active account.
 */
export async function resolveSigningWalletAddress(
  provider: any,
  fromChain: SupportedChainId
): Promise<string> {
  await withTimeout(
    provider.request({ method: "eth_requestAccounts" }),
    30_000,
    "MetaMask did not respond. Unlock the extension and try again."
  );

  const { createViemAdapterFromProvider, resolveChainIdentifier } = await import(
    "@circle-fin/adapter-viem-v2"
  );
  const adapter = await createViemAdapterFromProvider({
    provider,
    getPublicClient: ({ chain }) => createBridgePublicClient(chain, fromChain),
  });

  return adapter.getAddress(resolveChainIdentifier(fromChain) as any);
}

/** Switch wallet to the source chain for bridging */
export async function switchWalletChain(
  provider: any,
  fromChain: SupportedChainId
): Promise<void> {
  const targetChainId = CHAIN_IDS[fromChain];
  if (!targetChainId) return;

  const current: string = await provider.request({ method: "eth_chainId" });
  if (current === targetChainId) return;

  const name = chainName(fromChain);
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetChainId }],
    });
  } catch (switchErr: any) {
    if (switchErr?.code === 4902) {
      const addParams = METAMASK_ADD_CHAIN[fromChain];
      if (!addParams) {
        throw new Error(`Add ${name} to MetaMask (Networks), then try again.`);
      }
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [addParams],
      });
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetChainId }],
      });
    }
    if (switchErr?.code === 4001) {
      throw new Error("Network switch cancelled. Approve the switch in MetaMask to continue.");
    }
    throw switchErr;
  }

  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const confirmed = await provider.request({ method: "eth_chainId" });
    if (confirmed === targetChainId) return;
  }
  throw new Error(`Still not on ${name}. Switch network manually in MetaMask.`);
}

const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

/** Read USDC balance on a bridge source chain (6 decimals). */
export async function readWalletUsdcOnChain(
  fromChain: SupportedChainId,
  walletAddress: string
): Promise<number> {
  const token = BRIDGE_USDC_ADDRESS[fromChain];
  const rpc = rpcUrlForBridgeChain(fromChain);
  if (!token) throw new Error(`USDC not configured for ${fromChain}`);

  const { createPublicClient, defineChain, formatUnits } = await import("viem");
  const chainIdHex = CHAIN_IDS[fromChain];
  if (!chainIdHex) throw new Error(`Unknown chain: ${fromChain}`);

  const chain = defineChain({
    id: parseInt(chainIdHex, 16),
    name: chainName(fromChain),
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });

  const client = createPublicClient({ chain, transport: createBridgeHttpTransport(rpc) });
  const raw = await withTimeout(
    client.readContract({
      address: token,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [walletAddress as `0x${string}`],
    }),
    12_000,
    `Could not read USDC balance on ${chainName(fromChain)}. Check your network and try again.`
  );
  return parseFloat(formatUnits(raw, 6));
}

/** Read native gas token balance (18 decimals) on a bridge source chain. */
export async function readNativeBalanceOnChain(
  fromChain: SupportedChainId,
  walletAddress: string
): Promise<number> {
  const rpc = rpcUrlForBridgeChain(fromChain);
  const chainIdHex = CHAIN_IDS[fromChain];
  if (!chainIdHex) throw new Error(`Unknown chain: ${fromChain}`);

  const { createPublicClient, defineChain, formatEther } = await import("viem");
  const chain = defineChain({
    id: parseInt(chainIdHex, 16),
    name: chainName(fromChain),
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });

  const client = createPublicClient({ chain, transport: createBridgeHttpTransport(rpc) });
  const raw = await withTimeout(
    client.getBalance({ address: walletAddress as `0x${string}` }),
    12_000,
    `Could not read gas balance on ${chainName(fromChain)}.`
  );
  return parseFloat(formatEther(raw));
}

/** Who signs the Solana CCTP mint (Solana Devnet does not support forwarder on destination). */
export type InboundSolanaMintSigner =
  | {
      kind: "circle-w3s";
      walletId: string;
      solanaAddress: string;
      sdkRef: { current: import("@circle-fin/w3s-pw-web-sdk").W3SSdk | null };
    }
  | { kind: "platform"; sponsorAddress: string }
  | { kind: "phantom" };

export type RunInboundBridgeParams = {
  fromChain: SupportedChainId;
  /** Vendor Circle Solana wallet (base58). */
  recipientSolanaAddress: string;
  amount: string;
  /** When set, skips a second wallet connect (deposit prepare flow). */
  walletProvider?: any;
  /** Defaults to Phantom (invoice pay). Use circle-w3s for dashboard deposit. */
  mintSigner?: InboundSolanaMintSigner;
  onStepUpdate: (steps: LiveBridgeStep[], activeStep?: string) => void;
  onStatusMessage?: (message: string) => void;
};

async function createInboundSolanaMintAdapter(
  mintSigner: InboundSolanaMintSigner,
  onStatusMessage?: (message: string) => void
): Promise<{ adapter: any; address: string }> {
  const { createSolanaKitAdapterFromProvider } = await import("@circle-fin/adapter-solana-kit");
  const { createSolanaRpc } = await import("@solana/kit");
  const { solanaRpcUrl } = await import("@/lib/solana-config");

  if (mintSigner.kind === "circle-w3s") {
    const { createW3sSolanaKitAdapter } = await import("@/lib/w3s-solana-kit-signer");
    onStatusMessage?.("Preparing Solana mint (Circle)…");
    const adapter = await createW3sSolanaKitAdapter({
      solanaAddress: mintSigner.solanaAddress,
      walletId: mintSigner.walletId,
      sdkRef: mintSigner.sdkRef,
    });
    return { adapter, address: mintSigner.solanaAddress };
  }

  if (mintSigner.kind === "platform") {
    const { createPlatformSolanaKitAdapter } = await import("@/lib/platform-solana-kit-signer");
    onStatusMessage?.("Preparing Solana mint…");
    const adapter = await createPlatformSolanaKitAdapter(mintSigner.sponsorAddress);
    return { adapter, address: mintSigner.sponsorAddress };
  }

  const phantom = getPhantomProvider();
  if (!phantom) {
    throw new Error(
      "Phantom is required to complete the Solana mint step. Install Phantom, or pay on Solana Devnet directly."
    );
  }
  onStatusMessage?.("Connecting Phantom for Solana mint…");
  const connectRes = await phantom.connect();
  const addr = connectRes?.publicKey?.toString?.() ?? phantom.publicKey?.toString?.();
  if (!addr) throw new Error("Could not read Phantom address.");

  const adapter = await createSolanaKitAdapterFromProvider({
    provider: phantom,
    getRpc: () => createSolanaRpc(solanaRpcUrl()),
  });
  return { adapter, address: addr };
}

/** Run CCTP bridge from MetaMask source chain → Solana settlement */
function formatBridgeError(
  message: string,
  fromChain: SupportedChainId,
  amount: string,
  nativeEth?: number
): string {
  const looksLikeUsdcShortfall =
    /Insufficient (token|USDC) balance/i.test(message) ||
    (/insufficient funds/i.test(message) && !/gas/i.test(message));

  if (
    looksLikeUsdcShortfall &&
    nativeEth != null &&
    nativeEth < MIN_NATIVE_GAS_ETH
  ) {
    const gasLabel = fromChain === "Avalanche_Fuji" ? "AVAX" : "ETH";
    return (
      `Your wallet shows USDC on ${chainName(fromChain)}, but you likely need ${gasLabel} for network fees ` +
      `(about ${nativeEth.toFixed(6)} ${gasLabel} detected). ` +
      `Add a small amount of testnet ${gasLabel} from a faucet, then try depositing $${amount} again.`
    );
  }

  if (looksLikeUsdcShortfall) {
    return (
      `Circle could not use enough USDC on ${chainName(fromChain)} for $${amount}. ` +
      `In MetaMask, select the account that holds your USDC on ${chainName(fromChain)} (not just the first connected account), ` +
      `then click Connect wallet again and retry.`
    );
  }
  if (/Insufficient gas/i.test(message)) {
    return `You need a small amount of ETH (or native gas token) on ${chainName(fromChain)} to pay network fees, in addition to your USDC.`;
  }
  if (/does not support forwarding/i.test(message)) {
    return `This route cannot use automatic relay to ${SETTLEMENT_CHAIN_LABEL}. Refresh the page and try again — you should be prompted to sign the Solana mint with Circle or Phantom.`;
  }
  if (/fee payer|Failed to create ATA/i.test(message)) {
    if (message.includes("PLATFORM_SOL_PRIVATE_KEY")) return message;
    return (
      `Solana USDC account setup failed. Ensure PLATFORM_SOL_PRIVATE_KEY is set and funded with devnet SOL, ` +
      `refresh the dashboard, then retry. (${message})`
    );
  }
  if (/API parameter invalid/i.test(message)) {
    return (
      "Circle rejected the Solana mint transaction. Confirm SOL-DEVNET is enabled in Circle Console, " +
      "ensure your wallet has SOL for fees, then retry. If it persists, sign out and sign in again."
    );
  }
  if (/fee payer|does not match your Circle wallet/i.test(message)) {
    return message;
  }
  if (/Transaction is \d+ bytes/i.test(message)) {
    return message;
  }
  return message;
}

export async function runInboundBridge(params: RunInboundBridgeParams): Promise<LiveBridgeStep[]> {
  const {
    fromChain,
    recipientSolanaAddress,
    amount,
    walletProvider: existingProvider,
    mintSigner = { kind: "phantom" },
    onStepUpdate,
    onStatusMessage,
  } = params;
  const settlementAddress = recipientSolanaAddress;
  if (!settlementAddress) {
    throw new Error("Missing recipient Solana address.");
  }

  let nativeEth: number | undefined;

  try {
  const amountNum = parseFloat(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new Error("Enter a valid deposit amount.");
  }

  onStatusMessage?.(existingProvider ? "Preparing deposit…" : "Connecting wallet…");
  const walletProvider = existingProvider ?? (await connectWallet()).provider;

  onStatusMessage?.(`Switching to ${chainName(fromChain)}…`);
  await switchWalletChain(walletProvider, fromChain);

  onStatusMessage?.("Checking balances…");

  const { createViemAdapterFromProvider, resolveChainIdentifier } = await import(
    "@circle-fin/adapter-viem-v2"
  );
  const { AppKit } = await import("@circle-fin/app-kit");

  const bridgeProvider = wrapWalletProviderForL2Gas(walletProvider, fromChain);

  const fromAdapter = await createViemAdapterFromProvider({
    provider: bridgeProvider as any,
    getPublicClient: ({ chain }) => createBridgePublicClient(chain, fromChain),
  });

  const walletAddress = await fromAdapter.getAddress(resolveChainIdentifier(fromChain) as any);

  const [walletUsdc, nativeBal] = await Promise.all([
    readWalletUsdcOnChain(fromChain, walletAddress),
    readNativeBalanceOnChain(fromChain, walletAddress),
  ]);

  if (walletUsdc + 1e-6 < amountNum) {
    throw new Error(
      `The signing account ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)} has about $${walletUsdc.toFixed(2)} USDC on ${chainName(fromChain)}, but you tried $${amountNum.toFixed(2)}. ` +
        `Select the MetaMask account that holds USDC on this network, reconnect, and retry.`
    );
  }

  nativeEth = nativeBal;

  if (nativeEth < MIN_NATIVE_GAS_ETH) {
    const gasLabel = fromChain === "Avalanche_Fuji" ? "AVAX" : "ETH";
    throw new Error(
      `You need a small amount of testnet ${gasLabel} on ${chainName(fromChain)} to pay network fees (detected ~${nativeEth.toFixed(6)} ${gasLabel}). ` +
        `USDC alone is not enough — get ${gasLabel} from a testnet faucet, then retry.`
    );
  }

  onStatusMessage?.("Confirm in MetaMask when prompted…");

  if (mintSigner.kind === "circle-w3s" || mintSigner.kind === "platform") {
    onStatusMessage?.("Preparing USDC account on Solana…");
    try {
      const ataRes = await fetch("/api/solana/ensure-payment-ata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: settlementAddress }),
      });
      const ataBody = await ataRes.json().catch(() => ({}));
      if (!ataRes.ok) {
        throw new Error(String(ataBody.error ?? "Could not prepare USDC account"));
      }
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not prepare USDC account";
      throw new Error(msg);
    }
  }

  if (mintSigner.kind === "circle-w3s") {
    onStatusMessage?.("Checking Solana gas balance…");
    try {
      await fetch("/api/solana/gas-sponsor", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: settlementAddress }),
      });
    } catch {
      /* non-fatal */
    }
  }

  const { adapter: toAdapter, address: solanaMintSignerAddress } =
    await createInboundSolanaMintAdapter(mintSigner, onStatusMessage);

  const collected: LiveBridgeStep[] = [];

  const pushSteps = (active?: string) => {
    onStepUpdate([...collected], active);
  };

  const kit = new AppKit();

  const mintWalletLabel =
    mintSigner.kind === "circle-w3s"
      ? "Circle"
      : mintSigner.kind === "platform"
        ? "Settlor"
        : "Phantom";

  kit.on("*", (payload: any) => {
    const name = payload?.method?.replace("bridge.", "") ?? "unknown";
    const state = payload?.values?.state ?? "pending";
    const s: LiveBridgeStep = {
      name,
      state,
      explorerUrl: payload?.values?.explorerUrl,
      errorMessage: payload?.values?.errorMessage,
    };
    const idx = collected.findIndex((x) => x.name === name);
    if (idx >= 0) collected[idx] = s;
    else collected.push(s);

    if (state === "pending" || state === "active") {
      onStatusMessage?.(
        name === "approve" || name === "burn"
          ? "Confirm in MetaMask…"
          : name === "mint"
            ? `Confirm Solana mint in ${mintWalletLabel}…`
            : `Step: ${name}`
      );
    }
    pushSteps(state === "pending" ? name : undefined);
  });

  // Solana Devnet: destination forwarder is unsupported — mint is signed via Solana adapter.
  const result = await kit.bridge({
    from: { adapter: fromAdapter, chain: fromChain as any },
    to: {
      adapter: toAdapter,
      chain: SETTLEMENT_CHAIN_ID as any,
      address: solanaMintSignerAddress,
      recipientAddress: settlementAddress,
    },
    amount,
  });

  const finalSteps: LiveBridgeStep[] = (result.steps ?? []).map((s: any) => ({
    name: s.name,
    state: s.state,
    explorerUrl: s.explorerUrl,
    errorMessage: s.errorMessage,
  }));

  onStepUpdate(finalSteps);
  onStatusMessage?.("Bridge complete");

  const failed = finalSteps.find((s) => s.state === "error");
  if (failed) {
    throw new Error(
      formatBridgeError(
        failed.errorMessage ?? `Bridge failed at step: ${failed.name}`,
        fromChain,
        amount,
        nativeEth
      )
    );
  }

  return finalSteps;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Deposit failed";
    if (
      msg.includes("Lower the amount") ||
      msg.includes("Enter a valid") ||
      msg.includes("testnet ETH") ||
      msg.includes("testnet AVAX") ||
      msg.includes("network fees")
    ) {
      throw err instanceof Error ? err : new Error(msg);
    }
    throw new Error(formatBridgeError(msg, fromChain, amount, nativeEth));
  }
}

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

function getPhantomProvider(): any {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.phantom?.solana ?? w.solana ?? null;
}

export function hasPhantomWallet(): boolean {
  return !!getPhantomProvider();
}

/** SPL USDC transfer on Solana via Phantom (no CCTP). */
export async function runSolanaDirectTransfer(params: {
  recipientSolanaAddress: string;
  amount: string;
  onStatusMessage?: (message: string) => void;
}): Promise<LiveBridgeStep[]> {
  const { recipientSolanaAddress, amount, onStatusMessage } = params;
  const phantom = getPhantomProvider();
  if (!phantom) {
    throw new Error(
      "Phantom wallet not detected. Install Phantom, or pay from an EVM testnet via MetaMask."
    );
  }

  onStatusMessage?.("Connecting Phantom…");
  const connectRes = await phantom.connect();
  const payer = connectRes?.publicKey?.toString?.() ?? phantom.publicKey?.toString?.();
  if (!payer) throw new Error("Could not read Phantom address.");

  const {
    Connection,
    PublicKey,
    Transaction,
  } = await import("@solana/web3.js");
  const {
    createAssociatedTokenAccountInstruction,
    createTransferInstruction,
    getAssociatedTokenAddress,
  } = await import("@solana/spl-token");

  const { solanaRpcUrl } = await import("@/lib/solana-config");
  const connection = new Connection(solanaRpcUrl(), "confirmed");
  const mint = new PublicKey(USDC_MINT);
  const payerPk = new PublicKey(payer);
  const recipientPk = new PublicKey(recipientSolanaAddress);
  const amountNum = parseFloat(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new Error("Enter a valid amount.");
  }
  const rawAmount = BigInt(Math.round(amountNum * 10 ** USDC_DECIMALS));

  onStatusMessage?.("Preparing USDC transfer…");
  const fromAta = await getAssociatedTokenAddress(mint, payerPk);
  const fromInfo = await connection.getAccountInfo(fromAta);
  if (!fromInfo) {
    throw new Error(
      "No USDC in this Phantom wallet. Get devnet USDC from faucet.circle.com, then retry."
    );
  }

  const toAta = await getAssociatedTokenAddress(mint, recipientPk);
  const instructions = [];
  const toInfo = await connection.getAccountInfo(toAta);
  if (!toInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(payerPk, toAta, recipientPk, mint)
    );
  }
  instructions.push(createTransferInstruction(fromAta, toAta, payerPk, rawAmount));

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction({
    feePayer: payerPk,
    blockhash,
    lastValidBlockHeight,
  });
  for (const ix of instructions) tx.add(ix);

  onStatusMessage?.("Confirm in Phantom…");
  const signed = await phantom.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
  });
  await connection.confirmTransaction(signature, "confirmed");

  return [
    {
      name: "sol_transfer",
      state: "success",
      explorerUrl: solanaExplorerTxUrl(signature),
    },
  ];
}

export function isSolanaDirectChain(chain: SupportedChainId): boolean {
  return chain === "Solana_Devnet" || chain === "Solana";
}

export type RunOutboundBridgeParams = {
  toChain: SupportedChainId;
  recipientAddress: string;
  amount: string;
  solanaAddress: string;
  walletId: string;
  sdkRef: { current: import("@circle-fin/w3s-pw-web-sdk").W3SSdk | null };
  onStepUpdate: (steps: LiveBridgeStep[], activeStep?: string) => void;
  onStatusMessage?: (message: string) => void;
};

/** Minimum USDC for Solana → other chain (CCTP maxFee must be less than amount). */
export const MIN_CROSS_CHAIN_TRANSFER_USD = 3;

/** Use standard (SLOW) CCTP on smaller transfers to keep protocol maxFee below amount. */
const SLOW_TRANSFER_BELOW_USD = 10;

export function assertMinCrossChainTransferAmount(amount: string): void {
  const amountNum = parseFloat(amount);
  if (!Number.isFinite(amountNum) || amountNum < MIN_CROSS_CHAIN_TRANSFER_USD) {
    throw new Error(
      `Minimum cross-chain transfer is $${MIN_CROSS_CHAIN_TRANSFER_USD} USDC. ` +
        `Use ${SETTLEMENT_CHAIN_LABEL} for smaller payments.`
    );
  }
}

function sumBridgeProtocolFeesUsd(
  estimate: { fees: Array<{ type: string; amount: string | null }> }
): number {
  return estimate.fees.reduce((sum, f) => {
    if ((f.type === "provider" || f.type === "forwarder") && f.amount) {
      return sum + (parseFloat(f.amount) || 0);
    }
    return sum;
  }, 0);
}

function formatOutboundBridgeError(
  message: string,
  toChain: SupportedChainId,
  amount: string
): string {
  if (/max fee must be less than amount/i.test(message)) {
    return (
      `Amount too small to bridge $${amount} to ${chainName(toChain)}. ` +
      `Protocol fees must be less than the transfer amount. Try at least $${MIN_CROSS_CHAIN_TRANSFER_USD} USDC, or pay on ${SETTLEMENT_CHAIN_LABEL} for small amounts.`
    );
  }
  if (/Simulation failed/i.test(message)) {
    return message;
  }
  return message;
}

/**
 * Solana (Circle wallet) → external chain via CCTP.
 * Signs with Circle W3S + App Kit forwarder.
 */
export async function runOutboundBridge(
  params: RunOutboundBridgeParams
): Promise<LiveBridgeStep[]> {
  const {
    toChain,
    recipientAddress,
    amount,
    solanaAddress,
    walletId,
    sdkRef,
    onStepUpdate,
    onStatusMessage,
  } = params;

  const fromAddress = solanaAddress;
  if (!fromAddress) throw new Error("Missing Solana wallet address.");

  onStatusMessage?.("Preparing cross-chain transfer…");

  const { createW3sSolanaKitAdapter } = await import("@/lib/w3s-solana-kit-signer");

  const fromAdapter = await createW3sSolanaKitAdapter({
    solanaAddress: fromAddress,
    walletId,
    sdkRef,
  });

  const collected: LiveBridgeStep[] = [];
  const pushSteps = (active?: string) => {
    onStepUpdate([...collected], active);
  };

  const amountNum = parseFloat(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new Error("Enter a valid transfer amount.");
  }
  assertMinCrossChainTransferAmount(amount);

  const { AppKit, TransferSpeed } = await import("@circle-fin/app-kit");

  const bridgeConfig =
    amountNum < SLOW_TRANSFER_BELOW_USD
      ? { transferSpeed: TransferSpeed.SLOW }
      : undefined;

  const bridgeParams = {
    from: {
      adapter: fromAdapter,
      chain: SETTLEMENT_CHAIN_ID,
      address: fromAddress,
    },
    to: {
      chain: toChain,
      recipientAddress,
      useForwarder: true,
    },
    amount,
    token: "USDC",
    ...(bridgeConfig ? { config: bridgeConfig } : {}),
  };

  const kit = new AppKit();

  kit.on("*", (payload: any) => {
    const name = payload?.method?.replace("bridge.", "") ?? "unknown";
    const state = payload?.values?.state ?? "pending";
    const s: LiveBridgeStep = {
      name,
      state,
      explorerUrl: payload?.values?.explorerUrl,
      errorMessage: payload?.values?.errorMessage,
    };
    const idx = collected.findIndex((x) => x.name === name);
    if (idx >= 0) collected[idx] = s;
    else collected.push(s);

    if (state === "pending" || state === "active") {
      onStatusMessage?.(`Step: ${name} — confirm in the Circle popup if shown`);
    }
    pushSteps(state === "pending" ? name : undefined);
  });

  onStatusMessage?.("Estimating protocol fees…");
  try {
    const estimate = await kit.estimateBridge(bridgeParams as any);
    const protocolFeesUsd = sumBridgeProtocolFeesUsd(estimate);
    if (protocolFeesUsd > 0 && amountNum <= protocolFeesUsd) {
      const minAmount = Math.ceil((protocolFeesUsd + 0.05) * 100) / 100;
      throw new Error(
        `Amount too small for cross-chain transfer to ${chainName(toChain)}. ` +
          `Estimated protocol fees are about $${protocolFeesUsd.toFixed(2)}, so send more than that (try at least $${minAmount.toFixed(2)} USDC).`
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Amount too small")) throw err;
    /* If estimate fails, proceed — bridge will surface a concrete error */
  }

  onStatusMessage?.(`Bridging to ${chainName(toChain)}…`);

  let result;
  try {
    result = await kit.bridge(bridgeParams as any);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Transfer failed";
    throw new Error(formatOutboundBridgeError(msg, toChain, amount));
  }

  const finalSteps: LiveBridgeStep[] = (result.steps ?? []).map((s: any) => ({
    name: s.name,
    state: s.state,
    explorerUrl: s.explorerUrl,
    errorMessage: s.errorMessage,
  }));

  onStepUpdate(finalSteps);
  onStatusMessage?.("Transfer complete");

  const failed = finalSteps.find((s) => s.state === "error");
  if (failed) {
    const msg = failed.errorMessage ?? `Bridge failed at step: ${failed.name}`;
    throw new Error(formatOutboundBridgeError(msg, toChain, amount));
  }

  return finalSteps;
}
