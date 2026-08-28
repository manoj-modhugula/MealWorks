import { describe, expect, it } from "vitest";
import {
  draftFromNoted,
  hasOwnReview,
  reviewStatsMap,
  type DishNote,
} from "./dish-note";

const note = (partial: Partial<DishNote> = {}): DishNote => ({
  vote: "ate",
  stars: null,
  note: "",
  ...partial,
});

describe("draftFromNoted", () => {
  it("starts empty when there is no review", () => {
    expect(draftFromNoted(undefined)).toEqual({ stars: 0, note: "" });
    expect(draftFromNoted(null)).toEqual({ stars: 0, note: "" });
  });

  it("keeps stars and the written line", () => {
    expect(
      draftFromNoted(note({ stars: 4, note: "salty" }))
    ).toEqual({ stars: 4, note: "salty" });
  });

  it("treats missing stars as none", () => {
    expect(draftFromNoted(note({ note: "ok" }))).toEqual({
      stars: 0,
      note: "ok",
    });
  });
});

describe("hasOwnReview", () => {
  it("is false with no stars and no text", () => {
    expect(hasOwnReview(undefined)).toBe(false);
    expect(hasOwnReview(note())).toBe(false);
  });

  it("is true with stars or a non-empty note", () => {
    expect(hasOwnReview(note({ stars: 5 }))).toBe(true);
    expect(hasOwnReview(note({ note: "good" }))).toBe(true);
    expect(hasOwnReview(note({ stars: 2, note: "dry" }))).toBe(true);
  });
});

describe("reviewStatsMap", () => {
  it("keys stats by dish name", () => {
    expect(
      reviewStatsMap([
        { dishName: "Pollo", avgStars: 4.1, count: 10 },
        { dishName: "Rice", avgStars: null, count: 2 },
      ])
    ).toEqual({
      Pollo: { avgStars: 4.1, count: 10 },
      Rice: { avgStars: null, count: 2 },
    });
  });

  it("is empty when nothing is rated", () => {
    expect(reviewStatsMap([])).toEqual({});
  });
});
