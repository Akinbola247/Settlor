/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * App Kit CCTP mint on Solana Devnet (no destination forwarder) — platform sponsor
 * signs the mint tx server-side so payers only need MetaMask on the EVM source chain.
 */
export async function createPlatformSolanaKitAdapter(sponsorAddress: string) {
  const { SolanaKitAdapter } = await import("@circle-fin/adapter-solana-kit");
  const { Solana, SolanaDevnet } = await import("@circle-fin/app-kit/chains");
  const { address, createSolanaRpc } = await import("@solana/kit");
  const { IS_MAINNET } = await import("@/lib/settlor-config");
  const { solanaRpcUrl } = await import("@/lib/solana-config");

  const walletAddress = address(sponsorAddress);

  const platformSigner = {
    address: walletAddress,

    async signTransactions(transactions: readonly any[]) {
      const { getBase64EncodedWireTransaction, getTransactionDecoder } = await import(
        "@solana/kit"
      );
      const decoder = getTransactionDecoder();

      return Promise.all(
        transactions.map(async (tx) => {
          const wire = getBase64EncodedWireTransaction(tx);
          const res = await fetch("/api/solana/platform-sign-tx", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rawTransaction: wire }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(String(body.error ?? "Platform could not sign Solana mint"));
          }

          const signedWire = String(body.signedTransaction ?? "");
          const signed = decoder.decode(Buffer.from(signedWire, "base64"));
          const sig = signed.signatures[walletAddress];
          if (!sig) {
            throw new Error("Platform signed transaction missing fee-payer signature");
          }
          return { [walletAddress]: sig };
        })
      );
    },
  };

  const supportedChains = IS_MAINNET ? [Solana] : [SolanaDevnet];

  return new SolanaKitAdapter(
    {
      getRpc: () => createSolanaRpc(solanaRpcUrl()),
      getSigner: async () => platformSigner as any,
    },
    {
      addressContext: "developer-controlled",
      supportedChains,
    }
  );
}
