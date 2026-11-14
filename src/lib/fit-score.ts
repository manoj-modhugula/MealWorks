import type { ItemDecision, Verdict } from "./types";

type FitItem = { decision: ItemDecision; meal?: string; station?: string };

/**
 * Fit measures choice coverage: enough recommended dishes at each offered meal.
 * Skip/caution dishes never contribute. Targets are three breakfast/salad choices
 * and four lunch choices. 97 is the product's high-fit ceiling, not a menu percentage.
 */
export function scoreFromItems(items: FitItem[]): {
  score: number;
  verdict: Verdict;
  recommended: number;
} {
  const groups = new Map<string, number>();
  let recommended = 0;
  for (const item of items) {
    const group =
      item.station?.toLowerCase() === "salad compose"
        ? "salad"
        : item.meal?.toLowerCase() || "menu";
    const good = item.decision === "recommended" ? 1 : 0;
    groups.set(group, (groups.get(group) ?? 0) + good);
    recommended += good;
  }
  const coverage = groups.size
    ? Array.from(groups, ([group, count]) =>
        Math.min(1, count / (group === "lunch" ? 4 : 3)),
      ).reduce((sum, value) => sum + value, 0) / groups.size
    : 0;
  const score = Math.round(97 * coverage);
  const verdict: Verdict =
    score >= 80
      ? "great"
      : score >= 50
        ? "mostly_fine"
        : score >= 20
          ? "thin_options"
          : "not_your_day";
  return { score, verdict, recommended };
}
