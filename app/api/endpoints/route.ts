import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { circleFetch, circleErrorMessage, getWalletBalances, extractUsdcBalance } from "@/lib/circle";

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    const body = await request.json();
    const { action, ...params } = body ?? {};

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    if (action === "createDeviceToken") {
      const { deviceId } = params;
      if (!deviceId) {
        return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
      }

      const { ok, status, data } = await circleFetch<{ deviceToken: string; deviceEncryptionKey: string }>(
        "/v1/w3s/users/social/token",
        {
          method: "POST",
          body: {
            idempotencyKey: crypto.randomUUID(),
            deviceId,
          },
        }
      );

      if (!ok) {
        return NextResponse.json(
          { error: circleErrorMessage(data, "Device token failed") },
          { status }
        );
      }
      return NextResponse.json(data);
    }

    if (action === "requestEmailOtp") {
      const { deviceId, email } = params;
      if (!deviceId || !email) {
        return NextResponse.json({ error: "Missing deviceId or email" }, { status: 400 });
      }

      const { ok, status, data } = await circleFetch<{
        deviceToken: string;
        deviceEncryptionKey: string;
        otpToken: string;
      }>("/v1/w3s/users/email/token", {
        method: "POST",
        body: {
          idempotencyKey: crypto.randomUUID(),
          deviceId: String(deviceId),
          email: String(email).trim().toLowerCase(),
        },
      });

      if (!ok) {
        return NextResponse.json(
          { error: circleErrorMessage(data, "Failed to send verification code") },
          { status }
        );
      }
      return NextResponse.json(data);
    }

    const userToken =
      session?.circleUserToken ?? (params.userToken as string | undefined);
    if (!userToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    switch (action) {
      case "initializeUser": {
        const { ok, status, data } = await circleFetch<{ challengeId: string }>(
          "/v1/w3s/user/initialize",
          {
            method: "POST",
            userToken,
            body: {
              idempotencyKey: crypto.randomUUID(),
              accountType: "SCA",
              blockchains: ["ARC-TESTNET"],
            },
          }
        );
        if (!ok) {
          return NextResponse.json(
            { ...(typeof data === "object" && data ? data : {}), error: circleErrorMessage(data, "Initialize failed") },
            { status }
          );
        }
        return NextResponse.json(data);
      }

      case "listWallets": {
        const { ok, status, data } = await circleFetch<{ wallets: unknown[] }>(
          "/v1/w3s/wallets",
          { userToken }
        );
        if (!ok) {
          return NextResponse.json(
            { error: circleErrorMessage(data, "List wallets failed") },
            { status }
          );
        }
        return NextResponse.json(data);
      }

      case "getTokenBalance": {
        const walletId = params.walletId ?? session?.user.walletId;
        if (!walletId) {
          return NextResponse.json({ error: "Missing walletId" }, { status: 400 });
        }
        const balances = await getWalletBalances(userToken, walletId);
        if (!balances) {
          return NextResponse.json({ error: "Failed to load balance" }, { status: 500 });
        }
        return NextResponse.json({
          tokenBalances: balances,
          usdc: extractUsdcBalance(balances),
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in /api/endpoints:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
