# SG 2.1 ROADMAP — BLOCK 8: INTERFACES

## Goal
Expose one SG core through thin, replaceable transports.

## Deliverables
- transport adapter contract
- local test harness
- Telegram adapter
- Web/API adapter
- Discord adapter
- future email and voice adapters

## Production extensions

### Block 8.1 — Discord Transport Integration

Block 8.1 turns the existing contract-level Discord adapter into a real production Discord transport without creating a separate SG instance, identity system, memory subsystem, AI path or permission model.

It adds the live Discord Gateway/REST connection, durable event deduplication, production Discord identity resolution and verified cross-platform Global ID linking, Discord delivery through the existing Delivery Router, scope/resource isolation, observability, diagnostics, regression tests and live acceptance evidence.

Canonical specification: `08_1_DISCORD_TRANSPORT_INTEGRATION.md`.

Block 8.1 is an extension of Block 8 and does not renumber Blocks 9–19.

## Acceptance criteria
- Every transport creates CanonicalRequest and delivers normalized responses.
- Switching transport does not create separate SG identity or memory.
- No transport owns semantics, permissions or domain logic.
- Production Discord must resolve identity through canonical `global_user_id` links and preserve the existing Identity/Scope, Memory 2.0, Action Gate and Delivery Router boundaries.
