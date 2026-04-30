# Repo Module — RISKS

Purpose:
- Document the main risk surface of the Repo module.
- Prevent quiet escalation from read-only repo understanding to unsafe repository control.
- Keep repository access bounded, source-first and reviewable.

Status: CANONICAL
Scope: Repo module risk model

---

## 0) Why this file matters

Repo tooling is dangerous because “read-only” can drift quietly.

At first it only:
- lists files
- reads selected code
- builds index

Then later it may start to:
- store too much
- expose sensitive paths
- behave like an operator rather than an inspector

This file exists to make that drift visible.

Repo tooling and RepoStateAgent are factual observers/advisors.
They are not SG itself, not SG brain, not the monarch, and not final decision makers.

---

## 1) Primary risks

### R-01: Structural index becomes archival storage
Description:
- repo index expands from metadata/safe bounded content into near-full code archive

Consequence:
- policy violation
- excessive storage
- blurred boundaries between repo, memory, and archive
- harder safety review

Signal:
- “just store all source, it is easier”
- snapshot grows beyond bounded purpose

---

### R-02: Sensitive path filtering is weak
Description:
- blocked/secret-like paths slip through or policy is inconsistently applied

Consequence:
- exposure risk
- unsafe repo surface
- trust damage

Signal:
- denied path rules are incomplete, ad hoc, or easily bypassed

---

### R-03: Read access quietly turns into write/control expectations
Description:
- repo tooling begins to imply patching, applying, or controlling code

Consequence:
- governance model weakens
- unsafe automation pressure appears
- human approval boundary erodes

Signal:
- repo review flow starts assuming apply/patch is the default next step

---

### R-04: Guarded fetch becomes broad fetch
Description:
- on-demand fetch loses its explicit/guarded nature

Consequence:
- access scope inflation
- larger blast radius
- harder review of what was actually exposed

Signal:
- broad file fetch without clear explicit path request

---

### R-05: Repo and Memory boundaries get mixed
Description:
- repository content becomes treated as general memory context

Consequence:
- wrong storage semantics
- prompt pollution
- policy drift

Signal:
- raw source bodies appear where only memory-safe curated context should exist

---

### R-06: Docs drift away from actual repo behavior
Description:
- repo rules change but pillars/module docs stay stale

Consequence:
- AI and humans work with false assumptions
- safety review quality drops
- future modifications become riskier

Signal:
- docs say one scope, runtime exposes another

---

### R-07: RepoStateAgent is mistaken for SG or decision maker
Description:
- repo observer/diagnostic tooling is treated as the system's identity, brain, or authority

Consequence:
- SG philosophy is narrowed to repository diagnostics
- final decision boundary erodes
- repo facts become confused with governance decisions

Signal:
- docs/code imply RepoStateAgent decides what SG should do rather than reports facts/risks/next-action suggestions

---

### R-08: Stale project memory is treated as current repo fact
Description:
- repo conclusions are drawn from memory/project memory instead of current repository/runtime verification

Consequence:
- wrong patch plans
- wrong stage/status claims
- false confidence

Signal:
- repo state is asserted without current fetch/search/runtime evidence when accuracy matters

---

### R-09: Patch preparation becomes mutation
Description:
- advisory diff/patch generation quietly turns into applied code changes, commits, PRs or deploys

Consequence:
- direct violation of controlled-action model
- accidental production changes
- loss of monarch/user approval boundary

Signal:
- “prepare patch” flow mutates repository or opens PR without explicit approval

---

## 2) Secondary risks

### R-10: Connector/runtime failures are misread as architecture failures
Consequence:
- wrong fixes applied to the wrong layer

### R-11: Over-blocking path policy
Consequence:
- useful repo work becomes brittle or misleading

### R-12: Under-blocking policy
Consequence:
- sensitive paths become too easy to expose

### R-13: Snapshot scope is unclear
Consequence:
- operators do not know what the index really contains

---

## 3) Dangerous assumptions

The following assumptions are dangerous:

- “read-only means low risk”
- “we can just store more source for convenience”
- “path filtering can be relaxed later”
- “repo review naturally leads to auto-fix”
- “if a file is in the repo it is safe to expose”
- “bounded indexing details are not important”
- “RepoStateAgent knows what to decide”
- “project memory is current repo state”
- “patch proposal and patch application are basically the same step”

These assumptions must be treated as risk factors.

---

## 4) Regression checks after Repo changes

After any meaningful Repo change, verify:

1. read-only boundaries still hold
2. path/sensitivity guards still work
3. snapshot scope is still bounded and explicit
4. repo content is not leaking into wrong storage layers
5. repo review remains advisory if governance says so
6. docs still match actual repo behavior
7. RepoStateAgent/repo tooling is not treated as SG or final decision maker
8. factual repo claims are based on current verification when required
9. patch preparation does not mutate repo without explicit approval

---

## 5) Risk handling strategy

Preferred defenses:

- explicit repo boundary
- strong guarded fetch rules
- structural-vs-archival distinction
- clear read-only governance
- current repo/runtime verification
- logging/diagnostics of repo access behavior
- stale-doc detection
- explicit separation between proposal and mutation

Avoid fake safety:
- silent scope widening
- undocumented exceptions
- convenience-driven archival behavior
- implied write capability
- treating advisory repo diagnostics as decision authority

---

## 6) Highest-priority rule

The most dangerous repo bug is not always an immediate leak.

The most dangerous bug is:
“the system still looks read-only, but its effective repository access has already widened beyond review.”

That is how governance erodes quietly.

A second critical bug is:
“RepoStateAgent is treated as SG instead of a factual observer/advisor.”