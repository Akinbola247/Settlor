/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { Invoice, invoiceTotal, formatUSDC, getStatusColor } from "@/app/lib/useInvoices";
import { SUPPORTED_CHAINS, SupportedChainId, STEP_ORDER, STEP_LABELS } from "@/app/lib/bridge.types";

interface Props {
  invoice: Invoice;
  currentUserAddress: string;
  onPaid: (txSteps: any[]) => void;
  onClose: () => void;
}

// const STEP_ORDER = ["approve", "burn", "attestation", "mint"];
// const STEP_LABELS: Record<string, string> = {
//   approve:     "Approving token spend",
//   burn:        "Burning USDC on source chain",
//   attestation: "Waiting for Circle attestation (~2 min)",
//   mint:        "Minting USDC on Arc",
// };

const CHAIN_IDS: Partial<Record<SupportedChainId, string>> = {
  "Ethereum_Sepolia": "0xaa36a7",
  "Base_Sepolia":     "0x14a34",
  "Arbitrum_Sepolia": "0x66eee",
  "Avalanche_Fuji":   "0xa869",
  "Ethereum":         "0x1",
  "Base":             "0x2105",
  "Arbitrum":         "0xa4b1",
  "Avalanche":        "0xa86a",
  "Polygon":          "0x89",
};

export default function InvoiceDetailModal({ invoice, currentUserAddress, onPaid, onClose }: Props) {
  const [fromChain, setFromChain] = useState<SupportedChainId>("Ethereum_Sepolia");
  const [steps,     setSteps]     = useState<any[]>([]);
  const [paying,    setPaying]    = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const total    = invoiceTotal(invoice);
  const isMine   = invoice.creatorAddress.toLowerCase() === currentUserAddress.toLowerCase();
  const isPayer  = invoice.recipientAddress.toLowerCase() === currentUserAddress.toLowerCase();
  const canPay   = isPayer && invoice.status !== "paid";

  const selectedChain = SUPPORTED_CHAINS.find(c => c.id === fromChain);

  const handlePay = async () => {
    setError(null); setPaying(true); setSteps([]);

    try {
      if (typeof window === "undefined" || !(window as any).ethereum) {
        throw new Error("No EVM wallet detected. Please install MetaMask.");
      }

      const eth = (window as any).ethereum;

      // 1. Connect wallet
      await eth.request({ method: "eth_requestAccounts" });

      // 2. Switch to correct chain and wait for confirmation
      const targetChainId = CHAIN_IDS[fromChain];
      if (targetChainId) {
        const currentChainId = await eth.request({ method: "eth_chainId" });
        if (currentChainId !== targetChainId) {
          try {
            await eth.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: targetChainId }],
            });
          } catch (switchErr: any) {
            if (switchErr.code === 4902) {
              throw new Error(`Please add ${selectedChain?.name} to MetaMask first.`);
            }
            if (switchErr.code !== 4001) throw switchErr;
          }
          // Poll until provider confirms chain switched
          let attempts = 0;
          while (attempts < 20) {
            await new Promise(r => setTimeout(r, 300));
            const confirmedChain = await eth.request({ method: "eth_chainId" });
            if (confirmedChain === targetChainId) break;
            attempts++;
          }
        }
      }

      // Client-side signing via MetaMask
      const { createViemAdapterFromProvider } = await import("@circle-fin/adapter-viem-v2");
      const { AppKit: AppKitClass } = await import("@circle-fin/app-kit");

      const fromAdapter = await createViemAdapterFromProvider({
        provider: (window as any).ethereum,
      });

      const kit = new AppKitClass();
      const collected: any[] = [];

      kit.on("*", (payload: any) => {
        const name = payload?.method?.replace("bridge.", "") ?? "unknown";
        const s = { name, state: payload?.values?.state ?? "pending", explorerUrl: payload?.values?.explorerUrl, errorMessage: payload?.values?.errorMessage };
        const idx = collected.findIndex(x => x.name === name);
        if (idx >= 0) collected[idx] = s; else collected.push(s);
        setSteps([...collected]);
      });

      const result = await kit.bridge({
        from: { adapter: fromAdapter, chain: fromChain as any },
        to: {
          adapter: fromAdapter,
          chain: "Arc_Testnet" as any,
          recipientAddress: invoice.creatorAddress,
          useForwarder: true,
        },
        amount: total.toFixed(2),
      });

      const finalSteps = (result.steps ?? []).map((s: any) => ({
        name: s.name, state: s.state,
        explorerUrl: s.explorerUrl, errorMessage: s.errorMessage,
      }));

      setSteps(finalSteps);
      setDone(true);

      // Tell server to mark invoice paid
      await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: invoice.id,
          status: "paid",
          paidAt: new Date().toISOString(),
          txHash: finalSteps.find((s: any) => s.name === "mint")?.explorerUrl,
        }),
      });

      onPaid(finalSteps);
    } catch (e: any) {
      setError(e.message ?? "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg glass-card rounded-2xl p-6 shadow-2xl my-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-slate-500 text-xs">{invoice.invoiceNumber}</p>
            <h2 className="text-xl font-bold text-white">
              {isMine ? `To: ${invoice.recipientName}` : `From: ${invoice.creatorName ?? "Unknown"}`}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(invoice.status)}`}>
              {invoice.status}
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Direction badge */}
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4 ${
          isMine ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-400" :
          "bg-amber-500/10 border border-amber-500/20 text-amber-400"
        }`}>
          {isMine ? "📤 Sent by you" : "📥 Awaiting your payment"}
        </div>

        {/* Items */}
        <div className="space-y-2 mb-4">
          {invoice.items.map(item => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-slate-300">{item.description} <span className="text-slate-600">× {item.quantity}</span></span>
              <span className="text-white font-medium">${formatUSDC(item.quantity * item.unitPrice)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-3 border-t border-white/5">
            <span className="text-slate-400 font-medium">Total</span>
            <span className="text-white font-bold text-lg">${formatUSDC(total)} USDC</span>
          </div>
        </div>

        {invoice.notes && (
          <p className="text-slate-500 text-xs mb-4 bg-black/20 rounded-lg px-3 py-2">{invoice.notes}</p>
        )}

        {/* Addresses */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <div className="bg-black/20 rounded-lg p-3">
            <p className="text-slate-600 mb-1">Payee (receives)</p>
            <code className="text-emerald-400 font-mono break-all">{invoice.creatorAddress.slice(0,10)}…</code>
          </div>
          <div className="bg-black/20 rounded-lg p-3">
            <p className="text-slate-600 mb-1">Payer (you)</p>
            <code className="text-slate-300 font-mono break-all">{invoice.recipientAddress.slice(0,10)}…</code>
          </div>
        </div>

        {/* Pay section */}
        {canPay && !paying && !done && (
          <div className="border-t border-white/5 pt-4 space-y-3">
            <p className="text-sm font-semibold text-white">Pay this invoice</p>
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-4 py-3 text-xs text-slate-400">
              Your MetaMask will be asked to approve + sign. No private key needed.
            </div>
            <div>
              <label className="field-label">Pay from Chain</label>
              <select className="field-input appearance-none" value={fromChain}
                onChange={e => setFromChain(e.target.value as SupportedChainId)}>
                {SUPPORTED_CHAINS.filter(c => c.isTestnet).map(c => (
                  <option key={c.id} value={c.id}>{c.logo} {c.name}</option>
                ))}
              </select>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={handlePay} disabled={paying}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-sm transition-all">
              Pay ${formatUSDC(total)} USDC via {selectedChain?.name}
            </button>
          </div>
        )}

        {/* Progress */}
        {(paying || done) && (
          <div className="border-t border-white/5 pt-4 space-y-3">
            <p className="text-sm text-slate-400 text-center">
              {done ? "Payment delivered ✓" : "Bridging — do not close this window"}
            </p>
            {STEP_ORDER.map((stepId, i) => {
              const step = steps.find(s => s.name === stepId);
              const isDone = step?.state === "success";
              const isErr  = step?.state === "error";
              return (
                <div key={stepId} className={`flex items-start gap-3 p-3 rounded-xl border ${
                  isDone ? "border-emerald-500/30 bg-emerald-500/5" :
                  isErr  ? "border-red-500/30 bg-red-500/5" :
                  "border-white/5"
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isDone ? "bg-emerald-500 text-white" :
                    isErr  ? "bg-red-500 text-white" :
                    "bg-white/10 text-slate-500"
                  }`}>{isDone ? "✓" : isErr ? "✕" : i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${isDone ? "text-emerald-400" : isErr ? "text-red-400" : "text-slate-500"}`}>
                      {STEP_LABELS[stepId]}
                    </p>
                    {step?.explorerUrl && (
                      <a href={step.explorerUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-indigo-400 hover:text-indigo-300 block mt-0.5">
                        View on explorer →
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            {done && (
              <button onClick={onClose}
                className="w-full mt-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all">
                Done
              </button>
            )}
          </div>
        )}

        {/* Already paid */}
        {invoice.status === "paid" && (
          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              <span className="font-semibold">Paid {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : ""}</span>
            </div>
            {invoice.txHash && (
              <a href={invoice.txHash} target="_blank" rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300">
                View transaction →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}