"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Card } from "@/components/ui";
import type { DishDraft } from "@/lib/admin-view";
import { scheduleFlipArm } from "@/lib/flip-arm";

export function BoardDishCard({
  dish,
  open,
  onOpen,
  onClose,
  onRename,
  onDelete,
}: {
  dish: DishDraft;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const hold = useRef<number | null>(null);
  const pressing = useRef(false);
  const timers = useRef<number[]>([]);
  const [showBack, setShowBack] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const [armed, setArmed] = useState(true);
  const [draft, setDraft] = useState(dish.name);

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
  }, [open, showBack, draft]);

  useEffect(() => {
    if (open) {
      setDraft(dish.name);
      setShowBack(true);
      return;
    }
    if (!showBack) return;
    const id = window.setTimeout(() => setShowBack(false), 560);
    return () => window.clearTimeout(id);
  }, [open, showBack, dish.name]);

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
    setDraft(dish.name);
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

  function rename() {
    const name = draft.trim();
    if (!name) return;
    onRename(name);
    onClose();
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
          <Card ref={faceRef} className="dish-flip-face board-card !p-4">
            <p className="font-semibold tracking-tight text-[var(--ink)]">
              {dish.name}
            </p>
            <p className="text-xs capitalize text-[var(--muted)]">
              {dish.meal} · {dish.station}
            </p>
          </Card>

          {showBack && (
            <Card
              ref={backRef}
              className="dish-flip-back admin-board-dish"
              role="dialog"
              aria-label={`Rename ${dish.name}`}
              aria-hidden={!open}
            >
              <div
                className="dish-flip-back-body admin-board-dish-back"
                data-armed={armed ? "true" : undefined}
              >
                <p className="dish-flip-kicker">
                  {dish.meal} · {dish.station}
                </p>
                <input
                  className="field"
                  value={draft}
                  readOnly={!armed}
                  tabIndex={armed ? 0 : -1}
                  aria-label="Dish name"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      rename();
                    }
                  }}
                />
                <div className="admin-board-dish-actions">
                  <button
                    type="button"
                    className="chip"
                    disabled={!draft.trim()}
                    onClick={rename}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => {
                      onDelete();
                      onClose();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
