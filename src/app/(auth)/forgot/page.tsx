"use client";

import Link from "next/link";
import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { Alert, Card, Page } from "@/components/ui";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState<"email" | "reset">("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/identity/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Couldn’t send the code. Try again.");
      return;
    }
    setStep("reset");
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/identity/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, newPassword }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Could not update password");
      return;
    }
    window.location.assign("/login");
  }

  return (
    <Page className="flex min-h-screen flex-col justify-center !py-10">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <span className="logo-mark">
            <UtensilsCrossed size={15} strokeWidth={2.5} />
          </span>
          <span className="brand-wordmark">MealWorks</span>
        </Link>
      </div>
      <Card className="mx-auto w-full max-w-md">
        <h1 className="page-title text-[1.75rem]">
          {step === "email" ? "Reset password" : "Enter your code"}
        </h1>
        {step !== "email" && (
          <p className="mt-1 text-sm text-[var(--muted)]">
            Sent to {email.trim().toLowerCase()}.
          </p>
        )}
        {step === "email" ? (
          <form onSubmit={requestCode} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            {error && <Alert tone="bad">{error}</Alert>}
            <button className="btn btn-primary w-full" disabled={loading} type="submit">
              {loading ? "Continuing…" : "Continue"}
            </button>
          </form>
        ) : (
          <form onSubmit={confirm} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="code">
                Code
              </label>
              <input
                id="code"
                className="field tracking-[0.3em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="new-password">
                New password
              </label>
              <input
                id="new-password"
                className="field"
                type="password"
                minLength={10}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            {error && <Alert tone="bad">{error}</Alert>}
            <button className="btn btn-primary w-full" disabled={loading} type="submit">
              {loading ? "Saving…" : "Verify"}
            </button>
          </form>
        )}
        <p className="mt-5 text-center text-sm text-[var(--muted)]">
          <Link
            href="/login"
            className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </Card>
    </Page>
  );
}
