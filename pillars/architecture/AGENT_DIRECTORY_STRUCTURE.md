# AGENT_DIRECTORY_STRUCTURE.md — Future SG Agent Structure

> AGENT NOTE:
> This file defines future folder principles for SG 2.0 agents.
> Read it before creating agent folders, repo agents, diagnostics agents, maintenance agents, or source agents.
> Do not hide one agent inside another agent folder or treat an agent as SG itself without explicit Monarch approval.

Статус: FUTURE SKELETON

---

## Core rule

Agents are components of SG.
They are not separate SG entities.

---

## Future structure idea

```text
src/agents/
  repo-intelligence/
  repo-maintenance/
  runtime-diagnostics/
  source-intelligence/
  user-product/
  shared/
```

This is a future structure, not a command to implement now.

---

## Agent rules

- one agent = one responsibility;
- no hidden nested agent ownership;
- agents must connect through core/registry/contracts;
- agents must respect permissions and confirmations;
- agents start read-only unless explicitly approved otherwise;
- agents must not bypass SG Core.

---

## Early SG 2.0 status

No agent folders should be created in code until the related module skeleton is approved.
