"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDaysISO, formatMonthDay } from "@/lib/dates";

export function DateNav({
  date,
  onChange,
  maxDate,
}: {
  date: string;
  onChange: (next: string) => void;
  maxDate?: string;
}) {
  const canNext = !maxDate || date < maxDate;
  const prevRef = useRef(date);
  const dir = date > prevRef.current ? "fwd" : date < prevRef.current ? "back" : "none";
  prevRef.current = date;

  return (
    <div className="date-nav">
      <button
        type="button"
        className="icon-btn !h-9 !w-9"
        aria-label="Previous day"
        onClick={() => onChange(addDaysISO(date, -1))}
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
        onClick={() => canNext && onChange(addDaysISO(date, 1))}
      >
        <ChevronRight size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
