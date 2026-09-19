# SG 2.2 — Prepaid Billing and Model Routing Plan

## Status

**LOCAL IMPLEMENTATION VERIFIED — AWAITING COMMIT APPROVAL**

Approved business model date: 2026-09-13.

This document is the canonical SG 2.2 implementation plan for prepaid user balances,
complete OpenAI cost attribution, the fixed `cost × 2` customer charge, and
cheap/medium/expensive model routing.

Recording this plan does not mean that billing, balance enforcement, routing, OpenAI
reconciliation, environment variables or production charging are implemented or
enabled.

## Approved billing completion tranche — 2026-09-19

The owner approved continuation of the existing SG billing implementation on
`dev/sg2.2-openclaw`. This tranche extends the existing external plugin and the same
`<OPENCLAW_STATE_DIR>/sg/billing.sqlite`; it must not create a second ledger, change
OpenClaw core, or change the standard Telegram adapter.

### Verified starting point

- repository baseline: `4728889481fb5eeac2fcf5b838ffe0f7b82d87e5`;
- existing citizen prepaid flow reserves before provider I/O and settles exact
  provider-billed cost at `cost × 2`;
- existing Monarch requests bypass prepaid admission and therefore are not yet
  represented in the cost ledger;
- no SG model-routing policy is active in this tranche;
- a scheduled run at `2026-09-19 04:00 UTC` was blocked before provider execution
  because the cron context had `jobId` but no message sender identity;
- the resulting Telegram message was a failure notification, not a Telegram send
  failure or an OpenAI insufficient-funds response.

### Accounting model

| Subject      |                Provider expense | Customer charge | SG revenue |        SG profit |
| ------------ | ------------------------------: | --------------: | ---------: | ---------------: |
| Citizen      | actual attributable OpenAI cost |     expense × 2 |     charge | charge − expense |
| Monarch      | actual attributable OpenAI cost |               0 |          0 |         −expense |
| Unattributed |    reconciled organization cost |               0 |          0 |         −expense |

Project totals use:

```text
project revenue = sum(citizen customer charges)
project cost = citizen expense + Monarch expense + unattributed expense
project profit = project revenue - project cost
```

Top-ups and balance adjustments are funding movements, not revenue. Revenue is
recognized only when a citizen charge settles.

### Ordered implementation plan

1. Preserve the exact branch/deploy baseline and run the existing billing tests.
2. Add red contracts for Monarch interactive accounting, trusted cron ownership,
   unknown jobs, replay/idempotency and citizen behavior preservation.
3. Extend existing billing operations with an explicit subject role and charge
   policy so Monarch expense is recorded without reserve or balance deduction.
4. Persist a trusted `automation job ID -> SG Global ID + role` binding in the same
   billing database when the native `automations`/legacy `cron` tool successfully
   creates or updates a job from a request with proven requester identity.
5. Resolve scheduled runs only through that persisted binding. Never grant a blanket
   cron bypass; an unknown job remains blocked before provider I/O.
6. Preserve the citizen prepaid contract, `cost × 2`, atomic reservation boundaries,
   replay safety and cross-channel Global ID isolation.
7. Add Monarch-only migration/diagnostic controls for already-existing jobs without
   embedding Telegram IDs or job IDs in source.
8. Add OpenAI Admin API synchronization using separately approved secrets, closed
   windows, complete pagination, an overlap window and idempotent source records.
   Synchronization failure must not interrupt Telegram or erase local accounting.
9. Reconcile organization totals against request-level records. Matched differences
   become reconciled evidence; unmatched cost remains explicitly unattributed and is
   never assigned to a user by guesswork.
10. Add Monarch reports for the whole project, Monarch-only spend, each citizen,
    revenue, provider cost, profit, pending work, unattributed cost and reconciliation
    freshness.
11. Prove restart/migration safety, duplicate delivery safety, Admin API outage
    behavior, secret redaction and exact project/user formulas locally.
12. After separate approval, commit and push only to `dev/sg2.2-openclaw`, then wait
    for the full GitHub Actions run to complete successfully.
13. Only after another separate approval and green Actions, configure secrets and
    deploy to Render; verify `live`, `/health` 200, clean logs and real Telegram
    acceptance for both an interactive Monarch run and a scheduled run.

Stage 8 code is locally implemented, but use of real Admin credentials remains
approval-gated. Stages 12 and 13 also remain approval-gated. No secret, environment,
commit, push or production mutation is authorized merely by this plan.

### Local implementation evidence — 2026-09-19

- trusted automation ownership and unknown-job fail-closed behavior implemented;
- Monarch, citizen and project accounting implemented in the existing ledger;
- closed-window OpenAI Costs API reconciliation implemented with pagination,
  overlap-safe revisions and dedicated Admin credentials;
- Monarch project/per-user reports and explicit reconciliation controls implemented;
- SG plugin suite: `41` files and `283` tests passed;
- changed SG TypeScript files pass `oxlint`, formatting and `git diff --check`;
- no commit, push, environment change or deploy has been performed.

## Owner-approved business rules

1. Every user works from a prepaid SG balance.
2. The customer charge for every billable operation is:

   ```text
   customer charge = complete OpenAI cost caused by that user × 2
   ```

3. "Complete OpenAI cost" includes every operation that spends funds from the
   Monarch's OpenAI account, including:
   - text, image and audio input/output tokens;
   - cached input and cache writes;
   - model reasoning included in provider-billed output usage;
   - image generation and image editing;
   - video generation;
   - text-to-speech, transcription and realtime voice;
   - files, embeddings, file search and vector-store storage;
   - web search and code-interpreter sessions;
   - analyses, hosted tools and future billable OpenAI capabilities.
4. Reasoning usage must not be charged twice when it is already included in billed
   output tokens.
5. SG must not invent feature bundles or reduce citizen capabilities as part of this
   billing work.
6. Model quality selection and access authority are separate concerns. A citizen may
   request a more powerful model and is charged for the model actually used.
7. Repository, Render, shell, secrets and project-administration authority remain
   Monarch-only under the existing SG role model. Billing must not weaken those
   security boundaries.
8. No unknown or unattributed organization-level cost may be silently assigned to a
   user.
9. The initial top-up flow is manual: the Monarch records funds only after verifying
   that payment was actually received outside SG. Automatic payment acceptance is a
   separate future integration and requires its own audit and owner approval.

## Authority boundaries

### OpenClaw remains authoritative for

- provider authentication and model execution;
- provider/model catalogs and configured pricing;
- model usage returned by providers;
- tool, media, session and agent execution;
- channel admission, tool policy, approvals and sandboxing;
- the standard Telegram adapter;
- standard provider usage and cost diagnostics.

### The external SG plugin owns

- the Global-ID-bound prepaid account;
- reservations, charges, refunds, adjustments and audit entries;
- attribution of an admitted SG action to its trusted Global ID;
- the fixed sale multiplier of `2`;
- model mode preferences and SG routing policy;
- user and Monarch billing commands;
- reconciliation state and SG-specific billing diagnostics.

### Core-change restriction

The SG plugin must reuse existing OpenClaw lifecycle hooks first. A minimal generic
Plugin SDK observability event may be added only if an already-audited paid execution
path cannot expose its completed usage/result to an external plugin. Such a change
must carry no SG billing policy, must not modify the Telegram adapter, and requires
separate owner approval before implementation.

## Accuracy contract

OpenAI's organization Usage API exposes separate usage categories for completions,
images, audio speech, audio transcription, embeddings, file search, vector stores,
web search and code interpreter. The organization Costs API provides billed monetary
amounts grouped by dimensions such as project, API key or line item.

The current APIs do not provide a universal `SG Global ID -> exact monetary cost`
record for every product. Therefore SG must use two linked records:

1. a request-level SG ledger for user attribution and immediate prepaid settlement;
2. organization-level OpenAI Costs/Usage data for delayed reconciliation.

Every cost record must state its evidence level:

- `provider_billed`: the provider explicitly returned the monetary cost;
- `reconciled`: the request-level record was matched to organization billing data;
- `estimated`: calculated from actual usage and the exact active price table;
- `pending`: accepted work has not produced enough evidence for final settlement;
- `unattributed`: organization cost exists but cannot be safely assigned to a user.

An estimate must never be presented as an exact OpenAI invoice value. Unattributed
cost remains visible to the Monarch and is never distributed arbitrarily.

## Phase 0 — baseline and rollback

1. Confirm the checkout is `dev/sg2.2-openclaw`; never change `main`.
2. Confirm local and remote HEAD and require a clean worktree.
3. Record the exact deployed Render source/image and effective runtime configuration.
4. Create an owner-approved rollback reference before implementation.
5. Inventory every active OpenAI-paid path in the pinned OpenClaw version.
6. Record whether each path exposes trusted identity, request correlation, actual
   usage, provider request ID, completion status and price dimensions.
7. Record every gap before choosing an implementation surface.

Phase 0 is read-only except for the separately approved rollback reference.

## Phase 1 — failing contracts before implementation

Add red tests proving all required behavior before adding the billing implementation:

1. one provider event produces exactly one ledger event;
2. replaying an event cannot produce a second charge;
3. two Global IDs never share balance or usage;
4. one Global ID shares its balance across direct messages and groups;
5. a paid action is rejected when available prepaid balance is insufficient;
6. a reservation cannot make available balance negative;
7. final settlement appends charge and release entries atomically without rewriting
   the original reservation journal entry;
8. unused reservation is returned;
9. failed work is refunded unless evidence proves a provider cost occurred;
10. the customer charge is exactly provider cost multiplied by `2`;
11. cached input and cache-write usage use their own price dimensions;
12. reasoning already included in output is not charged again;
13. text, images, audio, video, files and paid hosted tools have covered paths;
14. an unknown reconciliation difference is not charged to a user;
15. a citizen cannot read or mutate another account;
16. only the Monarch can top up or manually adjust balances;
17. restart/replay cannot lose or duplicate financial records;
18. model override and fallback charge every model call actually performed.
19. every admitted operation has an enforceable maximum provider cost covered by its
    reservation;
20. an unexpected provider overrun records the full incurred charge, locks further
    paid admission and exposes the debt to the Monarch instead of losing the cost;
21. monetary conversion uses the declared rounding rule exactly once and preserves
    the original provider amount and price evidence;
22. estimated charges preserve the exact price-table version and effective date used.

Tests must verify behavior, database state and authority boundaries, not only source
text.

## Phase 2 — plugin-owned SQLite ledger

Create one plugin-owned database:

```text
<OPENCLAW_STATE_DIR>/sg/billing.sqlite
```

Use integer nano-USD values (`1 USD = 1,000,000,000 nano-USD`) for ledger accounting.
Do not use floating-point values for balances, reservations or transaction totals.
Parse provider monetary decimals and price-table rates as exact decimal/rational
values, calculate `raw provider cost × 2`, and round the final customer charge once,
half-up to the nearest nano-USD. Preserve the unrounded provider decimal or rational
inputs as evidence so reconciliation never depends on a rounded reconstruction.

### Account records

Each account is keyed only by the trusted SG Global ID and stores:

- currency (`USD` initially);
- settled prepaid balance;
- active reservation total;
- account status;
- creation and update timestamps.

### Immutable transactions

The transaction journal supports:

- `topup`;
- `reserve`;
- `charge`;
- `release`;
- `refund`;
- `adjustment`;
- `reconciliation_adjustment`, only when backed by explicit evidence and Monarch
  authority.

Each record stores an idempotency key, Global ID, monetary amount, raw provider cost,
multiplier, provider, model, cost category, run/tool/request correlation, evidence
level and timestamp. Estimated records also store the price rate, billing unit,
price-table source/version and effective timestamp. Existing journal rows are not
edited or deleted; settlement appends linked `charge` and `release` entries, and
corrections use reversing transactions. A separate derived reservation projection may
mark a reservation settled for efficient lookup, but the journal remains append-only
and fully rebuildable.

### Usage records

Store the applicable measured dimensions without forcing every product into tokens:

- input/output/cache-read/cache-write tokens;
- text/audio/image token details when supplied;
- characters;
- seconds or minutes;
- images and quality/size;
- search calls;
- sessions;
- storage bytes and time;
- provider-specific billable quantity and unit.

### Reconciliation records

Store the time window, OpenAI organization amount, matched SG ledger amount,
difference, evidence, status and review timestamps. A reconciliation record does not
rewrite historical user charges silently.

## Phase 3 — prepaid reservation and settlement

1. Resolve the actor from trusted channel/session context.
2. Require an active Global ID account for paid work.
3. Calculate a conservative reservation from an enforceable maximum for the paid
   operation before it starts. Apply native token, duration, count, storage and tool
   limits as appropriate; reject a path that has no safe enforceable upper bound.
4. Atomically check and reserve available funds.
5. Block admission through the appropriate native OpenClaw gate when funds are
   insufficient.
6. Correlate the accepted operation using stable run, tool-call and provider-request
   identifiers.
7. After completion, calculate or receive the actual provider cost.
8. Calculate the final user charge with the fixed multiplier `2`.
9. Atomically append the final charge and release entries linked to the reservation;
   never edit or replace the original journal entry.
10. On failure, release the reservation unless provider evidence shows that a cost was
    incurred.
11. Leave an uncertain paid event in `pending` state for reconciliation; do not guess.
12. If provider evidence unexpectedly exceeds the reservation despite the enforced
    limit, record the complete incurred charge, place the account in `billing_hold`,
    expose the resulting debt to the Monarch and deny new paid work until corrected.

Long-running and detached work owns its reservation until a terminal result is
recorded.

## Phase 4 — text-model accounting

1. Reuse OpenClaw's normalized model usage from the model lifecycle.
2. Attribute it to the Global ID bound to the trusted run context.
3. Record the resolved provider/model, not only the requested model.
4. Record input, output, cache read and cache write separately.
5. Respect the actual service tier and long-context pricing where applicable.
6. Prefer provider-billed monetary cost when explicitly supplied.
7. Otherwise calculate from actual usage and the exact active model price entry.
8. Record every fallback/retry call that incurred usage.
9. Settle the reservation using `provider cost × 2`.
10. Preserve the evidence level so estimates cannot be confused with reconciled cost.

## Phase 5 — model routing

Use OpenClaw's `before_model_resolve` hook. Do not introduce a second model gateway
unless a later audit proves the native hook inadequate and the owner approves the
architecture change.

### Initial tiers

| SG mode     | Initial model                     | Purpose                                       |
| ----------- | --------------------------------- | --------------------------------------------- |
| `cheap`     | `openai/gpt-5.6-luna`             | Simple answers and short operations           |
| `medium`    | `openai/gpt-5.6-terra`            | Normal SG work                                |
| `expensive` | `openai/gpt-5.6-sol`              | Complex analysis, development and large tasks |
| `auto`      | Minimum sufficient available tier | SG policy selects the tier                    |

The exact model IDs must be confirmed against the deployed provider catalog and owner
account before activation. A missing model must fail clearly or use an explicitly
approved fallback; it must not silently change the business policy.

### Auto policy

1. Simple short requests, translation, formatting and basic lookup start on `cheap`.
2. Normal analysis, file work, memory and tool use start on `medium`.
3. Complex reasoning, project development, architecture and large-context work start
   on `expensive`.
4. Attachments and required tool/model capabilities may raise the minimum tier.
5. Auto routing itself must not call another paid model.
6. If a lower tier cannot complete the task, native fallback may raise the tier.
7. Every model call actually made is metered and charged.
8. User-requested higher quality overrides Auto when the selected model is available.

### User controls

Provide:

- `/sg_model auto`;
- `/sg_model cheap`;
- `/sg_model medium`;
- `/sg_model expensive`;
- `/sg_model status`.

The preference belongs to the Global ID and follows the user across channels.

## Phase 6 — images

1. Correlate every `image_generate` or edit request to the trusted Global ID.
2. Record the resolved model, source, image count, size, quality and relevant token
   usage.
3. Supply the OpenAI end-user identifier where the official request contract supports
   it, without treating it as the sole accounting authority.
4. Preserve provider-returned usage metadata when available.
5. Observe the terminal result of foreground and detached generation.
6. Settle successful work using the correct price dimensions and multiplier `2`.
7. Keep uncertain failed requests pending until the provider cost can be established.
8. Reconcile image counts and cost categories against OpenAI organization data.

## Phase 7 — audio and voice

Implement separate meters for:

1. text-to-speech characters/tokens and resolved model;
2. transcription duration/tokens and resolved model;
3. realtime audio input, cached audio input, audio output and accompanying text tokens;
4. every retry or fallback that incurs provider usage.

The audio provider result or a generic completion event must expose enough terminal
metadata to settle the original reservation. When it does not, add only the minimal
generic Plugin SDK observability field/event after separate approval.

## Phase 8 — files, analyses and hosted tools

Meter the billable work caused by a file or analysis rather than charging merely for a
local file upload. Covered categories include:

1. model input tokens used to read documents;
2. embeddings generated during indexing or search;
3. file-search calls;
4. vector-store storage duration;
5. code-interpreter sessions;
6. image tokens used for document pages;
7. OpenAI native web-search calls;
8. any other paid hosted tool reported by OpenAI.

The user charge for every attributable category remains actual provider cost multiplied
by `2`.

## Phase 9 — detached operation observability

The audited OpenClaw media path can detach accepted image/video work and return a task
handle before provider completion. A normal `after_tool_call` observer can therefore
see admission without always seeing terminal usage and metadata.

First audit all existing detached-task completion surfaces. If none safely exposes the
terminal result, add one generic Plugin SDK event, provisionally named:

```text
billable_operation_completed
```

It must carry only generic observability data:

- run and tool-call identifiers;
- provider and resolved model;
- operation category;
- terminal success/error state;
- provider request identifier when available;
- normalized usage or other billable quantity;
- non-secret pricing dimensions such as duration, size and quality.

The core event performs no SG balance logic. All reservation and charging policy stays
in the external SG plugin.

## Phase 10 — video

1. Model video accounting as the provider-neutral `video_generation` category.
2. Record provider, model, duration, size, quality and terminal state.
3. Reserve the conservative full charge before the long-running job is accepted.
4. Settle only from a terminal result or adequate provider evidence.
5. Do not build permanent SG logic around the deprecated OpenAI Sora `/videos`
   contract.
6. Re-audit and adapt to OpenAI's replacement video API before production activation.

As of this plan date, the documented Sora API is scheduled to shut down on
2026-09-24 and OpenAI exposes no separate organization Video Usage endpoint. This is a
known activation blocker, not permission to omit video from the final billing scope.

## Phase 11 — OpenAI organization reconciliation

Use OpenClaw's existing OpenAI usage-provider integration and extend only the missing
SG reconciliation semantics.

Required secrets/configuration, subject to separate owner approval:

```text
OPENAI_ADMIN_KEY
OPENAI_PROJECT_ID
```

1. Fetch organization Costs and all relevant Usage categories for a closed time
   window.
2. Store the provider source window and pagination completion state.
3. Compare organization cost with the corresponding SG request ledger.
4. Mark safely matched records as reconciled.
5. Record rounding, delayed billing and price-table differences explicitly.
6. Surface any remaining difference to the Monarch.
7. Never divide an unmatched difference among users.
8. Never write the Admin key to Git, SQLite, logs, replies, prompts or memory.

## Phase 12 — commands and presentation

### User commands

- `/sg_balance` — settled balance, active reserve and available balance;
- `/sg_usage` — period usage and charges;
- `/sg_usage_last` — last settled or pending operation;
- `/sg_model` — view or change routing mode;
- `/sg_prices` — explain that every attributable OpenAI cost is charged at `×2`.

### Monarch-only commands

- `/sg_billing_topup <global-id> <amount>`;
- `/sg_billing_adjust <global-id> <amount> <reason>`;
- `/sg_billing_user <global-id>`;
- `/sg_billing_report`;
- `/sg_billing_reconcile`;
- `/sg_billing_diag`.

Top-ups and adjustments require explicit audit records. A manual correction creates a
new reversing/adjustment transaction and never edits financial history.

In the initial release, `/sg_billing_topup` records a payment only after the Monarch
has verified receipt outside SG. It does not collect money, trust a citizen's payment
claim or call a payment provider. Any automatic payment provider, webhook or refund
flow is out of scope until separately audited and approved.

## Phase 13 — security and integrity

1. Resolve Global ID from trusted current-run identity; never accept it as a user tool
   parameter for authorization.
2. Use database transactions for reservation and settlement.
3. Enforce unique idempotency keys at the database level.
4. Forbid admission or reservation that would make available balance negative. An
   evidence-backed unexpected provider overrun records debt, sets `billing_hold` and
   blocks further paid admission rather than hiding an incurred cost.
5. Make journal entries append-only.
6. Redact secrets and user content from billing records and logs.
7. Deny cross-user balance and usage access.
8. Keep top-up, adjustment, reconciliation and global reporting Monarch-only.
9. Preserve all existing OpenClaw denial and citizen infrastructure boundaries.
10. Make migrations restart-safe, idempotent and covered by rollback evidence.

## Phase 14 — verification matrix

Run and record proof for:

1. SG unit and contract tests;
2. Plugin SDK lifecycle tests if a generic event is added;
3. SQLite schema creation and migration;
4. concurrent requests from one Global ID;
5. concurrent requests from different Global IDs;
6. duplicate delivery and replay after restart;
7. insufficient and exactly sufficient balances;
8. failed, cancelled and timed-out provider work;
9. reservation release and refund behavior;
10. all four routing modes and user override;
11. model fallback with multiple paid calls;
12. text and cached-token accounting;
13. foreground and detached image generation;
14. TTS, transcription and realtime voice;
15. embeddings, file search, web search, vector storage and code interpreter;
16. the current supported video replacement path;
17. organization reconciliation and visible unattributed difference;
18. cold restart persistence;
19. citizen isolation and Monarch-only administration;
20. proof that `main` and the standard Telegram adapter remain unchanged.
21. exact decimal parsing, one-time half-up nano-USD rounding and price-table snapshot
    replay;
22. enforced maximum-cost admission and the exceptional provider-overrun hold path;
23. append-only reservation settlement with a journal rebuild producing the same
    balances.

## Phase 15 — staged activation

1. Deploy first in observation-only mode with charging disabled.
2. Exercise real paid paths using only the Monarch account.
3. Compare SG records with closed OpenAI organization billing windows.
4. Fix every missing or duplicate attribution path before enabling settlement.
5. Enable test settlement for the Monarch only.
6. Verify balances and idempotency across a Render restart.
7. Enable citizen prepaid admission only after the complete paid-path matrix passes.
8. Keep a runtime kill switch that stops new paid admission without destroying ledger
   history or active reconciliation evidence.

Production billing must not be declared complete while any active OpenAI-paid path can
bypass attribution or settlement.

## Mandatory approval gates

The following remain separate owner decisions:

1. implementation changes in the external SG plugin;
2. any minimal generic Plugin SDK/core observability change;
3. new environment variables or secrets;
4. commit;
5. push;
6. Render deployment;
7. production activation of real user balance charging.

## Closure gate

This roadmap may be marked CLOSED only when all are true:

- all active paid OpenAI paths have attribution and settlement evidence;
- the full red-test matrix passes;
- duplicate events cannot double-charge;
- balance enforcement is atomic and restart-safe;
- every customer charge uses the fixed multiplier `2`;
- estimates and provider-billed amounts are visibly distinguished;
- organization-level differences remain explicit and are never assigned arbitrarily;
- Auto and manual routing select only confirmed available models;
- citizen functional rights were not reduced by billing work;
- infrastructure authority remains Monarch-only;
- OpenClaw core remains authoritative and no parallel provider/runtime platform was
  introduced;
- live Render and Telegram verification passed at the exact deployed commit;
- the owner explicitly approved production charging.

## Official references recorded at approval time

- OpenAI organization Usage and Costs API:
  <https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage>
- OpenAI API pricing:
  <https://developers.openai.com/api/docs/pricing>
- OpenAI image generation API:
  <https://developers.openai.com/api/reference/resources/images/methods/generate>
- OpenAI video API:
  <https://developers.openai.com/api/reference/resources/videos/methods/create>

Prices, model availability and provider API lifecycle are time-dependent. They must be
rechecked against official OpenAI documentation and the deployed account/catalog at
implementation and again before production activation.
