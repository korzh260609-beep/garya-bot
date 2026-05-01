# RENDER_LOGS_REPORT

Controlled Render logs report collected by AgentWorkspace Render Control v1.

---

Task ID: `collect-render-logs-latest-300-by-count-20260501-002`
Workflow point: `manual-render-latest-300-logs-by-count-request`
Collected at: `2026-05-01T04:24:22.747Z`
Collected by: `SG AgentWorkspaceRenderControlService`

---

## Query

```text
level=all
minutes=60
limit=300
maxLineChars=1200
target=time
deployId=-
deployStatus=-
deployCommit=-
deployCreatedAt=-
deployFinishedAt=-
startTime=-
endTime=-
effectiveMinutes=60
levelUsed=all
fallbackUsed=no
```

## Selected service

```text
serviceId=srv-d4fnv8je5dus7397mgcg
serviceName=garya-bot
serviceSlug=garya-bot
ownerId=tea-d4fn2heuk2gs73fflcag
```

## Summary

- Logs returned: `7`
- Secrets/env exposure: `blocked_by_design`
- Code changes: `none`

## Logs

```text
1) [2026-05-01T03:44:35.922095898Z] [-] 🧹 chat_messages retention: {
2) [2026-05-01T03:44:35.92280573Z] [-] deleted: 0,
3) [2026-05-01T03:44:35.92281457Z] [-] perRole: {
4) [2026-05-01T03:44:35.92281999Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
5) [2026-05-01T03:44:35.922828181Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
6) [2026-05-01T03:44:35.922831481Z] [-] }
7) [2026-05-01T03:44:35.922834671Z] [-] }
```
