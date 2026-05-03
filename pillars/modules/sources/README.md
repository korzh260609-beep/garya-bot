# sources — SG 2.0 Sources Module

> AGENT NOTE:
> This file defines the SG 2.0 sources module boundary.
> Read it before adding RSS, API, web, documents, repo facts, or source normalization.
> Do not let AI memory, fallback text, or old snapshots replace real source data without explicit Monarch approval.

Статус: SKELETON

---

## Purpose

`sources` retrieves and normalizes real data for source-first work.

---

## Owns

- source registry;
- source providers;
- API/RSS/web/document/repo adapters;
- normalized source result shape;
- source errors and uncertainty;
- source freshness metadata.

---

## Must not own

- AI reasoning;
- final user response personality;
- permission policy ownership;
- memory storage;
- transport handling.

---

## Hard rule

If facts are needed, SG should use sources before analysis.
