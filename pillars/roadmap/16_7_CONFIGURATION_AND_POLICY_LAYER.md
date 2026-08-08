# Block 16.7 — Configuration & Policy Layer

## Status
Planned.

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

## Boundaries
- configuration does not grant identity or permissions by itself;
- policy does not bypass Action Gate;
- secrets are references only and belong to Block 16.8;
- transport adapters do not own business policy;
- environment variables are inputs, not the long-term policy architecture.

## Acceptance criteria
- effective configuration is deterministic and inspectable;
- conflicting policy sources resolve by explicit precedence;
- invalid mandatory config prevents unsafe startup;
- modules consume configuration through approved contracts rather than local hidden constants;
- tests cover defaults, overrides, invalid values and policy precedence.
