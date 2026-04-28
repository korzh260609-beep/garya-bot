# REPOINDEX.md — Legacy Repository Structure Notes

Purpose:
- Historical/legacy notes about repository structure, Core boundaries, and responsibility zones.
- Provide migration reference for old repo-level review flows.
- Preserve old context while RepoStateAgent becomes the factual repo-state source.

Status: LEGACY / DEPRECATED AS FACTUAL SOURCE
Scope: historical repository notes for garya-bot

Current factual source of truth:
- `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`
- `RepoStateAgent -> RepoStateCollector -> RepoStateProjectMapBuilder -> RepoStateSemanticMapBuilder`

Important:
- This file is NOT the factual current repository map.
- This file is NOT the semantic map.
- This file is NOT the module grouping truth.
- Old RepoIndex logic must be adapted to RepoStateAgent, downgraded to fallback, or carefully removed after replacement.

---

## 0) Hard constraints (inherited from Pillars)

- Pillars are source of truth for governance rules; chat logs are never authoritative.
- RepoIndex is legacy and must not be used as current factual repo state.
- Current factual repo state must come from RepoStateAgent.
- SG Code-AI is READ-ONLY in current stage: analysis + suggestions only (no patches/diffs).

(See: DECISIONS.md + WORKFLOW.md + architecture/REPO_MAP_SOURCE_POLICY.md)

---

## 1) Top-level layout (legacy high-level notes)

Repository root contains two “layers”:

A) Legacy / root-level runtime entrypoints
- index.js
- db.js
- ai.js
- classifier.js
- sources.js
- projectMemory.js
- systemPrompt.js
- modelConfig.js

B) Modularized “src/” layer (preferred structure)
- src/bootstrap/*
- src/http/*
- src/bot/*
- src/repo/*
- src/sources/*
- src/users/*
- src/memory/*
- src/logging/*
- src/tasks/*
- src/robot/*
- src/media/*

C) Governance documents (Pillars)
- pillars/*.md (DECISIONS, WORKFLOW, PROJECT, SG_BEHAVIOR, etc.)

D) Repository meta / ops
- migrations/*
- .github/*

---

## 2) Core definition (legacy notes)

Core = “things that must remain predictable and stable, because everything depends on them”.

### 2.1 Core: System bootstrap + HTTP/Transport
- src/http/server.js
- src/bootstrap/initSystem.js

Responsibilities:
- Start the app safely.
- Wire adapters to core handlers.
- No business logic, no memory, no permissions logic inside Transport.

Critical invariants:
- Startup must be deterministic.
- Transport must remain thin and stateless.

### 2.2 Core: Command routing (Telegram bot layer)
- src/bot/commandDispatcher.js
- src/bot/cmdActionMap.js
- src/bot/commands.js
- src/bot/handlers/*

Responsibilities:
- Parse user input into an action.
- Call one handler per command.
- Keep handlers small; heavy logic belongs in dedicated modules (users/sources/repo/memory/tasks).

Critical invariants:
- No direct DB/AI spaghetti inside handlers.
- Handlers call services/modules; they do not “become the system”.

### 2.3 Core: Access / roles / gates (security)
- src/users/userAccess.js
- src/users/accessRequests.js
- src/users/userProfile.js

Responsibilities:
- Identify user and role (monarch/guest).
- Enforce can(user, action) rules.
- Protect admin commands, repo review commands, and sensitive operations.

Critical invariants:
- Any privileged action must pass access checks.
- No “hidden” bypass routes.

### 2.4 Core: Memory & storage policy (predictability / privacy)
- src/memory/chatMemory.js
- core/MemoryPolicy.js

Responsibilities:
- Store only allowed memory types (decisions/results/confirmed facts).
- Block raw code storage.
- Provide bounded context retrieval.

Critical invariants:
- “Chat history is not memory.”
- No raw repository code stored in memory.

### 2.5 Core: Observability / logs
- src/logging/interactionLogs.js
- diagnostics/*

Responsibilities:
- Log actions, errors, and important events.
- Provide diagnostics without changing behavior.

Critical invariants:
- Logging must not change execution results.
- Errors must be observable.

### 2.6 Legacy Repo integration
- src/repo/RepoSource.js
- src/repo/githubApi.js
- src/repo/textFilters.js
- src/repo/RepoIndexSnapshot.js
- src/repo/RepoIndexService.js

Status:
- Legacy / compatibility.
- Must not be used as current factual project map.
- Must be adapted to RepoStateAgent or removed after replacement.

---

## 2.7 RepoIndex model (Contours A/B/C) — LEGACY IMPLEMENTATION

This section describes old behavior only.
It must not be used as factual current repo-state truth.

Repo access was split into three contours to avoid “partial repo visibility” and to keep content exposure bounded.

### Contour A — Full Tree Snapshot (paths-only)
Goal:
- Intended 100% visibility of repository structure.
Limitation:
- Old implementation may filter/limit paths and must not be treated as factual truth.

### Contour B — Content Index (allowlist only)
Goal:
- Provide limited, safe content for search/review without scanning everything.
Limitation:
- Allowlist and batch limits make it incomplete.

### Contour C — On-demand file fetch (guarded)
Goal:
- Allow reading specific files outside allowlist when explicitly requested.
Limitation:
- Compatibility only until RepoStateAgent-backed access replaces it.

---

## 3) Responsibility zones (legacy guidance)

This section is historical guidance.
For factual current repo grouping, use RepoStateAgent outputs.
For architecture governance, use current pillars and `REPO_MAP_SOURCE_POLICY.md`.

### 3.1 “Bot/UI” zone (src/bot/*)
Allowed:
- Parsing commands
- Formatting output
- Delegating to modules/services

Forbidden:
- Large business logic
- Inline DB schema assumptions
- Hidden permission checks

### 3.2 “Services/modules” zone (src/users, src/sources, src/repo, src/memory, src/tasks, src/media)
Allowed:
- Real logic, data access, policies
- Reusable functions

Forbidden:
- Telegram-specific coupling (keep transport thin)

### 3.3 “Pillars” zone (pillars/*)
Allowed:
- Governance rules, definitions, roadmap, constraints
Forbidden:
- TODO dumps and speculative ideas

---

## 4) Critical files (legacy guidance)

This list is historical guidance only.
RepoStateAgent and current architecture policies must be used before making current-state claims.

Tier A (highest):
- pillars/DECISIONS.md
- pillars/WORKFLOW.md
- src/http/server.js
- src/bootstrap/initSystem.js
- src/bot/commandDispatcher.js
- src/users/userAccess.js
- src/repo/RepoIndexService.js
- src/repo/RepoSource.js

Tier B:
- src/memory/chatMemory.js
- core/MemoryPolicy.js
- src/logging/interactionLogs.js
- diagnostics/*

Tier C:
- src/bot/handlers/*
- src/sources/*

---

## 5) Repo-review expectations (legacy)

Old `/repo_review` expectations are legacy.
Any future repo review must be rebuilt on RepoStateAgent outputs.

---

## 6) Where to add new code (legacy guidance)

Preferred:
- Add new functionality as a module under src/<domain>/...
- Add one handler under src/bot/handlers/ that calls that module.
- Update cmdActionMap/dispatcher mapping.

Avoid:
- Growing root-level index.js into a “god file”.
- Duplicating logic across handlers.

---

## 7) Security note (explicit)

Sensitive paths must be denied for repo fetch/check/review:
- .env, secrets, tokens, keys, credentials
- Any config file that may contain secrets

Repo analysis tools must treat “leak potential” as high priority.

NOTE:
- Old denylist behavior is legacy and may contain false positives/false negatives.
- Any refinement must be deliberate and reviewed.

---

## 8) Change governance

If repository structure changes materially:
- Do not update this file as factual source.
- Update RepoStateAgent logic/reports if the generated map is wrong.
- Update architecture policies only when the governance rule changes.
