# TWM1.9 — Natural-Language Configuration Workflow

## Configure from private chat

```text
user ordinary language
→ Telegram invocation accepted
→ canonical identity
→ list authority-filtered workspaces
→ AI Router strict classify/structure
→ exact workspace selected or ask clarification
→ parse bounded config patch
→ authorized current-config read
→ deterministic patch merge
→ TWM1.6 proposeChange
→ persist exact pending proposal with TTL
→ show Confirm / Cancel
```

No configuration is written before confirmation.

## Confirm

```text
Telegram callback token
→ durable update dedupe
→ canonical identity
→ actor-bound pending token claim
→ exact stored proposal
→ fresh TWM1.6 authority check
→ TWM1.7 Action Gate with original request id
→ allow only
→ atomic config + history write
→ mark pending completed
→ visible success
```

No AI call is made after confirmation.

## Group or channel context

```text
addressed message in managed workspace
→ resolve Telegram chat id to canonical workspace_id
→ verify actor may view workspace
→ force this workspace as NL scope
→ AI can classify intent/config patch only
→ cross-workspace redirect rejected
```

## Private ambiguity
If a TWM intent is recognized but no exact candidate workspace can be selected, SG asks the user to choose/name the workspace. It does not select the first item or infer ownership from text.

## History query

```text
NL question
→ AI identifies authorized workspace + namespace + optional path
→ TWM config history read
→ deterministic path-change filter
→ stored actor/version/time returned
```

The model does not supply numeric versions, actors or timestamps.

## Failure paths
- classification/AI failure on an ordinary message → ordinary SG runtime receives original text;
- `not-twm` → ordinary SG runtime receives original text;
- invalid structured output/config patch → no proposal/write;
- authority denial → no pending action/write;
- expired/wrong-actor/replayed token → no apply;
- Action Gate denial → pending fails and no config write;
- `twm19` callback failure never falls through to ordinary chat.

## Persistence
Pending confirmation records use the canonical PostgreSQL migrator and table `telegram_workspace_pending_actions`. They are restart-safe and bounded by expiry; they do not become Memory 2.0 facts.
