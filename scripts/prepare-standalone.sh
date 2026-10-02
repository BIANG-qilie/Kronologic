#!/bin/sh
# Copy static assets into the standalone output. Next does not do this itself;
# without them, HTML can 200 while CSS/JS 404 — and some proxies still look unhealthy.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .next/standalone/server.js ]; then
  echo "prepare-standalone: missing .next/standalone/server.js (is output: 'standalone' set?)" >&2
  exit 1
fi

mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -R .next/static .next/standalone/.next/static

rm -rf .next/standalone/public
cp -R public .next/standalone/public

echo "prepare-standalone: synced .next/static + public into .next/standalone"
