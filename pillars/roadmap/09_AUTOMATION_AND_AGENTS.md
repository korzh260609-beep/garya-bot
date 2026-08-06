# SG 2.1 ROADMAP — BLOCK 9: AUTOMATION AND AGENTS

## Goal
Add scheduled, queued and delegated work without bypassing SG decisions or safety.

## Deliverables
- task and schedule contracts
- workers, retry and DLQ behavior
- delegated agent contract
- prepare-only code/PR capabilities
- approval and cancellation flow

## Acceptance criteria
- Every protected automated action passes Action Gate.
- Agents remain replaceable components and do not become separate SG identities.
- Failed or delayed work remains observable and recoverable.
