import { describe, expect, it } from "vitest";
import {
  isInDarkWindow,
  parseTimeToMinutes,
  resolveScheduledTheme,
  resolveTheme,
  DEFAULT_SCHEDULE,
} from "./theme-schedule";

describe("parseTimeToMinutes", () => {
  it("parses HH:MM", () => {
    expect(parseTimeToMinutes("20:00")).toBe(20 * 60);
    expect(parseTimeToMinutes("07:30")).toBe(7 * 60 + 30);
  });

  it("rejects invalid", () => {
    expect(parseTimeToMinutes("")).toBeNull();
    expect(parseTimeToMinutes("25:00")).toBeNull();
  });
});

describe("isInDarkWindow", () => {
  it("handles same-day range", () => {
    expect(isInDarkWindow(12 * 60, "09:00", "17:00")).toBe(true);
    expect(isInDarkWindow(8 * 60, "09:00", "17:00")).toBe(false);
    expect(isInDarkWindow(17 * 60, "09:00", "17:00")).toBe(false);
  });

  it("handles overnight range", () => {
    expect(isInDarkWindow(21 * 60, "20:00", "07:00")).toBe(true);
    expect(isInDarkWindow(2 * 60, "20:00", "07:00")).toBe(true);
    expect(isInDarkWindow(12 * 60, "20:00", "07:00")).toBe(false);
    expect(isInDarkWindow(7 * 60, "20:00", "07:00")).toBe(false);
  });
});

describe("resolveTheme", () => {
  it("respects fixed modes", () => {
    expect(resolveTheme("light", DEFAULT_SCHEDULE)).toBe("light");
    expect(resolveTheme("dark", DEFAULT_SCHEDULE)).toBe("dark");
  });

  it("resolves schedule from clock", () => {
    const noon = new Date(2026, 0, 1, 12, 0, 0);
    const night = new Date(2026, 0, 1, 21, 0, 0);
    expect(resolveScheduledTheme(DEFAULT_SCHEDULE, noon)).toBe("light");
    expect(resolveScheduledTheme(DEFAULT_SCHEDULE, night)).toBe("dark");
  });
});
