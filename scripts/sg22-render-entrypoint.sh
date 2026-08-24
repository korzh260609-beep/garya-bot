#!/bin/sh
set -eu

workspace="${OPENCLAW_WORKSPACE_DIR:-/data/workspace}"
source_workspace="/app/sg/workspace"
port="${OPENCLAW_GATEWAY_PORT:-8080}"

mkdir -p "$workspace"

for file in IDENTITY.md SOUL.md AGENTS.md; do
  if [ ! -f "$source_workspace/$file" ]; then
    echo "SG 2.2 bootstrap error: missing $source_workspace/$file" >&2
    exit 1
  fi
  cp "$source_workspace/$file" "$workspace/$file"
done

# Render reaches the service through its container network, therefore the
# Gateway must bind to LAN/0.0.0.0 rather than OpenClaw's loopback default.
exec node /app/openclaw.mjs gateway \
  --allow-unconfigured \
  --bind lan \
  --port "$port"
