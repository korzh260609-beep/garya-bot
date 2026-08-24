# SG 2.1 live rollback checkpoint — 2026-08-15 19:46 +03:00

## Immutable rollback reference

- Repository: `korzh260609-beep/garya-bot`
- Development branch at checkpoint: `dev/sg2.1-semantic`
- Rollback branch: `checkpoint/twm1.14-live-20260815-1946`
- Rollback commit: `905da7b0beba7ecff01d386e2d85b04541aaf8bd`
- SG 2.1 CI: run `31894224962`, run number `7907`, SUCCESS on the rollback commit.
- `main` is not part of this checkpoint and must not be used as the SG 2.1 working branch.

## Live-confirmed at this checkpoint

- Telegram production runtime is deployed and operational.
- Telegram workspace discovery/configuration is operational from private chat / Mini App.
- Workspace configuration persists across restart/redeploy.
- Response modes are enforced in live Telegram workspace runtime.
- Immediate text publication to `GARYA_пісочниця` works.
- Telegram media publication path works in live acceptance performed before this checkpoint.
- Telegram poll/quiz publication path works in live acceptance performed before this checkpoint.
- Relative-time scheduled publication is fixed and live-confirmed end to end:
  - request in private Telegram chat;
  - confirmation;
  - canonical time resolved through TemporalService;
  - durable scheduled execution without a new user message;
  - autonomous publication in `GARYA_пісочниця` about five minutes later.
- The previously observed `twm-operation-failed` defect for relative scheduled publication is closed at this checkpoint.
- Identity / Resource Authority / Action Gate / Credential Manager remain part of the protected production path.

## Still OPEN / not accepted at this checkpoint

TWM1.14 and TWM1.15 are NOT CLOSED.

Outstanding or incomplete live acceptance includes:
- loss of actor admin rights before scheduled execution -> deny (intentionally deferred because removing the only safe admin could lock out the owner);
- restoration of rights -> allow;
- poll_answer acceptance from a second Telegram account;
- second-workspace isolation acceptance;
- analytics verification against persisted authoritative data;
- persistence acceptance for the remaining TWM1.14/TWM1.15 operational records;
- moderation/community actions with fresh rights checks;
- complete interactive multi-question test UX.

## Defect discovered immediately after checkpoint

A multi-question personality-style test requested for publication was flattened into ordinary static text. The published message exposed all questions and the result mapping immediately and provided no answer buttons or per-user scoring session.

Expected behavior for the next implementation:
- semantic selection of interactive `test.create`, not a phrase/keyword workaround;
- protected publication through canonical SG authorization/action gating;
- `Start test` button;
- sequential questions with answer buttons;
- persisted per-participant submission bound to Global ID;
- no result mapping exposed before completion;
- deterministic scoring after final answer;
- support both knowledge tests and profile/type tests;
- different users' sessions must not mix;
- existing Telegram poll/quiz behavior must remain unchanged.

## Rollback rule

If interactive-test development causes regressions that cannot be corrected safely, restore `dev/sg2.1-semantic` to the commit referenced by `checkpoint/twm1.14-live-20260815-1946` (`905da7b0beba7ecff01d386e2d85b04541aaf8bd`) rather than changing `main` or weakening SG security boundaries.
