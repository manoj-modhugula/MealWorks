import { describe, expect, it } from "vitest";
import {
  followLerp,
  FOLLOW_LERP_BASE,
  FOLLOW_LERP_MAX,
  liquidPillAt,
  nearestTab,
  type TabGeom,
} from "./nav-pill";

function tabs(): TabGeom[] {
  // Four evenly spaced 80px tabs
  return [
    { href: "/today", left: 0, width: 80, center: 40 },
    { href: "/menu", left: 90, width: 80, center: 130 },
    { href: "/preferences", left: 180, width: 80, center: 220 },
    { href: "/settings", left: 270, width: 80, center: 310 },
  ];
}

describe("nearestTab", () => {
  it("picks the closest center", () => {
    const g = tabs();
    expect(nearestTab(g, 40)?.href).toBe("/today");
    expect(nearestTab(g, 130)?.href).toBe("/menu");
    expect(nearestTab(g, 200)?.href).toBe("/preferences");
    expect(nearestTab(g, 300)?.href).toBe("/settings");
  });
});

describe("liquidPillAt multi-tab", () => {
  it("rests on first and last at strip ends", () => {
    const g = tabs();
    expect(liquidPillAt(g, 0)?.href).toBe("/today");
    expect(liquidPillAt(g, 40)?.href).toBe("/today");
    expect(liquidPillAt(g, 310)?.href).toBe("/settings");
    expect(liquidPillAt(g, 999)?.href).toBe("/settings");
  });

  it("tracks finger across adjacent and multi-hop tabs", () => {
    const g = tabs();
    // Past midpoint Today to Menu goes to Menu
    expect(liquidPillAt(g, 100)?.href).toBe("/menu");
    // Past midpoint Menu to Prefs (two hops from Today) goes to Prefs
    const mid = liquidPillAt(g, 190);
    expect(mid?.href).toBe("/preferences");
    expect(mid!.left).toBeGreaterThan(90);
    // Past midpoint Prefs to Settings goes to Settings
    const far = liquidPillAt(g, 280);
    expect(far?.href).toBe("/settings");
    expect(far!.left).toBeGreaterThan(mid!.left);
  });

  it("moves left monotonically as finger slides right", () => {
    const g = tabs();
    const samples = [40, 90, 130, 180, 220, 270, 310].map(
      (x) => liquidPillAt(g, x)!.left
    );
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1] - 1);
    }
  });
});

describe("followLerp", () => {
  it("is elastic nearby and snappier when far", () => {
    expect(followLerp(0)).toBeCloseTo(FOLLOW_LERP_BASE, 5);
    expect(followLerp(10)).toBeGreaterThanOrEqual(FOLLOW_LERP_BASE);
    expect(followLerp(200)).toBeCloseTo(FOLLOW_LERP_MAX, 5);
    expect(followLerp(80)).toBeGreaterThan(followLerp(20));
  });
});
