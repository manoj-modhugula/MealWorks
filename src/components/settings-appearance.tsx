"use client";

import { Check } from "lucide-react";
import { useTheme, type ThemePreference } from "./theme-provider";

const themes: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function SettingsAppearance({
  allowSchedule = false,
}: {
  allowSchedule?: boolean;
}) {
  const { preference, resolved, setPreference, schedule, setSchedule } =
    useTheme();
  // Keep a previously saved schedule visible until the person chooses another mode.
  const choices =
    allowSchedule || preference === "schedule"
      ? [...themes, { value: "schedule" as const, label: "Scheduled" }]
      : themes;
  return (
    <section
      className="settings-panel appearance-panel"
      aria-labelledby="appearance-title"
    >
      <header>
        <h2 id="appearance-title">Appearance</h2>
      </header>
      <div className="appearance-content">
        <h3 className="appearance-label">Theme</h3>
        <div
          className="appearance-options"
          role="radiogroup"
          aria-label="Color theme"
          data-scheduled={choices.length === 4}
        >
          {choices.map(({ value, label }) => (
            <button
              type="button"
              role="radio"
              aria-checked={preference === value}
              tabIndex={preference === value ? 0 : -1}
              className="appearance-choice"
              data-mode={value}
              key={value}
              onClick={() => setPreference(value)}
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
                const index = choices.findIndex(
                  (choice) => choice.value === value,
                );
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? choices.length - 1
                      : (index +
                          (event.key === "ArrowLeft" || event.key === "ArrowUp"
                            ? -1
                            : 1) +
                          choices.length) %
                        choices.length;
                const buttons =
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                    '[role="radio"]',
                  );
                buttons?.[next].focus();
                setPreference(choices[next].value);
              }}
            >
              <span className="appearance-miniature" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="appearance-choice-label">
                {preference === value && <Check size={15} aria-hidden="true" />}
                {label}
              </span>
            </button>
          ))}
        </div>
        {preference === "schedule" && (
          <div className="appearance-schedule">
            <label className="editor-label">
              Dark from
              <input
                className="field"
                type="time"
                value={schedule.darkFrom}
                onChange={(event) =>
                  setSchedule({ darkFrom: event.target.value || "20:00" })
                }
              />
            </label>
            <label className="editor-label">
              Until
              <input
                className="field"
                type="time"
                value={schedule.darkTo}
                onChange={(event) =>
                  setSchedule({ darkTo: event.target.value || "07:00" })
                }
              />
            </label>
          </div>
        )}
      </div>
      {(preference === "system" || preference === "schedule") && (
        <dl className="settings-labeled-row">
          <dt>{preference === "system" ? "Device" : "Using"}</dt>
          <dd role="status">
            {resolved === "dark" ? "Dark appearance" : "Light appearance"}
          </dd>
        </dl>
      )}
    </section>
  );
}
