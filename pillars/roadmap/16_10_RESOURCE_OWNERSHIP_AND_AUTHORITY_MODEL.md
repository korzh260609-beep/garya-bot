# Block 16.10 — Resource Ownership & Authority Model

## Status
Planned.

## Goal
Give SG a canonical model of which real or digital resources a person or project owns, manages or may act upon, separately from identity and generic permissions.

## Required scope
- stable resource_id and resource type;
- resource provider/platform and external identifier;
- ownership and authority relations such as owns, manages, administers, can_read, can_publish and can_modify;
- actor/resource/project relationships;
- authority provenance and verification source;
- delegated and revocable authority;
- resource hierarchy where needed, such as server → channel or workspace → document;
- integration with Identity, Scope, Connections, Capabilities and Action Gate;
- audit of authority changes.

## Canonical question
Identity answers WHO. Scope answers WHERE. Access answers WHAT KIND OF ACTION. Resource Authority answers OVER WHICH RESOURCE.

## Boundaries
- platform membership alone does not prove ownership;
- adding SG to a group/channel does not automatically grant unrestricted authority;
- resource authority cannot merge identities or broaden project scope;
- state-changing resource operations still pass Action Gate;
- no command/keyword/secret-phrase identity or authority hacks are allowed.

## Acceptance criteria
- SG can distinguish owner, administrator, manager and ordinary participant;
- multiple resources belonging to one user remain independently addressable;
- different users' channels/groups/repositories cannot be confused;
- delegated authority is explicit, revocable and auditable;
- tests cover ownership, delegation, revocation, hierarchy and cross-user isolation.
