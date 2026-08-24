# SG 2.1 — Personal Result Delivery (RD1) Workflow

Status: ACCEPTED IMPLEMENTATION WORKFLOW / PLANNED

Canonical architecture: `../architecture/PERSONAL_RESULT_DELIVERY.md`.
Canonical program: `../roadmap/PERSONAL_RESULT_DELIVERY_PROGRAM.md`.

## Purpose

Define the controlled implementation and verification sequence for RD1 without changing test scoring semantics or binding the feature permanently to Telegram.

## Working rule

Implement RD1 only in `dev/sg2.1-semantic`. `main` is not an implementation target.

Each stage follows:

```text
inspect current code/schema
→ define smallest compatible change
→ implement
→ focused tests
→ full check
→ exact-head CI
→ only then mark stage closed
```

## Package A — Ownership + Resolver + Direct DM

### A1. Inspect current result model
- locate the authoritative test/quiz result entity/store;
- verify how participant identity, test/session and completion state are currently represented;
- identify whether `globalUserId` already exists on the result path;
- do not add a duplicate result table if existing persistence can be extended safely.

### A2. Add/normalize canonical ownership
- bind personal result to `globalUserId`;
- preserve test/session correlation;
- keep transport IDs only as identity bindings/metadata;
- add ownership/isolation tests before transport fallback work.

### A3. Add delivery state seam
- represent `pending/delivered/failed` and optional fallback-expiry metadata separately from result/scoring state;
- make state updates idempotent;
- failed delivery must not mutate score/completion.

### A4. Add private delivery resolver
- introduce transport-neutral endpoint selection contract;
- first concrete adapter may be Telegram DM;
- reserve native SG private chat endpoint type without implementing the UI.

### A5. Wire Telegram direct delivery
- after successful result finalization, attempt DM;
- classify expected “user has not started bot/private chat unavailable” errors as fallback conditions;
- do not surface them as test failures.

## Package B — Common Control + Start Fallback + Selection

### B1. Add common group control
- use one shared button/control: `📩 Получить мой результат`;
- no participant-specific name/result/score in the shared message;
- avoid creating one new group message per completed participant when existing test UI can carry the control.

### B2. Add generic deep-link/start intent
- route to a generic intent such as `my_test_result`;
- do not put result IDs, scores or owner IDs into the public link;
- obtain Telegram sender identity from the incoming update.

### B3. Resolve Telegram actor to Global ID
- use existing identity resolution/binding;
- if no canonical identity can be established, fail closed without revealing result existence;
- never authorize by username/display name.

### B4. Select only caller-owned result
- first use explicit safe session correlation if already available;
- otherwise select newest eligible pending result for the same `globalUserId`;
- if multiple own results remain genuinely ambiguous, present only caller-owned choices.

### B5. Deliver and finalize state
- send result to private chat;
- mark successful delivery once;
- repeated start/button callbacks must be safe and must not corrupt/duplicate authoritative result state.

## Package C — Isolation + Native Compatibility + Verification

### C1. Multi-user concurrency regression
Cover at minimum:
- owner + admin concurrently;
- owner + ordinary participant;
- several ordinary participants;
- one participant completes while others are still answering;
- participant retries result retrieval;
- two active test sessions for one user.

Required invariant: one participant finishing or retrieving a result cannot close/consume another participant’s flow.

### C2. Native SG compatibility verification
Confirm no RD1 core logic requires:
- Telegram chat ID as owner;
- Telegram username;
- Telegram deep-link to find the result;
- Telegram-specific result schema.

Expected future path:

```text
native group/channel result
→ globalUserId
→ Personal Delivery Resolver
→ native private SG chat
```

### C3. Privacy/observability review
- shared messages contain no private result;
- logs/events contain bounded metadata only;
- delivery failures are observable without copying scores/private payloads unnecessarily;
- foreign-result probing gives no useful disclosure.

### C4. Focused and full tests
Required test classes:
- ownership;
- persistence/migration when applicable;
- direct DM success;
- Telegram fallback classification;
- generic start handling;
- result selection;
- idempotency;
- multi-user/session isolation;
- regression of existing test behavior.

Then run the repository’s canonical full check.

### C5. Exact-head CI closure
A stage/program is not CLOSED until CI is green on the exact commit HEAD containing the implementation and synchronized canonical docs.

## Failure handling

Expected Telegram inability to initiate a private chat is a delivery-state condition, not a system incident by itself.

Unexpected failures must preserve:
- authoritative test result;
- owner identity;
- pending/retry capability;
- privacy.

Never “solve” delivery failure by publishing the private result into the group.

## Migration discipline

If persistence changes are required:
- use the next repository migration number only after checking current migration HEAD;
- make migration additive/reversible where repository conventions permit;
- update migration-count assertions/tests that intentionally track exact migration count;
- preserve PostgreSQL restart continuity.

## Definition of done

RD1 is complete only when:
- personal result ownership is canonical by `globalUserId`;
- existing private-chat users receive results automatically;
- users without an active Telegram DM can start SG and retrieve their own result;
- the shared group control leaks no private result;
- other users cannot retrieve or infer another participant’s result;
- concurrent participants remain independent;
- native SG private-chat support can be added as an adapter rather than a redesign;
- focused tests and full exact-head CI are green.
