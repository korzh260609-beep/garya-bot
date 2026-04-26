# ROADMAP — STAGE 8 TO STAGE 12 FOUNDATION

---

# STAGE 8 — RECALL / ALREADY-SEEN

## 8A RECALL ENGINE

8A.1 Recall request model  
8A.2 bounded recall context  
8A.3 recall diagnostics  
8A.4 recall errors  

## 8B ALREADY-SEEN DETECTOR

8B.1 already_seen table / memory  
8B.2 duplicate answer detector  
8B.3 cooldown policy  
8B.4 diagnostics counters  

Purpose:
- reduce repeated answers and allow safe bounded recall.

---

# STAGE 9 — ANSWER MODES

9.1 short / normal / long  
9.2 Adaptation Layer  
9.3 systemPrompt integration  
9.4 callAI integration  
9.5 /mode command  

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

## 10.X MARKET ANALYTICS SOURCE PRIORITY

10.X.1 CoinGecko = base market source / fallback / macro market context  
10.X.2 Binance = primary advanced trading source in architecture  
10.X.3 OKX may be active practical alternative when Binance is blocked by runtime/provider restrictions  
10.X.4 Advanced TA must use exchange candles, not CoinGecko-only arrays  
10.X.5 Order book analysis requires depth source  
10.X.6 Trade flow analysis requires trades / aggTrades equivalent  
10.X.7 Derivatives analysis requires futures/derivatives source  
10.X.8 AI explains results; robot-layer computes first  

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

Purpose:
- make SG source-first and reduce unsupported AI guesses.

---

# STAGE 11 — ACCESS MODULE EXPANDED

11.1 roles  
11.2 permissions  
11.3 access requests  
11.4 grants  
11.5 audits  

## 11.X GROUP / CROSS-CONTEXT ACCESS GATES

11.X.1 privacy-first group recall gate  
11.X.2 group-source enable flag  
11.X.3 alias-only group source display  
11.X.4 no author identity leakage  
11.X.5 no verbatim cross-group quotes  

Purpose:
- make multi-user and multi-channel access safe before advanced recall expands.

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

Purpose:
- allow SG to process user files without bypassing memory, access, or AI-cost controls.
