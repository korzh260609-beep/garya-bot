# tasks — SG 2.0 Tasks Module

> AGENT NOTE:
> This file defines the SG 2.0 tasks module boundary.
> Read it before adding one-time tasks, scheduled tasks, workers, reminders, reports, or automation.
> Do not let tasks bypass permissions, cost checks, source requirements, or user confirmation rules without explicit Monarch approval.

Статус: SKELETON

---

## Purpose

`tasks` manages one-time and scheduled work.

---

## Owns

- task model boundary;
- task lifecycle;
- scheduling interface;
- worker handoff;
- report generation requests;
- task status and logs.

---

## Must not own

- transport-specific delivery;
- raw AI calls;
- source fetching internals;
- permission policy ownership;
- user identity root.

---

## Hard rule

Automated tasks must be source-first when facts are needed and must respect permissions/cost limits.
