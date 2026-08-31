#!/bin/sh
set -eu

# Render Starter has a tight memory envelope. Keep V8/native allocator growth bounded
# without disabling SG/OpenClaw capabilities.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1024 --max-semi-space-size=16}"
export MALLOC_ARENA_MAX="${MALLOC_ARENA_MAX:-2}"

state_dir="${OPENCLAW_STATE_DIR:-/data/.openclaw}"
workspace="${OPENCLAW_WORKSPACE_DIR:-/data/workspace}"
source_workspace="/app/sg/workspace"
port="${PORT:-10000}"
primary_model="${OPENCLAW_PRIMARY_MODEL:-openai/gpt-5.4-mini}"
config_path="$state_dir/openclaw.json"
telegram_owner_id="${SG_MONARCH_TELEGRAM_USER_ID:-${MONARCH_USER_ID:-}}"
workspace_plugin_enabled="${SG_WORKSPACE_PLUGIN_ENABLED:-true}"

case "$workspace_plugin_enabled" in
  true|false) ;;
  *)
    echo "SG 2.2 startup error: SG_WORKSPACE_PLUGIN_ENABLED must be true or false" >&2
    exit 1
    ;;
esac

if [ "$workspace_plugin_enabled" = "true" ]; then
  workspace_plugin_paths='["/app/sg/plugin"]'
  workspace_plugin_tools='["sg_workspace_onboard","sg_workspace_pending","sg_workspace_decide"]'
else
  workspace_plugin_paths='[]'
  workspace_plugin_tools='[]'
fi

mkdir -p "$state_dir" "$workspace"

# Repair/migrate the persistent SG Global ID store before any Telegram message can
# enter dispatch. This preserves recognized legacy data and only removes invalid
# duplicate/orphan links; unrecognized stores are backed up rather than overwritten.
node /app/scripts/sg22-migrate-global-profiles.mjs

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
      },
      "tools": {
        "alsoAllow": $workspace_plugin_tools
      }
    }
  },
  "messages": {
    "groupChat": {
      "mentionPatterns": [
        "(^|[\\s,.:;!?])сг([\\s,.:;!?]|$)",
        "(^|[\\s,.:;!?])sg([\\s,.:;!?]|$)"
      ]
    }
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "dmPolicy": "open",
      "allowFrom": ["*"],
      "groupPolicy": "allowlist",
      "groups": {
        "*": {
          "requireMention": true
        }
      }
    }
  },
  "plugins": {
    "load": {
      "paths": $workspace_plugin_paths
    },
    "entries": {
      "telegram": {
        "enabled": true
      },
      "sg-workspace-manager": {
        "enabled": $workspace_plugin_enabled,
        "hooks": {
          "allowPromptInjection": true,
          "allowConversationAccess": true
        }
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

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "SG 2.2 startup error: OPENAI_API_KEY is required" >&2
  exit 1
fi

# Keep provider auth on the Render API key. A stale OAuth profile in the
# persistent state must not take precedence over the deployment credential.
node /app/openclaw.mjs onboard --non-interactive --accept-risk --skip-health --skip-daemon \
  --mode local \
  --auth-choice openai-api-key \
  --secret-input-mode ref \
  --gateway-auth token \
  --gateway-token-ref-env OPENCLAW_GATEWAY_TOKEN

# Restamp runtime settings on every boot so persistent state cannot restore
# stale one-user access, stale Telegram group restrictions, or stale provider configuration.
config_batch='[{"path":"gateway.mode","value":"local"},{"path":"gateway.bind","value":"lan"},{"path":"gateway.port","value":'"${port}"'},{"path":"gateway.auth.mode","value":"token"},{"path":"agents.defaults.model.primary","value":"'"${primary_model}"'"},{"path":"agents.defaults.tools.alsoAllow","value":'"${workspace_plugin_tools}"'},{"path":"auth.order.openai","value":["openai:api-key"]},{"path":"memory.search.provider","value":"openai"},{"path":"memory.search.remote.apiKey","value":{"source":"env","provider":"default","id":"OPENAI_API_KEY"}},{"path":"messages.groupChat.mentionPatterns","value":["(^|[\\s,.:;!?])сг([\\s,.:;!?]|$)","(^|[\\s,.:;!?])sg([\\s,.:;!?]|$)"]},{"path":"channels.telegram.dmPolicy","value":"open"},{"path":"channels.telegram.allowFrom","value":["*"]},{"path":"channels.telegram.groupPolicy","value":"allowlist"},{"path":"channels.telegram.groups","value":{"*":{"requireMention":true}}},{"path":"plugins.load.paths","value":'"${workspace_plugin_paths}"'},{"path":"plugins.entries.sg-workspace-manager.enabled","value":'"${workspace_plugin_enabled}"'},{"path":"plugins.entries.sg-workspace-manager.hooks.allowPromptInjection","value":true},{"path":"plugins.entries.sg-workspace-manager.hooks.allowConversationAccess","value":true}]'

if [ -n "$telegram_owner_id" ]; then
  config_batch="${config_batch%]} ,{\"path\":\"commands.ownerAllowFrom\",\"value\":[\"telegram:${telegram_owner_id}\"]}]"
fi

node /app/openclaw.mjs config set --batch-json "$config_batch"
node /app/openclaw.mjs config set agents.defaults.models "{\"${primary_model}\":{\"agentRuntime\":{\"id\":\"openclaw\"}}}" --strict-json --merge

echo "SG workspace diagnostic: image_commit=${SG22_IMAGE_COMMIT:-unknown} enabled=${workspace_plugin_enabled}"
if [ "$workspace_plugin_enabled" = "true" ]; then
  for plugin_file in index.ts register.ts openclaw.plugin.json package.json; do
    if [ ! -f "/app/sg/plugin/$plugin_file" ]; then
      echo "SG 2.2 startup error: missing plugin file $plugin_file" >&2
      exit 1
    fi
    checksum="$(sha256sum "/app/sg/plugin/$plugin_file" | cut -d ' ' -f 1)"
    echo "SG workspace diagnostic: file=$plugin_file sha256=$checksum"
  done
  if ! node /app/openclaw.mjs plugins status; then
    echo "SG workspace diagnostic: plugins status failed; gateway startup continues" >&2
  fi
fi

echo "SG 2.2 starting OpenClaw gateway on 0.0.0.0:${port}"
exec node /app/openclaw.mjs gateway --bind lan --port "$port"
