# SG 2.1 WORKFLOW — CHANGE SPECIFICATION PROTOCOL

Before code is written, define the change in this form.

## Change specification

### Goal
What measurable result must exist after the change?

### Scope
Which contracts, modules and files may change?

### Non-goals
What is explicitly excluded?

### Inputs and outputs
List canonical contracts and schemas.

### Dependencies
List only already-approved earlier roadmap blocks.

### Risks
Identify architecture, privacy, security, cost, data-loss and compatibility risks.

### Permissions and action class
Classify each executable path as read-only, analysis-only, prepare-only, state-changing, external-action, private-data or expensive-costly.

### Acceptance criteria
State observable pass/fail conditions before implementation.

## Design checks
- Does the change preserve SG as one entity?
- Is meaning handled by the Semantic Kernel rather than rules or transport routes?
- Is storage accessed through contracts?
- Does the Action Gate protect execution?
- Is the capability replaceable?
- Are failures and uncertainty represented explicitly?

## Output
The approved specification becomes the boundary for one implementation block and one reversible commit.
