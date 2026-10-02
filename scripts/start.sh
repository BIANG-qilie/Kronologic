#!/usr/bin/env bash
set -euo pipefail
exec next start --hostname 0.0.0.0 --port "${PORT:-3000}"
