"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Card, DecisionBadge } from "@/components/ui";
import { ALLERGY_FAMILIES } from "@/lib/matching";
import { ALLERGY_OPTIONS, AVOID_OPTIONS } from "@/lib/pref-options";

type MatchItem = {
  name: string;
  meal: string;
  station: string;
  decision: string;
  reason: string;
};

export type DishNote = {
  vote: string;
  stars: number | null;
  note: string;
};

type Phase = "stars" | "note" | "sent";

function familyKeyFor(term: string): string {
  const t = term.toLowerCase().trim();
  if (!t) return t;
  if (t === "bean") return "beans";
  if (ALLERGY_FAMILIES[t]) return t;
  for (const [k, words] of Object.entries(ALLERGY_FAMILIES)) {
    if (words.includes(t)) return k === "bean" ? "beans" : k;
  }
  return t;
}

function chipLabel(term: string): string {
  const key = familyKeyFor(term);
  const known = [...AVOID_OPTIONS, ...ALLERGY_OPTIONS].find(
    (o) => o.value === key
  );
  if (known) return known.label;
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Prefs chips for a skip, without an allergy sentence. */
function skipChips(reason: string): string[] {
  const quoted = reason.match(/[“"]([^”"]+)[”"]/);
  if (quoted?.[1]) return [chipLabel(quoted[1])];
  if (/vegan/i.test(reason)) return ["Not vegan"];
  if (/vegetarian|eggetarian|meat\/fish/i.test(reason)) return ["Meat"];
  return [];
}

function StarRead({ n }: { n: number }) {
  return (
    <span className="dish-stars-read" aria-label={`${n} of 5`}>
      {"★".repeat(n)}
      <span className="dish-stars-off">{"★".repeat(5 - n)}</span>
    </span>
  );
}

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
  open,
  onOpen,
  onClose,
  onSend,
}: {
  item: MatchItem;
  noted?: DishNote | null;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSend: (stars: number, note: string) => Promise<void>;
}) {
  const root = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const hold = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const [phase, setPhase] = useState<Phase>("stars");
  const [leaving, setLeaving] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const [stars, setStars] = useState(noted?.stars || 0);
  const [note, setNote] = useState(noted?.note || "");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [armed, setArmed] = useState(true);
  const chips =
    item.decision === "avoid" ? skipChips(item.reason) : [];
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

  useEffect(() => {
    const t = timers;
    const h = hold;
    return () => {
      t.current.forEach((id) => window.clearTimeout(id));
      if (h.current) window.clearTimeout(h.current);
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
      setPhase("stars");
      setLeaving(false);
      setStars(0);
      setNote("");
      setSending(false);
      setErr("");
    }, 560);
    return () => window.clearTimeout(id);
  }, [open, showBack]);

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

  function beginFlip() {
    setArmed(false);
    setPhase("stars");
    setLeaving(false);
    setShowBack(true);
    const faceH = faceRef.current?.offsetHeight;
    if (faceH) setHeight(faceH);
    onOpen();
    later(() => setArmed(true), 220);
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

  async function send() {
    if (!stars || sending || phase !== "note") return;
    setSending(true);
    setErr("");
    try {
      await onSend(stars, note);
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
        if (open) onClose();
        else beginFlip();
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
        clearHold();
        hold.current = window.setTimeout(() => {
          if (open) onClose();
          else beginFlip();
        }, 260);
      }}
      onPointerUp={clearHold}
      onPointerCancel={clearHold}
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
        <Card ref={faceRef} tint={tint} className="dish-flip-face !p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold tracking-tight text-[var(--ink)]">
                {item.name}
              </p>
              <DecisionBadge decision={item.decision} />
              {noted?.stars ? (
                <span className="dish-noted" aria-hidden />
              ) : null}
            </div>
            <p className="mt-0.5 text-xs capitalize text-[var(--muted)]">
              {item.meal} · {item.station}
            </p>
            {item.decision === "avoid" ? (
              chips.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {chips.map((label) => (
                    <span
                      key={label}
                      className="chip pointer-events-none !cursor-default !py-1 !text-xs"
                      data-active="true"
                      data-tone="bad"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : null
            ) : (
              <p className="mt-1.5 text-sm leading-snug text-[var(--ink-soft)]">
                {item.reason}
              </p>
            )}
          </div>
        </Card>

        {showBack && (
          <Card
            ref={backRef}
            tint={tint}
            className="dish-flip-back !p-4"
            role="dialog"
            aria-label={`Note on ${item.name}`}
            aria-hidden={!open}
          >
            <div
              className="dish-flip-back-body"
              data-armed={armed ? "true" : undefined}
            >
              <p className="dish-flip-kicker">{item.name}</p>
              <div aria-live="polite">
                {phase === "stars" && (
                  <div
                    className={leaving ? "dish-wipe-out" : "dish-wipe-in"}
                    key="stars"
                  >
                    <p className="dish-flip-ask">How was it?</p>
                    <StarRow value={stars} onPick={pickStars} />
                  </div>
                )}
                {phase === "note" && (
                  <div
                    className={
                      leaving ? "dish-wipe-out" : "dish-wipe-in dish-note-form"
                    }
                    key="note"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="dish-flip-ask">A line for the café</p>
                      <StarRead n={stars} />
                    </div>
                    <input
                      className="field !py-1.5"
                      maxLength={240}
                      value={note}
                      autoFocus
                      placeholder="Short note"
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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-primary !py-1.5 !text-sm"
                        disabled={sending}
                        onClick={() => void send()}
                      >
                        {sending ? "Sending…" : "Send it over"}
                      </button>
                    </div>
                  </div>
                )}
                {phase === "sent" && (
                  <div className="dish-wipe-in dish-sent" key="sent">
                    <p className="dish-flip-ask">On its way</p>
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
