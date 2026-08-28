import { describe, expect, it } from "vitest";
import { TAP_WAIT_MS, createTapBuffer } from "./dish-gestures";

function clock() {
  const queued: { id: number; fn: () => void; at: number }[] = [];
  let now = 0;
  let nextId = 1;
  return {
    later(fn: () => void, ms: number) {
      const id = nextId++;
      queued.push({ id, fn, at: now + ms });
      return id;
    },
    clear(id: number) {
      const i = queued.findIndex((q) => q.id === id);
      if (i >= 0) queued.splice(i, 1);
    },
    tick(ms: number) {
      now += ms;
      const due = queued.filter((q) => q.at <= now).sort((a, b) => a.at - b.at);
      for (const q of due) {
        const i = queued.findIndex((x) => x.id === q.id);
        if (i >= 0) queued.splice(i, 1);
        q.fn();
      }
    },
  };
}

describe("createTapBuffer", () => {
  it("fires onSingle after the wait when there is one tap", () => {
    const time = clock();
    const buf = createTapBuffer(time.later, time.clear);
    const log: string[] = [];
    buf.tap(
      () => log.push("single"),
      () => log.push("double")
    );
    expect(log).toEqual([]);
    time.tick(TAP_WAIT_MS - 1);
    expect(log).toEqual([]);
    time.tick(1);
    expect(log).toEqual(["single"]);
  });

  it("fires onDouble and skips onSingle when a second tap beats the wait", () => {
    const time = clock();
    const buf = createTapBuffer(time.later, time.clear);
    const log: string[] = [];
    const single = () => log.push("single");
    const dbl = () => log.push("double");
    buf.tap(single, dbl);
    time.tick(120);
    buf.tap(single, dbl);
    time.tick(TAP_WAIT_MS);
    expect(log).toEqual(["double"]);
  });

  it("cancel drops a pending single tap", () => {
    const time = clock();
    const buf = createTapBuffer(time.later, time.clear);
    const log: string[] = [];
    buf.tap(
      () => log.push("single"),
      () => log.push("double")
    );
    buf.cancel();
    time.tick(TAP_WAIT_MS);
    expect(log).toEqual([]);
  });
});
