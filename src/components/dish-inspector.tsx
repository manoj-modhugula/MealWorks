"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Star, Utensils, X } from "lucide-react";
import { Alert, Spinner } from "@/components/ui";
import { useExperience } from "@/components/experience-provider";
import {
  draftFromNoted,
  type DishNote,
  type DishReviewStats,
} from "@/lib/dish-note";
import type { PublicNote } from "@/components/note-dish-panel";
import { dishPhoto } from "@/lib/sample-catalog";

type Dish = {
  name: string;
  station: string;
  meal: string;
  reason: string;
  decision: string;
};

function DishPhoto({ dish, large = false }: { dish: Dish; large?: boolean }) {
  const src = dishPhoto(dish.name);
  return (
    <div className={large ? "inspector-photo" : "dish-tile-photo"}>
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={
            large
              ? "(max-width: 700px) 90vw, 480px"
              : "(max-width: 700px) 92vw, (max-width: 1050px) 45vw, 31vw"
          }
        />
      ) : (
        <span className="dish-photo-placeholder">
          <Utensils size={large ? 36 : 24} aria-hidden="true" />
          {large && <span>Photo coming soon</span>}
        </span>
      )}
    </div>
  );
}

function CommunityRating({
  review,
  compact = false,
}: {
  review?: DishReviewStats;
  compact?: boolean;
}) {
  return (
    <span className="dish-community">
      <Star
        size={17}
        aria-hidden="true"
        fill={review?.avgStars != null ? "currentColor" : "none"}
      />
      {review && review.count > 0 ? (
        <>
          <strong>{review.avgStars?.toFixed(1) ?? "—"}</strong>
          {!compact && (
            <>
              <span>·</span>
              <span>
                {review.count} review{review.count === 1 ? "" : "s"}
              </span>
            </>
          )}
        </>
      ) : (
        <span>No ratings yet</span>
      )}
    </span>
  );
}

export function DishInspectorList({
  items,
  feedback,
  reviews,
  date,
  onSend,
}: {
  items: Dish[];
  feedback: Record<string, DishNote>;
  reviews: Record<string, DishReviewStats>;
  date: string;
  onSend: (name: string, stars: number, note: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const active = items.find((d) => `${d.station}:${d.name}` === selected);
  function close() {
    setSelected(null);
    if (selected) {
      const trigger = buttons.current.get(selected);
      requestAnimationFrame(() => trigger?.focus({ preventScroll: true }));
    }
  }
  useEffect(() => {
    if (active) {
      heading.current?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 700px)").matches) {
        panel.current?.scrollIntoView({ block: "start" });
      }
    }
  }, [active]);
  if (!items.length)
    return (
      <p className="text-sm text-[var(--muted)]">Nothing in this filter.</p>
    );
  return (
    <section
      className="dish-browser"
      data-open={Boolean(active)}
      aria-label="Your dish picks"
    >
      <div className="dish-gallery">
        {items.map((dish) => {
          const id = `${dish.station}:${dish.name}`;
          return (
            <button
              key={id}
              ref={(node) => {
                if (node) buttons.current.set(id, node);
                else buttons.current.delete(id);
              }}
              type="button"
              className="dish-tile"
              aria-expanded={selected === id}
              aria-controls={selected === id ? "dish-inspector" : undefined}
              onClick={() => setSelected(id)}
            >
              <DishPhoto dish={dish} />
              <span className="dish-tile-copy">
                <span className="dish-tile-station">{dish.station}</span>
                <span className="dish-tile-name">{dish.name}</span>
                {reviews[dish.name]?.count > 0 && (
                  <CommunityRating review={reviews[dish.name]} compact />
                )}
              </span>
            </button>
          );
        })}
      </div>
      {active && (
        <aside
          ref={panel}
          id="dish-inspector"
          className="dish-inspector"
          aria-labelledby="inspector-title"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
          }}
        >
          <div className="inspector-toolbar">
            <span className="inspector-eyebrow">Dish details</span>
            <button
              type="button"
              className="icon-btn inspector-close"
              onClick={close}
              aria-label="Close dish details"
            >
              <ArrowLeft className="inspector-back-icon" size={20} />
              <X className="inspector-close-icon" size={20} />
            </button>
          </div>
          <DishPhoto dish={active} large />
          <h2 id="inspector-title" ref={heading} tabIndex={-1}>
            {active.name}
          </h2>
          <p className="inspector-station">{active.station}</p>
          <CommunityRating review={reviews[active.name]} />
          <DishReview
            key={`${active.station}:${active.name}`}
            dish={active}
            date={date}
            noted={feedback[active.name]}
            onSend={(stars, note) => onSend(active.name, stars, note)}
          />
        </aside>
      )}
    </section>
  );
}

function DishReview({
  dish,
  date,
  noted,
  onSend,
}: {
  dish: Dish;
  date: string;
  noted?: DishNote;
  onSend: (stars: number, note: string) => Promise<void>;
}) {
  const initial = draftFromNoted(noted);
  const [tab, setTab] = useState<"notes" | "review">("review");
  const [stars, setStars] = useState(initial.stars);
  const [hover, setHover] = useState(0);
  const [note, setNote] = useState(initial.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [revision, setRevision] = useState(0);
  const starButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!stars || busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await onSend(stars, note);
      setSaved(true);
      setRevision((v) => v + 1);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn’t save your review. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="inspector-feedback">
      <div className="inspector-tabs" role="tablist" aria-label="Dish feedback">
        {(["notes", "review"] as const).map((id, i) => (
          <button
            key={id}
            ref={(node) => {
              tabs.current[i] = node;
            }}
            type="button"
            role="tab"
            id={`dish-tab-${id}`}
            aria-controls={`dish-panel-${id}`}
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const next = e.key === "Home" ? 0 : e.key === "End" ? 1 : 1 - i;
                setTab(next === 0 ? "notes" : "review");
                tabs.current[next]?.focus();
              }
            }}
          >
            {id === "notes" ? "Notes" : "Your review"}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`dish-panel-${tab}`}
        aria-labelledby={`dish-tab-${tab}`}
      >
        {tab === "notes" ? (
          <CommunityNotes date={date} dish={dish.name} revision={revision} />
        ) : (
          <form onSubmit={save} className="inspector-review">
            <div className="inspector-rating-choice">
              <h3>How was it?</h3>
              <div
                className="inspector-stars"
                role="radiogroup"
                aria-label="Your rating"
                onMouseLeave={() => setHover(0)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    ref={(node) => {
                      starButtons.current[n - 1] = node;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={stars === n}
                    aria-label={`${n} star${n === 1 ? "" : "s"}`}
                    tabIndex={(stars || 1) === n ? 0 : -1}
                    disabled={busy}
                    data-on={(hover || stars) >= n}
                    onMouseEnter={() => setHover(n)}
                    onFocus={() => setHover(n)}
                    onBlur={() => setHover(0)}
                    onClick={() => {
                      setStars(n);
                      setSaved(false);
                    }}
                    onKeyDown={(e) => {
                      if (
                        [
                          "ArrowRight",
                          "ArrowUp",
                          "ArrowLeft",
                          "ArrowDown",
                          "Home",
                          "End",
                        ].includes(e.key)
                      ) {
                        e.preventDefault();
                        const next =
                          e.key === "Home"
                            ? 1
                            : e.key === "End"
                              ? 5
                              : ((n -
                                  1 +
                                  (e.key === "ArrowRight" || e.key === "ArrowUp"
                                    ? 1
                                    : 4)) %
                                  5) +
                                1;
                        setStars(next);
                        setSaved(false);
                        starButtons.current[next - 1]?.focus();
                      }
                    }}
                  >
                    <Star
                      size={32}
                      fill={(hover || stars) >= n ? "currentColor" : "none"}
                      strokeWidth={1.5}
                    />
                  </button>
                ))}
              </div>
            </div>
            <p className="inspector-rating-label">
              {stars ? `Your rating · ${stars}/5` : "Choose a star rating"}
            </p>
            <label className="inspector-note-label" htmlFor="dish-review-note">
              Add a note <span>(optional)</span>
            </label>
            <textarea
              id="dish-review-note"
              className="field inspector-note"
              maxLength={240}
              rows={2}
              placeholder="What stood out?"
              value={note}
              disabled={busy}
              onChange={(e) => {
                setNote(e.target.value);
                setSaved(false);
              }}
            />
            {error && <Alert tone="bad">{error}</Alert>}
            <button
              type="submit"
              className="btn inspector-save"
              disabled={!stars || busy}
            >
              {busy ? (
                "Saving…"
              ) : saved ? (
                <>
                  <Check size={18} />
                  Review saved
                </>
              ) : (
                "Save review"
              )}
            </button>
            <p role="status" className="inspector-save-status">
              {saved ? "Your review has been saved. You can edit it here." : ""}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

type NotesPage = { notes: PublicNote[]; nextCursor: string | null };
function CommunityNotes({
  date,
  dish,
  revision,
}: {
  date: string;
  dish: string;
  revision: number;
}) {
  const { requestJson } = useExperience();
  const [filter, setFilter] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<NotesPage>({ notes: [], nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [moreBusy, setMoreBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const query = new URLSearchParams({
    date,
    dish,
    ...(filter ? { stars: String(filter) } : {}),
  }).toString();
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    setPage(0);
    setData({ notes: [], nextCursor: null });
    requestJson<NotesPage>(`/api/feedback/dish?${query}`, {
      signal: controller.signal,
    })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, revision, requestJson]);
  async function more() {
    if (!data.nextCursor || moreBusy) return;
    setMoreBusy(true);
    setError("");
    const signal = request.current?.signal;
    try {
      const next = await requestJson<NotesPage>(
        `/api/feedback/dish?${query}&cursor=${encodeURIComponent(data.nextCursor)}`,
        { signal },
      );
      if (!signal?.aborted) {
        setData((cur) => ({
          notes: [...cur.notes, ...next.notes],
          nextCursor: next.nextCursor,
        }));
        if (next.notes.length) setPage((current) => current + 1);
      }
    } catch (e) {
      if (!signal?.aborted)
        setError(e instanceof Error ? e.message : "Couldn’t load more notes");
    } finally {
      if (!signal?.aborted) setMoreBusy(false);
    }
  }
  return (
    <div className="inspector-community-notes">
      <label className="inspector-notes-filter">
        Community notes
        <select
          className="field"
          value={filter ?? "all"}
          onChange={(e) => {
            setFilter(e.target.value === "all" ? null : Number(e.target.value));
            setMoreBusy(false);
          }}
        >
          <option value="all">All ratings</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} star{n === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </label>
      {error && <Alert tone="bad">{error}</Alert>}
      {loading ? (
        <Spinner label="Loading notes" />
      ) : data.notes.length ? (
        <ul className="inspector-note-list">
          {data.notes.slice(page, page + 1).map((n) => (
            <li key={n.id}>
              <div>
                <span
                  aria-label={n.stars ? `${n.stars} of 5 stars` : "Unrated"}
                >
                  {n.stars
                    ? `${"★".repeat(n.stars)}${"☆".repeat(5 - n.stars)}`
                    : "Unrated"}
                </span>
                <time>{n.when}</time>
              </div>
              <p>{n.note || "Just the stars."}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="inspector-empty">
          {error
            ? "Notes are unavailable right now."
            : filter
              ? "No notes with this rating yet."
              : "No notes yet. Be the first to share how it was."}
        </p>
      )}
      {!loading && data.notes.length > 0 && (
        <nav
          className="inspector-note-pagination"
          aria-label="Community note pages"
        >
          <button
            type="button"
            className="btn btn-secondary"
            disabled={page === 0 || moreBusy}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </button>
          <span role="status">Note {page + 1}</span>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={
              moreBusy || (page + 1 >= data.notes.length && !data.nextCursor)
            }
            onClick={() => {
              if (page + 1 < data.notes.length)
                setPage((current) => current + 1);
              else void more();
            }}
          >
            {moreBusy ? "Loading…" : "Next"}
          </button>
        </nav>
      )}
    </div>
  );
}
