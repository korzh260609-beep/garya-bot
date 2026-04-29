# RENDER_LOGS_REPORT

Controlled Render logs report collected by AgentWorkspace Render Control v1.

---

Task ID: `collect-render-logs-human-mode-handoff-001`
Workflow point: `human-mode-project-repo-response-handoff-diagnosis`
Collected at: `2026-04-29T14:12:32.867Z`
Collected by: `SG AgentWorkspaceRenderControlService`

---

## Query

```text
level=all
minutes=30
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
effectiveMinutes=30
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

- Logs returned: `300`
- Secrets/env exposure: `blocked_by_design`
- Code changes: `none`

## Logs

```text
1) [2026-04-29T14:09:38.816930785Z] [-] [Memory] Saved message {
2) [2026-04-29T14:09:38.816968966Z] [-] chatId: '677128443',
3) [2026-04-29T14:09:38.816972977Z] [-] globalUserId: 'usr_48cc07c069030fb3',
4) [2026-04-29T14:09:38.816975627Z] [-] size: 145,
5) [2026-04-29T14:09:38.816978027Z] [-] transport: 'telegram',
6) [2026-04-29T14:09:38.816980517Z] [-] sv: 2
7) [2026-04-29T14:09:38.816983137Z] [-] }
8) [2026-04-29T14:09:38.694625908Z] [-] AI_CALL_END {
9) [2026-04-29T14:09:38.694649198Z] [-] handler: 'chat',
10) [2026-04-29T14:09:38.694653028Z] [-] stablePersonalFactMode: false,
11) [2026-04-29T14:09:38.694655899Z] [-] longTermMemoryInjected: true,
12) [2026-04-29T14:09:38.694659049Z] [-] longTermMemoryBridgePrepared: true,
13) [2026-04-29T14:09:38.694661609Z] [-] chatIntentMode: 'normal',
14) [2026-04-29T14:09:38.694664169Z] [-] chatIntentDomain: 'unknown',
15) [2026-04-29T14:09:38.694666699Z] [-] chatIntentCandidateSlots: [],
16) [2026-04-29T14:09:38.69468922Z] [-] replyContextInjected: false,
17) [2026-04-29T14:09:38.694691909Z] [-] replyContextAuthor: '',
18) [2026-04-29T14:09:38.6946945Z] [-] replyContextHasText: false,
19) [2026-04-29T14:09:38.69469699Z] [-] historyRequestedLimit: 20,
20) [2026-04-29T14:09:38.6947Z] [-] historyChatType: 'private',
21) [2026-04-29T14:09:38.69470265Z] [-] projectIntentRepoContextActive: false,
22) [2026-04-29T14:09:38.69470515Z] [-] projectIntentRepoContextTargetEntity: '',
23) [2026-04-29T14:09:38.69472405Z] [-] projectIntentRepoContextTargetPath: '',
24) [2026-04-29T14:09:38.69472673Z] [-] projectContextScopeProjectArea: '',
25) [2026-04-29T14:09:38.69472921Z] [-] projectContextScopeRepo: '',
26) [2026-04-29T14:09:38.694731661Z] [-] projectContextScopeLinkedArea: '',
27) [2026-04-29T14:09:38.694734231Z] [-] projectContextScopeLinkedRepo: '',
28) [2026-04-29T14:09:38.694771922Z] [-] projectContextScopeCrossRepo: null,
29) [2026-04-29T14:09:38.694774482Z] [-] behaviorVersion: '9.10-skeleton-v5-compact',
30) [2026-04-29T14:09:38.694777082Z] [-] behaviorStyleAxis: 'mixed',
31) [2026-04-29T14:09:38.694779912Z] [-] behaviorStyleAxisSource: 'default_no_text_detection',
32) [2026-04-29T14:09:38.694782422Z] [-] behaviorSoftStyleAskDetected: false,
33) [2026-04-29T14:09:38.694785332Z] [-] behaviorCriticality: 'normal',
34) [2026-04-29T14:09:38.694788112Z] [-] behaviorCriticalitySource: 'default_no_text_detection',
35) [2026-04-29T14:09:38.694790642Z] [-] behaviorNoNodding: true,
36) [2026-04-29T14:09:38.694793192Z] [-] stableIntentMode: 'normal',
37) [2026-04-29T14:09:38.694795772Z] [-] stableIntentDomain: 'unknown',
38) [2026-04-29T14:09:38.694798372Z] [-] stableIntentCandidateSlots: [],
39) [2026-04-29T14:09:38.694800932Z] [-] aiInputGuardVersion: 'v6-current-activity-aware',
40) [2026-04-29T14:09:38.694803303Z] [-] rawProjectCtxChars: 1525,
41) [2026-04-29T14:09:38.694805743Z] [-] guardedProjectCtxChars: 500,
42) [2026-04-29T14:09:38.694808332Z] [-] rawRecallCtxChars: 1665,
43) [2026-04-29T14:09:38.694810773Z] [-] guardedRecallCtxChars: 399,
44) [2026-04-29T14:09:38.694813513Z] [-] rawHistoryCount: 20,
45) [2026-04-29T14:09:38.694816023Z] [-] guardedHistoryCount: 2,
46) [2026-04-29T14:09:38.694818673Z] [-] rawMessageCount: 8,
47) [2026-04-29T14:09:38.694821013Z] [-] guardedMessageCount: 8,
48) [2026-04-29T14:09:38.694823513Z] [-] currentActivityQuestionDetected: false,
49) [2026-04-29T14:09:38.694826023Z] [-] projectCtxTrimmed: true,
50) [2026-04-29T14:09:38.694828533Z] [-] recallCtxTrimmed: true,
51) [2026-04-29T14:09:38.694830963Z] [-] historyTrimmed: true,
52) [2026-04-29T14:09:38.694833483Z] [-] messagesTrimmed: true,
53) [2026-04-29T14:09:38.694839343Z] [-] promptBlockSystemPromptChars: 3812,
54) [2026-04-29T14:09:38.694841893Z] [-] promptBlockProjectContextPolicyChars: 568,
55) [2026-04-29T14:09:38.694844324Z] [-] promptBlockCurrentActivityPolicyChars: 0,
56) [2026-04-29T14:09:38.694846724Z] [-] promptBlockSourceServiceChars: 550,
57) [2026-04-29T14:09:38.694849164Z] [-] promptBlockSourceResultChars: 0,
58) [2026-04-29T14:09:38.694851544Z] [-] promptBlockLongTermMemoryChars: 558,
59) [2026-04-29T14:09:38.694853944Z] [-] promptBlockReplyContextChars: 0,
60) [2026-04-29T14:09:38.694856364Z] [-] promptBlockAuxPolicyChars: 550,
61) [2026-04-29T14:09:38.694858814Z] [-] promptBlockHistoryCount: 2,
62) [2026-04-29T14:09:38.694861444Z] [-] promptBlockHistoryTotalChars: 344,
63) [2026-04-29T14:09:38.694863944Z] [-] promptBlockHistoryUserChars: 44,
64) [2026-04-29T14:09:38.694866444Z] [-] promptBlockHistoryAssistantChars: 300,
65) [2026-04-29T14:09:38.694869054Z] [-] promptBlockHistoryOtherChars: 0,
66) [2026-04-29T14:09:38.694871544Z] [-] promptBlockFinalUserChars: 44,
67) [2026-04-29T14:09:38.694874124Z] [-] promptBlockPreGuardMessageCount: 8,
68) [2026-04-29T14:09:38.694876514Z] [-] promptBlockPreGuardTotalChars: 6426,
69) [2026-04-29T14:09:38.694878854Z] [-] aiInputMessageCount: 9,
70) [2026-04-29T14:09:38.694881334Z] [-] aiInputTotalChars: 3897,
71) [2026-04-29T14:09:38.694883805Z] [-] aiInputApproxTokens: 975,
72) [2026-04-29T14:09:38.694886245Z] [-] aiInputSystemChars: 3509,
73) [2026-04-29T14:09:38.694888655Z] [-] aiInputUserChars: 88,
74) [2026-04-29T14:09:38.694891285Z] [-] aiInputAssistantChars: 300,
75) [2026-04-29T14:09:38.694893675Z] [-] aiInputOtherChars: 0,
76) [2026-04-29T14:09:38.694896095Z] [-] aiInputLongestMessageChars: 900,
77) [2026-04-29T14:09:38.694898535Z] [-] aiInputLongestMessageRole: 'system',
78) [2026-04-29T14:09:38.694907705Z] [-] dtMs: 1723,
79) [2026-04-29T14:09:38.694910785Z] [-] replyChars: 145,
80) [2026-04-29T14:09:38.694913425Z] [-] replyApproxTokens: 37,
81) [2026-04-29T14:09:38.694916375Z] [-] ok: true
82) [2026-04-29T14:09:38.694919195Z] [-] }
83) [2026-04-29T14:09:36.966574712Z] [-] AI_CALL_START {
84) [2026-04-29T14:09:36.966602682Z] [-] taskType: 'chat',
85) [2026-04-29T14:09:36.966619803Z] [-] requiresAI: true,
86) [2026-04-29T14:09:36.966625083Z] [-] aiCostLevel: 'low',
87) [2026-04-29T14:09:36.966630293Z] [-] event: 'AI_CALL_START',
88) [2026-04-29T14:09:36.966634683Z] [-] handler: 'chat',
89) [2026-04-29T14:09:36.966639354Z] [-] stablePersonalFactMode: false,
90) [2026-04-29T14:09:36.966643624Z] [-] longTermMemoryInjected: true,
91) [2026-04-29T14:09:36.966648834Z] [-] longTermMemoryBridgePrepared: true,
92) [2026-04-29T14:09:36.966653354Z] [-] chatIntentMode: 'normal',
93) [2026-04-29T14:09:36.966658144Z] [-] chatIntentDomain: 'unknown',
94) [2026-04-29T14:09:36.966662664Z] [-] chatIntentCandidateSlots: [],
95) [2026-04-29T14:09:36.966667134Z] [-] replyContextInjected: false,
96) [2026-04-29T14:09:36.966671594Z] [-] replyContextAuthor: '',
97) [2026-04-29T14:09:36.966676315Z] [-] replyContextHasText: false,
98) [2026-04-29T14:09:36.966681055Z] [-] historyRequestedLimit: 20,
99) [2026-04-29T14:09:36.966685705Z] [-] historyChatType: 'private',
100) [2026-04-29T14:09:36.966689945Z] [-] projectIntentRepoContextActive: false,
101) [2026-04-29T14:09:36.966694055Z] [-] projectIntentRepoContextTargetEntity: '',
102) [2026-04-29T14:09:36.966698355Z] [-] projectIntentRepoContextTargetPath: '',
103) [2026-04-29T14:09:36.966702525Z] [-] projectContextScopeProjectArea: '',
104) [2026-04-29T14:09:36.966706745Z] [-] projectContextScopeRepo: '',
105) [2026-04-29T14:09:36.966710996Z] [-] projectContextScopeLinkedArea: '',
106) [2026-04-29T14:09:36.966715236Z] [-] projectContextScopeLinkedRepo: '',
107) [2026-04-29T14:09:36.966720006Z] [-] projectContextScopeCrossRepo: null,
108) [2026-04-29T14:09:36.966724526Z] [-] behaviorVersion: '9.10-skeleton-v5-compact',
109) [2026-04-29T14:09:36.966728936Z] [-] behaviorStyleAxis: 'mixed',
110) [2026-04-29T14:09:36.966733926Z] [-] behaviorStyleAxisSource: 'default_no_text_detection',
111) [2026-04-29T14:09:36.966738346Z] [-] behaviorSoftStyleAskDetected: false,
112) [2026-04-29T14:09:36.966742526Z] [-] behaviorCriticality: 'normal',
113) [2026-04-29T14:09:36.966746876Z] [-] behaviorCriticalitySource: 'default_no_text_detection',
114) [2026-04-29T14:09:36.966751037Z] [-] behaviorNoNodding: true,
115) [2026-04-29T14:09:36.966755286Z] [-] stableIntentMode: 'normal',
116) [2026-04-29T14:09:36.966759557Z] [-] stableIntentDomain: 'unknown',
117) [2026-04-29T14:09:36.966780957Z] [-] stableIntentCandidateSlots: [],
118) [2026-04-29T14:09:36.966784497Z] [-] aiInputGuardVersion: 'v6-current-activity-aware',
119) [2026-04-29T14:09:36.966787167Z] [-] rawProjectCtxChars: 1525,
120) [2026-04-29T14:09:36.966789747Z] [-] guardedProjectCtxChars: 500,
121) [2026-04-29T14:09:36.966792378Z] [-] rawRecallCtxChars: 1665,
122) [2026-04-29T14:09:36.966794988Z] [-] guardedRecallCtxChars: 399,
123) [2026-04-29T14:09:36.966797778Z] [-] rawHistoryCount: 20,
124) [2026-04-29T14:09:36.966800818Z] [-] guardedHistoryCount: 2,
125) [2026-04-29T14:09:36.966803628Z] [-] rawMessageCount: 8,
126) [2026-04-29T14:09:36.966806238Z] [-] guardedMessageCount: 8,
127) [2026-04-29T14:09:36.966809048Z] [-] currentActivityQuestionDetected: false,
128) [2026-04-29T14:09:36.966811828Z] [-] projectCtxTrimmed: true,
129) [2026-04-29T14:09:36.966814698Z] [-] recallCtxTrimmed: true,
130) [2026-04-29T14:09:36.966817628Z] [-] historyTrimmed: true,
131) [2026-04-29T14:09:36.966820788Z] [-] messagesTrimmed: true,
132) [2026-04-29T14:09:36.966823779Z] [-] promptBlockSystemPromptChars: 3812,
133) [2026-04-29T14:09:36.966826839Z] [-] promptBlockProjectContextPolicyChars: 568,
134) [2026-04-29T14:09:36.966829748Z] [-] promptBlockCurrentActivityPolicyChars: 0,
135) [2026-04-29T14:09:36.966832489Z] [-] promptBlockSourceServiceChars: 550,
136) [2026-04-29T14:09:36.966835179Z] [-] promptBlockSourceResultChars: 0,
137) [2026-04-29T14:09:36.966837949Z] [-] promptBlockLongTermMemoryChars: 558,
138) [2026-04-29T14:09:36.966840859Z] [-] promptBlockReplyContextChars: 0,
139) [2026-04-29T14:09:36.966843729Z] [-] promptBlockAuxPolicyChars: 550,
140) [2026-04-29T14:09:36.966846519Z] [-] promptBlockHistoryCount: 2,
141) [2026-04-29T14:09:36.966849339Z] [-] promptBlockHistoryTotalChars: 344,
142) [2026-04-29T14:09:36.966852229Z] [-] promptBlockHistoryUserChars: 44,
143) [2026-04-29T14:09:36.966855569Z] [-] promptBlockHistoryAssistantChars: 300,
144) [2026-04-29T14:09:36.966858609Z] [-] promptBlockHistoryOtherChars: 0,
145) [2026-04-29T14:09:36.966861219Z] [-] promptBlockFinalUserChars: 44,
146) [2026-04-29T14:09:36.966864289Z] [-] promptBlockPreGuardMessageCount: 8,
147) [2026-04-29T14:09:36.96686714Z] [-] promptBlockPreGuardTotalChars: 6426,
148) [2026-04-29T14:09:36.96686993Z] [-] aiInputMessageCount: 9,
149) [2026-04-29T14:09:36.96687283Z] [-] aiInputTotalChars: 3897,
150) [2026-04-29T14:09:36.96687564Z] [-] aiInputApproxTokens: 975,
151) [2026-04-29T14:09:36.96687834Z] [-] aiInputSystemChars: 3509,
152) [2026-04-29T14:09:36.96688112Z] [-] aiInputUserChars: 88,
153) [2026-04-29T14:09:36.96688384Z] [-] aiInputAssistantChars: 300,
154) [2026-04-29T14:09:36.966887Z] [-] aiInputOtherChars: 0,
155) [2026-04-29T14:09:36.96689019Z] [-] aiInputLongestMessageChars: 900,
156) [2026-04-29T14:09:36.96689325Z] [-] aiInputLongestMessageRole: 'system',
157) [2026-04-29T14:09:36.96689645Z] [-] aiRequestedMaxCompletionTokens: 350,
158) [2026-04-29T14:09:36.96689917Z] [-] aiRequestedTemperature: 0.6
159) [2026-04-29T14:09:36.966902021Z] [-] }
160) [2026-04-29T14:09:36.925419643Z] [-] 🧠 RECALL_ENGINE_ROWS {
161) [2026-04-29T14:09:36.925434713Z] [-] source: 'chat_messages',
162) [2026-04-29T14:09:36.925482854Z] [-] scope: 'chat+global',
163) [2026-04-29T14:09:36.925491024Z] [-] chatId: '677128443',
164) [2026-04-29T14:09:36.925495965Z] [-] globalUserId: 'usr_48cc07c069030fb3',
165) [2026-04-29T14:09:36.925500234Z] [-] rows: 60,
166) [2026-04-29T14:09:36.925504895Z] [-] q: 'ты не понимаешь за какой проект я спрашиваю?',
167) [2026-04-29T14:09:36.925509365Z] [-] dateFilter: null
168) [2026-04-29T14:09:36.925513445Z] [-] }
169) [2026-04-29T14:09:36.915417978Z] [-] [Memory] Saved message {
170) [2026-04-29T14:09:36.915470689Z] [-] chatId: '677128443',
171) [2026-04-29T14:09:36.915479389Z] [-] globalUserId: 'usr_48cc07c069030fb3',
172) [2026-04-29T14:09:36.915483749Z] [-] size: 44,
173) [2026-04-29T14:09:36.915488529Z] [-] transport: 'telegram',
174) [2026-04-29T14:09:36.91549644Z] [-] sv: 2
175) [2026-04-29T14:09:36.91550146Z] [-] }
176) [2026-04-29T14:09:30.782007512Z] [-] HUMAN_MODE_DRY_RUN_TIMEOUT {
177) [2026-04-29T14:09:30.782035502Z] [-] enabled: true,
178) [2026-04-29T14:09:30.782040682Z] [-] mode: 'human',
179) [2026-04-29T14:09:30.782045973Z] [-] handled: false,
180) [2026-04-29T14:09:30.782050423Z] [-] allowed: true,
181) [2026-04-29T14:09:30.782054643Z] [-] blocked: true,
182) [2026-04-29T14:09:30.782059533Z] [-] reason: 'human_mode_project_repo_dry_run_timeout',
183) [2026-04-29T14:09:30.782063903Z] [-] meaningIntentKind: null,
184) [2026-04-29T14:09:30.782068293Z] [-] repoFactsOk: false,
185) [2026-04-29T14:09:30.782072703Z] [-] capability: null,
186) [2026-04-29T14:09:30.782077223Z] [-] responseText: null,
187) [2026-04-29T14:09:30.782081874Z] [-] hasResponseText: false,
188) [2026-04-29T14:09:30.782086444Z] [-] timedOut: true,
189) [2026-04-29T14:09:30.782102364Z] [-] durationMs: 5000
190) [2026-04-29T14:09:30.782105474Z] [-] }
191) [2026-04-29T14:09:30.782117145Z] [-] HUMAN_MODE_PROJECT_REPO_DRY_RUN {
192) [2026-04-29T14:09:30.782120545Z] [-] enabled: true,
193) [2026-04-29T14:09:30.782124265Z] [-] mode: 'human',
194) [2026-04-29T14:09:30.782127775Z] [-] handled: false,
195) [2026-04-29T14:09:30.782129745Z] [-] allowed: true,
196) [2026-04-29T14:09:30.782131655Z] [-] blocked: true,
197) [2026-04-29T14:09:30.782133785Z] [-] reason: 'human_mode_project_repo_dry_run_timeout',
198) [2026-04-29T14:09:30.782135865Z] [-] meaningIntentKind: null,
199) [2026-04-29T14:09:30.782137825Z] [-] repoFactsOk: false,
200) [2026-04-29T14:09:30.782139755Z] [-] capability: null,
201) [2026-04-29T14:09:30.782141825Z] [-] responseText: null,
202) [2026-04-29T14:09:30.782143725Z] [-] hasResponseText: false,
203) [2026-04-29T14:09:30.782145675Z] [-] timedOut: true,
204) [2026-04-29T14:09:30.782147616Z] [-] durationMs: 5000
205) [2026-04-29T14:09:30.782149585Z] [-] }
206) [2026-04-29T14:09:30.782281509Z] [-] 📨 handleMessage(core) {
207) [2026-04-29T14:09:30.782287879Z] [-] transport: 'telegram',
208) [2026-04-29T14:09:30.782290959Z] [-] chatId: '677128443',
209) [2026-04-29T14:09:30.782294069Z] [-] senderId: '677128443',
210) [2026-04-29T14:09:30.782297599Z] [-] globalUserId: 'usr_48cc07c069030fb3',
211) [2026-04-29T14:09:30.78230058Z] [-] chatType: 'private',
212) [2026-04-29T14:09:30.78230352Z] [-] isPrivateChat: true,
213) [2026-04-29T14:09:30.78230675Z] [-] isMonarchUser: true,
214) [2026-04-29T14:09:30.78231015Z] [-] userRole: 'monarch',
215) [2026-04-29T14:09:30.78231209Z] [-] isCommand: false,
216) [2026-04-29T14:09:30.78231432Z] [-] cmdBase: null,
217) [2026-04-29T14:09:30.78231631Z] [-] canProceed: true,
218) [2026-04-29T14:09:30.78231827Z] [-] isEnforced: true,
219) [2026-04-29T14:09:30.7823202Z] [-] coreMeaningDomain: 'general',
220) [2026-04-29T14:09:30.78232226Z] [-] coreMeaningIntent: 'general_chat',
221) [2026-04-29T14:09:30.78232423Z] [-] coreMeaningSuggestedAction: 'answer',
222) [2026-04-29T14:09:30.78233793Z] [-] coreMeaningEnoughInformation: true,
223) [2026-04-29T14:09:30.78234125Z] [-] coreMeaningMissingInformation: [],
224) [2026-04-29T14:09:30.782344451Z] [-] contextContinuityStrength: 'weak',
225) [2026-04-29T14:09:30.782347351Z] [-] contextContinuityCanUsePreviousTarget: false,
226) [2026-04-29T14:09:30.782350791Z] [-] contextContinuityShouldAskClarification: true,
227) [2026-04-29T14:09:30.782353991Z] [-] toolSelectionStatus: 'no_tool',
228) [2026-04-29T14:09:30.782357191Z] [-] toolSelectionTools: [],
229) [2026-04-29T14:09:30.782360241Z] [-] projectContextAllowedByMeaning: false,
230) [2026-04-29T14:09:30.782363291Z] [-] projectContextAllowedByToolSelection: false,
231) [2026-04-29T14:09:30.782366141Z] [-] projectContextAllowed: false,
232) [2026-04-29T14:09:30.782369221Z] [-] projectContextDepth: 'none',
233) [2026-04-29T14:09:30.782372251Z] [-] projectContextTrigger: 'unknown',
234) [2026-04-29T14:09:30.782374211Z] [-] projectEvidenceTriggered: false,
235) [2026-04-29T14:09:30.782376191Z] [-] projectEvidenceSeedBuilt: false,
236) [2026-04-29T14:09:30.782378171Z] [-] projectEvidencePackBuilt: false,
237) [2026-04-29T14:09:30.782380411Z] [-] projectEvidenceSeedPresent: false,
238) [2026-04-29T14:09:30.782382682Z] [-] projectEvidenceSeedCacheHit: false,
239) [2026-04-29T14:09:30.782384572Z] [-] projectEvidencePackPresent: false,
240) [2026-04-29T14:09:30.782386532Z] [-] projectEvidencePackSource: null,
241) [2026-04-29T14:09:30.782389062Z] [-] projectEvidenceTriggerReasons: [ 'blocked_by_core_meaning' ],
242) [2026-04-29T14:09:30.782391002Z] [-] humanModeProjectRepoDryRun: {
243) [2026-04-29T14:09:30.782393012Z] [-] enabled: true,
244) [2026-04-29T14:09:30.782395932Z] [-] mode: 'human',
245) [2026-04-29T14:09:30.782399342Z] [-] handled: false,
246) [2026-04-29T14:09:30.782402312Z] [-] allowed: true,
247) [2026-04-29T14:09:30.782405222Z] [-] blocked: true,
248) [2026-04-29T14:09:30.782407952Z] [-] reason: 'human_mode_project_repo_dry_run_timeout',
249) [2026-04-29T14:09:30.782420033Z] [-] meaningIntentKind: null,
250) [2026-04-29T14:09:30.782422133Z] [-] repoFactsOk: false,
251) [2026-04-29T14:09:30.782424083Z] [-] capability: null,
252) [2026-04-29T14:09:30.782426013Z] [-] responseText: null,
253) [2026-04-29T14:09:30.782427993Z] [-] hasResponseText: false,
254) [2026-04-29T14:09:30.782429983Z] [-] timedOut: true,
255) [2026-04-29T14:09:30.782431933Z] [-] durationMs: 5000
256) [2026-04-29T14:09:30.782434643Z] [-] }
257) [2026-04-29T14:09:30.782437873Z] [-] }
258) [2026-04-29T14:09:25.782103834Z] [-] HUMAN_MODE_DRY_RUN_START { hasRepoStateAgentRunner: true, timeoutMs: 5000 }
259) [2026-04-29T14:09:25.763561153Z] [-] TELEGRAM_WEBHOOK_UPDATE_RECEIVED {
260) [2026-04-29T14:09:25.763592504Z] [-] hasBody: true,
261) [2026-04-29T14:09:25.763598714Z] [-] updateId: 155256051,
262) [2026-04-29T14:09:25.763603704Z] [-] hasMessage: true,
263) [2026-04-29T14:09:25.763608904Z] [-] hasEditedMessage: false,
264) [2026-04-29T14:09:25.763613174Z] [-] hasCallbackQuery: false,
265) [2026-04-29T14:09:25.763617584Z] [-] messageTextPresent: true,
266) [2026-04-29T14:09:25.763621804Z] [-] messageChatType: 'private'
267) [2026-04-29T14:09:25.763625824Z] [-] }
268) [2026-04-29T14:09:25.763630414Z] [-] TELEGRAM_ADAPTER_MESSAGE_RECEIVED {
269) [2026-04-29T14:09:25.763634905Z] [-] messageId: 11342,
270) [2026-04-29T14:09:25.763639525Z] [-] hasText: true,
271) [2026-04-29T14:09:25.763643705Z] [-] chatType: 'private',
272) [2026-04-29T14:09:25.763647945Z] [-] fromId: 677128443
273) [2026-04-29T14:09:25.763652355Z] [-] }
274) [2026-04-29T14:08:39.049524451Z] [-] ==> Docs on specifying a port: https://render.com/docs/web-services#port-binding
275) [2026-04-29T14:08:38.937480415Z] [-] ==> Detected service running on port 10000
276) [2026-04-29T14:08:21.488375033Z] [-] chatId: '677128443',
277) [2026-04-29T14:08:21.488385143Z] [-] globalUserId: 'usr_48cc07c069030fb3',
278) [2026-04-29T14:08:21.488388333Z] [-] size: 743,
279) [2026-04-29T14:08:21.488390973Z] [-] transport: 'telegram',
280) [2026-04-29T14:08:21.488393423Z] [-] sv: 2
281) [2026-04-29T14:08:21.488395803Z] [-] }
282) [2026-04-29T14:08:21.486907234Z] [-] [Memory] Saved message {
283) [2026-04-29T14:08:21.37570244Z] [-] promptBlockHistoryOtherChars: 0,
284) [2026-04-29T14:08:21.37570501Z] [-] promptBlockFinalUserChars: 21,
285) [2026-04-29T14:08:21.37570758Z] [-] promptBlockPreGuardMessageCount: 8,
286) [2026-04-29T14:08:21.375710131Z] [-] promptBlockPreGuardTotalChars: 6534,
287) [2026-04-29T14:08:21.375712711Z] [-] aiInputMessageCount: 9,
288) [2026-04-29T14:08:21.375715431Z] [-] aiInputTotalChars: 4005,
289) [2026-04-29T14:08:21.375718271Z] [-] aiInputApproxTokens: 1002,
290) [2026-04-29T14:08:21.375720851Z] [-] aiInputSystemChars: 3663,
291) [2026-04-29T14:08:21.375723481Z] [-] aiInputUserChars: 42,
292) [2026-04-29T14:08:21.375726051Z] [-] aiInputAssistantChars: 300,
293) [2026-04-29T14:08:21.375728671Z] [-] aiInputOtherChars: 0,
294) [2026-04-29T14:08:21.375731301Z] [-] aiInputLongestMessageChars: 900,
295) [2026-04-29T14:08:21.375733911Z] [-] aiInputLongestMessageRole: 'system',
296) [2026-04-29T14:08:21.375736681Z] [-] dtMs: 4781,
297) [2026-04-29T14:08:21.375739321Z] [-] replyChars: 743,
298) [2026-04-29T14:08:21.375741911Z] [-] replyApproxTokens: 186,
299) [2026-04-29T14:08:21.375744552Z] [-] ok: true
300) [2026-04-29T14:08:21.375747152Z] [-] }
```
