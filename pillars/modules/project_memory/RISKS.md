# project_memory RISKS

> AGENT NOTE:
> This file defines known risks for the SG 2.0 Project Memory module.
> Read it before adding project memory storage, sync, confirmation, restore, context building, diagnostics, or project experience logic.
> Do not add runtime implementation, Telegram coupling, AI calls, automatic writes, raw logs, raw provider IDs, timers, cron, or secret handling here without explicit Monarch approval.

Статус: SKELETON / DOCS-ONLY

---

## 1. Core risk

Project Memory is powerful because it can influence future project work.

The main risk is simple:

```text
bad memory → bad context → bad decision → bad code/project direction
```

Therefore Project Memory must be controlled, bounded, source-aware, and conflict-aware.

---

## 2. Garbage memory

Risk:

Unimportant, temporary, duplicated, or low-quality notes become durable project context.

Damage:

- noisy restores;
- confused next steps;
- wasted tokens;
- repeated false warnings;
- project drift.

Controls:

- only confirmed project-level entries;
- entry type taxonomy;
- duplicate checks;
- stale/archive status;
- bounded context builder;
- diagnostics for memory quality.

---

## 3. False facts

Risk:

SG stores a claim as fact even though it was only a guess, outdated chat context, or incorrect inference.

Damage:

- wrong architecture decisions;
- false repo assumptions;
- broken workflow;
- unsafe PR plans.

Controls:

- source metadata required;
- confidence required;
- explicit confirmation for durable writes;
- source-of-truth hierarchy;
- conflict checks against pillars/repo/runtime facts.

---

## 4. Self-write loop

Risk:

SG writes its own generated text into Project Memory, later reads it, trusts it, and amplifies the same mistake.

Damage:

- hallucination becomes persistent;
- memory becomes self-reinforcing;
- AI guesses look like project law.

Controls:

- no AI direct durable writes;
- AI output can only create candidates unless explicitly trusted;
- confirmation gate;
- trace every write attempt;
- separate candidate vs confirmed memory.

---

## 5. Secret leakage

Risk:

Secrets, tokens, env values, private IDs, raw logs, provider IDs, or private transport identifiers enter Project Memory.

Damage:

- security breach;
- accidental exposure in context;
- unsafe diagnostics;
- loss of trust.

Controls:

- secret scan before write;
- raw log ban;
- raw provider ID ban;
- private transport ID ban;
- redaction policy;
- fail closed on suspicious content.

---

## 6. Stale context

Risk:

Old Project Memory remains active after repo, runtime, workflow, or Monarch decisions changed.

Damage:

- wrong next step;
- stale warnings;
- incorrect PR scope;
- conflict with current architecture.

Controls:

- status values: active, stale, superseded, archived;
- updated_at metadata;
- source_ref metadata;
- stale detection diagnostics;
- conflict detection against current sources;
- context builder warnings.

---

## 7. Source-of-truth inversion

Risk:

Project Memory is treated as stronger than pillars, verified repo facts, verified runtime facts, or current Monarch instruction.

Damage:

- memory overrides law;
- project loses governance;
- old summaries beat real files;
- unsafe changes appear justified.

Controls:

- explicit authority order;
- context labels;
- conflict warnings;
- hard rule: memory supports, sources verify;
- never use Project Memory as sole evidence for code changes.

---

## 8. Unbounded prompt injection

Risk:

Too much Project Memory or raw history is inserted into prompts.

Damage:

- token waste;
- instruction conflicts;
- increased hallucination risk;
- hidden stale context dominates current task.

Controls:

- max_entries;
- max_chars;
- context depth control;
- no raw unlimited history;
- label memory as support context;
- prefer compact active entries.

---

## 9. Bad sync

Risk:

A sync process imports too much, imports from weak sources, or writes without review.

Damage:

- memory pollution;
- hidden state changes;
- duplicate entries;
- false confidence.

Controls:

- allowlisted source types;
- candidates first unless trusted path;
- no autonomous sync without approval;
- sync result diagnostics;
- source references instead of raw content copies.

---

## 10. Runtime coupling

Risk:

Project Memory becomes coupled to Telegram, GitHub, Render, Observation, or AI provider internals.

Damage:

- broken modularity;
- transport dependency;
- hard-to-test memory;
- future client limitations.

Controls:

- transport-agnostic contracts;
- source interfaces outside Project Memory;
- Project Memory owns memory logic only;
- no Telegram handlers inside module core;
- no provider-specific IDs stored in durable memory.

---

## 11. Silent overwrite

Risk:

A new write replaces or mutates an active entry without preserving history.

Damage:

- lost decisions;
- unclear why context changed;
- difficult rollback;
- audit failure.

Controls:

- no blind overwrite;
- supersede/archive path;
- update trace;
- previous entry reference;
- conflict review before update.

---

## 12. Personal/project memory mixing

Risk:

Personal user memory, chat memory, group memory, and project memory get mixed.

Damage:

- privacy issues;
- wrong attribution;
- polluted project context;
- unsafe cross-user recall.

Controls:

- strict project_key/module_key/stage_key scope;
- no personal memories in Project Memory;
- no raw group chat in Project Memory;
- user/project scope checks;
- privacy diagnostics before future consumers.

---

## 13. Capability snapshot misuse

Risk:

Generated project capability/status snapshots are treated as live truth.

Damage:

- SG explains outdated abilities;
- stale status drives wrong work;
- snapshot replaces repo/runtime verification.

Controls:

- snapshots are support context only;
- snapshots must include generated_at and source_ref;
- refresh from repo/runtime evidence;
- stale warning when old;
- never use snapshot as sole authority.

---

## 14. Minimum safety gate before runtime

Before any runtime implementation, define and approve:

1. Storage schema.
2. Entry taxonomy.
3. Confirmation policy.
4. Permission policy.
5. Conflict policy.
6. Redaction/secret policy.
7. Context size limits.
8. Diagnostics format.
9. Write trace/audit path.
10. Smoke tests.

Until then, Project Memory remains docs-only skeleton.

---

## 15. Final safety rule

Project Memory must make SG safer and more consistent, not more autonomous and uncontrolled.

Correct:

```text
memory supports continuity
sources verify truth
pillars define laws
monarch decides direction
```

Incorrect:

```text
memory silently writes itself
memory overrides pillars
memory stores raw logs
memory stores secrets
memory becomes hidden autonomous control
```
