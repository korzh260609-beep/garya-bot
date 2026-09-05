# SG 2.2 — Full OpenClaw Capability Inheritance

## Status
CANONICAL GLOBAL RULE / MANDATORY ROADMAP GATE

## Rule
The SG entity above OpenClaw must be able to use the full standard OpenClaw capability surface available in the active environment.

This is not a manually maintained SG whitelist and is not limited to capabilities explicitly named in the SG roadmap.

All current and future standard OpenClaw capabilities are considered available to SG when they are:
- present in the deployed OpenClaw version;
- installed/configured where required;
- technically usable in the deployment environment;
- permitted by authoritative credentials, permissions, security, approvals, sandboxing, pairing and policy.

## Mandatory roadmap interpretation
Every SG 2.2 work item must be interpreted in this order:

```text
What OpenClaw already provides
        ↓
Make that capability usable by the SG entity
        ↓
Add only missing SG-specific semantics/domain behavior
```

The roadmap must never be interpreted as:

```text
Take the SG 2.1 subsystem
        ↓
rebuild/port it beside OpenClaw
```

For Points 5–16 in particular, the default task type is **OpenClaw capability audit + SG semantic/domain overlay**, not development of a replacement subsystem.

## No artificial narrowing
SG-specific code must not create a separate allowlist that exposes only selected OpenClaw capabilities.

SG-specific code must not silently reduce, shadow, fork, replace or disable standard OpenClaw capability availability.

A capability may be unavailable only because of a real boundary:
- missing or insufficient credentials/permissions;
- OpenClaw security, approval, sandboxing, pairing or access policy;
- deployment/platform limitation;
- capability not installed/configured;
- technical unavailability;
- explicit owner restriction.

## Capability scope
This rule includes, but is not limited to:
- agents and agent lifecycle;
- tools, skills and plugins;
- channels, sessions and routing;
- browser, web, files and media;
- nodes and device-local actions;
- memory and search;
- tasks, schedules and automations;
- model providers and model selection;
- workspace and shell;
- Git, GitHub and repository-development tooling;
- diagnostics and observability;
- future capabilities introduced by OpenClaw.

## Work-list mapping
The canonical SG 2.2 list must be understood as follows:

1. **OpenClaw foundation** — preserve clean OpenClaw as the technical base.
2. **SG entity** — create the SG entity above OpenClaw; this is the beginning of Project SG itself.
3. **Identity / Global ID / roles** — add SG identity/profile semantics on top of OpenClaw identity, not a second identity runtime.
3A. **Telegram test runtime** — expose the SG entity through OpenClaw Telegram, not through a new SG transport.
4. **GitHub/repository access** — let SG use OpenClaw's complete permitted Git/GitHub/development capabilities, not a special SG GitHub subsystem.
5. **Memory 2.0** — audit and use OpenClaw memory first; add only SG lifecycle/isolation/metadata semantics that are missing.
6. **Project Memory 3.0** — add SG project-memory semantics above OpenClaw memory/workspace, not a separate Project Memory platform.
7. **PDK4** — add SG durable development-knowledge semantics above OpenClaw development/Git capabilities, not a second development runtime.
8. **Historical & Semantic Search** — extend OpenClaw memory search only for SG-specific historical semantics that are missing.
9. **Canonical Semantic Model** — add SG semantic normalization above the OpenClaw agent/dispatch lifecycle, not another agent loop or dispatcher.
10. **Action Gate** — express SG-specific risk/confirmation semantics through OpenClaw security/approval mechanisms, not a second permission engine.
11. **AI policy/cost** — use OpenClaw provider/model/auth/routing capabilities and add only SG quality/cost policy and accounting semantics where missing.
12. **Tasks/Automation** — use OpenClaw tasks/automations as authoritative; add SG ownership/semantics/presentation only where missing.
13. **Channels** — the same SG entity must operate through all permitted OpenClaw channels; do not create SG channel runtimes.
14. **Sources** — use OpenClaw web/browser/file/provider tools; add only SG source-management semantics where required.
15. **Groups/users/subscriptions** — use OpenClaw channel/access identity mechanisms;
    follow `pillars/roadmap/SG22_ROLE_MODEL_MIGRATION_PLAN.md` for automatic citizenship,
    Global-ID personal workspaces and removal of parallel SG group roles.
16. **Observability** — use OpenClaw diagnostics/telemetry and add only SG-specific events/metrics/audit records where required.
17. **Authority/duplication audit** — verify both that no duplicate SG platform systems exist and that SG has not lost any permitted OpenClaw capability.
18. **Full verification** — verify SG behavior plus full permitted OpenClaw capability inheritance at the exact tested commit.

## Future compatibility
When OpenClaw gains a new standard capability, SG should inherit its usability through the same general OpenClaw capability surface without requiring a dedicated SG runtime or a new parallel implementation.

A new SG roadmap block is required only when SG-specific semantics, policy, domain state or presentation must be added above that OpenClaw capability.

## Implementation rule
For every SG 2.2 block:
1. Audit OpenClaw first.
2. Reuse the native capability when it exists.
3. Make that native capability usable by the SG entity.
4. Keep the standard OpenClaw capability range available to SG.
5. Add only missing SG-specific semantics.
6. Do not create a duplicate subsystem.
7. Do not close a block if SG-specific wiring unnecessarily narrows OpenClaw.

## Closure gate
No SG 2.2 block may be CLOSED unless all are true:
- the relevant OpenClaw capability was audited;
- adequate OpenClaw capability remains authoritative;
- SG can use the permitted native capability;
- only missing SG-specific semantics were added;
- no parallel replacement subsystem remains;
- SG-specific wiring did not artificially reduce the standard OpenClaw capability surface.

## Relation to SG 2.2 project
Project SG 2.2 is the creation and evolution of the SG entity above OpenClaw. OpenClaw remains the platform; the SG entity uses the platform's complete permitted capability surface and adds only what makes the system SG.
