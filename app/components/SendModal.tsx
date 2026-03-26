/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { SUPPORTED_CHAINS, SupportedChainId, STEP_ORDER, STEP_LABELS, BridgeProgress } from "@/app/lib/bridge.types";

interface Props {
  /** The logged-in user's Arc wallet address — shown in Receive tab */
  myArcAddress: string;
  /** The logged-in user's Circle wallet ID — used for outbound sends */
  myWalletId: string;
  onClose: () => void;
}

type Mode = "send" | "receive" | "withdraw";


export default function SendModal({ myArcAddress, myWalletId, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("send");

  // ── Send (inbound: external → Arc) ──
  const [toAddress,  setToAddress]  = useState("");
  const [amount,     setAmount]     = useState("");
  const [fromChain,  setFromChain]  = useState<SupportedChainId>("Ethereum_Sepolia");

  // ── Withdraw (outbound: Arc → external) ──
  const [wdToAddress,  setWdToAddress]  = useState("");
  const [wdAmount,     setWdAmount]     = useState("");
  const [wdToChain,    setWdToChain]    = useState<SupportedChainId>("Ethereum_Sepolia");

  // ── Shared state ──
  const [steps,    setSteps]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const selectedChain = SUPPORTED_CHAINS.find(c => c.id === fromChain);
  const isSolana = selectedChain?.type === "solana";
  const testnetChains = SUPPORTED_CHAINS.filter(c => c.isTestnet);

  // Chain ID mapping for wallet_switchEthereumChain
  const CHAIN_IDS: Partial<Record<SupportedChainId, string>> = {
    "Ethereum_Sepolia": "0xaa36a7",   // 11155111
    "Base_Sepolia":     "0x14a34",    // 84532
    "Arbitrum_Sepolia": "0x66eee",    // 421614
    "Avalanche_Fuji":   "0xa869",     // 43113
    "Ethereum":         "0x1",
    "Base":             "0x2105",
    "Arbitrum":         "0xa4b1",
    "Avalanche":        "0xa86a",
    "Polygon":          "0x89",
  };

  // ── SEND: bridge from payer's external wallet → recipient's Arc ────────────
  const handleSend = async () => {
    if (!toAddress || !amount) return;
    setLoading(true); setError(null); setSteps([]);

    try {
      if (!isSolana) {
        if (typeof window === "undefined" || !(window as any).ethereum) {
          throw new Error("No EVM wallet detected. Please install MetaMask.");
        }
        const eth = (window as any).ethereum;

        // 1. Request accounts first so MetaMask knows which wallet to use
        await eth.request({ method: "eth_requestAccounts" });

        // 2. Switch to the correct chain
        const targetChainId = CHAIN_IDS[fromChain];
        if (targetChainId) {
          const currentChainId = await eth.request({ method: "eth_chainId" });
          console.log("[iPayX] current chainId:", currentChainId, "target:", targetChainId);
          if (currentChainId !== targetChainId) {
            console.log("[iPayX] switching chain...");
            try {
              await eth.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: targetChainId }],
              });
              console.log("[iPayX] switch request resolved");
            } catch (switchErr: any) {
              console.log("[iPayX] switch error:", switchErr.code, switchErr.message);
              if (switchErr.code === 4902) {
                throw new Error(`Please add ${selectedChain?.name} to MetaMask first.`);
              }
              if (switchErr.code !== 4001) throw switchErr;
            }
            // Poll until provider confirms the chain actually switched
            let attempts = 0;
            while (attempts < 20) {
              await new Promise(r => setTimeout(r, 300));
              const confirmedChain = await eth.request({ method: "eth_chainId" });
              console.log("[iPayX] poll attempt", attempts, "chainId:", confirmedChain);
              if (confirmedChain === targetChainId) break;
              attempts++;
            }
          } else {
            console.log("[iPayX] already on correct chain, no switch needed");
          }
        }
      }

      // ── Entirely client-side: MetaMask signs the burn, Circle relayer mints on Arc ──
      const { createViemAdapterFromProvider } = await import("@circle-fin/adapter-viem-v2");
      const { AppKit } = await import("@circle-fin/app-kit");

      // ── DEBUG: log wallet state before building adapter ──
      const eth = (window as any).ethereum;
      const chainIdNow = await eth.request({ method: "eth_chainId" });
      const accounts: string[] = await eth.request({ method: "eth_accounts" });
      console.log("[iPayX] chain at adapter build time:", chainIdNow, "(expected:", CHAIN_IDS[fromChain], ")");
      console.log("[iPayX] connected accounts:", accounts);
      console.log("[iPayX] fromChain string:", fromChain);
      console.log("[iPayX] amount:", amount, "to:", toAddress);

      if (accounts.length > 0) {
        // Check ETH balance of the active account (index 0 = what SDK will use)
        const balanceHex: string = await eth.request({
          method: "eth_getBalance",
          params: [accounts[0], "latest"],
        });
        const balanceWei = parseInt(balanceHex, 16);
        const balanceEth = balanceWei / 1e18;
        console.log("[iPayX] ETH balance of", accounts[0], ":", balanceEth.toFixed(6), "ETH");
        if (accounts.length > 1) {
          console.warn("[iPayX] Multiple accounts connected. SDK will use:", accounts[0], ". If this is wrong, disconnect other accounts in MetaMask first.");
        }
      }
      // ── END DEBUG ──

      const fromAdapter = await createViemAdapterFromProvider({
        provider: (window as any).ethereum,
      });
      console.log("[iPayX] fromAdapter created");

      const kit = new AppKit();
      const collectedSteps: any[] = [];

      kit.on("*", (payload: any) => {
        try {
          // Safely extract only the fields we need — never JSON.stringify the whole payload
          // (it contains BigInt values from viem that crash JSON.stringify)
          const name: string = (payload?.method ?? "").replace("bridge.", "") || "unknown";
          const state = payload?.values?.state ?? "pending";
          const explorerUrl = payload?.values?.explorerUrl;
          const errorMessage = payload?.values?.errorMessage;
          console.log("[iPayX] bridge event:", name, "→", state, explorerUrl ?? "");

          const s = { name, state, explorerUrl, errorMessage };
          const idx = collectedSteps.findIndex(x => x.name === name);
          if (idx >= 0) collectedSteps[idx] = s; else collectedSteps.push(s);
          setSteps([...collectedSteps]);
        } catch (handlerErr) {
          console.warn("[iPayX] event handler error (non-fatal):", handlerErr);
        }
      });

      console.log("[iPayX] calling kit.bridge...");
      const result = await kit.bridge({
        from: { adapter: fromAdapter, chain: fromChain as any },
        to: {
          adapter: fromAdapter, // used only for confirmation polling on Arc
          chain: "Arc_Testnet" as any,
          recipientAddress: toAddress,
          useForwarder: true,  // Circle relayer mints on Arc — no gas needed by recipient
        },
        amount,
      });

      setSteps((result.steps ?? []).map((s: any) => ({
        name: s.name, state: s.state,
        explorerUrl: s.explorerUrl, errorMessage: s.errorMessage,
      })));
      setDone(true);
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // ── WITHDRAW: Arc → external chain ────────────────────────────────────────
  const handleWithdraw = async () => {
    if (!wdToAddress || !wdAmount) return;
    setLoading(true); setError(null); setSteps([]);

    try {
      const res = await fetch("/api/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: "outbound",
          toChain: wdToChain,
          recipientAddress: wdToAddress,
          amount: wdAmount,
          senderWalletId: myWalletId,
        }),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg ?? "Bridge failed");
      }

      const data = await res.json();
      setSteps(data.steps ?? []);
      setDone(true);
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const progressUI = (
    <div className="space-y-3">
      <p className="text-center text-slate-400 text-sm mb-4">
        {done ? "Transfer complete ✓" : "Transfer in progress — do not close this window"}
      </p>
      {STEP_ORDER.map((stepId, i) => {
        const step = steps.find(s => s.name === stepId);
        const isDone   = step?.state === "success";
        const isErr    = step?.state === "error";
        const isActive = loading && !isDone && !steps.find(s => s.name === STEP_ORDER[i+1]);
        return (
          <div key={stepId} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
            isDone ? "border-emerald-500/30 bg-emerald-500/5" :
            isErr  ? "border-red-500/30 bg-red-500/5" :
            isActive ? "border-indigo-500/30 bg-indigo-500/5" :
            "border-white/5"
          }`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
              isDone ? "bg-emerald-500 text-white" :
              isErr  ? "bg-red-500 text-white" :
              isActive ? "bg-indigo-500 text-white animate-pulse" :
              "bg-white/10 text-slate-500"
            }`}>
              {isDone ? "✓" : isErr ? "✕" : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${isDone ? "text-emerald-400" : isErr ? "text-red-400" : isActive ? "text-white" : "text-slate-500"}`}>
                {STEP_LABELS[stepId]}
              </p>
              {step?.explorerUrl && (
                <a href={step.explorerUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-indigo-400 hover:text-indigo-300 block mt-0.5">
                  View on explorer →
                </a>
              )}
              {step?.errorMessage && <p className="text-xs text-red-400 mt-0.5">{step.errorMessage}</p>}
            </div>
          </div>
        );
      })}
      {done && (
        <button onClick={onClose}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all mt-2">
          Done
        </button>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg glass-card rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-white">USDC Transfer</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Mode tabs */}
        {!loading && !done && (
          <div className="flex gap-1 p-1 bg-black/30 rounded-xl mb-5">
            {(["send","receive","withdraw"] as Mode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                  mode === m ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}>
                {m === "send" ? "↑ Pay" : m === "receive" ? "↓ Receive" : "⇄ Withdraw"}
              </button>
            ))}
          </div>
        )}

        {/* ── RECEIVE ── */}
        {mode === "receive" && !loading && !done && (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">Share your Arc address to receive USDC from any chain. Funds always land in your unified balance.</p>
            <div className="bg-black/40 border border-white/10 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Your Arc Address</p>
              <code className="text-emerald-400 font-mono text-sm break-all">{myArcAddress}</code>
            </div>
            <button onClick={() => navigator.clipboard.writeText(myArcAddress)}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-all flex items-center justify-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
              Copy Address
            </button>
            <div className="border-t border-white/5 pt-3">
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Accepted from</p>
              <div className="flex flex-wrap gap-2">
                {SUPPORTED_CHAINS.filter(c => c.isTestnet).map(c => (
                  <span key={c.id} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300 flex items-center gap-1">
                    {c.logo} {c.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SEND (pay from external wallet → Arc) ── */}
        {mode === "send" && !loading && !done && (
          <div className="space-y-4">
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-4 py-3 text-xs text-slate-400">
              Your MetaMask / Phantom wallet will be asked to sign the transaction. No private key needed.
            </div>
            <div>
              <label className="field-label">Recipient Arc Address</label>
              <input type="text" className="field-input font-mono text-xs" placeholder="0x..."
                value={toAddress} onChange={e => setToAddress(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Amount (USDC)</label>
              <div className="relative">
                <input type="number" className="field-input pr-16" placeholder="0.00"
                  value={amount} onChange={e => setAmount(e.target.value)} />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">USDC</span>
              </div>
            </div>
            <div>
              <label className="field-label">Pay from Chain</label>
              <select className="field-input appearance-none" value={fromChain}
                onChange={e => setFromChain(e.target.value as SupportedChainId)}>
                {testnetChains.map(c => (
                  <option key={c.id} value={c.id}>{c.logo} {c.name}</option>
                ))}
              </select>
            </div>
            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
            <button onClick={handleSend} disabled={!toAddress || !amount}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-sm transition-all">
              Send {amount ? `${amount} USDC` : "USDC"} via {selectedChain?.name}
            </button>
          </div>
        )}

        {/* ── WITHDRAW (Arc → external chain) ── */}
        {mode === "withdraw" && !loading && !done && (
          <div className="space-y-4">
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-slate-400">
              Withdraw from your unified Arc balance to any supported chain. Signed by your Circle wallet.
            </div>
            <div>
              <label className="field-label">Destination Address</label>
              <input type="text" className="field-input font-mono text-xs" placeholder="0x... or Solana address"
                value={wdToAddress} onChange={e => setWdToAddress(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Amount (USDC)</label>
              <div className="relative">
                <input type="number" className="field-input pr-16" placeholder="0.00"
                  value={wdAmount} onChange={e => setWdAmount(e.target.value)} />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">USDC</span>
              </div>
            </div>
            <div>
              <label className="field-label">To Chain</label>
              <select className="field-input appearance-none" value={wdToChain}
                onChange={e => setWdToChain(e.target.value as SupportedChainId)}>
                {testnetChains.map(c => (
                  <option key={c.id} value={c.id}>{c.logo} {c.name}</option>
                ))}
              </select>
            </div>
            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
            <button onClick={handleWithdraw} disabled={!wdToAddress || !wdAmount}
              className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-semibold text-sm transition-all">
              Withdraw {wdAmount ? `${wdAmount} USDC` : "USDC"} to {SUPPORTED_CHAINS.find(c => c.id === wdToChain)?.name}
            </button>
          </div>
        )}

        {/* ── PROGRESS ── */}
        {(loading || done) && progressUI}
      </div>
    </div>
  );
}