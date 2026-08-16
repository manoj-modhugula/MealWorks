import { SALAD_COMPOSE_STATION } from "./salad-compose";

export const ADMIN_ROOMS = [
  { id: "board", label: "Board" },
  { id: "notes", label: "Notes" },
  { id: "people", label: "People" },
  { id: "hours", label: "Hours" },
] as const;

export type AdminRoom = (typeof ADMIN_ROOMS)[number]["id"];

export function roomShowsDate(room: AdminRoom): boolean {
  return room === "board" || room === "notes";
}

export function boardStatus(opts: {
  hasMenu: boolean;
  itemCount: number;
}): string {
  if (!opts.hasMenu) return "No menu";
  return `Live · ${opts.itemCount}`;
}

export function canToggleAdmin(opts: {
  targetId: string;
  selfId: string;
}): boolean {
  return opts.targetId !== opts.selfId;
}

export const canBlockUser = canToggleAdmin;

export function isMenuUploadFile(name: string, type: string): boolean {
  return menuUploadKind(name, type) != null;
}

export function menuUploadKind(
  name: string,
  type = ""
): "image" | "pdf" | null {
  const mime = type.toLowerCase();
  if (mime === "application/pdf" || /\.pdf($|\?)/i.test(name)) return "pdf";
  if (mime.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(name)) {
    return "image";
  }
  return null;
}

export type StarCounts = {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
};

export function emptyStarCounts(): StarCounts {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

export function addStar(counts: StarCounts, stars: number | null): StarCounts {
  if (stars == null || stars < 1 || stars > 5) return counts;
  const key = stars as keyof StarCounts;
  return { ...counts, [key]: counts[key] + 1 };
}

export function starPercents(counts: StarCounts): StarCounts {
  const total = counts[1] + counts[2] + counts[3] + counts[4] + counts[5];
  if (total === 0) return emptyStarCounts();
  return {
    1: Math.round((counts[1] / total) * 100),
    2: Math.round((counts[2] / total) * 100),
    3: Math.round((counts[3] / total) * 100),
    4: Math.round((counts[4] / total) * 100),
    5: Math.round((counts[5] / total) * 100),
  };
}

export function emptyStarFilterCopy(stars: number): string {
  return `No ${stars} star notes.`;
}

export function summaryCacheFresh(opts: {
  cachedCount: number;
  cachedLatest: string;
  noteCount: number;
  latestCreatedAt: string;
}): boolean {
  return (
    opts.cachedCount === opts.noteCount &&
    opts.cachedLatest === opts.latestCreatedAt
  );
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function noteWhen(createdAt: string, now = new Date()): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return "";
  const days = Math.round(
    (startOfLocalDay(now).getTime() - startOfLocalDay(created).getTime()) /
      86_400_000
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return created.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function toPublicNote(
  row: {
    id: string;
    stars: number | null;
    note: string;
    createdAt: string;
    userId?: string;
    userName?: string;
  },
  now?: Date
): { id: string; stars: number | null; note: string; when: string } {
  return {
    id: row.id,
    stars: row.stars,
    note: row.note,
    when: noteWhen(row.createdAt, now),
  };
}

export const PEOPLE_PAGE_SIZE = 10;

export function peoplePageCount(
  total: number,
  size = PEOPLE_PAGE_SIZE
): number {
  if (total <= 0) return 1;
  return Math.ceil(total / size);
}

export function pageFromRail(t: number, pageCount: number): number {
  const last = Math.max(1, pageCount);
  const clamped = Math.min(1, Math.max(0, t));
  return Math.round(clamped * (last - 1)) + 1;
}

export function railFromPage(page: number, pageCount: number): number {
  const last = Math.max(1, pageCount);
  if (last <= 1) return 0;
  const current = Math.min(last, Math.max(1, page));
  return (current - 1) / (last - 1);
}

export function peoplePageWindow(
  page: number,
  pageCount: number
): Array<number | "dots"> {
  const last = Math.max(1, pageCount);
  const current = Math.min(Math.max(1, page), last);
  if (last <= 7) {
    return Array.from({ length: last }, (_, i) => i + 1);
  }
  const marks = new Set<number>([1, last, current]);
  for (let d = 1; d <= 2; d++) {
    if (current - d >= 1) marks.add(current - d);
    if (current + d <= last) marks.add(current + d);
  }
  const nums = [...marks].sort((a, b) => a - b);
  const out: Array<number | "dots"> = [];
  for (let i = 0; i < nums.length; i++) {
    if (i > 0 && nums[i] - nums[i - 1] > 1) out.push("dots");
    out.push(nums[i]);
  }
  return out;
}

export function adminConfirmPhrase(isAdmin: boolean): string {
  return isAdmin ? "Remove admin" : "Make admin";
}

export function nextAdminConfirm(
  typed: string,
  key: string,
  phrase: string
): string {
  if (key.length !== 1) return typed;
  const next = typed + key;
  return phrase.startsWith(next) ? next : typed;
}

export function adminConfirmOk(typed: string, phrase: string): boolean {
  return typed === phrase;
}

export function boardFileLabel(hasMenu: boolean): string {
  return hasMenu ? "Replace file" : "Choose file";
}

export const BOARD_MEAL_VIEWS = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
] as const;

export type BoardMealView = (typeof BOARD_MEAL_VIEWS)[number]["id"];

export function itemInBoardMeal(
  item: { meal: string; station: string },
  view: BoardMealView
): boolean {
  if (item.station === SALAD_COMPOSE_STATION) return false;
  if (view === "breakfast") return item.meal === "breakfast";
  return item.meal !== "breakfast";
}

export type DishDraft = {
  id: string;
  meal: string;
  station: string;
  name: string;
  tags: string[];
  pending?: "add" | "delete";
};

export function editDishName(
  rows: DishDraft[],
  id: string,
  name: string
): DishDraft[] {
  return rows.map((row) => (row.id === id ? { ...row, name } : row));
}

export function markDishDeleted(rows: DishDraft[], id: string): DishDraft[] {
  return rows.flatMap((row) => {
    if (row.id !== id) return [row];
    if (row.pending === "add") return [];
    return [{ ...row, pending: "delete" as const }];
  });
}

export function visibleDishDrafts(rows: DishDraft[]): DishDraft[] {
  return rows.filter((row) => row.pending !== "delete");
}

export function addDishDraft(
  rows: DishDraft[],
  dish: { name: string; meal: string; station: string }
): DishDraft[] {
  const name = dish.name.trim();
  if (!name) return rows;
  return [
    ...rows,
    {
      id: `draft-${rows.length + 1}-${name}`,
      meal: dish.meal,
      station: dish.station.trim() || "Other",
      name,
      tags: [],
      pending: "add",
    },
  ];
}

export function dishDraftDirty(saved: DishDraft[], draft: DishDraft[]): boolean {
  const plan = dishSavePlan(saved, draft);
  return (
    plan.update.length > 0 || plan.remove.length > 0 || plan.create.length > 0
  );
}

export function dishSavePlan(
  saved: DishDraft[],
  draft: DishDraft[]
): {
  update: { id: string; name: string }[];
  remove: string[];
  create: { name: string; meal: string; station: string }[];
} {
  const savedById = new Map(saved.map((row) => [row.id, row]));
  const update: { id: string; name: string }[] = [];
  const remove: string[] = [];
  const create: { name: string; meal: string; station: string }[] = [];
  for (const row of draft) {
    if (row.pending === "add") {
      const name = row.name.trim();
      if (name) {
        create.push({
          name,
          meal: row.meal,
          station: row.station.trim() || "Other",
        });
      }
      continue;
    }
    if (row.pending === "delete") {
      if (savedById.has(row.id)) remove.push(row.id);
      continue;
    }
    const prev = savedById.get(row.id);
    const name = row.name.trim();
    if (prev && name && name !== prev.name) {
      update.push({ id: row.id, name });
    }
  }
  return { update, remove, create };
}

export function personInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const first = parts[0][0] || "";
  const last = parts[parts.length - 1][0] || "";
  return (first + last).toUpperCase();
}
