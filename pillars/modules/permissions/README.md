# permissions — SG 2.0 Permissions Module

> AGENT NOTE:
> This file defines the SG 2.0 permissions module boundary.
> Read it before adding roles, capabilities, confirmations, access gates, admin checks, or protected actions.
> Do not allow state-changing actions, private-data access, repo writes, or governance changes without explicit Monarch-approved permission rules.

Статус: SKELETON

---

## Purpose

`permissions` decides whether a user may access a capability or perform an action.

---

## Owns

- roles;
- capability checks;
- confirmation requirements;
- protected action gates;
- user/project scope checks;
- future `can(user, capability, context)` interface.

---

## Must not own

- transport handling;
- AI reasoning;
- memory storage;
- source fetching;
- business logic implementation.

---

## Hard rule

Permissions protect actions and data.
They do not block SG from thinking, analyzing, warning, or preparing non-applied plans.
