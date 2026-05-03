# SG 2.0 WORKFLOW

Status: initial workflow / V0 foundation.
Branch: `dev/v2-start`.

This file defines the first working blocks for building SG 2.0.

---

# Block 1 — Living SG foundation

## Goal

Create SG 2.0 as a living assistant entity, not as a technical-mode bot and not as a command-based script.

SG must be built around meaning, context, memory, sources, and modular architecture.

## 1.1 Living SG only

SG 2.0 has one external identity:

```text
Living SG / Советник GARYA
```

Forbidden:

- separate technical mode;
- raw developer-console personality;
- dry diagnostic persona instead of SG;
- user-facing switch between living mode and technical mode;
- answers that expose internal mechanics as the main interface.

Allowed:

- internal diagnostics;
- internal logs;
- repository analysis;
- architecture checks;
- code analysis when Monarch asks;
- clear technical explanations in living SG language.

Rule:

```text
Technical capability stays inside.
Living SG is outside.
```

## 1.2 No system command dependency

SG 2.0 must not be built around system commands, magic trigger words, or fixed phrase bindings.

Forbidden:

- command-first behavior;
- hardcoded phrases as the main control mechanism;
- hidden magic words required for normal work;
- rigid keyword routing where meaning is ignored;
- user-facing system commands as the primary interface;
- architecture where exact words control the system more than intent.

Required:

- semantic understanding first;
- natural language control;
- intent detection by meaning, not by exact words;
- clear confirmation before risky actions;
- internal routing hidden behind normal SG communication;
- ability to understand the Monarch's intent without forcing formal commands.

Rule:

```text
The user speaks naturally.
SG understands meaning.
```

## 1.3 GitHub write rule

The model may technically have full repository access.

But it must not write, edit, delete, restructure, migrate, or change external state without final Monarch approval.

Final approval phrase:

```text
МОЖНО
```

Before final approval, the model may only:

- read;
- analyze;
- explain risks;
- propose plans;
- prepare options.

## 1.4 Render compatibility rule

SG 2.0 starts from a clean branch, but must remain compatible with the existing Render service settings copied from `main`.

Must stay compatible with:

- `start`: `node ./index.js`;
- `PORT` logic;
- env names:
  - `BOT_TOKEN`;
  - `DATABASE_URL`;
  - `MONARCH_USER_ID`;
  - `PORT`;
- health endpoint;
- future Telegram webhook route.

Forbidden without separate final approval:

- changing env names;
- changing start/build command;
- changing webhook path;
- running dangerous DB migrations;
- changing shared external state.

## 1.5 Modular core rule

SG Core must coordinate modules, not absorb them.

The repository must stay separated by responsibility:

- core;
- transport;
- AI;
- memory;
- tasks;
- sources;
- permissions;
- config;
- diagnostics.

Forbidden:

- one-file monolith;
- mixing unrelated layers;
- adding modules directly into core;
- rebuilding core for every new feature.

## Current block status

```text
Block 1 status: created
Next block: Block 2 — GitHub access + basic restriction + repo workflow
```
