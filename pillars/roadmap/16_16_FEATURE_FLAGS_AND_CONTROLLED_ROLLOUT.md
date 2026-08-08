# Block 16.16 — Feature Flags & Controlled Rollout

## Status
Completed.

## Goal
Create a centralized feature-flag and rollout layer so new SG capabilities can be enabled, limited, tested and disabled without changing core architecture or requiring broad deployment exposure.

## Implemented scope
- stable feature identifiers with versioned flag records;
- centralized `FeatureFlagService` with in-memory and PostgreSQL stores;
- global enable/disable plus environment, project, role, user, resource and explicit cohort targeting;
- deterministic targeting order: kill switch/expiry/global disable → Configuration & Policy tightening → environment → project → role → user → resource → cohort → authorization boundary → percentage rollout;
- deterministic SHA-256 stable percentage bucketing on feature ID + stable subject key;
- explicit test/pilot cohorts without keyword or phrase bindings;
- emergency kill switch that overrides all other targeting;
- expiry/review metadata for temporary flags, with temporary flags required to declare at least one lifecycle boundary;
- privacy-bounded `feature_flag_resolved` observability including effective source, reason code, bucket and bounded scope identifiers;
- Configuration & Policy integration as a tightening-only input;
- PostgreSQL migration `176_feature_flags.sql` for durable no-redeploy operational changes;
- capability execution integration through `FeatureFlaggedCapabilityExecutor`: only explicitly configured `capability:<name>` flags are evaluated, preserving existing behavior for unflagged capabilities;
- feature evaluation occurs only after Action Gate authorization evidence is available, so flags can restrict execution but cannot grant permissions, resource authority or authorization;
- runtime diagnostics expose the feature flag layer as ready;
- disabling a flagged capability blocks new execution without modifying already-persisted task records.

## Boundaries
- a feature flag cannot grant a permission the actor does not already possess;
- flags cannot bypass Action Gate, Resource Authority or safety rules;
- security-critical/missing flags fail closed when explicitly resolved;
- unconfigured capability flags preserve existing behavior until the capability is deliberately placed behind a flag;
- feature flags are not permanent substitutes for product/domain policy;
- hidden flags never depend on secret words, commands or user phrases;
- flag targeting does not create identity, role, grant, ownership, cohort membership or resource authority;
- kill switches affect new flagged execution only and do not silently mutate durable queued work.

## Acceptance verification
- monarch/test cohort/project targeting is covered by deterministic unit tests;
- kill switch overrides all targeting;
- stable percentage bucketing is unchanged across service/PostgreSQL restart;
- unsupported authorization state cannot be made executable by enabling a flag;
- Configuration & Policy can disable/tighten a feature but cannot enable an otherwise disabled flag;
- temporary flag expiry fails closed;
- effective decision source is observable without raw user messages/phrases;
- PostgreSQL flag state survives restart;
- production runtime capability execution is actually blocked/enabled by configured capability flags;
- unconfigured capabilities preserve the existing production path;
- disabling new use leaves an existing durable task unchanged.

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

## Acceptance criteria
- [x] features can be restricted to monarch/test cohort/project before broad rollout;
- [x] disabling a flagged feature prevents new use without corrupting existing durable work;
- [x] deterministic bucketing is stable across restarts;
- [x] every decision can be diagnosed by effective flag source;
- [x] tests cover precedence, kill switch, cohort targeting and authorization interaction.
