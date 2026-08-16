# SG 2.1 ROADMAP — BLOCK 9: AUTOMATION AND AGENTS

## Goal
Add scheduled, queued and delegated work without bypassing SG decisions or safety.

## Deliverables
- task and schedule contracts
- workers, retry and DLQ behavior
- delegated agent contract
- prepare-only code/PR capabilities
- approval and cancellation flow

## Automation 2.0 relationship

Block 9 remains the foundational automation/agent contract. The durable PostgreSQL scheduler/worker implementation is provided by later production blocks and is already the substrate for current one-shot/recurring automation.

The accepted cross-cutting **Automation 2.0 — Executable Workflows** extension builds on this foundation so SG can semantically patch an existing automation and execute fresh authorized multi-step work at run time rather than only send static stored messages.

Automation 2.0 does not renumber Blocks 0–19 and does not create a second scheduler, worker, identity, authorization, credential or delivery stack.

Current Automation 2.0 lifecycle state: **PLANNED / NOT IMPLEMENTED**. Canonical specification:
- `../architecture/AUTOMATION_2_0_EXECUTABLE_WORKFLOWS.md`
- `AUTOMATION_2_0_EXECUTABLE_WORKFLOWS_PROGRAM.md`
- `../workflow/AUTOMATION_2_0_EXECUTABLE_WORKFLOWS_WORKFLOW.md`

## Acceptance criteria
- Every protected automated action passes Action Gate.
- Agents remain replaceable components and do not become separate SG identities.
- Failed or delayed work remains observable and recoverable.
- Automation 2.0 execution must re-check current authority at execution time and preserve idempotency/restart continuity.
