/** Theme preference stored in localStorage */
export type ThemePreference = "system" | "light" | "dark" | "schedule";
export type ResolvedTheme = "light" | "dark";

export type ThemeSchedule = {
  darkFrom: string; // HH:MM
  darkTo: string; // HH:MM
};

export type ThemeStorage = {
  preference: ThemePreference;
  schedule: ThemeSchedule;
};

export const THEME_STORAGE_KEY = "mealworks-theme";

export const DEFAULT_SCHEDULE: ThemeSchedule = {
  darkFrom: "20:00",
  darkTo: "07:00",
};

const PREFS = new Set<ThemePreference>([
  "system",
  "light",
  "dark",
  "schedule",
]);

/** Minutes since midnight for "HH:MM" or "HH:MM:SS". Invalid → null. */
export function parseTimeToMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(value || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Whether local time falls in the dark window.
 * Supports overnight ranges (e.g. 20:00 → 07:00).
 */
export function isInDarkWindow(
  nowMinutes: number,
  darkFrom: string,
  darkTo: string
): boolean {
  const from = parseTimeToMinutes(darkFrom);
  const to = parseTimeToMinutes(darkTo);
  if (from == null || to == null) return false;
  if (from === to) return false; // zero-width window → never dark
  if (from < to) {
    return nowMinutes >= from && nowMinutes < to;
  }
  // Overnight: dark from evening through midnight to morning
  return nowMinutes >= from || nowMinutes < to;
}

export function minutesNow(date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function resolveScheduledTheme(
  schedule: ThemeSchedule,
  date = new Date()
): ResolvedTheme {
  return isInDarkWindow(minutesNow(date), schedule.darkFrom, schedule.darkTo)
    ? "dark"
    : "light";
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveTheme(
  preference: ThemePreference,
  schedule: ThemeSchedule,
  date = new Date()
): ResolvedTheme {
  if (preference === "light" || preference === "dark") return preference;
  if (preference === "schedule") return resolveScheduledTheme(schedule, date);
  return getSystemTheme();
}

function normalizeSchedule(raw: unknown): ThemeSchedule {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SCHEDULE };
  const o = raw as Partial<ThemeSchedule>;
  const darkFrom =
    parseTimeToMinutes(String(o.darkFrom || "")) != null
      ? String(o.darkFrom)
      : DEFAULT_SCHEDULE.darkFrom;
  const darkTo =
    parseTimeToMinutes(String(o.darkTo || "")) != null
      ? String(o.darkTo)
      : DEFAULT_SCHEDULE.darkTo;
  return { darkFrom, darkTo };
}

/** Read storage: supports legacy plain "light"|"dark"|"system" string. */
export function readThemeStorage(): ThemeStorage {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) {
      return { preference: "system", schedule: { ...DEFAULT_SCHEDULE } };
    }
    if (raw === "light" || raw === "dark" || raw === "system") {
      return { preference: raw, schedule: { ...DEFAULT_SCHEDULE } };
    }
    if (raw === "schedule") {
      return { preference: "schedule", schedule: { ...DEFAULT_SCHEDULE } };
    }
    const parsed = JSON.parse(raw) as Partial<ThemeStorage> & {
      preference?: string;
    };
    const pref = parsed.preference;
    const preference: ThemePreference = PREFS.has(pref as ThemePreference)
      ? (pref as ThemePreference)
      : "system";
    return {
      preference,
      schedule: normalizeSchedule(parsed.schedule),
    };
  } catch {
    return { preference: "system", schedule: { ...DEFAULT_SCHEDULE } };
  }
}

export function writeThemeStorage(storage: ThemeStorage): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(storage));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Human status for schedule mode. */
export function scheduleStatusLine(
  schedule: ThemeSchedule,
  resolved: ResolvedTheme,
  date = new Date()
): string {
  const dark = resolved === "dark";
  const nextLabel = dark ? schedule.darkTo : schedule.darkFrom;
  const mins = parseTimeToMinutes(nextLabel);
  const pretty =
    mins == null
      ? nextLabel
      : new Date(2000, 0, 1, Math.floor(mins / 60), mins % 60).toLocaleTimeString(
          undefined,
          { hour: "numeric", minute: "2-digit" }
        );
  if (dark) {
    return `Using dark · light at ${pretty}`;
  }
  return `Using light · dark at ${pretty}`;
}
