export type BridgeStepProof = {
  name: string;
  state: string;
  explorerUrl?: string;
};

/** Client must supply successful payment steps before marking an invoice paid. */
export function validatePaymentProof(
  steps: BridgeStepProof[],
  txHash: string
): { ok: true; reference: string } | { ok: false; error: string } {
  if (!steps?.length) {
    return { ok: false, error: "Payment proof required" };
  }

  const arcTransfer = steps.find((s) => s.name === "arc_transfer");
  if (arcTransfer?.state === "success") {
    const reference = (arcTransfer.explorerUrl ?? txHash).trim();
    if (reference.length < 8) {
      return { ok: false, error: "Invalid transaction reference" };
    }
    return { ok: true, reference };
  }

  const mint = steps.find((s) => s.name === "mint");
  if (!mint || mint.state !== "success") {
    return { ok: false, error: "Payment not confirmed (mint or Arc transfer did not succeed)" };
  }

  const reference = (mint.explorerUrl ?? txHash).trim();
  if (reference.length < 8) {
    return { ok: false, error: "Invalid transaction reference" };
  }

  const burn = steps.find((s) => s.name === "burn");
  if (burn && burn.state === "error") {
    return { ok: false, error: "Bridge transfer step failed on source chain" };
  }

  return { ok: true, reference };
}

/** @deprecated Use validatePaymentProof */
export const validateBridgePaymentProof = validatePaymentProof;
