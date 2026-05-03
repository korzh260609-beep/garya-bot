# delivery — SG 2.0 Delivery Module

> AGENT NOTE:
> This file defines the SG 2.0 delivery module boundary.
> Read it before adding response formatting, report formatting, channel delivery, or outbound message sending.
> Do not let delivery own reasoning, permissions, memory, source fetching, or transport identity without explicit Monarch approval.

Статус: SKELETON

---

## Purpose

`delivery` formats and sends prepared results through approved channels.

---

## Owns

- response formatting;
- report formatting;
- delivery metadata;
- channel handoff;
- timestamp formatting rules;
- safe output packaging.

---

## Must not own

- AI reasoning;
- source fetching;
- memory decisions;
- permission policy ownership;
- task scheduling.

---

## Hard rule

Delivery sends approved content.
It must not decide protected actions by itself.
