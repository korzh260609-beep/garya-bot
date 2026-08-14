# SG 2.1 ROADMAP — BLOCK 0: ENGINEERING FOUNDATION

## Goal
Create a safe, runnable and testable repository baseline before functional SG 2.1 development.

## Scope
- Node.js project metadata and locked runtime version
- source and test directories
- environment example and secret-safe ignore rules
- local runner
- built-in test harness
- continuous integration
- canonical error contract
- minimal `IdentityContext`, `ScopeContext` and `TraceContext` contracts

## Boundaries
- No Telegram integration
- No database or migrations
- No durable memory
- No model provider integration
- No production identity linking
- No role/grant authority
- No protected capability execution
- No domain logic

## Deliverables
- `package.json` and lock file
- `.gitignore` and `.env.example`
- `src/index.js`
- `src/contracts/*`
- `tests/*`
- `.github/workflows/ci.yml`
- root `README.md`

## Acceptance criteria
- `npm ci` succeeds
- `npm test` succeeds
- `npm run check` succeeds
- local runner returns a valid, scoped and traceable foundation response
- no secret-bearing environment file is tracked
- contracts fail closed on missing required identity, scope or trace fields
- the foundation contains no business or transport logic

## Exit gate
Block 1 may begin only after all acceptance criteria pass in CI and the resulting revision is recorded as evidence.
