"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import {
  initCircleSdk,
  configureGoogleLogin,
  configureEmailOtpLogin,
  requestEmailOtp,
  setupWalletAfterLogin,
  createServerSession,
  verifyEmailOtp,
  ensureDeviceToken,
  clearCircleDeviceState,
  isDeviceCredentialError,
  type EmailOtpSession,
} from "@/lib/circle-auth";
import { DEVICE_ID_STORAGE_KEY, readDeviceCookies } from "@/lib/circle-device";
function removeCircleOtpIframe(): void {
  document.getElementById("sdkIframe")?.remove();
}

type Props = {
  /** When true, always show loading on mount (OAuth return pages) */
  autoFinish?: boolean;
  onReady?: () => void;
  onError?: (msg: string) => void;
};

/** Circle Google OAuth returns tokens in the URL hash (implicit flow), not ?code=. */
export function isOAuthReturn(): boolean {
  if (typeof window === "undefined") return false;
  const { search, hash } = window.location;
  const hasOAuthHash =
    hash.includes("id_token") ||
    hash.includes("access_token") ||
    /[#&]state=/.test(hash);
  const hasPendingSocial =
    window.localStorage.getItem("socialLoginProvider") === "Google" ||
    window.localStorage.getItem("socialLoginProvider") === "Facebook";
  return (
    search.includes("code=") ||
    search.includes("state=") ||
    hasOAuthHash ||
    (hasPendingSocial && hash.length > 1)
  );
}

export function useCircleLoginBoot(options: Props = {}) {
  const sdkRef = useRef<W3SSdk | null>(null);
  const finishingRef = useRef(false);
  const deviceRetryRef = useRef(false);
  const onErrorRef = useRef(options.onError);
  const onReadyRef = useRef(options.onReady);
  onErrorRef.current = options.onError;
  onReadyRef.current = options.onReady;
  const pendingEmailRef = useRef<string | null>(null);
  const emailOtpSessionRef = useRef<EmailOtpSession | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(options.autoFinish || isOAuthReturn());
  const [message, setMessage] = useState(
    options.autoFinish ? "Completing Google sign-in…" : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [emailOtpSent, setEmailOtpSent] = useState(false);

  const completeLogin = useCallback(async (result: import("@/lib/circle-auth").LoginCompleteResult) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setLoading(true);
    setMessage("Setting up your Solana wallet…");
    setError(null);
    try {
      const wallet = await setupWalletAfterLogin(
        sdkRef.current!,
        result.userToken,
        result.encryptionKey
      );
      setMessage("Starting your session…");
      const deviceId =
        typeof window !== "undefined"
          ? window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)
          : null;
      if (!result.refreshToken) {
        console.warn(
          "[Settlor] Circle login did not return refreshToken — balance pay may require re-login each hour."
        );
      }
      const profile = {
        email: result.profile?.email ?? pendingEmailRef.current ?? undefined,
        displayName: result.profile?.displayName,
      };
      await createServerSession(result.userToken, result.encryptionKey, wallet, profile, {
        refreshToken: result.refreshToken,
        deviceId: deviceId ?? undefined,
      });
      // Clear OAuth params from URL before navigation
      window.history.replaceState({}, "", window.location.pathname);
      window.location.assign("/dashboard");
    } catch (e) {
      finishingRef.current = false;
      const msg = e instanceof Error ? e.message : "Setup failed";
      setError(msg);
      setLoading(false);
      options.onError?.(msg);
    }
  }, [options.onError]);

  const bootstrapSdk = useCallback(async () => {
    if (isOAuthReturn()) {
      setLoading(true);
      setMessage("Completing Google sign-in…");
    }

    const sdk = await initCircleSdk(
      sdkRef,
      (result) => {
        void completeLogin(result);
      },
      (msg) => {
        if (finishingRef.current) return;
        const canceled = /cancel/i.test(msg);
        if (canceled) {
          setLoading(false);
          return;
        }
        if (
          !deviceRetryRef.current &&
          isDeviceCredentialError(msg) &&
          !isOAuthReturn()
        ) {
          deviceRetryRef.current = true;
          clearCircleDeviceState();
          setError(null);
          setLoading(true);
          setMessage("Refreshing device sign-in…");
          void bootstrapSdk().catch((e) => {
            const retryMsg = e instanceof Error ? e.message : "Init failed";
            setError(retryMsg);
            setLoading(false);
            onErrorRef.current?.(retryMsg);
          });
          return;
        }
        setError(msg);
        setLoading(false);
        onErrorRef.current?.(msg);
      },
      {
        forceRefreshDevice: !isOAuthReturn(),
        oauthReturn: isOAuthReturn(),
      }
    );

    setReady(true);
    onReadyRef.current?.();
    return sdk;
  }, [completeLogin]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const me = await fetch("/api/auth/me", { credentials: "include" });
        if (!active) return;
        if (me.ok) {
          window.location.assign("/dashboard");
          return;
        }

        await bootstrapSdk();
        if (!active) return;
      } catch (e) {
        if (!active) return;
        const msg = e instanceof Error ? e.message : "Init failed";
        setError(msg);
        setLoading(false);
        onErrorRef.current?.(msg);
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once on mount
  }, [bootstrapSdk]);

  useEffect(() => {
    if (!isOAuthReturn()) return;
    const timeout = window.setTimeout(() => {
      if (finishingRef.current) return;
      setError((prev) => {
        if (prev) return prev;
        return "Sign-in timed out. Go back to Login and try Google again.";
      });
      setLoading(false);
    }, 90_000);
    return () => window.clearTimeout(timeout);
  }, []);

  const openEmailOtpPopup = useCallback(() => {
    const sdk = sdkRef.current;
    const session = emailOtpSessionRef.current;
    if (!sdk || !session) return;
    setError(null);
    configureEmailOtpLogin(sdk, session);
    verifyEmailOtp(sdk);
  }, []);

  const resetEmailOtpFlow = useCallback(() => {
    removeCircleOtpIframe();
    emailOtpSessionRef.current = null;
    setEmailOtpSent(false);
    setError(null);
    setMessage("");
  }, []);

  const startGoogleLogin = useCallback(async () => {
    const sdk = sdkRef.current;
    if (!sdk) return;
    resetEmailOtpFlow();
    pendingEmailRef.current = null;
    setLoading(true);
    setError(null);
    setMessage("Preparing secure sign-in…");
    try {
      await ensureDeviceToken(sdk, true);
      const { deviceToken, deviceEncryptionKey } = readDeviceCookies();
      if (!deviceToken || !deviceEncryptionKey) {
        throw new Error("Device setup incomplete. Try again.");
      }
      setMessage("Redirecting to Google…");
      configureGoogleLogin(sdk, deviceToken, deviceEncryptionKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not start Google sign-in";
      setError(msg);
      setLoading(false);
      onErrorRef.current?.(msg);
    }
  }, [resetEmailOtpFlow]);

  const sendEmailOtp = useCallback(async (email: string) => {
    const sdk = sdkRef.current;
    if (!sdk) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage("Sending verification code…");
    removeCircleOtpIframe();
    setEmailOtpSent(false);
    emailOtpSessionRef.current = null;
    try {
      pendingEmailRef.current = trimmed;
      const session = await requestEmailOtp(sdk, trimmed);
      emailOtpSessionRef.current = session;
      configureEmailOtpLogin(sdk, session);
      setEmailOtpSent(true);
      setMessage("Enter the code in the verification window.");
      setLoading(false);
      openEmailOtpPopup();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send code";
      setError(msg);
      setLoading(false);
      options.onError?.(msg);
    }
  }, [options.onError, openEmailOtpPopup]);

  const resendEmailOtp = useCallback(async () => {
    if (!pendingEmailRef.current) return;
    await sendEmailOtp(pendingEmailRef.current);
  }, [sendEmailOtp]);

  const resetDeviceLogin = useCallback(() => {
    deviceRetryRef.current = false;
    clearCircleDeviceState();
    window.location.reload();
  }, []);

  return {
    ready,
    loading,
    message,
    error,
    emailOtpSent,
    startGoogleLogin,
    sendEmailOtp,
    resetEmailOtpFlow,
    resendEmailOtp,
    resetDeviceLogin,
    isDeviceError: Boolean(error && isDeviceCredentialError(error)),
  };
}

export default function CircleLoginBoot({ showOverlay }: { showOverlay?: boolean }) {
  const { loading, message, error } = useCircleLoginBoot({ autoFinish: showOverlay });

  if (!showOverlay || (!loading && !error)) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 backdrop-blur-sm p-6">
      <div className="card max-w-sm p-6 text-center shadow-xl">
        {loading && (
          <>
            <div className="spinner mx-auto" />
            <p className="mt-4 text-sm text-[var(--color-muted)]">{message || "Signing you in…"}</p>
          </>
        )}
        {error && (
          <>
            <p className="text-sm text-red-600">{error}</p>
            <a href="/login" className="mt-4 inline-block text-sm font-semibold text-brand">
              Back to login
            </a>
          </>
        )}
      </div>
    </div>
  );
}
