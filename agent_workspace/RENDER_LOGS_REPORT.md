# RENDER_LOGS_REPORT

Controlled Render logs report collected by AgentWorkspace Render Control v1.

---

Task ID: `collect-render-logs-fresh-latest-100-20260501-004`
Workflow point: `manual-render-fresh-latest-100-logs-request`
Collected at: `2026-05-01T10:49:26.915Z`
Collected by: `SG AgentWorkspaceRenderControlService`

---

## Query

```text
level=all
limit=100
partSize=100
maxLineChars=1200
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

- Logs returned: `100`
- Parts: `1`
- Chat output: `on_request_only`
- Secrets/env exposure: `blocked_by_design`
- Code changes: `none`

## Logs

```text
1) [2026-05-01T10:44:38.811833347Z] [-] [Memory] Saved message {
2) [2026-05-01T10:44:38.811861968Z] [-] chatId: '677128443',
3) [2026-05-01T10:44:38.811869698Z] [-] globalUserId: 'usr_48cc07c069030fb3',
4) [2026-05-01T10:44:38.811872688Z] [-] size: 146,
5) [2026-05-01T10:44:38.811875199Z] [-] transport: 'telegram',
6) [2026-05-01T10:44:38.811877739Z] [-] sv: 2
7) [2026-05-01T10:44:38.811880339Z] [-] }
8) [2026-05-01T10:44:38.696235763Z] [-] AI_CALL_END {
9) [2026-05-01T10:44:38.696261774Z] [-] handler: 'chat',
10) [2026-05-01T10:44:38.696265254Z] [-] stablePersonalFactMode: false,
11) [2026-05-01T10:44:38.696267464Z] [-] longTermMemoryInjected: true,
12) [2026-05-01T10:44:38.696270144Z] [-] longTermMemoryBridgePrepared: true,
13) [2026-05-01T10:44:38.696272064Z] [-] chatIntentMode: 'normal',
14) [2026-05-01T10:44:38.696283264Z] [-] chatIntentDomain: 'unknown',
15) [2026-05-01T10:44:38.696285804Z] [-] chatIntentCandidateSlots: [],
16) [2026-05-01T10:44:38.696287764Z] [-] replyContextInjected: false,
17) [2026-05-01T10:44:38.696289794Z] [-] replyContextAuthor: '',
18) [2026-05-01T10:44:38.696291684Z] [-] replyContextHasText: false,
19) [2026-05-01T10:44:38.696293564Z] [-] historyRequestedLimit: 20,
20) [2026-05-01T10:44:38.696295444Z] [-] historyChatType: 'private',
21) [2026-05-01T10:44:38.696297344Z] [-] projectIntentRepoContextActive: false,
22) [2026-05-01T10:44:38.696312155Z] [-] projectIntentRepoContextTargetEntity: '',
23) [2026-05-01T10:44:38.696314305Z] [-] projectIntentRepoContextTargetPath: '',
24) [2026-05-01T10:44:38.696317365Z] [-] livingSGPlanPresent: true,
25) [2026-05-01T10:44:38.696321045Z] [-] livingSGPlanSource: 'LivingSGBoundary',
26) [2026-05-01T10:44:38.696324565Z] [-] livingSGPlanOk: true,
27) [2026-05-01T10:44:38.696327965Z] [-] livingSGPlanDryRun: true,
28) [2026-05-01T10:44:38.696331105Z] [-] livingSGPlanConnectedToRuntime: false,
29) [2026-05-01T10:44:38.696334245Z] [-] livingSGIntentKind: 'project_thinking',
30) [2026-05-01T10:44:38.696337305Z] [-] livingSGCapabilityActionType: 'read_only',
31) [2026-05-01T10:44:38.696340335Z] [-] livingSGGateStatus: 'allow_read_only',
32) [2026-05-01T10:44:38.696343545Z] [-] livingSGResponseKind: 'answer',
33) [2026-05-01T10:44:38.696346555Z] [-] livingSGShouldExecuteTool: false,
34) [2026-05-01T10:44:38.696349426Z] [-] livingSGNoStateChange: true,
35) [2026-05-01T10:44:38.696352246Z] [-] livingSGNoProjectIntentExecution: true,
36) [2026-05-01T10:44:38.696355135Z] [-] projectContextScopeProjectArea: '',
37) [2026-05-01T10:44:38.696358046Z] [-] projectContextScopeRepo: '',
38) [2026-05-01T10:44:38.696361196Z] [-] projectContextScopeLinkedArea: '',
39) [2026-05-01T10:44:38.696364186Z] [-] projectContextScopeLinkedRepo: '',
40) [2026-05-01T10:44:38.696367276Z] [-] projectContextScopeCrossRepo: null,
41) [2026-05-01T10:44:38.696370176Z] [-] behaviorVersion: '9.10-skeleton-v5-compact',
42) [2026-05-01T10:44:38.696373236Z] [-] behaviorStyleAxis: 'mixed',
43) [2026-05-01T10:44:38.696376686Z] [-] behaviorStyleAxisSource: 'default_no_text_detection',
44) [2026-05-01T10:44:38.696380006Z] [-] behaviorSoftStyleAskDetected: false,
45) [2026-05-01T10:44:38.696383126Z] [-] behaviorCriticality: 'normal',
46) [2026-05-01T10:44:38.696385906Z] [-] behaviorCriticalitySource: 'default_no_text_detection',
47) [2026-05-01T10:44:38.696389126Z] [-] behaviorNoNodding: true,
48) [2026-05-01T10:44:38.696392316Z] [-] stableIntentMode: 'normal',
49) [2026-05-01T10:44:38.696395306Z] [-] stableIntentDomain: 'unknown',
50) [2026-05-01T10:44:38.696398827Z] [-] stableIntentCandidateSlots: [],
51) [2026-05-01T10:44:38.696401827Z] [-] aiInputGuardVersion: 'v6-current-activity-aware',
52) [2026-05-01T10:44:38.696404896Z] [-] rawProjectCtxChars: 1525,
53) [2026-05-01T10:44:38.696407637Z] [-] guardedProjectCtxChars: 500,
54) [2026-05-01T10:44:38.696410657Z] [-] rawRecallCtxChars: 4869,
55) [2026-05-01T10:44:38.696413577Z] [-] guardedRecallCtxChars: 400,
56) [2026-05-01T10:44:38.696416567Z] [-] rawHistoryCount: 20,
57) [2026-05-01T10:44:38.696419507Z] [-] guardedHistoryCount: 2,
58) [2026-05-01T10:44:38.696426127Z] [-] rawMessageCount: 8,
59) [2026-05-01T10:44:38.696429357Z] [-] guardedMessageCount: 8,
60) [2026-05-01T10:44:38.696432747Z] [-] currentActivityQuestionDetected: false,
61) [2026-05-01T10:44:38.696435967Z] [-] projectCtxTrimmed: true,
62) [2026-05-01T10:44:38.696439117Z] [-] recallCtxTrimmed: true,
63) [2026-05-01T10:44:38.696441877Z] [-] historyTrimmed: true,
64) [2026-05-01T10:44:38.696443777Z] [-] messagesTrimmed: true,
65) [2026-05-01T10:44:38.696445708Z] [-] promptBlockSystemPromptChars: 3812,
66) [2026-05-01T10:44:38.696447697Z] [-] promptBlockProjectContextPolicyChars: 568,
67) [2026-05-01T10:44:38.696449617Z] [-] promptBlockCurrentActivityPolicyChars: 0,
68) [2026-05-01T10:44:38.696451628Z] [-] promptBlockSourceServiceChars: 550,
69) [2026-05-01T10:44:38.696453597Z] [-] promptBlockSourceResultChars: 0,
70) [2026-05-01T10:44:38.696455518Z] [-] promptBlockLongTermMemoryChars: 558,
71) [2026-05-01T10:44:38.696457448Z] [-] promptBlockReplyContextChars: 0,
72) [2026-05-01T10:44:38.696459358Z] [-] promptBlockAuxPolicyChars: 551,
73) [2026-05-01T10:44:38.696461288Z] [-] promptBlockHistoryCount: 2,
74) [2026-05-01T10:44:38.696463278Z] [-] promptBlockHistoryTotalChars: 129,
75) [2026-05-01T10:44:38.696465148Z] [-] promptBlockHistoryUserChars: 60,
76) [2026-05-01T10:44:38.696472068Z] [-] promptBlockHistoryAssistantChars: 69,
77) [2026-05-01T10:44:38.696474088Z] [-] promptBlockHistoryOtherChars: 0,
78) [2026-05-01T10:44:38.696475968Z] [-] promptBlockFinalUserChars: 60,
79) [2026-05-01T10:44:38.696477928Z] [-] promptBlockPreGuardMessageCount: 8,
80) [2026-05-01T10:44:38.696479858Z] [-] promptBlockPreGuardTotalChars: 6228,
81) [2026-05-01T10:44:38.696481848Z] [-] aiInputMessageCount: 9,
82) [2026-05-01T10:44:38.696483778Z] [-] aiInputTotalChars: 3699,
83) [2026-05-01T10:44:38.696485698Z] [-] aiInputApproxTokens: 925,
84) [2026-05-01T10:44:38.696487618Z] [-] aiInputSystemChars: 3510,
85) [2026-05-01T10:44:38.696489498Z] [-] aiInputUserChars: 120,
86) [2026-05-01T10:44:38.696491428Z] [-] aiInputAssistantChars: 69,
87) [2026-05-01T10:44:38.696493368Z] [-] aiInputOtherChars: 0,
88) [2026-05-01T10:44:38.696495318Z] [-] aiInputLongestMessageChars: 900,
89) [2026-05-01T10:44:38.696497258Z] [-] aiInputLongestMessageRole: 'system',
90) [2026-05-01T10:44:38.696499209Z] [-] dtMs: 1386,
91) [2026-05-01T10:44:38.696501129Z] [-] replyChars: 146,
92) [2026-05-01T10:44:38.696503149Z] [-] replyApproxTokens: 37,
93) [2026-05-01T10:44:38.696505279Z] [-] ok: true
94) [2026-05-01T10:44:38.696507199Z] [-] }
95) [2026-05-01T10:44:37.258139083Z] [-] aiInputOtherChars: 0,
96) [2026-05-01T10:44:37.258141412Z] [-] aiInputLongestMessageChars: 900,
97) [2026-05-01T10:44:37.258143793Z] [-] aiInputLongestMessageRole: 'system',
98) [2026-05-01T10:44:37.258146223Z] [-] aiRequestedMaxCompletionTokens: 350,
99) [2026-05-01T10:44:37.258148653Z] [-] aiRequestedTemperature: 0.6
100) [2026-05-01T10:44:37.258151013Z] [-] }
```
