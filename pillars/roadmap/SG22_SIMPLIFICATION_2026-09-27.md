# SG 2.2 simplification decision — 2026-09-27

Approved direction: SG remains a thin identity, policy and business layer above OpenClaw. OpenClaw owns sessions, model execution, fallback, delivery and diagnostics.

1. Remove the semantic response guard.
2. Remove the execution guard from ordinary replies.
3. Remove user-visible SG receipts and service JSON.
4. Remove SG turn/session/delivery correlation.
5. Keep model routing only in the native `before_model_resolve` hook.
6. Keep delivery and fallback entirely owned by OpenClaw.
7. Inject only dynamic SG identity and scope; workspace instructions remain the single behavior contract.
8. Remove the always-on SG context event recorder.
9. Keep billing and fix settlement, debt and `billing_hold` in a separate approved stage.
10. Keep permissions and centralize deterministic role checks and native approvals in a separate approved stage.
11. Do not rewrite Render, WSP5 or WSP6 in the current stage.
12. Do not change memory, skills, migrations or OpenClaw core in the current stage.

Rollback baseline: `backup/before-sg-simplification-2026-09-27` at `9c2bf7e09394f3195f556d0b7498e30289557ebd`.

Current implementation scope is limited to items 1–8. Commit, push, image publication and deployment require separate approval.
