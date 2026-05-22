"use client";

import { useState } from "react";
import Link from "next/link";
import { useCircleLoginBoot } from "@/components/auth/CircleLoginBoot";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const {
    ready,
    loading,
    message,
    error,
    emailOtpSent,
    startGoogleLogin,
    sendEmailOtp,
    resetEmailOtpFlow,
    resendEmailOtp,
  } = useCircleLoginBoot();

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="gradient-hero flex flex-col justify-between p-10 text-white lg:p-14">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-brand)] text-sm font-bold">
            ₿
          </span>
          <span className="font-serif text-2xl font-bold">iPayX</span>
        </Link>
        <div>
          <h1 className="font-serif text-4xl font-bold leading-tight lg:text-5xl">
            Take control of your USDC payments.
          </h1>
          <p className="mt-4 max-w-md text-lg text-slate-300">
            Invoice clients, get paid from any chain, and hold a unified balance on Arc — powered by Circle.
          </p>
        </div>
        <p className="text-xs text-slate-500">Secured by Circle W3S · Arc Testnet</p>
      </div>

      <div className="flex items-center justify-center bg-white p-8 lg:p-14">
        <div className="w-full max-w-md">
          <h2 className="font-serif text-3xl font-bold text-[var(--color-ink)]">Sign in</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Sign in with email or Google to access your wallet and invoices.
          </p>
        
          <div className="mt-5 space-y-4">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!emailOtpSent) void sendEmailOtp(email);
              }}
            >
              <label className="field-label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                className="field-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || emailOtpSent}
              />

              {!emailOtpSent ? (
                <button
                  type="submit"
                  className="btn-accent w-full"
                  disabled={!ready || loading || !email.trim()}
                >
                  {loading ? message || "Please wait…" : "Send verification code"}
                </button>
              ) : (
                <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-slate-50 px-4 py-3">
                  <p className="text-sm text-[var(--color-ink)]">
                    We sent a code to <strong>{email}</strong>.
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    A verification window should open automatically — enter the code there. If you
                    closed it, click <strong className="text-[var(--color-ink)]">Resend code</strong>{" "}
                    to open it again.
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <button
                      type="button"
                      className="font-medium text-orange-600 hover:underline disabled:opacity-50"
                      disabled={!ready || loading}
                      onClick={() => void resendEmailOtp()}
                    >
                      Resend code
                    </button>
                    <button
                      type="button"
                      className="text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:underline"
                      disabled={loading}
                      onClick={() => resetEmailOtpFlow()}
                    >
                      Use a different email
                    </button>
                  </div>
                </div>
              )}
            </form>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--color-border)]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-[var(--color-muted)]">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={startGoogleLogin}
              disabled={!ready || loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--color-border)] bg-white px-6 py-4 text-sm font-semibold shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading && message && !emailOtpSent && (
              <p className="text-center text-xs text-[var(--color-muted)]">{message}</p>
            )}

            <p className="text-center text-xs text-[var(--color-muted)]">
              By continuing you agree to our testnet terms. See{" "}
              <Link href="/help" className="text-orange-600 hover:underline">
                Help
              </Link>{" "}
              for data handling in this POC.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-[var(--color-muted)]">
            <Link href="/" className="font-semibold text-orange-600 hover:underline">
              Home
            </Link>
            <Link href="/how-it-works" className="hover:text-[var(--color-ink)]">
              How it works
            </Link>
            <Link href="/about" className="hover:text-[var(--color-ink)]">
              About
            </Link>
            <Link href="/help" className="hover:text-[var(--color-ink)]">
              Help
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
