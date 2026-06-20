#!/usr/bin/env bash
#
# Capture a device run's logs for the QVAC Hackathon evidence bundle.
#
# Runs the app (or just the Metro dev server) and tees ALL output to a
# timestamped file under logs/, plus a filtered file with only the QVAC / perf
# lines ([qvac], [perf], and the PERF_EXPORT block from Settings → Export).
#
# Usage:
#   scripts/capture-logs.sh            # start Metro and capture (device already installed)
#   scripts/capture-logs.sh ios        # full build+run on a connected iOS device
#   scripts/capture-logs.sh android    # full build+run on a connected Android device
#   scripts/capture-logs.sh extract <logfile>   # pull the perf JSON out of a captured log
#
# After the run, open the app and use Settings → Performance log → "Export JSON"
# to flush the structured TTFT / tokens-per-sec records into the log + a file in
# the app's document directory.

set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p logs

mode="${1:-start}"

# `extract` mode: pull the JSON printed between the PERF_EXPORT markers.
if [ "$mode" = "extract" ]; then
  src="${2:?Usage: capture-logs.sh extract <logfile>}"
  out="${src%.log}.perf.json"
  sed -n '/===PERF_EXPORT_BEGIN===/,/===PERF_EXPORT_END===/p' "$src" \
    | grep -v '===PERF_EXPORT' > "$out"
  echo "Wrote $out"
  exit 0
fi

ts="$(date +%Y%m%d-%H%M%S)"
full="logs/device-run-$ts.log"
perf="logs/perf-$ts.log"

case "$mode" in
  ios)     cmd=(bunx expo run:ios --device) ;;
  android) cmd=(bunx expo run:android --device) ;;
  start)   cmd=(bunx expo start) ;;
  *) echo "Unknown mode: $mode (use ios | android | start | extract)"; exit 1 ;;
esac

echo "Running: ${cmd[*]}"
echo "  full log  -> $full"
echo "  perf-only -> $perf"
echo "Open the app, then Settings → Performance log → Export JSON to flush metrics."
echo

# Show everything live, save the full log, and split the QVAC/perf lines out.
"${cmd[@]}" 2>&1 \
  | tee "$full" \
  | tee >(grep -E '\[qvac\]|\[perf\]|PERF_EXPORT' > "$perf")
