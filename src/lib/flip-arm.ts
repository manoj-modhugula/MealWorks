/** Flip rotation is 0.56s. Arm only after that, and after the hold lifts. */
export const FLIP_ARM_MS = 580;

export function scheduleFlipArm(opts: {
  later: (fn: () => void, ms: number) => void;
  holding: () => boolean;
  arm: () => void;
}) {
  opts.later(() => {
    if (!opts.holding()) {
      window.getSelection()?.removeAllRanges();
      opts.arm();
      return;
    }
    const onUp = () => {
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      window.getSelection()?.removeAllRanges();
      opts.arm();
    };
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
  }, FLIP_ARM_MS);
}
