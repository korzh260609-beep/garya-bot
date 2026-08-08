# Block 16.8 — Secrets & Credentials Management

## Status
Completed and CI-verified.

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

## Implemented
- centralized `CredentialManager` with stable `credentialId` handles and typed API-key, bot-token, OAuth and service-credential records;
- secret references remain private to the credential boundary and are omitted from public credential metadata;
- environment-backed deployment secret store for existing Render secrets, plus bounded derived-secret support for the Telegram webhook secret;
- no new mandatory Render environment variables;
- ownership, project, connection and resource scope binding plus explicit credential grants;
- fail-closed checks before secret-store reads, so unauthorized callers cannot probe secret existence or values;
- lifecycle state for rotation, revocation and expiry with visible bounded error codes;
- bounded callback-based secret use: raw values exist only inside the provider operation that requires them;
- OpenAI production provider now consumes `sg.openai.primary` through the credential boundary rather than reading `OPENAI_API_KEY` directly;
- Telegram production config now exposes only `sg.telegram.bot` and `sg.telegram.webhook` handles rather than token values;
- Telegram Bot API and webhook verification use bounded credential callbacks;
- centralized redaction for bearer credentials, Telegram token-bearing URLs, query credentials and structured secret fields;
- Telegram network errors no longer propagate raw URL text that may contain a bot token;
- OpenAI provider errors no longer propagate provider-supplied error messages that may reflect an API key;
- credential-use audit events carry actor, project, connection/resource, purpose, operation and outcome without raw secret values;
- credential-boundary readiness is exposed in diagnostics without values or secret references.

## Boundaries
- raw secrets never become confirmed memory or ordinary ContextBundle data;
- transports and AI models never receive secrets unless a capability/provider contract explicitly requires the bounded credential path;
- possession of a credential does not grant authorization;
- Action Gate and Resource Authority still decide whether protected operations are allowed;
- Block 19 later hardens and audits this mechanism operationally.

## Acceptance evidence
- stable identifiers and secret-free public metadata: `tests/secretsCredentials.test.js`;
- cross-user, cross-project, cross-connection and cross-resource isolation before store access: `tests/secretsCredentials.test.js`;
- permission denial before secret-store access: `tests/secretsCredentials.test.js`;
- rotation, revocation and expiry behavior: `tests/secretsCredentials.test.js`;
- deployment environment secret-store handles without raw value propagation: `tests/secretsCredentials.test.js`;
- OpenAI bounded credential path and reflected-error sanitization: `tests/secretsCredentials.test.js`;
- Telegram bounded bot credential path and token-safe network errors: `tests/secretsCredentials.test.js`;
- ordinary Telegram config contains credential handles only: `tests/telegramConfig.test.js` and `tests/secretsCredentials.test.js`;
- existing Block 14 Telegram behavior remains backward-compatible in unit fixtures through `tests/telegramProduction.test.js`;
- Render composition uses the shared production credential manager: `tests/renderDeployment.test.js`;
- full repository `npm run check` passed in GitHub Actions during Block 16.8 implementation before documentation synchronization.

## Acceptance criteria
- [x] no repository or ordinary telemetry contains production secret values by design; deployment values stay in the environment secret store and only handles leave the boundary;
- [x] credentials are referenced by stable identifiers;
- [x] revoked/expired credentials fail visibly and safely;
- [x] access is auditable by actor, connection/resource and purpose;
- [x] cross-user/project/connection/resource secret leakage tests pass.
