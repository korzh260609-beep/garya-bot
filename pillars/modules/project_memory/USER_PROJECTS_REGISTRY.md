# User Projects Registry V1

> AGENT NOTE:
> This file defines the User Projects Registry V1 boundary for SG 2.0.
> Do not add Telegram commands, AI calls, Project Memory auto-writes, prompt injection, source sync, billing, or runtime generated file mutation here without explicit Monarch approval.

Статус: V1 SKELETON / REGISTRY BOUNDARY

---

## 1. Purpose

User Projects Registry V1 creates a durable project registry for user-owned projects.

It makes `userProjectId` a real project record instead of only a string embedded into Project Memory `project_key`.

Correct boundary:

```text
User Registry        -> who the user is
User Projects        -> which projects this user owns
Project Memory       -> confirmed/candidate memory scoped by project_key
```

---

## 2. Table

V1 table:

```text
sg_user_projects
```

Fields:

```text
id
owner_global_user_id
title
slug
status
visibility
metadata jsonb
created_at
updated_at
```

---

## 3. Project identity

A user project is identified by:

```text
owner_global_user_id + id
```

The related Project Memory key remains deterministic:

```text
user_project:<owner_global_user_id>:<id>
```

The registry does not infer ownership from chat text.

---

## 4. Status values

Allowed statuses:

```text
active
archived
suspended
deleted
```

V1 default:

```text
active
```

---

## 5. Visibility values

Allowed visibility values:

```text
private
shared
public_readonly
```

V1 default:

```text
private
```

Visibility is metadata for future access policy.

V1 does not expose public project reads.

---

## 6. Store boundary

Runtime code lives in:

```text
src/projects/
```

Files:

```text
src/projects/userProjectsTypes.js
src/projects/userProjectsSchema.js
src/projects/userProjectsStore.js
src/projects/index.js
```

The store may:

- normalize project fields;
- create project records;
- read project records by owner and project id;
- list projects for one owner;
- expose diagnostics/status.

The store must not:

- write Project Memory entries;
- confirm Project Memory candidates;
- call AI;
- touch Telegram;
- fetch sources;
- mutate runtime generated files;
- infer project ownership from natural language.

---

## 7. Smoke coverage

Smoke script:

```text
scripts/smokeUserProjectsRegistry.js
```

NPM command:

```text
npm run smoke:user-projects-registry
```

Smoke must prove:

- schema SQL exists;
- schema can run through an injected queryFn;
- no real PostgreSQL is required;
- project ids are normalized safely;
- `global:user-1` becomes `global-user-1` when used inside Project Memory key;
- one owner can have many projects;
- projects of different owners do not mix;
- store does not call AI/Telegram/Render/GitHub.

---

## 8. Hard no-go list

V1 does not include:

```text
DB migration runner
Telegram commands
Project Memory writes from chat
Project Memory auto-write
AI auto-write
prompt injection
source sync
cron/timers
billing
public sharing UI
```

---

## 9. Next block after V1

Only after this registry is stable, the next separate block may connect Project Memory validation to real registered user projects.

That later block must remain behind explicit boundaries and tests.
