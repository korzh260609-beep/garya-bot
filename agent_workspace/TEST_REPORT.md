# TEST_REPORT

SG diagnostic command results after workspace command execution.

---

Task ID: `raw-render-last-50-002`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-28T14:45:24.750Z`
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
internalLookbackMinutes=1440
startTime=-
endTime=-
requested=50
returned=20

1) [2026-04-28T14:44:15.894728708Z] [-] ==> ///////////////////////////////////////////////////////////
2) [2026-04-28T14:44:15.891441393Z] [-] ==>
3) [2026-04-28T14:44:15.886353381Z] [-] ==> Available at your primary URL https://garya-bot.onrender.com
4) [2026-04-28T14:44:15.882983322Z] [-] ==>
5) [2026-04-28T14:44:15.880221704Z] [-] ==> ///////////////////////////////////////////////////////////
6) [2026-04-28T14:44:15.877053165Z] [-] ==>
7) [2026-04-28T14:44:15.764580232Z] [-] ==> Your service is live 🎉
8) [2026-04-28T14:44:12.855412666Z] [-] ✅ Telegram webhook уже установлен (skip setWebHook)
9) [2026-04-28T14:44:05.811406254Z] [-] 🧹 chat_messages retention: {
10) [2026-04-28T14:44:05.811427244Z] [-] deleted: 0,
11) [2026-04-28T14:44:05.811430334Z] [-] perRole: {
12) [2026-04-28T14:44:05.811433914Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
13) [2026-04-28T14:44:05.811436565Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
14) [2026-04-28T14:44:05.811476046Z] [-] }
15) [2026-04-28T14:44:05.811482476Z] [-] }
16) [2026-04-28T14:44:05.681108465Z] [-] 🤖 ROBOT mock-layer запущен.
17) [2026-04-28T14:44:05.680825668Z] [-] 📡 ensureDefaultSources: registry synced
18) [2026-04-28T14:44:05.680842828Z] [-] 📡 Sources registry готов.
19) [2026-04-28T14:44:05.663920529Z] [-] 🛡️ Access Requests table OK.
20) [2026-04-28T14:44:05.66206867Z] [-] 🧼 error_events boot cleanup: skipped (retention handled by service)
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
    "timestamp": "2026-04-28T14:44:15.894728708Z",
    "level": "",
    "message": "==> ///////////////////////////////////////////////////////////",
    "serviceId": "d7ocg11f9bms73ejvflg",
    "raw": {
      "id": "d7ocg11f9bms73ejvflg",
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
      "timestamp": "2026-04-28T14:44:15.894728708Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:44:15.891441393Z",
    "level": "",
    "message": "==>",
    "serviceId": "d7ocg11f9bms73ejvfm0",
    "raw": {
      "id": "d7ocg11f9bms73ejvfm0",
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
      "timestamp": "2026-04-28T14:44:15.891441393Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:44:15.886353381Z",
    "level": "",
    "message": "==> Available at your primary URL https://garya-bot.onrender.com",
    "serviceId": "d7ocg11f9bms73ejvfmg",
    "raw": {
      "id": "d7ocg11f9bms73ejvfmg",
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
      "timestamp": "2026-04-28T14:44:15.886353381Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:44:15.882983322Z",
    "level": "",
    "message": "==>",
    "serviceId": "d7ocg11f9bms73ejvfn0",
    "raw": {
      "id": "d7ocg11f9bms73ejvfn0",
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
      "timestamp": "2026-04-28T14:44:15.882983322Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:44:15.880221704Z",
    "level": "",
    "message": "==> ///////////////////////////////////////////////////////////",
    "serviceId": "d7ocg11f9bms73ejvfng",
    "raw": {
      "id": "d7ocg11f9bms73ejvfng",
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
      "timestamp": "2026-04-28T14:44:15.880221704Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:44:15.877053165Z",
    "level": "",
    "message": "==>",
    "serviceId": "d7ocg11f9bms73ejvfo0",
    "raw": {
      "id": "d7ocg11f9bms73ejvfo0",
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
      "timestamp": "2026-04-28T14:44:15.877053165Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:44:15.764580232Z",
    "level": "",
    "message": "==> Your service is live 🎉",
    "serviceId": "d7ocg11f9bms73ejvfog",
    "raw": {
      "id": "d7ocg11f9bms73ejvfog",
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
      "timestamp": "2026-04-28T14:44:15.764580232Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:44:12.855412666Z",
    "level": "",
    "message": "✅ Telegram webhook уже установлен (skip setWebHook)",
    "serviceId": "877c343e-7103-4ed5-a4c2-216ec73736d0",
    "raw": {
      "id": "877c343e-7103-4ed5-a4c2-216ec73736d0",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "instance",
          "value": "srv-d4fnv8je5dus7397mgcg-ptn6d"
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
      "timestamp": "2026-04-28T14:44:12.855412666Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:44:05.811406254Z",
    "level": "",
    "message": "🧹 chat_messages retention: {",
    "serviceId": "bc3c50da-6c1b-4ca9-8879-945af4e5f20a",
    "raw": {
      "id": "bc3c50da-6c1b-4ca9-8879-945af4e5f20a",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "instance",
          "value": "srv-d4fnv8je5dus7397mgcg-ptn6d"
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
      "timestamp": "2026-04-28T14:44:05.811406254Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:44:05.811427244Z",
    "level": "",
    "message": "deleted: 0,",
    "serviceId": "f9cfaf4f-67bb-499f-8abe-0b38c3b80c8f",
    "raw": {
      "id": "f9cfaf4f-67bb-499f-8abe-0b38c3b80c8f",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "instance",
          "value": "srv-d4fnv8je5dus7397mgcg-ptn6d"
        },
        {
          "name": "level",
         …
```
