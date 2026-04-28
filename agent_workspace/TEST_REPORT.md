# TEST_REPORT

SG diagnostic command results after workspace command execution.

---

Task ID: `verify-legacy-snapshot-reply-001`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-28T15:28:55.093Z`
Tested by: `SG AgentWorkspaceCommandRunner`

---

## Test commands

```text
/render_bridge_logs 50
```

## Expected answers

The runner must execute read-only SG diagnostic chat commands and capture the same text SG would send to chat.

## Actual answers

```text
/render_bridge_logs 50: OK
```

## Chat response logs

```text
## /render_bridge_logs 50
✅ RAW RENDER LOGS
ownerId=tea-d4fn2heuk2gs73fflcag
serviceId=srv-d4fnv8je5dus7397mgcg
mode=last_logs_by_count
target=latest_count
deployId=-
deployStatus=-
deployCommit=-
deployCreatedAt=-
deployFinishedAt=-
timeFilter=none
windowMinutes=-
startTime=-
endTime=-
requested=50
returned=48

1) [2026-04-28T15:27:52.38008178Z] [-] ==> ///////////////////////////////////////////////////////////
2) [2026-04-28T15:27:52.374052562Z] [-] ==>
3) [2026-04-28T15:27:52.365309659Z] [-] ==> Available at your primary URL https://garya-bot.onrender.com
4) [2026-04-28T15:27:52.359486832Z] [-] ==>
5) [2026-04-28T15:27:52.355085699Z] [-] ==> ///////////////////////////////////////////////////////////
6) [2026-04-28T15:27:52.349289613Z] [-] ==>
7) [2026-04-28T15:27:52.193277032Z] [-] ==> Your service is live 🎉
8) [2026-04-28T15:27:49.897844502Z] [-] ✅ Telegram webhook уже установлен (skip setWebHook)
9) [2026-04-28T15:27:43.010904133Z] [-] 🧹 chat_messages retention: {
10) [2026-04-28T15:27:43.010929103Z] [-] deleted: 0,
11) [2026-04-28T15:27:43.010932723Z] [-] perRole: {
12) [2026-04-28T15:27:43.010936424Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
13) [2026-04-28T15:27:43.010939004Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
14) [2026-04-28T15:27:43.010941604Z] [-] }
15) [2026-04-28T15:27:43.010944474Z] [-] }
16) [2026-04-28T15:27:42.889510162Z] [-] 🤖 ROBOT mock-layer запущен.
17) [2026-04-28T15:27:42.888801075Z] [-] 📡 ensureDefaultSources: registry synced
18) [2026-04-28T15:27:42.888889867Z] [-] 📡 Sources registry готов.
19) [2026-04-28T15:27:42.819343441Z] [-] 🛡️ Access Requests table OK.
20) [2026-04-28T15:27:42.814305368Z] [-] 🧩 Project Memory auto-restore: {
21) [2026-04-28T15:27:42.814341309Z] [-] ok: true,
22) [2026-04-28T15:27:42.814345109Z] [-] checked: 6,
23) [2026-04-28T15:27:42.814347569Z] [-] synced: 0,
24) [2026-04-28T15:27:42.814351469Z] [-] alreadyExists: 6,
25) [2026-04-28T15:27:42.814353889Z] [-] skipped: 0,
26) [2026-04-28T15:27:42.81435793Z] [-] sections: 'architecture, decisions, misc, project, roadmap, workflow'
27) [2026-04-28T15:27:42.81436031Z] [-] }
28) [2026-04-28T15:27:42.81436287Z] [-] 🧼 error_events boot cleanup: skipped (retention handled by service)
29) [2026-04-28T15:27:42.681208563Z] [-] 🧠 Project Memory table OK.
30) [2026-04-28T15:27:42.681231473Z] [-] 🧾 File-Intake logs table OK.
31) [2026-04-28T15:27:42.644270852Z] [-] ✅ SG-DIAG: Diagnostics summary
32) [2026-04-28T15:27:42.644303183Z] [-] ✅ SG-DIAG: OK — index.js exists
33) [2026-04-28T15:27:42.644306592Z] [-] ✅ SG-DIAG: OK — package.json exists
34) [2026-04-28T15:27:42.644309643Z] [-] ✅ SG-DIAG: OK — No src/src folder
35) [2026-04-28T15:27:42.644312633Z] [-] ✅ SG-DIAG: OK — src/ is a directory
36) [2026-04-28T15:27:42.644320393Z] [-] ✅ SG-DIAG: OK — Monarch role invariant OK (v2) — monarch=usr_48cc07c069030fb3
37) [2026-04-28T15:27:42.644324433Z] [-] 🧱 Migrations: skipped (RUN_MIGRATIONS_ON_BOOT is not enabled).
38) [2026-04-28T15:27:42.393085096Z] [-] ✅ TelegramAdapter attached.
39) [2026-04-28T15:27:42.393118607Z] [-] 🤖 SG (GARYA AI Bot) работает…
40) [2026-04-28T15:27:42.393444045Z] [-] 🌐 HTTP-сервер запущен на порту: 10000
41) [2026-04-28T15:27:42.392665896Z] [-] 🧭 Transport enforced: messageRouter is NOT attached (TelegramAdapter is authoritative).
42) [2026-04-28T15:27:42.377142387Z] [-] 🧩 JobRunner initialized (singleton).
43) [2026-04-28T15:27:42.368181389Z] [-] [Memory] Buffer enabled { flushMs: 100, maxBatch: 200, maxQueue: 1500 }
44) [2026-04-28T15:27:42.367701927Z] [-] Buffer enabled { flushMs: 100, maxBatch: 200, maxQueue: 1500 }
45) [2026-04-28T15:27:39.329454434Z] [-] > garya-bot@1.0.0 start
46) [2026-04-28T15:27:39.329458474Z] [-] > node ./index.js
47) [2026-04-28T15:27:38.995249104Z] [-] ==>(B Running 'npm start'(B
48) [2026-04-28T15:27:28.941648127Z] [-] ==> Deploying...
```

## Render logs during test

```text
Use RENDER_REPORT.md for RenderBridge logs collected by verify actions.
```

## Result

- `DIAGNOSTICS_OK`

## Notes

## /render_bridge_logs 50
ok=true
handler=-
error=-
```json
[
  {
    "timestamp": "2026-04-28T15:27:52.38008178Z",
    "level": "",
    "message": "==> ///////////////////////////////////////////////////////////",
    "serviceId": "d7od4dpf9bms73ekjgm0",
    "raw": {
      "id": "d7od4dpf9bms73ekjgm0",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "type",
          "value": "app"
        }
      ],
      "message": "\u001b[0;32m\u001b[1m==> \u001b[0m\u001b[1m///////////////////////////////////////////////////////////\u001b[0m",
      "timestamp": "2026-04-28T15:27:52.38008178Z"
    }
  },
  {
    "timestamp": "2026-04-28T15:27:52.374052562Z",
    "level": "",
    "message": "==>",
    "serviceId": "d7od4dpf9bms73ekjgmg",
    "raw": {
      "id": "d7od4dpf9bms73ekjgmg",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "type",
          "value": "app"
        }
      ],
      "message": "\u001b[0;32m\u001b[1m==> \u001b[0m\u001b[1m\u001b[0m",
      "timestamp": "2026-04-28T15:27:52.374052562Z"
    }
  },
  {
    "timestamp": "2026-04-28T15:27:52.365309659Z",
    "level": "",
    "message": "==> Available at your primary URL https://garya-bot.onrender.com",
    "serviceId": "d7od4dpf9bms73ekjgn0",
    "raw": {
      "id": "d7od4dpf9bms73ekjgn0",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "type",
          "value": "app"
        }
      ],
      "message": "\u001b[0;32m\u001b[1m==> \u001b[0m\u001b[1mAvailable at your primary URL https://garya-bot.onrender.com\u001b[0m",
      "timestamp": "2026-04-28T15:27:52.365309659Z"
    }
  },
  {
    "timestamp": "2026-04-28T15:27:52.359486832Z",
    "level": "",
    "message": "==>",
    "serviceId": "d7od4dpf9bms73ekjgng",
    "raw": {
      "id": "d7od4dpf9bms73ekjgng",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "type",
          "value": "app"
        }
      ],
      "message": "\u001b[0;32m\u001b[1m==> \u001b[0m\u001b[1m\u001b[0m",
      "timestamp": "2026-04-28T15:27:52.359486832Z"
    }
  },
  {
    "timestamp": "2026-04-28T15:27:52.355085699Z",
    "level": "",
    "message": "==> ///////////////////////////////////////////////////////////",
    "serviceId": "d7od4dpf9bms73ekjgo0",
    "raw": {
      "id": "d7od4dpf9bms73ekjgo0",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "type",
          "value": "app"
        }
      ],
      "message": "\u001b[0;32m\u001b[1m==> \u001b[0m\u001b[1m///////////////////////////////////////////////////////////\u001b[0m",
      "timestamp": "2026-04-28T15:27:52.355085699Z"
    }
  },
  {
    "timestamp": "2026-04-28T15:27:52.349289613Z",
    "level": "",
    "message": "==>",
    "serviceId": "d7od4dpf9bms73ekjgog",
    "raw": {
      "id": "d7od4dpf9bms73ekjgog",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "type",
          "value": "app"
        }
      ],
      "message": "\u001b[0;32m\u001b[1m==> \u001b[0m\u001b[1m\u001b[0m",
      "timestamp": "2026-04-28T15:27:52.349289613Z"
    }
  },
  {
    "timestamp": "2026-04-28T15:27:52.193277032Z",
    "level": "",
    "message": "==> Your service is live 🎉",
    "serviceId": "d7od4dpf9bms73ekjgp0",
    "raw": {
      "id": "d7od4dpf9bms73ekjgp0",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "type",
          "value": "app"
        }
      ],
      "message": "\u001b[0;32m\u001b[1m==> \u001b[0m\u001b[1mYour service is live 🎉\u001b[0m",
      "timestamp": "2026-04-28T15:27:52.193277032Z"
    }
  },
  {
    "timestamp": "2026-04-28T15:27:49.897844502Z",
    "level": "",
    "message": "✅ Telegram webhook уже установлен (skip setWebHook)",
    "serviceId": "81c47561-88f3-417b-9bb9-411c5fbfaab4",
    "raw": {
      "id": "81c47561-88f3-417b-9bb9-411c5fbfaab4",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "instance",
          "value": "srv-d4fnv8je5dus7397mgcg-m5h9t"
        },
        {
          "name": "level",
          "value": "info"
        },
        {
          "name": "type",
          "value": "app"
        }
      ],
      "message": "✅ Telegram webhook уже установлен (skip setWebHook)",
      "timestamp": "2026-04-28T15:27:49.897844502Z"
    }
  },
  {
    "timestamp": "2026-04-28T15:27:43.010904133Z",
    "level": "",
    "message": "🧹 chat_messages retention: {",
    "serviceId": "f9232cdc-f99b-40b2-86c9-da5c3895ba24",
    "raw": {
      "id": "f9232cdc-f99b-40b2-86c9-da5c3895ba24",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "instance",
          "value": "srv-d4fnv8je5dus7397mgcg-m5h9t"
        },
        {
          "name": "level",
          "value": "info"
        },
        {
          "name": "type",
          "value": "app"
        }
      ],
      "message": "🧹 chat_messages retention: {",
      "timestamp": "2026-04-28T15:27:43.010904133Z"
    }
  },
  {
    "timestamp": "2026-04-28T15:27:43.010929103Z",
    "level": "",
    "message": "deleted: 0,",
    "serviceId": "e92c7ec5-b074-4b77-8556-3cc156c7f54d",
    "raw": {
      "id": "e92c7ec5-b074-4b77-8556-3cc156c7f54d",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "instance",
          "value": "srv-d4fnv8je5dus7397mgcg-m5h9t"
        },
        {
          "name": "level",
          "…
```
