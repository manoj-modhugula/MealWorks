import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAFE_HOURS,
  defaultMealFromHours,
  itemInMealView,
} from "./meal-hours";

function at(h: number, m: number) {
  return new Date(2026, 7, 15, h, m, 0, 0);
}

describe("defaultMealFromHours", () => {
  it("uses breakfast before breakfast end", () => {
    expect(defaultMealFromHours(at(9, 29), DEFAULT_CAFE_HOURS)).toBe(
      "breakfast"
    );
    expect(defaultMealFromHours(at(7, 0), DEFAULT_CAFE_HOURS)).toBe(
      "breakfast"
    );
  });

  it("switches to lunch at breakfast end", () => {
    expect(defaultMealFromHours(at(9, 30), DEFAULT_CAFE_HOURS)).toBe("lunch");
    expect(defaultMealFromHours(at(9, 31), DEFAULT_CAFE_HOURS)).toBe("lunch");
    expect(defaultMealFromHours(at(16, 0), DEFAULT_CAFE_HOURS)).toBe("lunch");
  });

  it("follows an admin-changed breakfast end", () => {
    const hours = { ...DEFAULT_CAFE_HOURS, breakfastEnd: "10:00" };
    expect(defaultMealFromHours(at(9, 45), hours)).toBe("breakfast");
    expect(defaultMealFromHours(at(10, 0), hours)).toBe("lunch");
  });

  it("never auto-picks salad", () => {
    expect(defaultMealFromHours(at(12, 0), DEFAULT_CAFE_HOURS)).not.toBe(
      "salad"
    );
  });
});

describe("itemInMealView", () => {
  const breakfast = { meal: "breakfast", station: "Bakery" };
  const lunch = { meal: "lunch", station: "Mains" };
  const salad = { meal: "lunch", station: "Salad Compose" };

  it("keeps salad out of lunch and breakfast", () => {
    expect(itemInMealView(breakfast, "breakfast")).toBe(true);
    expect(itemInMealView(salad, "breakfast")).toBe(false);
    expect(itemInMealView(lunch, "lunch")).toBe(true);
    expect(itemInMealView(salad, "lunch")).toBe(false);
  });

  it("puts only Salad Compose in salad", () => {
    expect(itemInMealView(salad, "salad")).toBe(true);
    expect(itemInMealView(lunch, "salad")).toBe(false);
    expect(itemInMealView(breakfast, "salad")).toBe(false);
  });
});
