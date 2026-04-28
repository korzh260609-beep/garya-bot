# TEST_REPORT

SG diagnostic command results after workspace command execution.

---

Task ID: `raw-render-last-50-count-001`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-28T15:04:21.145Z`
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
returned=50

1) [2026-04-28T14:58:44.975777503Z] [-] ==> Docs on specifying a port: https://render.com/docs/web-services#port-binding
2) [2026-04-28T14:58:44.89055454Z] [-] ==> Detected service running on port 10000
3) [2026-04-28T14:53:47.817572355Z] [-] ==> ///////////////////////////////////////////////////////////
4) [2026-04-28T14:53:47.814927674Z] [-] ==>
5) [2026-04-28T14:53:47.812243201Z] [-] ==> Available at your primary URL https://garya-bot.onrender.com
6) [2026-04-28T14:53:47.809446052Z] [-] ==>
7) [2026-04-28T14:53:47.805906123Z] [-] ==> ///////////////////////////////////////////////////////////
8) [2026-04-28T14:53:47.802862301Z] [-] ==>
9) [2026-04-28T14:53:47.591946277Z] [-] ==> Your service is live 🎉
10) [2026-04-28T14:53:44.398189736Z] [-] ✅ Telegram webhook уже установлен (skip setWebHook)
11) [2026-04-28T14:53:37.413712776Z] [-] 🧹 chat_messages retention: {
12) [2026-04-28T14:53:37.413733626Z] [-] deleted: 0,
13) [2026-04-28T14:53:37.413736776Z] [-] perRole: {
14) [2026-04-28T14:53:37.413740236Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
15) [2026-04-28T14:53:37.413742897Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
16) [2026-04-28T14:53:37.413745366Z] [-] }
17) [2026-04-28T14:53:37.413747897Z] [-] }
18) [2026-04-28T14:53:37.317076394Z] [-] 🤖 ROBOT mock-layer запущен.
19) [2026-04-28T14:53:37.316774856Z] [-] 📡 ensureDefaultSources: registry synced
20) [2026-04-28T14:53:37.316797146Z] [-] 📡 Sources registry готов.
21) [2026-04-28T14:53:37.301516703Z] [-] 🛡️ Access Requests table OK.
22) [2026-04-28T14:53:37.299370556Z] [-] section: 'misc',
23) [2026-04-28T14:53:37.299373656Z] [-] synced: false,
24) [2026-04-28T14:53:37.299376546Z] [-] reason: 'already_exists',
25) [2026-04-28T14:53:37.299396007Z] [-] sourceRef: 'pillars/CODE_OUTPUT.md, pillars/DOCS_GOVERNANCE.md, pillars/REPOINDEX.md, pillars/SG_BEHAVIOR.md, pillars/SG_ENTITY.md',
26) [2026-04-28T14:53:37.299399437Z] [-] resolverStatus: 'active'
27) [2026-04-28T14:53:37.299402347Z] [-] },
28) [2026-04-28T14:53:37.299405197Z] [-] {
29) [2026-04-28T14:53:37.299407967Z] [-] section: 'project',
30) [2026-04-28T14:53:37.299410827Z] [-] synced: false,
31) [2026-04-28T14:53:37.299413867Z] [-] reason: 'already_exists',
32) [2026-04-28T14:53:37.299420437Z] [-] sourceRef: 'pillars/modules/ai_routing/README.md, pillars/modules/bot/README.md, pillars/modules/file_intake/README.md, pillars/modules/logging/README.md, pillars/modules/memory/README.md, pillars/modules/project_memory/CHANGELOG.md, pillars/modules/project_memory/CONTRACTS.md, pillars/modules/project_memory/README.md, pillars/modules/project_memory/RISKS.md, pillars/modules/repo/README.md, pillars/modules/sources/README.md, pillars/modules/tasks/README.md, pillars/modules/transport/README.md, pillars/modules/users/README.md, pillars/PROJECT.md, pillars/README.md',
33) [2026-04-28T14:53:37.299425758Z] [-] resolverStatus: 'active'
34) [2026-04-28T14:53:37.299428218Z] [-] },
35) [2026-04-28T14:53:37.299436008Z] [-] {
36) [2026-04-28T14:53:37.299471809Z] [-] section: 'roadmap',
37) [2026-04-28T14:53:37.299478639Z] [-] synced: false,
38) [2026-04-28T14:53:37.299481789Z] [-] reason: 'already_exists',
39) [2026-04-28T14:53:37.299485829Z] [-] sourceRef: 'pillars/roadmap/00_RULES_AND_ORDER.md, pillars/roadmap/01_STAGE_01_06_CORE.md, pillars/roadmap/02_STAGE_07_MEMORY.md, pillars/roadmap/03_STAGE_08_12_FOUNDATION.md, pillars/roadmap/04_STAGE_13_20_ADVANCED.md, pillars/roadmap/README.md',
40) [2026-04-28T14:53:37.299488889Z] [-] resolverStatus: 'active'
41) [2026-04-28T14:53:37.299491879Z] [-] },
42) [2026-04-28T14:53:37.299494899Z] [-] {
43) [2026-04-28T14:53:37.299497869Z] [-] section: 'workflow',
44) [2026-04-28T14:53:37.299501229Z] [-] synced: false,
45) [2026-04-28T14:53:37.29950426Z] [-] reason: 'already_exists',
46) [2026-04-28T14:53:37.29950811Z] [-] sourceRef: 'pillars/architecture/DATA_FLOW.md, pillars/CODE_INSERT_RULES.md, pillars/workflow/00_RULES_AND_ORDER.md, pillars/workflow/01_STAGE_01_06_CORE.md, pillars/workflow/02_STAGE_07_MEMORY.md, pillars/workflow/03_STAGE_08_12_FOUNDATION.md, pillars/workflow/04_STAGE_13_20_ADVANCED.md, pillars/workflow/README.md',
47) [2026-04-28T14:53:37.29951081Z] [-] resolverStatus: 'active'
48) [2026-04-28T14:53:37.29951356Z] [-] }
49) [2026-04-28T14:53:37.29951644Z] [-] ]
50) [2026-04-28T14:53:37.29952023Z] [-] 🧼 error_events boot cleanup: skipped (retention handled by service)
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
    "timestamp": "2026-04-28T14:58:44.975777503Z",
    "level": "",
    "message": "==> Docs on specifying a port: https://render.com/docs/web-services#port-binding",
    "serviceId": "d7ocotbeo5us73btt720",
    "raw": {
      "id": "d7ocotbeo5us73btt720",
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
      "message": "\u001b[0;32m\u001b[1m==> \u001b[0m\u001b[1mDocs on specifying a port: https://render.com/docs/web-services#port-binding\u001b[0m",
      "timestamp": "2026-04-28T14:58:44.975777503Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:58:44.89055454Z",
    "level": "",
    "message": "==> Detected service running on port 10000",
    "serviceId": "d7ocotbeo5us73btt72g",
    "raw": {
      "id": "d7ocotbeo5us73btt72g",
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
      "message": "\u001b[0;32m\u001b[1m==> \u001b[0m\u001b[1mDetected service running on port 10000\u001b[0m",
      "timestamp": "2026-04-28T14:58:44.89055454Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:53:47.817572355Z",
    "level": "",
    "message": "==> ///////////////////////////////////////////////////////////",
    "serviceId": "d7ocotbeo5us73btt730",
    "raw": {
      "id": "d7ocotbeo5us73btt730",
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
      "timestamp": "2026-04-28T14:53:47.817572355Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:53:47.814927674Z",
    "level": "",
    "message": "==>",
    "serviceId": "d7ocotbeo5us73btt73g",
    "raw": {
      "id": "d7ocotbeo5us73btt73g",
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
      "timestamp": "2026-04-28T14:53:47.814927674Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:53:47.812243201Z",
    "level": "",
    "message": "==> Available at your primary URL https://garya-bot.onrender.com",
    "serviceId": "d7ocotbeo5us73btt740",
    "raw": {
      "id": "d7ocotbeo5us73btt740",
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
      "timestamp": "2026-04-28T14:53:47.812243201Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:53:47.809446052Z",
    "level": "",
    "message": "==>",
    "serviceId": "d7ocotbeo5us73btt74g",
    "raw": {
      "id": "d7ocotbeo5us73btt74g",
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
      "timestamp": "2026-04-28T14:53:47.809446052Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:53:47.805906123Z",
    "level": "",
    "message": "==> ///////////////////////////////////////////////////////////",
    "serviceId": "d7ocotbeo5us73btt750",
    "raw": {
      "id": "d7ocotbeo5us73btt750",
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
      "timestamp": "2026-04-28T14:53:47.805906123Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:53:47.802862301Z",
    "level": "",
    "message": "==>",
    "serviceId": "d7ocotbeo5us73btt75g",
    "raw": {
      "id": "d7ocotbeo5us73btt75g",
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
      "timestamp": "2026-04-28T14:53:47.802862301Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:53:47.591946277Z",
    "level": "",
    "message": "==> Your service is live 🎉",
    "serviceId": "d7ocotbeo5us73btt760",
    "raw": {
      "id": "d7ocotbeo5us73btt760",
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
      "timestamp": "2026-04-28T14:53:47.591946277Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:53:44.398189736Z",
    "level": "",
    "message": "✅ Telegram webhook уже установлен (skip setWebHook)",
    "serviceId": "d62f78ea-141e-4823-be03-b272317caa08",
    "raw": {
      "id": "d62f78ea-141e-4823-be03-b272317caa08",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "instance",
          "value": "srv-d4fnv8je5dus7397mgcg-2kkng"
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
      "timestamp": "…
```
