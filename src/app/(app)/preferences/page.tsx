"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useExperience } from "@/components/experience-provider";
import { Alert, Page, PageSkeleton } from "@/components/ui";
import {
  DIET_LABELS,
  GOAL_LABELS,
  instructionsFromPreferences,
  noteLabel,
  parseKitchenNotes,
} from "@/lib/kitchen-notes";
import type { PrefsInput } from "@/lib/types";

type Preferences = PrefsInput & {
  userFacingSummary: string;
  temporaryRestrictions: {
    id: string;
    label: string;
    endsOn: string;
  }[];
};
const profileKey = (prefs: Preferences) =>
  JSON.stringify([
    prefs.dietType,
    prefs.likes,
    prefs.hardAvoids,
    prefs.softDislikes,
    prefs.allergies,
    prefs.goals,
    prefs.freeformNotes,
  ]);

export default function PreferencesPage() {
  const { requestJson, getCache, setCache, invalidateCache } = useExperience();
  const cached = getCache<Preferences>("prefs");
  const [prefs, setPrefs] = useState<Preferences | null>(cached ?? null);
  const [saved, setSaved] = useState<Preferences | null>(cached ?? null);
  const [instructions, setInstructions] = useState(
    cached ? instructionsFromPreferences(cached) : "",
  );
  const [reviewed, setReviewed] = useState(instructions);
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const edited = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const reviewStatus = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    requestJson<{ prefs: Preferences | null }>("/api/preferences", {
      signal: controller.signal,
    })
      .then(({ prefs: next }) => {
        if (!next)
          throw new Error(
            "Your food preferences could not be loaded. Please refresh to try again.",
          );
        if (!edited.current) {
          setPrefs(next);
          setSaved(next);
          const text = instructionsFromPreferences(next);
          setInstructions(text);
          setReviewed(text);
        }
        setCache("prefs", next, 300_000);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load preferences.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [requestJson, setCache]);

  useLayoutEffect(() => {
    const field = input.current;
    if (!field) return;
    function fitInstructions() {
      if (!field) return;
      field.style.height = "0px";
      field.style.height = `${Math.min(240, Math.max(44, field.scrollHeight))}px`;
    }
    fitInstructions();
    // Observe width changes, not the textarea height that this effect updates.
    const container = field.parentElement;
    let width = container?.clientWidth;
    const resizeObserver = new ResizeObserver(() => {
      if (container?.clientWidth !== width) {
        width = container?.clientWidth;
        fitInstructions();
      }
    });
    if (container) resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [instructions]);

  const needsReview = instructions !== reviewed;
  const dirty = !!prefs && !!saved && profileKey(prefs) !== profileKey(saved);

  function review() {
    if (!prefs) return;
    const result = parseKitchenNotes(instructions, prefs.dietType);
    setUnresolved(result.unresolved);
    setError("");
    setMessage("");
    if (result.unresolved.length) return;
    setPrefs({ ...prefs, ...result.prefs });
    setReviewed(instructions);
    setMessage("Notes grouped. Check your preferences below before saving.");
    requestAnimationFrame(() =>
      reviewStatus.current?.focus({ preventScroll: true }),
    );
  }

  function edit(group: "pattern" | "ingredients") {
    const field = input.current;
    if (!field) return;
    field.focus({ preventScroll: true });
    const match =
      group === "pattern"
        ? /(?:eating style:|i(?:’m|'m| am) (?:an? )?(?:vegan|vegetarian|omnivore)|i follow my own eating preferences)[^.;]*/i.exec(
            instructions,
          )
        : /(?:i love|avoid|allergic to|less of)[^.;]*/i.exec(instructions);
    if (match)
      field.setSelectionRange(match.index, match.index + match[0].length);
    field.scrollIntoView({ block: "nearest", behavior: "auto" });
  }

  function cancel() {
    if (!saved) return;
    const text = instructionsFromPreferences(saved);
    setPrefs(saved);
    setInstructions(text);
    setReviewed(text);
    setUnresolved([]);
    setError("");
    setMessage("");
    edited.current = false;
  }

  async function save() {
    if (!prefs || !dirty || needsReview || unresolved.length || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { prefs: next } = await requestJson<{ prefs: Preferences }>(
        "/api/preferences",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...prefs,
            runAi: true,
            onboardingCompleted: true,
          }),
        },
      );
      setPrefs(next);
      setSaved(next);
      setReviewed(instructions);
      edited.current = false;
      setCache("prefs", next, 300_000);
      invalidateCache("today:");
      invalidateCache("week:");
      setMessage("Preferences saved. Your picks on Today are updated.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save preferences. Your edits are still here.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page className="kitchen-page">
      <header className="kitchen-heading">
        <div>
          <h1>Your kitchen notes</h1>
          <p>Tell us how you like to eat.</p>
        </div>
        {prefs && (
          <span className="kitchen-status" role="status">
            {saving ? (
              "Saving…"
            ) : needsReview ? (
              "Notes to review"
            ) : dirty ? (
              "Unsaved changes"
            ) : (
              <>
                <Check size={15} aria-hidden="true" /> Saved
              </>
            )}
          </span>
        )}
      </header>
      {loading && !prefs && <PageSkeleton rows={3} />}
      {error && <Alert tone="bad">{error}</Alert>}
      {prefs && (
        <>
          <form
            className="kitchen-composer"
            onSubmit={(event) => {
              event.preventDefault();
              review();
            }}
          >
            <label className="sr-only" htmlFor="kitchen-instructions">
              Your food instructions
            </label>
            <div className="kitchen-input-row">
              <textarea
                ref={input}
                id="kitchen-instructions"
                rows={1}
                maxLength={2000}
                value={instructions}
                disabled={saving}
                aria-describedby="kitchen-help"
                placeholder="I’m vegetarian, love mushrooms, avoid cream, and I’m allergic to nuts."
                onChange={(event) => {
                  edited.current = true;
                  setInstructions(event.target.value);
                  setMessage("");
                  setUnresolved([]);
                }}
              />
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={!needsReview || !instructions.trim() || saving}
              >
                Review notes
              </button>
            </div>
            <p id="kitchen-help">
              Write naturally. Review your notes before saving.
            </p>
          </form>
          {!!unresolved.length && (
            <div className="kitchen-unresolved" role="alert">
              <p>These instructions need a little more detail:</p>
              <ul>
                {unresolved.map((clause, index) => (
                  <li key={index}>{clause}</li>
                ))}
              </ul>
              <p>
                Try “I love salmon”, “avoid cream”, “allergic to nuts” or “want
                high protein”. Your saved preferences haven’t changed.
              </p>
            </div>
          )}
          <p
            ref={reviewStatus}
            className="kitchen-feedback"
            role="status"
            tabIndex={-1}
          >
            {message}
          </p>
          <div
            className="kitchen-modules"
            aria-label="Your grouped preferences"
            aria-busy={saving}
          >
            <section
              className="kitchen-module"
              aria-labelledby="kitchen-pattern"
            >
              <header>
                <h2 id="kitchen-pattern">Eating pattern</h2>
                <button
                  type="button"
                  className="kitchen-edit"
                  onClick={() => edit("pattern")}
                  disabled={saving}
                  aria-label="Edit eating pattern in your instructions"
                >
                  Edit
                </button>
              </header>
              <dl className="kitchen-pattern-list">
                <div>
                  <dt>Eating style</dt>
                  <dd>{DIET_LABELS[prefs.dietType]}</dd>
                </div>
                <div>
                  <dt>Goals</dt>
                  <dd>
                    {prefs.goals.length ? (
                      prefs.goals
                        .map((goal) => GOAL_LABELS[goal] || noteLabel(goal))
                        .join(" · ")
                    ) : (
                      <span className="kitchen-empty">No goals added</span>
                    )}
                  </dd>
                </div>
              </dl>
            </section>
            <section
              className="kitchen-module"
              aria-labelledby="kitchen-ingredients"
            >
              <header>
                <h2 id="kitchen-ingredients">Ingredients</h2>
                <button
                  type="button"
                  className="kitchen-edit"
                  onClick={() => edit("ingredients")}
                  disabled={saving}
                  aria-label="Edit ingredients in your instructions"
                >
                  Edit
                </button>
              </header>
              <dl className="kitchen-ingredient-list">
                {(
                  [
                    ["Favorites", prefs.likes, "No favorites added"],
                    ["Avoid", prefs.hardAvoids, "No exclusions added"],
                    ["Allergies", prefs.allergies, "No allergies added"],
                    ...(prefs.softDislikes.length
                      ? [["Less of", prefs.softDislikes, ""]]
                      : []),
                  ] as [string, string[], string][]
                ).map(([label, values, empty]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      {values.length ? (
                        values.map(noteLabel).join(", ")
                      ) : (
                        <span className="kitchen-empty">{empty}</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
          <p className="kitchen-priority">
            Allergies and exclusions take priority over favorites. Confirm
            ingredients with the café.
          </p>
          {!!prefs.temporaryRestrictions?.length && (
            <details className="kitchen-existing-restrictions">
              <summary>
                Existing temporary restrictions (
                {prefs.temporaryRestrictions.length})
              </summary>
              <ul>
                {prefs.temporaryRestrictions.map((restriction) => (
                  <li key={restriction.id}>
                    {restriction.label} · through {restriction.endsOn}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {(dirty || needsReview) && (
            <footer className="kitchen-footer">
              <div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={cancel}
                  disabled={(!dirty && !needsReview) || saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={save}
                  disabled={
                    !dirty || needsReview || !!unresolved.length || saving
                  }
                >
                  {saving ? "Saving…" : "Save preferences"}
                </button>
              </div>
            </footer>
          )}
        </>
      )}
    </Page>
  );
}
