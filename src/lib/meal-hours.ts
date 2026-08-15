import { SALAD_COMPOSE_STATION } from "./salad-compose";
import { parseTimeToMinutes } from "./theme-schedule";

export type MealView = "breakfast" | "lunch" | "salad";

export type CafeHours = {
  breakfastStart: string;
  breakfastEnd: string;
  lunchStart: string;
  lunchEnd: string;
};

export const DEFAULT_CAFE_HOURS: CafeHours = {
  breakfastStart: "08:00",
  breakfastEnd: "09:30",
  lunchStart: "11:30",
  lunchEnd: "14:30",
};

export const MEAL_VIEWS: { id: MealView; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "salad", label: "Salad" },
];

/** Before breakfast end → breakfast. At or after → lunch. Never salad. */
export function defaultMealFromHours(
  now: Date,
  hours: CafeHours
): MealView {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const end = parseTimeToMinutes(hours.breakfastEnd);
  if (end == null) return "lunch";
  return minutes < end ? "breakfast" : "lunch";
}

export function itemInMealView(
  item: { meal: string; station: string },
  view: MealView
): boolean {
  const salad = item.station === SALAD_COMPOSE_STATION;
  if (view === "salad") return salad;
  if (salad) return false;
  return item.meal === view;
}

const TIME = /^\d{2}:\d{2}$/;

export function normalizeCafeHours(raw: Partial<CafeHours> | null | undefined): CafeHours {
  return {
    breakfastStart: validTime(raw?.breakfastStart) ?? DEFAULT_CAFE_HOURS.breakfastStart,
    breakfastEnd: validTime(raw?.breakfastEnd) ?? DEFAULT_CAFE_HOURS.breakfastEnd,
    lunchStart: validTime(raw?.lunchStart) ?? DEFAULT_CAFE_HOURS.lunchStart,
    lunchEnd: validTime(raw?.lunchEnd) ?? DEFAULT_CAFE_HOURS.lunchEnd,
  };
}

function validTime(value: string | undefined): string | null {
  if (!value || !TIME.test(value)) return null;
  return parseTimeToMinutes(value) == null ? null : value;
}
