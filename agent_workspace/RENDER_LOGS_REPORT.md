# RENDER_LOGS_REPORT

Controlled Render logs report collected by AgentWorkspace Render Control v1.

---

Task ID: `render-latest-deploy-logs-73`
Workflow point: `render-latest-deploy-logs-73`
Collected at: `2026-04-28T14:07:10.994Z`
Collected by: `SG AgentWorkspaceRenderControlService`

---

## Query

```text
level=all
minutes=60
limit=50
maxLineChars=900
target=latest_deploy
deployId=dep-d7obt6lckfvc73dbm9dg
deployStatus=live
deployCommit=7f3f6dd8e425908cd6b73c629e3252254c9f509a
deployCreatedAt=2026-04-28T14:05:14.709042Z
deployFinishedAt=2026-04-28T14:06:07.296223Z
startTime=2026-04-28T14:04:44.709Z
endTime=2026-04-28T14:06:44.709Z
effectiveMinutes=5
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

- Logs returned: `20`
- Secrets/env exposure: `blocked_by_design`
- Code changes: `none`

## Logs

```text
1) [2026-04-28T14:06:07.762700038Z] [-] ==> ///////////////////////////////////////////////////////////
2) [2026-04-28T14:06:07.759789203Z] [-] ==>
3) [2026-04-28T14:06:07.756876189Z] [-] ==> Available at your primary URL https://garya-bot.onrender.com
4) [2026-04-28T14:06:07.752771901Z] [-] ==>
5) [2026-04-28T14:06:07.750148513Z] [-] ==> ///////////////////////////////////////////////////////////
6) [2026-04-28T14:06:07.746760563Z] [-] ==>
7) [2026-04-28T14:06:07.423696052Z] [-] ==> Your service is live 🎉
8) [2026-04-28T14:06:05.426433892Z] [-] ✅ Telegram webhook уже установлен (skip setWebHook)
9) [2026-04-28T14:05:58.42134898Z] [-] 🧹 chat_messages retention: {
10) [2026-04-28T14:05:58.421362191Z] [-] deleted: 0,
11) [2026-04-28T14:05:58.421365631Z] [-] perRole: {
12) [2026-04-28T14:05:58.421368731Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
13) [2026-04-28T14:05:58.421371551Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
14) [2026-04-28T14:05:58.421374431Z] [-] }
15) [2026-04-28T14:05:58.421377661Z] [-] }
16) [2026-04-28T14:05:58.337608633Z] [-] 📡 ensureDefaultSources: registry synced
17) [2026-04-28T14:05:58.337630034Z] [-] 📡 Sources registry готов.
18) [2026-04-28T14:05:58.337633384Z] [-] 🤖 ROBOT mock-layer запущен.
19) [2026-04-28T14:05:58.318613874Z] [-] 🛡️ Access Requests table OK.
20) [2026-04-28T14:05:58.316131927Z] [-] 🧼 error_events boot cleanup: skipped (retention handled by service)
```
