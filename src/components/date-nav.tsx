"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDaysISO, formatMonthDay } from "@/lib/dates";

const DATE_PILL_HOLD_MS = 260;

export function DateNav({
  date,
  onChange,
  maxDate,
  onHold,
}: {
  date: string;
  onChange: (next: string) => void;
  maxDate?: string;
  onHold?: () => void;
}) {
  const canNext = !maxDate || date < maxDate;
  const prevRef = useRef(date);
  const dir = date > prevRef.current ? "fwd" : date < prevRef.current ? "back" : "none";
  prevRef.current = date;
  const hold = useRef<number | null>(null);
  const suppressClickUntil = useRef(0);

  function clearHold() {
    if (hold.current != null) {
      window.clearTimeout(hold.current);
      hold.current = null;
    }
  }

  useEffect(() => () => clearHold(), []);

  function step(delta: number) {
    if (performance.now() < suppressClickUntil.current) return;
    if (delta > 0 && !canNext) return;
    onChange(addDaysISO(date, delta));
  }

  return (
    <div
      className="date-nav"
      onPointerDown={(e) => {
        if (!onHold || e.button !== 0) return;
        clearHold();
        hold.current = window.setTimeout(() => {
          hold.current = null;
          suppressClickUntil.current = performance.now() + 400;
          onHold();
        }, DATE_PILL_HOLD_MS);
      }}
      onPointerUp={clearHold}
      onPointerCancel={clearHold}
      onPointerLeave={clearHold}
      onContextMenu={(e) => {
        if (onHold) e.preventDefault();
      }}
    >
      <button
        type="button"
        className="icon-btn !h-9 !w-9"
        aria-label="Previous day"
        onClick={() => step(-1)}
      >
        <ChevronLeft size={18} strokeWidth={2} />
      </button>
      <span className="date-nav-value" key={date} data-dir={dir}>
        {formatMonthDay(date)}
      </span>
      <button
        type="button"
        className="icon-btn !h-9 !w-9"
        aria-label="Next day"
        disabled={!canNext}
        onClick={() => step(1)}
      >
        <ChevronRight size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
