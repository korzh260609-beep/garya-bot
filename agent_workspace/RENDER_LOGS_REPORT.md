# RENDER_LOGS_REPORT

Controlled Render logs report collected by AgentWorkspace Render Control v1.

---

Task ID: `collect-render-logs-latest-100-20260429-001`
Workflow point: `manual-render-latest-logs-request`
Collected at: `2026-04-29T15:30:06.466Z`
Collected by: `SG AgentWorkspaceRenderControlService`

---

## Query

```text
level=all
minutes=60
limit=100
maxLineChars=1200
target=time
deployId=-
deployStatus=-
deployCommit=-
deployCreatedAt=-
deployFinishedAt=-
startTime=-
endTime=-
effectiveMinutes=60
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
- Secrets/env exposure: `blocked_by_design`
- Code changes: `none`

## Logs

```text
1) [2026-04-29T15:26:25.429240079Z] [-] ==> Docs on specifying a port: https://render.com/docs/web-services#port-binding
2) [2026-04-29T15:26:25.33516699Z] [-] ==> Detected service running on port 10000
3) [2026-04-29T15:23:17.215003366Z] [-] 📨 handleMessage(core) {
4) [2026-04-29T15:23:17.215016226Z] [-] transport: 'telegram',
5) [2026-04-29T15:23:17.215021746Z] [-] chatId: '677128443',
6) [2026-04-29T15:23:17.215026397Z] [-] senderId: '677128443',
7) [2026-04-29T15:23:17.215030926Z] [-] globalUserId: 'usr_48cc07c069030fb3',
8) [2026-04-29T15:23:17.215045767Z] [-] chatType: 'private',
9) [2026-04-29T15:23:17.215050767Z] [-] isPrivateChat: true,
10) [2026-04-29T15:23:17.215055897Z] [-] isMonarchUser: true,
11) [2026-04-29T15:23:17.215060407Z] [-] userRole: 'monarch',
12) [2026-04-29T15:23:17.215064447Z] [-] isCommand: false,
13) [2026-04-29T15:23:17.215076498Z] [-] cmdBase: null,
14) [2026-04-29T15:23:17.215079828Z] [-] canProceed: true,
15) [2026-04-29T15:23:17.215082888Z] [-] isEnforced: true,
16) [2026-04-29T15:23:17.215086038Z] [-] activeProjectContextActive: true,
17) [2026-04-29T15:23:17.215089648Z] [-] activeProjectContextSource: 'monarch_private_default_project',
18) [2026-04-29T15:23:17.215092928Z] [-] activeProjectKey: 'garya-bot',
19) [2026-04-29T15:23:17.215095988Z] [-] activeProjectRepository: 'korzh260609-beep/garya-bot',
20) [2026-04-29T15:23:17.215099079Z] [-] activeProjectRef: 'main',
21) [2026-04-29T15:23:17.215102199Z] [-] coreMeaningDomain: 'project',
22) [2026-04-29T15:23:17.215105389Z] [-] coreMeaningIntent: 'project_message',
23) [2026-04-29T15:23:17.215108159Z] [-] coreMeaningSuggestedAction: 'answer',
24) [2026-04-29T15:23:17.215110859Z] [-] coreMeaningEnoughInformation: true,
25) [2026-04-29T15:23:17.215113869Z] [-] coreMeaningMissingInformation: [],
26) [2026-04-29T15:23:17.215116789Z] [-] contextContinuityStrength: 'weak',
27) [2026-04-29T15:23:17.215119759Z] [-] contextContinuityCanUsePreviousTarget: false,
28) [2026-04-29T15:23:17.215122919Z] [-] contextContinuityShouldAskClarification: false,
29) [2026-04-29T15:23:17.215126109Z] [-] toolSelectionStatus: 'ready',
30) [2026-04-29T15:23:17.215128929Z] [-] toolSelectionTools: [
31) [2026-04-29T15:23:17.215131869Z] [-] {
32) [2026-04-29T15:23:17.21513456Z] [-] tool: 'project_context_engine',
33) [2026-04-29T15:23:17.2151377Z] [-] mode: 'project_message_context',
34) [2026-04-29T15:23:17.21514068Z] [-] requiredInputs: [],
35) [2026-04-29T15:23:17.21514355Z] [-] extractedInputs: {}
36) [2026-04-29T15:23:17.21514662Z] [-] },
37) [2026-04-29T15:23:17.21514987Z] [-] {
38) [2026-04-29T15:23:17.21515496Z] [-] tool: 'project_evidence_pipeline',
39) [2026-04-29T15:23:17.21515775Z] [-] mode: 'light_evidence_pack',
40) [2026-04-29T15:23:17.21516037Z] [-] requiredInputs: [Array],
41) [2026-04-29T15:23:17.215162941Z] [-] extractedInputs: {}
42) [2026-04-29T15:23:17.215165581Z] [-] }
43) [2026-04-29T15:23:17.215168151Z] [-] ],
44) [2026-04-29T15:23:17.215170971Z] [-] projectContextAllowedByMeaning: true,
45) [2026-04-29T15:23:17.215173651Z] [-] projectContextAllowedByToolSelection: true,
46) [2026-04-29T15:23:17.215176271Z] [-] projectContextAllowed: true,
47) [2026-04-29T15:23:17.215178801Z] [-] projectContextDepth: 'shallow',
48) [2026-04-29T15:23:17.215181391Z] [-] projectContextTrigger: 'project_work',
49) [2026-04-29T15:23:17.215184011Z] [-] projectEvidenceTriggered: false,
50) [2026-04-29T15:23:17.215186651Z] [-] projectEvidenceSeedBuilt: false,
51) [2026-04-29T15:23:17.215189211Z] [-] projectEvidencePackBuilt: false,
52) [2026-04-29T15:23:17.215191711Z] [-] projectEvidenceSeedPresent: false,
53) [2026-04-29T15:23:17.215194371Z] [-] projectEvidenceSeedCacheHit: false,
54) [2026-04-29T15:23:17.215197442Z] [-] projectEvidencePackPresent: false,
55) [2026-04-29T15:23:17.215200411Z] [-] projectEvidencePackSource: null,
56) [2026-04-29T15:23:17.215203932Z] [-] projectEvidenceTriggerReasons: [ 'depth_not_allowed:shallow' ],
57) [2026-04-29T15:23:17.215206602Z] [-] humanModeProjectRepoDryRun: {
58) [2026-04-29T15:23:17.215209152Z] [-] enabled: true,
59) [2026-04-29T15:23:17.215211732Z] [-] mode: 'human',
60) [2026-04-29T15:23:17.215214162Z] [-] handled: true,
61) [2026-04-29T15:23:17.215217122Z] [-] allowed: true,
62) [2026-04-29T15:23:17.215220232Z] [-] blocked: false,
63) [2026-04-29T15:23:17.215223122Z] [-] reason: 'human_response_built_from_repo_facts_and_capability',
64) [2026-04-29T15:23:17.215226082Z] [-] meaningIntentKind: 'project_analysis',
65) [2026-04-29T15:23:17.215228902Z] [-] repoFactsOk: true,
66) [2026-04-29T15:23:17.215231783Z] [-] capability: 'answer_from_repo_state',
67) [2026-04-29T15:23:17.215234723Z] [-] responseText: '[present]',
68) [2026-04-29T15:23:17.215237643Z] [-] hasResponseText: true,
69) [2026-04-29T15:23:17.215240673Z] [-] timedOut: false,
70) [2026-04-29T15:23:17.215249383Z] [-] durationMs: 44
71) [2026-04-29T15:23:17.215252403Z] [-] }
72) [2026-04-29T15:23:17.215255453Z] [-] }
73) [2026-04-29T15:23:17.214492811Z] [-] mode: 'human',
74) [2026-04-29T15:23:17.214497901Z] [-] handled: true,
75) [2026-04-29T15:23:17.214502341Z] [-] allowed: true,
76) [2026-04-29T15:23:17.214507731Z] [-] blocked: false,
77) [2026-04-29T15:23:17.214514271Z] [-] reason: 'human_response_built_from_repo_facts_and_capability',
78) [2026-04-29T15:23:17.214520682Z] [-] meaningIntentKind: 'project_analysis',
79) [2026-04-29T15:23:17.214525452Z] [-] repoFactsOk: true,
80) [2026-04-29T15:23:17.214529942Z] [-] capability: 'answer_from_repo_state',
81) [2026-04-29T15:23:17.214535392Z] [-] responseText: '[present]',
82) [2026-04-29T15:23:17.214540032Z] [-] hasResponseText: true,
83) [2026-04-29T15:23:17.214544362Z] [-] timedOut: false,
84) [2026-04-29T15:23:17.214549212Z] [-] durationMs: 44
85) [2026-04-29T15:23:17.214554472Z] [-] }
86) [2026-04-29T15:23:17.214566413Z] [-] HUMAN_MODE_PROJECT_REPO_DRY_RUN {
87) [2026-04-29T15:23:17.214571583Z] [-] enabled: true,
88) [2026-04-29T15:23:17.214576303Z] [-] mode: 'human',
89) [2026-04-29T15:23:17.214580693Z] [-] handled: true,
90) [2026-04-29T15:23:17.214585153Z] [-] allowed: true,
91) [2026-04-29T15:23:17.214589364Z] [-] blocked: false,
92) [2026-04-29T15:23:17.214593944Z] [-] reason: 'human_response_built_from_repo_facts_and_capability',
93) [2026-04-29T15:23:17.214598744Z] [-] meaningIntentKind: 'project_analysis',
94) [2026-04-29T15:23:17.214603424Z] [-] repoFactsOk: true,
95) [2026-04-29T15:23:17.214608014Z] [-] capability: 'answer_from_repo_state',
96) [2026-04-29T15:23:17.214612334Z] [-] responseText: '[present]',
97) [2026-04-29T15:23:17.214616904Z] [-] hasResponseText: true,
98) [2026-04-29T15:23:17.214621434Z] [-] timedOut: false,
99) [2026-04-29T15:23:17.214626095Z] [-] durationMs: 44
100) [2026-04-29T15:23:17.214630485Z] [-] }
```
