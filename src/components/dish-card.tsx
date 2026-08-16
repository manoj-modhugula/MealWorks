"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Card } from "@/components/ui";
import { scheduleFlipArm } from "@/lib/flip-arm";

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
  const pressing = useRef(false);
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
        if (open) onClose();
        else beginFlip();
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
          if (open) onClose();
          else beginFlip();
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
        <Card ref={faceRef} tint={tint} className="dish-flip-face board-card !p-4">
          <p className="font-semibold tracking-tight text-[var(--ink)]">
            {item.name}
            {noted?.stars ? (
              <span className="dish-noted ml-2 align-middle" aria-hidden />
            ) : null}
          </p>
          <p className="text-xs capitalize text-[var(--muted)]">
            {item.meal} · {item.station}
          </p>
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
                    className={
                      leaving ? "dish-wipe-out" : "dish-wipe-in"
                    }
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
