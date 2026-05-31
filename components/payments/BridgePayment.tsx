/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRef, useState } from "react";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import {
  SupportedChainId,
  depositSourceChains,
  externalWalletPayChains,
  userFacingStepTitle,
} from "@/app/lib/bridge.types";
import {
  chainName,
  connectWallet,
  getEthereumProvider,
  hasPhantomWallet,
  isSolanaDirectChain,
  runSolanaDirectTransfer,
  runInboundBridge,
  switchWalletChain,
  type InboundSolanaMintSigner,
  type LiveBridgeStep,
} from "@/lib/bridge-client";
import type { PreBridgePhase } from "@/app/lib/bridge.types";
import BridgeStepProgress from "./BridgeStepProgress";
import CircleSolanaBalancePay from "./CircleSolanaBalancePay";

type FlowPhase = "form" | "prepare" | "paying" | "done";
type PaySource = "solana_balance" | "external_wallet";

type Props = {
  recipientSolanaAddress: string;
  amount: string;
  fromChain?: SupportedChainId;
  isLoggedIn?: boolean;
  payerWalletId?: string;
  payerSolanaAddress?: string;
  solanaBalance?: string;
  onSuccess: (steps: LiveBridgeStep[]) => void;
  onError?: (msg: string) => void;
  buttonLabel?: string;
};

const DEFAULT_EVM_CHAIN =
  depositSourceChains()[0]?.id ?? ("Ethereum_Sepolia" as SupportedChainId);

export default function BridgePayment({
  recipientSolanaAddress,
  amount,
  fromChain: initialChain,
  isLoggedIn = false,
  payerWalletId,
  payerSolanaAddress,
  solanaBalance = "0",
  onSuccess,
  onError,
  buttonLabel,
}: Props) {
  const settlementAddress = recipientSolanaAddress;
  const balance = solanaBalance;
  const payChains = externalWalletPayChains();

  const defaultSource: PaySource =
    isLoggedIn && payerWalletId && parseFloat(balance) >= parseFloat(amount)
      ? "solana_balance"
      : "external_wallet";

  const sdkRef = useRef<W3SSdk | null>(null);
  const walletProviderRef = useRef<any>(null);
  const [paySource, setPaySource] = useState<PaySource>(defaultSource);
  const [fromChain, setFromChain] = useState<SupportedChainId>(
    initialChain ?? DEFAULT_EVM_CHAIN
  );
  const [phase, setPhase] = useState<FlowPhase>("form");
  const [prePhase, setPrePhase] = useState<PreBridgePhase>("connect");
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [steps, setSteps] = useState<LiveBridgeStep[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chainLabel = chainName(fromChain);
  const isDirectSolana = isSolanaDirectChain(fromChain);
  const showBalanceTab = isLoggedIn && !!payerWalletId;
  const canUseMetaMask = !!getEthereumProvider();
  const canUsePhantom = hasPhantomWallet();

  const resetError = () => setError(null);

  async function resolveEvmMintSigner(): Promise<InboundSolanaMintSigner> {
    try {
      const sponsorRes = await fetch("/api/solana/gas-sponsor");
      if (sponsorRes.ok) {
        const sponsor = await sponsorRes.json();
        if (sponsor.enabled && sponsor.publicKey) {
          return { kind: "platform", sponsorAddress: sponsor.publicKey };
        }
      }
    } catch {
      /* fall through */
    }

    if (isLoggedIn && payerWalletId && payerSolanaAddress) {
      return {
        kind: "circle-w3s",
        walletId: payerWalletId,
        solanaAddress: payerSolanaAddress,
        sdkRef,
      };
    }

    return { kind: "phantom" };
  }

  const handleConnectWallet = async () => {
    resetError();
    setLoading(true);
    setStatusMessage("Opening MetaMask…");
    try {
      const { accounts, provider } = await connectWallet();
      walletProviderRef.current = provider;
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

  const handleConnectPhantom = async () => {
    resetError();
    setLoading(true);
    setStatusMessage("Connecting Phantom…");
    try {
      const phantom = (window as any).phantom?.solana ?? (window as any).solana;
      if (!phantom) throw new Error("Phantom not found");
      const res = await phantom.connect();
      const addr = res?.publicKey?.toString?.() ?? phantom.publicKey?.toString?.();
      if (!addr) throw new Error("Could not read Phantom address");
      setConnectedAddress(addr);
      setPrePhase("ready");
      setStatusMessage("Phantom connected. Ready to send USDC.");
    } catch (e: any) {
      const msg = e.message ?? "Could not connect Phantom";
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
      const provider = walletProviderRef.current ?? eth;
      await switchWalletChain(provider, fromChain);
      setPrePhase("ready");
      setStatusMessage("Network ready. You can start the bridge.");
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
    setStatusMessage(isDirectSolana ? "Sending USDC on Solana…" : "Initializing bridge…");

    try {
      const finalSteps = isDirectSolana
        ? await runSolanaDirectTransfer({
            recipientSolanaAddress: settlementAddress,
            amount,
            onStatusMessage: setStatusMessage,
          })
        : await runInboundBridge({
            fromChain,
            recipientSolanaAddress: settlementAddress,
            amount,
            walletProvider: walletProviderRef.current ?? undefined,
            mintSigner: await resolveEvmMintSigner(),
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
        isDirectSolana
          ? "Payment complete. USDC sent on Solana."
          : "Payment complete. USDC settled on Solana."
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
    walletProviderRef.current = null;
    setSteps([]);
    if (isDirectSolana) {
      setStatusMessage(
        canUsePhantom
          ? "Connect Phantom to pay on Solana Devnet."
          : "Install Phantom to pay on Solana Devnet."
      );
    } else {
      setStatusMessage(
        canUseMetaMask
          ? "Connect MetaMask to pay from your EVM wallet."
          : "Install MetaMask to pay from an EVM testnet."
      );
    }
  };

  const canContinueExternal =
    isDirectSolana ? canUsePhantom : canUseMetaMask;

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

  if (paySource === "solana_balance" && showBalanceTab && phase === "form") {
    return (
      <div className="space-y-4">
        <PaySourceTabs
          paySource={paySource}
          showBalanceTab={showBalanceTab}
          onChange={(s) => {
            setPaySource(s);
            setError(null);
          }}
        />
        <CircleSolanaBalancePay
          recipientSolanaAddress={settlementAddress}
          amount={amount}
          solanaBalance={balance}
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
        {showBalanceTab && (
          <PaySourceTabs
            paySource="external_wallet"
            showBalanceTab={showBalanceTab}
            onChange={(s) => {
              if (s === "solana_balance") {
                setPhase("form");
                setPaySource("solana_balance");
                setError(null);
                setStatusMessage(null);
              }
            }}
          />
        )}

        <BridgeStepProgress
          prePhase={phase === "paying" && isDirectSolana ? null : phase === "paying" ? null : pre}
          chainLabel={chainLabel}
          connectedAddress={connectedAddress}
          steps={steps}
          statusMessage={statusMessage}
          loading={loading}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        {phase === "prepare" && (
          <div className="flex flex-col gap-2">
            {prePhase === "connect" && isDirectSolana && (
              <button
                type="button"
                className="btn-accent w-full"
                disabled={loading || !canUsePhantom}
                onClick={handleConnectPhantom}
              >
                {loading ? "Connecting…" : "Connect Phantom"}
              </button>
            )}
            {prePhase === "connect" && !isDirectSolana && (
              <button
                type="button"
                className="btn-accent w-full"
                disabled={loading || !canUseMetaMask}
                onClick={handleConnectWallet}
              >
                {loading ? "Connecting…" : "Connect MetaMask"}
              </button>
            )}
            {prePhase === "switch_chain" && !isDirectSolana && (
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
                  ? isDirectSolana
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
      {showBalanceTab && (
        <PaySourceTabs paySource={paySource} showBalanceTab={showBalanceTab} onChange={setPaySource} />
      )}

      <div className="rounded-xl border border-[var(--color-border)] bg-slate-50 px-4 py-3 text-sm">
        <p className="font-medium">How paying works</p>
        {isDirectSolana ? (
          <ol className="mt-2 list-decimal list-inside space-y-1 text-xs text-[var(--color-muted)]">
            <li>Connect Phantom on Solana Devnet</li>
            <li>Confirm one USDC transfer to the vendor</li>
            <li>No cross-chain bridge — funds stay on Solana</li>
          </ol>
        ) : (
          <ol className="mt-2 list-decimal list-inside space-y-1 text-xs text-[var(--color-muted)]">
            <li>Connect MetaMask (testnet USDC on your chosen chain)</li>
            <li>Approve and burn USDC in MetaMask</li>
            <li>Settlor completes the Solana mint automatically</li>
            <li>USDC settles on Solana for the vendor</li>
          </ol>
        )}
      </div>

      <p className="text-sm text-[var(--color-muted)]">
        Pay <strong>${amount} USDC</strong>
        {isDirectSolana ? " on Solana (Phantom)." : " via CCTP to Solana."}
      </p>

      <div>
        <label className="field-label" htmlFor="pay-from-chain">
          Pay from network
        </label>
        <p className="mb-2 text-xs text-[var(--color-muted)]">
          Choose an EVM testnet (MetaMask + CCTP) or Solana Devnet (Phantom direct).
        </p>
        <select
          id="pay-from-chain"
          className="field-input"
          value={fromChain}
          onChange={(e) => setFromChain(e.target.value as SupportedChainId)}
          disabled={loading}
        >
          {payChains.map((c) => (
            <option key={c.id} value={c.id}>
              {c.logo} {c.name}
              {c.type === "evm" ? " (MetaMask)" : " (Phantom)"}
            </option>
          ))}
        </select>
      </div>

      {isDirectSolana && !canUsePhantom && (
        <p className="text-sm text-amber-700 font-medium">
          Install{" "}
          <a
            href="https://phantom.app"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Phantom
          </a>{" "}
          and switch to Solana Devnet to continue.
        </p>
      )}

      {!isDirectSolana && !canUseMetaMask && (
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
          to pay from an EVM testnet.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={openPrepareFlow}
        disabled={!canContinueExternal}
        className="btn-accent w-full"
      >
        {buttonLabel ?? `Continue to pay $${amount} USDC`}
      </button>
    </div>
  );
}

function PaySourceTabs({
  paySource,
  showBalanceTab,
  onChange,
}: {
  paySource: PaySource;
  showBalanceTab: boolean;
  onChange: (source: PaySource) => void;
}) {
  if (!showBalanceTab) return null;

  return (
    <div className="flex gap-1 rounded-xl bg-[var(--color-brand-subtle)] p-1 ring-1 ring-[var(--color-brand)]/10">
      <button
        type="button"
        onClick={() => onChange("solana_balance")}
        className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
          paySource === "solana_balance"
            ? "bg-white shadow-sm text-[var(--color-ink)] ring-1 ring-[var(--color-brand)]/20"
            : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        }`}
      >
        Settlor balance
      </button>
      <button
        type="button"
        onClick={() => onChange("external_wallet")}
        className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
          paySource === "external_wallet"
            ? "bg-white shadow-sm text-[var(--color-ink)] ring-1 ring-[var(--color-brand)]/20"
            : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        }`}
      >
        External wallet
      </button>
    </div>
  );
}
