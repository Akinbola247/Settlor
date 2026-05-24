/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { getCookie, setCookie } from "cookies-next";
import { SocialLoginProvider } from "@circle-fin/w3s-pw-web-sdk/dist/src/types";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import { circleErrorMessage } from "@/lib/circle";
import {
  clearCircleDeviceState,
  clearDeviceTokenCookies,
  deviceCookieOptions,
  hasDeviceCookies,
  isDeviceCredentialError,
  readDeviceCookies,
  resolveDeviceId,
  setDeviceCookies,
} from "@/lib/circle-device";

const appId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID as string;
const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID as string;

/** Must match Google Cloud Console → OAuth client → Authorized redirect URIs exactly. */
export function getGoogleRedirectUri(): string {
  const configured = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI?.trim();
  if (configured) return configured;
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/callback`;
  }
  return "";
}

function loginRedirectUri(): string {
  return getGoogleRedirectUri();
}

/** Circle stores provider in localStorage before OAuth redirect; restore if ITP cleared it. */
function restoreSocialLoginProviderFromUrl(): void {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem("socialLoginProvider")) return;
  const hash = window.location.hash;
  if (hash.includes("id_token")) {
    window.localStorage.setItem("socialLoginProvider", "Google");
  } else if (hash.includes("access_token")) {
    window.localStorage.setItem("socialLoginProvider", "Facebook");
  }
}

export type WalletInfo = {
  id: string;
  address: string;
  blockchain: string;
};

export { clearCircleDeviceState, isDeviceCredentialError } from "@/lib/circle-device";

async function createDeviceTokenForSdk(sdk: W3SSdk): Promise<void> {
  const deviceId = await resolveDeviceId(sdk);
  const res = await fetch("/api/endpoints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action: "createDeviceToken", deviceId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(circleErrorMessage(data, "Failed to create device token"));
  }
  if (!data.deviceToken || !data.deviceEncryptionKey) {
    throw new Error("Invalid device token response");
  }
  setDeviceCookies(data.deviceToken, data.deviceEncryptionKey);
}

/** Ensure device token cookies exist before OAuth / challenge execution. */
export async function ensureDeviceToken(sdk: W3SSdk, forceRefresh = false): Promise<void> {
  if (forceRefresh) {
    clearDeviceTokenCookies();
  } else if (hasDeviceCookies()) {
    return;
  }

  try {
    await createDeviceTokenForSdk(sdk);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isDeviceCredentialError(msg)) throw e;
    clearCircleDeviceState();
    await createDeviceTokenForSdk(sdk);
  }
}

function googleConfig() {
  return {
    clientId: (getCookie("google.clientId") as string) || googleClientId || "",
    redirectUri: loginRedirectUri(),
    selectAccountPrompt: true,
  };
}

/** Apply device + user auth to SDK before REST challenge execute. */
export function syncSdkAuth(
  sdk: W3SSdk,
  userToken: string,
  encryptionKey: string
) {
  const { deviceToken, deviceEncryptionKey } = readDeviceCookies();
  const authentication = { userToken, encryptionKey };
  // updateConfigs replaces configs entirely — authentication must be included
  sdk.updateConfigs({
    appSettings: { appId: (getCookie("appId") as string) || appId },
    authentication,
    loginConfigs: {
      deviceToken,
      deviceEncryptionKey,
      google: googleConfig(),
    },
  });
  sdk.setAuthentication(authentication);
}

export type LoginCompleteResult = {
  userToken: string;
  encryptionKey: string;
  refreshToken?: string;
  profile?: { email?: string; displayName?: string };
};

const CIRCLE_CREDS_STORAGE_KEY = "ipayx_circle_creds";

export function storeClientCircleCreds(creds: {
  userToken: string;
  encryptionKey: string;
  refreshToken?: string;
}) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CIRCLE_CREDS_STORAGE_KEY, JSON.stringify(creds));
}

export function readClientCircleCreds(): {
  userToken: string;
  encryptionKey: string;
  refreshToken?: string;
} | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(CIRCLE_CREDS_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      userToken: string;
      encryptionKey: string;
      refreshToken?: string;
    };
  } catch {
    return null;
  }
}

/** Configure SDK for challenge execution (invoice pay, wallet setup). */
export async function prepareSdkForPayment(
  sdkRef: React.MutableRefObject<W3SSdk | null>,
  userToken: string,
  encryptionKey: string
): Promise<W3SSdk> {
  const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
  const { deviceToken, deviceEncryptionKey } = readDeviceCookies();

  if (!sdkRef.current) {
    sdkRef.current = new W3SSdk(
      {
        appSettings: { appId: (getCookie("appId") as string) || appId },
        loginConfigs: {
          deviceToken,
          deviceEncryptionKey,
          google: googleConfig(),
        },
      },
      () => {
        /* noop — payment flow does not use OAuth callback */
      }
    );
  }

  const sdk = sdkRef.current;
  await ensureDeviceToken(sdk, false);
  syncSdkAuth(sdk, userToken, encryptionKey);
  sdk.setAppSettings({ appId: (getCookie("appId") as string) || appId });
  return sdk;
}

export async function initCircleSdk(
  sdkRef: React.MutableRefObject<W3SSdk | null>,
  onLoginComplete: (result: LoginCompleteResult) => void,
  onError: (msg: string) => void,
  options?: { forceRefreshDevice?: boolean; oauthReturn?: boolean }
) {
  const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
  const oauthReturn = options?.oauthReturn ?? false;
  let { deviceToken, deviceEncryptionKey } = readDeviceCookies();

  const loginCallback = (error: unknown, result: unknown) => {
    if (error) {
      const err = error as { message?: string };
      onError(err.message || "Login failed");
      return;
    }
    const r = result as {
      userToken?: string;
      encryptionKey?: string;
      refreshToken?: string;
      oAuthInfo?: { socialUserInfo?: { email?: string; name?: string } };
    };
    if (!r?.userToken || !r?.encryptionKey) {
      onError("Login completed without credentials");
      return;
    }
    const social = r.oAuthInfo?.socialUserInfo;
    onLoginComplete({
      userToken: r.userToken,
      encryptionKey: r.encryptionKey,
      refreshToken: r.refreshToken,
      profile: {
        email: social?.email,
        displayName: social?.name,
      },
    });
  };

  /**
   * OAuth return: keep the same device token that was used before redirect.
   * Refreshing here invalidates the token and breaks Circle hash verification.
   */
  if (oauthReturn) {
    if (!deviceToken || !deviceEncryptionKey) {
      throw new Error(
        "Sign-in session expired during redirect. Return to Login and try Google again."
      );
    }

    restoreSocialLoginProviderFromUrl();

    const sdk = new W3SSdk(
      {
        appSettings: { appId: (getCookie("appId") as string) || appId },
        loginConfigs: {
          deviceToken,
          deviceEncryptionKey,
          google: googleConfig(),
        },
      },
      loginCallback
    );

    sdkRef.current = sdk;
    return sdk;
  }

  const sdk = new W3SSdk(
    {
      appSettings: { appId: (getCookie("appId") as string) || appId },
      loginConfigs: {
        deviceToken,
        deviceEncryptionKey,
        google: googleConfig(),
      },
    },
    loginCallback
  );

  sdkRef.current = sdk;
  await ensureDeviceToken(sdk, options?.forceRefreshDevice ?? false);

  const fresh = readDeviceCookies();
  sdk.updateConfigs({
    appSettings: { appId },
    loginConfigs: {
      deviceToken: fresh.deviceToken,
      deviceEncryptionKey: fresh.deviceEncryptionKey,
      google: googleConfig(),
    },
  });

  return sdk;
}

export type EmailOtpSession = {
  deviceToken: string;
  deviceEncryptionKey: string;
  otpToken: string;
};

export async function requestEmailOtp(
  sdk: W3SSdk,
  email: string
): Promise<EmailOtpSession> {
  const runOtpRequest = async () => {
    const deviceId = await resolveDeviceId(sdk);
    const res = await fetch("/api/endpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        action: "requestEmailOtp",
        deviceId,
        email: email.trim().toLowerCase(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(circleErrorMessage(data, "Failed to send verification code"));
    }
    if (!data.deviceToken || !data.deviceEncryptionKey || !data.otpToken) {
      throw new Error("Invalid response from email verification service");
    }
    setDeviceCookies(data.deviceToken, data.deviceEncryptionKey);
    return data;
  };

  let data: Awaited<ReturnType<typeof runOtpRequest>>;
  try {
    data = await runOtpRequest();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isDeviceCredentialError(msg)) throw e;
    clearCircleDeviceState();
    data = await runOtpRequest();
  }
  return {
    deviceToken: data.deviceToken,
    deviceEncryptionKey: data.deviceEncryptionKey,
    otpToken: data.otpToken,
  };
}

export function configureEmailOtpLogin(
  sdk: W3SSdk,
  session: EmailOtpSession
) {
  const cookieOpts = deviceCookieOptions();
  setCookie("appId", appId, cookieOpts);
  setDeviceCookies(session.deviceToken, session.deviceEncryptionKey);

  sdk.updateConfigs({
    appSettings: { appId },
    loginConfigs: {
      deviceToken: session.deviceToken,
      deviceEncryptionKey: session.deviceEncryptionKey,
      otpToken: session.otpToken,
      google: googleConfig(),
    },
  });
}

export function verifyEmailOtp(sdk: W3SSdk) {
  sdk.verifyOtp();
}

export function configureGoogleLogin(sdk: W3SSdk, deviceToken: string, deviceKey: string) {
  const cookieOpts = deviceCookieOptions();
  setCookie("appId", appId, cookieOpts);
  setCookie("google.clientId", googleClientId, cookieOpts);
  setDeviceCookies(deviceToken, deviceKey);

  sdk.updateConfigs({
    appSettings: { appId },
    loginConfigs: {
      deviceToken,
      deviceEncryptionKey: deviceKey,
      google: {
        clientId: googleClientId,
        redirectUri: loginRedirectUri(),
        selectAccountPrompt: true,
      },
    },
  });
  sdk.performLogin(SocialLoginProvider.GOOGLE);
}

async function listWallets(userToken: string): Promise<WalletInfo[]> {
  const res = await fetch("/api/endpoints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "listWallets", userToken }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(circleErrorMessage(data, "Failed to list wallets"));
  }
  return (data.wallets ?? []) as WalletInfo[];
}

export async function setupWalletAfterLogin(
  sdk: W3SSdk,
  userToken: string,
  encryptionKey: string
): Promise<WalletInfo> {
  syncSdkAuth(sdk, userToken, encryptionKey);

  const initRes = await fetch("/api/endpoints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "initializeUser", userToken }),
  });
  const initData = await initRes.json();

  // Already initialized — skip challenge, list wallets
  if (!initRes.ok && initData.code === 155106) {
    const wallets = await listWallets(userToken);
    if (!wallets.length) throw new Error("No wallet found for your account");
    return wallets[0];
  }

  if (!initRes.ok) {
    throw new Error(circleErrorMessage(initData, "Failed to initialize wallet"));
  }

  if (initData.challengeId) {
    try {
      await new Promise<void>((resolve, reject) => {
        sdk.execute(initData.challengeId, (error) => {
          if (error) {
            reject(new Error((error as any).message ?? "Wallet challenge failed"));
          } else {
            resolve();
          }
        });
      });
      await new Promise((r) => setTimeout(r, 2000));
    } catch (executeErr) {
      // Wallet may already exist if challenge was consumed (e.g. double mount)
      const wallets = await listWallets(userToken).catch(() => [] as WalletInfo[]);
      if (wallets.length > 0) return wallets[0];
      throw executeErr;
    }
  }

  const wallets = await listWallets(userToken);
  if (!wallets.length) throw new Error("No wallet found after setup");
  return wallets[0];
}

export async function createServerSession(
  userToken: string,
  encryptionKey: string,
  wallet: WalletInfo,
  profile?: { email?: string; displayName?: string },
  circleMeta?: { refreshToken?: string; deviceId?: string }
) {
  storeClientCircleCreds({
    userToken,
    encryptionKey,
    refreshToken: circleMeta?.refreshToken,
  });

  const res = await fetch("/api/auth/session", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userToken,
      encryptionKey,
      walletAddress: wallet.address,
      walletId: wallet.id,
      ...(circleMeta?.refreshToken ? { refreshToken: circleMeta.refreshToken } : {}),
      ...(circleMeta?.deviceId ? { deviceId: circleMeta.deviceId } : {}),
      ...(profile?.email ? { email: profile.email } : {}),
      ...(profile?.displayName ? { displayName: profile.displayName } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? circleErrorMessage(body, "Session failed"));
  }
  return res.json();
}
