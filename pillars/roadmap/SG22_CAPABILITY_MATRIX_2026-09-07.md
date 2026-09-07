# SG 2.2 Capability Matrix — 2026-09-07

## Status

PHASE 0 BASELINE / OBSERVATION ONLY

This document records the deployed SG 2.2/OpenClaw capability surface observed on
2026-09-07. It does not activate a capability, change production state, close a
later phase, or authorize a deploy.

Counts and availability statements are tied to the exact image, source commits,
effective configuration, credentials and Render environment recorded below.

## Safety and authority boundaries

- Work branch: `dev/sg2.2-openclaw` only. `main` was not changed.
- OpenClaw core and the bundled Telegram adapter were not changed.
- Render autodeploy remains disabled. No deploy, restart, environment-variable
  write or service-setting change was performed during this audit.
- Secret values were not read or recorded. Only relevant variable names were
  inspected.
- The monarch must ultimately receive the complete configured capability surface.
- Citizens must retain ordinary SG capabilities but must not receive repository,
  GitHub, Render, server, process, secret, environment-variable or OpenClaw
  administration authority.

## Exact rollback and Git state

| Fact | Observed value |
|---|---|
| Repository | `korzh260609-beep/garya-bot` |
| Active branch | `dev/sg2.2-openclaw` |
| Local HEAD | `4a3fd1490857842327db96bb223cd0b1a179c24e` |
| Remote work-branch HEAD | `4a3fd1490857842327db96bb223cd0b1a179c24e` |
| Local tree | `db6dec4e648e9175286dcfb59d0cd7a17ba14630` |
| Worktree at start of Phase 0 | clean |
| Rollback ref | `rollback/sg22-before-full-openclaw-2026-09-07` |
| Local rollback SHA | `4a3fd1490857842327db96bb223cd0b1a179c24e` |
| GitHub rollback SHA | `4a3fd1490857842327db96bb223cd0b1a179c24e` |

The rollback ref was created without modifying the work branch. Its remote SHA was
verified through the authorized GitHub connector because the local shell has no
GitHub HTTPS credentials.

## Exact deployed Render baseline

| Fact | Observed value |
|---|---|
| Service | `sg-2-2-openclaw` |
| Service ID | `srv-da66ig67bikc73b1h0u0` |
| Runtime | Docker / Standard |
| Configured branch | `dev/sg2.2-openclaw` |
| Live Render source commit | `b607bc0d0d41719cc11dc6a26e504f03e8481777` |
| Source subject | `deploy(sg): pin lock-safe role migration image` |
| Deploy ID | `dep-daej929t0dsc73af9r4g` |
| Deploy state | live / succeeded |
| Deploy trigger | manual |
| Deploy completed | 2026-09-06 12:38:17 GMT+3 |
| Pinned image | `ghcr.io/korzh260609-beep/garya-bot-sg22:14c5f6c4c92499213e1f3530fe613a5df72f9f7c` |
| OpenClaw runtime identity | `OpenClaw 2026.8.1 (14c5f6c)` |
| Image source commit | `14c5f6c4c92499213e1f3530fe613a5df72f9f7c` |
| Image source tree | `ae2f6af6f128dc69db4887dcd901d927b8b52c89` |
| Image source subject | `fix(sg): tolerate concurrent profile lock contention` |

The audited checkout is newer than the deployed Render source and image. Live
claims in this matrix therefore come from the running container, not from the
current checkout alone.

## Effective startup configuration

| Area | Effective value | Consequence |
|---|---|---|
| Tool profile | `coding` | The deployed SG does not inherit the full standard tool profile. |
| SG tool additions | Eight `sg_*` tools in `tools.alsoAllow` | External SG domain tools are loaded without changing OpenClaw core. |
| DM scope | `per-channel-peer` | Direct-message sessions are separated by channel and peer. |
| Memory provider | OpenAI / `text-embedding-3-small` | Vector memory is configured and operational. |
| Telegram DM policy | `open`, `allowFrom=["*"]` | Any Telegram sender may start a DM session. |
| Telegram group policy | allowlist; wildcard group requires mention | Group operation is mention-gated. |
| SG plugin | loaded and enabled | SG behavior is supplied by the external plugin. |

The wildcard sender rule denies development and privileged SG tools, including
filesystem writes, shell/process execution, GitHub, agent spawning, OpenClaw
administration and privileged SG review/publish/test-management actions. The exact
monarch sender rule adds the privileged SG actions. OpenClaw resolves an exact
channel/sender rule before the wildcard fallback, so the monarch is not subject to
the citizen wildcard deny list. The global `coding` profile still narrows the
monarch's standard OpenClaw surface.

## Capability summary

| Surface | Current category | Evidence and gap |
|---|---|---|
| External SG plugin | active and usable | Loaded with eight registered SG tools. |
| Telegram | active and usable | Polling, connected, ready, no current error, inbound and outbound activity observed. |
| OpenAI model/memory provider | active and usable | Memory embeddings and vector index operational. |
| Memory | active but not fully synchronized | 25 indexed files, 85 chunks, 48 eligible sources/files; index reports `dirty`. |
| Sessions | active | 27 stored sessions observed; effective DM scope is `per-channel-peer`. |
| GitHub in deployed SG | awaiting credentials | `gh` is installed, but `gh auth status` is unauthenticated and no GitHub credential variable is configured. |
| Render management in deployed SG | missing integration and credentials | No adequate native Render plugin/tool or Render API credential was found. |
| Browser | unsupported by current image and profile | Browser plugin is loaded, but `coding` blocks the tool and the expected Chromium executable is absent. |
| Device-local actions | awaiting account/device pairing | Pairing plugin is loaded; no paired device was established by this audit. |
| Full OpenClaw profile | installed but disabled by configuration | Eleven core tools become profile-eligible only under `full`. |

## Standard core tool inventory

The pinned OpenClaw source defines 55 standard core tool IDs. Profile membership
does not by itself prove that a provider, credential, client surface or paired node
needed by a tool is available.

### In the effective `coding` profile (44)

`read`, `write`, `edit`, `apply_patch`, `exec`, `process`, `code_execution`,
`web_search`, `web_fetch`, `x_search`, `memory_search`, `memory_get`, `sessions`,
`sessions_list`, `sessions_history`, `sessions_search`, `conversations_list`,
`conversations_send`, `conversations_turn`, `sessions_send`, `sessions_spawn`,
`github_identity_status`, `github_publish`, `agents_wait`, `sessions_yield`,
`subagents`, `session_status`, `suggest_task`, `dismiss_task`, `screen`,
`dashboard`, `terminal`, `portal`, `automations`, `get_goal`, `create_goal`,
`update_goal`, `progress_card`, `ask_user`, `skill_workshop`, `view_image`,
`image_generate`, `music_generate`, `video_generate`.

Sender policy further removes privileged filesystem, execution, GitHub, agent and
administration tools from citizens. Provider-backed tools remain unusable when
their provider credential or endpoint is absent.

### Blocked only by the current profile; available under `full` (11)

`browser`, `canvas`, `show_widget`, `message`, `heartbeat_respond`, `gateway`,
`nodes`, `computer`, `mobile_ui`, `agents_list`, `tts`.

### External SG tools (8)

`sg_content_draft`, `sg_content_review`, `sg_content_publish`,
`sg_content_schedule`, `sg_content_dispatch`, `sg_test_manage`,
`sg_test_attempt`, `sg_test_stats`.

The citizen wildcard policy denies `sg_content_review`, `sg_content_publish`,
`sg_content_schedule`, `sg_test_manage` and `sg_test_stats`. The monarch exact
sender policy adds those five tools.

### Plugin tool families observed

| Plugin | Tool IDs | Current category |
|---|---|---|
| Browser | `browser` | loaded; profile-blocked; Chromium missing |
| Canvas | `canvas` | loaded; profile-blocked |
| File transfer | `file_fetch`, `dir_list`, `dir_fetch`, `file_write` | loaded; end-to-end use not exercised |
| Memory core | `intent`, `memory_get`, `memory_search` | active and usable |
| Ollama | `node_inference` | loaded; awaiting endpoint/configuration |
| xAI | `code_execution`, `x_search` | loaded; awaiting provider credentials |
| Codex | `codex_threads`, `codex_plugins`, `codex_endpoint_probe`, `codex_sessions_list`, `codex_session_read`, `codex_session_send` | installed but disabled |
| LLM task | `llm-task` | installed but disabled |
| Memory Wiki | `wiki_apply`, `wiki_get`, `wiki_lint`, `wiki_search`, `wiki_status` | installed but disabled |
| 1Password | `onepassword` | installed but disabled; account/tool pairing absent |
| Workboard | 36 `workboard_*` tools | installed but disabled |

## Skill inventory

The live runtime reports 69 skills: 34 eligible and 35 missing requirements.
`eligible` means the skill loader accepted its declared requirements; it does not
prove every downstream credential, tool, browser binary or external account.

### Eligible/model-visible (34)

`ai-service-pricing`, `automation-preflight-clarification`,
`automation-task-lookup`, `browser-automation`, `canvas`, `clawhub`,
`client-chat-routing`, `client-deal-closing`, `club-offer-discovery`,
`content-publish-approval`, `context-attribution`, `daily-prediction-summary`,
`diagram-maker`, `gh-issues`, `github`, `healthcheck`,
`integration-capability-briefing`, `interactive-test-publishing`,
`mak-card-facilitation`, `meme-maker`, `node-connect`,
`node-inspect-debugger`, `notion`, `openai-whisper-api`,
`paid-task-platform-research`, `python-debugpy`,
`recurring-report-scheduling`, `skill-creator`, `spike`, `style-calibration`,
`taskflow`, `taskflow-inbox-triage`, `weather`,
`workspace-connection-approval`.

Known qualification: `browser-automation` cannot launch locally because Chromium
is absent and the browser tool is profile-blocked. `github` and `gh-issues` cannot
authenticate because the deployed runtime has no GitHub authorization.

### Awaiting requirements (35)

| Skill | Missing requirement |
|---|---|
| `1password` | binary `op` |
| `apple-notes` | binary `memo`; macOS |
| `apple-reminders` | binary `remindctl`; macOS |
| `bear-notes` | binary `grizzly`; macOS |
| `blogwatcher` | binary `blogwatcher` |
| `blucli` | binary `blu` |
| `camsnap` | binary `camsnap` |
| `coding-agent` | one of `claude`, `codex`, `opencode`; enabled config |
| `eightctl` | binary `eightctl` |
| `gemini` | binary `gemini` |
| `gifgrep` | binary `gifgrep` |
| `gog` | binary `gog` |
| `goplaces` | binary `goplaces`; `GOOGLE_PLACES_API_KEY` |
| `himalaya` | binary `himalaya` |
| `mcporter` | binary `mcporter` |
| `model-usage` | binary `codexbar` |
| `nano-pdf` | binary `nano-pdf` |
| `obsidian` | binary `obsidian` |
| `openai-whisper` | binary `whisper` |
| `openhue` | binary `openhue` |
| `oracle` | binary `oracle` |
| `ordercli` | binary `ordercli` |
| `peekaboo` | binary `peekaboo`; macOS |
| `sag` | binary `sag`; `ELEVENLABS_API_KEY` |
| `session-logs` | binaries `jq`, `rg` |
| `sherpa-onnx-tts` | runtime/model directory variables |
| `songsee` | binary `songsee` |
| `sonoscli` | binary `sonos` |
| `spotify-player` | one of `spogo`, `spotify_player` |
| `summarize` | binary `summarize` |
| `things-mac` | binary `things`; macOS |
| `tmux` | binary `tmux` |
| `trello` | binary `jq`; Trello credential variables |
| `video-frames` | binary `ffmpeg` |
| `xurl` | binary `xurl` |

## Plugin inventory

The running container discovers 58 plugins: 39 loaded and 19 disabled. Of these,
57 are standard OpenClaw plugins and one is the external `sg-workspace-manager`.
Plugin diagnostics were empty. A loaded provider plugin is not considered usable
without its required credentials, endpoint, account or device.

### Active and directly evidenced

- `sg-workspace-manager`: external SG plugin, loaded with eight SG tools.
- `telegram`: connected polling transport with current inbound/outbound activity.
- `openai`: configured provider used by live memory embeddings.
- `memory-core`: builtin memory backend with available FTS and vector search.

### Loaded; host utility present but end-to-end use not exercised

`document-extract`, `file-transfer`, `web-readability`.

### Loaded; awaiting provider credentials, endpoint or provider configuration

`alibaba`, `anthropic`, `azure-speech`, `clawrouter`, `copilot-proxy`, `deepgram`,
`elevenlabs`, `fal`, `github-copilot`, `google`, `huggingface`, `litellm`,
`lmstudio`, `microsoft`, `microsoft-foundry`, `minimax`, `nvidia`, `ollama`,
`opencode-go`, `openrouter`, `runway`, `senseaudio`, `sglang`, `talk-voice`,
`together`, `tts-local-cli`, `vllm`, `xai`.

Only OpenAI and Telegram credential names were present among the inspected
provider/channel variables. Local-provider plugins additionally require their
corresponding reachable service or node.

### Loaded; awaiting account or device pairing

`device-pair`, `linux-node`.

### Loaded but blocked or unsupported in the current deployment

- `browser`: blocked by `coding`; expected Chromium executable absent.
- `canvas`: blocked by `coding` and requires a capable client surface.

### Installed but disabled (19)

`active-memory`, `admin-http-rpc`, `beam`, `bonjour`, `codex`, `crabbox`,
`cua-computer`, `llm-task`, `logbook`, `memory-wiki`, `migrate-claude`,
`migrate-hermes`, `oc-path`, `onepassword`, `policy`, `reef`, `vault`,
`webhooks`, `workboard`.

### Standard source-catalog plugins missing from the image (90)

The pinned image source contains 147 standard extension manifests. The running
container discovers 57 of those standard IDs. The following 90 source-catalog
plugins are absent from the runtime inventory:

`acpx`, `amazon-bedrock`, `amazon-bedrock-mantle`, `anthropic-vertex`, `arcee`,
`baseten`, `brave`, `buzz`, `byteplus`, `cerebras`, `chutes`, `clickclack`,
`cloudflare-ai-gateway`, `cohere`, `comfy`, `copilot`, `deepinfra`, `deepseek`,
`diagnostics-otel`, `diagnostics-prometheus`, `diffs`, `diffs-language-pack`,
`discord`, `duckduckgo`, `exa`, `featherless`, `feishu`, `firecrawl`,
`fireworks`, `fish-audio-speech`, `gmi`, `google-meet`, `googlechat`, `gradium`,
`groq`, `imessage`, `inworld`, `irc`, `kilocode`, `kimi`, `line`, `llama-cpp`,
`lobster`, `longcat`, `matrix`, `mattermost`, `memory-lancedb`, `meta`, `mistral`,
`moonshot`, `msteams`, `mxc`, `nextcloud-talk`, `nostr`, `novita`, `opencode`,
`openshell`, `parallel`, `perplexity`, `pixverse`, `qa-channel`, `qa-lab`,
`qianfan`, `qwen`, `raft`, `searxng`, `signal`, `slack`, `sms`, `stepfun`,
`synology-chat`, `synthetic`, `tavily`, `teams-meetings`, `tencent`, `tlon`,
`tokenjuice`, `twitch`, `venice`, `vercel-ai-gateway`, `voice-call`,
`volcengine`, `voyage`, `vydra`, `whatsapp`, `xiaomi`, `zai`, `zalo`,
`zalouser`, `zoom-meetings`.

This list is an image-composition observation, not a requirement to activate every
provider or channel. Later phases should install/configure only capabilities that
are technically usable and permitted, without introducing an SG-specific global
allowlist.

## GitHub behavior

- The GitHub CLI is installed in the running image.
- GitHub-related core tools are in the `coding` profile and structurally eligible
  GitHub skills are visible.
- `gh auth status` reports no authenticated GitHub host.
- No `GH_TOKEN`, `GITHUB_TOKEN` or equivalent GitHub credential variable name was
  found in the inspected runtime environment.
- Therefore the deployed SG cannot currently perform authenticated GitHub work.
- The ChatGPT GitHub connector used to verify the rollback branch is a separate
  authorization surface and does not authenticate the deployed SG runtime.

## Render behavior

- No adequate native Render management plugin/tool was found in the deployed
  OpenClaw inventory.
- No Render API credential variable name was found.
- Render platform metadata variables do not grant service-management authority.
- The deployed SG can therefore not list/manage Render through an authoritative
  API tool today.
- Per the canonical plan, any required implementation belongs as a thin tool
  surface in the external SG plugin only after native-integration audit and
  failing contracts.

## Telegram behavior

The existing bundled OpenClaw Telegram adapter is configured and running in
polling mode. The default account reports enabled, ready and connected, with zero
reconnect attempts, no current error, non-null inbound/outbound activity and a
healthy event loop. Group messages remain mention-gated.

This proves current text transport health, not every Phase 5 media, reply, reaction,
button, poll, topic, edit, delete, scheduling or TTS behavior. Those require
separate contract and live verification without changing the adapter.

## Session behavior

- The effective direct-message scope is `per-channel-peer`.
- The live session store reported 27 sessions.
- No session message content, raw session key or participant identifier was
  recorded in this audit.
- Configuration establishes routing intent, but cross-user isolation must still
  be protected by the Phase 1 failing contract and later live verification.

## Memory behavior

| Fact | Observed value |
|---|---|
| Backend | builtin |
| Provider/model | OpenAI / `text-embedding-3-small` |
| Indexed files | 25 |
| Indexed chunks | 85 |
| Eligible memory sources/files | 48 |
| Index state | `dirty` |
| Full-text search | enabled and available |
| Vector search | enabled; complete index; 1536 dimensions |
| Audit issues | none reported |
| Session corpus files | 12 |

Memory search is operational, but the dirty index and 25-of-48 coverage mean the
deployment cannot yet be described as fully synchronized durable memory. User
isolation and restart durability remain explicit later-phase verification items.

## Runtime diagnostics and known gaps

1. The gateway process listens on port `18789`, while an unqualified CLI status
   command attempted the stale/default port `8080`. Read-only checks succeeded
   only when the live gateway URL was supplied for the command. Startup/runtime
   configuration should have one authoritative target.
2. The global `coding` profile is the primary artificial narrowing of the monarch
   capability surface.
3. Browser activation requires both the `full` profile and Chromium in the image.
4. GitHub requires one authoritative owner-approved credential method.
5. Render requires an authoritative integration and secret references; no native
   adequate integration was observed.
6. Loaded provider plugins must not be reported as usable until credentials,
   endpoints and a safe end-to-end check exist.
7. Memory synchronization and private-user isolation are not yet proven complete.

## Phase 0 conclusion

Phase 0 has an exact Git/rollback point, deployed-image identity, effective startup
configuration and dated capability inventory. The observed gaps provide the red
baseline for Phase 1 contracts. No activation change has been made, and Phase 1
must not begin until this matrix diff is reviewed and the owner authorizes the next
step.
