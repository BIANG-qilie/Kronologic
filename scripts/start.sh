#!/bin/sh
set -eu
# Bind 0.0.0.0 (IPv4). Alpine [::] is often IPV6_V6ONLY=1 → Railway IPv4 edge 502.
# Standalone server.js uses process.env.HOSTNAME as the listen address;
# Docker/Nixpacks often set HOSTNAME to the container id → Ready but 502.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PORT="${PORT:-3000}"
# BIND_HOST overrides; otherwise always 0.0.0.0 (ignore container-id HOSTNAME).
export HOSTNAME="${BIND_HOST:-0.0.0.0}"

echo "start.sh: HOSTNAME=${HOSTNAME} PORT=${PORT}"

if [ -f .next/standalone/server.js ]; then
  if [ ! -d .next/standalone/.next/static ] && [ -d .next/static ]; then
    mkdir -p .next/standalone/.next
    cp -R .next/static .next/standalone/.next/static
  fi
  if [ ! -d .next/standalone/public ] && [ -d public ]; then
    cp -R public .next/standalone/public
  fi
  cd .next/standalone
  exec node server.js
fi

echo "start.sh: standalone missing; falling back to next start" >&2
exec npx next start --hostname "${HOSTNAME}" --port "${PORT}"
