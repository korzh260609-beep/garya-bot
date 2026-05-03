# pillars/architecture — SG 2.0 Architecture Index

> AGENT NOTE:
> This folder contains active architecture documents for SG 2.0.
> Read this file after `pillars/DECISIONS.md`, `pillars/SG_ENTITY.md`, `pillars/SG_BEHAVIOR.md`, and `pillars/PROJECT.md`.
> Do not add architecture documents that contradict the clean SG 2.0 foundation or recreate old main chaos without explicit Monarch approval.

Статус: ACTIVE

---

## Purpose

`pillars/architecture/` defines the high-level boundaries of SG 2.0 architecture.

It does not contain implementation code.
It does not replace `docs/sg-core.md`.
It explains the rules that future code must follow.

---

## Core principle

```text
SG = global project system / Советник GARYA
components = organs, channels, instruments, modules, or subsystems of SG
AI model = reasoning/intelligence layer, not SG itself
core = coordinator, not feature dump
```

---

## Active documents

1. `SG_INTERFACE_LAYERS.md` — transport/interface boundaries.
2. `SEMANTIC_ROUTING.md` — meaning-first routing and minimal controller rule.
3. `MODULE_MAP.md` — logical module map.
4. `DATA_FLOW.md` — high-level data flow.
5. `PERMISSIONS_MAP.md` — permissions/capabilities map.
6. `CODE_OWNERSHIP_MAP.md` — ownership boundaries for future code areas.
7. `REPO_MAP_SOURCE_POLICY.md` — source policy for repo facts.
8. `AGENT_DIRECTORY_STRUCTURE.md` — future agent folder principles.
9. `REPO_MAINTENANCE_AGENT_SKELETON.md` — future repo maintenance auditor skeleton.
10. `SG_CAPABILITY_ACCESS.md` — capability exposure rules.

---

## Reading order

1. `pillars/DECISIONS.md`
2. `pillars/SG_ENTITY.md`
3. `pillars/SG_BEHAVIOR.md`
4. `pillars/PROJECT.md`
5. `pillars/architecture/README.md`
6. relevant architecture file

---

## Hard guardrails

- Do not turn `index.js` into a monolith.
- Do not put module logic into core.
- Do not make Telegram the identity root of SG.
- Do not treat commands as SG intelligence.
- Do not build a heavy router that replaces model reasoning.
- Do not perform state-changing actions without permission.
- Do not copy old `main` structure blindly.
- Do not create documents that depend on missing old files unless adapted for SG 2.0.
