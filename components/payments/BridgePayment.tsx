/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import {
  SUPPORTED_CHAINS,
  SupportedChainId,
  bridgeSourceChains,
  userFacingStepTitle,
} from "@/app/lib/bridge.types";
import {
  chainName,
  connectWallet,
  getEthereumProvider,
  isArcDirectChain,
  runArcDirectTransfer,
  runInboundBridge,
  switchWalletChain,
  type LiveBridgeStep,
} from "@/lib/bridge-client";
import type { PreBridgePhase } from "@/app/lib/bridge.types";
import BridgeStepProgress from "./BridgeStepProgress";
import CircleArcBalancePay from "./CircleArcBalancePay";

type FlowPhase = "form" | "prepare" | "paying" | "done";
type PaySource = "arc_balance" | "external_wallet";

type Props = {
  recipientArcAddress: string;
  amount: string;
  fromChain?: SupportedChainId;
  /** Logged-in payer: Circle Arc wallet */
  isLoggedIn?: boolean;
  payerWalletId?: string;
  arcBalance?: string;
  onSuccess: (steps: LiveBridgeStep[]) => void;
  onError?: (msg: string) => void;
  buttonLabel?: string;
};

export default function BridgePayment({
  recipientArcAddress,
  amount,
  fromChain: initialChain = "Arc_Testnet",
  isLoggedIn = false,
  payerWalletId,
  arcBalance = "0",
  onSuccess,
  onError,
  buttonLabel,
}: Props) {
  const defaultSource: PaySource =
    isLoggedIn && payerWalletId && parseFloat(arcBalance) >= parseFloat(amount)
      ? "arc_balance"
      : "external_wallet";

  const [paySource, setPaySource] = useState<PaySource>(defaultSource);
  const [fromChain, setFromChain] = useState<SupportedChainId>(initialChain);
  const [phase, setPhase] = useState<FlowPhase>("form");
  const [prePhase, setPrePhase] = useState<PreBridgePhase>("connect");
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [steps, setSteps] = useState<LiveBridgeStep[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testnets = SUPPORTED_CHAINS.filter((c) => c.isTestnet && c.type === "evm");
  const bridgeFromChains = bridgeSourceChains();
  const chainLabel = chainName(fromChain);
  const isDirectArc = isArcDirectChain(fromChain);
  const showArcBalanceTab = isLoggedIn && !!payerWalletId;

  const resetError = () => setError(null);

  const handleConnectWallet = async () => {
    resetError();
    setLoading(true);
    setStatusMessage("Opening MetaMask…");
    try {
      const { accounts } = await connectWallet();
      setConnectedAddress(accounts[0]);
      setPrePhase("switch_chain");
      setStatusMessage(`Connected. Next: switch to ${chainLabel}.`);
    } catch (e: any) {
      const msg = e.message ?? "Could not connect wallet";
      setError(msg);
      onError?.(msg);
      setStatusMessage(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchChain = async () => {
    resetError();
    const eth = getEthereumProvider();
    if (!eth) {
      setError("MetaMask not found");
      return;
    }
    setLoading(true);
    setStatusMessage(`Requesting switch to ${chainLabel}…`);
    try {
      await switchWalletChain(eth, fromChain);
      setPrePhase("ready");
      setStatusMessage(
        isDirectArc
          ? "On Arc Testnet. Ready to send USDC."
          : "Network ready. You can start the bridge."
      );
    } catch (e: any) {
      const msg = e.message ?? "Network switch failed";
      setError(msg);
      onError?.(msg);
      setStatusMessage(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStartPayment = async () => {
    resetError();
    setPhase("paying");
    setLoading(true);
    setSteps([]);
    setStatusMessage(isDirectArc ? "Sending USDC on Arc…" : "Initializing bridge…");

    try {
      const finalSteps = isDirectArc
        ? await runArcDirectTransfer({
            recipientArcAddress,
            amount,
            onStatusMessage: setStatusMessage,
          })
        : await runInboundBridge({
            fromChain,
            recipientArcAddress,
            amount,
            onStepUpdate: (s, active) => {
              setSteps(s);
              if (active) {
                const guide = s.find((x) => x.name === active);
                if (guide?.state === "pending") {
                  setStatusMessage(`Check MetaMask — ${userFacingStepTitle(active)}`);
                }
              }
            },
            onStatusMessage: setStatusMessage,
          });

      setSteps(finalSteps);
      setPhase("done");
      setStatusMessage(
        isDirectArc ? "Payment complete. USDC sent on Arc." : "Payment complete. USDC is on Arc."
      );
      onSuccess(finalSteps);
    } catch (e: any) {
      const msg = e.message ?? "Payment failed";
      setError(msg);
      onError?.(msg);
      setPhase("prepare");
      setPrePhase(connectedAddress ? "ready" : "connect");
      setStatusMessage(null);
    } finally {
      setLoading(false);
    }
  };

  const openPrepareFlow = () => {
    resetError();
    setPhase("prepare");
    setPrePhase("connect");
    setConnectedAddress(null);
    setSteps([]);
    setStatusMessage(
      getEthereumProvider()
        ? "Connect MetaMask to pay from your wallet."
        : "Install MetaMask to continue."
    );
  };

  if (phase === "done") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-center">
          <p className="font-semibold text-emerald-800">Payment complete</p>
          <p className="mt-1 text-xs text-emerald-700">
            ${amount} USDC paid. The invoice will be marked paid.
          </p>
        </div>
        <BridgeStepProgress steps={steps} />
      </div>
    );
  }

  if (paySource === "arc_balance" && showArcBalanceTab && phase === "form") {
    return (
      <div className="space-y-4">
        <PaySourceTabs
          paySource={paySource}
          showArcBalanceTab={showArcBalanceTab}
          onChange={(s) => {
            setPaySource(s);
            setError(null);
          }}
        />
        <CircleArcBalancePay
          recipientArcAddress={recipientArcAddress}
          amount={amount}
          arcBalance={arcBalance}
          payerWalletId={payerWalletId!}
          buttonLabel={buttonLabel}
          onSuccess={(s) => {
            setSteps(s);
            setPhase("done");
            onSuccess(s);
          }}
          onError={onError}
        />
      </div>
    );
  }

  if (phase === "prepare" || phase === "paying") {
    const pre =
      phase === "paying" ? null : prePhase === "ready" ? ("ready" as PreBridgePhase) : prePhase;

    return (
      <div className="space-y-4">
        {showArcBalanceTab && (
          <PaySourceTabs
            paySource="external_wallet"
            showArcBalanceTab={showArcBalanceTab}
            onChange={(s) => {
              if (s === "arc_balance") {
                setPhase("form");
                setPaySource("arc_balance");
                setError(null);
                setStatusMessage(null);
              }
            }}
          />
        )}

        <BridgeStepProgress
          prePhase={phase === "paying" && isDirectArc ? null : phase === "paying" ? null : pre}
          chainLabel={chainLabel}
          connectedAddress={connectedAddress}
          steps={steps}
          statusMessage={statusMessage}
          loading={loading}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        {phase === "prepare" && (
          <div className="flex flex-col gap-2">
            {prePhase === "connect" && (
              <button
                type="button"
                className="btn-accent w-full"
                disabled={loading || !getEthereumProvider()}
                onClick={handleConnectWallet}
              >
                {loading ? "Connecting…" : "Connect MetaMask"}
              </button>
            )}
            {prePhase === "switch_chain" && (
              <button
                type="button"
                className="btn-accent w-full"
                disabled={loading}
                onClick={handleSwitchChain}
              >
                {loading ? "Switching…" : `Switch to ${chainLabel}`}
              </button>
            )}
            {prePhase === "ready" && (
              <button
                type="button"
                className="btn-primary w-full"
                disabled={loading}
                onClick={handleStartPayment}
              >
                {loading
                  ? isDirectArc
                    ? "Sending…"
                    : "Bridging…"
                  : `Pay $${amount} USDC`}
              </button>
            )}
            <button
              type="button"
              className="btn-ghost w-full text-xs"
              disabled={loading}
              onClick={() => {
                setPhase("form");
                setStatusMessage(null);
                setError(null);
              }}
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showArcBalanceTab && (
        <PaySourceTabs paySource={paySource} showArcBalanceTab={showArcBalanceTab} onChange={setPaySource} />
      )}

      <div className="rounded-xl border border-[var(--color-border)] bg-slate-50 px-4 py-3 text-sm">
        <p className="font-medium">How paying works</p>
        {isDirectArc ? (
          <ol className="mt-2 list-decimal list-inside space-y-1 text-xs text-[var(--color-muted)]">
            <li>Connect MetaMask on Arc Testnet</li>
            <li>Confirm one USDC transfer to the recipient</li>
            <li>No cross-chain bridge — funds stay on Arc</li>
          </ol>
        ) : (
          <ol className="mt-2 list-decimal list-inside space-y-1 text-xs text-[var(--color-muted)]">
            <li>Connect MetaMask (testnet USDC on your chosen chain)</li>
            <li>Approve and confirm each step MetaMask shows you</li>
            <li>Wait for Circle verification (~1–2 min)</li>
            <li>USDC arrives on Arc for the recipient</li>
          </ol>
        )}
      </div>

      <p className="text-sm text-[var(--color-muted)]">
        Pay <strong>${amount} USDC</strong>
        {isDirectArc ? " directly on Arc Testnet." : " via cross-chain bridge to Arc."}
      </p>

      <div>
        <label className="field-label" htmlFor="pay-from-chain">
          {isDirectArc ? "Pay from network" : "Bridge from (source network)"}
        </label>
        {!isDirectArc && (
          <p className="mb-2 text-xs text-[var(--color-muted)]">
            Select the testnet where your USDC is in MetaMask (e.g. Ethereum Sepolia). Funds leave
            that network and arrive on Arc — they are not burned or lost.
          </p>
        )}
        {isDirectArc && (
          <p className="mb-2 text-xs text-[var(--color-muted)]">
            Pay directly on Arc Testnet from your MetaMask wallet.
          </p>
        )}
        <select
          id="pay-from-chain"
          className="field-input"
          value={fromChain}
          onChange={(e) => setFromChain(e.target.value as SupportedChainId)}
          disabled={loading}
        >
          {(isDirectArc ? testnets : bridgeFromChains).map((c) => (
            <option key={c.id} value={c.id}>
              {c.logo} {c.name}
            </option>
          ))}
        </select>
      </div>

      {!getEthereumProvider() && (
        <p className="text-sm text-amber-700 font-medium">
          Install{" "}
          <a
            href="https://metamask.io"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            MetaMask
          </a>{" "}
          to continue.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={openPrepareFlow}
        disabled={!getEthereumProvider()}
        className="btn-accent w-full"
      >
        {buttonLabel ?? `Continue to pay $${amount} USDC`}
      </button>
    </div>
  );
}

function PaySourceTabs({
  paySource,
  showArcBalanceTab,
  onChange,
}: {
  paySource: PaySource;
  showArcBalanceTab: boolean;
  onChange: (source: PaySource) => void;
}) {
  if (!showArcBalanceTab) return null;

  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
      <button
        type="button"
        onClick={() => onChange("arc_balance")}
        className={`flex-1 rounded-lg py-2 text-xs font-semibold ${
          paySource === "arc_balance"
            ? "bg-white shadow text-[var(--color-ink)]"
            : "text-[var(--color-muted)]"
        }`}
      >
        Arc balance
      </button>
      <button
        type="button"
        onClick={() => onChange("external_wallet")}
        className={`flex-1 rounded-lg py-2 text-xs font-semibold ${
          paySource === "external_wallet"
            ? "bg-white shadow text-[var(--color-ink)]"
            : "text-[var(--color-muted)]"
        }`}
      >
        External wallet
      </button>
    </div>
  );
}
