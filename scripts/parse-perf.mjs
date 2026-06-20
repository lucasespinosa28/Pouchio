#!/usr/bin/env node
/**
 * Turn a captured device-run log into a clean performance evidence bundle.
 *
 * Scrapes the `[perf] ...` JSON records that the app prints (model loads and
 * per-inference metrics), recomputes tokens/sec from the raw timings so the
 * numbers are consistent (decode tokens over the decode window; null when there
 * is no decode interval), and writes a JSON + CSV next to the input.
 *
 * Usage:
 *   node scripts/parse-perf.mjs logs/perf-<ts>.log
 *   node scripts/parse-perf.mjs logs/device-run-<ts>.log out/perf
 */
import { readFileSync, writeFileSync } from 'node:fs';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/parse-perf.mjs <logfile> [outBase]');
  process.exit(1);
}
const outBase = process.argv[3] ?? input.replace(/\.[^.]+$/, '');

const text = readFileSync(input, 'utf8');
const records = [];
// Match the JSON object after a `[perf] <kind> ` marker on each line.
const re = /\[perf\]\s+\w+\s+(\{.*\})/g;
let m;
while ((m = re.exec(text)) !== null) {
  try {
    records.push(JSON.parse(m[1]));
  } catch {
    /* skip malformed line */
  }
}

// Recompute decode tokens/sec consistently: (tokens - 1) over (totalMs - ttftMs).
for (const r of records) {
  if (r.kind !== 'completion') continue;
  const decodeMs = r.ttftMs != null ? r.totalMs - r.ttftMs : 0;
  r.tokensPerSec = r.tokens > 1 && decodeMs > 0 ? Math.round(((r.tokens - 1) / decodeMs) * 1000 * 10) / 10 : null;
}

const completions = records.filter((r) => r.kind === 'completion');
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const ttfts = completions.map((c) => c.ttftMs).filter((v) => v != null);
const tps = completions.map((c) => c.tokensPerSec).filter((v) => v != null);

// Per-label rollup (summary / triage / reply / ask / translate / digest / tone / draft).
const byLabel = {};
for (const c of completions) {
  (byLabel[c.label] ??= []).push(c);
}
const labelStats = Object.fromEntries(
  Object.entries(byLabel).map(([label, rows]) => [
    label,
    {
      count: rows.length,
      avgTtftMs: round1(avg(rows.map((r) => r.ttftMs).filter((v) => v != null))),
      avgTokensPerSec: round1(avg(rows.map((r) => r.tokensPerSec).filter((v) => v != null))),
      avgTokens: round1(avg(rows.map((r) => r.tokens))),
    },
  ]),
);

const summary = {
  source: input,
  generatedAt: new Date().toISOString(),
  modelEvents: records.filter((r) => r.kind === 'model').length,
  completions: completions.length,
  embeddings: records.filter((r) => r.kind === 'embedding').length,
  avgTtftMs: round1(avg(ttfts)),
  avgTokensPerSec: round1(avg(tps)),
  maxTokensPerSec: tps.length ? Math.max(...tps) : null,
  byLabel: labelStats,
};

const payload = { summary, records };
writeFileSync(`${outBase}.json`, JSON.stringify(payload, null, 2));

const cols = [
  'ts',
  'kind',
  'label',
  'model',
  'event',
  'promptChars',
  'promptTokensApprox',
  'outputChars',
  'tokens',
  'ttftMs',
  'totalMs',
  'tokensPerSec',
  'inputChars',
  'dims',
  'durationMs',
];
const csv = [
  cols.join(','),
  ...records.map((r) => cols.map((c) => (r[c] == null ? '' : r[c])).join(',')),
].join('\n');
writeFileSync(`${outBase}.csv`, csv);

console.log(`Parsed ${records.length} perf records from ${input}`);
console.log(`  ${summary.completions} completions · avg TTFT ${summary.avgTtftMs}ms · avg ${summary.avgTokensPerSec} tok/s · peak ${summary.maxTokensPerSec} tok/s`);
console.log(`Wrote ${outBase}.json and ${outBase}.csv`);
