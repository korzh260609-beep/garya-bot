# RENDER_LOGS_REPORT

Controlled Render logs report collected by AgentWorkspace Render Control v1.

---

Task ID: `latest-deploy-after-normalizer-fix-check`
Workflow point: `render-deploy-after-normalizer-fix-check`
Collected at: `2026-04-27T15:56:33.981Z`
Collected by: `SG AgentWorkspaceRenderControlService`

---

## Query

```text
level=all
minutes=60
limit=300
maxLineChars=1200
target=latest_deploy
deployId=dep-d7nod7n7f7vs73ftscp0
deployStatus=live
deployCommit=818bb8b55399387645bf955cf9217ec706fa70d8
deployCreatedAt=2026-04-27T15:54:06.846909Z
deployFinishedAt=2026-04-27T15:55:27.526078Z
effectiveMinutes=5
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
1) [2026-04-27T15:55:27.780924736Z] [-] ==> ///////////////////////////////////////////////////////////
2) [2026-04-27T15:55:27.778763906Z] [-] ==>
3) [2026-04-27T15:55:27.776485613Z] [-] ==> Available at your primary URL https://garya-bot.onrender.com
4) [2026-04-27T15:55:27.77385856Z] [-] ==>
5) [2026-04-27T15:55:27.77133699Z] [-] ==> ///////////////////////////////////////////////////////////
6) [2026-04-27T15:55:27.768876311Z] [-] ==>
7) [2026-04-27T15:55:27.633608248Z] [-] ==> Your service is live 🎉
8) [2026-04-27T15:55:26.169126884Z] [-] ✅ Telegram webhook уже установлен (skip setWebHook)
9) [2026-04-27T15:55:19.116610495Z] [-] 🧹 chat_messages retention: {
10) [2026-04-27T15:55:19.116628995Z] [-] deleted: 0,
11) [2026-04-27T15:55:19.116632725Z] [-] perRole: {
12) [2026-04-27T15:55:19.116636955Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
13) [2026-04-27T15:55:19.116639915Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
14) [2026-04-27T15:55:19.116652545Z] [-] }
15) [2026-04-27T15:55:19.116655585Z] [-] }
16) [2026-04-27T15:55:18.989997752Z] [-] 🤖 ROBOT mock-layer запущен.
17) [2026-04-27T15:55:18.988930949Z] [-] 📡 ensureDefaultSources: registry synced
18) [2026-04-27T15:55:18.988945379Z] [-] 📡 Sources registry готов.
19) [2026-04-27T15:55:18.972920955Z] [-] 🛡️ Access Requests table OK.
20) [2026-04-27T15:55:18.970745779Z] [-] 🧼 error_events boot cleanup: skipped (retention handled by service)
```
