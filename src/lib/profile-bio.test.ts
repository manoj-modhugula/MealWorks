import { describe, expect, it } from "vitest";
import { profileBio } from "./profile-bio";

describe("profileBio", () => {
  it("writes one sentence from diet and skips", () => {
    expect(
      profileBio({
        dietType: "non_veg",
        skip: ["pork", "beef", "shellfish", "beans", "gluten"],
        notes: "no raw onion",
      })
    ).toBe(
      "Non-veg, skipping pork, beef, shellfish, beans, and gluten. No raw onion."
    );
  });

  it("is just the diet when nothing else is set", () => {
    expect(profileBio({ dietType: "vegan", skip: [], notes: "" })).toBe("Vegan.");
  });

  it("collapses bean/beans and legume family into beans", () => {
    expect(
      profileBio({
        dietType: "non_veg",
        skip: ["beans", "bean", "chickpea", "lentil", "legume", "gluten"],
        notes: "",
      })
    ).toBe("Non-veg, skipping beans and gluten.");
  });
});
