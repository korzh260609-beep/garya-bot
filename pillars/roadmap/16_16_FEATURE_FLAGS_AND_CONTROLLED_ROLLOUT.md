# Block 16.16 — Feature Flags & Controlled Rollout

## Status
Planned.

## Goal
Create a centralized feature-flag and rollout layer so new SG capabilities can be enabled, limited, tested and disabled without changing core architecture or requiring broad deployment exposure.

## Required scope
- stable feature identifiers;
- global, environment, project, role, user and resource targeting where approved;
- deterministic precedence;
- percentage rollout using stable bucketing when needed;
- explicit test cohorts;
- emergency disable/kill switches;
- expiry/review metadata for temporary flags;
- audit and observability for flag decisions;
- integration with Configuration & Policy Layer;
- no-redeploy enable/disable only where operationally safe.

## Boundaries
- a feature flag cannot grant a permission the actor does not already possess;
- flags cannot bypass Action Gate, Resource Authority or safety rules;
- security-critical defaults fail closed;
- feature flags are not permanent substitutes for product/domain policy;
- hidden flags must not depend on secret words or user phrases.

## Acceptance criteria
- features can be restricted to monarch/test cohort/project before broad rollout;
- disabling a flagged feature prevents new use without corrupting existing durable work;
- deterministic bucketing is stable across restarts;
- every decision can be diagnosed by effective flag source;
- tests cover precedence, kill switch, cohort targeting and authorization interaction.
