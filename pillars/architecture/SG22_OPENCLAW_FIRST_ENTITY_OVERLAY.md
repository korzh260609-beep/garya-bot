# SG 2.2 — Entity Above OpenClaw

## Status
CANONICAL ARCHITECTURAL PRINCIPLE

## Principle
The SG 2.2 project is the creation and evolution of the SG entity above OpenClaw.

OpenClaw remains OpenClaw: the authoritative technical platform and runtime underneath. SG is not a rewritten OpenClaw and OpenClaw is not converted into SG.

```text
OpenClaw = authoritative technical platform / runtime
SG entity = identity + governing semantics + SG-specific domain layer above OpenClaw
SG 2.2 project = building and evolving that SG entity above OpenClaw
```

OpenClaw must be used to the maximum practical extent.

## Full capability inheritance
The SG entity inherits the full standard OpenClaw capability surface that is technically available and permitted in the active environment.

This is not implemented through a manually maintained SG whitelist. SG must not expose only selected OpenClaw functions when the underlying platform can provide more.

A capability may be unavailable only because of a real authoritative boundary:
- credentials or permissions;
- OpenClaw security, approvals, sandboxing, pairing or policy;
- deployment/platform limitations;
- capability not installed or configured;
- technical unavailability;
- explicit owner restriction.

This applies to current and future OpenClaw functionality. New standard OpenClaw capabilities should become usable by SG through the same inheritance rule without requiring a separate SG-specific runtime or bespoke enablement block for each one.

## Mandatory implementation order
For every SG 2.2 capability:
1. Audit the current OpenClaw implementation.
2. If OpenClaw already provides the capability, keep it authoritative.
3. Bind the SG entity to that capability through native OpenClaw mechanisms.
4. Preserve the normal OpenClaw capability range unless a real boundary applies.
5. Extend only the SG-specific semantics that are missing.
6. Add SG-owned runtime code only for genuinely absent or SG-specific behavior.
7. Do not close the block while a duplicate SG/OpenClaw subsystem remains.

## Global ownership
OpenClaw is preferred as the owner of platform/runtime capabilities including:
- agent/runtime lifecycle;
- tools, skills and plugins;
- sessions and routing;
- channels and delivery;
- browser, web, files, media and device/node capabilities;
- identity linking and channel identity;
- security, approvals, pairing and access controls;
- memory/search foundations;
- tasks and automations;
- model/provider handling;
- workspace, shell, Git and GitHub/development tooling;
- diagnostics and observability;
- future platform capabilities added upstream.

The SG entity owns only what makes the system SG:
- SG identity and self-definition;
- Monarch/user relationship and SG Global Profile semantics;
- SG-specific roles and domain metadata;
- SG-specific memory/project/development knowledge semantics not already represented by OpenClaw;
- SG-specific semantic model, policies, business rules, presentation and GARYA-domain functions;
- controlled evolution of the SG entity.

## Forbidden by default
Do not create a second:
- agent loop/runtime;
- tool/capability platform;
- channel runtime;
- identity/linking system;
- permission/approval engine;
- memory/search engine;
- scheduler/task queue/automation executor;
- model/provider runtime;
- Git/GitHub development executor;
- observability platform.

Do not create an SG-only capability whitelist that narrows the OpenClaw platform without a concrete owner-authorized requirement.

An exception requires concrete evidence that the OpenClaw mechanism is inadequate for required SG behavior. The exception must be the smallest extension possible and must preserve OpenClaw lifecycle/security boundaries.

## Upstream preservation
OpenClaw core should remain as close to upstream as practical so SG 2.2 continues benefiting from OpenClaw fixes and new capabilities. Prefer SG workspace files, configuration, plugins, skills, hooks, adapters and narrow extension points over core forks.

## Project definition
The SG 2.2 project is not "OpenClaw with SG added to it" and not "OpenClaw turned into SG".

**The SG 2.2 project is the SG entity itself, built as a governing and domain layer above OpenClaw, with access to the full standard OpenClaw capability surface available in its environment.**

## Synchronization rule
This principle is authoritative for every roadmap point and future SG 2.2 implementation. When older SG 2.0/2.1 architecture conflicts with it at the technical implementation level, preserve SG meaning but re-express it above OpenClaw instead of porting the old subsystem wholesale.
