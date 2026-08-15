"use client";

import { useState } from "react";
import {
  Alert,
  Card,
  ChipGroup,
  ChoicePicks,
  Page,
  PageHeader,
  Spinner,
} from "@/components/ui";
import {
  allergyOptionsForContext,
  avoidOptionsForDiet,
  DIET_OPTIONS,
  filterHardAvoidsForDiet,
  GOAL_OPTIONS,
} from "@/lib/pref-options";
import { profileBio } from "@/lib/profile-bio";

const steps = [
  { title: "How do you eat?", hint: "Closest fit is fine." },
  { title: "Hard avoids", hint: "We never recommend these." },
  { title: "Allergies", hint: "Only what you’re allergic to." },
  { title: "Goals", hint: "Optional." },
  { title: "Anything else?", hint: "Free text is OK." },
  { title: "All set?", hint: "One last look." },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [dietType, setDietType] = useState("non_veg");
  const [hardAvoids, setHardAvoids] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{
    allergies: string[];
    hard_avoids: string[];
    summary: string;
  } | null>(null);

  async function interpretAndConfirm() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dietType,
        hardAvoids,
        allergies,
        goals,
        freeformNotes: notes,
        onboardingCompleted: false,
        runAi: true,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Could not interpret");
      return;
    }
    setPreview({
      allergies: data.prefs?.allergies || allergies,
      hard_avoids: data.prefs?.hardAvoids || hardAvoids,
      summary: "",
    });
    setStep(5);
  }

  async function finish(ok: boolean) {
    setLoading(true);
    setError("");
    if (!ok) {
      // allow edit back
      setStep(2);
      setLoading(false);
      return;
    }
    const res = await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        onboardingCompleted: true,
        runAi: false,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Could not finish");
      return;
    }
    window.location.assign("/today");
  }

  async function skip() {
    setLoading(true);
    await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingCompleted: true, runAi: false }),
    });
    window.location.assign("/today");
  }

  const meta = steps[step];
  const skipList = preview
    ? [...new Set([...preview.allergies, ...preview.hard_avoids])]
    : [];
  const bio = profileBio({
    dietType,
    skip: skipList,
    notes,
  });
  const avoidOptions = avoidOptionsForDiet(dietType);
  const allergyOptions = allergyOptionsForContext(dietType, hardAvoids);
  const skipped = hardAvoids.filter((v) =>
    ["pork", "beef", "chicken", "fish", "shellfish"].includes(v)
  );
  const allergyHint =
    skipped.length > 0
      ? `You already skip ${skipped.join(", ")}.`
      : meta.hint;
  const hardAvoidHint =
    dietType === "vegan" ||
    dietType === "vegetarian" ||
    dietType === "eggetarian"
      ? "Extra avoids on top of your diet."
      : meta.hint;

  return (
    <Page>
      <PageHeader
        title="Your profile"
        action={
          <button type="button" className="btn btn-ghost !text-sm" onClick={skip}>
            Skip
          </button>
        }
      />

      <div className="mb-4 flex gap-1.5">
        {steps.map((_, i) => (
          <div key={i} className="progress-dot" data-on={i <= step} />
        ))}
      </div>

      <Card className="animate-in">
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--muted)]">
          {step + 1} / {steps.length}
        </p>
        <h2 className="card-title mt-1 text-xl">{meta.title}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {step === 1 ? hardAvoidHint : step === 2 ? allergyHint : meta.hint}
        </p>

        <div className="mt-5">
          {step === 0 && (
            <ChipGroup
              multi={false}
              options={DIET_OPTIONS}
              selected={[dietType]}
              onChange={(v) => {
                const next = v[0] || "non_veg";
                setDietType(next);
                setHardAvoids((prev) => filterHardAvoidsForDiet(next, prev));
              }}
            />
          )}
          {step === 1 && (
            <ChoicePicks
              options={avoidOptions}
              selected={hardAvoids}
              onChange={setHardAvoids}
              allowCustom
              customPlaceholder="Or type another"
            />
          )}
          {step === 2 && (
            <ChoicePicks
              options={allergyOptions}
              selected={allergies}
              onChange={setAllergies}
              allowCustom
              customPlaceholder="Or type another"
            />
          )}
          {step === 3 && (
            <ChipGroup options={GOAL_OPTIONS} selected={goals} onChange={setGoals} />
          )}
          {step === 4 && (
            <textarea
              className="field min-h-[100px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="lactose intolerant, no raw onion…"
            />
          )}
          {step === 5 && preview && (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-5 py-4">
              <p className="eyebrow">Your plate</p>
              <p className="font-display mt-3 text-[1.15rem] leading-snug tracking-tight text-[var(--ink)]">
                {bio}
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4">
            <Alert tone="bad">{error}</Alert>
          </div>
        )}
        {loading && (
          <div className="mt-4">
            <Spinner label="Working…" />
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {step > 0 && step < 5 && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={loading}
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </button>
          )}
          {step < 4 && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading}
              onClick={() => setStep((s) => s + 1)}
            >
              Continue
            </button>
          )}
          {step === 4 && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading}
              onClick={interpretAndConfirm}
            >
              Review
            </button>
          )}
          {step === 5 && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={loading}
                onClick={() => finish(false)}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading}
                onClick={() => finish(true)}
              >
                Looks good
              </button>
            </>
          )}
        </div>
      </Card>
    </Page>
  );
}
