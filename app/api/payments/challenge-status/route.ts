import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  waitForChallengeSignature,
  waitForChallengeTxHash,
  waitForSignTransactionChallenge,
} from "@/lib/circle-challenges";

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const challengeId = url.searchParams.get("challengeId");
  const kind = url.searchParams.get("kind") ?? "tx";

  if (!challengeId) {
    return NextResponse.json({ error: "Missing challengeId" }, { status: 400 });
  }

  try {
    if (kind === "signature" || kind === "sign-transaction") {
      const result = await waitForSignTransactionChallenge(
        session.circleUserToken,
        challengeId,
        { maxAttempts: 1, intervalMs: 0 }
      );
      return NextResponse.json({ status: "complete", ...result });
    }

    const txHash = await waitForChallengeTxHash(
      session.circleUserToken,
      challengeId,
      { maxAttempts: 1, intervalMs: 0 }
    );
    return NextResponse.json({ status: "complete", txHash });
  } catch {
    return NextResponse.json({ status: "pending" });
  }
}
