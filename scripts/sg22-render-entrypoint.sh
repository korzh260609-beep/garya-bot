#!/bin/sh
set -eu

state_dir="${OPENCLAW_STATE_DIR:-/data/.openclaw}"
workspace="${OPENCLAW_WORKSPACE_DIR:-/data/workspace}"
source_workspace="/app/sg/workspace"
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

if [ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
  echo "SG 2.2 startup error: OPENCLAW_GATEWAY_TOKEN is required for LAN gateway auth" >&2
  exit 1
fi

node /app/openclaw.mjs config set --batch-json "[{\"path\":\"gateway.mode\",\"value\":\"local\"},{\"path\":\"gateway.bind\",\"value\":\"lan\"},{\"path\":\"gateway.port\",\"value\":${port}},{\"path\":\"gateway.auth.mode\",\"value\":\"token\"}]"

echo "SG 2.2 starting OpenClaw gateway on 0.0.0.0:${port}"
node /app/openclaw.mjs gateway --bind lan --port "$port" &
gateway_pid=$!

forward_signal() {
  kill -TERM "$gateway_pid" 2>/dev/null || true
}
trap forward_signal INT TERM

# Give the gateway enough time to finish plugin/channel startup before probing.
sleep 15

i=1
while [ "$i" -le 12 ]; do
  if ! kill -0 "$gateway_pid" 2>/dev/null; then
    echo "[sg22/startupz-net] gateway_process_exited_before_probe"
    wait "$gateway_pid"
    exit $?
  fi

  # Keep probe failures non-fatal even with `set -e`; they are diagnostic only.
  probe_status=0
  if PORT_TO_CHECK="$port" node --input-type=module -e '
    import os from "node:os";
    const port = process.env.PORT_TO_CHECK;
    const targets = [{label:"loopback", host:"127.0.0.1"}];
    for (const [name, entries] of Object.entries(os.networkInterfaces())) {
      for (const entry of entries ?? []) {
        if (entry.family === "IPv4" && !entry.internal) {
          targets.push({label:`${name}/${entry.address}`, host:entry.address});
        }
      }
    }
    let nonLoopbackReady = false;
    for (const target of targets) {
      const url = `http://${target.host}:${port}/startupz`;
      try {
        const response = await fetch(url);
        const body = await response.text();
        console.log(`[sg22/startupz-net] target=${target.label} status=${response.status} body=${body}`);
        if (target.label !== "loopback" && response.status === 200) nonLoopbackReady = true;
      } catch (error) {
        console.log(`[sg22/startupz-net] target=${target.label} request_failed=${error?.message ?? String(error)}`);
      }
    }
    process.exit(nonLoopbackReady ? 0 : 2);
  '; then
    probe_status=0
  else
    probe_status=$?
  fi

  if [ "$probe_status" -eq 0 ]; then
    echo "[sg22/startupz-net] non_loopback_ready"
    break
  fi

  echo "[sg22/startupz-net] probe_attempt=${i} not_ready status=${probe_status}"
  i=$((i + 1))
  sleep 10
done

wait "$gateway_pid"
exit $?
