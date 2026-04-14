# Bot Module — CHANGELOG

Purpose:
- Track meaningful module-level documentation and behavior evolution.
- Keep a readable local history for future work.

Status: CANONICAL
Scope: Bot module local evolution

---

## 2026-04-14

### Added
- Initial module documentation skeleton created:
  - `README.md`
  - `CONTRACTS.md`
  - `RISKS.md`
  - `CHANGELOG.md`

### Why
- To establish Bot as a documented stable module boundary
- To prevent handler bloat and routing drift
- To support safer future command/chat-entry evolution

### Notes
- This changelog tracks meaningful Bot module evolution
- It is not a replacement for git history
- Root-level architectural decisions still belong in `pillars/DECISIONS.md`

---

## 2026-04-14 — runtime/doc honesty update

### Updated
- `RISKS.md` now explicitly acknowledges current handler-level debt

### Why
- current repository state still contains handlers that are not thin enough
- direct SQL exists inside some handler files
- this is technical debt, not canonical Bot design

### Meaning
- Bot docs still describe the correct target boundary
- but risks now state clearly that runtime is not fully aligned yet