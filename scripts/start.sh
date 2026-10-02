#!/usr/bin/env bash
set -euo pipefail
# Bind :: (IPv6 all-interfaces / dual-stack). Railway's edge/proxy often
# reaches the container over IPv6; 0.0.0.0 alone causes connection refused → 502.
# Official: https://docs.railway.com/guides/private-networking#node--next
exec next start --hostname :: --port "${PORT:-3000}"
