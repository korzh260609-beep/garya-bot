# Block 16.7 — Configuration & Policy Layer

## Status
Completed and CI-verified.

## Goal
Create one authoritative configuration and policy layer for SG so runtime defaults, limits and operational policies are not scattered through transports, capabilities or ad-hoc constants.

## Required scope
- typed runtime configuration;
- environment-specific overrides;
- centralized defaults and limits;
- AI, capability, source, autonomy and delivery policy inputs;
- policy precedence and inheritance;
- validation and fail-closed behavior;
- provenance for effective policy values;
- hot-reload only where explicitly safe;
- observability for policy/config resolution without exposing secrets.

## Implemented
- typed `ConfigurationPolicyLayer` with immutable effective-policy snapshots;
- centralized policy domains for action, AI, capability, source, autonomy, automation, delivery, memory and repository behavior;
- deterministic precedence `defaults → environment → project → role` with explicit stable role precedence;
- validated optional environment inputs through `createEnvironmentPolicyOverrides`;
- per-policy-value provenance;
- explicit safe hot-reload allowlist that excludes authorization-sensitive policy;
- Action Gate consumption of effective action/source policy while identity, permission, scope, capability, source/tool availability and critical-risk boundaries remain fail-closed;
- Capability Executor policy limits that may tighten, but never broaden, declared retry/timeout behavior;
- Production AI timeout/retry composition through configuration policy while AI Router remains mandatory;
- secret-free `policy_context_resolved` observability with PostgreSQL persistence coverage;
- no new mandatory Render environment variables.

## Boundaries
- configuration does not grant identity or permissions by itself;
- policy does not bypass Action Gate;
- secrets are references only and belong to Block 16.8;
- transport adapters do not own business policy;
- environment variables are inputs, not the long-term policy architecture.

## Acceptance evidence
- deterministic effective configuration: covered by configuration-policy unit tests;
- explicit precedence and provenance: covered by defaults/environment/project/role tests;
- invalid values fail closed: unknown keys, wrong types and malformed environment values are rejected;
- runtime consumes policy before semantic processing and passes it to Action Gate and Capability Executor;
- AI operational limits are sourced through the centralized policy contract;
- source limits are enforced before protected execution;
- safe hot reload is allowlisted and immutable;
- GitHub Actions CI #6445 passed `npm ci`, migrations, `npm run check`, `npm start` and `npm run start:worker` on the completed implementation before documentation synchronization.

## Acceptance criteria
- [x] effective configuration is deterministic and inspectable;
- [x] conflicting policy sources resolve by explicit precedence;
- [x] invalid mandatory config prevents unsafe startup;
- [x] modules consume configuration through approved contracts rather than local hidden constants for the Block 16.7 policy surfaces;
- [x] tests cover defaults, overrides, invalid values and policy precedence.
