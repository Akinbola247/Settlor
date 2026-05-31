import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { waitForTransferCompletion } from "@/lib/circle-transfer";

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const challengeId = new URL(request.url).searchParams.get("challengeId");
  if (!challengeId) {
    return NextResponse.json({ error: "Missing challengeId" }, { status: 400 });
  }

  try {
    const { txHash, explorerUrl } = await waitForTransferCompletion(
      session.circleUserToken,
      challengeId,
      { maxAttempts: 1, intervalMs: 0 }
    );
    return NextResponse.json({
      status: "complete",
      txHash,
      explorerUrl,
      steps: [{ name: "sol_transfer", state: "success", explorerUrl }],
    });
  } catch {
    return NextResponse.json({ status: "pending" });
  }
}
