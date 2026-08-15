import { describe, expect, it } from "vitest";
import {
  angleFromCenter,
  applyAngleToTime,
  formatAnalogLabel,
  formatHHMM,
  hour12Of,
  hourDialAngle,
  hourFromAngle,
  hourHandAngle,
  minuteFromAngle,
  minuteHandAngle,
  nearerHand,
  nudgeHours,
  nudgeMinutes,
  parseHHMM,
  pointOnDial,
  snapMinutes,
  togglePeriod,
} from "./analog-time";

describe("parse and format", () => {
  it("parses HH:MM into 24-hour parts", () => {
    expect(parseHHMM("08:00")).toEqual({ hours24: 8, minutes: 0 });
    expect(parseHHMM("14:30")).toEqual({ hours24: 14, minutes: 30 });
    expect(parseHHMM("00:05")).toEqual({ hours24: 0, minutes: 5 });
  });

  it("rejects bad strings", () => {
    expect(parseHHMM("")).toBeNull();
    expect(parseHHMM("9:30")).toBeNull();
    expect(parseHHMM("25:00")).toBeNull();
  });

  it("writes HH:MM and a 12-hour label", () => {
    expect(formatHHMM({ hours24: 8, minutes: 0 })).toBe("08:00");
    expect(formatHHMM({ hours24: 14, minutes: 30 })).toBe("14:30");
    expect(formatAnalogLabel({ hours24: 8, minutes: 0 })).toBe("8:00 AM");
    expect(formatAnalogLabel({ hours24: 14, minutes: 30 })).toBe("2:30 PM");
    expect(formatAnalogLabel({ hours24: 0, minutes: 0 })).toBe("12:00 AM");
    expect(formatAnalogLabel({ hours24: 12, minutes: 5 })).toBe("12:05 PM");
  });
});

describe("clock math", () => {
  it("puts 12 o'clock at 0 degrees", () => {
    expect(hourHandAngle(0, 0)).toBe(0);
    expect(hourHandAngle(12, 0)).toBe(0);
    expect(minuteHandAngle(0)).toBe(0);
  });

  it("moves the hour hand with minutes", () => {
    expect(hourHandAngle(3, 0)).toBe(90);
    expect(hourHandAngle(3, 30)).toBe(105);
    expect(minuteHandAngle(30)).toBe(180);
  });

  it("reads hour and snapped minutes from an angle", () => {
    expect(hourFromAngle(0)).toBe(12);
    expect(hourFromAngle(90)).toBe(3);
    expect(minuteFromAngle(180)).toBe(30);
    expect(minuteFromAngle(33)).toBe(5);
  });

  it("measures angle from 12 o'clock clockwise", () => {
    expect(angleFromCenter(0, 0, 0, -10)).toBeCloseTo(0, 5);
    expect(angleFromCenter(0, 0, 10, 0)).toBeCloseTo(90, 5);
  });
});

describe("setting a watch", () => {
  it("snaps minutes to 5", () => {
    expect(snapMinutes(32)).toBe(30);
    expect(snapMinutes(58)).toBe(0);
  });

  it("drags the nearer hand", () => {
    const t = { hours24: 3, minutes: 30 };
    expect(nearerHand(105, t)).toBe("hour");
    expect(nearerHand(180, t)).toBe("minute");
  });

  it("applies an hour drag without flipping AM", () => {
    const next = applyAngleToTime({ hours24: 8, minutes: 30 }, 90, "hour");
    expect(next).toEqual({ hours24: 3, minutes: 30 });
  });

  it("applies a minute drag", () => {
    const next = applyAngleToTime({ hours24: 8, minutes: 0 }, 180, "minute");
    expect(next).toEqual({ hours24: 8, minutes: 30 });
  });

  it("toggles AM and PM", () => {
    expect(togglePeriod({ hours24: 8, minutes: 0 })).toEqual({
      hours24: 20,
      minutes: 0,
    });
    expect(togglePeriod({ hours24: 14, minutes: 30 })).toEqual({
      hours24: 2,
      minutes: 30,
    });
  });

  it("nudges five minutes and wraps midnight", () => {
    expect(nudgeMinutes({ hours24: 23, minutes: 55 }, 5)).toEqual({
      hours24: 0,
      minutes: 0,
    });
    expect(nudgeMinutes({ hours24: 8, minutes: 0 }, -5)).toEqual({
      hours24: 7,
      minutes: 55,
    });
  });

  it("parks the hour dial on the hour number, not between ticks", () => {
    expect(hour12Of({ hours24: 8, minutes: 30 })).toBe(8);
    expect(hourDialAngle(8)).toBe(240);
    expect(hourDialAngle(20)).toBe(240);
  });

  it("nudges the hour without touching minutes", () => {
    expect(nudgeHours({ hours24: 11, minutes: 30 }, 1)).toEqual({
      hours24: 12,
      minutes: 30,
    });
  });

  it("places 12 at the top of the dial", () => {
    expect(pointOnDial(0, 40)).toEqual({ x: 50, y: 10 });
    expect(pointOnDial(90, 40)).toEqual({ x: 90, y: 50 });
  });
});
