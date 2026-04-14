# Project Memory Module — RISKS

Purpose:
- Document the main risk surface of the Project Memory module.
- Prevent pillar/project-memory confusion, project dump behavior, and stale continuity context.
- Keep project continuity useful and subordinate to canonical governance.

Status: CANONICAL
Scope: Project Memory module risk model

---

## 0) Why this file matters

Project Memory is useful but dangerous because it feels convenient.

Common drift pattern:
- useful project note
- then more notes
- then semi-rules
- then duplicated architecture truth
- then stale conflicting project context

At that point nobody knows what the real source of truth is.

This file exists to stop that drift.

---

## 1) Primary risks

### R-01: Project Memory competes with pillars
Description:
- project memory starts storing canonical rules/decisions as if it were the real governance source

Consequence:
- source hierarchy breaks
- conflicting truths appear
- future work becomes ambiguous

Signal:
- important accepted rules exist in project memory but not in pillars

---

### R-02: Project Memory becomes a dump
Description:
- too much unstructured project content is stored

Consequence:
- low restoration quality
- noisy continuity
- hard maintenance
- weak retrieval usefulness

Signal:
- project memory stores everything “just in case”

---

### R-03: Restoration becomes unbounded
Description:
- too much project context is restored without filtering/bounds

Consequence:
- noise
- token waste
- weak continuity quality
- harder operator review

Signal:
- restoration feels like dumping everything known about the project

---

### R-04: Project Memory mixes with ordinary Memory/Chat History
Description:
- boundaries between project memory, ordinary memory, and chat history blur

Consequence:
- wrong storage semantics
- confusing retrieval paths
- harder future refactoring

Signal:
- same kind of data is stored interchangeably across layers

---

### R-05: Stale project context persists
Description:
- old project state remains stored and reused after reality changed

Consequence:
- SG reasons from outdated assumptions
- future code/docs drift increases
- operator trust drops

Signal:
- restored project context contradicts repo/runtime/pillars

---

### R-06: Docs drift from actual Project Memory behavior
Description:
- module behavior evolves but docs remain stale

Consequence:
- humans and AI work on false assumptions
- continuity logic becomes harder to trust

Signal:
- docs say one restoration/storage model, runtime behaves another way

---

## 2) Secondary risks

### R-07: Over-structuring early
Consequence:
- friction rises unnecessarily

### R-08: Under-structuring
Consequence:
- retrieval quality collapses

### R-09: Section ownership is unclear
Consequence:
- project context grows inconsistently

### R-10: Canonical-vs-working context distinction weakens
Consequence:
- governance confusion spreads

---

## 3) Dangerous assumptions

The following assumptions are dangerous:

- “it is project-related, so store it here”
- “we can clean it up later”
- “project memory can hold the rules too”
- “more restored context is always better”
- “project notes and canonical decisions are basically the same”
- “stale project state will be obvious automatically”

These assumptions must be treated as risk factors.

---

## 4) Regression checks after Project Memory changes

After any meaningful Project Memory change, verify:

1. pillars still remain canonical
2. project memory stayed structured enough
3. restoration remains bounded
4. project memory did not blur with ordinary memory/chat history
5. stale project state does not override verified reality
6. docs still match actual project-memory behavior

---

## 5) Risk handling strategy

Preferred defenses:

- explicit source hierarchy
- bounded project sections
- structured storage
- bounded restoration
- stale-context detection
- stale-doc detection

Avoid fake safety:
- convenience dumps
- duplicated canonical truth
- uncontrolled restoration
- treating project memory as “whatever is useful right now”

---

## 6) Highest-priority rule

The most dangerous Project Memory bug is not missing context.

The most dangerous bug is:
“the system restores project context confidently, but that context is stale, duplicated, or competing with pillars.”

That quietly corrupts future work.