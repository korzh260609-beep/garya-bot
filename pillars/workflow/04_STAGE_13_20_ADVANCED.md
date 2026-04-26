# STAGE 13 — V8 INITIATIVE

- 13.1 improvements
- 13.2 find weak points
- 13.3 architecture audit
- 13.4 UX audit
- 13.5 module improvements

## 13.6 comfort-by-default skeleton

- 13.6.1 pressure detection
- 13.6.2 over-philosophy detection
- 13.6.3 loss-of-focus detection

---

# STAGE 14 — V9 PR / DIFF (CODE-AI USAGE)

- 14.1 PR generation (proposal only)
- 14.2 auto-diff (read-only)
- 14.3 explanations
- 14.4 suggestions
- 14.5 Human approval mandatory (hard)

---

# STAGE 14A — REAL INTEGRATIONS

- 14A.1 Discord implementation
- 14A.2 Web UI / API
- 14A.3 GitHub / Repo integration
- 14A.4 Diagram engines
- 14A.5 Zoom / Voice integration

## 14A.6 MULTI-CHANNEL REQUIREMENT (hard)

- 14A.6.1 Discord only after Stage 4 linking foundation
- 14A.6.2 all channels must resolve global_user_id and share memory
- 14A.6.3 ban separate “Discord memory” / separate Discord limits
- 14A.6.4 Discord continues Telegram context (same global_user_id)

---

# STAGE 15 — V10 MULTI-MODEL (SPECIALIZED AWARE)

- 15.1 text models registry
- 15.2 specialized models registry (vision/stt/tts/code)
- 15.3 AI Router V1 (task-type based)
- 15.4 modality detection (text/vision/speech/code)
- 15.5 fallback policy (spec-AI unavailable → text-only)
- 15.6 cost tier tagging per model

---

# STAGE 16 — V11 MULTI-MODEL++ (SMART ROUTING)

- 16.1 automatic modality routing
- 16.2 cheap-first policy (default)
- 16.3 reasoning-AI only by explicit need
- 16.4 parallel spec-AI allowed (vision + stt)
- 16.5 AI usage explanation log (why this model)

---

# STAGE 17 — V12 HYBRID INTELLIGENCE

- 17.1 hybrid execution (robot + spec-AI + reasoning)
- 17.2 spec-AI before reasoning-AI (hard)
- 17.3 reasoning as validator, not extractor
- 17.4 auto-orchestrator with safety caps
- 17.5 AI-budget governor (per user/per role)

---

# STAGE 18 — LEGAL & BILLING (AI COST VISIBILITY)

- 18.1 tariffs & plans
- 18.2 AI-credits per AI-type
- 18.3 cost transparency per task
- 18.4 logs dashboard
- 18.5 memory dashboard
- 18.6 license
- 18.7 privacy
- 18.8 model-level audit (who called what/why)

## (SKELETON) 18.9 DATA RETENTION & EXPORT

- 18.9.1 export user data
- 18.9.2 delete/anonymize hooks

Notes:
- These remain later because they are legal/billing/dashboard layers over memory.
- They are not required for Project Memory Core runtime.

---

# STAGE 19 — RISK & MARKET PROTECTION

- 19.1 architecture
- 19.2 risk_events
- 19.3 BTC/ALT monitoring
- 19.4 alerts
- 19.5 policies
- 19.6 rotation logic
- 19.7 /exit_now /reenter
- 19.8 TG alerts
- 19.9 project_memory integration
- 19.10 simulations
- 19.11 Risk V1
- 19.12 Risk V2/V3

Notes:
- 19.9 remains here because it is risk-module usage of project_memory.
- It is not Project Memory Core.

---

# STAGE 20 — ПСИХО-МОДУЛЬ (SUPPORT MODE, SOURCE-FIRST)

- 20.1 psych_topics table
- 20.2 psych_techniques table
- 20.3 psych_system_prompt
- 20.4 mood_signal (soft analysis)
- 20.5 safe_policies (no diagnosis, no therapy replacement)
- 20.6 sources via Sources Layer
- 20.7 /psy /mood /technique (skeleton)
- 20.8 role gates
- 20.9 psych_events (skeleton)
- 20.10 retention minimal, privacy-first
- 20.11 Safety rules (hard): no diagnosis / no labels / no therapy claims

---

## 5) CRITICAL FIXATION (APPENDIX — MUST REMAIN AT EOF)

1. RULE — SG survives model replacement
2. RULE — removing spec-AI must not break tasks
3. RULE — expensive AI requires confirmation
4. RULE — system correctness > AI intelligence
