# SG 2.0 Diagnostic Tests

> AGENT NOTE:
> Store diagnostic test plans and verification checklists here.
> This folder is documentation/workspace only.
> Do not put runtime test execution logic here unless the Monarch approves a dedicated test module.

Status: ACTIVE_WORKSPACE

---

## Purpose

`diagnostics/tests/` stores planned and performed diagnostic tests.

Examples:

```text
- Render logs bridge test
- GitHub workflow run check test
- Advisor OUTBOX mirror test
- AI tool fail-safe test
- Telegram fallback test
```

---

## Recommended test note format

```text
# Test: <name>

Date:
Branch:
Commit:
Target:
Command:
Expected result:
Actual result:
Status:
Notes:
```

---

## Safety

Do not store secrets or raw credentials.

If logs contain sensitive values, store only a masked summary.
