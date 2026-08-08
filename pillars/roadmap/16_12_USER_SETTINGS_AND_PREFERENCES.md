# Block 16.12 — User Settings & Preferences

## Status
Planned.

## Goal
Create one typed, transport-independent user settings layer keyed by `global_user_id` so SG does not grow separate preference mechanisms for language, timezone, response style, delivery and future personalization.

## Required scope
- canonical UserSettings contract;
- preferred language and locale;
- timezone;
- response mode/length and presentation preferences;
- units, date/number formatting and accessibility preferences where supported;
- notification and preferred-delivery preferences;
- autonomy/confirmation preferences only within non-negotiable safety policy;
- provenance, updated_at and explicit-vs-inferred distinction;
- defaults and project-specific overrides where policy allows;
- persistence and migration strategy;
- read/write capabilities through existing authorization boundaries.

## Boundaries
- user preferences cannot weaken mandatory Action Gate, safety, identity or permission policy;
- inferred preferences must not silently overwrite explicit settings;
- transport-specific locale/settings are hints, not authoritative duplicates;
- sensitive profile data remains privacy-bounded.

## Acceptance criteria
- one global user keeps approved preferences across linked transports;
- explicit settings deterministically override defaults/hints;
- unrelated users/projects do not share settings;
- settings survive restart and schema evolution;
- language/timezone implementations converge on this shared settings boundary without breaking existing behavior.
