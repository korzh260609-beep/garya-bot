# SG 2.1 ROADMAP — BLOCK 4: ACTION GATE

## Goal
Authorize, block or downgrade a selected action using explicit policy checks.

## Deliverables
- action classes
- ActionRequest contract
- identity and permission checks
- scope validation
- risk and cost policy
- confirmation policy
- idempotency
- audit decision output

## Acceptance criteria
- The gate never interprets user meaning.
- Blocked execution can become analysis, simulation or prepare-only output.
- No protected action bypasses the gate.
