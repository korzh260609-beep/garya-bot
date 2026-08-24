#!/bin/sh
set -eu

state_dir="${OPENCLAW_STATE_DIR:-/data/.openclaw}"
workspace="${OPENCLAW_WORKSPACE_DIR:-/data/workspace}"
source_workspace="/app/sg/workspace"
# Render injects PORT (10000 by default) for web services.
port="${PORT:-10000}"
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

# Seed SG-specific agent/channel config only on the first deployment.
# Existing persistent OpenClaw state remains authoritative for later operator changes.
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

# Render/OpenClaw runtime contract.
# These infrastructure settings must be restamped on every boot because the
# persistent disk can contain an older config created before Render support.
# Official OpenClaw container guidance requires local gateway mode + LAN bind;
# non-loopback bind requires auth, supplied by OPENCLAW_GATEWAY_TOKEN.
if [ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
  echo "SG 2.2 startup error: OPENCLAW_GATEWAY_TOKEN is required for LAN gateway auth" >&2
  exit 1
fi

node /app/openclaw.mjs config set --batch-json "[{\"path\":\"gateway.mode\",\"value\":\"local\"},{\"path\":\"gateway.bind\",\"value\":\"lan\"},{\"path\":\"gateway.port\",\"value\":${port}},{\"path\":\"gateway.auth.mode\",\"value\":\"token\"}]"

# Temporary Render startup diagnostics: query OpenClaw's local startup probe
# from inside the same container and print the exact HTTP status/body.
# This does not affect gateway readiness or Render health-check behaviour.
(
  sleep 5
  i=1
  while [ "$i" -le 12 ]; do
    PORT_TO_CHECK="$port" node --input-type=module -e '
      const port = process.env.PORT_TO_CHECK;
      const url = `http://127.0.0.1:${port}/startupz`;
      try {
        const response = await fetch(url);
        const body = await response.text();
        console.log(`[sg22/startupz-local] status=${response.status} body=${body}`);
      } catch (error) {
        console.log(`[sg22/startupz-local] request_failed=${error?.message ?? String(error)}`);
      }
    ' || true
    i=$((i + 1))
    sleep 10
  done
) &

echo "SG 2.2 starting OpenClaw gateway on 0.0.0.0:${port}"
exec node /app/openclaw.mjs gateway --bind lan --port "$port"
