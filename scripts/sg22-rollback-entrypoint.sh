#!/bin/sh
set -eu

state_dir="${OPENCLAW_STATE_DIR:-/data/.openclaw}"
config_path="$state_dir/openclaw.json"

if [ -f "$config_path" ]; then
  node - "$config_path" <<'NODE'
const fs = require("node:fs");
const path = process.argv[2];
const config = JSON.parse(fs.readFileSync(path, "utf8"));
if (config.plugins?.entries) {
  delete config.plugins.entries["sg-identity"];
}
if (Array.isArray(config.plugins?.load?.paths)) {
  config.plugins.load.paths = config.plugins.load.paths.filter(
    (entry) => entry !== "/app/sg/plugin",
  );
}
fs.writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
NODE
fi

exec sh /app/scripts/sg22-render-entrypoint.sh
