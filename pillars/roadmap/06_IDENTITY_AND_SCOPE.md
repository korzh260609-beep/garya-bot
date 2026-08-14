# SG 2.1 ROADMAP — BLOCK 6: IDENTITY AND SCOPE

## Goal
Resolve stable global identity, roles, grants and bounded scopes across transports.

## Deliverables
- IdentityContext and ScopeContext
- platform identity link contract
- guest isolation
- role/grant resolution
- project/group/thread scope construction
- link/unlink audit policy

## Acceptance criteria
- The same linked user reaches the same personal SG context across transports.
- Transports cannot grant roles or broaden scope.
- Missing scope fails closed rather than becoming unrestricted.
