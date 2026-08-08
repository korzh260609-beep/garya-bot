# Block 16.8 — Secrets & Credentials Management

## Status
Planned.

## Goal
Create a first-class secret and credential boundary so SG can use external services without placing credentials in memory, prompts, ordinary configuration, logs or user-visible context.

## Required scope
- secret references/handles rather than raw secret propagation;
- support for API keys, bot tokens, OAuth credentials and service credentials;
- ownership and scope metadata for credentials;
- permission-bound credential access;
- rotation, revocation and expiry state;
- provider/deployment secret-store integration;
- redaction in logs, errors and diagnostics;
- audit evidence for credential use without secret values;
- isolation between users, projects and external connections.

## Boundaries
- raw secrets never become confirmed memory or ordinary ContextBundle data;
- transports and AI models never receive secrets unless a capability contract explicitly requires a bounded provider credential path;
- possession of a credential does not grant authorization;
- Action Gate and Resource Authority still decide whether an operation is allowed;
- Block 19 later hardens and audits this mechanism operationally.

## Acceptance criteria
- no repository or ordinary telemetry contains production secret values;
- credentials are referenced by stable identifiers;
- revoked/expired credentials fail visibly and safely;
- access is auditable by actor, connection/resource and purpose;
- cross-user/project secret leakage tests pass.
