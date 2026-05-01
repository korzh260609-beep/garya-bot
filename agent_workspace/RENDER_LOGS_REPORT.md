# RENDER_LOGS_REPORT

Controlled Render logs report collected by AgentWorkspace Render Control v1.

---

Task ID: `collect-render-logs-latest-250-uncut-20260501-002`
Workflow point: `manual-render-latest-250-logs-uncut-retest`
Collected at: `2026-05-01T10:20:31.531Z`
Collected by: `SG AgentWorkspaceRenderControlService`

---

## Query

```text
level=all
limit=250
partSize=250
maxLineChars=0
target=latest_count
deployId=-
deployStatus=-
deployCommit=-
deployCreatedAt=-
deployFinishedAt=-
startTime=-
endTime=-
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

- Logs returned: `225`
- Parts: `1`
- Chat output: `on_request_only`
- Secrets/env exposure: `blocked_by_design`
- Code changes: `none`

## Logs

```text
1) [2026-05-01T10:16:36.8163969Z] [-] 🧹 chat_messages retention: {
2) [2026-05-01T10:16:36.816429461Z] [-] deleted: 0,
3) [2026-05-01T10:16:36.816435291Z] [-] perRole: {
4) [2026-05-01T10:16:36.816441481Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
5) [2026-05-01T10:16:36.816444632Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
6) [2026-05-01T10:16:36.816447861Z] [-] }
7) [2026-05-01T10:16:36.816450992Z] [-] }
8) [2026-05-01T09:16:36.812280932Z] [-] 🧹 chat_messages retention: {
9) [2026-05-01T09:16:36.812308312Z] [-] deleted: 0,
10) [2026-05-01T09:16:36.812313563Z] [-] perRole: {
11) [2026-05-01T09:16:36.812333553Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
12) [2026-05-01T09:16:36.812338023Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
13) [2026-05-01T09:16:36.812342013Z] [-] }
14) [2026-05-01T09:16:36.812345953Z] [-] }
15) [2026-05-01T08:16:07.116066472Z] [-] 🧹 chat_messages retention: {
16) [2026-05-01T08:16:07.116100743Z] [-] deleted: 0,
17) [2026-05-01T08:16:07.116154254Z] [-] perRole: {
18) [2026-05-01T08:16:07.116161024Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
19) [2026-05-01T08:16:07.116166275Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
20) [2026-05-01T08:16:07.116171024Z] [-] }
21) [2026-05-01T08:16:07.116175825Z] [-] }
22) [2026-05-01T07:15:36.816904872Z] [-] 🧹 chat_messages retention: {
23) [2026-05-01T07:15:36.816938552Z] [-] deleted: 0,
24) [2026-05-01T07:15:36.816944133Z] [-] perRole: {
25) [2026-05-01T07:15:36.816950433Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
26) [2026-05-01T07:15:36.816955433Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
27) [2026-05-01T07:15:36.816960083Z] [-] }
28) [2026-05-01T07:15:36.816965093Z] [-] }
29) [2026-05-01T06:15:36.517598272Z] [-] 🧹 chat_messages retention: {
30) [2026-05-01T06:15:36.517628803Z] [-] deleted: 0,
31) [2026-05-01T06:15:36.517703425Z] [-] perRole: {
32) [2026-05-01T06:15:36.517711485Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
33) [2026-05-01T06:15:36.517716575Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
34) [2026-05-01T06:15:36.517736596Z] [-] }
35) [2026-05-01T06:15:36.517741136Z] [-] }
36) [2026-05-01T05:20:45.737466532Z] [-] ==> Docs on specifying a port: https://render.com/docs/web-services#port-binding
37) [2026-05-01T05:20:45.684600321Z] [-] ==> Detected service running on port 10000
38) [2026-05-01T05:15:43.28319826Z] [-] ✅ Telegram webhook уже установлен (skip setWebHook)
39) [2026-05-01T05:15:37.645285156Z] [-] ==> ///////////////////////////////////////////////////////////
40) [2026-05-01T05:15:37.638286037Z] [-] ==>
41) [2026-05-01T05:15:37.631668929Z] [-] ==> Available at your primary URL https://garya-bot.onrender.com
42) [2026-05-01T05:15:37.622432852Z] [-] ==>
43) [2026-05-01T05:15:37.617179305Z] [-] ==> ///////////////////////////////////////////////////////////
44) [2026-05-01T05:15:37.610165026Z] [-] ==>
45) [2026-05-01T05:15:37.51194654Z] [-] ==> Your service is live 🎉
46) [2026-05-01T05:15:36.317809877Z] [-] 🧹 chat_messages retention: {
47) [2026-05-01T05:15:36.317834648Z] [-] deleted: 0,
48) [2026-05-01T05:15:36.317838078Z] [-] perRole: {
49) [2026-05-01T05:15:36.317841338Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
50) [2026-05-01T05:15:36.317843978Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
51) [2026-05-01T05:15:36.317846688Z] [-] }
52) [2026-05-01T05:15:36.317849238Z] [-] }
53) [2026-05-01T05:15:36.134121656Z] [-] 🤖 ROBOT mock-layer запущен.
54) [2026-05-01T05:15:36.133832719Z] [-] 📡 ensureDefaultSources: registry synced
55) [2026-05-01T05:15:36.133847179Z] [-] 📡 Sources registry готов.
56) [2026-05-01T05:15:36.120701898Z] [-] 🛡️ Access Requests table OK.
57) [2026-05-01T05:15:36.118618907Z] [-] 🧩 Project Memory auto-restore: {
58) [2026-05-01T05:15:36.118650428Z] [-] ok: true,
59) [2026-05-01T05:15:36.118654328Z] [-] checked: 6,
60) [2026-05-01T05:15:36.118657568Z] [-] synced: 0,
61) [2026-05-01T05:15:36.118661899Z] [-] alreadyExists: 6,
62) [2026-05-01T05:15:36.118664828Z] [-] skipped: 0,
63) [2026-05-01T05:15:36.118669359Z] [-] sections: 'architecture, decisions, misc, project, roadmap, workflow'
64) [2026-05-01T05:15:36.118672639Z] [-] }
65) [2026-05-01T05:15:36.118675659Z] [-] 🧼 error_events boot cleanup: skipped (retention handled by service)
66) [2026-05-01T05:15:36.038697878Z] [-] 🧠 Project Memory table OK.
67) [2026-05-01T05:15:36.038721768Z] [-] 🧾 File-Intake logs table OK.
68) [2026-05-01T05:15:36.018004333Z] [-] ✅ SG-DIAG: OK — No src/src folder
69) [2026-05-01T05:15:36.018023013Z] [-] ✅ SG-DIAG: OK — src/ is a directory
70) [2026-05-01T05:15:36.018031183Z] [-] ✅ SG-DIAG: OK — Monarch role invariant OK (v2) — monarch=usr_48cc07c069030fb3
71) [2026-05-01T05:15:36.018222838Z] [-] 🧱 Migrations: skipped (RUN_MIGRATIONS_ON_BOOT is not enabled).
72) [2026-05-01T05:15:36.017802088Z] [-] ✅ SG-DIAG: Diagnostics summary
73) [2026-05-01T05:15:36.01787442Z] [-] ✅ SG-DIAG: OK — index.js exists
74) [2026-05-01T05:15:36.017975872Z] [-] ✅ SG-DIAG: OK — package.json exists
75) [2026-05-01T05:15:35.817292056Z] [-] ✅ TelegramAdapter attached.
76) [2026-05-01T05:15:35.817308356Z] [-] 🤖 SG (GARYA AI Bot) работает…
77) [2026-05-01T05:15:35.817810229Z] [-] 🌐 HTTP-сервер запущен на порту: 10000
78) [2026-05-01T05:15:35.816472506Z] [-] 🧭 Transport enforced: messageRouter is NOT attached (TelegramAdapter is authoritative).
79) [2026-05-01T05:15:35.784389413Z] [-] HUMAN_MODE_GATE_STATUS {
80) [2026-05-01T05:15:35.784406764Z] [-] TRANSPORT_ENFORCED: true,
81) [2026-05-01T05:15:35.784410274Z] [-] TRANSPORT_TRACE: true,
82) [2026-05-01T05:15:35.784413934Z] [-] HUMAN_MODE_PROJECT_REPO_ENABLED: true,
83) [2026-05-01T05:15:35.784417754Z] [-] RENDER_GIT_COMMIT: '734cffd310384aeb312c6e40e11b9d58e00f5f47',
84) [2026-05-01T05:15:35.784420734Z] [-] GIT_COMMIT: null,
85) [2026-05-01T05:15:35.784423564Z] [-] NODE_ENV: 'production'
86) [2026-05-01T05:15:35.784426584Z] [-] }
87) [2026-05-01T05:15:35.784429734Z] [-] 🧩 JobRunner initialized (singleton).
88) [2026-05-01T05:15:35.719122411Z] [-] Buffer enabled { flushMs: 100, maxBatch: 200, maxQueue: 1500 }
89) [2026-05-01T05:15:35.719173212Z] [-] [Memory] Buffer enabled { flushMs: 100, maxBatch: 200, maxQueue: 1500 }
90) [2026-05-01T05:15:32.787023598Z] [-] > garya-bot@1.0.0 start
91) [2026-05-01T05:15:32.787030158Z] [-] > node ./index.js
92) [2026-05-01T05:15:32.417638786Z] [-] ==>(B Running 'npm start'(B
93) [2026-05-01T05:15:16.299770271Z] [-] ==> Deploying...
94) [2026-05-01T05:15:13.381598254Z] [-] ==> Build successful 🎉
95) [2026-05-01T05:15:13.358394367Z] [-] ==> Uploaded in 2.6s. Compression took 11.8s
96) [2026-05-01T05:14:58.979763466Z] [-] ==> Uploading build...
97) [2026-05-01T05:14:56.257135729Z] [-] 10 vulnerabilities (6 moderate, 2 high, 2 critical)
98) [2026-05-01T05:14:56.257142129Z] [-] To address all issues (including breaking changes), run:
99) [2026-05-01T05:14:56.2571604Z] [-] npm audit fix --force
100) [2026-05-01T05:14:56.25716683Z] [-] Run `npm audit` for details.
101) [2026-05-01T05:14:56.246300682Z] [-] added 324 packages, and audited 325 packages in 13s
102) [2026-05-01T05:14:56.246438575Z] [-] 107 packages are looking for funding
103) [2026-05-01T05:14:56.246442886Z] [-] run `npm fund` for details
104) [2026-05-01T05:14:42.938259693Z] [-] ==>(B Running build command 'npm install'...(B
105) [2026-05-01T05:14:42.764965734Z] [-] ==>(B Docs on specifying a Node.js version: https://render.com/docs/node-version(B
106) [2026-05-01T05:14:42.734364103Z] [-] ==>(B Using Node.js version 22.16.0 (default)(B
107) [2026-05-01T05:14:40.602813746Z] [-] ==>(B Downloaded 82MB in 4s. Extraction took 2s.(B
108) [2026-05-01T05:14:35.415418961Z] [-] ==>(B Checking out commit 734cffd310384aeb312c6e40e11b9d58e00f5f47 in branch main(B
109) [2026-05-01T05:14:34.501134874Z] [-] ==>(B Cloning from https://github.com/korzh260609-beep/garya-bot(B
110) [2026-05-01T05:14:34.127079171Z] [-] ==>(B Downloading cache...(B
111) [2026-05-01T05:06:05.147896081Z] [-] ==> Docs on specifying a port: https://render.com/docs/web-services#port-binding
112) [2026-05-01T05:06:05.095894712Z] [-] ==> Detected service running on port 10000
113) [2026-05-01T05:01:04.912927511Z] [-] ✅ Telegram webhook уже установлен (skip setWebHook)
114) [2026-05-01T05:01:02.631569506Z] [-] ==> ///////////////////////////////////////////////////////////
115) [2026-05-01T05:01:02.628569105Z] [-] ==>
116) [2026-05-01T05:01:02.626149184Z] [-] ==> Available at your primary URL https://garya-bot.onrender.com
117) [2026-05-01T05:01:02.622741216Z] [-] ==>
118) [2026-05-01T05:01:02.620178855Z] [-] ==> ///////////////////////////////////////////////////////////
119) [2026-05-01T05:01:02.617602313Z] [-] ==>
120) [2026-05-01T05:01:02.499864447Z] [-] ==> Your service is live 🎉
121) [2026-05-01T05:00:57.412047032Z] [-] 🧹 chat_messages retention: {
122) [2026-05-01T05:00:57.412068932Z] [-] deleted: 0,
123) [2026-05-01T05:00:57.412075712Z] [-] perRole: {
124) [2026-05-01T05:00:57.412082952Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
125) [2026-05-01T05:00:57.412088992Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
126) [2026-05-01T05:00:57.412095093Z] [-] }
127) [2026-05-01T05:00:57.412100973Z] [-] }
128) [2026-05-01T05:00:57.250000198Z] [-] 📡 ensureDefaultSources: registry synced
129) [2026-05-01T05:00:57.250016269Z] [-] 📡 Sources registry готов.
130) [2026-05-01T05:00:57.250289984Z] [-] 🤖 ROBOT mock-layer запущен.
131) [2026-05-01T05:00:57.239193135Z] [-] 🛡️ Access Requests table OK.
132) [2026-05-01T05:00:57.23689329Z] [-] 🧩 Project Memory auto-restore: {
133) [2026-05-01T05:00:57.23691475Z] [-] ok: true,
134) [2026-05-01T05:00:57.23691865Z] [-] checked: 6,
135) [2026-05-01T05:00:57.23692204Z] [-] synced: 0,
136) [2026-05-01T05:00:57.2369258Z] [-] alreadyExists: 6,
137) [2026-05-01T05:00:57.2369289Z] [-] skipped: 0,
138) [2026-05-01T05:00:57.23693264Z] [-] sections: 'architecture, decisions, misc, project, roadmap, workflow'
139) [2026-05-01T05:00:57.23693568Z] [-] }
140) [2026-05-01T05:00:57.23693881Z] [-] 🧼 error_events boot cleanup: skipped (retention handled by service)
141) [2026-05-01T05:00:57.12611193Z] [-] 🧠 Project Memory table OK.
142) [2026-05-01T05:00:57.12613362Z] [-] 🧾 File-Intake logs table OK.
143) [2026-05-01T05:00:57.070051632Z] [-] ✅ SG-DIAG: OK — package.json exists
144) [2026-05-01T05:00:57.070060422Z] [-] ✅ SG-DIAG: OK — No src/src folder
145) [2026-05-01T05:00:57.070066532Z] [-] ✅ SG-DIAG: OK — src/ is a directory
146) [2026-05-01T05:00:57.070077352Z] [-] ✅ SG-DIAG: OK — Monarch role invariant OK (v2) — monarch=usr_48cc07c069030fb3
147) [2026-05-01T05:00:57.070275166Z] [-] 🧱 Migrations: skipped (RUN_MIGRATIONS_ON_BOOT is not enabled).
148) [2026-05-01T05:00:57.069796377Z] [-] ✅ SG-DIAG: Diagnostics summary
149) [2026-05-01T05:00:57.06994275Z] [-] ✅ SG-DIAG: OK — index.js exists
150) [2026-05-01T05:00:57.029535141Z] [-] ✅ TelegramAdapter attached.
151) [2026-05-01T05:00:57.029548431Z] [-] 🤖 SG (GARYA AI Bot) работает…
152) [2026-05-01T05:00:57.029942659Z] [-] 🌐 HTTP-сервер запущен на порту: 10000
153) [2026-05-01T05:00:57.028706695Z] [-] 🧭 Transport enforced: messageRouter is NOT attached (TelegramAdapter is authoritative).
154) [2026-05-01T05:00:56.94247901Z] [-] HUMAN_MODE_GATE_STATUS {
155) [2026-05-01T05:00:56.9424985Z] [-] TRANSPORT_ENFORCED: true,
156) [2026-05-01T05:00:56.942518101Z] [-] TRANSPORT_TRACE: true,
157) [2026-05-01T05:00:56.942523911Z] [-] HUMAN_MODE_PROJECT_REPO_ENABLED: true,
158) [2026-05-01T05:00:56.942529241Z] [-] RENDER_GIT_COMMIT: '7aa224fa18dcadc34c7d3bd0c2a69a02e6dbfb1c',
159) [2026-05-01T05:00:56.942533851Z] [-] GIT_COMMIT: null,
160) [2026-05-01T05:00:56.942538361Z] [-] NODE_ENV: 'production'
161) [2026-05-01T05:00:56.942543081Z] [-] }
162) [2026-05-01T05:00:56.942547712Z] [-] 🧩 JobRunner initialized (singleton).
163) [2026-05-01T05:00:56.929247959Z] [-] Buffer enabled { flushMs: 100, maxBatch: 200, maxQueue: 1500 }
164) [2026-05-01T05:00:56.929630676Z] [-] [Memory] Buffer enabled { flushMs: 100, maxBatch: 200, maxQueue: 1500 }
165) [2026-05-01T05:00:53.84357612Z] [-] > garya-bot@1.0.0 start
166) [2026-05-01T05:00:53.84358161Z] [-] > node ./index.js
167) [2026-05-01T05:00:53.129935134Z] [-] ==>(B Running 'npm start'(B
168) [2026-05-01T05:00:41.309249572Z] [-] ==> Deploying...
169) [2026-05-01T05:00:38.718501979Z] [-] ==> Build successful 🎉
170) [2026-05-01T05:00:38.687086343Z] [-] ==> Uploaded in 2.1s. Compression took 12.3s
171) [2026-05-01T05:00:24.276563936Z] [-] ==> Uploading build...
172) [2026-05-01T05:00:21.982141809Z] [-] 10 vulnerabilities (6 moderate, 2 high, 2 critical)
173) [2026-05-01T05:00:21.982250034Z] [-] To address all issues (including breaking changes), run:
174) [2026-05-01T05:00:21.982256205Z] [-] npm audit fix --force
175) [2026-05-01T05:00:21.982266405Z] [-] Run `npm audit` for details.
176) [2026-05-01T05:00:21.973127072Z] [-] added 324 packages, and audited 325 packages in 13s
177) [2026-05-01T05:00:21.973355274Z] [-] 107 packages are looking for funding
178) [2026-05-01T05:00:21.973361395Z] [-] run `npm fund` for details
179) [2026-05-01T05:00:08.858393833Z] [-] ==>(B Running build command 'npm install'...(B
180) [2026-05-01T05:00:08.703948512Z] [-] ==>(B Docs on specifying a Node.js version: https://render.com/docs/node-version(B
181) [2026-05-01T05:00:08.674723306Z] [-] ==>(B Using Node.js version 22.16.0 (default)(B
182) [2026-05-01T05:00:06.054559119Z] [-] ==>(B Downloaded 82MB in 3s. Extraction took 1s.(B
183) [2026-05-01T05:00:02.521289587Z] [-] ==>(B Checking out commit 7aa224fa18dcadc34c7d3bd0c2a69a02e6dbfb1c in branch main(B
184) [2026-05-01T05:00:01.570512742Z] [-] ==>(B Cloning from https://github.com/korzh260609-beep/garya-bot(B
185) [2026-05-01T05:00:01.171470161Z] [-] ==>(B Downloading cache...(B
186) [2026-05-01T04:55:57.439671846Z] [-] file:///opt/render/project/src/src/agentWorkspace/AgentWorkspaceCommandRunner.js:9
187) [2026-05-01T04:55:57.439698867Z] [-] import agentWorkspaceRenderControlService from "./AgentWorkspaceRenderControlService.js";
188) [2026-05-01T04:55:57.439703567Z] [-] ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
189) [2026-05-01T04:55:57.439706247Z] [-] SyntaxError: The requested module './AgentWorkspaceRenderControlService.js' does not provide an export named 'default'
190) [2026-05-01T04:55:57.439708687Z] [-] at ModuleJob._instantiate (node:internal/modules/esm/module_job:182:21)
191) [2026-05-01T04:55:57.439710667Z] [-] at async ModuleJob.run (node:internal/modules/esm/module_job:266:5)
192) [2026-05-01T04:55:57.439712667Z] [-] at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:644:26)
193) [2026-05-01T04:55:57.439714907Z] [-] at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5)
194) [2026-05-01T04:55:57.439718747Z] [-] Node.js v22.16.0
195) [2026-05-01T04:55:55.642674389Z] [-] > garya-bot@1.0.0 start
196) [2026-05-01T04:55:55.642678479Z] [-] > node ./index.js
197) [2026-05-01T04:55:55.35071742Z] [-] ==>(B Running 'npm start'(B
198) [2026-05-01T04:55:53.983373715Z] [-] ==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys
199) [2026-05-01T04:55:53.980306844Z] [-] ==> Exited with status 1
200) [2026-05-01T04:55:51.916487762Z] [-] file:///opt/render/project/src/src/agentWorkspace/AgentWorkspaceCommandRunner.js:9
201) [2026-05-01T04:55:51.916505783Z] [-] import agentWorkspaceRenderControlService from "./AgentWorkspaceRenderControlService.js";
202) [2026-05-01T04:55:51.916512023Z] [-] ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
203) [2026-05-01T04:55:51.916515933Z] [-] SyntaxError: The requested module './AgentWorkspaceRenderControlService.js' does not provide an export named 'default'
204) [2026-05-01T04:55:51.916520243Z] [-] at ModuleJob._instantiate (node:internal/modules/esm/module_job:182:21)
205) [2026-05-01T04:55:51.916523523Z] [-] at async ModuleJob.run (node:internal/modules/esm/module_job:266:5)
206) [2026-05-01T04:55:51.916526743Z] [-] at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:644:26)
207) [2026-05-01T04:55:51.916529833Z] [-] at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5)
208) [2026-05-01T04:55:51.916538193Z] [-] Node.js v22.16.0
209) [2026-05-01T04:55:49.962494709Z] [-] > garya-bot@1.0.0 start
210) [2026-05-01T04:55:49.962498419Z] [-] > node ./index.js
211) [2026-05-01T04:55:49.233243416Z] [-] ==>(B Running 'npm start'(B
212) [2026-05-01T04:55:35.73345144Z] [-] ==> Deploying...
213) [2026-05-01T04:55:33.412432251Z] [-] ==> Build successful 🎉
214) [2026-05-01T04:55:33.39064178Z] [-] ==> Uploaded in 2.1s. Compression took 11.9s
215) [2026-05-01T04:55:19.441019723Z] [-] ==> Uploading build...
216) [2026-05-01T04:55:16.587685184Z] [-] 10 vulnerabilities (6 moderate, 2 high, 2 critical)
217) [2026-05-01T04:55:16.587690835Z] [-] To address all issues (including breaking changes), run:
218) [2026-05-01T04:55:16.587693915Z] [-] npm audit fix --force
219) [2026-05-01T04:55:16.587699335Z] [-] Run `npm audit` for details.
220) [2026-05-01T04:55:16.572010487Z] [-] run `npm fund` for details
221) [2026-05-01T04:55:16.571882047Z] [-] added 324 packages, and audited 325 packages in 13s
222) [2026-05-01T04:55:16.571912299Z] [-] 107 packages are looking for funding
223) [2026-05-01T04:55:03.097164778Z] [-] ==>(B Running build command 'npm install'...(B
224) [2026-05-01T04:53:31.421492511Z] [-] ==> Docs on specifying a port: https://render.com/docs/web-services#port-binding
225) [2026-05-01T04:53:31.374341706Z] [-] ==> Detected service running on port 10000
```
