import { describe, expect, it } from "vitest";
import { scoreFromItems } from "./fit-score";
import type { MatchItem } from "./types";

const choices = (
  meal: string,
  count: number,
  station = "Kitchen",
): MatchItem[] =>
  Array.from({ length: count }, (_, index) => ({
    name: `${meal} ${index}`,
    meal,
    station,
    decision: "recommended",
    reason: "Fits preferences",
  }));
const variedMenu = [
  ...choices("breakfast", 3),
  ...choices("lunch", 8),
  ...choices("lunch", 3, "Salad Compose"),
];

describe("meal-choice fit", () => {
  it("reaches 97 when every offered meal has enough good choices", () => {
    expect(scoreFromItems(variedMenu)).toEqual({
      score: 97,
      verdict: "great",
      recommended: 14,
    });
  });
  it("handles empty menus, a single choice and excluded dishes", () => {
    expect(scoreFromItems([]).score).toBe(0);
    expect(scoreFromItems([{ decision: "recommended" }]).score).toBe(32);
    expect(scoreFromItems([{ decision: "avoid" }]).score).toBe(0);
  });
  it("lowers fit when an offered meal has no matching options", () => {
    const restricted = variedMenu.map((item) =>
      item.meal === "breakfast"
        ? { ...item, decision: "avoid" as const }
        : item,
    );
    expect(scoreFromItems(restricted).score).toBe(65);
  });
  it("does not count avoids or cautions toward available choices", () => {
    expect(
      scoreFromItems([
        { decision: "avoid", meal: "lunch" },
        { decision: "caution", meal: "lunch" },
      ]).score,
    ).toBe(0);
    expect(
      scoreFromItems([{ decision: "recommended", meal: "lunch" }]).score,
    ).toBe(24);
    expect(
      scoreFromItems([...variedMenu, { decision: "avoid", meal: "lunch" }])
        .score,
    ).toBe(97);
  });
});
