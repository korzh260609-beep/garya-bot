# core — SG 2.0 Core Module

> AGENT NOTE:
> This file defines the SG 2.0 core module boundary.
> Read it before adding orchestrator, request flow, module registry, or core interfaces.
> Do not put feature-specific logic, transport logic, memory logic, AI calls, or source parsing directly into core without explicit Monarch approval.

Статус: SKELETON

---

## Purpose

`core` coordinates SG flow.

It does not own module-specific business logic.

---

## Owns

- normalized request flow;
- orchestration;
- module registry interface;
- capability dispatch boundary;
- safe handoff between modules;
- error boundary shape.

---

## Must not own

- Telegram implementation;
- raw AI calls;
- database-specific memory logic;
- source fetching/parsing;
- task worker logic;
- billing calculations;
- document parsing.

---

## Main rule

```text
core coordinates modules; modules own functionality
```
