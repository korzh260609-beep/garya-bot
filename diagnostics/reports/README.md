# SG 2.0 Diagnostic Reports

> AGENT NOTE:
> Store diagnostic reports, failure analyses, and post-fix summaries here.
> Reports must be source-first and must not contain secrets.

Status: ACTIVE_WORKSPACE

---

## Purpose

`diagnostics/reports/` stores investigation results and post-fix summaries.

Examples:

```text
- Render logs bridge failure analysis
- GitHub workflow run check analysis
- Advisor OUTBOX mirror analysis
- AI tool runtime failure analysis
```

---

## Recommended report format

```text
# Diagnostic Report: <name>

Date:
Branch:
Commit:
Problem:
Observed behavior:
Expected behavior:
Evidence:
Likely cause:
Fix plan:
Verification:
Status:
```

---

## Safety

Allowed:

```text
masked error summaries
safe commit SHAs
file paths
PR numbers
high-level runtime states
```

Forbidden:

```text
API keys
raw env values
private tokens
unmasked credentials
private user data unrelated to the diagnostic
```
