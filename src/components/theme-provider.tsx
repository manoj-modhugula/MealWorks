"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_SCHEDULE,
  readThemeStorage,
  resolveTheme,
  scheduleStatusLine,
  writeThemeStorage,
  type ResolvedTheme,
  type ThemePreference,
  type ThemeSchedule,
} from "@/lib/theme-schedule";

export type { ThemePreference, ResolvedTheme, ThemeSchedule };

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  schedule: ThemeSchedule;
  setPreference: (next: ThemePreference) => void;
  setSchedule: (next: Partial<ThemeSchedule>) => void;
  scheduleStatus: string;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const color =
      getComputedStyle(root).getPropertyValue("--theme-color").trim() ||
      (resolved === "dark" ? "#0b0d12" : "#eef1f6");
    meta.setAttribute("content", color);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [schedule, setScheduleState] = useState<ThemeSchedule>({
    ...DEFAULT_SCHEDULE,
  });
  const [resolved, setResolved] = useState<ResolvedTheme>("light");
  const [nowTick, setNowTick] = useState(0);

  const recompute = useCallback(
    (pref: ThemePreference, sched: ThemeSchedule) => {
      const next = resolveTheme(pref, sched);
      setResolved(next);
      applyTheme(next);
    },
    []
  );

  useEffect(() => {
    const stored = readThemeStorage();
    setPreferenceState(stored.preference);
    setScheduleState(stored.schedule);
    recompute(stored.preference, stored.schedule);
  }, [recompute]);

  // System preference changes
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => recompute("system", schedule);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference, schedule, recompute]);

  // Schedule: re-evaluate every minute and when tab becomes visible
  useEffect(() => {
    if (preference !== "schedule") return;
    const tick = () => {
      setNowTick((n) => n + 1);
      recompute("schedule", schedule);
    };
    const id = window.setInterval(tick, 30_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [preference, schedule, recompute]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      writeThemeStorage({ preference: next, schedule });
      recompute(next, schedule);
    },
    [schedule, recompute]
  );

  const setSchedule = useCallback(
    (partial: Partial<ThemeSchedule>) => {
      setScheduleState((prev) => {
        const next = { ...prev, ...partial };
        writeThemeStorage({ preference, schedule: next });
        recompute(preference, next);
        return next;
      });
    },
    [preference, recompute]
  );

  const scheduleStatus = useMemo(() => {
    void nowTick;
    if (preference !== "schedule") {
      if (preference === "system") return "Matches your device";
      if (preference === "light") return "Always light";
      if (preference === "dark") return "Always dark";
      return "";
    }
    return scheduleStatusLine(schedule, resolved);
  }, [preference, schedule, resolved, nowTick]);

  const value = useMemo(
    () => ({
      preference,
      resolved,
      schedule,
      setPreference,
      setSchedule,
      scheduleStatus,
    }),
    [
      preference,
      resolved,
      schedule,
      setPreference,
      setSchedule,
      scheduleStatus,
    ]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
