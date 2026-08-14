# TEST AND EVIDENCE PROTOCOL

## Required evidence
- contract tests for public interfaces
- unit tests for deterministic logic
- integration tests for provider boundaries
- adapter tests for each transport
- permission and negative-path tests
- idempotency tests for state-changing operations
- failure and fallback tests
- observability verification

## Evidence rules
- Pillars contain no manual completion markers.
- Chat claims and model confidence are not completion evidence.
- Runtime evidence must identify environment, revision and test surface.
- A failed or unavailable dependency must remain visible.
