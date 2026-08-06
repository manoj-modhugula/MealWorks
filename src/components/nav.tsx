"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Settings,
  Sparkles,
  Sun,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";

const baseLinks = [
  { href: "/today", label: "Today", Icon: Sun },
  { href: "/menu", label: "Menu", Icon: UtensilsCrossed },
  { href: "/preferences", label: "Prefs", Icon: Sparkles },
  { href: "/settings", label: "Settings", Icon: Settings },
];

/** Logo drag-to-sign-out */
const ACTIVATE_PX = 10;
const HOLD_HINT_MS = 90;
const COMMIT_RATIO = 0.5;
const ARMED_RATIO = 0.86;
const FLICK_VELOCITY = 0.55;
const VELOCITY_FRESH_MS = 90;
const SNAP_MS = 280;
const EASE_SNAP = "cubic-bezier(0.22, 1.12, 0.36, 1)";

/**
 * Tab scrub: need clear horizontal intent before we steal the gesture.
 * Higher than before so trackpad jitter / long-press doesn't glitch.
 */
const SCRUB_ACTIVATE_PX = 14;
const SCRUB_AXIS_RATIO = 1.25; // |dx| must beat |dy| * this
/** Settle onto a tab after release — springy / overshoot */
const PILL_EASE = "cubic-bezier(0.22, 1.4, 0.36, 1)";
const PILL_MS = 380;
/** Extra width at mid-gap (liquid droplet stretch), px */
const DROPLET_STRETCH = 22;
/** Squash Y while stretched (volume-ish) */
const DROPLET_SQUASH = 0.1;
/** Follow finger with lag (0–1). Lower = more elastic pull */
const FOLLOW_LERP = 0.28;

type TabGeom = {
  href: string;
  left: number;
  width: number;
  center: number;
};

type ScrubMode = "idle" | "pending" | "scrubbing";

function activeHrefFor(pathname: string, hrefs: string[]) {
  return (
    hrefs.find((h) => pathname === h || pathname.startsWith(h + "/")) ||
    hrefs[0] ||
    "/today"
  );
}

function nearestTab(geoms: TabGeom[], localX: number): TabGeom | null {
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

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothstep(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * Liquid droplet morph: continuous left/width between tabs.
 * Fattens mid-gap (stretch) and picks nearest for highlight.
 */
function liquidPillAt(
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

  // Before first / after last center → rest on end tab
  if (x <= minC) {
    const g = geoms[0];
    return { left: g.left, width: g.width, scaleY: 1, href: g.href };
  }
  if (x >= maxC) {
    const g = geoms[geoms.length - 1];
    return { left: g.left, width: g.width, scaleY: 1, href: g.href };
  }

  // Segment between consecutive centers
  let i = 0;
  for (; i < geoms.length - 1; i++) {
    if (x >= geoms[i].center && x <= geoms[i + 1].center) break;
  }
  const A = geoms[i];
  const B = geoms[i + 1];
  const span = B.center - A.center || 1;
  const t = smoothstep((x - A.center) / span);

  // Base morph A → B
  let left = lerp(A.left, B.left, t);
  let width = lerp(A.width, B.width, t);

  // Droplet belly: extra stretch mid-travel (peaks at t=0.5)
  const belly = 4 * t * (1 - t); // 0..1..0
  width += DROPLET_STRETCH * belly;
  // Keep visual center tracking the blend of centers
  const center = lerp(A.center, B.center, t);
  left = center - width / 2;

  // Soft rubber at strip ends (slight resistance past first/last left edges)
  const minL = geoms[0].left;
  const maxR = geoms[geoms.length - 1].left + geoms[geoms.length - 1].width;
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
  const href = t < 0.5 ? A.href : B.href;
  return { left, width, scaleY, href };
}

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useSession();
  const isAdmin = Boolean(data?.user?.isAdmin);

  const links = isAdmin
    ? [...baseLinks, { href: "/admin", label: "Admin", Icon: Wrench }]
    : baseLinks;
  const hrefs = links.map((l) => l.href);
  const routeActive = activeHrefFor(pathname, hrefs);

  /* ── Logo drag-to-sign-out ── */
  const islandRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLButtonElement>(null);
  const snapTimerRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef({
    active: false,
    dragging: false,
    holding: false,
    startX: 0,
    maxX: 0,
    offset: 0,
    lastX: 0,
    lastT: 0,
    velocity: 0,
    pointerId: -1,
  });

  const [offset, setOffset] = useState(0);
  const [maxX, setMaxX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [holding, setHolding] = useState(false);
  const [nearEnd, setNearEnd] = useState(false);
  const [done, setDone] = useState(false);
  const [springing, setSpringing] = useState(false);
  const [snapDir, setSnapDir] = useState<"idle" | "out" | "back">("idle");

  /* ── Sliding selection pill ── */
  const navRef = useRef<HTMLElement>(null);
  const pillElRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const geomsRef = useRef<TabGeom[]>([]);
  const routeActiveRef = useRef(routeActive);
  routeActiveRef.current = routeActive;

  const scrubRef = useRef({
    mode: "idle" as ScrubMode,
    pointerId: -1 as number,
    startX: 0,
    startY: 0,
    targetHref: routeActive,
    suppressClickUntil: 0,
    // Elastic follow state (smoothed toward finger morph)
    curLeft: 0,
    curWidth: 0,
    curScaleY: 1,
    goalLeft: 0,
    goalWidth: 0,
    goalScaleY: 1,
    raf: null as number | null,
    winMove: null as ((e: PointerEvent) => void) | null,
    winUp: null as ((e: PointerEvent) => void) | null,
    winCancel: null as ((e: PointerEvent) => void) | null,
  });

  const [scrubbing, setScrubbing] = useState(false);
  const [highlightHref, setHighlightHref] = useState(routeActive);
  const highlightRef = useRef(routeActive);
  highlightRef.current = highlightHref;

  useEffect(() => {
    for (const l of links) router.prefetch(l.href);
  }, [router, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      detachWindowScrub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearSnapTimer = () => {
    if (snapTimerRef.current) {
      window.clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
    }
  };

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const measureTabs = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return [] as TabGeom[];
    const navRect = nav.getBoundingClientRect();
    const next: TabGeom[] = [];
    for (const l of links) {
      const el = itemRefs.current.get(l.href);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const left = r.left - navRect.left;
      next.push({
        href: l.href,
        left,
        width: r.width,
        center: left + r.width / 2,
      });
    }
    geomsRef.current = next;
    return next;
  }, [links]);

  /** Write pill geometry to DOM */
  const paintPillBox = useCallback(
    (
      left: number,
      width: number,
      opts?: { animate?: boolean; scaleY?: number }
    ) => {
      const el = pillElRef.current;
      if (!el) return;
      const animate = opts?.animate !== false;
      const scaleY = opts?.scaleY ?? 1;
      el.style.transition = animate
        ? `transform ${PILL_MS}ms ${PILL_EASE}, width ${PILL_MS}ms ${PILL_EASE}, border-radius ${PILL_MS}ms ease`
        : "none";
      el.style.width = `${width}px`;
      el.style.transform = `translate3d(${left}px, -50%, 0) scaleY(${scaleY})`;
      el.dataset.ready = "true";
      // Slightly more rounded when squashed (droplet)
      el.style.borderRadius =
        scaleY < 0.98 ? "999px / 999px" : "var(--radius-pill)";
    },
    []
  );

  /** Snap pill onto a route tab */
  const paintPill = useCallback(
    (href: string, opts?: { animate?: boolean; geoms?: TabGeom[] }) => {
      const list = opts?.geoms ?? geomsRef.current;
      const g = list.find((t) => t.href === href) || list[0];
      if (!g) return;

      paintPillBox(g.left, g.width, {
        animate: opts?.animate !== false,
        scaleY: 1,
      });
      scrubRef.current.curLeft = g.left;
      scrubRef.current.curWidth = g.width;
      scrubRef.current.curScaleY = 1;
      scrubRef.current.goalLeft = g.left;
      scrubRef.current.goalWidth = g.width;
      scrubRef.current.goalScaleY = 1;

      if (highlightRef.current !== href) {
        highlightRef.current = href;
        setHighlightHref(href);
      }
    },
    [paintPillBox]
  );

  /** rAF spring-follow toward goal while scrubbing */
  const tickScrubFollow = useCallback(() => {
    const s = scrubRef.current;
    s.raf = null;
    if (s.mode !== "scrubbing") return;

    s.curLeft = lerp(s.curLeft, s.goalLeft, FOLLOW_LERP);
    s.curWidth = lerp(s.curWidth, s.goalWidth, FOLLOW_LERP);
    s.curScaleY = lerp(s.curScaleY, s.goalScaleY, FOLLOW_LERP);

    paintPillBox(s.curLeft, s.curWidth, {
      animate: false,
      scaleY: s.curScaleY,
    });

    const dx = Math.abs(s.goalLeft - s.curLeft);
    const dw = Math.abs(s.goalWidth - s.curWidth);
    if (dx > 0.15 || dw > 0.15 || Math.abs(s.goalScaleY - s.curScaleY) > 0.002) {
      s.raf = requestAnimationFrame(tickScrubFollow);
    }
  }, [paintPillBox]);

  const setLiquidGoal = useCallback(
    (localX: number) => {
      const morph = liquidPillAt(geomsRef.current, localX);
      if (!morph) return;
      const s = scrubRef.current;
      s.goalLeft = morph.left;
      s.goalWidth = morph.width;
      s.goalScaleY = morph.scaleY;
      s.targetHref = morph.href;

      if (highlightRef.current !== morph.href) {
        highlightRef.current = morph.href;
        setHighlightHref(morph.href);
      }

      if (s.raf == null) {
        s.raf = requestAnimationFrame(tickScrubFollow);
      }
    },
    [tickScrubFollow]
  );

  function detachWindowScrub() {
    const s = scrubRef.current;
    if (s.winMove) {
      window.removeEventListener("pointermove", s.winMove);
      s.winMove = null;
    }
    if (s.winUp) {
      window.removeEventListener("pointerup", s.winUp);
      window.removeEventListener("pointercancel", s.winUp);
      s.winUp = null;
    }
    if (s.raf != null) {
      cancelAnimationFrame(s.raf);
      s.raf = null;
    }
  }

  const finishScrub = useCallback(
    (opts: { commit: boolean; clientX?: number }) => {
      const s = scrubRef.current;
      if (s.mode === "idle") return;

      const wasScrubbing = s.mode === "scrubbing";
      const pointerId = s.pointerId;

      s.mode = "idle";
      s.pointerId = -1;
      detachWindowScrub();
      setScrubbing(false);

      // Release capture if any
      const nav = navRef.current;
      if (nav && pointerId >= 0) {
        try {
          if (nav.hasPointerCapture(pointerId)) {
            nav.releasePointerCapture(pointerId);
          }
        } catch {
          /* ignore */
        }
      }

      if (!wasScrubbing) {
        // Pending only (tap / long-press without drag) — leave Link alone
        return;
      }

      // Block the synthetic click that follows pointerup
      s.suppressClickUntil = performance.now() + 450;

      let target = s.targetHref || routeActiveRef.current;
      if (nav && opts.clientX != null) {
        const localX = opts.clientX - nav.getBoundingClientRect().left;
        // Prefer droplet segment nearest; fall back to center nearest
        const morph = liquidPillAt(geomsRef.current, localX);
        if (morph) target = morph.href;
        else {
          const near = nearestTab(geomsRef.current, localX);
          if (near) target = near.href;
        }
      }

      // Elastic settle onto target (overshoot ease)
      measureTabs();
      paintPill(target, { animate: true });
      s.targetHref = target;

      if (opts.commit && target !== routeActiveRef.current) {
        router.push(target);
      } else if (!opts.commit) {
        paintPill(routeActiveRef.current, { animate: true });
      }
    },
    [measureTabs, paintPill, router]
  );

  // Sync pill when route changes (not mid-scrub)
  useLayoutEffect(() => {
    if (scrubRef.current.mode === "scrubbing") return;
    const geoms = measureTabs();
    paintPill(routeActive, { animate: true, geoms });
    highlightRef.current = routeActive;
    setHighlightHref(routeActive);
  }, [pathname, isAdmin, measureTabs, paintPill, routeActive]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return;
    const remeasure = () => {
      if (scrubRef.current.mode === "scrubbing") return;
      const geoms = measureTabs();
      paintPill(routeActiveRef.current, { animate: false, geoms });
    };
    const ro = new ResizeObserver(remeasure);
    ro.observe(nav);
    for (const el of itemRefs.current.values()) ro.observe(el);
    window.addEventListener("resize", remeasure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", remeasure);
    };
  }, [isAdmin, measureTabs, paintPill]);

  /* ── Sign-out helpers ── */
  const enterHoldPreview = useCallback(
    (trackMax: number) => {
      const d = dragRef.current;
      if (!d.active || d.holding || done) return;
      d.holding = true;
      setHolding(true);
      setMaxX(trackMax);
      setSpringing(false);
      setSnapDir("idle");
    },
    [done]
  );

  const paintOffset = useCallback((next: number, trackMax: number) => {
    dragRef.current.offset = next;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const o = dragRef.current.offset;
      const m = dragRef.current.maxX || trackMax;
      setOffset(o);
      setNearEnd(m > 0 && o / m >= ARMED_RATIO);
    });
  }, []);

  const resetDrag = useCallback((animate: boolean) => {
    const d = dragRef.current;
    d.active = false;
    d.dragging = false;
    d.holding = false;
    d.velocity = 0;
    d.offset = 0;
    clearHoldTimer();
    setDragging(false);
    setHolding(false);
    setNearEnd(false);

    if (animate) {
      setSnapDir("back");
      setSpringing(true);
      setOffset(0);
      clearSnapTimer();
      snapTimerRef.current = window.setTimeout(() => {
        setSpringing(false);
        setSnapDir("idle");
        setMaxX(0);
        snapTimerRef.current = null;
      }, SNAP_MS);
    } else {
      setOffset(0);
      setMaxX(0);
      setSpringing(false);
      setSnapDir("idle");
    }
  }, []);

  const commitSignOut = useCallback(() => {
    setDone(true);
    setNearEnd(true);
    setDragging(false);
    setHolding(false);
    void signOut({ callbackUrl: "/" });
  }, []);

  const finishSignOut = useCallback(
    (trackMax: number) => {
      clearHoldTimer();
      dragRef.current.active = false;
      dragRef.current.dragging = false;
      dragRef.current.holding = false;
      dragRef.current.velocity = 0;
      setDragging(false);
      setHolding(false);
      setSnapDir("out");
      setSpringing(true);
      const start = dragRef.current.offset;
      setOffset(trackMax);
      if (trackMax > 0 && start / trackMax >= ARMED_RATIO) {
        setNearEnd(true);
      } else {
        setNearEnd(false);
        window.setTimeout(() => setNearEnd(true), Math.round(SNAP_MS * 0.55));
      }
      clearSnapTimer();
      snapTimerRef.current = window.setTimeout(() => {
        setSpringing(false);
        commitSignOut();
        snapTimerRef.current = null;
      }, SNAP_MS);
    },
    [commitSignOut]
  );

  const onLogoPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (done || springing || e.button !== 0) return;
    // Don't start logo drag while scrubbing tabs
    if (scrubRef.current.mode !== "idle") return;
    const island = islandRef.current;
    const logo = logoRef.current;
    if (!island || !logo) return;

    e.preventDefault();

    const islandRect = island.getBoundingClientRect();
    const logoRect = logo.getBoundingClientRect();
    const pad = 6;
    const track =
      Math.max(0, islandRect.width - logoRect.width - pad * 2) || 1;

    const now = performance.now();
    clearHoldTimer();
    dragRef.current = {
      active: true,
      dragging: false,
      holding: false,
      startX: e.clientX,
      maxX: track,
      offset: 0,
      lastX: e.clientX,
      lastT: now,
      velocity: 0,
      pointerId: e.pointerId,
    };
    setOffset(0);
    setNearEnd(false);
    setSpringing(false);
    setSnapDir("idle");
    setHolding(false);
    setDragging(false);

    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      if (dragRef.current.active && !done) {
        enterHoldPreview(track);
      }
    }, HOLD_HINT_MS);

    try {
      logo.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onLogoPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d.active || done || springing) return;
    if (d.pointerId !== e.pointerId) return;

    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    const instV = (e.clientX - d.lastX) / dt;
    if (Math.abs(e.clientX - d.lastX) < 0.5) d.velocity *= 0.5;
    else d.velocity = d.velocity * 0.4 + instV * 0.6;
    d.lastX = e.clientX;
    d.lastT = now;

    const dx = e.clientX - d.startX;
    if (!d.dragging) {
      if (dx < ACTIVATE_PX) return;
      clearHoldTimer();
      enterHoldPreview(d.maxX);
      d.dragging = true;
      setDragging(true);
    }

    paintOffset(Math.max(0, Math.min(d.maxX, dx)), d.maxX);
  };

  const onLogoPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d.active || d.pointerId !== e.pointerId) return;

    clearHoldTimer();
    const logo = logoRef.current;
    if (logo) {
      try {
        if (logo.hasPointerCapture(e.pointerId)) {
          logo.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }
    }

    if (!d.dragging && !d.holding) {
      d.active = false;
      setHolding(false);
      router.push("/today");
      return;
    }

    if (!d.dragging && d.holding) {
      resetDrag(true);
      return;
    }

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setOffset(d.offset);
    }

    const ratio = d.maxX > 0 ? d.offset / d.maxX : 0;
    const fresh = performance.now() - d.lastT < VELOCITY_FRESH_MS;
    if (ratio >= COMMIT_RATIO || (fresh && d.velocity >= FLICK_VELOCITY)) {
      finishSignOut(d.maxX);
      return;
    }
    resetDrag(true);
  };

  const onLogoPointerCancel = () => {
    if (done || springing) return;
    clearHoldTimer();
    if (dragRef.current.dragging || dragRef.current.holding) resetDrag(true);
    else {
      dragRef.current.active = false;
      dragRef.current.dragging = false;
      dragRef.current.holding = false;
      setHolding(false);
    }
  };

  const onLogoKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (
        window.confirm(
          "Sign out of MealWorks?"
        )
      ) {
        commitSignOut();
      }
    }
  };

  /* ── Tab scrub: clean state machine ── */
  const onNavPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (signingOut || e.button !== 0) return;
    // One pointer at a time
    if (scrubRef.current.mode !== "idle") return;
    // Don't fight logo drag
    if (dragRef.current.active) return;

    measureTabs();
    scrubRef.current.mode = "pending";
    scrubRef.current.pointerId = e.pointerId;
    scrubRef.current.startX = e.clientX;
    scrubRef.current.startY = e.clientY;
    scrubRef.current.targetHref = routeActiveRef.current;

    // Window listeners so release is never missed (trackpad quirks)
    const onWinMove = (ev: PointerEvent) => {
      const s = scrubRef.current;
      if (s.mode === "idle" || ev.pointerId !== s.pointerId) return;

      // Mouse released but move still fires → hard stop (your “slides after release” bug)
      if (ev.pointerType === "mouse" && ev.buttons === 0) {
        finishScrub({ commit: s.mode === "scrubbing", clientX: ev.clientX });
        return;
      }

      const dx = ev.clientX - s.startX;
      const dy = ev.clientY - s.startY;

      if (s.mode === "pending") {
        if (Math.abs(dx) < SCRUB_ACTIVATE_PX) return;
        // Prefer horizontal; ignore mostly-vertical (scroll / trackpad noise)
        if (Math.abs(dx) < Math.abs(dy) * SCRUB_AXIS_RATIO) {
          // Abort pending — was not a horizontal scrub
          s.mode = "idle";
          s.pointerId = -1;
          detachWindowScrub();
          return;
        }

        s.mode = "scrubbing";
        s.targetHref = routeActiveRef.current;
        // Seed follow from current painted position
        const seed = geomsRef.current.find(
          (t) => t.href === routeActiveRef.current
        );
        if (seed) {
          s.curLeft = seed.left;
          s.curWidth = seed.width;
          s.curScaleY = 1;
          s.goalLeft = seed.left;
          s.goalWidth = seed.width;
          s.goalScaleY = 1;
        }
        setScrubbing(true);
        // Capture only after intent is clear (keeps normal clicks clean)
        try {
          navRef.current?.setPointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
      }

      if (s.mode !== "scrubbing") return;

      const nav = navRef.current;
      if (!nav) return;
      const localX = ev.clientX - nav.getBoundingClientRect().left;
      // Continuous liquid morph toward finger (elastic follow via rAF)
      setLiquidGoal(localX);
    };

    const onWinUp = (ev: PointerEvent) => {
      const s = scrubRef.current;
      if (ev.pointerId !== s.pointerId && s.pointerId !== -1) return;
      finishScrub({
        commit: s.mode === "scrubbing",
        clientX: ev.clientX,
      });
    };

    scrubRef.current.winMove = onWinMove;
    scrubRef.current.winUp = onWinUp;
    window.addEventListener("pointermove", onWinMove, { passive: true });
    window.addEventListener("pointerup", onWinUp);
    window.addEventListener("pointercancel", onWinUp);
  };

  const onLinkClick = (e: ReactMouseEvent<HTMLAnchorElement>, href: string) => {
    const s = scrubRef.current;
    if (performance.now() < s.suppressClickUntil || s.mode === "scrubbing") {
      e.preventDefault();
      return;
    }
    // Instant pill slide on click; Link handles navigation
    measureTabs();
    paintPill(href, { animate: true });
  };

  const progress = maxX > 0 ? Math.min(1, offset / maxX) : 0;
  const signingOut = holding || dragging || done || springing;
  const showRed = nearEnd || done;
  const hintText = nearEnd
    ? "release to sign out"
    : "slide right to sign out";

  const fillPct =
    signingOut && progress > 0.001
      ? progress * 100
      : holding && !dragging
        ? 6
        : 0;

  const logoTransition = springing
    ? `transform ${SNAP_MS}ms ${EASE_SNAP}`
    : dragging
      ? "none"
      : `transform 0.18s ${EASE_SNAP}, box-shadow 0.2s ease, background 0.22s ease`;

  const visualActive = scrubbing ? highlightHref : routeActive;

  return (
    <>
      <header className="nav-island-wrap">
        <div
          ref={islandRef}
          className="nav-island glass"
          data-signing-out={signingOut ? "true" : "false"}
          data-signout-armed={showRed ? "true" : "false"}
          data-signout-done={done ? "true" : "false"}
          data-signout-springing={springing ? "true" : "false"}
          data-signout-dir={snapDir}
        >
          <div
            className="nav-signout-fill"
            style={{ width: `${fillPct}%` }}
            aria-hidden
          />

          <div className="nav-signout-hint" aria-hidden={!signingOut}>
            <span className="nav-signout-chevrons" data-armed={showRed}>
              <span>{">"}</span>
              <span>{">"}</span>
              <span>{">"}</span>
            </span>
            <span className="nav-signout-hint-text">{hintText}</span>
          </div>

          <div className="nav-island-brand">
            <button
              ref={logoRef}
              type="button"
              className="logo-mark logo-mark-drag"
              style={{
                transform: `translate3d(${offset}px, 0, 0) scale(${
                  showRed ? 1.07 : dragging ? 1.03 : 1
                })`,
                transition: logoTransition,
              }}
              data-dragging={dragging || holding ? "true" : "false"}
              data-armed={showRed ? "true" : "false"}
              aria-label="MealWorks. Tap for Today. Hold and slide right to sign out. Press Enter for sign-out confirmation."
              onPointerDown={onLogoPointerDown}
              onPointerMove={onLogoPointerMove}
              onPointerUp={onLogoPointerUp}
              onPointerCancel={onLogoPointerCancel}
              onLostPointerCapture={onLogoPointerCancel}
              onKeyDown={onLogoKeyDown}
              onContextMenu={(e) => e.preventDefault()}
            >
              <UtensilsCrossed size={18} strokeWidth={2} aria-hidden />
            </button>
            <Link
              href="/today"
              className="brand-wordmark"
              tabIndex={signingOut ? -1 : 0}
            >
              MealWorks
            </Link>
          </div>

          <nav
            ref={navRef}
            className="desktop-nav-links nav-island-links"
            aria-label="Main"
            aria-hidden={signingOut}
            data-scrubbing={scrubbing ? "true" : "false"}
            onPointerDown={onNavPointerDown}
          >
            <div
              ref={pillElRef}
              className="nav-active-pill"
              aria-hidden
              data-scrubbing={scrubbing ? "true" : "false"}
            />

            {links.map((l) => {
              const active = visualActive === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  ref={(el) => {
                    if (el) itemRefs.current.set(l.href, el);
                    else itemRefs.current.delete(l.href);
                  }}
                  className="nav-pill"
                  data-active={active}
                  aria-current={routeActive === l.href ? "page" : undefined}
                  tabIndex={signingOut ? -1 : 0}
                  draggable={false}
                  onClick={(e) => onLinkClick(e, l.href)}
                  onDragStart={(e) => e.preventDefault()}
                >
                  <l.Icon size={18} strokeWidth={2} aria-hidden />
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <nav className="bottom-dock md:hidden" aria-label="Mobile">
        <div className="bottom-dock-island glass">
          {links.map((l) => {
            const active =
              pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className="dock-item"
                data-active={active}
                aria-current={active ? "page" : undefined}
                draggable={false}
              >
                <l.Icon size={20} strokeWidth={2} aria-hidden />
                <span>{l.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
