# SG 2.2 — Canonical Role Model Migration Plan

## Status

**APPROVED CANONICAL IMPLEMENTATION PLAN — NOT YET IMPLEMENTED**

Approved role model date: 2026-09-05.

This document is the single implementation plan for removing the obsolete SG role,
citizenship, workspace-membership and group-onboarding model from the current SG 2.2
runtime and replacing it with the approved Global ID model.

If another roadmap, historical implementation note, test or runtime behavior conflicts
with this document, this document and `pillars/entity/SG_ENTITY.md` take precedence.

## Approved target model

1. GARY is the one person who is simultaneously:
   - the SG `monarch`;
   - the owner of Project SG;
   - the owner of the OpenClaw instance beneath SG.
2. The Monarch has one persistent SG Global ID.
3. Every other person becomes a `citizen` automatically on their first valid
   interaction with SG and receives one persistent SG Global ID.
4. Citizenship has no application, pending state, approval or rejection workflow.
5. `guest` is deferred and is not an active runtime role until separately approved.
6. The Monarch and every citizen have one personal SG workspace bound to their Global
   ID. It follows the person across direct chats, groups, channels and transports.
7. SG does not create group-specific `owner`, `admin` or `member` roles.
8. Group and channel admission, administration and restrictions remain native to the
   channel and OpenClaw. SG consumes the resulting trusted route and policy outcome but
   does not copy native roles into an SG registry.
9. Every non-Monarch sender is denied SG development, project-operation, project-file,
   shell, Git and GitHub capabilities. This includes citizens and native group/channel
   administrators.
10. OpenClaw core and the standard Telegram adapter remain unchanged. SG-specific
    behavior stays in the external SG plugin and deployment configuration.

## Current audited implementation

The repository currently contains a working but obsolete WSP4-era model.

| Area | Current implementation | Required result |
| --- | --- | --- |
| First interaction | Unknown identity resolves to `guest`; read paths may create no profile | Create one durable profile immediately; role is `monarch` only for the configured Monarch identity and `citizen` for everyone else |
| Citizenship | Apply, pending, approve and reject workflow | Remove the workflow and all public/internal tools for it |
| Project roles | `monarch`, `citizen`, `guest` are active | Active roles are only `monarch` and `citizen`; defer `guest` |
| Monarch uniqueness | Role can be changed through registry mutation | Exactly one configured Monarch identity; runtime mutation cannot create a second Monarch |
| Personal state | No canonical per-person workspace | Personal workspace ID and storage root derive from Global ID |
| Group authority | SG onboarding request plus Monarch-confirmed group owner | Remove the SG authority workflow; rely on native channel/OpenClaw controls |
| Group membership | SG `owner`, `admin`, `member` registry | Remove the registry and every authorization dependency on it |
| Shared data isolation | `workspaceId` plus `ownerGlobalId` and SG workspace status | Neutral resource scope derived from trusted platform/account/resource/topic context |
| WSP5 content | Authorization depends on internal membership/effective role | Personal or current-resource scope plus native OpenClaw tool policy |
| WSP6 tests | Attempts are workspace-scoped and management uses internal roles | Attempts remain isolated by Global ID and resource scope; management uses native tool policy |
| Development access | Owner-only policy is documented but not fully enforced in runtime configuration | Default-deny development surface for every sender with one exact Monarch exception |

Audited obsolete implementation includes:

- `sg/plugin/citizenship-registry.ts`;
- `sg/plugin/workspace-memberships.ts`;
- `sg/plugin/workspace-requests.ts`;
- `sg/plugin/wsp4-tools.ts`;
- group-onboarding tools in `sg/plugin/workspace-tools.ts`;
- membership-dependent authorization in WSP5 and WSP6;
- corresponding registrations, prompts, manifests, diagnostics and tests.

## Authoritative ownership boundaries

### OpenClaw owns

- transport sender/account identity and `session.identityLinks`;
- session scoping, conversation routing and current resource/topic context;
- pairing, allowlists, access groups, `groupPolicy`, `groupAllowFrom` and equivalent
  channel admission controls;
- sender-specific tool policy, including `toolsBySender` where supported;
- approvals, sandboxing, credentials, shell, files, Git and GitHub enforcement;
- Telegram transport, Bot API integration and native channel actions.

### SG owns

- the stable SG Global ID and minimal SG profile;
- the closed SG project-role decision: exactly one `monarch`, otherwise `citizen`;
- the Global-ID-bound personal workspace contract;
- SG domain data that OpenClaw does not provide, isolated by Global ID or trusted
  resource scope;
- SG-specific migration records and diagnostics.

### Verified Telegram boundary

The pinned OpenClaw Telegram inbound path does not currently provide a trustworthy
native creator/admin/member role value to the external SG plugin. Therefore SG must
not infer, query, cache or mirror Telegram roles to rebuild `owner/admin/member`.
Admission and tool availability must be enforced by native OpenClaw/channel policy and
actual Telegram bot permissions. If a future pinned OpenClaw version exposes new role
evidence, it must be audited separately before use.

## Migration invariants

- A person keeps the same Global ID throughout migration.
- A valid first interaction creates at most one profile under concurrency.
- The configured Monarch identity always resolves to the single Monarch Global ID.
- No runtime API can promote a citizen to Monarch.
- Every old `guest`, pending applicant and rejected applicant with a valid canonical
  identity migrates to `citizen` without changing Global ID.
- Old applications, memberships and onboarding requests are archived for audit before
  their active stores are retired.
- No obsolete authorization record may continue influencing runtime access after
  cutover.
- Personal data is keyed by Global ID. Shared group/channel data is keyed only by a
  trusted resource scope.
- A caller cannot select another person's Global ID or an arbitrary resource scope
  through tool parameters.
- OpenClaw denial always wins.
- Citizens cannot reach development capabilities directly, indirectly through another
  tool or through subagent inheritance.
- The migration is idempotent, restart-safe and reversible from a verified backup.
- Compatibility aliases exist only inside bounded migration readers and are removed
  after the migrated state is verified; they do not remain as normal runtime APIs.

## Target data contracts

### Global profile store

Introduce the next explicit store schema version. The canonical record contains:

```text
globalId
canonicalIdentity
role: monarch | citizen
status: active
createdAt
updatedAt
```

The store also carries a schema version and the configured Monarch Global ID. Role
resolution is deterministic:

```text
verified configured Monarch identity → monarch
every other valid canonical identity → citizen
missing or invalid identity → no SG profile and no privileged action
```

`ensureProfile(canonicalIdentity)` is the only first-contact creation path. It must use
the existing atomic write and locking mechanism so concurrent first contacts cannot
create duplicates.

### Personal workspace

The canonical personal workspace identifier is the user's Global ID. Personal state is
stored below:

```text
<OPENCLAW_STATE_DIR>/sg/users/<globalId>/
```

Features may use subdirectories below this root, but must not create another person ID,
membership record or transport-specific personal workspace.

### Shared resource scope

Groups, channels, rooms and topics need data isolation, not SG membership. Replace the
old authority-bearing workspace contract with a neutral resource scope:

```text
resourceScopeId
platform
accountId
resourceKind
resourceId
parentResourceId
topicId
createdAt
updatedAt
```

The stable key is derived from trusted current-route fields. It contains no
`ownerGlobalId`, SG membership role or approval status. Tool callers cannot override
the current resource by supplying an arbitrary identifier.

Existing `workspaceId` values may be read once by a migration function to preserve
WSP5/WSP6 data relationships. New writes use `resourceScopeId`; the compatibility read
path is deleted after verification.

## Detailed implementation sequence

### Phase 0 — Freeze the rollback point

1. Record the exact branch, commit, deployed image digest and state schema versions.
2. Confirm work occurs only on `dev/sg2.2-openclaw`; do not modify `main`.
3. Back up the SG state directory with file metadata and checksums.
4. Prove the backup can be read in an isolated test state directory.
5. Record the plugin-disable rollback path.

Exit gate: source and state rollback points are reproducible before code changes.

### Phase 1 — Add failing contract tests first

Add tests that protect the approved behavior before changing production code:

1. configured Monarch identity resolves to the same `monarch` Global ID;
2. any other valid first contact creates an active `citizen` exactly once;
3. concurrent first contacts produce one profile and one Global ID;
4. repeated and linked cross-channel identities reuse the same Global ID;
5. no active `guest` profile or citizenship request is created;
6. a citizen cannot become Monarch through registry mutation or input text;
7. personal workspace path derives only from Global ID;
8. direct-chat state follows the same Global ID across transports;
9. group context creates/resolves a neutral resource scope without an SG role;
10. callers cannot select arbitrary personal or resource scopes;
11. non-Monarch senders cannot discover or invoke development tools;
12. Monarch development access remains subject to native OpenClaw approvals and
    sandbox policy.

Exit gate: new tests fail against the old implementation for the intended reasons.

### Phase 2 — Replace profile creation and role resolution

1. Add the new global-profile schema version and parser.
2. Add explicit configuration for the Monarch Global ID and canonical Telegram identity.
3. Validate at startup that the two values resolve to one profile and that only one
   Monarch exists.
4. Replace read-only/guest first-contact behavior with atomic `ensureProfile()`.
5. Make all non-Monarch valid identities active citizens immediately.
6. Remove general role-transition APIs; retain only narrowly scoped migration code.
7. Attach the Global ID and closed project role to SG request context before any SG
   model or tool execution, but after OpenClaw admission succeeds.
8. Fail closed for missing, malformed or ambiguous canonical identity without inventing
   a guest profile.

Primary files: `sg/plugin/context.ts`, `sg/plugin/citizenship-registry.ts`, registration
code and their tests. Rename the registry to a role-neutral global-profile module once
callers have moved.

Exit gate: the identity test matrix passes across restart and concurrent creation.

### Phase 3 — Migrate persisted identity state

1. Implement a standalone, versioned and idempotent migration.
2. Read the old profile and citizenship-request snapshot without modifying it.
3. Validate uniqueness of canonical identities and Global IDs; stop on ambiguity.
4. Preserve every valid profile's Global ID and timestamps where possible.
5. Convert every non-Monarch role, including old `guest`, to active `citizen`.
6. Merge valid pending/rejected applicant identities without creating duplicate profiles.
7. Archive the old request records with migration version, timestamp and checksum.
8. Atomically write the new store, reload it and compare counts and identity bindings.
9. Re-run the migration and prove byte-stable/no-op behavior.

Exit gate: zero Global ID loss, exactly one Monarch, all other valid profiles citizens,
and a verified archive exists.

### Phase 4 — Introduce Global-ID personal workspaces

1. Add a narrow resolver for `<state>/sg/users/<globalId>/`.
2. Reject path traversal and any caller-supplied Global ID.
3. Route personal memory and future person-specific SG state through this resolver.
4. Keep OpenClaw session and transport identity unchanged.
5. Add restart, cross-transport, isolation and invalid-path tests.

Exit gate: two users are isolated and one linked user sees the same personal workspace
through every supported transport.

### Phase 5 — Remove citizenship workflow

1. Remove `sg_citizen_apply`, `sg_citizen_pending` and `sg_citizen_decide`.
2. Remove their tool schemas, registration, manifest entries and prompt instructions.
3. Remove application/decision methods and active request-state writes.
4. Remove diagnostics that report pending citizenship decisions.
5. Delete tests whose only purpose is obsolete application behavior.
6. Keep only migration coverage for reading and archiving legacy request data.

Primary files: `sg/plugin/wsp4-tools.ts`, `sg/plugin/register.ts`,
`sg/plugin/index.ts`, `sg/plugin/openclaw.plugin.json`, diagnostics and related tests.

Exit gate: repository search finds no active citizenship application command, state or
authorization dependency.

### Phase 6 — Remove SG workspace roles and memberships

1. Remove `workspace-memberships.ts` and its runtime registration.
2. Remove `sg_membership_list` and `sg_membership_manage`.
3. Remove `owner`, `admin`, `member`, `effectiveRole` and membership-status checks from
   production authorization paths.
4. Archive legacy memberships before deleting the active store.
5. Replace membership decisions with native OpenClaw tool policy or a neutral data-scope
   check, depending on the operation.
6. Delete obsolete tests; add denial tests at the native policy/tool boundary.

Exit gate: no SG group membership record can grant, deny or change a capability.

### Phase 7 — Remove SG group onboarding and owner approval

1. Remove `workspace-requests.ts` and the active request store.
2. Remove `sg_workspace_onboard`, pending-list and decision tools.
3. Remove `ownerGlobalId`, approval/rejection status and authority evidence from the
   canonical runtime group record.
4. Archive pending/rejected requests, then retire the active store.
5. Auto-create or resolve a neutral resource scope only after native OpenClaw/channel
   admission has accepted the current request.
6. Preserve platform/account/resource/topic isolation and idempotent registration.

Primary files: `sg/plugin/workspace-tools.ts`, `sg/plugin/workspace-requests.ts`,
`sg/plugin/workspace-registry.ts`, plugin registration and related tests.

Exit gate: joining or administering a Telegram resource creates no SG role, while data
from different resources remains isolated.

### Phase 8 — Refactor WSP5 content

1. Replace `workspaceId` with an internal scope union: the current user's personal
   workspace or the trusted current resource scope.
2. Remove `effectiveRole` and internal membership authorization.
3. Prevent tool parameters from selecting another Global ID or arbitrary resource.
4. Use native sender-specific tool policy for publish/manage operations.
5. Keep native OpenClaw message actions, automations, approvals and delivery results.
6. Migrate existing content records from legacy workspace IDs to resource-scope IDs.
7. Test personal isolation, resource isolation, native denial and delivery failure.

Exit gate: content cannot cross person/resource boundaries and no obsolete role is read.

### Phase 9 — Refactor WSP6 tests and assessments

1. Key attempts by Global ID plus assessment and applicable resource scope.
2. Replace internal admin/owner checks with native sender-specific tool policy.
3. Keep deterministic scoring and per-person completion state.
4. Deliver private results through the native direct-message route.
5. Migrate legacy attempt references without changing their owning Global ID.
6. Test two users completing the same assessment independently and restart recovery.

Exit gate: one participant or native resource administrator cannot read or alter another
participant's private result unless explicitly permitted by native policy.

### Phase 10 — Enforce Monarch-only development access

This phase must land in the same verified release as removal of internal role checks.

1. Verify the exact sender-specific tool-policy schema supported by the pinned OpenClaw
   version; do not guess configuration keys.
2. Default-deny development, project files, shell, command execution, Git, GitHub and
   equivalent indirect tools for `*`.
3. Add one exact exception for the verified Monarch sender identity/Global ID through
   the supported OpenClaw mapping.
4. Confirm native Telegram owner/admin/member status grants no development access.
5. Verify subagents and delegated tool calls cannot widen the originating sender's
   policy.
6. Keep Monarch operations subject to OpenClaw approvals, sandboxing and credentials.
7. Verify both tool discovery and invocation denial for citizens and unknown identities.

Exit gate: the Monarch can use the permitted native development surface; every other
sender is denied at the authoritative OpenClaw boundary.

### Phase 11 — Update diagnostics and documentation

1. Make diagnostics report Global ID, `monarch|citizen`, personal-workspace identity,
   current resource scope and native policy outcome without secrets.
2. Remove guest, application, membership and group-owner diagnostics.
3. Update all roadmaps, workspace instructions and examples to the approved model.
4. Mark historical evidence clearly; do not present old WSP4 behavior as current.
5. Run repository-wide searches for obsolete terms and manually classify remaining
   migration/history references.

Exit gate: documentation, prompts, manifests, diagnostics and runtime express one role
model.

### Phase 12 — Full verification and owner handoff

Run targeted tests first, then the plugin suite and relevant repository gates.

Required matrix:

- Monarch DM and group interaction;
- citizen first contact in DM and group;
- repeated contact and restart;
- linked cross-channel identity;
- concurrent first contact;
- two citizens with isolated personal workspaces;
- two groups plus one topic with isolated resource scopes;
- attempted arbitrary-scope access;
- citizen and native group-admin development-tool discovery/invocation denial;
- Monarch development access under approvals;
- plugin disabled rollback;
- legacy-state migration, second-run no-op and restored-backup rollback;
- WSP5/WSP6 migrated data and current-route isolation;
- ordinary OpenClaw Telegram replies unchanged.

After all exact-commit tests pass:

1. build the exact image from that commit;
2. record image digest and migration version;
3. give the owner the test evidence, backup path and rollback instructions;
4. leave production deployment and live-state migration to the owner unless separately
   authorized;
5. perform live verification only after the owner deploys the exact image.

Exit gate: exact source commit, image digest, state migration and live evidence are
traceable to one release candidate.

## Required commit sequence

Keep removal and replacement reviewable. Recommended commits:

1. `test(sg): define new global role contract`
2. `refactor(sg): migrate identities to automatic citizenship`
3. `refactor(sg): remove citizenship and membership workflows`
4. `refactor(sg): replace group workspaces with resource scopes`
5. `fix(sg): align WSP5 and WSP6 with Global ID access`
6. `security(sg): enforce monarch-only development tools`
7. `docs(sg): remove obsolete role model`
8. `deploy(sg): pin verified new-role image`

Do not merge, deploy or migrate live state from an intermediate commit that has removed
old authorization without already enforcing the native sender-specific policy.

## Definition of done

The migration is complete only when all statements below are true:

- one verified GARY identity maps to one persistent Monarch Global ID;
- every other valid first interaction atomically creates or resolves a citizen profile;
- no active guest, citizenship request or manual citizen decision path exists;
- every active person has exactly one Global-ID-bound personal workspace;
- no SG `owner`, `admin` or `member` role or membership authorization remains;
- groups/channels/topics retain isolated data through neutral trusted resource scopes;
- native channel/OpenClaw policy controls group admission and management restrictions;
- all non-Monarch senders are denied the SG development and GitHub surface;
- OpenClaw core and the stock Telegram adapter have no SG-specific modifications;
- legacy data is migrated without Global ID loss and old stores are archived;
- all required tests pass at the exact release commit;
- rollback from both source and state backup has been demonstrated;
- the owner has performed or separately authorized production deployment.

## Immediate next action

Begin with Phase 0 and Phase 1 only. Do not delete old runtime paths until the new
contract tests and verified state backup exist.
