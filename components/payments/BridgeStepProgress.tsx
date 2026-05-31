"use client";

import {
  PRE_BRIDGE_GUIDE,
  STEP_ORDER,
  STEP_USER_GUIDE,
  type BridgeStepId,
  type PreBridgePhase,
} from "@/app/lib/bridge.types";
import type { LiveBridgeStep } from "@/lib/bridge-client";
import { cn } from "@/lib/utils";

type Props = {
  /** Pre-bridge: connect / switch chain */
  prePhase?: PreBridgePhase | null;
  chainLabel?: string;
  connectedAddress?: string | null;
  /** Live bridge steps from Circle */
  steps?: LiveBridgeStep[];
  statusMessage?: string | null;
  loading?: boolean;
};

function stepUiState(
  stepId: BridgeStepId,
  steps: LiveBridgeStep[],
  loading: boolean
): "pending" | "active" | "success" | "error" {
  const s = steps.find((x) => x.name === stepId);
  if (s?.state === "error") return "error";
  if (s?.state === "success") return "success";
  if (s?.state === "pending" || s?.state === "active") return "active";
  if (loading) {
    const firstIncomplete = STEP_ORDER.find(
      (id) => !steps.find((x) => x.name === id && x.state === "success")
    );
    if (firstIncomplete === stepId) return "active";
  }
  return "pending";
}

export default function BridgeStepProgress({
  prePhase,
  chainLabel,
  connectedAddress,
  steps = [],
  statusMessage,
  loading = false,
}: Props) {
  const showPre = prePhase != null;
  const showBridge = !showPre || prePhase === "ready";

  return (
    <div className="space-y-4">
      {statusMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-brand bg-brand-subtle px-4 py-3">
          {loading && (
            <span className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand border-t-[var(--color-brand)]" />
          )}
          <p className="text-sm font-medium text-brand-strong">{statusMessage}</p>
        </div>
      )}

      {showPre && prePhase && prePhase !== "ready" && (
        <div className="rounded-xl border-2 border-dashed border-brand bg-brand-subtle/50 p-4">
          <p className="font-semibold text-[var(--color-ink)]">{PRE_BRIDGE_GUIDE[prePhase].title}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {prePhase === "switch_chain" && chainLabel
              ? PRE_BRIDGE_GUIDE[prePhase].description.replace(
                  "the same testnet you selected",
                  chainLabel
                )
              : PRE_BRIDGE_GUIDE[prePhase].description}
          </p>
          {connectedAddress && (
            <p className="mt-2 font-mono text-xs text-emerald-700">
              Connected: {connectedAddress.slice(0, 6)}…{connectedAddress.slice(-4)}
            </p>
          )}
        </div>
      )}

      {showBridge && (
        <ol className="space-y-2">
          {STEP_ORDER.map((stepId, index) => {
            const guide = STEP_USER_GUIDE[stepId];
            const ui = stepUiState(stepId, steps, loading);
            const live = steps.find((s) => s.name === stepId);

            return (
              <li
                key={stepId}
                className={cn(
                  "rounded-xl border px-4 py-3 transition-colors",
                  ui === "success" && "border-emerald-200 bg-emerald-50",
                  ui === "active" && "border-brand bg-brand-subtle ring-2 ring-brand",
                  ui === "error" && "border-red-200 bg-red-50",
                  ui === "pending" && "border-slate-200 bg-white opacity-70"
                )}
              >
                <div className="flex items-start gap-3">
                  <StepIcon index={index + 1} ui={ui} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{guide.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">{guide.description}</p>

                    {ui === "active" && (
                      <p className="mt-2 rounded-lg bg-white/80 px-2.5 py-2 text-xs font-medium text-brand-strong border border-brand">
                        {guide.requiresWallet ? "🦊 " : "⏳ "}
                        {guide.signHint}
                      </p>
                    )}

                    {ui === "success" && live?.explorerUrl && (
                      <a
                        href={live.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs font-semibold text-brand hover:underline"
                      >
                        View on explorer →
                      </a>
                    )}

                    {ui === "error" && live?.errorMessage && (
                      <p className="mt-2 text-xs text-red-600">{live.errorMessage}</p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function StepIcon({ index, ui }: { index: number; ui: string }) {
  if (ui === "success") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white">
        ✓
      </span>
    );
  }
  if (ui === "error") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white">
        !
      </span>
    );
  }
  if (ui === "active") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-[var(--color-brand)]" />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
      {index}
    </span>
  );
}
