/** Pure date helpers (YYYY-MM-DD). */

export function addDaysISO(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function utcDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function weekdayShort(date: string): string {
  return utcDate(date).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

export function weekdayLong(date: string): string {
  return utcDate(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Compact chrome label, e.g. "Aug 11". */
export function formatMonthDay(date: string): string {
  return utcDate(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Monday of the week containing `date` (UTC calendar). */
export function startOfWeekMonday(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

export function weekDatesMonFri(anchor: string): string[] {
  const mon = startOfWeekMonday(anchor);
  return [0, 1, 2, 3, 4].map((i) => addDaysISO(mon, i));
}
