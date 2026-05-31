/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  createW3sSolanaWalletProvider,
  type W3sSolanaProviderConfig,
} from "@/lib/w3s-solana-wallet-provider";

/**
 * Circle USDCKit uses TransactionPartialSigner.signTransactions → W3S sign/transaction.
 * App Kit's SolanaKitAdapter calls partiallySignTransactionMessageWithSigners, which
 * collects partial signatures and submits via RPC (same pattern as toSolanaSigner in USDCKit).
 */
export async function createW3sSolanaKitAdapter(config: W3sSolanaProviderConfig) {
  const { SolanaKitAdapter } = await import("@circle-fin/adapter-solana-kit");
  const { Solana, SolanaDevnet } = await import("@circle-fin/app-kit/chains");
  const { address, createSolanaRpc } = await import("@solana/kit");
  const { IS_MAINNET } = await import("@/lib/settlor-config");
  const { solanaRpcUrl } = await import("@/lib/solana-config");

  const walletProvider = createW3sSolanaWalletProvider(config);
  const walletAddress = address(config.solanaAddress);

  const circleSigner = {
    address: walletAddress,

    async signTransactions(transactions: readonly any[]) {
      const { getBase64EncodedWireTransaction, getTransactionDecoder } = await import(
        "@solana/kit"
      );
      const bs58 = (await import("bs58")).default;
      const decoder = getTransactionDecoder();

      return Promise.all(
        transactions.map(async (tx) => {
          const wire = getBase64EncodedWireTransaction(tx);
          const response = await walletProvider.signTransaction(wire);

          if (typeof response === "string") {
            const signed = decoder.decode(Buffer.from(response, "base64"));
            const sig = signed.signatures[walletAddress];
            if (!sig) {
              throw new Error("Circle signed transaction missing fee-payer signature");
            }
            return { [walletAddress]: sig };
          }

          if (
            response &&
            typeof response === "object" &&
            "__signatureOnly" in response &&
            typeof (response as { signature?: unknown }).signature === "string"
          ) {
            const signatureOnly = response as unknown as { signature: string };
            const sigBytes = bs58.decode(signatureOnly.signature);
            if (sigBytes.length !== 64) {
              throw new Error("Circle returned an invalid signature length");
            }
            return { [walletAddress]: sigBytes };
          }

          throw new Error("Circle did not return a valid Solana signature. Complete the popup and retry.");
        })
      );
    },
  };

  const supportedChains = IS_MAINNET ? [Solana] : [SolanaDevnet];

  return new SolanaKitAdapter(
    {
      getRpc: ({ chain: _chain }) => createSolanaRpc(solanaRpcUrl()),
      getSigner: async () => circleSigner as any,
    },
    {
      addressContext: "developer-controlled",
      supportedChains,
    }
  );
}
