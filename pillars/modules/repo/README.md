# repo — SG 2.0 Repository Module

> AGENT NOTE:
> This file defines the SG 2.0 repository module boundary.
> Read it before adding repo read, repo facts, repo audit, code proposal, GitHub integration, or repo write workflows.
> Do not allow repo writes, commits, PRs, deploys, or destructive actions without explicit Monarch approval.

Статус: SKELETON

---

## Purpose

`repo` provides controlled repository access and repo facts.

---

## Owns

- repo read boundary;
- repo facts provider;
- project map source policy;
- code analysis input;
- repo audit helpers;
- patch proposal boundary.

---

## Must not own

- applying changes without approval;
- core orchestration;
- AI model calls directly;
- transport handling;
- deployment.

---

## Hard rule

Repo work is read/analyze/prepare by default.
Write actions require explicit Monarch approval.
