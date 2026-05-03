# SEMANTIC_ROUTING.md — Meaning-first Routing

> AGENT NOTE:
> This file defines the SG 2.0 routing philosophy.
> Read it before adding intent detection, command handlers, semantic controllers, AI classifiers, or capability routing.
> Do not replace model reasoning with keyword/regex routing without explicit Monarch approval.

Статус: ACTIVE

---

## Core formula

```text
meaning -> intent -> context -> capability -> permission -> source/tool -> action/answer
```

Forbidden formula:

```text
keyword -> reflex response
```

---

## Role of routing

Routing is not SG intelligence.

Routing is a small controller that helps SG:

- identify capability;
- check scope;
- check permissions;
- choose source/tool;
- detect read-only vs state-changing action;
- request confirmation;
- log important decisions.

---

## What must not happen

- A heavy router must not become a second brain.
- Regex must not become Human SG intelligence.
- Commands must not define the limits of SG understanding.
- Fallback phrases must not replace real source work.
- Routing must not bypass permissions.

---

## Early SG 2.0 approach

Start simple:

```text
user message
-> model understands meaning
-> minimal controller checks action type and permission
-> SG answers or prepares safe plan
```

Only add stronger routing after the skeleton is stable.
