"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft } from "lucide-react";
import { Alert, Card, Spinner } from "@/components/ui";
import {
  emptyStarCounts,
  emptyStarFilterCopy,
  starPercents,
  type StarCounts,
} from "@/lib/admin-view";

export type PublicNote = {
  id: string;
  stars: number | null;
  note: string;
  when: string;
};

const STAR_FILTERS = [null, 5, 4, 3, 2, 1] as const;

export function NoteDishPanel({
  dishName,
  date,
  seedCounts,
  seedAvg,
  seedCount,
  onClose,
}: {
  dishName: string;
  date: string;
  seedCounts?: StarCounts;
  seedAvg?: number | null;
  seedCount?: number;
  onClose: () => void;
}) {
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [starCounts, setStarCounts] = useState<StarCounts>(
    seedCounts || emptyStarCounts()
  );
  const [avgStars, setAvgStars] = useState<number | null>(seedAvg ?? null);
  const [count, setCount] = useState(seedCount ?? 0);
  const [notes, setNotes] = useState<PublicNote[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const loadPage = useCallback(
    async (nextCursor: string | null, append: boolean) => {
      if (append) setMoreLoading(true);
      else setLoading(true);
      setError("");
      try {
        const qs = new URLSearchParams({ date, dish: dishName });
        if (starFilter != null) qs.set("stars", String(starFilter));
        if (nextCursor) qs.set("cursor", nextCursor);
        const res = await fetch(`/api/admin/feedback/dish?${qs}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn’t load notes");
        setStarCounts(data.starCounts || emptyStarCounts());
        setAvgStars(data.avgStars ?? null);
        setCount(data.count || 0);
        setCursor(data.nextCursor || null);
        const page = (data.notes || []) as PublicNote[];
        setNotes((cur) => (append ? [...cur, ...page] : page));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn’t load notes");
      } finally {
        setLoading(false);
        setMoreLoading(false);
      }
    },
    [date, dishName, starFilter]
  );

  useEffect(() => {
    void loadPage(null, false);
  }, [loadPage]);

  useEffect(() => {
    let live = true;
    setSummary(null);
    void fetch(
      `/api/admin/feedback/summary?date=${encodeURIComponent(date)}&dish=${encodeURIComponent(dishName)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (!live) return;
        const text = String(data.summary || "").trim();
        setSummary(text || null);
      })
      .catch(() => {
        if (live) setSummary(null);
      });
    return () => {
      live = false;
    };
  }, [date, dishName]);

  useEffect(() => {
    setReady(true);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const percents = starPercents(starCounts);
  const rated =
    starCounts[1] + starCounts[2] + starCounts[3] + starCounts[4] + starCounts[5];

  if (!ready) return null;

  return createPortal(
    <div className="note-dish-panel" role="dialog" aria-modal="true">
      <div className="note-dish-panel-inner">
        <div className="note-dish-panel-head">
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Back"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="note-dish-panel-title">{dishName}</h2>
        </div>

        {summary && <p className="note-dish-summary">{summary}</p>}

        <Card className="note-star-card">
          <div className="note-star-head">
            <span className="note-star-avg">
              {avgStars != null ? avgStars.toFixed(1) : "0"}
            </span>
            {avgStars != null && (
              <span className="dish-stars-read">
                {"★".repeat(Math.round(avgStars))}
                <span className="dish-stars-off">
                  {"★".repeat(5 - Math.round(avgStars))}
                </span>
              </span>
            )}
            <span className="note-star-total">
              {count} note{count === 1 ? "" : "s"}
            </span>
          </div>
          <div className="note-star-bars">
            {([5, 4, 3, 2, 1] as const).map((star) => (
              <div key={star} className="note-star-row">
                <span>{star}</span>
                <div className="note-star-track">
                  <div
                    className="note-star-fill"
                    style={{ width: `${rated ? percents[star] : 0}%` }}
                  />
                </div>
                <span>{rated ? `${percents[star]}%` : "0%"}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="note-star-filters" role="radiogroup" aria-label="Stars">
          {STAR_FILTERS.map((n) => (
            <button
              key={n ?? "all"}
              type="button"
              className="chip"
              role="radio"
              aria-checked={starFilter === n}
              data-active={starFilter === n}
              onClick={() => setStarFilter(n)}
            >
              {n == null ? "All" : `${n}`}
            </button>
          ))}
        </div>

        {error && <Alert tone="bad">{error}</Alert>}
        {loading && <Spinner label="Notes" />}

        {!loading && notes.length === 0 && (
          <Card>
            <p className="text-sm text-[var(--muted)]">
              {starFilter != null
                ? emptyStarFilterCopy(starFilter)
                : "No notes for this dish."}
            </p>
          </Card>
        )}

        <div className="note-stack">
          {notes.map((n, i) => (
            <Card
              key={n.id}
              className="note-slip note-slip-voice !p-4"
              style={{ animationDelay: `${(i % 20) * 45}ms` }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                {n.stars != null ? (
                  <span className="dish-stars-read">
                    {"★".repeat(n.stars)}
                    <span className="dish-stars-off">
                      {"★".repeat(5 - n.stars)}
                    </span>
                  </span>
                ) : (
                  <span />
                )}
                <p className="text-xs text-[var(--muted)]">{n.when}</p>
              </div>
              {n.note ? (
                <p className="mt-2 text-sm leading-snug text-[var(--ink-soft)]">
                  {n.note}
                </p>
              ) : (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Just the stars.
                </p>
              )}
            </Card>
          ))}
        </div>

        {cursor && (
          <div className="note-load-more">
            <button
              type="button"
              className="dish-flip-skip"
              disabled={moreLoading}
              onClick={() => void loadPage(cursor, true)}
            >
              {moreLoading ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
