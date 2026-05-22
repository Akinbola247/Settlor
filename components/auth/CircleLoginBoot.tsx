"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getCookie } from "cookies-next";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import {
  initCircleSdk,
  configureGoogleLogin,
  configureEmailOtpLogin,
  requestEmailOtp,
  setupWalletAfterLogin,
  createServerSession,
  verifyEmailOtp,
  type EmailOtpSession,
} from "@/lib/circle-auth";
function removeCircleOtpIframe(): void {
  document.getElementById("sdkIframe")?.remove();
}

type Props = {
  /** When true, always show loading on mount (OAuth return pages) */
  autoFinish?: boolean;
  onReady?: () => void;
  onError?: (msg: string) => void;
};

function isOAuthReturn(): boolean {
  if (typeof window === "undefined") return false;
  const { search, hash } = window.location;
  return (
    search.includes("code=") ||
    search.includes("state=") ||
    hash.includes("code=") ||
    hash.includes("access_token")
  );
}

export function useCircleLoginBoot(options: Props = {}) {
  const sdkRef = useRef<W3SSdk | null>(null);
  const finishingRef = useRef(false);
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
    setMessage("Creating your Arc wallet…");
    setError(null);
    try {
      const wallet = await setupWalletAfterLogin(
        sdkRef.current!,
        result.userToken,
        result.encryptionKey
      );
      setMessage("Starting your session…");
      const deviceId =
        typeof window !== "undefined" ? window.localStorage.getItem("deviceId") : null;
      if (!result.refreshToken) {
        console.warn(
          "[iPayX] Circle login did not return refreshToken — Arc balance pay may require re-login each hour."
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

        if (isOAuthReturn()) {
          setLoading(true);
          setMessage("Completing Google sign-in…");
        }

        const sdk = await initCircleSdk(
          sdkRef,
          (result) => {
            if (active) void completeLogin(result);
          },
          (msg) => {
            if (!active || finishingRef.current) return;
            const canceled = /cancel/i.test(msg);
            if (!canceled) setError(msg);
            setLoading(false);
            if (!canceled) options.onError?.(msg);
          },
          { forceRefreshDevice: isOAuthReturn() }
        );

        if (!active) return;
        setReady(true);
        options.onReady?.();
      } catch (e) {
        if (!active) return;
        const msg = e instanceof Error ? e.message : "Init failed";
        setError(msg);
        setLoading(false);
        options.onError?.(msg);
      }
    })();

    return () => {
      active = false;
    };
    // Run once on mount — do not re-run when options object identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completeLogin]);

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

  const startGoogleLogin = useCallback(() => {
    const sdk = sdkRef.current;
    if (!sdk) return;
    const deviceToken = getCookie("deviceToken") as string;
    const deviceKey = getCookie("deviceEncryptionKey") as string;
    if (!deviceToken || !deviceKey) {
      setError("Device setup incomplete. Refresh the page.");
      return;
    }
    resetEmailOtpFlow();
    pendingEmailRef.current = null;
    setLoading(true);
    setError(null);
    setMessage("Redirecting to Google…");
    configureGoogleLogin(sdk, deviceToken, deviceKey);
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
            <a href="/login" className="mt-4 inline-block text-sm font-semibold text-orange-600">
              Back to login
            </a>
          </>
        )}
      </div>
    </div>
  );
}
