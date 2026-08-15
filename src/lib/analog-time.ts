export type ClockTime = {
  hours24: number;
  minutes: number;
};

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseHHMM(value: string): ClockTime | null {
  const m = HHMM.exec(value);
  if (!m) return null;
  return { hours24: Number(m[1]), minutes: Number(m[2]) };
}

export function formatHHMM(t: ClockTime): string {
  const h = String(t.hours24).padStart(2, "0");
  const m = String(t.minutes).padStart(2, "0");
  return `${h}:${m}`;
}

export function formatAnalogLabel(t: ClockTime): string {
  const hour12 = t.hours24 % 12 || 12;
  const period = t.hours24 < 12 ? "AM" : "PM";
  const m = String(t.minutes).padStart(2, "0");
  return `${hour12}:${m} ${period}`;
}

export function snapMinutes(minutes: number, step = 5): number {
  const snapped = Math.round(minutes / step) * step;
  return ((snapped % 60) + 60) % 60;
}

export function hourHandAngle(hours24: number, minutes: number): number {
  const hour12 = hours24 % 12;
  return hour12 * 30 + minutes * 0.5;
}

export function minuteHandAngle(minutes: number): number {
  return minutes * 6;
}

/** 0° at 12 o'clock, clockwise. */
export function angleFromCenter(
  cx: number,
  cy: number,
  x: number,
  y: number
): number {
  const rad = Math.atan2(x - cx, cy - y);
  return ((rad * 180) / Math.PI + 360) % 360;
}

export function hourFromAngle(angle: number): number {
  const hour = Math.round(angle / 30) % 12;
  return hour === 0 ? 12 : hour;
}

export function minuteFromAngle(angle: number, step = 5): number {
  const raw = angle / 6;
  return snapMinutes(raw, step);
}

function shortestArc(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function nearerHand(angle: number, t: ClockTime): "hour" | "minute" {
  const hour = hourHandAngle(t.hours24, t.minutes);
  const minute = minuteHandAngle(t.minutes);
  return shortestArc(angle, hour) <= shortestArc(angle, minute)
    ? "hour"
    : "minute";
}

function hour24From12(hour12: number, hours24: number): number {
  const isPm = hours24 >= 12;
  const h = hour12 % 12;
  return isPm ? h + 12 : h;
}

export function applyAngleToTime(
  t: ClockTime,
  angle: number,
  hand: "hour" | "minute"
): ClockTime {
  if (hand === "minute") {
    return { hours24: t.hours24, minutes: minuteFromAngle(angle) };
  }
  const hour12 = hourFromAngle(angle);
  return { hours24: hour24From12(hour12, t.hours24), minutes: t.minutes };
}

export function togglePeriod(t: ClockTime): ClockTime {
  return { hours24: (t.hours24 + 12) % 24, minutes: t.minutes };
}

export function setPeriod(t: ClockTime, period: "AM" | "PM"): ClockTime {
  const hour12 = t.hours24 % 12;
  return {
    hours24: period === "PM" ? hour12 + 12 : hour12,
    minutes: t.minutes,
  };
}

export function nudgeMinutes(t: ClockTime, delta: number): ClockTime {
  const total = t.hours24 * 60 + t.minutes + delta;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return {
    hours24: Math.floor(wrapped / 60),
    minutes: wrapped % 60,
  };
}

export function periodOf(t: ClockTime): "AM" | "PM" {
  return t.hours24 < 12 ? "AM" : "PM";
}

export function hour12Of(t: ClockTime): number {
  return t.hours24 % 12 || 12;
}

/** Hour-mode thumb sits on the number, ignoring minutes. */
export function hourDialAngle(hours24: number): number {
  return (hours24 % 12) * 30;
}

export function nudgeHours(t: ClockTime, delta: number): ClockTime {
  return { hours24: (t.hours24 + delta + 24) % 24, minutes: t.minutes };
}

/** 0° is 12 o'clock. */
export function pointOnDial(
  angleDeg: number,
  radius: number,
  cx = 50,
  cy = 50
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.sin(rad),
    y: cy - radius * Math.cos(rad),
  };
}

export const HOUR_MARKS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export const MINUTE_MARKS = [
  0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55,
] as const;
