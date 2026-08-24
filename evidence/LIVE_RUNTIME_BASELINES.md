# SG 2.1 — LIVE RUNTIME BASELINES

This file stores factual runtime evidence for historically useful checkpoints. It is not architecture, roadmap, or completion evidence for unrelated features.

## Baseline LB-001 — live Telegram conversational responses restored

- Branch: `dev/sg2.1-semantic`
- Revision: `ecb11b5effe2c106b20df78306a5269ae9a33075`
- CI: `SG 2.1 CI #6867` — `SUCCESS`
- Environment evidence: live Telegram test after deployment of this revision
- Date: 2026-08-09

### Confirmed working

At this revision SG responds in live Telegram instead of exact-echoing the user's message.

Observed examples:

- user `привет` → SG generated a normal conversational greeting;
- user `кто ты?` → SG generated a substantive answer;
- user `кто я?` → SG generated a substantive answer based at least on Telegram-visible identity data.

This revision is therefore the first explicitly recorded **known-good live conversational-response baseline** after the exact-echo regression investigation.

### Still incorrect / not accepted as final behavior

The baseline proves that the conversational response path works. It does **not** prove correct Self Knowledge or user identity enrichment.

Observed remaining defects:

- `кто ты?` did not identify SG canonically as `Советник GARYA`;
- `кто я?` did not yet use the expected verified Global ID + full profile/allowed memory context;
- the response used Telegram-visible naming (`Корж Игорь`) rather than the intended canonical user identity/profile result.

### Diagnostic value

When a later revision regresses to silence, exact echo, or failure to generate ordinary conversational responses, compare the critical path against this revision first:

`Telegram → canonical input → semantic interpretation → DecisionEngine → Action Gate → compose-answer → AI Router → final response → Telegram delivery`

Do not roll back Memory 2.0, Identity, or Self Knowledge merely because this baseline predates a later fix. Use this revision as a behavioral comparison point and isolate the first differing change in the critical response path.

### Evidence classification

- Live conversational response: `CONFIRMED`
- Exact-echo regression at this revision: `NOT OBSERVED` in the recorded live test
- Correct SG self-identity: `FAILED`
- Correct verified user identity/profile enrichment: `FAILED`

## Baseline LB-002 — verified SG and Monarch identity responses

- Branch: `dev/sg2.1-semantic`
- Revision: `9727982ae067b8dbf96ffca21465a1e63588f337`
- CI: `SG 2.1 CI #6876` — `SUCCESS`
- Environment evidence: live Telegram tests after deployment of this revision
- Date: 2026-08-09

### Confirmed working

This revision is a **known-good live identity baseline**.

Observed live Telegram behavior:

- `кто я?` resolved the current Telegram account to verified Global ID `usr_48cc07c069030fb3`;
- the same response exposed the verified role `monarch`;
- Telegram descriptive profile data was available without being used to create authority;
- `кто ты?` resolved SG canonically as `Советник GARYA (SG)`;
- the self-identity response used verified Self Knowledge facts for system name, entity type and purpose;
- the self-identity answer was dynamically composed rather than bound to the literal phrase `кто ты?`;
- semantic identity routing remains based on `self_identity` / `user_identity`, independent of exact wording, language, transport command syntax or secret phrases.

### Identity architecture confirmed by this baseline

`Telegram platform identity → canonical Global ID → roles/profile → BoundedResponseContext → semantic identity intent → Identity Response Contract → AI formatting → contract validation → Telegram response`

For SG self identity:

`Self Knowledge authority facts → BoundedResponseContext → self_identity contract → required canonical anchor Советник GARYA → AI formatting → validation`

AI may formulate the natural-language response, but it does not determine SG identity, Global ID, role or owner/Monarch authority.

### Diagnostic value

If a later revision regresses identity behavior, compare against this revision before changing Identity Resolver, Self Knowledge, Memory 2.0 or Telegram transport.

Specific regressions to detect:

- `кто я?` loses canonical Global ID or `monarch` role;
- Telegram display name is incorrectly treated as authority;
- `кто ты?` stops using `Советник GARYA`;
- identity answers become literal phrase handlers or static command responses;
- Self Knowledge canonical identity facts are truncated before Identity Response Contract;
- AI is allowed to invent or override verified identity facts.

### Evidence classification

- Live Telegram user identity resolution: `CONFIRMED`
- Monarch Global ID resolution: `CONFIRMED`
- Monarch role resolution: `CONFIRMED`
- Correct SG canonical self-identity: `CONFIRMED`
- Semantic identity routing without literal phrase binding: `CONFIRMED BY CODE + CI`, with live Russian wording verified
- Identity Response Contract enforcement: `CONFIRMED BY CODE + CI`
- Exact-echo regression in tested identity responses: `NOT OBSERVED`
