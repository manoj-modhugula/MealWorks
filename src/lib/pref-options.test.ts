import { describe, expect, it } from "vitest";
import {
  allergyOptionsForContext,
  filterHardAvoidsForDiet,
} from "./pref-options";

describe("filterHardAvoidsForDiet", () => {
  it("drops diet-implied meat chips when switching to vegan", () => {
    expect(
      filterHardAvoidsForDiet("vegan", ["chicken", "gluten", "onion"])
    ).toEqual(["gluten", "onion"]);
  });

  it("keeps custom extras when switching to vegetarian", () => {
    expect(
      filterHardAvoidsForDiet("vegetarian", ["onion", "beans", "pork"])
    ).toEqual(["onion", "beans"]);
  });
});

describe("allergyOptionsForContext", () => {
  it("does not re-offer pork and beef already picked as avoids", () => {
    const values = allergyOptionsForContext("non_veg", ["pork", "beef"]).map(
      (o) => o.value
    );
    expect(values).not.toContain("pork");
    expect(values).not.toContain("beef");
    expect(values).toContain("beans");
    expect(values).toContain("gluten");
  });
});
