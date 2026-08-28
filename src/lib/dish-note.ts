export type DishNote = {
  vote: string;
  stars: number | null;
  note: string;
};

export function draftFromNoted(
  noted?: DishNote | null
): { stars: number; note: string } {
  return {
    stars: noted?.stars && noted.stars > 0 ? noted.stars : 0,
    note: noted?.note || "",
  };
}

export function hasOwnReview(noted?: DishNote | null): boolean {
  return Boolean(noted?.stars) || Boolean(noted?.note?.trim());
}

export type DishReviewStats = {
  avgStars: number | null;
  count: number;
};

export function reviewStatsMap(
  dishes: { dishName: string; avgStars: number | null; count: number }[]
): Record<string, DishReviewStats> {
  const out: Record<string, DishReviewStats> = {};
  for (const d of dishes) {
    out[d.dishName] = { avgStars: d.avgStars, count: d.count };
  }
  return out;
}
