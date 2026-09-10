#!/usr/bin/env bash
#
# capture-ab.sh — the Lead A/B pack (ART-DIRECTION-REVIEW.md §9)
#
# Builds each candidate through the REVIEW path and photographs F1–F5 in REAL
# and BLIND. Both candidates go through the same build, the same server and the
# same capture script, so the two packs differ by their composition and by
# nothing else — reusing dist/ for candidate A would have compared a release
# build against a review build.
#
#   scripts/capture-ab.sh [build-root] [candidate ...]
#
# The builds are scratch. They cannot land in dist/ — astro.config.mjs refuses
# it — and nothing here writes to src/content/ or to any approval state.
set -euo pipefail

cd "$(dirname "$0")/.."
BUILD_ROOT="${1:-${TMPDIR:-/tmp}/portfolio-ab-build}"
shift || true
CANDIDATES=("$@")
[ ${#CANDIDATES[@]} -eq 0 ] && CANDIDATES=(crm)
OUT_ROOT="review-pack-v4/phase5/ab-lead"
PORT_BASE=4341

port=$PORT_BASE
for candidate in "${CANDIDATES[@]}"; do
  echo "── candidate ${candidate} ─────────────────────────────────────────"
  out="${BUILD_ROOT}/${candidate}"
  rm -rf "$out"
  REVIEW_LEAD="$candidate" REVIEW_OUT="$out" npx astro build

  # `astro preview` in this version is a DAEMON: it backgrounds itself, keeps
  # running after the shell that started it exits, and a second invocation on
  # another port silently attaches to the one already running. The first run of
  # this script photographed candidate B against candidate A's server for that
  # reason. So the server is stopped through the CLI that owns it, before and
  # after each candidate, and the pack is only taken from a server this
  # iteration started.
  npx astro preview stop >/dev/null 2>&1 || true
  trap 'npx astro preview stop >/dev/null 2>&1 || true' EXIT
  REVIEW_LEAD="$candidate" REVIEW_OUT="$out" npx astro preview --port "$port"
  for _ in $(seq 60); do
    curl -sf "http://localhost:${port}/" >/dev/null && break
    sleep 0.25
  done
  curl -sf "http://localhost:${port}/" >/dev/null \
    || { echo "preview server が ${port} で応答しない"; exit 1; }

  node scripts/capture-frames.ts \
    --out "${OUT_ROOT}/${candidate}" \
    --url "http://localhost:${port}"

  npx astro preview stop >/dev/null 2>&1 || true
  trap - EXIT
  port=$((port + 1))
done

echo "→ ${OUT_ROOT}/{crm,rin}/{real,blind}/F1–F5"
