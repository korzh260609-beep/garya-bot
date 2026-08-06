# CHANGE SPECIFICATION — BLOCK 2: CONTEXT AND MEMORY

## Scope
Implement bounded, provenance-aware and scope-isolated context and memory for SG 2.1.

## Allowed changes
- `src/contracts/memory.js`
- `src/memory/*`
- `src/index.js`
- `tests/context-memory.test.js`
- `package.json`
- `package-lock.json`
- root `README.md`

## Required layers
- session context
- confirmed user memory
- confirmed project memory
- dialogue archive
- topic digest
- external evidence
- runtime state

## Required behavior
- explicit `ContextRequest` and `ContextBundle`
- provider interface and working in-memory provider
- strict user/project/group/thread scope isolation
- provenance, trust, timestamps and expiration
- controlled writes; dialogue is never promoted automatically
- duplicate detection
- conflict detection without silent overwrite
- retention and bundle-size limits
- diagnostics with trace identifiers
- semantic pipeline integration through `contextNeeds`

## Boundaries
- no database or migrations
- no production identity linking
- no Action Gate implementation
- no transport integration
- no external source calls
- no automatic AI summarization

## Acceptance
- cross-scope records never leak
- expired records are excluded
- duplicates are reported and not rewritten
- conflicts are reported and preserve both facts until resolved
- unconfirmed dialogue cannot be written as confirmed memory
- context is selected only from requested layers
- context bundle is bounded and deterministic
- Semantic Kernel can receive resolved context through canonical metadata
- tests and CI pass
