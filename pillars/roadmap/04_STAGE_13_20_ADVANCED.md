# ROADMAP — STAGE 13 TO STAGE 20 ADVANCED

---

# STAGE 13 — V8 INITIATIVE

13.1 diagnostics  
13.2 improvements  
13.3 architecture audit  
13.4 UX audit  
13.5 module improvements  

## 13.6 COMFORT-BY-DEFAULT SKELETON

13.6.1 pressure detection  
13.6.2 over-philosophy detection  
13.6.3 loss-of-focus detection  

Gate:
- SG may propose improvements, but does not apply them without monarch approval.

Purpose:
- make SG capable of structured self-improvement suggestions.

---

# STAGE 14 — V9 PR / DIFF

14.1 PR proposal generation  
14.2 auto-diff read-only  
14.3 explanations  
14.4 suggestions  
14.5 human approval mandatory  

Gate:
- SG proposes only.
- Monarch applies code manually or approves the next action.

Purpose:
- support safer code work without autonomous production changes.

---

# STAGE 14A — REAL INTEGRATIONS

14A.1 Discord implementation  
14A.2 Web UI / API  
14A.3 GitHub / Repo integration  
14A.4 Diagram engines  
14A.5 Zoom / Voice integration  

## 14A.6 MULTI-CHANNEL REQUIREMENT

14A.6.1 Discord only after global identity foundation  
14A.6.2 all channels must resolve global_user_id and share memory  
14A.6.3 ban separate “Discord memory” / separate Discord limits  
14A.6.4 Discord continues Telegram context through same global_user_id  

Gate:
- Real GitHub/repo integration remains here, not in early Project Memory Core.

Purpose:
- connect real external systems after the core is safe.

---

# STAGE 15 — V10 MULTI-MODEL

15.1 text models registry  
15.2 specialized models registry: vision / STT / TTS / code  
15.3 AI Router V1, task-type based  
15.4 modality detection: text / vision / speech / code  
15.5 fallback policy  
15.6 cost tier tagging per model  

Purpose:
- route tasks to correct models without hard-coded model strings.

---

# STAGE 16 — V11 MULTI-MODEL++ / SMART ROUTING

16.1 automatic modality routing  
16.2 cheap-first policy by default  
16.3 reasoning-AI only by explicit need  
16.4 parallel specialized AI allowed  
16.5 AI usage explanation log  

Purpose:
- reduce costs and improve reliability through smarter routing.

---

# STAGE 17 — V12 HYBRID INTELLIGENCE

17.1 hybrid execution: robot + specialized AI + reasoning  
17.2 specialized AI before reasoning AI  
17.3 reasoning as validator, not extractor  
17.4 auto-orchestrator with safety caps  
17.5 AI-budget governor per user/per role  

Purpose:
- make SG an orchestrator, not just a chat model wrapper.

---

# STAGE 18 — LEGAL & BILLING

18.1 tariffs & plans  
18.2 AI credits per AI type  
18.3 cost transparency per task  
18.4 logs dashboard  
18.5 memory dashboard  
18.6 license  
18.7 privacy  
18.8 model-level audit  

## 18.9 DATA RETENTION & EXPORT SKELETON

18.9.1 export user data  
18.9.2 delete/anonymize hooks  

Notes:
- billing/memory dashboard and legal export/delete remain later consumers over memory.
- they are not required for Project Memory Core runtime.

Purpose:
- make paid usage, privacy, and data rights manageable.

---

# STAGE 19 — RISK & MARKET PROTECTION

19.1 architecture  
19.2 risk_events  
19.3 BTC/ALT monitoring  
19.4 alerts  
19.5 policies  
19.6 rotation logic  
19.7 /exit_now /reenter  
19.8 Telegram alerts  
19.9 project_memory integration  
19.10 simulations  
19.11 Risk V1  
19.12 Risk V2/V3  

Notes:
- risk module project_memory integration remains here because it is a risk-module consumer of memory.
- it is not Project Memory Core.

Purpose:
- protect users and monarch from market/risk exposure.

---

# STAGE 20 — PSYCHO MODULE SUPPORT MODE, SOURCE-FIRST

20.1 psych_topics table  
20.2 psych_techniques table  
20.3 psych_system_prompt  
20.4 mood_signal, soft analysis  
20.5 safe_policies: no diagnosis, no therapy replacement  
20.6 sources via Sources Layer  
20.7 /psy /mood /technique skeleton  
20.8 role gates  
20.9 psych_events skeleton  
20.10 retention minimal, privacy-first  
20.11 safety rules: no diagnosis / no labels / no therapy claims  

Purpose:
- provide safe support-mode psychology features without pretending to replace professionals.

---

# CRITICAL FIXATION — MUST REMAIN LAST

1. RULE — SG survives model replacement  
2. RULE — removing specialized AI must not break tasks  
3. RULE — expensive AI requires confirmation  
4. RULE — system correctness > AI intelligence  
