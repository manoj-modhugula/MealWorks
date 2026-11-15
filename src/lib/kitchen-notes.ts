import type { DietType, PrefsInput } from "./types";

export const DIET_LABELS: Record<DietType, string> = {
  non_veg: "Omnivore",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  eggetarian: "Vegetarian with eggs",
  custom: "No preset diet",
};
export const GOAL_LABELS: Record<string, string> = {
  high_protein: "High protein",
  more_veggies: "More vegetables",
  lighter_meals: "Lighter meals",
  low_spice: "Mild flavors",
};

export const noteLabel = (value: string) => value.replace(/_/g, " ");

function naturalList(values: string[]) {
  const labels = values.map(noteLabel);
  if (labels.length < 2) return labels[0] || "";
  if (labels.length === 2) return labels.join(" and ");
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

const dietInstructions: Record<DietType, string> = {
  non_veg: "I’m an omnivore",
  vegetarian: "I’m vegetarian",
  vegan: "I’m vegan",
  eggetarian: "I’m vegetarian with eggs",
  custom: "I follow my own eating preferences",
};

export function instructionsFromPreferences(prefs: PrefsInput): string {
  const sentences = [
    dietInstructions[prefs.dietType],
    prefs.likes.length ? `I love ${naturalList(prefs.likes)}` : "",
    prefs.hardAvoids.length ? `I avoid ${naturalList(prefs.hardAvoids)}` : "",
    prefs.softDislikes.length
      ? `I dislike ${naturalList(prefs.softDislikes)}`
      : "",
    prefs.allergies.length
      ? `I’m allergic to ${naturalList(prefs.allergies)}`
      : "",
    prefs.goals.length
      ? `I want ${naturalList(prefs.goals.map((goal) => (GOAL_LABELS[goal] || noteLabel(goal)).toLowerCase()))}`
      : "",
  ].filter(Boolean);
  const instruction = sentences.length ? `${sentences.join(". ")}.` : "";
  return [instruction, prefs.freeformNotes.trim()].filter(Boolean).join(" ");
}

const goalPatterns: [string, RegExp][] = [
  [
    "high_protein",
    /^(?:high(?:er)?[ -]protein|more protein|protein[ -]rich)(?: meals?| foods?)?$/,
  ],
  [
    "more_veggies",
    /^(?:more (?:vegetables|veggies|veg)|vegetable[ -]rich)(?: meals?)?$/,
  ],
  ["lighter_meals", /^(?:lighter|light)(?: meals?)?$/],
  [
    "low_spice",
    /^(?:mild(?: flavors?| flavours?| meals?)?|low[ -]spice|less (?:spice|spicy)|not spicy)$/,
  ],
];
const diets: Record<string, DietType> = {
  omnivore: "non_veg",
  "non-veg": "non_veg",
  "non veg": "non_veg",
  "no dietary restrictions": "non_veg",
  vegetarian: "vegetarian",
  vegan: "vegan",
  "plant-based": "vegan",
  "plant based": "vegan",
  eggetarian: "eggetarian",
  "vegetarian with eggs": "eggetarian",
  custom: "custom",
  "personal preferences": "custom",
  "no preset diet": "custom",
  "follow my own eating preferences": "custom",
  "eat meat, fish and plants": "non_veg",
};
const cue =
  /(?:,\s*(?:and\s+)?|\s+(?:and|but)\s+)(?=(?:i(?:'m| am)?\s+)?(?:love\b|like\b|enjoy\b|prefer\b|avoid\b|exclude\b|skip\b|dislike\b|hate\b|allergic\b|allergies\b|want\b|need\b|goals?\s*:|eating style\s*:|(?:vegan|vegetarian|omnivore)\b|don't\b|do not\b|no\s+))/gi;

/** Explicit clauses only. Unrecognized instructions must be resolved before saving. */
export function parseKitchenNotes(
  text: string,
  fallbackDiet: DietType = "non_veg",
) {
  const prefs: PrefsInput = {
    dietType: fallbackDiet,
    likes: [],
    hardAvoids: [],
    allergies: [],
    goals: [],
    softDislikes: [],
    freeformNotes: "",
  };
  const unresolved: string[] = [];
  let selectedDiet: DietType | undefined;
  const clauses = text
    .replace(/[’‘]/g, "'")
    .replace(cue, "; ")
    .split(/[;.!?\n]+/)
    .map((clause) => clause.trim())
    .filter(Boolean);
  if (!clauses.length)
    unresolved.push("Enter your eating style or a food preference.");
  for (const original of clauses) {
    const clause = original
      .toLowerCase()
      .replace(/^please\s+/, "")
      .replace(/^i(?:'m| am)\s+/, "")
      .replace(/^i\s+/, "");
    const diet = clause.replace(/^(?:eating style|diet)(?:\s+is)?\s*:\s*/, "");
    if (Object.hasOwn(diets, diet.replace(/^(?:an?|the)\s+/, ""))) {
      const next = diets[diet.replace(/^(?:an?|the)\s+/, "")];
      if (selectedDiet && selectedDiet !== next) unresolved.push(original);
      else {
        prefs.dietType = next;
        selectedDiet = next;
      }
      continue;
    }
    if (/^(?:no (?:known )?allergies|allergies:\s*none)$/.test(clause))
      continue;
    const goalText = clause.replace(
      /^(?:goals?\s*:\s*|(?:want|need|aim for|prefer)\s+)/,
      "",
    );
    const goals = goalText
      .split(/\s+and\s+|,/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (
      goals.length > 0 &&
      goals.every((item) =>
        goalPatterns.some(([, pattern]) => pattern.test(item)),
      )
    ) {
      for (const item of goals)
        prefs.goals.push(
          goalPatterns.find(([, pattern]) => pattern.test(item))![0],
        );
      continue;
    }
    const category = [
      ["allergies", /^(?:allergic to|allergies\s*:|allergy to)\s*/],
      [
        "hardAvoids",
        /^(?:avoid|exclude|skip|don't eat|do not eat|can't eat|cannot eat|no)\s+/,
      ],
      ["softDislikes", /^(?:dislike|hate|less of)\s+/],
      ["likes", /^(?:(?:really )?(?:love|like|enjoy)|favorites?\s*:)\s*/],
    ] as const;
    const entry = category.find(([, pattern]) => pattern.test(clause));
    if (!entry) {
      unresolved.push(original);
      continue;
    }
    const terms = clause
      .replace(entry[1], "")
      .split(/\s+and\s+|,|\//)
      .map((term) => term.trim())
      .filter(Boolean);
    if (
      !terms.length ||
      terms.some(
        (term) =>
          term.length > 48 ||
          !/^[a-z][a-z '-]*$/.test(term) ||
          /\b(?:allergic|avoid|want|need|love|like|except|not|but)\b/.test(
            term,
          ),
      )
    ) {
      unresolved.push(original);
      continue;
    }
    prefs[entry[0]].push(...terms);
  }
  for (const key of [
    "likes",
    "hardAvoids",
    "allergies",
    "goals",
    "softDislikes",
  ] as const) {
    prefs[key] = [...new Set(prefs[key])];
  }
  // A restriction cannot be overridden by the same ingredient marked as a favorite.
  const excluded = new Set([...prefs.allergies, ...prefs.hardAvoids]);
  prefs.likes = prefs.likes.filter((term) => !excluded.has(term));
  prefs.hardAvoids = prefs.hardAvoids.filter(
    (term) => !prefs.allergies.includes(term),
  );
  return { prefs, unresolved };
}
