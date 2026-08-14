# Block 16.12 — User Settings & Preferences

## Status
Implemented on `dev/sg2.1-semantic`; final acceptance is enforced by SG 2.1 CI.

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

## Implemented architecture
- `src/settings/userSettingsService.js` is the canonical typed preference service keyed by `global_user_id`, with deterministic defaults, validation, field-level provenance, explicit/inferred distinction and project overrides.
- `src/settings/postgresUserSettingsStore.js` provides durable PostgreSQL storage through migration `172_user_settings_preferences.sql`.
- migration `172_user_settings_preferences.sql` preserves and imports existing Block 16.5 timezone and Block 16.6 language/locale state instead of creating competing preference stores.
- `src/settings/userSettingsAdapters.js` makes the existing language and temporal services consume the shared settings boundary without changing their public contracts.
- `user-settings-get` and `user-settings-set` capabilities expose authorized read/write access through the existing capability and Action Gate architecture.
- Production Runtime resolves effective settings before semantic interpretation. Ordinary execution payloads receive only bounded presentation preferences; delivery/autonomy/provenance state is not copied into ordinary capability payloads.
- Render Telegram identity bootstrap grants the settings capabilities through the existing role/grant system; transport locale remains a non-authoritative hint.
- preference autonomy is intentionally bounded to values that cannot disable mandatory confirmation or authorization policy.

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

## Acceptance evidence
Automated acceptance covers defaults, validation, explicit-over-inferred precedence, transport-hint precedence, global-user isolation, project overrides, Action Gate safety boundaries, language/timezone convergence, capability contracts, runtime integration, PostgreSQL persistence/service recreation and migration compatibility.
