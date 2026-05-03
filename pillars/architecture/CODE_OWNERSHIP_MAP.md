# CODE_OWNERSHIP_MAP.md — SG 2.0 Code Ownership Boundaries

> AGENT NOTE:
> This file maps future code ownership boundaries for SG 2.0.
> Read it before creating or moving files in `src/`, `docs/`, `pillars/`, or root runtime files.
> Do not mix unrelated responsibilities or turn ownership boundaries into separate SG identities without explicit Monarch approval.

Статус: ACTIVE SKELETON

---

## Root files

Root files should stay minimal.

- `index.js` — startup only, must not become a monolith.
- `package.json` — runtime scripts and dependencies only.
- `.env.example` — environment contract only.
- `README.md` — branch/project entrypoint only.

---

## Planned code areas

```text
src/core/           -> orchestration and normalized flow
src/config/         -> config and feature flags
src/permissions/    -> roles, capabilities, confirmations
src/transport/      -> Telegram/web/API adapters
src/memory/         -> memory interface and services
src/sources/        -> source providers and normalizers
src/ai/             -> AI wrapper/router/model config
src/tasks/          -> task engine and workers
src/users/          -> identity and user profiles
src/logging/        -> logs, diagnostics, errors
src/delivery/       -> message/report delivery formatting
src/documents/      -> file intake and parsing
src/repo/           -> repo read/audit/facts helpers
src/billing/        -> credits, plans, usage accounting
```

---

## Documentation areas

```text
pillars/            -> canonical decisions, laws, workflow, architecture
pillars/workflow/   -> approved development order
docs/               -> implementation docs and runtime contracts
```

---

## Forbidden

- feature logic in `index.js`;
- AI calls scattered across modules;
- database writes hidden in transport handlers;
- permissions duplicated in random files;
- source parsing inside prompts;
- module docs contradicting pillars.
