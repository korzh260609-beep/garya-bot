# REPOINDEX.md — Repository Structure (Source of Truth)

Purpose:
- Define the repository structure, Core boundaries, and responsibility zones.
- Provide a stable map for repo-level review (/repo_review) and future code writing-by-command.
- Reduce “guessing” and prevent architectural drift.

Status: CANONICAL
Scope: garya-bot repository (Telegram SG)

---

## 0) Hard constraints (inherited from Pillars)

- Pillars are source of truth; chat logs are never authoritative.
- RepoIndex stores structure + hashes only; NEVER store full source bodies in memory/index.
- SG Code-AI is READ-ONLY in current stage: analysis + suggestions only (no patches/diffs).

(See: DECISIONS.md + WORKFLOW.md)

---

## 1) Top-level layout (high-level)

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

C) Canonical documents (Pillars)
- pillars/*.md (DECISIONS, WORKFLOW, PROJECT, SG_BEHAVIOR, etc.)

---

## 2) Core definition (what is “Core”)

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

### 2.6 Core: Repo integration (read-only indexing + analysis)
- src/repo/RepoSource.js
- src/repo/githubApi.js
- src/repo/textFilters.js
- src/repo/RepoIndexSnapshot.js
- src/repo/RepoIndexService.js

Responsibilities:
- Read repository structure + selected file contents on-demand.
- Enforce secret/path filtering.
- Build normalized snapshot for repo-level review.

Critical invariants:
- Read-only only (no writes, no commits).
- Index is structural (paths, hashes, metadata), not archival.

---

## 3) Responsibility zones (what goes where)

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
- Canonical rules, definitions, roadmap, constraints
Forbidden:
- TODO dumps and speculative ideas (pillars are governance)

---

## 4) Critical files (highest blast radius)

If these break, the system becomes unpredictable:

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
- src/sources/* (providers can fail without killing core)

---

## 5) Repo-review expectations (B4)

When /repo_review runs, it MUST:
- Treat Pillars as the governance baseline (DECISIONS + WORKFLOW are primary constraints).
- Evaluate repository by zones:
  - Core stability risks
  - Access/permission bypass risks
  - Memory policy violations risks
  - Repo indexing / secret leaks risks
  - Maintainability issues (lower priority)

Output rules (current stage):
- READ-ONLY suggestions only (no code, no diffs).
- Aggregate by issue type; avoid noise.
- Heuristic checks (like unreachable-code) must be treated as “potential noise” and never escalated alone.

---

## 6) Where to add new code (safe extension points)

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

---

## 8) Change governance

If repository structure changes materially:
- Update this file (REPOINDEX.md) in the same commit.
- If the change alters architecture rules, also update DECISIONS.md (explicit decision record).

