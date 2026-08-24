#!/bin/sh
set -eu

state_dir="${OPENCLAW_STATE_DIR:-/data/.openclaw}"
workspace="${OPENCLAW_WORKSPACE_DIR:-/data/workspace}"
source_workspace="/app/sg/workspace"
# Render injects PORT (typically 10000) for web services. Prefer it so the
# internal health check reaches the same socket the Gateway binds to.
port="${PORT:-${OPENCLAW_GATEWAY_PORT:-8080}}"
primary_model="${OPENCLAW_PRIMARY_MODEL:-openai/gpt-5.4-mini}"
config_path="$state_dir/openclaw.json"

mkdir -p "$state_dir" "$workspace"

for file in IDENTITY.md SOUL.md AGENTS.md; do
  if [ ! -f "$source_workspace/$file" ]; then
    echo "SG 2.2 bootstrap error: missing $source_workspace/$file" >&2
    exit 1
  fi
  cp "$source_workspace/$file" "$workspace/$file"
done

# Seed only the first deployment. Later operator/config changes in persistent
# OpenClaw state remain authoritative and are not overwritten on restart.
if [ ! -f "$config_path" ]; then
  cat > "$config_path" <<EOF
{
  "agents": {
    "defaults": {
      "workspace": "$workspace",
      "skipBootstrap": true,
      "model": {
        "primary": "$primary_model"
      }
    }
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "dmPolicy": "pairing"
    }
  },
  "plugins": {
    "entries": {
      "telegram": {
        "enabled": true
      }
    }
  }
}
EOF
fi

# Render reaches the service through its container network, therefore the
# Gateway must bind to LAN/0.0.0.0 rather than OpenClaw's loopback default.
echo "SG 2.2 starting OpenClaw gateway on port ${port}"
exec node /app/openclaw.mjs gateway \
  --allow-unconfigured \
  --bind lan \
  --port "$port"
