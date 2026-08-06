# SG 2.1 WORKFLOW — ARCHITECTURE DECISION PROTOCOL

## When a decision entry is required
Create or revise an entry in `pillars/DECISIONS.md` only when a proposed change affects:
- SG identity or authority
- core processing flow
- source-of-truth hierarchy
- semantic responsibility
- memory trust model
- permissions or action-control doctrine
- capability contracts
- transport boundaries
- AI model ownership or routing policy
- irreversible platform direction

## Decision process
1. state the problem
2. list constraints
3. identify alternatives
4. compare benefits, risks and costs
5. identify affected contracts and roadmap blocks
6. state migration and rollback impact
7. obtain explicit monarch approval
8. record the accepted decision
9. update architecture documents
10. update roadmap only if dependency order changed
11. implement through the normal development workflow

## Decision entry structure
- ID
- title
- status
- context
- decision
- rationale
- alternatives rejected
- consequences
- affected documents/contracts
- approval
- date

## Hard rules
- Workflow does not create architecture authority by itself.
- Code does not silently redefine architecture.
- Runtime convenience is not sufficient reason to violate a core boundary.
- External AI operators may propose decisions but cannot approve them.
- Historical implementation notes do not become active decisions automatically.
