# SG 2.2 — Full OpenClaw Capability Inheritance

## Status
CANONICAL GLOBAL RULE

## Rule
The SG entity above OpenClaw must be able to use the full standard OpenClaw capability surface available in the active environment.

This is not a manually maintained SG whitelist and is not limited to capabilities explicitly named in the SG roadmap.

All current and future standard OpenClaw capabilities are considered available to SG when they are:
- present in the deployed OpenClaw version;
- installed/configured where required;
- technically usable in the deployment environment;
- permitted by authoritative credentials, permissions, security, approvals, sandboxing, pairing and policy.

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

## Future compatibility
When OpenClaw gains a new standard capability, SG should inherit its usability through the same general OpenClaw capability surface without requiring a dedicated SG runtime or a new parallel implementation.

A new SG roadmap block is required only when SG-specific semantics, policy, domain state or presentation must be added above that OpenClaw capability.

## Implementation rule
For every SG 2.2 block:
1. Audit OpenClaw first.
2. Reuse the native capability when it exists.
3. Keep the standard OpenClaw capability range available to SG.
4. Add only missing SG-specific semantics.
5. Do not create a duplicate subsystem.
6. Do not close a block if SG-specific wiring unnecessarily narrows OpenClaw.

## Relation to SG 2.2 project
Project SG 2.2 is the creation and evolution of the SG entity above OpenClaw. OpenClaw remains the platform; the SG entity uses the platform's complete permitted capability surface and adds only what makes the system SG.
