# RENDER_LOGS_REPORT

Controlled Render logs report collected by AgentWorkspace Render Control v1.

---

Task ID: `latest-deploy-error-root-cause-check`
Workflow point: `render-latest-deploy-error-check`
Collected at: `2026-04-27T15:45:59.826Z`
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
1) [2026-04-27T15:43:41.84175227Z] [-] file:///opt/render/project/src/src/agentWorkspace/AgentWorkspaceRenderControlService.js:3
2) [2026-04-27T15:43:41.841779821Z] [-] buildArgs(command = {}) {
3) [2026-04-27T15:43:41.841782391Z] [-] ^
4) [2026-04-27T15:43:41.841789511Z] [-] SyntaxError: Unexpected token '{'
5) [2026-04-27T15:43:41.841793381Z] [-] at compileSourceTextModule (node:internal/modules/esm/utils:344:16)
6) [2026-04-27T15:43:41.841796271Z] [-] at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:105:18)
7) [2026-04-27T15:43:41.841829982Z] [-] at #translate (node:internal/modules/esm/loader:534:12)
8) [2026-04-27T15:43:41.841837102Z] [-] at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:581:27)
9) [2026-04-27T15:43:41.841842782Z] [-] Node.js v22.16.0
10) [2026-04-27T15:43:41.273979776Z] [-] > garya-bot@1.0.0 start
11) [2026-04-27T15:43:41.273983696Z] [-] > node ./index.js
12) [2026-04-27T15:43:40.981583147Z] [-] ==>(B Running 'npm start'(B
13) [2026-04-27T15:43:39.746995255Z] [-] ==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys
14) [2026-04-27T15:43:39.743147449Z] [-] ==> Exited with status 1
15) [2026-04-27T15:43:37.339707417Z] [-] Node.js v22.16.0
```
