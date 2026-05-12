# observation — SG 2.0 Observation Nervous System

> AGENT NOTE:
> This file defines the SG 2.0 Observation Nervous System module boundary.
> Read it before adding observation events, latest reports, health checks, trigger dispatch, journal storage, monitoring, or self-diagnostics.
> Do not add Telegram integration, AI calls, memory writes, raw logs, raw provider IDs, timers, cron, autonomous actions, or secret exposure here without explicit Monarch approval.

Статус: ACTIVE V1 / PARTIAL RUNTIME

---

## 1. Purpose

The Observation Nervous System is SG 2.0's internal sensing layer.

Its purpose is to let SG notice important internal events, convert them into sanitized observation reports, and verify that the observation journal itself is healthy.

In simple terms:

```text
SG action/event → safe observation event → latest report → health check → next diagnostic signal
```

This is not the whole SG.

It is one module that helps SG understand what happened inside the project runtime and repository workflows.

---

## 2. Why this module exists

Without this module, SG only reacts to the current user message or direct tool output.

With this module, SG gains a controlled internal feedback loop:

- important events become structured facts;
- reports are sanitized before storage;
- the latest operational state can be checked quickly;
- missing/invalid reports become visible;
- future diagnostics can rely on machine-readable runtime facts instead of guessing.

---

## 3. What V1 currently does

V1 proves the minimal working loop:

```text
GitHub PR merge
→ Repo Commit Watcher
→ github.pr_merged dispatch event
→ Observation Trigger Dispatch Agent
→ runtime-status-latest
→ diagnostics-latest
→ observation-journal-health-latest
→ health OK when expected reports exist
```

Current V1 latest reports:

```text
runtime/observation/latest/runtime-status-latest.json
runtime/observation/latest/diagnostics-latest.json
runtime/observation/latest/observation-journal-health-latest.json
```

Current health target:

```text
Observation journal health OK: 2/2 reports available.
```

---

## 4. Main components

### 4.1 Event schema

Responsible for defining the safe observation event shape.

Expected properties:

- schema version;
- event id;
- event type;
- source;
- actor;
- direction;
- summary;
- payload;
- tool metadata;
- policy;
- links.

Hard rule:

Observation events must be sanitized and must not store secrets, raw logs, raw provider IDs, or private transport identifiers.

---

### 4.2 Observation producer

Responsible for building and validating observation events before writing them.

Current role:

- accepts event input;
- validates event shape;
- rejects secret/unsafe actor references;
- writes latest-only reports through the writer.

---

### 4.3 Observation writer

Responsible for writing sanitized observation reports to runtime paths.

Current V1 path family:

```text
runtime/observation/latest/*.json
```

Hard rule:

Writer is an IO boundary only. It must not own business logic, AI reasoning, Telegram logic, diagnostics orchestration, or autonomous behavior.

---

### 4.4 Observation reader

Responsible for reading existing observation latest reports.

Used by:

- journal health checks;
- diagnostics checks;
- future status/report commands.

---

### 4.5 Observation triggers

Responsible for exposing a small allowlisted trigger registry.

Current trigger examples:

```text
diagnostics.finished
runtime.status_requested
observation.journal_health_requested
```

Hard rule:

Only allowlisted triggers can run. No free-form arbitrary execution.

---

### 4.6 Observation Trigger Dispatch Agent

Responsible for routing bounded internal dispatch events to allowlisted observation triggers.

Current dispatch event examples:

```text
github.pr_merged
github.ci_finished
diagnostics.requested
runtime.status_requested
observation.journal_health_requested
```

Hard rule:

Dispatch Agent reacts only to explicit bounded events. It is not a timer, not a bot command handler, and not an autonomous worker.

---

### 4.7 Journal health bridge

Responsible for checking whether expected observation reports exist and are readable.

Current V1 expected reports:

```text
diagnostics-latest
runtime-status-latest
```

Current output:

```text
observation-journal-health-latest
```

---

### 4.8 Runtime status bridge

Responsible for producing a sanitized runtime status observation.

It must only expose safe public runtime facts.

---

### 4.9 Diagnostics observation bridge

Responsible for converting sanitized diagnostics results into observation events.

It must not copy raw diagnostics payloads into observation reports.

---

### 4.10 GitHub Actions connection

Current GitHub Actions connection:

```text
.github/workflows/repo-commit-watcher.yml
```

Current role:

- watches new commits on `dev/v2-start`;
- updates repo latest state;
- detects PR merge commit messages;
- dispatches `github.pr_merged` to the Observation Trigger Dispatch Agent.

Supported merge message formats:

```text
Merge PR
Merge pull request
```

---

## 5. What this module owns

The observation module owns:

- sanitized observation event schema;
- latest-only observation reports;
- observation runtime paths;
- observation reader/writer boundaries;
- trigger registry for observation producers;
- dispatch mapping from safe internal events to observation triggers;
- observation journal health report;
- safe health snapshots for internal diagnostics.

---

## 6. What this module must not own

The observation module must not own:

- Telegram message handling;
- user-facing personality;
- AI reasoning or model calls;
- long-term memory writes;
- raw logs storage;
- raw provider IDs;
- Render secret inventory;
- business logic;
- permission policy ownership;
- deployment control;
- autonomous timers/cron.

---

## 7. Current V1 implementation status

Implemented:

- observation event schema;
- latest report writer;
- latest report reader;
- observation producer;
- runtime status observation bridge;
- diagnostics observation bridge;
- observation journal health bridge;
- observation trigger registry;
- observation trigger runner;
- observation trigger dispatch registry;
- observation trigger dispatch CLI runner;
- GitHub PR merge dispatch from Repo Commit Watcher;
- latest reports for runtime status, diagnostics, and journal health;
- rollback point after health reached 2/2 OK.

Current rollback branch:

```text
rollback/sg2-observation-health-ok-20260512
```

---

## 8. Current limitations

V1 is intentionally narrow.

Current limitations:

- latest-only storage; no historical observation journal yet;
- no timeline view;
- no event correlation graph;
- no severity levels beyond basic report status;
- no alert routing;
- no UI/dashboard;
- no persistent observation database table;
- no automatic anomaly detection;
- no multi-transport observation intake;
- no user-facing command/report layer;
- no advanced retention policy;
- no explicit event deduplication;
- no full CI/deploy correlation;
- no memory candidate pipeline.

---

## 9. Final target system

The final Observation Nervous System should become SG's safe internal telemetry and self-awareness layer.

Final target:

```text
Every important SG runtime event is safely observed, classified, stored, connected to context, and made available for diagnostics and future reasoning without leaking private data or mutating unrelated systems.
```

Final system should include:

1. Event intake layer
   - GitHub events;
   - Render events;
   - diagnostics events;
   - runtime health events;
   - task engine events;
   - source layer events;
   - AI tool events;
   - permission/security events;
   - delivery/transport events;
   - user-safe interaction summaries where allowed.

2. Event schema V2+
   - stable event ids;
   - severity;
   - category;
   - component/module;
   - correlation id;
   - parent event id;
   - privacy level;
   - retention class;
   - source confidence;
   - replay safety flag.

3. Storage model
   - latest reports for quick status;
   - append-only sanitized journal;
   - optional PostgreSQL observation_events table;
   - retention rules;
   - pruning rules;
   - event snapshots.

4. Health and diagnostics
   - module-level health;
   - workflow health;
   - deploy health;
   - source health;
   - task engine health;
   - AI layer health;
   - permission layer health;
   - observation self-health.

5. Correlation layer
   - connect PR → commit → Actions run → Render deploy → logs → observation reports;
   - connect user command → tool call → result → report;
   - connect failure → rollback point → fix PR.

6. Safety layer
   - sanitization;
   - secret filtering;
   - private user data filtering;
   - raw provider ID removal;
   - permission checks;
   - explicit Monarch approval for risky expansions.

7. Reporting layer
   - latest status reports;
   - degraded/OK summaries;
   - module dashboards;
   - human-readable diagnostics;
   - machine-readable facts for SG.

8. Future reaction layer
   - recommend next safe action;
   - create issue/PR plan only after approval;
   - never auto-fix production without Monarch approval;
   - V7+ auditor mode only unless explicitly authorized.

---

## 10. What still needs to be done

Next required work blocks:

1. Add formal observation module docs
   - README.md;
   - CONTRACTS.md;
   - RISKS.md;
   - CHANGELOG.md.

2. Add smoke coverage for PR merge dispatch condition
   - verify `Merge PR`;
   - verify `Merge pull request`.

3. Add explicit tests for journal health 2/2 path
   - diagnostics-latest exists;
   - runtime-status-latest exists;
   - journal health summary is OK.

4. Add observation latest report index
   - list expected reports;
   - define required vs optional reports;
   - avoid hardcoded report names spread across files.

5. Add severity and status taxonomy
   - OK;
   - degraded;
   - failed;
   - unknown;
   - stale.

6. Add stale-report detection
   - detect old reports;
   - mark stale without deleting.

7. Add append-only journal skeleton
   - design only first;
   - no DB write until approved.

8. Add event correlation design
   - PR/commit/run/deploy/log/report links.

9. Add privacy review
   - confirm no raw logs;
   - confirm no secrets;
   - confirm no private transport IDs;
   - confirm no memory writes.

10. Add user-facing diagnostics summary later
   - only after transport-independent interface is defined.

---

## 11. Safe action classes

Read-only:

- read latest reports;
- read health summary;
- inspect sanitized observation events.

Prepare-only:

- prepare documentation;
- prepare PR plans;
- prepare test proposals.

State-changing:

- write latest reports;
- create/update runtime observation files;
- create GitHub branches/PRs.

Forbidden without explicit approval:

- production code mutation;
- secrets handling;
- raw logs storage;
- autonomous actions;
- timers/cron;
- memory writes;
- Telegram coupling;
- AI calls inside observation producers.

---

## 12. Current success criterion

V1 is considered operational when:

```text
observation-journal-health-latest.json → Observation journal health OK: 2/2 reports available.
```

This condition has been reached on `dev/v2-start` and protected by rollback branch:

```text
rollback/sg2-observation-health-ok-20260512
```

---

## 13. Design rule

Observation is a nervous system, not the brain.

Correct:

```text
Observation senses and reports.
Diagnostics interprets checks.
Core orchestrates.
AI explains when explicitly called.
Memory stores only through approved memory interfaces.
```

Incorrect:

```text
Observation decides business actions.
Observation calls AI by itself.
Observation writes memory by itself.
Observation becomes Telegram-dependent.
Observation becomes a cron worker without approval.
```
