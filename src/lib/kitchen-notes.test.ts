import { describe, expect, it } from "vitest";
import {
  instructionsFromPreferences,
  parseKitchenNotes,
} from "./kitchen-notes";
import { createDemoWorkspace } from "./demo-workspace";
import type { MatchPayload, PrefsInput } from "./types";

describe("kitchen instructions", () => {
  it("groups the approved example without treating favorites as restrictions", () => {
    const { prefs, unresolved } = parseKitchenNotes(
      "I’m vegetarian, love mushrooms and spinach, avoid cream, want high protein, and I’m allergic to nuts.",
    );
    expect(unresolved).toEqual([]);
    expect(prefs).toMatchObject({
      dietType: "vegetarian",
      likes: ["mushrooms", "spinach"],
      hardAvoids: ["cream"],
      goals: ["high_protein"],
      allergies: ["nuts"],
      freeformNotes: "",
    });
  });
  it("shows saved preferences as ordinary sentences for every existing eating style", () => {
    for (const dietType of [
      "non_veg",
      "vegetarian",
      "vegan",
      "eggetarian",
      "custom",
    ] as const) {
      const profile: PrefsInput = {
        dietType,
        hardAvoids: ["cream", "gluten"],
        allergies: ["nuts"],
        likes: ["salmon", "mushrooms", "spinach"],
        softDislikes: [],
        goals: ["high_protein"],
        freeformNotes: "",
      };
      const text = instructionsFromPreferences(profile);
      expect(text).not.toMatch(/Eating style:|Goals:|Custom|_/);
      expect(text).toContain("I avoid cream and gluten.");
      expect(text).toContain("I want high protein.");
      expect(parseKitchenNotes(text)).toEqual({
        prefs: profile,
        unresolved: [],
      });
    }
  });

  it("keeps multiword ingredients and lists together", () => {
    const result = parseKitchenNotes(
      "I love raw onion, bell pepper and salmon; avoid cream and gluten; allergic to nuts and shellfish",
    );
    expect(result.unresolved).toEqual([]);
    expect(result.prefs.likes).toEqual(["raw onion", "bell pepper", "salmon"]);
    expect(result.prefs.hardAvoids).toEqual(["cream", "gluten"]);
    expect(result.prefs.allergies).toEqual(["nuts", "shellfish"]);
  });
  it("supports multiple goals and common diet phrasing", () => {
    const result = parseKitchenNotes(
      "I am vegan. I want more vegetables and mild flavors. Need high protein.",
    );
    expect(result.unresolved).toEqual([]);
    expect(result.prefs.dietType).toBe("vegan");
    expect(result.prefs.goals).toEqual([
      "more_veggies",
      "low_spice",
      "high_protein",
    ]);
  });
  it("gives allergies priority over duplicate favorites and exclusions", () => {
    const result = parseKitchenNotes(
      "I love nuts and salmon. Avoid nuts. Allergic to nuts. I like salmon.",
    );
    expect(result.unresolved).toEqual([]);
    expect(result.prefs.likes).toEqual(["salmon"]);
    expect(result.prefs.hardAvoids).toEqual([]);
    expect(result.prefs.allergies).toEqual(["nuts"]);
  });
  it("flags conflicting diets and ambiguous instructions rather than guessing", () => {
    expect(
      parseKitchenNotes("I am vegan. I am vegetarian.").unresolved,
    ).toEqual(["I am vegetarian"]);
    expect(
      parseKitchenNotes("I am not allergic to nuts").unresolved,
    ).not.toEqual([]);
    expect(
      parseKitchenNotes("Avoid everything except salmon").unresolved,
    ).not.toEqual([]);
    expect(parseKitchenNotes("Make my meals exciting").unresolved).not.toEqual(
      [],
    );
    expect(parseKitchenNotes("").unresolved).not.toEqual([]);
  });
  it("round-trips existing profiles without losing dislikes or goals", () => {
    const profile: PrefsInput = {
      dietType: "eggetarian",
      hardAvoids: ["cream", "raw onion"],
      allergies: ["nuts"],
      likes: ["mushrooms", "spinach"],
      softDislikes: ["tofu"],
      goals: ["high_protein", "low_spice", "lighter_meals", "more_veggies"],
      freeformNotes: "",
    };
    expect(parseKitchenNotes(instructionsFromPreferences(profile))).toEqual({
      prefs: profile,
      unresolved: [],
    });
  });
  it("makes removing a clause remove that preference and preserves an unstated diet", () => {
    const result = parseKitchenNotes("I love salmon", "non_veg");
    expect(result.prefs).toMatchObject({
      dietType: "non_veg",
      likes: ["salmon"],
      hardAvoids: [],
      allergies: [],
      goals: [],
    });
  });
  it("requires review for old unstructured notes rather than silently losing them", () => {
    const text = instructionsFromPreferences({
      dietType: "custom",
      likes: [],
      hardAvoids: [],
      allergies: [],
      goals: [],
      softDislikes: [],
      freeformNotes: "Cook my food in a separate pan",
    });
    expect(parseKitchenNotes(text).unresolved).toEqual([
      "Cook my food in a separate pan",
    ]);
  });
  it("updates sample dish choices and fit after saving reviewed notes", async () => {
    const demo = createDemoWorkspace();
    const result = parseKitchenNotes(
      "I’m vegan, love lentils, avoid nuts, and want more vegetables.",
    );
    expect(result.unresolved).toEqual([]);
    await demo.requestJson("/api/preferences", {
      method: "PUT",
      body: JSON.stringify(result.prefs),
    });
    const { match } = await demo.requestJson<{
      match: { score: number; payload: MatchPayload };
    }>("/api/match/today?date=2026-11-14");
    expect(match.score).toBeLessThan(97);
    expect(
      match.payload.items.find((item) => item.name === "Herb-Roasted Salmon")
        ?.decision,
    ).toBe("avoid");
    expect(
      match.payload.items.find(
        (item) => item.name === "Mediterranean Lentil Bowl",
      )?.decision,
    ).toBe("recommended");
  });
});
