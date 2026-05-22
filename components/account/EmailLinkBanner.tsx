"use client";

import { useState } from "react";

type Props = {
  currentEmail?: string | null;
  onLinked?: () => void;
};

export default function EmailLinkBanner({ currentEmail, onLinked }: Props) {
  const [email, setEmail] = useState(currentEmail ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (currentEmail) return null;

  return (
    <div className="card mb-6 border-amber-200 bg-amber-50/80 p-5">
      <h2 className="font-serif text-lg font-bold text-amber-900">Link your billing email</h2>
      <p className="mt-1 text-sm text-amber-800">
        Invoices sent to your email appear under <strong>To pay</strong> when this matches the address
        on the invoice. Enter the same email you use to receive invoice notifications.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          className="field-input flex-1"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="button"
          className="btn-accent shrink-0"
          disabled={loading || !email}
          onClick={async () => {
            setLoading(true);
            setError(null);
            setMessage(null);
            try {
              const res = await fetch("/api/auth/profile", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error ?? "Failed to save email");
              setMessage(
                data.invoicesLinked > 0
                  ? `Email saved. ${data.invoicesLinked} invoice(s) linked to your account.`
                  : "Email saved. New invoices to this address will show in To pay."
              );
              onLinked?.();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed");
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Saving…" : "Save & link invoices"}
        </button>
      </div>
      {message && <p className="mt-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <p className="mt-3 text-xs text-amber-700">
        Tip: Sign out and sign in again with Google so your email is captured automatically next time.
      </p>
    </div>
  );
}
