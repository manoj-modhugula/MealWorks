"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useExperience } from "./experience-provider";
import { Alert, Page } from "./ui";
import { SettingsAppearance } from "./settings-appearance";

type Digest = {
  payload: {
    headline: string;
    summary: string;
    plates: { meal: "breakfast" | "lunch"; items: string[] }[];
  };
};

export default function DemoSettings() {
  const { requestJson } = useExperience();
  const [digest, setDigest] = useState<Digest | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    requestJson<{ digest: Digest }>("/api/digests/latest", {
      signal: controller.signal,
    })
      .then(({ digest: next }) => {
        if (!controller.signal.aborted) setDigest(next);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Could not prepare your digest preview.");
      });
    return () => controller.abort();
  }, [requestJson, attempt]);

  return (
    <Page className="settings-demo-page">
      <header className="kitchen-heading">
        <div>
          <h1>Make yourself at home</h1>
        </div>
      </header>
      <div className="settings-layout">
        <SettingsAppearance />
        <section
          className="settings-panel morning-preview"
          aria-labelledby="morning-digest-title"
        >
          <header>
            <h2 id="morning-digest-title">Morning digest</h2>
            <span className="settings-sample-label">Sample</span>
          </header>
          <div
            className="morning-preview-content"
            aria-busy={!digest && !error}
          >
            {error ? (
              <>
                <Alert tone="bad">{error}</Alert>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  Try again
                </button>
              </>
            ) : digest ? (
              <>
                <h3>{digest.payload.headline}</h3>
                {!digest.payload.plates.length && (
                  <p className="morning-summary">{digest.payload.summary}</p>
                )}
                {!!digest.payload.plates.length && (
                  <ul className="morning-plates">
                    {digest.payload.plates.map((plate) => (
                      <li key={plate.meal}>
                        <Check size={17} aria-hidden="true" />
                        <span>
                          <span className="morning-meal">
                            {plate.meal === "breakfast" ? "Breakfast" : "Lunch"}
                          </span>
                          <span aria-hidden="true"> · </span>
                          {plate.items.join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="morning-loading" role="status">
                Preparing your picks…
              </p>
            )}
            <p className="morning-preview-notice">
              Preview only. No emails are sent.
            </p>
          </div>
          <footer className="morning-footer">
            <Link href="/demo/today">
              See today’s picks <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </footer>
        </section>
      </div>
      <footer className="settings-demo-about">
        <p>
          Sample menu. Preferences and reviews reset on reload; appearance stays
          saved on this device.
        </p>
      </footer>
    </Page>
  );
}
