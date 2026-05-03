# billing — SG 2.0 Billing Module

> AGENT NOTE:
> This file defines the future SG 2.0 billing/AI credits module boundary.
> Read it before adding balances, plans, credits, usage accounting, pricing, cost warnings, or downgrade logic.
> Do not expose internal provider costs, markup, private accounting, or billing controls without explicit Monarch approval.

Статус: FUTURE SKELETON

---

## Purpose

`billing` will manage user balances, AI credits, plan limits, usage logs, and cost warnings.

---

## Owns

- user balance boundary;
- credit accounting;
- usage logs;
- plan limits;
- cost warning thresholds;
- reconciliation checks;
- future payment integration boundary.

---

## Must not own

- AI execution itself;
- user identity root;
- transport handling;
- permission policy ownership;
- source fetching.

---

## Hard rule

Billing must be transparent to users about their own balance and usage, but internal provider cost and markup policy remain project-controlled unless Monarch decides otherwise.
