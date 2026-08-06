# SG 2.1 WORKFLOW — TEST AND EVIDENCE PROTOCOL

## Test layers
1. contract tests
2. unit tests
3. behavior tests
4. integration tests
5. adapter tests
6. runtime smoke tests
7. safety and negative-path tests

## Required evidence
Every change must prove:
- expected input/output contract
- failure behavior
- uncertainty handling
- permission and scope behavior
- idempotency for side effects
- observability events
- rollback safety
- no forbidden architecture dependency

## Semantic tests
- equivalent phrasings map to equivalent intent structures
- ambiguous requests trigger at most one essential clarification
- keyword substitutions do not control meaning by themselves
- semantic output remains transport-independent

## Memory tests
- raw dialogue is not promoted automatically
- trust labels and provenance survive restore
- conflicts do not silently overwrite confirmed state
- scope isolation prevents cross-user/project leakage
- bounded context limits are enforced

## Action tests
- protected actions fail closed
- blocked execution may still return analysis or prepare-only output
- confirmation cannot be reused outside its action scope
- duplicate execution is prevented

## Evidence rule
Pillars are not manually marked complete. Completion is derived from committed code, green tests and verified runtime evidence.
