# RENDER_LOGS_REPORT

Controlled Render logs report collected by AgentWorkspace Render Control v1.

---

Task ID: `collect-render-logs-human-mode-gate-002`
Workflow point: `human-mode-project-repo-gate-diagnosis-unfiltered`
Collected at: `2026-04-29T07:18:37.318Z`
Collected by: `SG AgentWorkspaceRenderControlService`

---

## Query

```text
level=all
minutes=120
limit=300
maxLineChars=1200
target=time
deployId=-
deployStatus=-
deployCommit=-
deployCreatedAt=-
deployFinishedAt=-
startTime=-
endTime=-
effectiveMinutes=120
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

- Logs returned: `237`
- Secrets/env exposure: `blocked_by_design`
- Code changes: `none`

## Logs

```text
1) [2026-04-29T07:14:14.501632128Z] [-] ✅ Telegram webhook уже установлен (skip setWebHook)
2) [2026-04-29T07:14:10.057108407Z] [-] ==> ///////////////////////////////////////////////////////////
3) [2026-04-29T07:14:10.054412655Z] [-] ==>
4) [2026-04-29T07:14:10.051912057Z] [-] ==> Available at your primary URL https://garya-bot.onrender.com
5) [2026-04-29T07:14:10.049593143Z] [-] ==>
6) [2026-04-29T07:14:10.046756898Z] [-] ==> ///////////////////////////////////////////////////////////
7) [2026-04-29T07:14:10.043496832Z] [-] ==>
8) [2026-04-29T07:14:09.930002848Z] [-] ==> Your service is live 🎉
9) [2026-04-29T07:14:07.512299187Z] [-] 🧹 chat_messages retention: {
10) [2026-04-29T07:14:07.512323338Z] [-] deleted: 0,
11) [2026-04-29T07:14:07.512328538Z] [-] perRole: {
12) [2026-04-29T07:14:07.512333398Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
13) [2026-04-29T07:14:07.512337448Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
14) [2026-04-29T07:14:07.512341409Z] [-] }
15) [2026-04-29T07:14:07.512345699Z] [-] }
16) [2026-04-29T07:14:07.349186658Z] [-] 📡 ensureDefaultSources: registry synced
17) [2026-04-29T07:14:07.349201578Z] [-] 📡 Sources registry готов.
18) [2026-04-29T07:14:07.349554969Z] [-] 🤖 ROBOT mock-layer запущен.
19) [2026-04-29T07:14:07.332122443Z] [-] 🛡️ Access Requests table OK.
20) [2026-04-29T07:14:07.329317348Z] [-] 🧩 Project Memory auto-restore: {
21) [2026-04-29T07:14:07.329333279Z] [-] ok: true,
22) [2026-04-29T07:14:07.329336799Z] [-] checked: 6,
23) [2026-04-29T07:14:07.329340089Z] [-] synced: 0,
24) [2026-04-29T07:14:07.329343799Z] [-] alreadyExists: 6,
25) [2026-04-29T07:14:07.329346739Z] [-] skipped: 0,
26) [2026-04-29T07:14:07.329351049Z] [-] sections: 'architecture, decisions, misc, project, roadmap, workflow'
27) [2026-04-29T07:14:07.329354149Z] [-] }
28) [2026-04-29T07:14:07.32936431Z] [-] 🧼 error_events boot cleanup: skipped (retention handled by service)
29) [2026-04-29T07:14:07.194311366Z] [-] 🧠 Project Memory table OK.
30) [2026-04-29T07:14:07.194333297Z] [-] 🧾 File-Intake logs table OK.
31) [2026-04-29T07:14:07.13242581Z] [-] ✅ SG-DIAG: Diagnostics summary
32) [2026-04-29T07:14:07.13244849Z] [-] ✅ SG-DIAG: OK — index.js exists
33) [2026-04-29T07:14:07.132550654Z] [-] ✅ SG-DIAG: OK — package.json exists
34) [2026-04-29T07:14:07.132568904Z] [-] ✅ SG-DIAG: OK — No src/src folder
35) [2026-04-29T07:14:07.132631846Z] [-] ✅ SG-DIAG: OK — src/ is a directory
36) [2026-04-29T07:14:07.132639366Z] [-] ✅ SG-DIAG: OK — Monarch role invariant OK (v2) — monarch=usr_48cc07c069030fb3
37) [2026-04-29T07:14:07.132794811Z] [-] 🧱 Migrations: skipped (RUN_MIGRATIONS_ON_BOOT is not enabled).
38) [2026-04-29T07:14:07.07936484Z] [-] 🌐 HTTP-сервер запущен на порту: 10000
39) [2026-04-29T07:14:07.078752171Z] [-] ✅ TelegramAdapter attached.
40) [2026-04-29T07:14:07.078770891Z] [-] 🤖 SG (GARYA AI Bot) работает…
41) [2026-04-29T07:14:07.021839385Z] [-] 🧭 Transport enforced: messageRouter is NOT attached (TelegramAdapter is authoritative).
42) [2026-04-29T07:14:07.003481321Z] [-] HUMAN_MODE_GATE_STATUS {
43) [2026-04-29T07:14:07.003498041Z] [-] TRANSPORT_ENFORCED: true,
44) [2026-04-29T07:14:07.003500621Z] [-] TRANSPORT_TRACE: true,
45) [2026-04-29T07:14:07.003503661Z] [-] HUMAN_MODE_PROJECT_REPO_ENABLED: true,
46) [2026-04-29T07:14:07.003506812Z] [-] RENDER_GIT_COMMIT: '4516dd382a209775d72c0ced2c3e94235ba2a12f',
47) [2026-04-29T07:14:07.003509001Z] [-] GIT_COMMIT: null,
48) [2026-04-29T07:14:07.003510992Z] [-] NODE_ENV: 'production'
49) [2026-04-29T07:14:07.003512942Z] [-] }
50) [2026-04-29T07:14:07.003515032Z] [-] 🧩 JobRunner initialized (singleton).
51) [2026-04-29T07:14:06.994032546Z] [-] [Memory] Buffer enabled { flushMs: 100, maxBatch: 200, maxQueue: 1500 }
52) [2026-04-29T07:14:06.993607803Z] [-] Buffer enabled { flushMs: 100, maxBatch: 200, maxQueue: 1500 }
53) [2026-04-29T07:14:03.824773986Z] [-] > garya-bot@1.0.0 start
54) [2026-04-29T07:14:03.824777267Z] [-] > node ./index.js
55) [2026-04-29T07:14:03.415857723Z] [-] ==>(B Running 'npm start'(B
56) [2026-04-29T07:13:46.29795963Z] [-] ==> Deploying...
57) [2026-04-29T07:13:43.694956098Z] [-] ==> Build successful 🎉
58) [2026-04-29T07:13:43.675463405Z] [-] ==> Uploaded in 2.5s. Compression took 3.4s
59) [2026-04-29T07:13:37.720413426Z] [-] ==> Uploading build...
60) [2026-04-29T07:13:36.511005195Z] [-] 10 vulnerabilities (6 moderate, 2 high, 2 critical)
61) [2026-04-29T07:13:36.511012075Z] [-] To address all issues (including breaking changes), run:
62) [2026-04-29T07:13:36.511015985Z] [-] npm audit fix --force
63) [2026-04-29T07:13:36.511022285Z] [-] Run `npm audit` for details.
64) [2026-04-29T07:13:36.496816906Z] [-] up to date, audited 325 packages in 900ms
65) [2026-04-29T07:13:36.496836066Z] [-] 107 packages are looking for funding
66) [2026-04-29T07:13:36.496870737Z] [-] run `npm fund` for details
67) [2026-04-29T07:13:35.515037712Z] [-] ==>(B Running build command 'npm install'...(B
68) [2026-04-29T07:13:35.364804024Z] [-] ==>(B Docs on specifying a Node.js version: https://render.com/docs/node-version(B
69) [2026-04-29T07:13:35.32842097Z] [-] ==>(B Using Node.js version 22.16.0 (default)(B
70) [2026-04-29T07:13:31.620567014Z] [-] ==>(B Downloaded 96MB in 4s. Extraction took 3s.(B
71) [2026-04-29T07:13:25.554143368Z] [-] ==>(B Checking out commit 4516dd382a209775d72c0ced2c3e94235ba2a12f in branch main(B
72) [2026-04-29T07:13:24.666175724Z] [-] ==>(B Cloning from https://github.com/korzh260609-beep/garya-bot(B
73) [2026-04-29T07:13:24.607100755Z] [-] ==>(B Downloading cache...(B
74) [2026-04-29T07:11:29.706748795Z] [-] ✅ Telegram webhook уже установлен (skip setWebHook)
75) [2026-04-29T07:11:25.902115869Z] [-] ==> ///////////////////////////////////////////////////////////
76) [2026-04-29T07:11:25.89702515Z] [-] ==>
77) [2026-04-29T07:11:25.888749796Z] [-] ==> Available at your primary URL https://garya-bot.onrender.com
78) [2026-04-29T07:11:25.882236903Z] [-] ==>
79) [2026-04-29T07:11:25.878056365Z] [-] ==> ///////////////////////////////////////////////////////////
80) [2026-04-29T07:11:25.874812109Z] [-] ==>
81) [2026-04-29T07:11:25.586571011Z] [-] ==> Your service is live 🎉
82) [2026-04-29T07:11:22.515047255Z] [-] deleted: 0,
83) [2026-04-29T07:11:22.515052125Z] [-] perRole: {
84) [2026-04-29T07:11:22.515056825Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
85) [2026-04-29T07:11:22.515061006Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
86) [2026-04-29T07:11:22.515065026Z] [-] }
87) [2026-04-29T07:11:22.515068866Z] [-] }
88) [2026-04-29T07:11:22.514998715Z] [-] 🧹 chat_messages retention: {
89) [2026-04-29T07:11:22.415784273Z] [-] 📡 Sources registry готов.
90) [2026-04-29T07:11:22.415809883Z] [-] 🤖 ROBOT mock-layer запущен.
91) [2026-04-29T07:11:22.413932708Z] [-] 📡 ensureDefaultSources: registry synced
92) [2026-04-29T07:11:22.398759275Z] [-] 🛡️ Access Requests table OK.
93) [2026-04-29T07:11:22.396620955Z] [-] 🧩 Project Memory auto-restore: {
94) [2026-04-29T07:11:22.396646866Z] [-] ok: true,
95) [2026-04-29T07:11:22.396650446Z] [-] checked: 6,
96) [2026-04-29T07:11:22.396653046Z] [-] synced: 0,
97) [2026-04-29T07:11:22.396656256Z] [-] alreadyExists: 6,
98) [2026-04-29T07:11:22.396658696Z] [-] skipped: 0,
99) [2026-04-29T07:11:22.396661906Z] [-] sections: 'architecture, decisions, misc, project, roadmap, workflow'
100) [2026-04-29T07:11:22.396664376Z] [-] }
101) [2026-04-29T07:11:22.396667116Z] [-] 🧼 error_events boot cleanup: skipped (retention handled by service)
102) [2026-04-29T07:11:22.314225797Z] [-] 🧾 File-Intake logs table OK.
103) [2026-04-29T07:11:22.31329601Z] [-] 🧠 Project Memory table OK.
104) [2026-04-29T07:11:22.28808289Z] [-] 🧱 Migrations: skipped (RUN_MIGRATIONS_ON_BOOT is not enabled).
105) [2026-04-29T07:11:22.287716643Z] [-] ✅ SG-DIAG: Diagnostics summary
106) [2026-04-29T07:11:22.287751454Z] [-] ✅ SG-DIAG: OK — index.js exists
107) [2026-04-29T07:11:22.287882396Z] [-] ✅ SG-DIAG: OK — package.json exists
108) [2026-04-29T07:11:22.287890836Z] [-] ✅ SG-DIAG: OK — No src/src folder
109) [2026-04-29T07:11:22.287897206Z] [-] ✅ SG-DIAG: OK — src/ is a directory
110) [2026-04-29T07:11:22.287904277Z] [-] ✅ SG-DIAG: OK — Monarch role invariant OK (v2) — monarch=usr_48cc07c069030fb3
111) [2026-04-29T07:11:22.177335253Z] [-] 🌐 HTTP-сервер запущен на порту: 10000
112) [2026-04-29T07:11:22.176736832Z] [-] ✅ TelegramAdapter attached.
113) [2026-04-29T07:11:22.176834554Z] [-] 🤖 SG (GARYA AI Bot) работает…
114) [2026-04-29T07:11:22.175941537Z] [-] 🧭 Transport enforced: messageRouter is NOT attached (TelegramAdapter is authoritative).
115) [2026-04-29T07:11:22.161893525Z] [-] 🧩 JobRunner initialized (singleton).
116) [2026-04-29T07:11:22.064425436Z] [-] Buffer enabled { flushMs: 100, maxBatch: 200, maxQueue: 1500 }
117) [2026-04-29T07:11:22.064452976Z] [-] [Memory] Buffer enabled { flushMs: 100, maxBatch: 200, maxQueue: 1500 }
118) [2026-04-29T07:11:19.154328848Z] [-] > garya-bot@1.0.0 start
119) [2026-04-29T07:11:19.154332408Z] [-] > node ./index.js
120) [2026-04-29T07:11:18.795242507Z] [-] ==>(B Running 'npm start'(B
121) [2026-04-29T07:11:04.13883204Z] [-] ==> Deploying...
122) [2026-04-29T07:11:03.240526479Z] [-] ==> Docs on specifying a port: https://render.com/docs/web-services#port-binding
123) [2026-04-29T07:11:03.131237359Z] [-] ==> Detected service running on port 10000
124) [2026-04-29T07:11:01.945769473Z] [-] ==> Build successful 🎉
125) [2026-04-29T07:11:01.926711292Z] [-] ==> Uploaded in 2.3s. Compression took 3.0s
126) [2026-04-29T07:10:56.614223457Z] [-] ==> Uploading build...
127) [2026-04-29T07:10:54.543868542Z] [-] 10 vulnerabilities (6 moderate, 2 high, 2 critical)
128) [2026-04-29T07:10:54.543875672Z] [-] To address all issues (including breaking changes), run:
129) [2026-04-29T07:10:54.543879592Z] [-] npm audit fix --force
130) [2026-04-29T07:10:54.543903424Z] [-] Run `npm audit` for details.
131) [2026-04-29T07:10:54.534338681Z] [-] added 324 packages, and audited 325 packages in 14s
132) [2026-04-29T07:10:54.534390003Z] [-] 107 packages are looking for funding
133) [2026-04-29T07:10:54.534401694Z] [-] run `npm fund` for details
134) [2026-04-29T07:10:40.825489872Z] [-] ==>(B Running build command 'npm install'...(B
135) [2026-04-29T07:10:38.632661797Z] [-] ==>(B Docs on specifying a Node.js version: https://render.com/docs/node-version(B
136) [2026-04-29T07:10:38.59982772Z] [-] ==>(B Using Node.js version 22.16.0 (default)(B
137) [2026-04-29T07:10:36.432833074Z] [-] ==>(B Checking out commit 20d1e74cea2193d19a0f3fc5d0e63e3911419bd1 in branch main(B
138) [2026-04-29T07:10:35.330601564Z] [-] ==>(B Cloning from https://github.com/korzh260609-beep/garya-bot(B
139) [2026-04-29T07:06:05.308372177Z] [-] ==> ///////////////////////////////////////////////////////////
140) [2026-04-29T07:06:05.304992258Z] [-] ==>
141) [2026-04-29T07:06:05.298985177Z] [-] ==> Available at your primary URL https://garya-bot.onrender.com
142) [2026-04-29T07:06:05.293178201Z] [-] ==>
143) [2026-04-29T07:06:05.285544672Z] [-] ==> ///////////////////////////////////////////////////////////
144) [2026-04-29T07:06:05.28159667Z] [-] ==>
145) [2026-04-29T07:06:05.146080435Z] [-] ==> Your service is live 🎉
146) [2026-04-29T07:06:04.057338731Z] [-] ✅ Telegram webhook уже установлен (skip setWebHook)
147) [2026-04-29T07:05:57.015449304Z] [-] 🧹 chat_messages retention: {
148) [2026-04-29T07:05:57.015468625Z] [-] deleted: 0,
149) [2026-04-29T07:05:57.015473025Z] [-] perRole: {
150) [2026-04-29T07:05:57.015476295Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
151) [2026-04-29T07:05:57.015479365Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
152) [2026-04-29T07:05:57.015482716Z] [-] }
153) [2026-04-29T07:05:57.015486256Z] [-] }
154) [2026-04-29T07:05:56.91321201Z] [-] 📡 ensureDefaultSources: registry synced
155) [2026-04-29T07:05:56.913225101Z] [-] 📡 Sources registry готов.
156) [2026-04-29T07:05:56.913570448Z] [-] 🤖 ROBOT mock-layer запущен.
157) [2026-04-29T07:05:56.879150903Z] [-] 🛡️ Access Requests table OK.
158) [2026-04-29T07:05:56.876736635Z] [-] 🧩 Project Memory auto-restore: {
159) [2026-04-29T07:05:56.876763376Z] [-] ok: true,
160) [2026-04-29T07:05:56.876767266Z] [-] checked: 6,
161) [2026-04-29T07:05:56.876770586Z] [-] synced: 0,
162) [2026-04-29T07:05:56.876774587Z] [-] alreadyExists: 6,
163) [2026-04-29T07:05:56.876777677Z] [-] skipped: 0,
164) [2026-04-29T07:05:56.876781277Z] [-] sections: 'architecture, decisions, misc, project, roadmap, workflow'
165) [2026-04-29T07:05:56.876784437Z] [-] }
166) [2026-04-29T07:05:56.876787497Z] [-] 🧼 error_events boot cleanup: skipped (retention handled by service)
167) [2026-04-29T07:05:56.784584364Z] [-] 🧠 Project Memory table OK.
168) [2026-04-29T07:05:56.784597925Z] [-] 🧾 File-Intake logs table OK.
169) [2026-04-29T07:05:56.755041778Z] [-] ✅ SG-DIAG: OK — package.json exists
170) [2026-04-29T07:05:56.755052679Z] [-] ✅ SG-DIAG: OK — No src/src folder
171) [2026-04-29T07:05:56.75507601Z] [-] ✅ SG-DIAG: OK — src/ is a directory
172) [2026-04-29T07:05:56.75507947Z] [-] ✅ SG-DIAG: OK — Monarch role invariant OK (v2) — monarch=usr_48cc07c069030fb3
173) [2026-04-29T07:05:56.755277Z] [-] 🧱 Migrations: skipped (RUN_MIGRATIONS_ON_BOOT is not enabled).
174) [2026-04-29T07:05:56.754865609Z] [-] ✅ SG-DIAG: Diagnostics summary
175) [2026-04-29T07:05:56.754916952Z] [-] ✅ SG-DIAG: OK — index.js exists
176) [2026-04-29T07:05:56.569135369Z] [-] 🌐 HTTP-сервер запущен на порту: 10000
177) [2026-04-29T07:05:56.568013544Z] [-] 🧭 Transport enforced: messageRouter is NOT attached (TelegramAdapter is authoritative).
178) [2026-04-29T07:05:56.568617654Z] [-] ✅ TelegramAdapter attached.
179) [2026-04-29T07:05:56.56875512Z] [-] 🤖 SG (GARYA AI Bot) работает…
180) [2026-04-29T07:05:56.555183106Z] [-] 🧩 JobRunner initialized (singleton).
181) [2026-04-29T07:05:56.548139531Z] [-] [Memory] Buffer enabled { flushMs: 100, maxBatch: 200, maxQueue: 1500 }
182) [2026-04-29T07:05:56.547840017Z] [-] Buffer enabled { flushMs: 100, maxBatch: 200, maxQueue: 1500 }
183) [2026-04-29T07:05:53.703729252Z] [-] > garya-bot@1.0.0 start
184) [2026-04-29T07:05:53.703732482Z] [-] > node ./index.js
185) [2026-04-29T07:05:53.369381247Z] [-] ==>(B Running 'npm start'(B
186) [2026-04-29T07:05:44.005736266Z] [-] ==> Deploying...
187) [2026-04-29T07:05:41.772024992Z] [-] ==> Build successful 🎉
188) [2026-04-29T07:05:41.752955457Z] [-] ==> Uploaded in 2.6s. Compression took 14.5s
189) [2026-04-29T07:05:24.697706111Z] [-] ==> Uploading build...
190) [2026-04-29T07:05:22.144503652Z] [-] 10 vulnerabilities (6 moderate, 2 high, 2 critical)
191) [2026-04-29T07:05:22.144508222Z] [-] To address all issues (including breaking changes), run:
192) [2026-04-29T07:05:22.144511222Z] [-] npm audit fix --force
193) [2026-04-29T07:05:22.144515562Z] [-] Run `npm audit` for details.
194) [2026-04-29T07:05:22.136396236Z] [-] up to date, audited 325 packages in 1s
195) [2026-04-29T07:05:22.136424557Z] [-] 107 packages are looking for funding
196) [2026-04-29T07:05:22.136428137Z] [-] run `npm fund` for details
197) [2026-04-29T07:05:20.135897586Z] [-] ==>(B Running build command 'npm install'...(B
198) [2026-04-29T07:05:20.006487277Z] [-] ==>(B Docs on specifying a Node.js version: https://render.com/docs/node-version(B
199) [2026-04-29T07:05:19.97515463Z] [-] ==>(B Using Node.js version 22.16.0 (default)(B
200) [2026-04-29T07:04:55.637710307Z] [-] ==>(B Downloaded 96MB in 4s. Extraction took 3s.(B
201) [2026-04-29T07:04:49.766796081Z] [-] ==>(B Checking out commit 20d1e74cea2193d19a0f3fc5d0e63e3911419bd1 in branch main(B
202) [2026-04-29T07:04:48.896841328Z] [-] ==>(B Cloning from https://github.com/korzh260609-beep/garya-bot(B
203) [2026-04-29T07:04:48.621239812Z] [-] ==>(B Downloading cache...(B
204) [2026-04-29T07:00:56.752278632Z] [-] ==> ///////////////////////////////////////////////////////////
205) [2026-04-29T07:00:56.749735332Z] [-] ==>
206) [2026-04-29T07:00:56.746742502Z] [-] ==> Available at your primary URL https://garya-bot.onrender.com
207) [2026-04-29T07:00:56.743704481Z] [-] ==>
208) [2026-04-29T07:00:56.74110828Z] [-] ==> ///////////////////////////////////////////////////////////
209) [2026-04-29T07:00:56.738333765Z] [-] ==>
210) [2026-04-29T07:00:56.60884887Z] [-] ==> Your service is live 🎉
211) [2026-04-29T07:00:33.331874092Z] [-] ==> Deploying...
212) [2026-04-29T07:00:30.259632176Z] [-] ==> Build successful 🎉
213) [2026-04-29T07:00:30.233620897Z] [-] ==> Uploaded in 2.5s. Compression took 3.9s
214) [2026-04-29T07:00:23.837958888Z] [-] ==> Uploading build...
215) [2026-04-29T07:00:22.352002316Z] [-] To address all issues (including breaking changes), run:
216) [2026-04-29T07:00:22.352005946Z] [-] npm audit fix --force
217) [2026-04-29T07:00:22.352012096Z] [-] Run `npm audit` for details.
218) [2026-04-29T07:00:22.351994986Z] [-] 10 vulnerabilities (6 moderate, 2 high, 2 critical)
219) [2026-04-29T07:00:22.339550726Z] [-] up to date, audited 325 packages in 1s
220) [2026-04-29T07:00:22.339584627Z] [-] 107 packages are looking for funding
221) [2026-04-29T07:00:22.339599888Z] [-] run `npm fund` for details
222) [2026-04-29T07:00:21.003485572Z] [-] ==>(B Running build command 'npm install'...(B
223) [2026-04-29T07:00:20.791451579Z] [-] ==>(B Docs on specifying a Node.js version: https://render.com/docs/node-version(B
224) [2026-04-29T07:00:20.756175687Z] [-] ==>(B Using Node.js version 22.16.0 (default)(B
225) [2026-04-29T07:00:16.772697362Z] [-] ==>(B Downloaded 96MB in 4s. Extraction took 3s.(B
226) [2026-04-29T07:00:10.590329663Z] [-] ==>(B Checking out commit 8537843c177ef3723a371ca0319cc6125d01646b in branch main(B
227) [2026-04-29T07:00:09.478859437Z] [-] ==>(B Cloning from https://github.com/korzh260609-beep/garya-bot(B
228) [2026-04-29T07:00:09.089053235Z] [-] ==>(B Downloading cache...(B
229) [2026-04-29T06:17:52.722879054Z] [-] 🧹 chat_messages retention: {
230) [2026-04-29T06:17:52.722902055Z] [-] deleted: 0,
231) [2026-04-29T06:17:52.722907445Z] [-] perRole: {
232) [2026-04-29T06:17:52.722913026Z] [-] guest: { days: 7, deleted: 0, batchLimit: 2000 },
233) [2026-04-29T06:17:52.722917536Z] [-] citizen: { days: 30, deleted: 0, batchLimit: 2000 }
234) [2026-04-29T06:17:52.722921806Z] [-] }
235) [2026-04-29T06:17:52.722926266Z] [-] }
236) [2026-04-29T05:23:02.605205195Z] [-] ==> Docs on specifying a port: https://render.com/docs/web-services#port-binding
237) [2026-04-29T05:23:02.5275568Z] [-] ==> Detected service running on port 10000
```
