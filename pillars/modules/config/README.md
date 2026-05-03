# config — SG 2.0 Config Module

> AGENT NOTE:
> This file defines the SG 2.0 config module boundary.
> Read it before adding env parsing, feature flags, runtime settings, model config, or role/plan limits.
> Do not scatter magic constants across the codebase or change Render/runtime contract without explicit Monarch approval.

Статус: SKELETON

---

## Purpose

`config` centralizes settings and feature flags.

---

## Owns

- env reading helpers;
- feature flags;
- runtime mode flags;
- model config references;
- safe defaults;
- config validation.

---

## Must not own

- business logic;
- permission decisions;
- AI execution;
- transport handlers;
- database mutation logic.

---

## Hard rule

Render-compatible env names must not change without explicit Monarch approval.
