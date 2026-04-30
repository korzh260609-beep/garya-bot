# Sources Module — README

Purpose:
- Define the Sources module as a stable responsibility domain.
- Fix what belongs to source fetching, normalization, and diagnostics.
- Prevent source logic from becoming chaotic, implicit, or tightly coupled.
- Keep source usage aligned with source-first and controlled-action rules.

Status: CANONICAL
Scope: Sources logical module

This file must be interpreted together with:

- `pillars/DECISIONS.md`
- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/architecture/DATA_FLOW.md`
- `pillars/architecture/PERMISSIONS_MAP.md`

If this file conflicts with `pillars/DECISIONS.md`, `DECISIONS.md` has priority.

---

## 0) Module purpose

The Sources module is responsible for:

- fetching data from configured sources
- normalizing source payloads
- diagnosing source health and failures
- exposing bounded source data to the rest of SG
- preserving source-first behavior

This module exists to ensure SG works from real sources before analysis.

Sources provide facts/data to SG. Sources are not SG itself and not SG philosophy source.

---

## 1) In scope

Sources includes responsibilities such as:

- source registration/config usage
- source fetch execution
- provider-specific adapters
- source normalization
- source diagnostics
- source rate-limit awareness
- source permission-aware access surfaces
- source runtime limitation handling
- source metadata, TTL, uncertainty and failure-state preservation

Typical related code areas may include:
- source provider modules
- source fetch helpers
- diagnostics for source runs
- normalized source payload builders
- source registry access

---

## 2) Out of scope

The Sources module must NOT own:

- transport parsing
- permission policy itself
- memory semantics
- business feature decisions unrelated to source acquisition
- raw AI reasoning over source payloads as a hidden substitute for normalization
- repository indexing logic
- SG philosophy, identity, governance, or accepted decisions

Also out of scope:
- becoming a dumping ground for arbitrary external logic
- bypassing source-first discipline with ad hoc manual assumptions
- becoming the decision maker over what should be done with source data

---

## 3) Core idea

Sources must let SG answer:

- what source is available?
- can the source be fetched now?
- what did it return?
- was it normalized?
- did it fail, and why?
- what is the confidence/freshness/limit of this source result?

Sources must make runtime reality explicit.

---

## 4) Core responsibilities

The Sources module is responsible for:

1. obtaining data from configured sources
2. normalizing source-specific payloads
3. exposing bounded source results
4. reporting source health/failures
5. preserving source-specific limits and constraints
6. preventing hidden assumptions about unavailable data
7. preserving metadata, freshness, uncertainty and failure visibility

---

## 5) Hard invariants

The following invariants must hold:

- source access must remain explicit
- provider-specific logic must stay modular
- runtime source failure must remain visible
- normalization must happen before higher-level usage where required
- AI must not be used as a hidden replacement for missing source discipline
- unavailable source data must not be silently invented
- source access must not bypass permission/private-scope rules
- raw provider payload must not be pushed downstream where normalized shape is required

---

## 6) Controlled-action rule

Source operations must distinguish:

```text
read-only fetch
analysis-only source interpretation by downstream modules
state-changing source config/update
private/source-owned data access
expensive/costly source crawl or large fetch
```

Rules:
- source reads must respect role/user/project/source scope;
- source config changes are state-changing actions;
- private or costly source operations require gates/confirmation where configured;
- denied source access may still allow explanation of limits or prepare-only plan.

---

## 7) Relationship to analysis

Sources provides data.

Sources does not automatically own:
- final interpretation
- business conclusions
- user-facing strategy decisions

Important distinction:

- source result = what data says
- later module logic = what to do with it

This distinction must remain hard.

---

## 8) Relationship to adjacent modules

Sources is closely related to:

- Bot
- Users / Access
- Logging / Diagnostics
- Tasks
- AI Routing
- domain-specific features such as trading or reports

But Sources does not own those modules.

It owns source acquisition and normalization boundaries.

---

## 9) Examples of what Sources may do

Allowed examples:

- fetch RSS feed
- fetch HTML page
- call CoinGecko endpoint
- call OKX public endpoint
- normalize returned source payload
- record source diagnostics/failure state
- expose source test/diagnostic surfaces
- preserve source metadata and failure reason

These are source responsibilities.

---

## 10) Examples of what Sources must not do

Forbidden examples:

- invent missing data because provider failed
- hide runtime source restrictions
- push raw uncontrolled payload directly into downstream reasoning without normalization where required
- turn source modules into general business logic modules
- silently replace source failure with guesswork
- bypass permission/source-scope/private-data checks
- let source availability redefine SG philosophy or roadmap

These break source-first reliability.

---

## 11) Ownership rule

If the question is:
- how to fetch a source
- how to normalize its payload
- how to diagnose source failure
- how to respect provider/runtime limitations

it belongs here.

If the question is:
- what the data means strategically
- whether the user may access it
- how it should be stored in memory
- what AI model should explain it
- whether a protected action should happen from the data

then it belongs elsewhere or must be shared with adjacent modules.

---

## 12) Final rule

Sources exists so SG reasons from reality, not from guesses.

If source behavior becomes implicit or sloppy,
everything built on top of it becomes less trustworthy.

If Sources becomes a decision/governance layer,
the module boundary is broken.