# AI Routing Module — CHANGELOG

Purpose:
- Track meaningful module-level documentation and behavior evolution.
- Keep a readable local history for future work.

Status: CANONICAL
Scope: AI Routing / Model Control module local evolution

---

## 2026-04-14

### Added
- Initial module documentation skeleton created:
  - `README.md`
  - `CONTRACTS.md`
  - `RISKS.md`
  - `CHANGELOG.md`

### Why
- To establish AI Routing / Model Control as a documented stable module boundary
- To protect centralized AI-call discipline
- To support safer future multi-model/provider evolution

### Notes
- This changelog tracks meaningful AI Routing / Model Control module evolution
- It is not a replacement for git history
- Root-level architectural decisions still belong in `pillars/DECISIONS.md`

---

## 2026-04-14 — runtime/doc honesty update

### Updated
- `RISKS.md` now explicitly acknowledges that current runtime is only partially aligned with the documented AI Routing target state

### Why
- current repository state still contains scattered direct AI calls outside the ideal central routing boundary
- current shared AI entry behaves more like a wrapper/fallback layer than a fully mature router with complete policy/governance logic
- this divergence must be documented honestly

### Meaning
- AI Routing docs still describe the correct target architecture
- but risks now state clearly that runtime is only partially aligned with that target