# Staged Implementation Plan for Coding Agents

> AGENT NOTE:
> This file defines how the Coding Agents Team implementation must be split into stages.
> It is documentation only. It does not implement runtime agents and does not enable autonomy.

## 1. Purpose

This file defines:

```text
- how many stages the Coding Agents Team task is split into;
- the exact order of stages;
- what each stage may create;
- what each stage must not create;
- when the coding operator is allowed to move to the next stage.
```

The goal is to prevent one large uncontrolled implementation.

## 2. Global rule

The implementation must move in this order:

```text
Stage 1 -> Stage 2 -> Stage 3 -> Stage 4 -> Stage 5 -> Stage 6 -> Stage 7
```

A later stage must not start until the previous stage is completed, reviewed, and approved.

If a stage fails checks, the coding operator must stop and fix that stage first.

## 3. Stage overview

```text
Stage 1: Minimal Safety Slice
Stage 2: Planning Agents
Stage 3: Documentation / Review / PR Agents
Stage 4: CodePatchAgent Skeleton
Stage 5: Extended Agents Skeleton
Stage 6: Controlled Runtime Execution Layer
Stage 7: SG Integration Layer
```

## 4. Stage 1 — Minimal Safety Slice

### Goal

Create the smallest safe base.

### Allowed scope

```text
registry
shared contracts
permission model
RepoStateAgent definition
PermissionGuardAgent definition
minimal prompt/spec placeholders
minimal smoke checks
runtime README
```

### Required files

Follow:

```text
MINIMAL_IMPLEMENTATION_SLICE.md
REGISTRY_CONTRACT_SPEC.md
AGENT_DEFINITION_TEMPLATE.md
SMOKE_TEST_SPEC.md
```

### Must not create

```text
CodePatchAgent runtime behavior
PR creation behavior
branch creation behavior
merge behavior
deploy behavior
secret access
Render mutation
paid provider integration
full autonomous runner
```

### Required checks

```text
registry loads minimal agents
agent ids are unique
required fields exist
RepoStateAgent is read-only
PermissionGuardAgent blocks main writes
PermissionGuardAgent blocks dev/v2-start-clean-copy writes
dangerous permissions default to false
```

### May move to Stage 2 only if

```text
Stage 1 PR is created
Stage 1 PR passes required smoke checks or clearly documents unavailable checks
Advisor/ReviewAgent review is complete
Monarch explicitly approves merge
Stage 1 is merged into dev/v2-start
post-merge state is confirmed
```

## 5. Stage 2 — Planning Agents

### Goal

Add agents that understand and plan work safely.

### Allowed scope

```text
RequirementsAgent definition
TaskPlannerAgent definition
ArchitectureGuardAgent definition
prompt/spec placeholders for these agents
smoke checks for these definitions
registry registration for these agents
```

### Must not create

```text
real code-writing behavior
real PR-writing behavior
full autonomous planning loop
SG Core changes
pillar/law changes
```

### Required checks

```text
RequirementsAgent preserves original command
TaskPlannerAgent splits work into stages
ArchitectureGuardAgent can return allowed / blocked / needs approval
all dangerous permissions remain false
registry loads Stage 1 + Stage 2 agents
```

### May move to Stage 3 only if

```text
Stage 2 PR is created
Stage 2 scope contains only planning agents
smoke checks pass or unavailable checks are clearly documented
Advisor/ReviewAgent review is complete
Monarch explicitly approves merge
Stage 2 is merged into dev/v2-start
post-merge state is confirmed
```

## 6. Stage 3 — Documentation / Review / PR Agents

### Goal

Add agents that document, review, and prepare PR reports.

### Allowed scope

```text
DocsAgent definition
PRReportAgent definition
ReviewAgent definition
prompt/spec placeholders for these agents
smoke checks for these definitions
registry registration for these agents
```

### Must not create

```text
actual GitHub PR creation behavior
actual merge behavior
actual deploy behavior
auto-approval behavior
self-review as final approval
```

### Required checks

```text
DocsAgent cannot mark skeleton as production-ready
PRReportAgent includes merge status blocked until explicit Monarch approval
ReviewAgent can return approve / request changes / block
all dangerous permissions remain false
registry loads Stage 1 + Stage 2 + Stage 3 agents
```

### May move to Stage 4 only if

```text
Stage 3 PR is created
Stage 3 scope contains only docs/review/report definitions
smoke checks pass or unavailable checks are clearly documented
Advisor/ReviewAgent review is complete
Monarch explicitly approves merge
Stage 3 is merged into dev/v2-start
post-merge state is confirmed
```

## 7. Stage 4 — CodePatchAgent Skeleton

### Goal

Add CodePatchAgent as a definition-only skeleton.

### Allowed scope

```text
CodePatchAgent definition
CodePatchAgent prompt/spec placeholder
CodePatchAgent permission definition
smoke checks proving no merge/deploy/protected branch permissions
registry registration
```

### Must not create

```text
real code patch execution
real repository write execution
branch creation execution
PR creation execution
merge/deploy behavior
```

### Required checks

```text
CodePatchAgent canWriteRepo is false unless explicitly approved for a later stage
CodePatchAgent canMerge is false
CodePatchAgent canDeploy is false
CodePatchAgent canChangeProtectedBranches is false
CodePatchAgent refuses files outside approvedFiles in definition/spec
registry loads all V1 agent definitions
```

### May move to Stage 5 only if

```text
Stage 4 PR is created
Stage 4 is definition-only
no real write execution is enabled
smoke checks pass or unavailable checks are clearly documented
Advisor/ReviewAgent review is complete
Monarch explicitly approves merge
Stage 4 is merged into dev/v2-start
post-merge state is confirmed
```

## 8. Stage 5 — Extended Agents Skeleton

### Goal

Add extended agents as definitions only.

### Allowed scope

```text
ConfigAgent definition
IntegrationAgent definition
APIContractAgent definition
UIClientAgent definition
DependencyAgent definition
MigrationAgent definition
TestAgent definition
SecurityGuardAgent definition
MemoryImpactAgent definition
CostControlAgent definition
RollbackAgent definition
ReleaseObservationAgent definition
prompt/spec placeholders
registry registration
smoke checks
```

### Must not create

```text
real external API calls
real dependency installation
real migration execution
real security mutation
real memory mutation
real paid provider setup
real deploy/observation automation
```

### Required checks

```text
all extended agents are definition-only
all dangerous permissions remain false
MigrationAgent cannot run production DB operations
SecurityGuardAgent cannot expose secrets
CostControlAgent blocks unlimited recurring AI/tool calls in definition/spec
ReleaseObservationAgent cannot deploy
```

### May move to Stage 6 only if

```text
Stage 5 PR is created
Stage 5 is skeleton/definition-only
smoke checks pass or unavailable checks are clearly documented
Advisor/ReviewAgent review is complete
Monarch explicitly approves merge
Stage 5 is merged into dev/v2-start
post-merge state is confirmed
```

## 9. Stage 6 — Controlled Runtime Execution Layer

### Goal

Create a controlled execution layer that can run safe read/planning/reporting agents through strict permissions.

### Allowed scope

```text
base agent runner
controlled task input/output
permission guard before every run
safe read-only execution for RepoStateAgent
safe planning/reporting execution for planning/docs/review agents
execution result objects
additional smoke checks
```

### Must not create

```text
real merge execution
real deploy execution
real protected branch write
real secret access
unlimited loops
full autonomous coding chain
production changes
```

### Required checks

```text
runner checks permissions before execution
runner blocks dangerous actions by default
runner can execute read-only/planning agents only
runner returns structured result
runner reports uncertainty instead of guessing
runner does not bypass registry
```

### May move to Stage 7 only if

```text
Stage 6 PR is created
runtime execution is limited and permission-guarded
no dangerous actions are enabled
smoke checks pass or unavailable checks are clearly documented
Advisor/ReviewAgent review is complete
Monarch explicitly approves merge
Stage 6 is merged into dev/v2-start
post-merge state is confirmed
```

## 10. Stage 7 — SG Integration Layer

### Goal

Allow SG and Advisor to use the coding agents through a controlled interface.

### Allowed scope

```text
SG-facing controlled adapter
Advisor/SG call path
read/planning/reporting agent access
permission checks before every call
structured result delivery
logging/observation hooks if already available
```

### Must not create

```text
uncontrolled direct access to agents
hidden autonomy
auto-merge
auto-deploy
secret access
protected branch writes
runtime behavior that bypasses Monarch approval
```

### Required checks

```text
SG can call only approved safe operations
Advisor can request agent reports through SG path
PermissionGuardAgent is enforced
results are structured
errors are explicit
no merge/deploy path exists
```

### Completion condition

Stage 7 is complete only if:

```text
SG integration is controlled
Advisor review path exists
Monarch approval remains required for merge/deploy/high-risk actions
all checks are documented
PR is reviewed
Monarch explicitly approves merge
post-merge state is confirmed
```

## 11. Cross-stage stop conditions

At any stage, stop if the work requires:

```text
main branch write
dev/v2-start-clean-copy write
protected branch write
SG Core rewrite
pillar/law change
production secrets
Render production change
destructive database change
merge/deploy permission
paid provider setup
unlimited AI/tool loops
hidden autonomy
```

## 12. Cross-stage PR rules

Every stage must be its own PR.

Every PR must include:

```text
stage number
stage name
scope
non-goals
created files
changed files
smoke checks
risks
rollback note
merge status
```

Required text:

```text
Merge status: blocked until explicit Monarch approval.
```

## 13. No stage skipping rule

The coding operator must not jump from Stage 1 directly to Stage 5, 6, or 7.

If the Monarch explicitly orders a stage skip, the PR must state:

```text
Stage skip was explicitly ordered by Monarch.
Risk accepted by Monarch.
```

Without that explicit instruction, stage skipping is forbidden.

## 14. Final rule

Each stage must be small enough to review.

If a stage becomes too large, split it into smaller PRs inside the same stage.

Do not solve complexity by creating a giant uncontrolled PR.
