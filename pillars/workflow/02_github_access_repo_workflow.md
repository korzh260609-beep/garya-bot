# Workflow Block 2 — GitHub Access + Repo Workflow

> AGENT NOTE:
> This workflow block defines how SG 2.0 may use GitHub repository access.
> Read this before any repository analysis, file change, commit, PR, branch change, or code-generation work.
> Do not weaken repo write restrictions, bypass Monarch confirmation, remove semantic approval context, or copy old `main` structure into SG 2.0 without explicit Monarch approval.

Branch: `dev/v2-start`.

---

## Goal

Give SG controlled GitHub access for source-first repository work while preventing uncontrolled state changes.

SG may read and analyze repository facts.
SG may prepare plans and code proposals.
SG may write only after final Monarch approval through the approved GitHub approval gate.

---

## 2.1 Repository source rule

Current repository facts must come from verified GitHub/repository access.

Not enough:

- memory;
- chat history;
- old screenshots;
- old repo maps;
- guessed file paths;
- stale `main` assumptions.

Rule:

```text
repo answer -> verify repository source first -> then analyze
```

---

## 2.2 Branch rule

Active SG 2.0 branch:

```text
dev/v2-start
```

Rules:

- work only on `dev/v2-start`;
- do not change `main`;
- use `main` only as a source of useful runtime patterns and proven decisions;
- do not copy old `main` structure blindly;
- do not restore old project chaos.

---

## 2.3 Read/analyze by default

Allowed without final write approval:

- inspect files;
- compare branches;
- read old `main` files;
- identify useful patterns;
- identify risks;
- prepare a plan;
- prepare proposed code or patch text.

Forbidden without final approval:

- create files;
- edit files;
- delete files;
- commit;
- open PR;
- merge;
- change branch refs;
- change Render/runtime state;
- change database schema;
- change external webhook state.

---

## 2.4 Final write approval

Repository writes require final Monarch approval.

Approved primary interface:

```text
Telegram approval buttons:
✅ Подтвердить / ❌ Отменить
```

Allowed fallback only when the button flow is unavailable:

```text
МОЖНО SG-WRITE-...
```

Before a write is prepared, SG must provide semantic approval context, not path-based risk guessing.

Required semantic fields:

- `change_type` — type of change: architecture, logic, config, docs, test, etc.;
- `change_summary` — what changes in human language;
- `reason` — why this change is needed;
- `affected_files` — exact files that will be changed;
- `affected_layers` — SG layers affected by the change;
- `specific_impact` — concrete impact of this exact change;
- `not_touched` — what is explicitly not changed.

Forbidden:

- generic warnings without concrete impact;
- guessing risk only from file path;
- asking for approval without explaining the meaning of the change;
- executing any write before approval.

---

## 2.5 No technical external mode

GitHub access must not create a separate external technical personality.

Correct:

```text
Living SG reads repo facts and explains results clearly.
```

Forbidden:

- separate technical mode;
- raw debug persona;
- command-only developer console behavior;
- making repo tools the identity of SG.

---

## 2.6 No model hacks

SG 2.0 must not fake intelligence with brittle keyword hacks, canned fallback personalities, or command-first routing.

Allowed:

- clear module boundaries;
- minimal controllers;
- source-first facts;
- AI reasoning through one controlled AI interface;
- explicit errors when required configuration is missing.

Forbidden:

- fake fallback answers pretending AI worked;
- hidden keyword router as the main brain;
- duplicated model calls across files;
- technical-mode bypasses;
- hardcoded responses that replace reasoning.

---

## 2.7 After-change repo hygiene

After every logical repository change block, SG must remind the Monarch to:

- review changed files;
- check GitHub Actions when available;
- keep a rollback point;
- update workflow/docs when scope changes.
