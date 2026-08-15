"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { Alert, Card, Page } from "@/components/ui";
import { OAuthButtons } from "@/components/oauth-buttons";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"form" | "otp">("form");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Could not create account");
      return;
    }
    setStep("otp");
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/register/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(data.error || "That code didn’t work");
      return;
    }
    const login = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      callbackUrl: "/continue",
    });
    if (login?.error) {
      setLoading(false);
      setError("Account ready. Sign in to continue.");
    }
  }

  async function resend() {
    setError("");
    const res = await fetch("/api/register/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Couldn’t send the code. Try again.");
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
          {step === "form" ? "Create account" : "Enter your code"}
        </h1>
        {step !== "form" && (
          <p className="mt-1 text-sm text-[var(--muted)]">
            Sent to {email.trim().toLowerCase()}.
          </p>
        )}

        {step === "form" ? (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
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
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="field"
                type="password"
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            {error && <Alert tone="bad">{error}</Alert>}
            <button className="btn btn-primary w-full" disabled={loading} type="submit">
              {loading ? "Creating…" : "Sign up"}
            </button>
          </form>
        ) : (
          <form onSubmit={onVerify} className="mt-6 space-y-4">
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
            {error && <Alert tone="bad">{error}</Alert>}
            <button className="btn btn-primary w-full" disabled={loading} type="submit">
              {loading ? "Checking…" : "Verify"}
            </button>
            <p className="text-center text-sm text-[var(--muted)]">
              <button
                type="button"
                className="font-semibold text-[var(--accent)]"
                disabled={loading}
                onClick={resend}
              >
                Resend
              </button>
              {" · "}
              <button
                type="button"
                className="font-semibold text-[var(--accent)]"
                onClick={() => {
                  setStep("form");
                  setCode("");
                  setError("");
                }}
              >
                Different email
              </button>
            </p>
          </form>
        )}

        {step === "form" && <OAuthButtons label="Sign up" />}

        <p className="mt-5 text-center text-sm text-[var(--muted)]">
          Have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </Card>
    </Page>
  );
}
