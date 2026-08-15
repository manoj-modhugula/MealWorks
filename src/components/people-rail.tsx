"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PeopleRail({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (next: number) => void;
}) {
  const prevRef = useRef(page);
  const dir =
    page > prevRef.current ? "fwd" : page < prevRef.current ? "back" : "none";
  prevRef.current = page;
  const [press, setPress] = useState<"prev" | "next" | null>(null);

  if (pageCount <= 1) return null;

  const atFirst = page <= 1;
  const atLast = page >= pageCount;

  function down(side: "prev" | "next", blocked: boolean) {
    if (blocked) return;
    setPress(side);
  }

  function up() {
    setPress(null);
  }

  return (
    <nav className="people-rail" aria-label="People pages">
      <div
        className="people-rail-island"
        data-press={press ?? undefined}
      >
        <button
          type="button"
          className="people-rail-pad"
          data-side="prev"
          disabled={atFirst}
          aria-label="Previous page"
          onPointerDown={() => down("prev", atFirst)}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          onClick={() => onPage(Math.max(1, page - 1))}
        >
          <ChevronLeft size={20} strokeWidth={2.2} />
        </button>
        <div className="people-rail-readout" aria-live="polite">
          <span
            key={page}
            className="analog-digit"
            data-active="true"
            data-dir={dir}
          >
            {page}
          </span>
          <span className="people-rail-of">of</span>
          <span className="analog-digit">{pageCount}</span>
        </div>
        <button
          type="button"
          className="people-rail-pad"
          data-side="next"
          disabled={atLast}
          aria-label="Next page"
          onPointerDown={() => down("next", atLast)}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          onClick={() => onPage(Math.min(pageCount, page + 1))}
        >
          <ChevronRight size={20} strokeWidth={2.2} />
        </button>
      </div>
    </nav>
  );
}
