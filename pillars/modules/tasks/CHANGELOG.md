# Tasks Module — CHANGELOG

Purpose:
- Track meaningful module-level documentation and behavior evolution.
- Keep a readable local history for future work.

Status: CANONICAL
Scope: Tasks module local evolution

---

## 2026-04-14

### Added
- Initial module documentation skeleton created:
  - `README.md`
  - `CONTRACTS.md`
  - `RISKS.md`
  - `CHANGELOG.md`

### Why
- To establish Tasks as a documented stable module boundary
- To protect explicit execution/lifecycle discipline
- To support safer future scheduler/runner growth

### Notes
- This changelog tracks meaningful Tasks module evolution
- It is not a replacement for git history
- Root-level architectural decisions still belong in `pillars/DECISIONS.md`

---

## 2026-04-14 — runtime/doc honesty update

### Updated
- `RISKS.md` now explicitly acknowledges current direct AI invocation inside task execution code

### Why
- current repository state shows Tasks still calling shared AI entry directly
- this blurs the Tasks boundary with AI Routing
- this is technical debt, not canonical target design

### Meaning
- Tasks docs still describe the correct target boundary
- but risks now state clearly that runtime is not fully aligned yet