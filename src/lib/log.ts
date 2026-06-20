/**
 * Tiny tagged console logger for in-app debugging.
 *
 * Usage: `log('qvac', 'loading model', { id })`. Output is prefixed with the
 * scope so logs are easy to filter in the Metro/dev console.
 */

export function log(scope: string, ...args: unknown[]): void {
  console.log(`[${scope}]`, ...args);
}

export function warn(scope: string, ...args: unknown[]): void {
  console.warn(`[${scope}]`, ...args);
}

/** Logs an error with its message, stack, and any nested `cause`. */
export function logError(scope: string, error: unknown, ...context: unknown[]): void {
  if (error instanceof Error) {
    console.error(`[${scope}]`, error.message, ...context);
    if (error.stack) console.error(`[${scope}] stack:`, error.stack);
    if ('cause' in error && error.cause) console.error(`[${scope}] cause:`, error.cause);
  } else {
    console.error(`[${scope}]`, error, ...context);
  }
}
