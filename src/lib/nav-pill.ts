/** Shared pure helpers for the desktop nav liquid selection pill. */

export type TabGeom = {
  href: string;
  left: number;
  width: number;
  center: number;
};

/** Extra width at mid-gap (liquid droplet stretch), px */
export const DROPLET_STRETCH = 22;
/** Squash Y while stretched (volume-ish) */
export const DROPLET_SQUASH = 0.1;
/** Base follow rate from 0 to 1. Lower is more elastic. */
export const FOLLOW_LERP_BASE = 0.32;
/** Cap when goal is far (multi-tab scrub) */
export const FOLLOW_LERP_MAX = 0.72;
/** Distance (px) at which follow hits max rate */
export const FOLLOW_LERP_DIST = 120;

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function smoothstep(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Adaptive follow: snappier over multi-tab distances, elastic for small moves. */
export function followLerp(distancePx: number): number {
  const t = clamp(distancePx / FOLLOW_LERP_DIST, 0, 1);
  return lerp(FOLLOW_LERP_BASE, FOLLOW_LERP_MAX, t);
}

export function nearestTab(
  geoms: TabGeom[],
  localX: number
): TabGeom | null {
  if (!geoms.length) return null;
  let best = geoms[0];
  let bestDist = Math.abs(localX - best.center);
  for (let i = 1; i < geoms.length; i++) {
    const d = Math.abs(localX - geoms[i].center);
    if (d < bestDist) {
      best = geoms[i];
      bestDist = d;
    }
  }
  return best;
}

/**
 * Liquid droplet morph: continuous left/width along the full tab strip.
 * Walks consecutive center segments so multi-tab scrub stays continuous.
 * `href` is the tab nearest the finger (not stuck to the segment origin).
 */
export function liquidPillAt(
  geoms: TabGeom[],
  localX: number
): { left: number; width: number; scaleY: number; href: string } | null {
  if (!geoms.length) return null;
  if (geoms.length === 1) {
    const g = geoms[0];
    return { left: g.left, width: g.width, scaleY: 1, href: g.href };
  }

  const minC = geoms[0].center;
  const maxC = geoms[geoms.length - 1].center;
  const x = clamp(localX, minC, maxC);

  if (x <= minC) {
    const g = geoms[0];
    return { left: g.left, width: g.width, scaleY: 1, href: g.href };
  }
  if (x >= maxC) {
    const g = geoms[geoms.length - 1];
    return { left: g.left, width: g.width, scaleY: 1, href: g.href };
  }

  // Segment between consecutive centers (x is strictly inside (minC, maxC))
  let i = 0;
  for (; i < geoms.length - 1; i++) {
    if (x >= geoms[i].center && x <= geoms[i + 1].center) break;
  }
  // Safety: if loop exits without break, clamp to last segment
  if (i >= geoms.length - 1) i = geoms.length - 2;

  const A = geoms[i];
  const B = geoms[i + 1];
  const span = B.center - A.center || 1;
  const t = smoothstep((x - A.center) / span);

  let left = lerp(A.left, B.left, t);
  let width = lerp(A.width, B.width, t);

  const belly = 4 * t * (1 - t);
  width += DROPLET_STRETCH * belly;
  const center = lerp(A.center, B.center, t);
  left = center - width / 2;

  const minL = geoms[0].left;
  const maxR =
    geoms[geoms.length - 1].left + geoms[geoms.length - 1].width;
  if (left < minL) {
    const over = minL - left;
    left = minL - over * 0.25;
    width = Math.max(width - over * 0.15, A.width * 0.85);
  }
  if (left + width > maxR) {
    const over = left + width - maxR;
    width = Math.max(width - over * 0.15, B.width * 0.85);
    left = maxR - width + over * 0.25;
  }

  const scaleY = 1 - DROPLET_SQUASH * belly;
  // Finger-true tab, not only local segment midpoint
  const near = nearestTab(geoms, localX);
  const href = near?.href ?? (t < 0.5 ? A.href : B.href);
  return { left, width, scaleY, href };
}
