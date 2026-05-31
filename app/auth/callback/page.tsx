"use client";

import { SettlorLogoMark } from "@/components/brand/SettlorLogo";
import { useCircleLoginBoot } from "@/components/auth/CircleLoginBoot";

/**
 * Google OAuth redirect target — must match NEXT_PUBLIC_GOOGLE_REDIRECT_URI
 * and Google Cloud Console “Authorized redirect URIs” exactly.
 */
export default function AuthCallbackPage() {
  const { loading, message, error, resetDeviceLogin, isDeviceError } = useCircleLoginBoot({
    autoFinish: true,
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface)] p-6">
      <div className="card max-w-md w-full p-8 text-center shadow-lg">
        <div className="mb-4 flex justify-center">
          <SettlorLogoMark size="lg" />
        </div>
        <h1 className="font-display text-xl font-bold">Finishing sign-in</h1>
        {loading && (
          <>
            <div className="spinner mx-auto mt-6" />
            <p className="mt-4 text-sm text-[var(--color-muted)]">
              {message || "Setting up your wallet…"}
            </p>
          </>
        )}
        {error && (
          <>
            <p className="mt-4 text-sm text-red-600">{error}</p>
            {isDeviceError ? (
              <button
                type="button"
                className="btn-accent mt-6 inline-flex"
                onClick={resetDeviceLogin}
              >
                Reset sign-in and try again
              </button>
            ) : (
              <a href="/login" className="btn-accent mt-6 inline-flex">
                Try again
              </a>
            )}
          </>
        )}
        {!loading && !error && (
          <p className="mt-4 text-sm text-[var(--color-muted)]">Redirecting…</p>
        )}
      </div>
    </div>
  );
}
