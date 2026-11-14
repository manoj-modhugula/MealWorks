"use client";
import { useExperience } from "@/components/experience-provider";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Plus,
  Leaf,
  Utensils,
  ShieldCheck,
  Target,
  Heart,
  Ban,
  NotebookPen,
  CalendarDays,
  X,
} from "lucide-react";
import {
  Alert,
  ChipGroup,
  ChoicePicks,
  Page,
  PageSkeleton,
} from "@/components/ui";
import { WorkspaceRail } from "@/components/workspace-rail";
import { EditorDialog } from "@/components/editor-dialog";
import {
  allergyOptionsForContext,
  avoidOptionsForDiet,
  DIET_OPTIONS,
  filterHardAvoidsForDiet,
  GOAL_OPTIONS,
} from "@/lib/pref-options";
import { todayOnDevice } from "@/lib/client-date";
type Prefs = {
  dietType: string;
  hardAvoids: string[];
  softDislikes: string[];
  likes: string[];
  goals: string[];
  allergies: string[];
  freeformNotes: string;
  userFacingSummary: string;
  temporaryRestrictions: {
    id: string;
    label: string;
    avoidTags: string[];
    startsOn: string;
    endsOn: string;
    reason: string;
  }[];
};

type Editor = "diet" | "allergies" | "avoids" | "taste" | "notes" | "temporary";
const titles: Record<Editor, string> = {
  diet: "Eating style",
  allergies: "Allergies",
  avoids: "Always avoid",
  taste: "Ingredients & tastes",
  notes: "Food notes",
  temporary: "Temporary restriction",
};
const words = (values: string[]) =>
  values.map((v) => v.replace(/_/g, " ")).join(", ");
export default function PreferencesPage() {
  const { requestJson, getCache, setCache, invalidateCache } = useExperience();
  const cached = getCache<Prefs>("prefs");
  const edited = useRef(false);
  const [prefs, setPrefs] = useState<Prefs | null>(cached ?? null);
  const [saved, setSaved] = useState(cached ? JSON.stringify(cached) : "");
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [draft, setDraft] = useState<Prefs | null>(null);
  const [tempLabel, setTempLabel] = useState("");
  const [tempTags, setTempTags] = useState<string[]>([]);
  const [tempEnd, setTempEnd] = useState("");
  const [tempBusy, setTempBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    requestJson<{ prefs: Prefs }>("/api/preferences", {
      signal: controller.signal,
    })
      .then(({ prefs: next }) => {
        if (!edited.current) setPrefs(next);
        setSaved(JSON.stringify(next));
        setCache("prefs", next, 300_000);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [requestJson, setCache]);
  function openEditor(key: Editor) {
    setDraft(prefs ? structuredClone(prefs) : null);
    setError("");
    setEditor(key);
  }
  async function save() {
    if (!prefs || saving) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const { prefs: next } = await requestJson<{ prefs: Prefs }>(
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
      setSaved(JSON.stringify(next));
      setCache("prefs", next, 300_000);
      invalidateCache("today:");
      setMessage("Your preferences are saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save preferences.");
    } finally {
      setSaving(false);
    }
  }
  async function updateTemporary(id?: string) {
    if (tempBusy) return;
    setTempBusy(true);
    setError("");
    try {
      await requestJson(
        id
          ? `/api/preferences/temporary?id=${encodeURIComponent(id)}`
          : "/api/preferences/temporary",
        id
          ? { method: "DELETE" }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                label: tempLabel.trim(),
                avoidTags: tempTags,
                startsOn: todayOnDevice(),
                endsOn: tempEnd,
              }),
            },
      );
      const { prefs: next } = await requestJson<{ prefs: Prefs }>(
        "/api/preferences",
      );
      // Temporary restrictions save independently; keep any unsaved page edits.
      setPrefs((current) =>
        current
          ? { ...current, temporaryRestrictions: next.temporaryRestrictions }
          : next,
      );
      setSaved((current) =>
        current
          ? JSON.stringify({
              ...JSON.parse(current),
              temporaryRestrictions: next.temporaryRestrictions,
            })
          : JSON.stringify(next),
      );
      setCache("prefs", next, 300_000);
      invalidateCache("today:");
      setEditor(null);
      setTempLabel("");
      setTempTags([]);
      setTempEnd("");
      setMessage(id ? "Restriction removed." : "Temporary restriction added.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not update restriction.",
      );
    } finally {
      setTempBusy(false);
    }
  }
  const dirty = !!prefs && JSON.stringify(prefs) !== saved;
  function change(next: Prefs) {
    edited.current = true;
    setPrefs(next);
    setMessage("");
  }
  function toggle(values: string[], value: string) {
    return values.includes(value)
      ? values.filter((v) => v !== value)
      : [...values, value];
  }
  function heading(title: string, description: string, Icon: typeof Leaf) {
    return (
      <div className="preference-panel-heading">
        <Icon size={27} aria-hidden="true" />
        <div>
          <h2>{title}</h2>
          <p className="section-description">{description}</p>
        </div>
      </div>
    );
  }
  const saveControl = (
    <button
      type="button"
      className={dirty ? "btn btn-primary" : "preference-save-status"}
      disabled={!dirty || saving}
      onClick={save}
    >
      {saving ? (
        "Saving…"
      ) : dirty ? (
        "Save changes"
      ) : (
        <>
          <Check size={16} /> All changes saved
        </>
      )}
    </button>
  );
  return (
    <Page className="preferences-page">
      <h1 className="sr-only">Preferences</h1>
      {loading && !prefs && <PageSkeleton rows={4} />}
      {error && !editor && <Alert tone="bad">{error}</Alert>}
      {message && <Alert tone="good">{message}</Alert>}
      {prefs && (
        <div className="profile-layout">
          <WorkspaceRail
            label="Preference sections"
            sections={[
              { id: "food-profile", label: "Food profile" },
              { id: "ingredients-tastes", label: "Ingredients & tastes" },
              { id: "temporary-changes", label: "Temporary changes" },
            ]}
          />
          <div className="profile-main">
            <fieldset
              className="preference-workspace"
              disabled={saving}
              aria-busy={saving}
            >
              <legend className="sr-only">Your food preferences</legend>
              <section
                id="food-profile"
                className="workspace-panel preference-diet"
              >
                <div className="preference-heading-row">
                  {heading(
                    "Eating style",
                    "The way you like to eat.",
                    Utensils,
                  )}
                  {!dirty && saveControl}
                </div>
                <div
                  className="diet-tile-grid"
                  role="radiogroup"
                  aria-label="Eating style"
                >
                  {[
                    "non_veg",
                    "vegetarian",
                    "vegan",
                    "eggetarian",
                    "custom",
                  ].map((value) => {
                    const option = DIET_OPTIONS.find((o) => o.value === value)!;

                    return (
                      <button
                        type="button"
                        className="diet-tile"
                        role="radio"
                        aria-checked={prefs.dietType === value}
                        key={value}
                        tabIndex={prefs.dietType === value ? 0 : -1}
                        onKeyDown={(event) => {
                          const keys = [
                            "ArrowLeft",
                            "ArrowRight",
                            "ArrowUp",
                            "ArrowDown",
                            "Home",
                            "End",
                          ];
                          if (!keys.includes(event.key)) return;
                          event.preventDefault();
                          const choices = Array.from(
                            event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                              '[role="radio"]',
                            ),
                          );
                          const index = choices.indexOf(event.currentTarget);
                          const next =
                            event.key === "Home"
                              ? 0
                              : event.key === "End"
                                ? choices.length - 1
                                : (index +
                                    (event.key === "ArrowLeft" ||
                                    event.key === "ArrowUp"
                                      ? -1
                                      : 1) +
                                    choices.length) %
                                  choices.length;
                          choices[next].focus();
                          choices[next].click();
                        }}
                        onClick={() =>
                          change({
                            ...prefs,
                            dietType: value,
                            hardAvoids: filterHardAvoidsForDiet(
                              value,
                              prefs.hardAvoids,
                            ),
                          })
                        }
                      >
                        <span className="choice-radio" aria-hidden="true" />
                        <span>
                          {value === "non_veg"
                            ? "Omnivore"
                            : value === "eggetarian"
                              ? "Eggs OK"
                              : option.label}
                        </span>
                        {prefs.dietType === value && (
                          <Check
                            className="tile-check"
                            size={17}
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
              <section className="workspace-panel preference-allergies">
                {heading(
                  "Allergies",
                  "Ingredients we should look out for.",
                  ShieldCheck,
                )}
                <div className="allergy-picks">
                  {prefs.allergies.length ? (
                    prefs.allergies.map((value) => (
                      <button
                        type="button"
                        className="chip"
                        data-active="true"
                        key={value}
                        aria-label={`Remove ${words([value])} allergy`}
                        onClick={() =>
                          change({
                            ...prefs,
                            allergies: prefs.allergies.filter(
                              (v) => v !== value,
                            ),
                          })
                        }
                      >
                        {words([value])}
                        <X size={14} aria-hidden="true" />
                      </button>
                    ))
                  ) : (
                    <span className="quiet-empty">No allergies added</span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary panel-add"
                  onClick={() => openEditor("allergies")}
                >
                  <Plus size={16} />
                  Add allergy
                </button>
                <p className="allergy-hint">
                  Always confirm ingredients with the café.
                </p>
              </section>
              <section className="workspace-panel preference-goals">
                {heading(
                  "Your goals",
                  "Optional. Choose any that matter to you.",
                  Target,
                )}
                <div
                  className="goal-tile-grid"
                  role="group"
                  aria-label="Your goals"
                >
                  {GOAL_OPTIONS.map((option) => {
                    const active = prefs.goals.includes(option.value);
                    return (
                      <button
                        type="button"
                        className="goal-tile"
                        aria-pressed={active}
                        key={option.value}
                        onClick={() =>
                          change({
                            ...prefs,
                            goals: toggle(prefs.goals, option.value),
                          })
                        }
                      >
                        <span className="choice-checkbox" aria-hidden="true">
                          {active && <Check size={13} />}
                        </span>
                        <span>{option.label}</span>
                        {active && (
                          <Check
                            size={17}
                            className="tile-check"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
              <section
                id="ingredients-tastes"
                className="workspace-panel preference-taste"
              >
                {heading(
                  "Ingredients & tastes",
                  "More of what you love. Less of what you don’t.",
                  Heart,
                )}
                {(
                  [
                    ["likes", "More of"],
                    ["softDislikes", "Less of"],
                  ] as const
                ).map(([key, title]) => (
                  <div className="taste-group" key={key}>
                    <h3>{title}</h3>
                    <div className="taste-chips">
                      {!prefs[key].length && (
                        <span className="taste-empty">
                          {key === "likes"
                            ? "What do you look forward to eating?"
                            : "Anything you would rather skip?"}
                        </span>
                      )}
                      {prefs[key].map((value) => (
                        <button
                          type="button"
                          className="chip"
                          key={value}
                          aria-label={`Remove ${value} from ${title.toLowerCase()}`}
                          onClick={() =>
                            change({
                              ...prefs,
                              [key]: prefs[key].filter((v) => v !== value),
                            })
                          }
                        >
                          {words([value])}
                          <X size={14} aria-hidden="true" />
                        </button>
                      ))}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => openEditor("taste")}
                      >
                        <Plus size={16} />
                        {key === "likes" ? "Add a favorite" : "Add a dislike"}
                      </button>
                    </div>
                  </div>
                ))}
              </section>
              <section className="workspace-panel preference-notes-card">
                <div>
                  {heading(
                    "Always avoid",
                    "Keep these out of your recommendations.",
                    Ban,
                  )}
                  <div className="taste-chips">
                    {prefs.hardAvoids.map((value) => (
                      <button
                        type="button"
                        className="chip"
                        key={value}
                        aria-label={`Stop avoiding ${value}`}
                        onClick={() =>
                          change({
                            ...prefs,
                            hardAvoids: prefs.hardAvoids.filter(
                              (v) => v !== value,
                            ),
                          })
                        }
                      >
                        {words([value])}
                        <X size={14} aria-hidden="true" />
                      </button>
                    ))}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => openEditor("avoids")}
                    >
                      <Plus size={16} />
                      Add ingredient
                    </button>
                  </div>
                </div>
                <div>
                  {heading(
                    "Food notes",
                    "Preparation details or anything else to consider.",
                    NotebookPen,
                  )}
                  <label className="sr-only" htmlFor="preference-notes">
                    Your food notes
                  </label>
                  <textarea
                    id="preference-notes"
                    className="field preference-notes"
                    rows={3}
                    maxLength={2000}
                    value={prefs.freeformNotes}
                    placeholder="Anything else we should know?"
                    onChange={(e) =>
                      change({ ...prefs, freeformNotes: e.target.value })
                    }
                  />
                </div>
              </section>
            </fieldset>
            <section
              id="temporary-changes"
              className="temporary-section workspace-panel"
            >
              <div>
                <h2>
                  <CalendarDays size={25} aria-hidden="true" />
                  Temporary changes
                </h2>
                <p className="section-description">
                  Restrictions that end on a date you choose.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => openEditor("temporary")}
              >
                <Plus size={17} /> Add restriction
              </button>
              {prefs.temporaryRestrictions?.map((t) => (
                <div className="temporary-row" key={t.id}>
                  <div>
                    <strong>{t.label}</strong>
                    <p>
                      Until {t.endsOn}
                      {t.avoidTags.length ? ` · ${words(t.avoidTags)}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-action"
                    disabled={tempBusy}
                    onClick={() => updateTemporary(t.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </section>
          </div>
        </div>
      )}
      {dirty && !editor && (
        <div
          className="preference-save-bar"
          role="region"
          aria-label="Unsaved preferences"
        >
          <p>
            Unsaved changes<span>Save to update your recommendations.</span>
          </p>
          <div className="preference-save-actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={saving}
              onClick={() => {
                setPrefs(JSON.parse(saved) as Prefs);
                edited.current = false;
                setError("");
                setMessage("");
              }}
            >
              Discard
            </button>
            {saveControl}
          </div>
        </div>
      )}
      <EditorDialog
        open={!!editor}
        title={editor ? titles[editor] : "Preferences"}
        description={
          editor === "temporary"
            ? "Applies immediately and ends on the date you choose."
            : "Apply your choices, then save changes on the page."
        }
        onClose={() => {
          if (!tempBusy) setEditor(null);
        }}
      >
        {error && <Alert tone="bad">{error}</Alert>}
        {draft && (
          <form
            className="editor-body"
            onSubmit={(e) => {
              e.preventDefault();
              if (editor === "temporary") void updateTemporary();
              else {
                change(draft);
                setEditor(null);
                setMessage("");
              }
            }}
          >
            {editor === "diet" && (
              <ChipGroup
                multi={false}
                options={DIET_OPTIONS}
                selected={[draft.dietType]}
                onChange={(v) => {
                  const dietType = v[0] || "non_veg";
                  setDraft({
                    ...draft,
                    dietType,
                    hardAvoids: filterHardAvoidsForDiet(
                      dietType,
                      draft.hardAvoids,
                    ),
                  });
                }}
              />
            )}
            {editor === "allergies" && (
              <ChoicePicks
                options={allergyOptionsForContext(
                  draft.dietType,
                  draft.hardAvoids,
                )}
                selected={draft.allergies}
                onChange={(allergies) => setDraft({ ...draft, allergies })}
                allowCustom
                customPlaceholder="Add another allergy"
              />
            )}
            {editor === "avoids" && (
              <ChoicePicks
                options={avoidOptionsForDiet(draft.dietType)}
                selected={draft.hardAvoids}
                onChange={(hardAvoids) => setDraft({ ...draft, hardAvoids })}
                allowCustom
                customPlaceholder="Add an ingredient"
              />
            )}
            {editor === "taste" && (
              <>
                <div>
                  <h3>Foods you enjoy</h3>
                  <ChoicePicks
                    options={[]}
                    selected={draft.likes}
                    onChange={(likes) => setDraft({ ...draft, likes })}
                    allowCustom
                    customPlaceholder="e.g. salmon, tofu"
                  />
                </div>
                <div>
                  <h3>Usually skip</h3>
                  <ChoicePicks
                    options={[]}
                    selected={draft.softDislikes}
                    onChange={(softDislikes) =>
                      setDraft({ ...draft, softDislikes })
                    }
                    allowCustom
                    customPlaceholder="e.g. raw onion"
                  />
                </div>
              </>
            )}
            {editor === "notes" && (
              <label className="editor-label">
                Your notes
                <textarea
                  className="field"
                  rows={5}
                  maxLength={2000}
                  value={draft.freeformNotes}
                  onChange={(e) =>
                    setDraft({ ...draft, freeformNotes: e.target.value })
                  }
                  placeholder="Tell us about your food preferences…"
                />
              </label>
            )}
            {editor === "temporary" && (
              <>
                <label className="editor-label">
                  What’s changing?
                  <input
                    className="field"
                    required
                    maxLength={80}
                    value={tempLabel}
                    onChange={(e) => setTempLabel(e.target.value)}
                    placeholder="e.g. avoiding dairy this week"
                  />
                </label>
                <label className="editor-label">
                  Until
                  <input
                    className="field"
                    required
                    type="date"
                    min={todayOnDevice()}
                    value={tempEnd}
                    onChange={(e) => setTempEnd(e.target.value)}
                  />
                </label>
                <div>
                  <h3>Ingredients to avoid</h3>
                  <ChoicePicks
                    options={avoidOptionsForDiet(draft.dietType)}
                    selected={tempTags}
                    onChange={setTempTags}
                    allowCustom
                  />
                </div>
              </>
            )}
            <footer className="editor-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={tempBusy}
                onClick={() => setEditor(null)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" disabled={tempBusy}>
                {editor === "temporary"
                  ? tempBusy
                    ? "Adding…"
                    : "Add restriction"
                  : "Apply choices"}
              </button>
            </footer>
          </form>
        )}
      </EditorDialog>
    </Page>
  );
}
