import { ALLERGY_FAMILIES } from "./matching";

const DIET_BIO: Record<string, string> = {
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  eggetarian: "Eggetarian",
  non_veg: "Non-veg",
  custom: "Custom",
};

/** Canonical family name when several related words are present. */
const FAMILY_HEAD: Record<string, string> = {
  bean: "beans",
  beans: "beans",
};

function familyOf(term: string): string | null {
  const t = term.toLowerCase().trim();
  if (FAMILY_HEAD[t]) return FAMILY_HEAD[t];
  for (const [head, members] of Object.entries(ALLERGY_FAMILIES)) {
    const canon = FAMILY_HEAD[head] || head;
    if (t === head || members.includes(t)) return canon;
  }
  return null;
}

function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (a + "s" === b || b + "s" === a) return true;
  if (a + "es" === b || b + "es" === a) return true;
  return false;
}

/** Drop bean/beans duplicates and fold a food family to one word. */
export function compactSkipTerms(terms: string[]): string[] {
  const raw = [
    ...new Set(terms.map((s) => s.trim().toLowerCase()).filter(Boolean)),
  ];
  const byFamily = new Map<string, string[]>();
  const other: string[] = [];
  for (const t of raw) {
    const fam = familyOf(t);
    if (fam) {
      const list = byFamily.get(fam) || [];
      list.push(t);
      byFamily.set(fam, list);
    } else {
      other.push(t);
    }
  }

  const out: string[] = [];
  for (const [head, members] of byFamily) {
    if (members.length >= 2 || members.includes(head) || members.includes("bean")) {
      out.push(head);
    } else {
      out.push(members[0]);
    }
  }
  for (const t of other) {
    if (out.some((x) => sameWord(x, t))) continue;
    if (other.some((x) => x < t && sameWord(x, t))) continue;
    out.push(t);
  }
  return out;
}

function listPhrase(items: string[]): string {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

function asSentence(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return "";
  const capped = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

/** One short plate bio, e.g. "Non-veg, skipping pork and beans. No raw onion." */
export function profileBio(input: {
  dietType: string;
  skip: string[];
  notes?: string;
}): string {
  const diet = DIET_BIO[input.dietType] || "Non-veg";
  const skip = listPhrase(compactSkipTerms(input.skip));
  const head = skip ? `${diet}, skipping ${skip}.` : `${diet}.`;
  const note = asSentence(input.notes || "");
  if (!note) return head;
  if (head.toLowerCase().includes(note.replace(/[.!?]$/, "").toLowerCase())) {
    return head;
  }
  return `${head} ${note}`;
}
