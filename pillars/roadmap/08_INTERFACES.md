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

## Acceptance criteria
- Every transport creates CanonicalRequest and delivers normalized responses.
- Switching transport does not create separate SG identity or memory.
- No transport owns semantics, permissions or domain logic.
