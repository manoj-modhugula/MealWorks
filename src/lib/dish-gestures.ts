export const TAP_WAIT_MS = 300;

export function createTapBuffer(
  later: (fn: () => void, ms: number) => number,
  clear: (id: number) => void,
  waitMs = TAP_WAIT_MS
) {
  let taps = 0;
  let id: number | null = null;

  return {
    tap(onSingle: () => void, onDouble: () => void) {
      taps += 1;
      if (taps === 1) {
        id = later(() => {
          taps = 0;
          id = null;
          onSingle();
        }, waitMs);
        return;
      }
      if (id != null) clear(id);
      id = null;
      taps = 0;
      onDouble();
    },
    cancel() {
      if (id != null) clear(id);
      id = null;
      taps = 0;
    },
  };
}
