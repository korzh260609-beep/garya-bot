#!/bin/sh
set -eu

workspace="${OPENCLAW_WORKSPACE_DIR:-/data/workspace}"
source_workspace="/app/sg/workspace"

mkdir -p "$workspace"

for file in IDENTITY.md SOUL.md AGENTS.md; do
  if [ ! -f "$source_workspace/$file" ]; then
    echo "SG 2.2 bootstrap error: missing $source_workspace/$file" >&2
    exit 1
  fi
  cp "$source_workspace/$file" "$workspace/$file"
done

exec node /app/openclaw.mjs gateway --allow-unconfigured
