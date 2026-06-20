/**
 * Auditable on-device performance log for the QVAC Hackathon evidence bundle.
 *
 * Captures model loads/unloads and per-inference metrics — prompt size, tokens,
 * time-to-first-token (TTFT), total time, and tokens/sec — into an in-memory
 * ring of records that can be exported to JSON/CSV in the app's document
 * directory and dumped to the console (between PERF_EXPORT markers) so an
 * external log-capture script can scrape it off the device.
 *
 * Each completion record keeps the full prompt sent to the model and the text
 * it returned, alongside the size/timing metrics, so the exported bundle is a
 * complete input→output trace.
 *
 * Privacy: prompts are email-derived, so this trace contains email content by
 * design — it's meant for on-device debugging / the hackathon evidence bundle,
 * not for sharing externally.
 */
import * as FileSystem from 'expo-file-system/legacy';

import { log } from '@/lib/log';

/** Wall clock in ms. Kept here (a plain module) so callers in components/hooks
 *  don't trip the React Compiler purity rule on Date.now(). */
export const now = (): number => Date.now();

/** Rough token estimate from character count (~4 chars/token) when the SDK
 *  doesn't report an exact prompt token count. Flagged "approx" in the schema. */
export const approxTokens = (chars: number): number => Math.max(0, Math.round(chars / 4));

export type CompletionRecord = {
  kind: 'completion';
  ts: string;
  label: string;
  model: string;
  /** Full prompt text sent to the model. */
  prompt: string;
  /** Full text the model returned. */
  output: string;
  promptChars: number;
  promptTokensApprox: number;
  outputChars: number;
  tokens: number;
  ttftMs: number | null;
  totalMs: number;
  /** Decode rate; null when there's no decode interval (≤1 generated token). */
  tokensPerSec: number | null;
};

export type ModelRecord = {
  kind: 'model';
  ts: string;
  event: 'load' | 'unload';
  model: string;
  durationMs: number | null;
};

export type EmbeddingRecord = {
  kind: 'embedding';
  ts: string;
  model: string;
  inputChars: number;
  totalMs: number;
  dims: number | null;
};

export type PerfRecord = CompletionRecord | ModelRecord | EmbeddingRecord;

const MAX_RECORDS = 1000;
const records: PerfRecord[] = [];

function push(rec: PerfRecord): void {
  records.push(rec);
  if (records.length > MAX_RECORDS) records.shift();
  // Mirror to the console so a terminal log-capture script catches it too.
  log('perf', rec.kind, rec);
}

export function recordCompletion(data: Omit<CompletionRecord, 'kind' | 'ts'>): void {
  push({ kind: 'completion', ts: new Date().toISOString(), ...data });
}

export function recordModel(data: Omit<ModelRecord, 'kind' | 'ts'>): void {
  push({ kind: 'model', ts: new Date().toISOString(), ...data });
}

export function recordEmbedding(data: Omit<EmbeddingRecord, 'kind' | 'ts'>): void {
  push({ kind: 'embedding', ts: new Date().toISOString(), ...data });
}

export function getRecords(): PerfRecord[] {
  return records.slice();
}

/** Compact one-line-per-record text for the in-app log viewer (newest first). */
export function lines(): string[] {
  return records
    .map((r) => {
      const t = r.ts.slice(11, 19); // HH:MM:SS
      if (r.kind === 'model') {
        return `${t}  ${r.event}  ${r.model}  ${r.durationMs ?? '–'}ms`;
      }
      if (r.kind === 'embedding') {
        return `${t}  embed  ${r.model}  ${r.totalMs}ms  ${r.dims ?? '?'}d`;
      }
      const tps = r.tokensPerSec != null ? `${r.tokensPerSec} tok/s` : '—';
      return `${t}  ${r.label}  ttft ${r.ttftMs ?? '–'}ms  ${r.tokens} tok  ${tps}`;
    })
    .reverse();
}

export function clear(): void {
  records.length = 0;
}

/** Aggregate quick stats for completions (handy for the in-app summary/demo). */
export function summary(): { completions: number; avgTtftMs: number | null; avgTokensPerSec: number | null } {
  const comps = records.filter((r): r is CompletionRecord => r.kind === 'completion');
  if (comps.length === 0) return { completions: 0, avgTtftMs: null, avgTokensPerSec: null };
  const ttfts = comps.map((c) => c.ttftMs).filter((v): v is number => v != null);
  const tps = comps.map((c) => c.tokensPerSec).filter((v): v is number => v != null && v > 0);
  const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  return { completions: comps.length, avgTtftMs: avg(ttfts), avgTokensPerSec: avg(tps) };
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function buildPayload() {
  return { exportedAt: new Date().toISOString(), summary: summary(), records };
}

function toCsv(): string {
  const cols = [
    'ts',
    'kind',
    'label',
    'model',
    'event',
    'durationMs',
    'promptChars',
    'promptTokensApprox',
    'outputChars',
    'tokens',
    'ttftMs',
    'totalMs',
    'tokensPerSec',
    'inputChars',
    'dims',
    'prompt',
    'output',
  ];
  // Quote any field containing a comma, quote, or newline (prompt/output text
  // does), doubling embedded quotes — RFC 4180 escaping.
  const cell = (v: unknown) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = records.map((r) => {
    const o = r as Record<string, unknown>;
    return cols.map((c) => cell(o[c])).join(',');
  });
  return [cols.join(','), ...rows].join('\n');
}

/** Write the perf log to a file and echo it to the console between markers. */
export async function exportJson(): Promise<string | null> {
  const dir = FileSystem.documentDirectory;
  const payload = buildPayload();
  // Always dump to console so it can be captured even without file access.
  console.log('===PERF_EXPORT_BEGIN===');
  console.log(JSON.stringify(payload));
  console.log('===PERF_EXPORT_END===');
  if (!dir) return null;
  const path = `${dir}pouchio-perf-${stamp()}.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(payload, null, 2));
  log('perf', 'exported json', { path, records: records.length });
  return path;
}

export async function exportCsv(): Promise<string | null> {
  const dir = FileSystem.documentDirectory;
  if (!dir) return null;
  const path = `${dir}pouchio-perf-${stamp()}.csv`;
  await FileSystem.writeAsStringAsync(path, toCsv());
  log('perf', 'exported csv', { path, records: records.length });
  return path;
}
