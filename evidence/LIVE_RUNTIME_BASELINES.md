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
