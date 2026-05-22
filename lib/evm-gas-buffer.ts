/**
 * EIP-1559 fee headroom for Circle bridge simulations and L2 MetaMask sends.
 * Only Arbitrum/Base Sepolia need wallet send buffering; Ethereum Sepolia stays untouched.
 */
import type { Chain, PublicClient } from "viem";
import { createPublicClient, http } from "viem";
import type { SupportedChainId } from "@/app/lib/bridge.types";

/** Source chains where low maxFeePerGas causes MetaMask / simulation failures. */
const L2_GAS_BUFFER_SOURCE_CHAINS: readonly SupportedChainId[] = [
  "Arbitrum_Sepolia",
  "Base_Sepolia",
];

const BASE_FEE_MULTIPLIER: Partial<Record<SupportedChainId, bigint>> = {
  Arbitrum_Sepolia: BigInt(6),
  Base_Sepolia: BigInt(4),
};

export function chainNeedsL2GasBuffer(chainId: SupportedChainId): boolean {
  return L2_GAS_BUFFER_SOURCE_CHAINS.includes(chainId);
}

/** Primary RPC per chain (fast path). Extra URLs are fallbacks for manual use only. */
export const BRIDGE_CHAIN_RPC_URLS: Partial<Record<SupportedChainId, readonly string[]>> = {
  Ethereum_Sepolia: [
    "https://sepolia.drpc.org",
    "https://ethereum-sepolia-rpc.publicnode.com",
  ],
  Base_Sepolia: ["https://sepolia.base.org", "https://base-sepolia-rpc.publicnode.com"],
  Arbitrum_Sepolia: [
    "https://sepolia-rollup.arbitrum.io/rpc",
    "https://arbitrum-sepolia-rpc.publicnode.com",
  ],
  Avalanche_Fuji: [
    "https://api.avax-test.network/ext/bc/C/rpc",
    "https://avalanche-fuji-c-chain-rpc.publicnode.com",
  ],
  Arc_Testnet: ["https://rpc.testnet.arc.network"],
};

export function rpcUrlForBridgeChain(chainId: SupportedChainId): string {
  const urls = BRIDGE_CHAIN_RPC_URLS[chainId];
  if (!urls?.[0]) throw new Error(`No RPC configured for ${chainId}`);
  return urls[0];
}

/** Map viem chain id → bridge config (for per-chain public clients). */
const VIEM_CHAIN_ID_TO_BRIDGE: Partial<Record<number, SupportedChainId>> = {
  11155111: "Ethereum_Sepolia",
  84532: "Base_Sepolia",
  421614: "Arbitrum_Sepolia",
  43113: "Avalanche_Fuji",
  5042002: "Arc_Testnet",
};

/** RPC URL for a viem `chain` passed into Circle's adapter (not always the source chain). */
export function rpcUrlForViemChain(chain: Chain, fallback: SupportedChainId): string {
  const bridgeId = VIEM_CHAIN_ID_TO_BRIDGE[chain.id];
  return rpcUrlForBridgeChain(bridgeId ?? fallback);
}

const RPC_TIMEOUT_MS = 12_000;

export function createBridgeHttpTransport(rpcUrl: string) {
  return http(rpcUrl, { timeout: RPC_TIMEOUT_MS });
}

type FeeArgs = {
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  gasPrice?: bigint;
};

/** Fees safely above pending base fee. */
export async function bufferedEip1559Fees(
  client: PublicClient,
  sourceChain?: SupportedChainId
): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  const baseMult = (sourceChain && BASE_FEE_MULTIPLIER[sourceChain]) || BigInt(3);

  try {
    const block = await client.getBlock({ blockTag: "pending" });
    const base = block.baseFeePerGas ?? BigInt(0);
    if (base > BigInt(0)) {
      const maxPriorityFeePerGas =
        base / BigInt(10) > BigInt(0) ? base / BigInt(10) : BigInt(1);
      const maxFeePerGas = base * baseMult + maxPriorityFeePerGas;
      return { maxFeePerGas, maxPriorityFeePerGas };
    }
  } catch {
    /* fall through */
  }

  try {
    const fees = await client.estimateFeesPerGas();
    if (fees.maxFeePerGas != null && fees.maxPriorityFeePerGas != null) {
      const bump = sourceChain && chainNeedsL2GasBuffer(sourceChain) ? BigInt(250) : BigInt(200);
      return {
        maxFeePerGas: (fees.maxFeePerGas * bump) / BigInt(100),
        maxPriorityFeePerGas: (fees.maxPriorityFeePerGas * bump) / BigInt(100),
      };
    }
  } catch {
    /* fall through */
  }

  const gasPrice = await client.getGasPrice();
  const bump = sourceChain && chainNeedsL2GasBuffer(sourceChain) ? BigInt(350) : BigInt(300);
  const maxFeePerGas = (gasPrice * bump) / BigInt(100);
  const maxPriorityFeePerGas =
    maxFeePerGas / BigInt(10) > BigInt(0) ? maxFeePerGas / BigInt(10) : BigInt(1);
  return { maxFeePerGas, maxPriorityFeePerGas };
}

async function mergeBufferedFees(
  client: PublicClient,
  args: FeeArgs & Record<string, unknown>,
  sourceChain?: SupportedChainId
): Promise<Record<string, unknown>> {
  const fees = await bufferedEip1559Fees(client, sourceChain);
  const { gasPrice: _drop, ...rest } = args;
  return { ...rest, ...fees };
}

/** Public client for Circle pre-flight simulation (buffered on L2 source chains). */
export function createBufferedPublicClient(
  chain: Chain,
  rpcUrl: string,
  sourceChain?: SupportedChainId
): PublicClient {
  const base = createPublicClient({ chain, transport: createBridgeHttpTransport(rpcUrl) });

  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop === "getGasPrice") {
        return async () => (await bufferedEip1559Fees(target, sourceChain)).maxFeePerGas;
      }
      if (prop === "estimateGas") {
        return async (args: Parameters<PublicClient["estimateGas"]>[0]) =>
          target.estimateGas(
            (await mergeBufferedFees(
              target,
              args as FeeArgs & Record<string, unknown>,
              sourceChain
            )) as Parameters<PublicClient["estimateGas"]>[0]
          );
      }
      if (prop === "call") {
        return async (args: Parameters<PublicClient["call"]>[0]) =>
          target.call(
            (await mergeBufferedFees(
              target,
              args as FeeArgs & Record<string, unknown>,
              sourceChain
            )) as Parameters<PublicClient["call"]>[0]
          );
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as PublicClient;
}

/** Circle adapter public client: buffered only for L2 sources, plain elsewhere. */
export function createBridgePublicClient(chain: Chain, fallback: SupportedChainId): PublicClient {
  const rpc = rpcUrlForViemChain(chain, fallback);
  const bridgeChain = VIEM_CHAIN_ID_TO_BRIDGE[chain.id];
  if (bridgeChain && chainNeedsL2GasBuffer(bridgeChain)) {
    return createBufferedPublicClient(chain, rpc, bridgeChain);
  }
  return createPublicClient({ chain, transport: createBridgeHttpTransport(rpc) });
}

const SOURCE_CHAIN_HEX: Partial<Record<SupportedChainId, string>> = {
  Arbitrum_Sepolia: "0x66eee",
  Base_Sepolia: "0x14a34",
};

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
};

/**
 * Raise EIP-1559 caps on MetaMask sends for volatile L2 testnets.
 * Only hooks `eth_sendTransaction` — never eth_call / eth_estimateGas.
 */
export function wrapWalletProviderForL2Gas(
  provider: Eip1193Provider,
  sourceChain: SupportedChainId
): Eip1193Provider {
  if (!chainNeedsL2GasBuffer(sourceChain)) return provider;

  const expectedChainIdHex = SOURCE_CHAIN_HEX[sourceChain];
  if (!expectedChainIdHex) return provider;

  const rpc = rpcUrlForBridgeChain(sourceChain);
  const originalRequest = provider.request.bind(provider);

  return {
    ...provider,
    request: async (args: { method: string; params?: unknown }) => {
      if (args.method !== "eth_sendTransaction") {
        return originalRequest(args);
      }

      const tx = (args.params as [Record<string, string>] | undefined)?.[0];
      if (!tx || typeof tx !== "object") return originalRequest(args);

      try {
        const chainIdHex = (await originalRequest({ method: "eth_chainId" })) as string;
        if (chainIdHex.toLowerCase() !== expectedChainIdHex.toLowerCase()) {
          return originalRequest(args);
        }

        const chainId = parseInt(chainIdHex, 16);
        const client = createPublicClient({
          chain: {
            id: chainId,
            name: sourceChain,
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: { default: { http: [rpc] } },
          } as Chain,
          transport: createBridgeHttpTransport(rpc),
        });

        const fees = await bufferedEip1559Fees(client, sourceChain);
        const { toHex } = await import("viem");

        const curMax = tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : BigInt(0);
        const curPri = tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : BigInt(0);
        const maxFee = curMax > fees.maxFeePerGas ? curMax : fees.maxFeePerGas;
        const maxPri =
          curPri > fees.maxPriorityFeePerGas ? curPri : fees.maxPriorityFeePerGas;

        const patched: Record<string, string> = { ...tx };
        delete patched.gasPrice;
        patched.maxFeePerGas = toHex(maxFee);
        patched.maxPriorityFeePerGas = toHex(maxPri);

        return originalRequest({ ...args, params: [patched] });
      } catch {
        return originalRequest(args);
      }
    },
  };
}
