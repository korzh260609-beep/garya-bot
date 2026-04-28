# RENDER_LOGS_REPORT

Controlled Render logs report collected by AgentWorkspace Render Control v1.

---

Task ID: `repo-state-agent-migration-latest-deploy-logs-check-30`
Workflow point: `repo-state-agent-signature-hash-migration-latest-deploy-logs-check-30`
Collected at: `2026-04-28T08:24:10.897Z`
Collected by: `SG AgentWorkspaceRenderControlService`

---

## Query

```text
level=info
minutes=60
limit=200
maxLineChars=1000
target=latest_deploy
deployId=dep-d7o6o99j2pic739lojc0
deployStatus=live
deployCommit=dbfd67d90da5f24b05db3b8bf6630d90d271a7ad
deployCreatedAt=2026-04-28T08:13:25.897502Z
deployFinishedAt=2026-04-28T08:14:54.023212Z
effectiveMinutes=11
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
1) [2026-04-28T08:19:56.97557003Z] [-] ==> Docs on specifying a port: https://render.com/docs/web-services#port-binding
2) [2026-04-28T08:19:56.894010854Z] [-] ==> Detected service running on port 10000
3) [2026-04-28T08:14:55.556304062Z] [-] ✅ Telegram webhook уже установлен (skip setWebHook)
4) [2026-04-28T08:14:54.670435648Z] [-] ==> ///////////////////////////////////////////////////////////
5) [2026-04-28T08:14:54.667151924Z] [-] ==>
6) [2026-04-28T08:14:54.664291921Z] [-] ==> Available at your primary URL https://garya-bot.onrender.com
7) [2026-04-28T08:14:54.660629406Z] [-] ==>
8) [2026-04-28T08:14:54.65770069Z] [-] ==> ///////////////////////////////////////////////////////////
9) [2026-04-28T08:14:54.654893971Z] [-] ==>
10) [2026-04-28T08:14:54.272784931Z] [-] ==> Your service is live 🎉
11) [2026-04-28T08:14:49.517843801Z] [-] 🧹 chat_messages retention: {
12) [2026-04-28T08:14:49.517864401Z] [-] deleted: 0,
13) [2026-04-28T08:14:49.517867101Z] [-] perRole: {
14) [2026-04-28T08:14:49.517870011Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
15) [2026-04-28T08:14:49.517872421Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
16) [2026-04-28T08:14:49.517874441Z] [-] }
17) [2026-04-28T08:14:49.517876451Z] [-] }
18) [2026-04-28T08:14:49.417022773Z] [-] 📡 ensureDefaultSources: registry synced
19) [2026-04-28T08:14:49.417051484Z] [-] 📡 Sources registry готов.
20) [2026-04-28T08:14:49.417397642Z] [-] 🤖 ROBOT mock-layer запущен.
```
