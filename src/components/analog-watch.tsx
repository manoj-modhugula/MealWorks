"use client";

import { useRef, useState } from "react";
import {
  applyAngleToTime,
  angleFromCenter,
  formatHHMM,
  HOUR_MARKS,
  hour12Of,
  hourDialAngle,
  MINUTE_MARKS,
  minuteHandAngle,
  nudgeHours,
  nudgeMinutes,
  parseHHMM,
  periodOf,
  pointOnDial,
  setPeriod,
  type ClockTime,
} from "@/lib/analog-time";

const FALLBACK: ClockTime = { hours24: 8, minutes: 0 };
const DIAL_R = 34;

type DialMode = "hour" | "minute";

export function AnalogWatch({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [mode, setMode] = useState<DialMode>("hour");
  const [dragging, setDragging] = useState(false);
  const time = parseHHMM(value) ?? FALLBACK;
  const period = periodOf(time);
  const hour12 = hour12Of(time);
  const minutePad = String(time.minutes).padStart(2, "0");
  const spoken = `${hour12}:${minutePad} ${period}`;
  const thumbAngle =
    mode === "hour" ? hourDialAngle(time.hours24) : minuteHandAngle(time.minutes);
  const thumb = pointOnDial(thumbAngle, DIAL_R);
  const marks = mode === "hour" ? HOUR_MARKS : MINUTE_MARKS;

  function emit(next: ClockTime) {
    onChange(formatHHMM(next));
  }

  function pointToAngle(clientX: number, clientY: number): number | null {
    const el = svgRef.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    return angleFromCenter(
      box.left + box.width / 2,
      box.top + box.height / 2,
      clientX,
      clientY
    );
  }

  function applyPointer(clientX: number, clientY: number) {
    const angle = pointToAngle(clientX, clientY);
    if (angle == null) return;
    emit(applyAngleToTime(time, angle, mode));
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    applyPointer(e.clientX, e.clientY);
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragging) return;
    applyPointer(e.clientX, e.clientY);
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
    if (mode === "hour") setMode("minute");
  }

  function onKeyDown(e: React.KeyboardEvent<SVGSVGElement>) {
    const next =
      e.key === "ArrowUp" || e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowDown" || e.key === "ArrowLeft"
          ? -1
          : 0;
    if (!next) return;
    e.preventDefault();
    emit(
      mode === "hour" ? nudgeHours(time, next) : nudgeMinutes(time, next * 5)
    );
  }

  return (
    <div className="analog-watch">
      <div className="analog-readout">
        <div className="analog-digits" role="group" aria-label={spoken}>
          <button
            type="button"
            className="analog-digit"
            data-active={mode === "hour"}
            aria-pressed={mode === "hour"}
            onClick={() => setMode("hour")}
          >
            {hour12}
          </button>
          <span className="analog-colon" aria-hidden>
            :
          </span>
          <button
            type="button"
            className="analog-digit"
            data-active={mode === "minute"}
            aria-pressed={mode === "minute"}
            onClick={() => setMode("minute")}
          >
            {minutePad}
          </button>
        </div>
        <div className="analog-period" role="group" aria-label="AM or PM">
          {(["AM", "PM"] as const).map((p) => (
            <button
              key={p}
              type="button"
              className="chip !py-1 !text-xs"
              data-active={period === p}
              onClick={() => emit(setPeriod(time, p))}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <svg
        ref={svgRef}
        className="analog-face"
        viewBox="0 0 100 100"
        role="slider"
        tabIndex={0}
        aria-label={`${label} ${mode === "hour" ? "hour" : "minute"}`}
        aria-valuemin={mode === "hour" ? 1 : 0}
        aria-valuemax={mode === "hour" ? 12 : 55}
        aria-valuenow={mode === "hour" ? hour12 : time.minutes}
        aria-valuetext={spoken}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <circle className="analog-face-disk" cx="50" cy="50" r="48" />
        <line
          className="analog-arm"
          x1="50"
          y1="50"
          x2={thumb.x}
          y2={thumb.y}
        />
        <circle className="analog-hub" cx="50" cy="50" r="2.6" />
        <circle className="analog-thumb" cx={thumb.x} cy={thumb.y} r="11" />
        {marks.map((mark, i) => {
          const deg = i * 30;
          const p = pointOnDial(deg, DIAL_R);
          const selected =
            mode === "hour" ? mark === hour12 : mark === time.minutes;
          return (
            <text
              key={`${mode}-${mark}`}
              className="analog-mark"
              data-active={selected ? "true" : undefined}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {mode === "hour" ? mark : String(mark).padStart(2, "0")}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
