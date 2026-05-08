# Test: Render Logs Bridge Collection

Date: 2026-05-08
Branch: dev/v2-start
Related report: diagnostics/reports/render-logs-bridge-failure-2026-05-08.md
Status: OPEN

---

## Target

Verify that SG can collect Render logs through the Render bridge and write them to:

```text
runtime/render/latest/latest-render-logs.json
```

---

## Command

Telegram command:

```text
СГ, возьми 100 логов Render
```

---

## Expected result

```text
1. SG answers normally in Telegram.
2. No generic fallback is shown.
3. runtime/render/latest/latest-render-logs.json receives fresh generated_at timestamp.
4. logs_count is greater than or equal to 0.
5. secrets_policy remains env_values_never_exposed.
```

---

## Actual result

After PR #138:

```text
1. SG answers normally in Telegram.
2. Generic fallback is not shown.
3. Render logs are not collected successfully yet.
4. Stored latest-render-logs.json remains old.
```

---

## Current blocker

Need safe raw error diagnostics to distinguish:

```text
- Render API auth failure
- Render API permission failure
- Render API bad request / wrong logs query parameters
- timeout / network failure
- unknown Render API response shape
```

---

## Next verification after fix

After adding safe raw Render error diagnostics:

```text
1. Deploy dev/v2-start.
2. Run Telegram command again.
3. Check Telegram response.
4. Check latest-render-logs.json.
5. If still failing, inspect safe error category and exact masked message.
```
