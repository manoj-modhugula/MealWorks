import { describe, expect, it } from "vitest";
import { SHOT_MS, scrollAt, shotEase } from "./shot-scroll";

describe("shotEase", () => {
  it("starts at 0 and finishes at 1", () => {
    expect(shotEase(0)).toBe(0);
    expect(shotEase(1)).toBe(1);
  });

  it("eases out (ahead of linear at mid-time)", () => {
    expect(shotEase(0.5)).toBeGreaterThan(0.5);
  });
});

describe("scrollAt", () => {
  it("holds the start, then lands on the saved scroll", () => {
    expect(scrollAt(800, 200, 0, SHOT_MS)).toBe(800);
    expect(scrollAt(800, 200, SHOT_MS, SHOT_MS)).toBe(200);
  });
});
