"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** Fast ease-out so the island and score card move as one snap. */
const SLOT_MS = 200;

export function WeekStripSlot({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const fullRef = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;
  const skipFirst = useRef(true);
  const [height, setHeight] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [animating, setAnimating] = useState(false);

  const measureInner = () => innerRef.current?.offsetHeight ?? 0;

  useLayoutEffect(() => {
    const full = measureInner();
    if (full > 0) fullRef.current = full;
    if (!ready) {
      setHeight(open ? full : 0);
      const id = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(id);
    }
  }, [open, ready]);

  useLayoutEffect(() => {
    if (!ready) return;
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const full = measureInner();
    if (full > 0) fullRef.current = full;
    setAnimating(true);
    setHeight(open ? fullRef.current : 0);
  }, [open, ready]);

  useEffect(() => {
    if (!animating) return;
    const id = window.setTimeout(() => setAnimating(false), SLOT_MS);
    return () => window.clearTimeout(id);
  }, [animating, open]);

  useEffect(() => {
    const el = innerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (!openRef.current || animating) return;
      const next = el.offsetHeight;
      if (next > 0 && next !== fullRef.current) {
        fullRef.current = next;
        setHeight(next);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [animating]);

  return (
    <div
      className="week-strip-slot"
      data-open={open ? "true" : "false"}
      data-ready={ready ? "true" : undefined}
      data-animating={animating ? "true" : undefined}
      aria-hidden={!open}
    >
      <div
        className="week-strip-slot-clip"
        style={height == null ? undefined : { height }}
      >
        <div ref={innerRef} className="week-strip-slot-inner">
          {children}
        </div>
      </div>
    </div>
  );
}
