/**
 * Caps React's dev-only component-performance-track buffer to prevent native OOM.
 *
 * React 19.2 dev builds call `performance.measure()` for *every* component
 * render (`logComponentRender`) to populate the DevTools "Components ⚛" track.
 * React Native 0.85's `NativePerformance` retains every one of those measures in
 * a native buffer with no cap, so a long session with many renders exhausts
 * native memory and the next allocation throws `std::bad_alloc` — crashing inside
 * `flushPassiveEffects`. We wrap `measure()` to flush the native buffer once it
 * grows past a bound, keeping memory flat while preserving the most recent
 * timeline entries.
 *
 * Production no-ops: React doesn't emit these measures outside dev, and we bail
 * if the Performance API is missing. The app's own perf logging (`lib/perf.ts`)
 * is a plain in-memory ring and never touches the Performance API, so this has
 * no effect on it.
 */

// How many measures to let accumulate before flushing the native buffer.
const FLUSH_AFTER = 500;

export function installDevPerfGuard(): void {
  if (!__DEV__) return;
  const perf = globalThis.performance as
    | (Performance & { __pouchioGuarded?: boolean })
    | undefined;
  if (!perf || typeof perf.measure !== 'function' || perf.__pouchioGuarded) return;
  // `clearMeasures` is what actually frees the retained native entries; without
  // it there's nothing to do, so leave `measure` untouched.
  if (typeof perf.clearMeasures !== 'function') return;

  const originalMeasure = perf.measure.bind(perf);
  let sinceFlush = 0;

  perf.measure = function patchedMeasure(...args: Parameters<Performance['measure']>) {
    const result = originalMeasure(...args);
    if (++sinceFlush >= FLUSH_AFTER) {
      sinceFlush = 0;
      perf.clearMeasures();
    }
    return result;
  };
  perf.__pouchioGuarded = true;
}
