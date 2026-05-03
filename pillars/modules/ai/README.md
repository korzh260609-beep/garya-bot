# ai — SG 2.0 AI Module

> AGENT NOTE:
> This file defines the SG 2.0 AI module boundary.
> Read it before adding model calls, model config, AI routing, cost tracking, prompt assembly, or reasoning wrappers.
> Do not scatter direct model calls across the codebase or treat the AI operator as SG itself without explicit Monarch approval.

Статус: SKELETON

---

## Purpose

`ai` provides one controlled interface to AI models.

---

## Owns

- AI wrapper/router;
- model selection policy;
- prompt assembly boundary;
- cost level metadata;
- token/cost logging shape;
- fallback/error handling for model calls.

---

## Must not own

- source fetching;
- memory storage;
- transport handling;
- permission policy ownership;
- task scheduling.

---

## Hard rule

All AI calls must go through one controlled interface.
