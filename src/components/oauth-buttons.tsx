"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

export function OAuthButtons({ label = "Continue" }: { label?: string }) {
  const [oauth, setOauth] = useState({ google: false, apple: false });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/identity/oauth")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.oauth) setOauth(d.oauth);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!oauth.google && !oauth.apple) return null;

  return (
    <div className="space-y-2">
      <div className="relative my-5 text-center">
        <span className="bg-[var(--card)] relative z-[1] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          or
        </span>
        <span className="absolute inset-x-0 top-1/2 h-px bg-[var(--line)]" />
      </div>
      {oauth.google && (
        <button
          type="button"
          className="btn btn-secondary w-full"
          onClick={() => signIn("google", { callbackUrl: "/continue" })}
        >
          {label} with Google
        </button>
      )}
      {oauth.apple && (
        <button
          type="button"
          className="btn btn-secondary w-full"
          onClick={() => signIn("apple", { callbackUrl: "/continue" })}
        >
          {label} with Apple
        </button>
      )}
    </div>
  );
}
