"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { weekdayLong, weekdayShort } from "@/lib/dates";
import { todayOnDevice } from "@/lib/client-date";
import {
  followLerp,
  lerp,
  liquidPillAt,
  nearestTab,
  type TabGeom,
} from "@/lib/nav-pill";

const PILL_MS = 380;
const PILL_EASE = "cubic-bezier(0.22, 1.4, 0.36, 1)";
const SCRUB_ACTIVATE_PX = 12;
const SCRUB_AXIS_RATIO = 1.25;

export type WeekDay = {
  date: string;
  score: number | null;
  hasMenu: boolean;
};

function reducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function WeekStrip({
  days,
  date,
  onChange,
}: {
  days: WeekDay[];
  date: string;
  onChange: (next: string) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const dateRef = useRef(date);
  dateRef.current = date;
  const daysRef = useRef(days);
  daysRef.current = days;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const readyRef = useRef(false);
  const paintedRef = useRef(date);
  const highlightRef = useRef(date);
  const [highlight, setHighlight] = useState(date);
  const [scrubbing, setScrubbing] = useState(false);
  const today = todayOnDevice();

  const motion = useRef({
    mode: "idle" as "idle" | "pending" | "scrubbing",
    pointerId: -1,
    startX: 0,
    startY: 0,
    target: date,
    curLeft: 0,
    curWidth: 0,
    curScaleY: 1,
    goalLeft: 0,
    goalWidth: 0,
    goalScaleY: 1,
    raf: null as number | null,
    suppressClickUntil: 0,
    winMove: null as ((ev: PointerEvent) => void) | null,
    winUp: null as ((ev: PointerEvent) => void) | null,
  });

  const measureAll = useCallback((): TabGeom[] => {
    const strip = stripRef.current;
    if (!strip) return [];
    const box = strip.getBoundingClientRect();
    const next: TabGeom[] = [];
    for (const d of daysRef.current) {
      const el = itemRefs.current.get(d.date);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const left = r.left - box.left;
      next.push({
        href: d.date,
        left,
        width: r.width,
        center: left + r.width / 2,
      });
    }
    return next;
  }, []);

  const measureOne = useCallback((id: string) => {
    const strip = stripRef.current;
    const el = itemRefs.current.get(id);
    if (!strip || !el) return null;
    const box = strip.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      left: r.left - box.left,
      width: r.width,
      height: r.height,
    };
  }, []);

  const paintBox = useCallback(
    (
      left: number,
      width: number,
      opts?: { animate?: boolean; scaleY?: number; height?: number }
    ) => {
      const el = pillRef.current;
      if (!el) return;
      const animate = opts?.animate !== false && !reducedMotion();
      const scaleY = opts?.scaleY ?? 1;
      el.style.transition = animate
        ? `transform ${PILL_MS}ms ${PILL_EASE}, width ${PILL_MS}ms ${PILL_EASE}, height ${PILL_MS}ms ${PILL_EASE}, border-radius ${PILL_MS}ms ease, box-shadow 0.2s ease`
        : "none";
      el.style.width = `${width}px`;
      if (opts?.height != null) el.style.height = `${opts.height}px`;
      el.style.transform = `translate3d(${left}px, -50%, 0) scaleY(${scaleY})`;
      el.style.borderRadius = scaleY < 0.98 ? "18px / 22px" : "14px";
      el.dataset.ready = "true";
    },
    []
  );

  const paintDate = useCallback(
    (id: string, animate: boolean) => {
      const g = measureOne(id);
      if (!g) return;
      const m = motion.current;
      m.curLeft = g.left;
      m.curWidth = g.width;
      m.curScaleY = 1;
      m.goalLeft = g.left;
      m.goalWidth = g.width;
      m.goalScaleY = 1;
      paintedRef.current = id;
      paintBox(g.left, g.width, { animate, scaleY: 1, height: g.height });
    },
    [measureOne, paintBox]
  );

  const nearestWithMenu = useCallback((id: string) => {
    const list = daysRef.current;
    const hit = list.find((d) => d.date === id);
    if (hit?.hasMenu) return id;
    const idx = list.findIndex((d) => d.date === id);
    for (let step = 1; step < list.length; step++) {
      const left = list[idx - step];
      const right = list[idx + step];
      if (left?.hasMenu) return left.date;
      if (right?.hasMenu) return right.date;
    }
    return dateRef.current;
  }, []);

  const markHighlight = useCallback((id: string) => {
    if (highlightRef.current === id) return;
    highlightRef.current = id;
    setHighlight(id);
  }, []);

  const tickFollow = useCallback(() => {
    const m = motion.current;
    m.raf = null;
    if (m.mode !== "scrubbing") return;
    const dist = Math.hypot(m.goalLeft - m.curLeft, m.goalWidth - m.curWidth);
    const k = reducedMotion() ? 1 : followLerp(dist);
    m.curLeft = lerp(m.curLeft, m.goalLeft, k);
    m.curWidth = lerp(m.curWidth, m.goalWidth, k);
    m.curScaleY = lerp(m.curScaleY, m.goalScaleY, k);
    paintBox(m.curLeft, m.curWidth, { animate: false, scaleY: m.curScaleY });
    if (m.mode === "scrubbing") m.raf = requestAnimationFrame(tickFollow);
  }, [paintBox]);

  const setLiquidGoal = useCallback(
    (localX: number) => {
      const geoms = measureAll();
      const morph = liquidPillAt(geoms, localX);
      if (!morph) return;
      const m = motion.current;
      m.goalLeft = morph.left;
      m.goalWidth = morph.width;
      m.goalScaleY = morph.scaleY;
      const near = nearestTab(geoms, localX);
      const raw = near?.href ?? morph.href;
      m.target = raw;
      markHighlight(raw);
      if (m.raf == null) m.raf = requestAnimationFrame(tickFollow);
    },
    [markHighlight, measureAll, nearestWithMenu, tickFollow]
  );

  const detachWin = useCallback(() => {
    const m = motion.current;
    if (m.winMove) {
      window.removeEventListener("pointermove", m.winMove);
      m.winMove = null;
    }
    if (m.winUp) {
      window.removeEventListener("pointerup", m.winUp);
      window.removeEventListener("pointercancel", m.winUp);
      m.winUp = null;
    }
    if (m.raf != null) {
      cancelAnimationFrame(m.raf);
      m.raf = null;
    }
  }, []);

  const releaseCapture = (pointerId: number) => {
    const strip = stripRef.current;
    if (!strip || pointerId < 0) return;
    try {
      if (strip.hasPointerCapture(pointerId)) strip.releasePointerCapture(pointerId);
    } catch {
      /* ignore */
    }
  };

  const finishScrub = useCallback(
    (opts: { commit: boolean; clientX?: number }) => {
      const m = motion.current;
      if (m.mode === "idle") return;
      const wasScrubbing = m.mode === "scrubbing";
      const pointerId = m.pointerId;
      m.mode = "idle";
      m.pointerId = -1;
      detachWin();
      releaseCapture(pointerId);
      setScrubbing(false);

      if (!wasScrubbing) return;
      m.suppressClickUntil = performance.now() + 400;

      let target = m.target;
      if (stripRef.current && opts.clientX != null) {
        const localX =
          opts.clientX - stripRef.current.getBoundingClientRect().left;
        target = nearestTab(measureAll(), localX)?.href ?? target;
      }
      const next = opts.commit ? nearestWithMenu(target) : dateRef.current;
      markHighlight(next);
      paintDate(next, true);
      if (opts.commit && next !== dateRef.current) onChangeRef.current(next);
    },
    [detachWin, markHighlight, measureAll, nearestWithMenu, paintDate]
  );

  const selectDay = useCallback(
    (raw: string) => {
      if (performance.now() < motion.current.suppressClickUntil) return;
      if (motion.current.mode === "scrubbing") return;
      const next = nearestWithMenu(raw);
      markHighlight(next);
      paintDate(next, true);
      if (next !== dateRef.current) onChangeRef.current(next);
    },
    [markHighlight, nearestWithMenu, paintDate]
  );

  const onStripPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const m = motion.current;
    if (m.mode !== "idle") return;

    m.mode = "pending";
    m.pointerId = e.pointerId;
    m.startX = e.clientX;
    m.startY = e.clientY;
    m.target = dateRef.current;

    const onMove = (ev: PointerEvent) => {
      const s = motion.current;
      if (s.mode === "idle" || ev.pointerId !== s.pointerId) return;
      if (ev.pointerType === "mouse" && ev.buttons === 0) {
        finishScrub({ commit: s.mode === "scrubbing", clientX: ev.clientX });
        return;
      }
      const dx = ev.clientX - s.startX;
      const dy = ev.clientY - s.startY;
      if (s.mode === "pending") {
        if (Math.abs(dx) < SCRUB_ACTIVATE_PX) return;
        if (Math.abs(dx) < Math.abs(dy) * SCRUB_AXIS_RATIO) {
          s.mode = "idle";
          s.pointerId = -1;
          detachWin();
          return;
        }
        s.mode = "scrubbing";
        const g = measureOne(dateRef.current);
        if (g) {
          s.curLeft = g.left;
          s.curWidth = g.width;
          s.curScaleY = 1;
          s.goalLeft = g.left;
          s.goalWidth = g.width;
          s.goalScaleY = 1;
        }
        setScrubbing(true);
        try {
          stripRef.current?.setPointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
      }
      if (s.mode !== "scrubbing" || !stripRef.current) return;
      setLiquidGoal(
        ev.clientX - stripRef.current.getBoundingClientRect().left
      );
    };

    const onUp = (ev: PointerEvent) => {
      const s = motion.current;
      if (ev.pointerId !== s.pointerId && s.pointerId !== -1) return;
      finishScrub({
        commit: s.mode === "scrubbing",
        clientX: ev.clientX,
      });
    };

    m.winMove = onMove;
    m.winUp = onUp;
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const onStripKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const menuDays = daysRef.current.filter((d) => d.hasMenu);
    if (!menuDays.length) return;
    const idx = menuDays.findIndex((d) => d.date === dateRef.current);
    const nextIdx =
      e.key === "ArrowRight"
        ? Math.min(menuDays.length - 1, Math.max(0, idx) + 1)
        : Math.max(0, (idx < 0 ? 0 : idx) - 1);
    const next = menuDays[nextIdx];
    if (next) selectDay(next.date);
  };

  useLayoutEffect(() => {
    if (motion.current.mode === "scrubbing") return;
    markHighlight(date);
    const already = paintedRef.current === date && readyRef.current;
    paintDate(date, readyRef.current && !already);
    if (measureOne(date)) readyRef.current = true;
  }, [date, days, markHighlight, measureOne, paintDate]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (motion.current.mode === "scrubbing") return;
      paintDate(dateRef.current, false);
    });
    ro.observe(strip);
    return () => ro.disconnect();
  }, [paintDate]);

  useEffect(() => () => detachWin(), [detachWin]);

  const visual = scrubbing ? highlight : date;

  return (
    <div
      ref={stripRef}
      className="week-strip mb-5"
      role="navigation"
      aria-label="Week"
      data-scrubbing={scrubbing ? "true" : undefined}
      onPointerDown={onStripPointerDown}
      onKeyDown={onStripKeyDown}
    >
      <div
        ref={pillRef}
        className="week-strip-pill"
        aria-hidden
        data-scrubbing={scrubbing ? "true" : undefined}
      />
      {days.map((d) => {
        const active = d.date === visual;
        const label = [
          weekdayLong(d.date),
          d.hasMenu
            ? d.score != null
              ? `score ${d.score}`
              : "menu posted"
            : "no menu, jumps to nearest posted day",
          d.date === today ? "today" : "",
        ]
          .filter(Boolean)
          .join(", ");
        return (
          <button
            key={d.date}
            type="button"
            ref={(el) => {
              if (el) itemRefs.current.set(d.date, el);
              else itemRefs.current.delete(d.date);
            }}
            className="week-day"
            data-active={active}
            data-empty={!d.hasMenu}
            data-today={d.date === today || undefined}
            aria-label={label}
            aria-current={d.date === date ? "date" : undefined}
            draggable={false}
            onClick={() => selectDay(d.date)}
            onDragStart={(e) => e.preventDefault()}
          >
            <div className="week-day-name">{weekdayShort(d.date)}</div>
            <div className="week-day-score">
              {d.hasMenu && d.score != null ? d.score : "·"}
            </div>
          </button>
        );
      })}
    </div>
  );
}
