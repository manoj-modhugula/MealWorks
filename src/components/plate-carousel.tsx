"use client";

import Image from "next/image";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dishPhoto } from "@/lib/sample-catalog";
import { cn } from "@/lib/utils";

export type PlateCard = {
  title: string;
  items: string[];
  why?: string;
  itemReasons?: string[];
};

/** Three meal ideas with the selected card centered and adjacent cards visible. */
const SLOT_ORDER = ["Breakfast idea", "Lunch idea", "Salad bowl"] as const;
/** Hard cap so fixed-height cards never crop a 4th/5th line */
const MAX_ITEMS_PER_CARD = 3;

function normalizeSlots(combos: PlateCard[]): PlateCard[] {
  return SLOT_ORDER.map((title) => {
    const found = combos.find(
      (c) =>
        c.title === title ||
        c.title.toLowerCase().includes(title.split(" ")[0].toLowerCase()),
    );
    if (found) {
      return {
        ...found,
        title,
        items: (found.items || []).slice(0, MAX_ITEMS_PER_CARD),
        itemReasons: found.itemReasons?.slice(0, MAX_ITEMS_PER_CARD),
      };
    }
    return {
      title,
      items: [],
      why:
        title === "Salad bowl"
          ? "Few salad toppings fit today."
          : `Thin ${title.replace(" idea", "").toLowerCase()} options for you today`,
    };
  });
}

export function PlateCarousel({
  combos,
  headerAction,
}: {
  combos: PlateCard[];
  headerAction?: ReactNode;
}) {
  const slots = normalizeSlots(combos);
  const n = slots.length; // always 3
  const [active, setActive] = useState(1); // lunch center by default
  const touchX = useRef<number | null>(null);

  const rotate = useCallback(
    (dir: -1 | 1) => {
      setActive((i) => (i + dir + n) % n);
    },
    [n],
  );

  // Relative position: -1 left, 0 center, +1 right (shortest wrap)
  function rel(i: number) {
    let d = i - active;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  }

  return (
    <div className="plate-carousel">
      <div className="px-1 mb-4 plate-carousel-heading">
        <div className="plate-carousel-intro">
          <h2 className="card-title">Plate ideas</h2>
          <p className="section-description" style={{ margin: "6px 0 0" }}>
            A few good things, together.
          </p>
        </div>
        {headerAction}
      </div>
      <div
        className="plate-carousel-stage card"
        onTouchStart={(e) => {
          touchX.current = e.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const x = e.changedTouches[0]?.clientX ?? touchX.current;
          const dx = x - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) < 40) return;
          rotate(dx < 0 ? 1 : -1);
        }}
      >
        {/* Keep card movement inside the clipped track. */}
        <div className="plate-carousel-track">
          {slots.map((c, i) => {
            const r = rel(i);
            const role =
              r === 0
                ? "center"
                : r === -1
                  ? "left"
                  : r === 1
                    ? "right"
                    : "hidden";
            return (
              <button
                key={c.title}
                type="button"
                className={cn("plate-carousel-card", `is-${role}`)}
                data-role={role}
                tabIndex={0}
                aria-current={role === "center" ? "true" : undefined}
                aria-label={`${c.title}${role === "center" ? " (selected)" : ", bring to center"}`}
                onClick={() => {
                  if (role === "left") rotate(-1);
                  else if (role === "right") rotate(1);
                }}
              >
                <div className="plate-carousel-card-inner card">
                  {dishPhoto(c.items[0] ?? "") && (
                    <Image
                      className="plate-photo"
                      src={dishPhoto(c.items[0])!}
                      alt=""
                      fill
                      sizes="(max-width: 767px) 80vw, (max-width: 1280px) 48vw, 560px"
                    />
                  )}
                  <p className="card-title">{c.title}</p>
                  {c.items.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {c.why || "No strong picks today"}
                    </p>
                  ) : (
                    <ul className="plate-carousel-picks">
                      {c.items.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <p className="sr-only">
        Food photography is illustrative. Plate suggestions use today’s menu.
      </p>
      <div className="plate-carousel-controls">
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous plate idea"
          onClick={() => rotate(-1)}
        >
          <ChevronLeft size={18} strokeWidth={2} />
        </button>
        <div
          className="plate-carousel-dots"
          role="group"
          aria-label="Choose a plate idea"
        >
          {slots.map((c, i) => (
            <button
              key={c.title}
              type="button"
              aria-pressed={i === active}
              className="plate-carousel-dot"
              data-active={i === active}
              onClick={() => setActive(i)}
              aria-label={c.title}
            />
          ))}
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Next plate idea"
          onClick={() => rotate(1)}
        >
          <ChevronRight size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
