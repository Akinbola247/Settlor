/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  SETTLEMENT_CHAIN,
  SupportedChainId,
  STEP_ORDER,
  userFacingStepTitle,
  withdrawDestinationChains,
} from "@/app/lib/bridge.types";
import { SETTLEMENT_CHAIN_LABEL } from "@/lib/solana-config";
import {
  assertMinCrossChainTransferAmount,
  chainName,
  MIN_CROSS_CHAIN_TRANSFER_USD,
  runOutboundBridge,
  type LiveBridgeStep,
} from "@/lib/bridge-client";
import { executeSolanaTransfer } from "@/lib/solana-transfer-client";
import { isSolanaAddress, isValidWalletAddress } from "@/lib/address-utils";
import { formatUSDC } from "@/lib/utils";
import { isValidEvmAddress, shortenAddress } from "@/lib/transfer-utils";
import TransferStepBar from "./TransferStepBar";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";

type Step = 1 | 2 | 3 | 4;

type Props = {
  myWalletId: string;
  mySolanaAddress: string;
  usdcBalance: string;
  onComplete?: () => void;
  onNetworkChange?: (chain: SupportedChainId) => void;
};

const WITHDRAW_CHAINS = withdrawDestinationChains();

export default function TransferPanel({
  myWalletId,
  mySolanaAddress,
  usdcBalance,
  onComplete,
  onNetworkChange,
}: Props) {
  const sdkRef = useRef<W3SSdk | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [toChain, setToChain] = useState<SupportedChainId>(SETTLEMENT_CHAIN);
  const walletAddress = mySolanaAddress;
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bridgeSteps, setBridgeSteps] = useState<LiveBridgeStep[]>([]);
  const [done, setDone] = useState(false);

  const balanceNum = parseFloat(usdcBalance) || 0;
  const amountNum = parseFloat(amount) || 0;
  const isSettlement = toChain === SETTLEMENT_CHAIN;

  const selectNetwork = (chain: SupportedChainId) => {
    setToChain(chain);
    onNetworkChange?.(chain);
  };
  const networkLabel = chainName(toChain);
  const addressValid = isValidWalletAddress(toAddress);
  const isSelf =
    addressValid &&
    (isSolanaAddress(toAddress)
      ? toAddress.trim() === walletAddress
      : toAddress.trim().toLowerCase() === walletAddress.toLowerCase());
  const insufficient = amountNum > balanceNum;
  const belowCrossChainMin =
    !isSettlement && amountNum > 0 && amountNum < MIN_CROSS_CHAIN_TRANSFER_USD;
  const canContinueStep1 = addressValid && !isSelf;
  const canContinueStep2 =
    amountNum > 0 &&
    !insufficient &&
    (isSettlement || amountNum >= MIN_CROSS_CHAIN_TRANSFER_USD);

  const reset = () => {
    setStep(1);
    setToChain(SETTLEMENT_CHAIN);
    setToAddress("");
    setAmount("");
    setLoading(false);
    setStatusMessage(null);
    setError(null);
    setBridgeSteps([]);
    setDone(false);
  };

  const setMaxAmount = () => {
    setAmount(formatUSDC(balanceNum));
  };

  const runTransfer = async () => {
    setLoading(true);
    setError(null);
    setStep(4);
    setStatusMessage("Sending…");
    setBridgeSteps([]);

    try {
      if (isSettlement) {
        await executeSolanaTransfer(sdkRef, {
          destinationAddress: toAddress.trim(),
          amount,
          walletId: myWalletId,
          onStatus: setStatusMessage,
        });
      } else {
        assertMinCrossChainTransferAmount(amount);
        const steps = await runOutboundBridge({
          toChain,
          recipientAddress: toAddress.trim(),
          amount,
          solanaAddress: walletAddress,
          walletId: myWalletId,
          sdkRef,
          onStatusMessage: setStatusMessage,
          onStepUpdate: (s, active) => {
            setBridgeSteps(s);
            if (active) setStatusMessage(`Step: ${userFacingStepTitle(active)}…`);
          },
        });
        setBridgeSteps(steps);
      }
      setDone(true);
      setStatusMessage(null);
      onComplete?.();
    } catch (e: any) {
      setError(e.message);
      setStatusMessage(null);
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="w-full space-y-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
            ✓
          </div>
          <h2 className="mt-4 font-display text-xl font-bold text-emerald-900">Transfer sent</h2>
          <p className="mt-2 text-sm text-emerald-800">
            ${amount} USDC → {shortenAddress(toAddress)} on {networkLabel}
          </p>
          <p className="mt-1 text-xs text-emerald-700/80">Balance updates automatically above.</p>
        </div>
        {!isSettlement && bridgeSteps.length > 0 && (
          <div className="space-y-2">
            {STEP_ORDER.map((id) => {
              const s = bridgeSteps.find((x) => x.name === id);
              if (!s) return null;
              return (
                <div
                  key={id}
                  className="flex items-center justify-between rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm"
                >
                  <span>{userFacingStepTitle(id)}</span>
                  {s.explorerUrl && (
                    <a
                      href={s.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-brand"
                    >
                      View
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={reset}>
            New transfer
          </button>
          <Link href="/dashboard" className="btn-outline">
            Overview
          </Link>
        </div>
      </div>
    );
  }

  if (step === 4 && loading) {
    return (
      <div className="w-full space-y-6">
        <TransferStepBar current={4} />
        <div className="card p-8 text-center">
          <div className="spinner mx-auto" />
          <p className="mt-4 font-medium">{statusMessage ?? "Sending your transfer…"}</p>
          <p className="mt-2 text-xs text-[var(--color-muted)]">Do not close this tab.</p>
        </div>
        {!isSettlement && bridgeSteps.length > 0 && (
          <div className="space-y-2">
            {STEP_ORDER.map((id) => {
              const s = bridgeSteps.find((x) => x.name === id);
              return (
                <div
                  key={id}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    s?.state === "success" ? "border-emerald-200 bg-emerald-50" : "border-slate-200"
                  }`}
                >
                  {userFacingStepTitle(id)} {s?.state === "success" ? "✓" : "…"}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      <TransferStepBar current={step} />

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <p className="field-label">Network</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => selectNetwork(SETTLEMENT_CHAIN)}
                className={`rounded-xl border p-4 text-left transition ${
                  isSettlement
                    ? "border-brand bg-brand-subtle ring-2 ring-brand"
                    : "border-[var(--color-border)] hover:border-brand hover:bg-slate-50"
                }`}
              >
                <span className="text-lg">◎</span>
                <p className="mt-2 font-semibold">Solana</p>
                <p className="text-xs text-[var(--color-muted)]">Same chain · fast</p>
              </button>
              {WITHDRAW_CHAINS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectNetwork(c.id)}
                  className={`rounded-xl border p-4 text-left transition ${
                    toChain === c.id
                      ? "border-slate-400 bg-slate-100 ring-2 ring-slate-200"
                      : "border-[var(--color-border)] hover:bg-slate-50"
                  }`}
                >
                  <span className="text-lg">{c.logo}</span>
                  <p className="mt-2 font-semibold">
                    {c.name.replace(" Sepolia", "").replace(" Fuji", "")}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">External network</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="transfer-to">
              Recipient address
            </label>
            <input
              id="transfer-to"
              className="field-input font-mono text-sm"
              placeholder="Solana or 0x…"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              autoComplete="off"
            />
            {toAddress && !addressValid && (
              <p className="mt-1 text-xs text-red-600">
                Enter a valid Solana or EVM address for the selected network.
              </p>
            )}
            {isSelf && (
              <p className="mt-1 text-xs text-red-600">That&apos;s your own address.</p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              className="btn-accent w-full"
              disabled={!canContinueStep1}
              onClick={() => {
                setError(null);
                setStep(2);
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--color-border)] bg-slate-50 px-4 py-3 text-sm">
            <p className="text-[var(--color-muted)]">To</p>
            <p className="font-mono font-medium">{shortenAddress(toAddress, 8, 6)}</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">{networkLabel}</p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="field-label mb-0" htmlFor="transfer-amount">
                Amount (USDC)
              </label>
              <button
                type="button"
                className="text-xs font-bold text-brand hover:underline"
                onClick={setMaxAmount}
              >
                Max
              </button>
            </div>
            <input
              id="transfer-amount"
              className="field-input mt-1.5 text-lg font-semibold"
              type="number"
              min={isSettlement ? "0.01" : String(MIN_CROSS_CHAIN_TRANSFER_USD)}
              step="0.01"
              placeholder={isSettlement ? "0.00" : String(MIN_CROSS_CHAIN_TRANSFER_USD)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Available <strong className="text-[var(--color-ink)]">${formatUSDC(balanceNum)}</strong>
            </p>
            {insufficient && amount && (
              <p className="mt-1 text-xs text-red-600">Amount exceeds your balance.</p>
            )}
            {belowCrossChainMin && (
              <p className="mt-1 text-xs text-red-600">
                Minimum ${MIN_CROSS_CHAIN_TRANSFER_USD} USDC for cross-chain transfers.
              </p>
            )}
            {!isSettlement && !belowCrossChainMin && (
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Minimum ${MIN_CROSS_CHAIN_TRANSFER_USD} USDC to other networks (protocol fees).
                Use {SETTLEMENT_CHAIN_LABEL} for smaller same-chain sends.
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button type="button" className="btn-outline flex-1" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              type="button"
              className="btn-accent flex-1"
              disabled={!canContinueStep2}
              onClick={() => {
                setError(null);
                setStep(3);
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="card divide-y divide-[var(--color-border)] p-0 overflow-hidden">
            <div className="flex justify-between px-5 py-4 text-sm">
              <span className="text-[var(--color-muted)]">Amount</span>
              <span className="font-display text-lg font-bold">${amount}</span>
            </div>
            <div className="flex justify-between px-5 py-4 text-sm">
              <span className="text-[var(--color-muted)]">To</span>
              <span className="max-w-[200px] truncate font-mono text-xs">{toAddress}</span>
            </div>
            <div className="flex justify-between px-5 py-4 text-sm">
              <span className="text-[var(--color-muted)]">Network</span>
              <span className="font-medium">{networkLabel}</span>
            </div>
            <div className="flex justify-between px-5 py-4 text-sm">
              <span className="text-[var(--color-muted)]">From</span>
              <span className="font-medium">Your balance</span>
            </div>
          </div>

          {!isSettlement && (
            <p className="text-xs text-[var(--color-muted)]">
              Transfers to other networks may take a few minutes.
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button type="button" className="btn-outline flex-1" onClick={() => setStep(2)}>
              Back
            </button>
            <button
              type="button"
              className="btn-accent flex-1"
              disabled={!isSettlement && (parseFloat(amount) || 0) < MIN_CROSS_CHAIN_TRANSFER_USD}
              onClick={() => void runTransfer()}
            >
              Send ${amount || "0"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
