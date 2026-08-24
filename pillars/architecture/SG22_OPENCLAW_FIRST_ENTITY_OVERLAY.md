# SG 2.2 — OpenClaw-First Entity Overlay

## Status
CANONICAL ARCHITECTURAL PRINCIPLE

## Principle
SG 2.2 does not turn OpenClaw into a separately rebuilt SG runtime. SG gives OpenClaw the SG entity and adds only SG-specific semantics that are missing from OpenClaw.

OpenClaw must be used to the maximum practical extent.

```text
OpenClaw = authoritative technical platform
SG = entity + identity + governing semantics + SG-specific domain extensions
```

## Mandatory implementation order
For every SG 2.2 capability:
1. Audit the current OpenClaw implementation.
2. If OpenClaw already provides the capability, keep it authoritative.
3. Configure, bind or extend it through native OpenClaw mechanisms.
4. Add SG-owned runtime code only for missing SG-specific semantics or genuinely absent capabilities.
5. Do not close the block while a duplicate SG/OpenClaw subsystem remains.

## Global ownership
OpenClaw is preferred as the owner of platform/runtime capabilities including:
- agent/runtime lifecycle;
- tools and skills;
- sessions and routing;
- channels and delivery;
- identity linking and channel identity;
- security, approvals, pairing and access controls;
- memory/search foundations;
- tasks and automations;
- model/provider handling;
- workspace, shell, Git and GitHub/development tooling;
- diagnostics and observability.

SG owns only what makes the system SG:
- SG identity and self-definition;
- Monarch/user domain relationship and SG Global Profile semantics;
- SG-specific roles and domain metadata;
- SG-specific memory/project/development knowledge semantics that OpenClaw does not already represent;
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

An exception requires concrete evidence that the OpenClaw mechanism is inadequate for the required SG behavior. The exception must be the smallest extension possible and must preserve OpenClaw lifecycle/security boundaries.

## Upstream preservation
OpenClaw core should remain as close to upstream as practical so SG 2.2 can continue benefiting from OpenClaw fixes and new capabilities. Prefer SG workspace files, configuration, plugins, skills, hooks, adapters and narrow extension points over core forks.

## Synchronization rule
This principle is authoritative for every roadmap point and future SG 2.2 implementation. When older SG 2.0/2.1 architecture conflicts with it at the technical implementation level, preserve the SG meaning but re-express it using OpenClaw rather than porting the old subsystem wholesale.
