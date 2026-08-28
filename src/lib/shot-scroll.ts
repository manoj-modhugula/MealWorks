/** Match `.menu-shot-img` max-height transition. */
export const SHOT_MS = 450;

function clamp01(t: number) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t;
}

function sample(t: number, a: number, b: number) {
  const it = 1 - t;
  return 3 * a * it * it * t + 3 * b * it * t * t + t * t * t;
}

/** CSS cubic-bezier(0.22, 1, 0.36, 1) mapped from time 0–1. */
export function shotEase(x: number): number {
  x = clamp01(x);
  if (x === 0 || x === 1) return x;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const current = sample(t, 0.22, 0.36);
    const dt =
      3 * (1 - t) * (1 - t) * 0.22 + 6 * (1 - t) * t * 0.36 + 3 * t * t;
    if (Math.abs(dt) < 1e-6) break;
    t = clamp01(t - (current - x) / dt);
  }
  return sample(t, 1, 1);
}

export function scrollAt(
  from: number,
  to: number,
  elapsed: number,
  duration = SHOT_MS
): number {
  if (duration <= 0) return to;
  return from + (to - from) * shotEase(elapsed / duration);
}
