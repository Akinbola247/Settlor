/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  SupportedChainId,
  bridgeSourceChains,
  userFacingStepTitle,
} from "@/app/lib/bridge.types";
import type { PreBridgePhase } from "@/app/lib/bridge.types";
import {
  chainName,
  connectWallet,
  getEthereumProvider,
  readNativeBalanceOnChain,
  readWalletUsdcOnChain,
  resolveSigningWalletAddress,
  runInboundBridge,
  switchWalletChain,
  type LiveBridgeStep,
} from "@/lib/bridge-client";
import BridgeStepProgress from "./BridgeStepProgress";

type SendPhase = "form" | "prepare" | "bridging" | "done";

type Props = {
  myArcAddress: string;
  onComplete?: () => void;
};

export default function DepositFromChainPanel({ myArcAddress, onComplete }: Props) {
  const [amount, setAmount] = useState("");
  const [fromChain, setFromChain] = useState<SupportedChainId>("Ethereum_Sepolia");
  const [sendPhase, setSendPhase] = useState<SendPhase>("form");
  const [prePhase, setPrePhase] = useState<PreBridgePhase>("connect");
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const walletProviderRef = useRef<any>(null);
  const [walletUsdc, setWalletUsdc] = useState<number | null>(null);
  const [nativeGas, setNativeGas] = useState<number | null>(null);
  const [steps, setSteps] = useState<LiveBridgeStep[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bridgeFromChains = bridgeSourceChains();
  const chainLabel = chainName(fromChain);

  const resetFlow = () => {
    setSendPhase("form");
    setPrePhase("connect");
    setConnectedAddress(null);
    walletProviderRef.current = null;
    setWalletUsdc(null);
    setNativeGas(null);
    setSteps([]);
    setStatusMessage(null);
    setError(null);
    setDone(false);
    setLoading(false);
  };

  const handleConnectWallet = async () => {
    setError(null);
    setLoading(true);
    setStatusMessage("Opening wallet…");
    try {
      const { accounts, provider } = await connectWallet();
      walletProviderRef.current = provider;
      setConnectedAddress(accounts[0]);
      setPrePhase("switch_chain");
      setStatusMessage(`Connected — switch to ${chainLabel}.`);
    } catch (e: any) {
      setError(e.message);
      setStatusMessage(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchChain = async () => {
    setError(null);
    const eth = getEthereumProvider();
    if (!eth) return setError("Wallet extension not found");
    setLoading(true);
    setStatusMessage(`Switch to ${chainLabel}…`);
    try {
      const provider = walletProviderRef.current ?? eth;
      await switchWalletChain(provider, fromChain);
      const signingAddress = await resolveSigningWalletAddress(provider, fromChain);
      setConnectedAddress(signingAddress);
      setPrePhase("ready");
      setStatusMessage("Ready to deposit.");
    } catch (e: any) {
      setError(e.message);
      setStatusMessage(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (prePhase !== "ready") {
      setWalletUsdc(null);
      setNativeGas(null);
      return;
    }
    const provider = walletProviderRef.current ?? getEthereumProvider();
    if (!provider) return;

    let cancelled = false;
    (async () => {
      try {
        const signingAddress = await resolveSigningWalletAddress(provider, fromChain);
        if (cancelled) return;
        setConnectedAddress(signingAddress);
        const [usdc, gas] = await Promise.all([
          readWalletUsdcOnChain(fromChain, signingAddress),
          readNativeBalanceOnChain(fromChain, signingAddress),
        ]);
        if (!cancelled) {
          setWalletUsdc(usdc);
          setNativeGas(gas);
        }
      } catch {
        if (!cancelled) {
          setWalletUsdc(null);
          setNativeGas(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [prePhase, fromChain]);

  const handleStartBridge = async () => {
    if (!amount || !myArcAddress) return;
    setError(null);
    setSendPhase("bridging");
    setLoading(true);
    setSteps([]);
    setStatusMessage("Processing deposit…");
    try {
      const finalSteps = await runInboundBridge({
        fromChain,
        recipientArcAddress: myArcAddress,
        amount,
        walletProvider: walletProviderRef.current ?? undefined,
        onStepUpdate: (s, active) => {
          setSteps(s);
          if (active) setStatusMessage(userFacingStepTitle(active));
        },
        onStatusMessage: setStatusMessage,
      });
      setSteps(finalSteps);
      setSendPhase("done");
      setDone(true);
      setStatusMessage("Done — balance will update shortly.");
      onComplete?.();
    } catch (e: any) {
      setError(e.message);
      setSendPhase("prepare");
      setPrePhase(connectedAddress ? "ready" : "connect");
      setStatusMessage(null);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ${amount || "0"} USDC deposited. Your balance updates automatically above.
        </div>
        <BridgeStepProgress steps={steps} />
        <button type="button" className="btn-primary" onClick={resetFlow}>
          Deposit again
        </button>
      </div>
    );
  }

  if (sendPhase === "form") {
    return (
      <div className="space-y-4">
        <div>
          <label className="field-label" htmlFor="deposit-amount">
            Amount
          </label>
          <input
            id="deposit-amount"
            className="field-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="10.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="deposit-from-chain">
            Your USDC is on
          </label>
          <select
            id="deposit-from-chain"
            className="field-input"
            value={fromChain}
            onChange={(e) => setFromChain(e.target.value as SupportedChainId)}
          >
            {bridgeFromChains.map((c) => (
              <option key={c.id} value={c.id}>
                {c.logo} {c.name}
              </option>
            ))}
          </select>
        </div>

        {!getEthereumProvider() && (
          <p className="text-xs font-medium text-amber-700">A browser wallet (e.g. MetaMask) is required.</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          className="btn-accent w-full sm:w-auto"
          disabled={!amount || !getEthereumProvider()}
          onClick={() => {
            setSendPhase("prepare");
            setPrePhase("connect");
            setStatusMessage("Connect your wallet.");
          }}
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BridgeStepProgress
        prePhase={sendPhase === "bridging" ? null : prePhase}
        chainLabel={chainLabel}
        connectedAddress={connectedAddress}
        steps={steps}
        statusMessage={statusMessage}
        loading={loading}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {sendPhase === "prepare" && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {prePhase === "connect" && (
            <button type="button" className="btn-primary" disabled={loading} onClick={handleConnectWallet}>
              {loading ? "Connecting…" : "Connect wallet"}
            </button>
          )}
          {prePhase === "switch_chain" && (
            <button type="button" className="btn-primary" disabled={loading} onClick={handleSwitchChain}>
              {loading ? "Switching…" : `Switch to ${chainLabel}`}
            </button>
          )}
          {prePhase === "ready" && (
            <>
              {connectedAddress && (
                <p className="font-mono text-xs text-[var(--color-muted)]">
                  Depositing from {connectedAddress.slice(0, 6)}…{connectedAddress.slice(-4)}
                </p>
              )}
              {walletUsdc != null && (
                <p className="text-sm text-[var(--color-muted)]">
                  This account on {chainLabel}: about <strong>${walletUsdc.toFixed(2)} USDC</strong>
                  {nativeGas != null && (
                    <span className="block">
                      Gas balance: about{" "}
                      <strong>
                        {nativeGas.toFixed(6)}{" "}
                        {fromChain === "Avalanche_Fuji" ? "AVAX" : "ETH"}
                      </strong>
                      {nativeGas < 0.0005 && (
                        <span className="block text-amber-700">
                          Add testnet {fromChain === "Avalanche_Fuji" ? "AVAX" : "ETH"} for
                          network fees (USDC alone is not enough).
                        </span>
                      )}
                    </span>
                  )}
                  {parseFloat(amount) > walletUsdc + 1e-6 && (
                    <span className="block text-red-600">
                      Amount exceeds available USDC on this network.
                    </span>
                  )}
                </p>
              )}
              <button
                type="button"
                className="btn-accent"
                disabled={
                  loading ||
                  !amount ||
                  (walletUsdc != null && parseFloat(amount) > walletUsdc + 1e-6)
                }
                onClick={handleStartBridge}
              >
                {loading ? "Depositing…" : `Deposit $${amount || "0"}`}
              </button>
            </>
          )}
          <button type="button" className="btn-ghost text-xs" onClick={resetFlow}>
            Back
          </button>
        </div>
      )}
    </div>
  );
}
