# TEST_REPORT

SG diagnostic command results after workspace command execution.

---

Task ID: `raw-render-logs-smoke-001`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-28T14:32:16.958Z`
Tested by: `SG AgentWorkspaceCommandRunner`

---

## Test commands

```text
/render_bridge_deploys 5
/render_bridge_logs 20
/render_bridge_logs latest 50
```

## Expected answers

The runner must execute read-only SG diagnostic chat commands and capture the same text SG would send to chat.

## Actual answers

```text
/render_bridge_deploys 5: OK
/render_bridge_logs 20: OK
/render_bridge_logs latest 50: OK
```

## Chat response logs

```text
## /render_bridge_deploys 5
✅ RAW RENDER DEPLOYS
serviceId=srv-d4fnv8je5dus7397mgcg
limit=5
returned=5

1) deployId=dep-d7oc8adckfvc73dc1sd0 | status=live | createdAt=2026-04-28T14:28:59.261842Z | finishedAt=2026-04-28T14:30:34.159937Z | commit=37beb889d9302c95a6d2fb27134d788f41226aa9
2) deployId=dep-d7obt6lckfvc73dbm9dg | status=deactivated | createdAt=2026-04-28T14:05:14.709042Z | finishedAt=2026-04-28T14:06:07.296223Z | commit=7f3f6dd8e425908cd6b73c629e3252254c9f509a
3) deployId=dep-d7obrpl8nd3s738qg7p0 | status=deactivated | createdAt=2026-04-28T14:02:15.618597Z | finishedAt=2026-04-28T14:03:45.6279Z | commit=7f3f6dd8e425908cd6b73c629e3252254c9f509a
4) deployId=dep-d7obmql7vvec7399m9lg | status=deactivated | createdAt=2026-04-28T13:51:42.093699Z | finishedAt=2026-04-28T13:53:18.799392Z | commit=27ffb062c3913ef272a32f1b53548a54b8ccee03
5) deployId=dep-d7ob9ipo3t8c73f6mnog | status=deactivated | createdAt=2026-04-28T13:23:24.359514Z | finishedAt=2026-04-28T13:25:49.506267Z | commit=58bd75d426b16fb43865eebffbb23a8c225cbd32

## /render_bridge_logs 20
✅ RAW RENDER LOGS
ownerId=tea-d4fn2heuk2gs73fflcag
serviceId=srv-d4fnv8je5dus7397mgcg
target=time
deployId=-
deployStatus=-
deployCommit=-
deployCreatedAt=-
deployFinishedAt=-
windowMinutes=60
startTime=-
endTime=-
limit=20
returned=20

1) [2026-04-28T14:30:35.649936508Z] [-] ✅ Telegram webhook уже установлен (skip setWebHook)
2) [2026-04-28T14:30:34.865626505Z] [-] ==> ///////////////////////////////////////////////////////////
3) [2026-04-28T14:30:34.863224767Z] [-] ==>
4) [2026-04-28T14:30:34.860281193Z] [-] ==> Available at your primary URL https://garya-bot.onrender.com
5) [2026-04-28T14:30:34.857923818Z] [-] ==>
6) [2026-04-28T14:30:34.85476279Z] [-] ==> ///////////////////////////////////////////////////////////
7) [2026-04-28T14:30:34.852502451Z] [-] ==>
8) [2026-04-28T14:30:34.435032289Z] [-] ==> Your service is live 🎉
9) [2026-04-28T14:30:28.811258703Z] [-] 🧹 chat_messages retention: {
10) [2026-04-28T14:30:28.811281243Z] [-] deleted: 0,
11) [2026-04-28T14:30:28.811285004Z] [-] perRole: {
12) [2026-04-28T14:30:28.811289194Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
13) [2026-04-28T14:30:28.811292234Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
14) [2026-04-28T14:30:28.811295314Z] [-] }
15) [2026-04-28T14:30:28.811298374Z] [-] }
16) [2026-04-28T14:30:28.626297861Z] [-] 📡 ensureDefaultSources: registry synced
17) [2026-04-28T14:30:28.626315241Z] [-] 📡 Sources registry готов.
18) [2026-04-28T14:30:28.626749411Z] [-] 🤖 ROBOT mock-layer запущен.
19) [2026-04-28T14:30:28.611748044Z] [-] 🛡️ Access Requests table OK.
20) [2026-04-28T14:30:28.521874398Z] [-] 🧼 error_events boot cleanup: skipped (retention handled by service)

## /render_bridge_logs latest 50
✅ RAW RENDER LOGS
ownerId=tea-d4fn2heuk2gs73fflcag
serviceId=srv-d4fnv8je5dus7397mgcg
target=latest_deploy
deployId=dep-d7oc8adckfvc73dc1sd0
deployStatus=live
deployCommit=37beb889d9302c95a6d2fb27134d788f41226aa9
deployCreatedAt=2026-04-28T14:28:59.261842Z
deployFinishedAt=2026-04-28T14:30:34.159937Z
windowMinutes=60
startTime=2026-04-28T14:28:29.261Z
endTime=2026-04-28T14:31:04.159Z
limit=50
returned=20

1) [2026-04-28T14:30:35.649936508Z] [-] ✅ Telegram webhook уже установлен (skip setWebHook)
2) [2026-04-28T14:30:34.865626505Z] [-] ==> ///////////////////////////////////////////////////////////
3) [2026-04-28T14:30:34.863224767Z] [-] ==>
4) [2026-04-28T14:30:34.860281193Z] [-] ==> Available at your primary URL https://garya-bot.onrender.com
5) [2026-04-28T14:30:34.857923818Z] [-] ==>
6) [2026-04-28T14:30:34.85476279Z] [-] ==> ///////////////////////////////////////////////////////////
7) [2026-04-28T14:30:34.852502451Z] [-] ==>
8) [2026-04-28T14:30:34.435032289Z] [-] ==> Your service is live 🎉
9) [2026-04-28T14:30:28.811258703Z] [-] 🧹 chat_messages retention: {
10) [2026-04-28T14:30:28.811281243Z] [-] deleted: 0,
11) [2026-04-28T14:30:28.811285004Z] [-] perRole: {
12) [2026-04-28T14:30:28.811289194Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
13) [2026-04-28T14:30:28.811292234Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
14) [2026-04-28T14:30:28.811295314Z] [-] }
15) [2026-04-28T14:30:28.811298374Z] [-] }
16) [2026-04-28T14:30:28.626297861Z] [-] 📡 ensureDefaultSources: registry synced
17) [2026-04-28T14:30:28.626315241Z] [-] 📡 Sources registry готов.
18) [2026-04-28T14:30:28.626749411Z] [-] 🤖 ROBOT mock-layer запущен.
19) [2026-04-28T14:30:28.611748044Z] [-] 🛡️ Access Requests table OK.
20) [2026-04-28T14:30:28.521874398Z] [-] 🧼 error_events boot cleanup: skipped (retention handled by service)
```

## Render logs during test

```text
Use RENDER_REPORT.md for RenderBridge logs collected by verify actions.
```

## Result

- `DIAGNOSTICS_OK`

## Notes

## /render_bridge_deploys 5
ok=true
handler=-
error=-
```json
[
  {
    "id": "dep-d7oc8adckfvc73dc1sd0",
    "status": "live",
    "createdAt": "2026-04-28T14:28:59.261842Z",
    "finishedAt": "2026-04-28T14:30:34.159937Z",
    "commit": "37beb889d9302c95a6d2fb27134d788f41226aa9"
  },
  {
    "id": "dep-d7obt6lckfvc73dbm9dg",
    "status": "deactivated",
    "createdAt": "2026-04-28T14:05:14.709042Z",
    "finishedAt": "2026-04-28T14:06:07.296223Z",
    "commit": "7f3f6dd8e425908cd6b73c629e3252254c9f509a"
  },
  {
    "id": "dep-d7obrpl8nd3s738qg7p0",
    "status": "deactivated",
    "createdAt": "2026-04-28T14:02:15.618597Z",
    "finishedAt": "2026-04-28T14:03:45.6279Z",
    "commit": "7f3f6dd8e425908cd6b73c629e3252254c9f509a"
  },
  {
    "id": "dep-d7obmql7vvec7399m9lg",
    "status": "deactivated",
    "createdAt": "2026-04-28T13:51:42.093699Z",
    "finishedAt": "2026-04-28T13:53:18.799392Z",
    "commit": "27ffb062c3913ef272a32f1b53548a54b8ccee03"
  },
  {
    "id": "dep-d7ob9ipo3t8c73f6mnog",
    "status": "deactivated",
    "createdAt": "2026-04-28T13:23:24.359514Z",
    "finishedAt": "2026-04-28T13:25:49.506267Z",
    "commit": "58bd75d426b16fb43865eebffbb23a8c225cbd32"
  }
]
```

## /render_bridge_logs 20
ok=true
handler=-
error=-
```json
[
  {
    "timestamp": "2026-04-28T14:30:35.649936508Z",
    "level": "",
    "message": "✅ Telegram webhook уже установлен (skip setWebHook)",
    "serviceId": "c85368ae-ec6d-4275-a7e2-81ef80824832",
    "raw": {
      "id": "c85368ae-ec6d-4275-a7e2-81ef80824832",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "instance",
          "value": "srv-d4fnv8je5dus7397mgcg-skznx"
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
      "timestamp": "2026-04-28T14:30:35.649936508Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:30:34.865626505Z",
    "level": "",
    "message": "==> ///////////////////////////////////////////////////////////",
    "serviceId": "d7oc9p647okc739t9o70",
    "raw": {
      "id": "d7oc9p647okc739t9o70",
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
      "timestamp": "2026-04-28T14:30:34.865626505Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:30:34.863224767Z",
    "level": "",
    "message": "==>",
    "serviceId": "d7oc9p647okc739t9o7g",
    "raw": {
      "id": "d7oc9p647okc739t9o7g",
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
      "timestamp": "2026-04-28T14:30:34.863224767Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:30:34.860281193Z",
    "level": "",
    "message": "==> Available at your primary URL https://garya-bot.onrender.com",
    "serviceId": "d7oc9p647okc739t9o80",
    "raw": {
      "id": "d7oc9p647okc739t9o80",
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
      "timestamp": "2026-04-28T14:30:34.860281193Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:30:34.857923818Z",
    "level": "",
    "message": "==>",
    "serviceId": "d7oc9p647okc739t9o8g",
    "raw": {
      "id": "d7oc9p647okc739t9o8g",
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
      "timestamp": "2026-04-28T14:30:34.857923818Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:30:34.85476279Z",
    "level": "",
    "message": "==> ///////////////////////////////////////////////////////////",
    "serviceId": "d7oc9p647okc739t9o90",
    "raw": {
      "id": "d7oc9p647okc739t9o90",
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
      "timestamp": "2026-04-28T14:30:34.85476279Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:30:34.852502451Z",
    "level": "",
    "message": "==>",
    "serviceId": "d7oc9p647okc739t9o9g",
    "raw": {
      "id": "d7oc9p647okc739t9o9g",
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
      "timestamp": "2026-04-28T14:30:34.852502451Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:30:34.435032289Z",
    "level": "",
    "message": "==> Your service is live 🎉",
    "serviceId": "d7oc9p647okc739t9oa0",
    "raw": {
      "id": "d7oc9p647okc739t9oa0",
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
      "timestamp": "2026-04-28T14:30:34.435032289Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:30:28.811258703Z",
    "level": "",
    "message": "🧹 chat_messages retention: {",
    "serviceId": "fe3f5f97-6234-415c-ae2c-073904e61ea1",
    "raw": {
      "id": "fe3f5f97-6234-415c-ae2c-073904e61ea1",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "instance",
          "value": "srv-d4fnv8je5dus7397mgcg-skznx"
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
      "timestamp": "2026-04-28T14:30:28.811258703Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:30:28.811281243Z",
    "level": "",
    "message": "deleted: 0,",
    "serviceId": "34355b94-2049-4646-b74a-705e32bfa3fb",
    "raw": {
      "id": "34355b94-2049-4646-b74a-705e32bfa3fb",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "instance",
          "value": "srv-d4fnv8je5dus7397mgcg-skznx"
        },
        {
          "name": "level",
          "…
```

## /render_bridge_logs latest 50
ok=true
handler=-
error=-
```json
[
  {
    "timestamp": "2026-04-28T14:30:35.649936508Z",
    "level": "",
    "message": "✅ Telegram webhook уже установлен (skip setWebHook)",
    "serviceId": "c85368ae-ec6d-4275-a7e2-81ef80824832",
    "raw": {
      "id": "c85368ae-ec6d-4275-a7e2-81ef80824832",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "instance",
          "value": "srv-d4fnv8je5dus7397mgcg-skznx"
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
      "timestamp": "2026-04-28T14:30:35.649936508Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:30:34.865626505Z",
    "level": "",
    "message": "==> ///////////////////////////////////////////////////////////",
    "serviceId": "d7oc9s647okc739t9qvg",
    "raw": {
      "id": "d7oc9s647okc739t9qvg",
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
      "timestamp": "2026-04-28T14:30:34.865626505Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:30:34.863224767Z",
    "level": "",
    "message": "==>",
    "serviceId": "d7oc9s647okc739t9r00",
    "raw": {
      "id": "d7oc9s647okc739t9r00",
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
      "timestamp": "2026-04-28T14:30:34.863224767Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:30:34.860281193Z",
    "level": "",
    "message": "==> Available at your primary URL https://garya-bot.onrender.com",
    "serviceId": "d7oc9s647okc739t9r0g",
    "raw": {
      "id": "d7oc9s647okc739t9r0g",
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
      "timestamp": "2026-04-28T14:30:34.860281193Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:30:34.857923818Z",
    "level": "",
    "message": "==>",
    "serviceId": "d7oc9s647okc739t9r10",
    "raw": {
      "id": "d7oc9s647okc739t9r10",
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
      "timestamp": "2026-04-28T14:30:34.857923818Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:30:34.85476279Z",
    "level": "",
    "message": "==> ///////////////////////////////////////////////////////////",
    "serviceId": "d7oc9s647okc739t9r1g",
    "raw": {
      "id": "d7oc9s647okc739t9r1g",
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
      "timestamp": "2026-04-28T14:30:34.85476279Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:30:34.852502451Z",
    "level": "",
    "message": "==>",
    "serviceId": "d7oc9s647okc739t9r20",
    "raw": {
      "id": "d7oc9s647okc739t9r20",
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
      "timestamp": "2026-04-28T14:30:34.852502451Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:30:34.435032289Z",
    "level": "",
    "message": "==> Your service is live 🎉",
    "serviceId": "d7oc9s647okc739t9r2g",
    "raw": {
      "id": "d7oc9s647okc739t9r2g",
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
      "timestamp": "2026-04-28T14:30:34.435032289Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:30:28.811258703Z",
    "level": "",
    "message": "🧹 chat_messages retention: {",
    "serviceId": "fe3f5f97-6234-415c-ae2c-073904e61ea1",
    "raw": {
      "id": "fe3f5f97-6234-415c-ae2c-073904e61ea1",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "instance",
          "value": "srv-d4fnv8je5dus7397mgcg-skznx"
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
      "timestamp": "2026-04-28T14:30:28.811258703Z"
    }
  },
  {
    "timestamp": "2026-04-28T14:30:28.811281243Z",
    "level": "",
    "message": "deleted: 0,",
    "serviceId": "34355b94-2049-4646-b74a-705e32bfa3fb",
    "raw": {
      "id": "34355b94-2049-4646-b74a-705e32bfa3fb",
      "labels": [
        {
          "name": "resource",
          "value": "srv-d4fnv8je5dus7397mgcg"
        },
        {
          "name": "instance",
          "value": "srv-d4fnv8je5dus7397mgcg-skznx"
        },
        {
          "name": "level",
          "…
```
