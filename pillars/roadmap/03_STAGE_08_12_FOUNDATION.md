# ROADMAP — STAGE 8 TO STAGE 12 FOUNDATION

---

# STAGE 8 — RECALL / ALREADY-SEEN

## 8A RECALL ENGINE

8A.1 Recall request model  
8A.2 bounded recall context  
8A.3 recall diagnostics  
8A.4 recall errors  
8A.5 recall output is context/source material, not automatically confirmed truth  
8A.6 recall must respect user/chat/project scope and private-data boundaries  

## 8B ALREADY-SEEN DETECTOR

8B.1 already_seen table / memory  
8B.2 duplicate answer detector  
8B.3 cooldown policy  
8B.4 diagnostics counters  
8B.5 Already-Seen hints are context hints, not confirmed memory or source-of-truth claims  

Purpose:
- reduce repeated answers and allow safe bounded recall.
- prevent recalled history from becoming uncontrolled truth.

---

# STAGE 9 — ANSWER MODES

9.1 short / normal / long  
9.2 Adaptation Layer  
9.3 systemPrompt integration  
9.4 callAI integration  
9.5 /mode command  
9.6 AnswerMode changes length only; it must not weaken controlled-action boundaries  

Purpose:
- control answer length without changing SG personality or risk logic.

---

# STAGE 10 — SOURCES LAYER

10.1 sources table  
10.2 ensureDefaultSources  
10.3 fetchFromSourceKey  
10.4 HTML source  
10.5 RSS source  
10.6 CoinGecko source  
10.7 source commands  
10.8 source diagnostics  
10.9 source logs  
10.10 source access must not bypass permissions, source normalization, failure visibility, or private/source scope boundaries  

## 10.X MARKET ANALYTICS SOURCE PRIORITY

10.X.1 CoinGecko = base market source / fallback / macro market context  
10.X.2 Binance = primary advanced trading source in architecture  
10.X.3 OKX may be active practical alternative when Binance is blocked by runtime/provider restrictions  
10.X.4 Advanced TA must use exchange candles, not CoinGecko-only arrays  
10.X.5 Order book analysis requires depth source  
10.X.6 Trade flow analysis requires trades / aggTrades equivalent  
10.X.7 Derivatives analysis requires futures/derivatives source  
10.X.8 AI explains results; robot-layer computes first  
10.X.9 AI must not consume raw exchange payload directly without normalization and source metadata  

## 10D MARKET DATA EXPANSION

10D.1 exchange candles source  
10D.2 market structure layer  
10D.3 depth source  
10D.4 trade flow source  
10D.5 derivatives source  
10D.6 market fusion layer  

Gate:
- Source selection must follow real runtime verification.
- Do not expand a blocked provider as if it is available.
- Source data must preserve metadata, uncertainty and failure state.

Purpose:
- make SG source-first and reduce unsupported AI guesses.

---

# STAGE 11 — ACCESS MODULE EXPANDED

11.1 roles  
11.2 permissions  
11.3 access requests  
11.4 grants  
11.5 audits  
11.6 controlled action categories: read-only / analysis-only / prepare-only / state-changing / external-action / private-data / expensive-costly  
11.7 permissions protect actions, data, scope and surfaces; they do not block SG thinking, analysis, explanation, or non-applied planning  

## 11.X GROUP / CROSS-CONTEXT ACCESS GATES

11.X.1 privacy-first group recall gate  
11.X.2 group-source enable flag  
11.X.3 alias-only group source display  
11.X.4 no author identity leakage  
11.X.5 no verbatim cross-group quotes  
11.X.6 group-source recall must never leak personal identity or raw private context  

Purpose:
- make multi-user and multi-channel access safe before advanced recall expands.
- keep action/data protection separate from SG thinking.

---

# STAGE 12 — FILE INTAKE

12.1 files  
12.2 OCR  
12.3 STT  
12.4 parsing  
12.5 lifecycle  
12.6 file_intake_logs  
12.7 file type detection  
12.8 extracted text limits  
12.9 AI call decision policy  
12.10 file processing may be private, sensitive, or expensive and must pass scope/cost gates where configured  
12.11 file extraction output is bounded source material, not automatically verified truth  
12.12 file/media interpretation must stay separate from extraction and must respect privacy/cost gates  

Purpose:
- allow SG to process user files without bypassing memory, access, privacy, or AI-cost controls.

---

# STAGE 12A — CAPABILITY EXTENSIONS

12A.1 diagram / chart capability  
12A.2 document generation capability  
12A.3 Code/Repo analysis capability = analysis + diff only  
12A.4 automation/webhook capability  
12A.5 capability registry  
12A.6 every exposed capability must declare action type, permission need, source/tool need, and confirmation policy where relevant  
12A.7 Code/Repo analysis must not apply patches, mutate repo, deploy, or change runtime without explicit permission/confirmation  
12A.8 capability status must be derived from repo/code/runtime facts, not manual notes  
12A.9 generated capability snapshots must not override repo/code/runtime facts or redefine SG philosophy  

Purpose:
- expose useful SG abilities safely, without confusing capability access with governance authority.

---

# STAGE 12A.0 — REPOSITORY INDEXING READ-ONLY FOUNDATION

12A.0.1 GitHub access, fine-grained and read-only  
12A.0.2 RepoSource list/fetch files  
12A.0.3 RepoIndexService orchestration  
12A.0.4 textFilters deny secrets/noise  
12A.0.5 RepoIndexSnapshot normalized snapshot  
12A.0.6 Pillars indexing  
12A.0.7 MemoryPolicy policy-only, no writes  
12A.0.8 /reindex dry-run diagnostics  
12A.0.9 memoryCandidates preview, no persistence  
12A.0.10 /code_output_status  
12A.0.11 repository indexing is read-only and must not imply repo mutation permission  

Purpose:
- prepare repo/code analysis safely without mutation or uncontrolled memory writes.
