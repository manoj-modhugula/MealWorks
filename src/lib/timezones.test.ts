import { describe, expect, it } from "vitest";
import { SYSTEM_TZ, systemTzLabel, timezoneGroups } from "./timezones";

describe("timezoneGroups", () => {
  it("returns named regions with IANA zones", () => {
    const groups = timezoneGroups();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.some((g) => g.zones.includes("America/New_York"))).toBe(
      true
    );
    expect(SYSTEM_TZ).toBe("__device__");
    expect(systemTzLabel("America/New_York")).toContain("System");
  });
});
