"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Card } from "@/components/ui";
import {
  adminConfirmOk,
  adminConfirmPhrase,
  nextAdminConfirm,
  personInitials,
} from "@/lib/admin-view";

export type OfficePerson = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isBlocked?: boolean;
};

export function PersonCard({
  person,
  self,
  open,
  onOpen,
  onClose,
  onToggleAdmin,
  onToggleBlock,
}: {
  person: OfficePerson;
  self: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggleAdmin: () => void;
  onToggleBlock: () => Promise<void>;
}) {
  const root = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const hold = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const faceHRef = useRef(0);
  const [showBack, setShowBack] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const [armed, setArmed] = useState(true);
  const [working, setWorking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const typeRef = useRef<HTMLInputElement>(null);
  const confirmRoot = useRef<HTMLDivElement>(null);
  const blocked = Boolean(person.isBlocked);
  const phrase = adminConfirmPhrase(person.isAdmin);

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
    if (!open) {
      if (faceHRef.current) setHeight(faceHRef.current);
      return;
    }
    const id = window.requestAnimationFrame(() => {
      const backH = backRef.current?.offsetHeight ?? 0;
      if (backH) setHeight(backH);
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, showBack, blocked]);

  useEffect(() => {
    if (open) {
      setShowBack(true);
      return;
    }
    if (!showBack) return;
    const id = window.setTimeout(() => {
      setShowBack(false);
      setWorking(false);
    }, 560);
    return () => window.clearTimeout(id);
  }, [open, showBack]);

  useEffect(() => {
    if (!confirming) return;
    typeRef.current?.focus();
    function cancelConfirm() {
      setConfirming(false);
      setTyped("");
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") cancelConfirm();
    }
    function onDoc(e: PointerEvent) {
      if (!confirmRoot.current?.contains(e.target as Node)) cancelConfirm();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDoc);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDoc);
    };
  }, [confirming]);

  useEffect(() => {
    setConfirming(false);
    setTyped("");
  }, [person.isAdmin]);

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
    if (self) return;
    setArmed(false);
    setShowBack(true);
    const faceH = faceRef.current?.offsetHeight ?? 0;
    if (faceH) {
      faceHRef.current = faceH;
      setHeight(faceH);
    }
    onOpen();
    later(() => setArmed(true), 220);
  }

  async function confirmBlock() {
    if (working) return;
    setWorking(true);
    try {
      await onToggleBlock();
      onClose();
    } finally {
      setWorking(false);
    }
  }

  return (
    <div
      ref={root}
      className="dish-flip"
      data-open={open ? "true" : undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        if (self) return;
        if (open) onClose();
        else beginFlip();
      }}
      onPointerDown={(e) => {
        if (self) return;
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
          <Card ref={faceRef} className="dish-flip-face admin-person !p-4">
            <div className="admin-person-top">
              <span className="admin-person-mark" aria-hidden>
                {personInitials(person.name)}
              </span>
              <div className="min-w-0">
                <div className="admin-person-name">
                  <p className="font-semibold tracking-tight text-[var(--ink)]">
                    {person.name}
                  </p>
                  {person.isAdmin && (
                    <span className="admin-person-role">Admin</span>
                  )}
                  {blocked && (
                    <span className="admin-person-role">Blocked</span>
                  )}
                </div>
                <p className="admin-person-email">{person.email}</p>
              </div>
            </div>
            {self || blocked ? (
              <button
                type="button"
                className="admin-person-action btn btn-secondary"
                disabled
                onPointerDown={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.stopPropagation()}
              >
                {self ? "You" : phrase}
              </button>
            ) : (
              <div
                ref={confirmRoot}
                className="admin-confirm"
                data-open={confirming ? "true" : undefined}
                data-confirm={confirming ? "true" : undefined}
                onPointerDown={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.stopPropagation()}
              >
                <div className="admin-confirm-inner">
                  <button
                    type="button"
                    className={
                      person.isAdmin
                        ? "admin-person-action btn btn-danger admin-confirm-face"
                        : "admin-person-action btn btn-secondary admin-confirm-face"
                    }
                    aria-label={`Type ${phrase}`}
                    onClick={() => {
                      setTyped("");
                      setConfirming(true);
                    }}
                  >
                    {phrase}
                  </button>
                  <label className="admin-confirm-back">
                    <span className="admin-confirm-ghost" aria-hidden>
                      {phrase.split("").map((ch, i) => (
                        <span
                          key={`${phrase}-${i}`}
                          data-hit={typed[i] === ch ? "true" : undefined}
                        >
                          {ch === " " ? "\u00a0" : ch}
                        </span>
                      ))}
                    </span>
                    <input
                      ref={typeRef}
                      className="admin-confirm-input"
                      value={typed}
                      aria-label={`Type ${phrase}`}
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      onChange={() => undefined}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setConfirming(false);
                          setTyped("");
                          return;
                        }
                        if (e.key === "Backspace") {
                          e.preventDefault();
                          setTyped((cur) => cur.slice(0, -1));
                          return;
                        }
                        if (
                          e.key.length === 1 &&
                          !e.metaKey &&
                          !e.ctrlKey &&
                          !e.altKey
                        ) {
                          e.preventDefault();
                          const next = nextAdminConfirm(typed, e.key, phrase);
                          setTyped(next);
                          if (adminConfirmOk(next, phrase)) {
                            onToggleAdmin();
                            setConfirming(false);
                            setTyped("");
                          }
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            )}
          </Card>

          {showBack && (
            <Card
              ref={backRef}
              className="dish-flip-back admin-person !p-4"
              role="dialog"
              aria-label={
                blocked
                  ? `Unblock ${person.name}`
                  : `Block ${person.name}`
              }
              aria-hidden={!open}
            >
              <div
                className="dish-flip-back-body"
                data-armed={armed ? "true" : undefined}
              >
                <p className="dish-flip-kicker">{person.name}</p>
                <p className="dish-flip-ask">
                  {blocked
                    ? "Unblock this person?"
                    : "Block this person?"}
                </p>
                <div className="admin-person-back-actions">
                  <button
                    type="button"
                    className={
                      blocked
                        ? "admin-person-action btn btn-secondary"
                        : "admin-person-action btn btn-danger"
                    }
                    disabled={working}
                    onClick={() => void confirmBlock()}
                  >
                    {working
                      ? blocked
                        ? "Unblocking…"
                        : "Blocking…"
                      : blocked
                        ? "Unblock"
                        : "Block"}
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
