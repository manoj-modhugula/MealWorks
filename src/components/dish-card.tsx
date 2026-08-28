"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Card } from "@/components/ui";
import {
  draftFromNoted,
  type DishNote,
  type DishReviewStats,
} from "@/lib/dish-note";
import { createTapBuffer } from "@/lib/dish-gestures";
import { scheduleFlipArm } from "@/lib/flip-arm";

export type { DishNote };

type MatchItem = {
  name: string;
  meal: string;
  station: string;
  decision: string;
  reason: string;
};

type Phase = "stars" | "note" | "sent";

function StarRow({
  value,
  onPick,
}: {
  value: number;
  onPick: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div
      className="dish-stars"
      role="radiogroup"
      aria-label="Rating"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="dish-star"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          data-on={shown >= n ? "true" : undefined}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onBlur={() => setHover(0)}
          onClick={() => onPick(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function DishCard({
  item,
  noted,
  review,
  open,
  onOpen,
  onNotes,
  onClose,
  onSend,
}: {
  item: MatchItem;
  noted?: DishNote | null;
  review?: DishReviewStats | null;
  open: boolean;
  onOpen: () => void;
  onNotes: () => void;
  onClose: () => void;
  onSend: (stars: number, note: string) => Promise<void>;
}) {
  const root = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const hold = useRef<number | null>(null);
  const pressing = useRef(false);
  const skipClick = useRef(false);
  const timers = useRef<number[]>([]);
  const taps = useRef<ReturnType<typeof createTapBuffer> | null>(null);
  const draft0 = draftFromNoted(noted);
  const [phase, setPhase] = useState<Phase>("stars");
  const [leaving, setLeaving] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const [stars, setStars] = useState(draft0.stars);
  const [note, setNote] = useState(draft0.note);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [armed, setArmed] = useState(true);
  const tint =
    item.decision === "recommended"
      ? "mint"
      : item.decision === "avoid"
        ? "rose"
        : item.decision === "caution"
          ? "butter"
          : undefined;

  function later(fn: () => void, ms: number) {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }

  if (!taps.current) {
    taps.current = createTapBuffer(later, (id) => window.clearTimeout(id));
  }

  function applyNoted() {
    const draft = draftFromNoted(noted);
    setStars(draft.stars);
    setNote(draft.note);
    setPhase("stars");
    setLeaving(false);
    setSending(false);
    setErr("");
  }

  useEffect(() => {
    const t = timers;
    const h = hold;
    return () => {
      t.current.forEach((id) => window.clearTimeout(id));
      if (h.current) window.clearTimeout(h.current);
      taps.current?.cancel();
    };
  }, []);

  useLayoutEffect(() => {
    if (!showBack) {
      setHeight(null);
      return;
    }
    const faceH = faceRef.current?.offsetHeight ?? 0;
    if (!open) {
      if (faceH) setHeight(faceH);
      return;
    }
    const id = window.requestAnimationFrame(() => {
      const backH = backRef.current?.offsetHeight ?? 0;
      if (backH) setHeight(backH);
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, showBack, phase]);

  useEffect(() => {
    if (open) {
      setShowBack(true);
      return;
    }
    if (!showBack) return;
    const id = window.setTimeout(() => {
      setShowBack(false);
      applyNoted();
    }, 560);
    return () => window.clearTimeout(id);
    // Restore from the latest saved review, not empty local state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, showBack, noted]);

  useEffect(() => {
    if (open || sending) return;
    applyNoted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sending, noted]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onDoc(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDoc);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDoc);
    };
  }, [open, onClose]);

  function clearHold() {
    if (hold.current) {
      window.clearTimeout(hold.current);
      hold.current = null;
    }
  }

  function startRate() {
    skipClick.current = true;
    taps.current?.cancel();
    later(() => {
      skipClick.current = false;
    }, 500);
    if (open) onClose();
    else beginFlip();
  }

  function beginFlip() {
    setArmed(false);
    applyNoted();
    setShowBack(true);
    const faceH = faceRef.current?.offsetHeight;
    if (faceH) setHeight(faceH);
    onOpen();
    window.getSelection()?.removeAllRanges();
    scheduleFlipArm({
      later,
      holding: () => pressing.current,
      arm: () => setArmed(true),
    });
  }

  function pickStars(n: number) {
    if (leaving || phase !== "stars") return;
    setStars(n);
    setLeaving(true);
    later(() => {
      setPhase("note");
      setLeaving(false);
    }, 320);
  }

  async function send(text = note) {
    if (!stars || sending || phase !== "note") return;
    setSending(true);
    setErr("");
    try {
      await onSend(stars, text);
      setLeaving(true);
      later(() => {
        setPhase("sent");
        setLeaving(false);
        later(() => onClose(), 720);
      }, 280);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t send");
      setSending(false);
    }
  }

  return (
    <div
      ref={root}
      className="dish-flip"
      data-open={open ? "true" : undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        startRate();
      }}
      onClick={(e) => {
        if (open) return;
        if (skipClick.current) {
          skipClick.current = false;
          return;
        }
        const t = e.target as HTMLElement;
        if (t.closest("input, textarea, button")) return;
        taps.current?.tap(onNotes, () => beginFlip());
      }}
      onMouseDown={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest("input, textarea")) return;
        e.preventDefault();
      }}
      onPointerDown={(e) => {
        pressing.current = true;
        if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
        clearHold();
        hold.current = window.setTimeout(() => {
          startRate();
        }, 260);
      }}
      onPointerUp={() => {
        pressing.current = false;
        clearHold();
      }}
      onPointerCancel={() => {
        pressing.current = false;
        clearHold();
      }}
      onPointerMove={(e) => {
        if (e.pointerType === "touch" || e.pointerType === "pen") {
          if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) clearHold();
        }
      }}
    >
      <div
        className="dish-flip-clip"
        style={height != null ? { height } : undefined}
      >
      <div className="dish-flip-inner">
        <Card ref={faceRef} tint={tint} className="dish-flip-face board-card">
          <p className="font-semibold tracking-tight text-[var(--ink)]">
            {item.name}
          </p>
          <div className="note-dish-foot">
            <p className="text-xs capitalize text-[var(--muted)]">
              {item.meal} · {item.station}
            </p>
            {review && review.count > 0 ? (
              <div className="note-dish-stats">
                {review.avgStars != null && (
                  <span
                    className="chip note-dish-chip note-dish-chip-stars"
                    aria-label={`${Math.round(review.avgStars)} of 5`}
                  >
                    <span className="dish-stars-read" aria-hidden>
                      {"★".repeat(Math.round(review.avgStars))}
                      <span className="dish-stars-off">
                        {"★".repeat(5 - Math.round(review.avgStars))}
                      </span>
                    </span>
                  </span>
                )}
                <span
                  className="chip note-dish-chip"
                  aria-label={`${review.count} note${review.count === 1 ? "" : "s"}`}
                >
                  {review.count}
                </span>
              </div>
            ) : null}
          </div>
        </Card>

        {showBack && (
          <Card
            ref={backRef}
            tint={tint}
            className="dish-flip-back admin-board-dish"
            role="dialog"
            aria-label={`Note on ${item.name}`}
            aria-hidden={!open}
          >
            <div
              className={
                phase === "stars"
                  ? "dish-flip-back-body admin-board-dish-back today-rate-back"
                  : "dish-flip-back-body admin-board-dish-back"
              }
              data-armed={armed ? "true" : undefined}
            >
              <p className="dish-flip-kicker">{item.name}</p>
              <div aria-live="polite">
                {phase === "stars" && (
                  <div
                    className={
                      leaving
                        ? "dish-wipe-out today-rate-foot"
                        : "dish-wipe-in today-rate-foot"
                    }
                    key="stars"
                  >
                    <p className="today-rate-ask">How was it?</p>
                    <div className="chip today-rate-chip">
                      <StarRow
                        value={stars}
                        onPick={(n) => {
                          if (!armed) return;
                          pickStars(n);
                        }}
                      />
                    </div>
                  </div>
                )}
                {phase === "note" && (
                  <div
                    className={leaving ? "dish-wipe-out" : "dish-wipe-in"}
                    key="note"
                  >
                    <input
                      className="field"
                      maxLength={240}
                      value={note}
                      readOnly={!armed}
                      tabIndex={armed ? 0 : -1}
                      placeholder="A line for the café"
                      aria-label="A line for the café"
                      onChange={(e) => setNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void send();
                        }
                      }}
                    />
                    {err && (
                      <p className="text-xs text-[var(--skip-ink)]">{err}</p>
                    )}
                    <div className="admin-board-dish-actions">
                      <button
                        type="button"
                        className="chip"
                        disabled={sending}
                        onClick={() => void send("")}
                      >
                        Skip
                      </button>
                      <button
                        type="button"
                        className="chip"
                        disabled={sending}
                        onClick={() => void send()}
                      >
                        {sending ? "Sending…" : "Send"}
                      </button>
                    </div>
                  </div>
                )}
                {phase === "sent" && (
                  <div className="dish-wipe-in" key="sent">
                    <p className="today-rate-ask">On its way</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
      </div>
    </div>
  );
}
