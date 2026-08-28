#!/bin/sh
set -eu

state_dir="${OPENCLAW_STATE_DIR:-/data/.openclaw}"
config_path="$state_dir/openclaw.json"
public_port="${PORT:-10000}"
gateway_port="${OPENCLAW_INTERNAL_GATEWAY_PORT:-18789}"

if [ "$gateway_port" = "$public_port" ]; then
  gateway_port=18790
fi

if [ -f "$config_path" ]; then
  node - "$config_path" <<'NODE'
const fs = require("node:fs");
const path = process.argv[2];
const config = JSON.parse(fs.readFileSync(path, "utf8"));
const renderHostname = process.env.RENDER_EXTERNAL_HOSTNAME?.trim();
if (config.plugins?.entries) {
  delete config.plugins.entries["sg-identity"];
}
if (Array.isArray(config.plugins?.load?.paths)) {
  config.plugins.load.paths = config.plugins.load.paths.filter(
    (entry) => entry !== "/app/sg/plugin",
  );
}
config.gateway ??= {};
config.gateway.trustedProxies = ["127.0.0.1", "::1"];
if (renderHostname) {
  config.gateway.controlUi ??= {};
  config.gateway.controlUi.allowedOrigins = [`https://${renderHostname}`];
}
fs.writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
NODE
fi

mkdir -p /tmp/sg22-client-body /tmp/sg22-proxy

cat > /tmp/sg22-nginx.conf <<EOF
pid /tmp/sg22-nginx.pid;
error_log /dev/stderr warn;

events {}

http {
  access_log /dev/stdout;
  client_body_temp_path /tmp/sg22-client-body;
  proxy_temp_path /tmp/sg22-proxy;

  map \$http_upgrade \$connection_upgrade {
    default upgrade;
    '' close;
  }

  server {
    listen ${public_port};
    server_name _;

    location / {
      proxy_pass http://127.0.0.1:${gateway_port};
      proxy_http_version 1.1;
      proxy_set_header Host \$host;
      proxy_set_header X-Forwarded-For \$remote_addr;
      proxy_set_header X-Real-IP \$remote_addr;
      proxy_set_header X-Forwarded-Proto https;
      proxy_set_header X-Forwarded-Host \$host;
      proxy_set_header Upgrade \$http_upgrade;
      proxy_set_header Connection \$connection_upgrade;
      proxy_read_timeout 3600s;
      proxy_send_timeout 3600s;
    }
  }
}
EOF

cleanup() {
  if [ -n "${gateway_pid:-}" ]; then
    kill "$gateway_pid" 2>/dev/null || true
  fi
  if [ -n "${nginx_pid:-}" ]; then
    kill "$nginx_pid" 2>/dev/null || true
  fi
}
trap cleanup INT TERM EXIT

PORT="$gateway_port" sh /app/scripts/sg22-render-entrypoint.sh &
gateway_pid=$!
nginx -c /tmp/sg22-nginx.conf -g 'daemon off;' &
nginx_pid=$!

echo "SG 2.2 proxy listening on 0.0.0.0:${public_port}; OpenClaw gateway on 127.0.0.1:${gateway_port}"

while kill -0 "$gateway_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do
  sleep 1
done

if ! kill -0 "$gateway_pid" 2>/dev/null; then
  wait "$gateway_pid"
else
  wait "$nginx_pid"
fi
