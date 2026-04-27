# RENDER_LOGS_REPORT

Controlled Render logs report collected by AgentWorkspace Render Control v1.

---

Task ID: `latest-deploy-error-root-cause-check-2`
Workflow point: `render-latest-deploy-error-check-2`
Collected at: `2026-04-27T15:50:41.158Z`
Collected by: `SG AgentWorkspaceRenderControlService`

---

## Query

```text
level=all
minutes=60
limit=300
maxLineChars=1200
```

## Selected service

```text
serviceId=srv-d4fnv8je5dus7397mgcg
serviceName=garya-bot
serviceSlug=garya-bot
ownerId=tea-d4fn2heuk2gs73fflcag
```

## Summary

- Logs returned: `15`
- Secrets/env exposure: `blocked_by_design`
- Code changes: `none`

## Logs

```text
1) [2026-04-27T15:49:44.565322295Z] [-] file:///opt/render/project/src/src/integrations/render/RenderBridgeNormalizer.js:79
2) [2026-04-27T15:49:44.565349407Z] [-] }\n
3) [2026-04-27T15:49:44.565352647Z] [-] ^
4) [2026-04-27T15:49:44.565358387Z] [-] SyntaxError: Invalid or unexpected token
5) [2026-04-27T15:49:44.565361767Z] [-] at compileSourceTextModule (node:internal/modules/esm/utils:344:16)
6) [2026-04-27T15:49:44.565365117Z] [-] at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:105:18)
7) [2026-04-27T15:49:44.565369218Z] [-] at #translate (node:internal/modules/esm/loader:534:12)
8) [2026-04-27T15:49:44.565371948Z] [-] at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:581:27)
9) [2026-04-27T15:49:44.565376408Z] [-] Node.js v22.16.0
10) [2026-04-27T15:49:43.566656495Z] [-] > garya-bot@1.0.0 start
11) [2026-04-27T15:49:43.566659216Z] [-] > node ./index.js
12) [2026-04-27T15:49:43.26764314Z] [-] ==>(B Running 'npm start'(B
13) [2026-04-27T15:49:42.051600034Z] [-] ==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys
14) [2026-04-27T15:49:42.049026452Z] [-] ==> Exited with status 1
15) [2026-04-27T15:49:40.425641691Z] [-] Node.js v22.16.0
```
