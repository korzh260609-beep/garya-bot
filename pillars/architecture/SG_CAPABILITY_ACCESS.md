# SG_CAPABILITY_ACCESS.md — SG 2.0 Capability Access

> AGENT NOTE:
> This file defines how SG 2.0 exposes capabilities to users and modules.
> Read it before adding commands, natural-language actions, tools, integrations, billing gates, or admin features.
> Do not confuse capability access with authority to redefine SG governance or architecture without explicit Monarch approval.

Статус: ACTIVE SKELETON

---

## Capability definition

Capability = what SG can do.

Examples:

- answer;
- analyze;
- search sources;
- read repo;
- prepare code;
- create task;
- send report;
- write repo;
- deploy.

---

## Access rule

A user may access a capability only if permissions, role, plan, context and confirmation rules allow it.

Target model:

```text
request -> capability -> permission -> confirmation -> execution
```

---

## Important distinction

Capability access is not governance authority.

A user may be allowed to use a feature without being allowed to change SG architecture, pillars, configs, repo, or source-of-truth policy.

---

## Monarch rule

Monarch has authority over SG architecture and project governance.

Other users may use approved capabilities, but they do not control SG itself unless Monarch explicitly grants a specific permission.
