/**
 * Tiny tagged logger for in-app debugging.
 *
 * Usage: `log('qvac', 'loading model', { id })`. Every line is printed to the
 * console (for Metro) AND kept in an in-memory ring buffer so the app can show
 * its own logs on-device (Settings → Logs) and export them to a shareable file —
 * useful on a physical phone where there's no terminal attached.
 */
import * as FileSystem from 'expo-file-system/legacy';

export type LogLevel = 'log' | 'warn' | 'error';
export type LogEntry = { ts: number; level: LogLevel; scope: string; message: string };

const MAX_ENTRIES = 800;
const buffer: LogEntry[] = [];

function fmtArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

function capture(level: LogLevel, scope: string, message: string): void {
  buffer.push({ ts: Date.now(), level, scope, message });
  if (buffer.length > MAX_ENTRIES) buffer.shift();
}

export function log(scope: string, ...args: unknown[]): void {
  capture('log', scope, fmtArgs(args));
  console.log(`[${scope}]`, ...args);
}

export function warn(scope: string, ...args: unknown[]): void {
  capture('warn', scope, fmtArgs(args));
  console.warn(`[${scope}]`, ...args);
}

/** Logs an error with its message, stack, and any nested `cause`. */
export function logError(scope: string, error: unknown, ...context: unknown[]): void {
  if (error instanceof Error) {
    capture('error', scope, fmtArgs([error.message, ...context]));
    console.error(`[${scope}]`, error.message, ...context);
    if (error.stack) console.error(`[${scope}] stack:`, error.stack);
    if ('cause' in error && error.cause) console.error(`[${scope}] cause:`, error.cause);
  } else {
    capture('error', scope, fmtArgs([error, ...context]));
    console.error(`[${scope}]`, error, ...context);
  }
}

// ---- In-app log access -----------------------------------------------------

export function getLogCount(): number {
  return buffer.length;
}

/** Structured entries for the in-app table, newest first. */
export function getEntries(): LogEntry[] {
  return buffer.slice().reverse();
}

/** Compact one-line-per-entry text for the in-app viewer (newest first). */
export function logLines(): string[] {
  return buffer
    .map((e) => {
      const t = new Date(e.ts).toISOString().slice(11, 19); // HH:MM:SS
      const lvl = e.level === 'log' ? '' : `${e.level.toUpperCase()} `;
      return `${t} ${lvl}[${e.scope}] ${e.message}`;
    })
    .reverse();
}

/** Full chronological text, for the exported file. */
export function logsText(): string {
  return buffer
    .map((e) => {
      const lvl = e.level === 'log' ? '' : `${e.level.toUpperCase()} `;
      return `${new Date(e.ts).toISOString()} ${lvl}[${e.scope}] ${e.message}`;
    })
    .join('\n');
}

export function clearLogs(): void {
  buffer.length = 0;
}

/** Write the captured logs to a shareable text file; returns its path. */
export async function exportLogs(): Promise<string | null> {
  const dir = FileSystem.documentDirectory;
  if (!dir) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `${dir}pouchio-logs-${stamp}.txt`;
  await FileSystem.writeAsStringAsync(path, logsText());
  return path;
}
