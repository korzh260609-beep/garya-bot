# PERMISSIONS_MAP.md — SG 2.0 Permissions Map

> AGENT NOTE:
> This file defines the high-level permission and capability boundaries for SG 2.0.
> Read it before adding roles, access checks, confirmations, billing limits, repo actions, memory access, or admin operations.
> Do not grant state-changing authority without explicit Monarch approval.

Статус: ACTIVE SKELETON

---

## Core idea

Permissions protect actions.
They do not limit SG thinking.

SG may analyze and propose broadly.
SG may act only within permission and confirmation rules.

---

## Base roles

Initial planned roles:

- `guest` — default limited user.
- `citizen` — approved Kingdom/user role.
- `monarch` — Gary / GARY, owner of SG.
- `system` — internal service role.

---

## Capability categories

1. Always safe:
   - think;
   - explain;
   - analyze;
   - suggest.

2. Controlled read:
   - read memory;
   - read sources;
   - read repo;
   - read task state.

3. Proposal-only:
   - prepare code;
   - prepare patch;
   - prepare workflow change;
   - prepare architecture plan.

4. State-changing:
   - write repo;
   - change memory;
   - create/update/delete task;
   - change config;
   - deploy;
   - send external message;
   - change billing/access.

---

## Hard rule

State-changing actions require permission and confirmation.

Repository writes require explicit Monarch approval.

---

## Future interface

Target function shape:

```text
can(user, capability, context) -> allowed / denied / needs_confirmation
```
