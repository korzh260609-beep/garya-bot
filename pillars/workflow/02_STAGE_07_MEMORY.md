# STAGE 7 — MEMORY LAYER V1

- 7.1 Write memory
- 7.2 Read memory
- 7.3 Context selection
- 7.4 Long-term memory
- 7.5 Anti-duplicates
- 7.6 ROBOT mock-monitor

## (SKELETON) 7.7 MemoryService CONTRACT

- 7.7.1 interface: write/read/context/recent
- 7.7.2 ban direct SQL from handlers

## 7.8 LONG-TERM MEMORY CORE (moved from future into current memory foundation)

- 7.8.1 Raw Dialogue Archive layer (restore-capable, not prompt-facing by default)
- 7.8.2 Topic Digest layer (compact summaries by theme/topic)
- 7.8.3 Confirmed Memory separation from archive/digest
- 7.8.4 bounded periodic dialogue review policy
- 7.8.5 topic grouping / clustering rules
- 7.8.6 digest generation rules
- 7.8.7 topic-based recall / conversation restoration interface
- 7.8.8 privacy / attribution / group-safety rules
- 7.8.9 diagnostics for archive/digest generation
- 7.8.10 strict rule: raw dialogue must not become uncontrolled prompt memory

## 7.9 LONG-TERM MEMORY RUNTIME MINIMUM

- 7.9.1 confirmed facts write path
- 7.9.2 confirmed facts read path
- 7.9.3 archive write path with limits
- 7.9.4 topic digest skeleton
- 7.9.5 restore current user/project context before AI answer
- 7.9.6 memory diagnostics command for monarch
- 7.9.7 no uncontrolled raw-dialogue prompt injection
- 7.9.8 duplicate/conflict guard for confirmed memory

**Gate:** Any module consuming memory must call MemoryService only.  
**Gate:** New complex feature work should not continue until 7.8 and 7.9 have a reliable runtime minimum.

---

# STAGE 7A — PROJECT MEMORY CORE

- 7A.1 Project Memory structure
- 7A.2 project_memory table
- 7A.3 project-context model
- 7A.4 project auto-restore
- 7A.5 getProjectSection / upsertProjectSection
- 7A.6 Loader
- 7A.7 Commands /pm_set /pm_show

## 7A.8 PROJECT MEMORY SERVICE COMPLETION

- 7A.8.1 ProjectMemoryService is the only write/read layer for project_memory
- 7A.8.2 confirmed project decisions writer
- 7A.8.3 confirmed project constraints writer
- 7A.8.4 confirmed project next steps writer
- 7A.8.5 confirmed project memory reader
- 7A.8.6 confirmed project memory updater
- 7A.8.7 session summary recorder
- 7A.8.8 session summary updater
- 7A.8.9 topic digest reader
- 7A.8.10 project memory context builder

## 7A.9 PROJECT WORK AUTO-RESTORE

- 7A.9.1 before project/repo work, restore current project context
- 7A.9.2 restore current workflow position
- 7A.9.3 restore active decisions
- 7A.9.4 restore active constraints
- 7A.9.5 restore open risks
- 7A.9.6 restore next safe step
- 7A.9.7 distinguish confirmed memory from chat context
- 7A.9.8 expose restore diagnostics in shadow mode

## 7A.10 PROJECT MEMORY CONTROLLED WRITE

- 7A.10.1 no automatic project DB writes from raw chat
- 7A.10.2 write only confirmed decisions / constraints / next steps / session summaries
- 7A.10.3 require explicit monarch confirmation or trusted command path for durable writes
- 7A.10.4 include source_type, source_ref, module_key, stage_key, confidence
- 7A.10.5 conflict detection before overwriting active section_state
- 7A.10.6 archive/update path instead of blind overwrite
- 7A.10.7 trace log every write attempt
- 7A.10.8 fail closed for ambiguous write intent

## 7A.11 PROJECT MEMORY + MEANING RUNTIME

- 7A.11.1 MeaningEngine detects project work
- 7A.11.2 ContextContinuityEngine prevents stale context abuse
- 7A.11.3 ToolSelectionEngine selects project context/evidence dry-run
- 7A.11.4 ProjectContextEngine decides context depth
- 7A.11.5 ProjectEvidenceTriggerPolicy decides evidence need
- 7A.11.6 ProjectEvidenceSeedCache prevents repeated rebuilds
- 7A.11.7 ProjectLightEvidencePackBuilder builds compact context
- 7A.11.8 handleMessage enriches context without direct DB write

## 7A.12 PROJECT MEMORY TEST SURFACE

- 7A.12.1 /pm_show verifies read
- 7A.12.2 /pm_set verifies manual write
- 7A.12.3 /pm_context verifies restored context
- 7A.12.4 /pm_digest verifies compact project state
- 7A.12.5 /pm_last verifies latest confirmed entries
- 7A.12.6 /pm_update verifies controlled update path
- 7A.12.7 /pm_session verifies session summary path

## 7A.13 PROJECT CAPABILITY SNAPSHOT

- 7A.13.1 project_memory may store generated capability/status snapshots
- 7A.13.2 capability snapshots are not source of truth
- 7A.13.3 capability snapshots must be regenerated from repo/code/runtime facts
- 7A.13.4 SG uses snapshots to explain current abilities to monarch/users
- 7A.13.5 user-facing output must explain practical benefit, not internal modules
- 7A.13.6 snapshot writes must go through ProjectMemoryService only
- 7A.13.7 snapshot generation must be traceable and refreshable

## 7A.V1 Speech→Text (STT skeleton, provider-agnostic)

- 7A.V1.1 STT input skeleton only
- 7A.V1.2 voice-to-text must not bypass memory safety

## 7A.V2 Voice→AI Router (text only)

- 7A.V2.1 route transcribed text through normal memory/meaning path

## 7A.V3 Text→Speech (TTS skeleton, notifications only)

- 7A.V3.1 TTS must not create memory by itself

**Gate:** Project development work should restore Project Memory Core first.  
**Gate:** Repo/GitHub real integration remains later. Project memory may prepare evidence contracts now, but must not require real GitHub fetchers.

---

# STAGE 7B — CHAT HISTORY CORE (LONG-TERM / POINT-RECALL / FREE-TIER SAFE)

- 7B.1 chat_messages table (safe-limited full messages)
- 7B.2 Indexes
  - 7B.2.1 (chat_id, created_at DESC)
  - 7B.2.2 unique (chat_id, platform_message_id)
  - 7B.2.3 (chat_id, text_hash)
- 7B.3 Log every incoming message
- 7B.4 Log every SG output
- 7B.5 Free-tier DB growth protections
  - 7B.5.1 hard cap text size (8–16KB)
  - 7B.5.2 no binary (links/meta only)
  - 7B.5.3 truncated flag
- 7B.6 retention-policy skeleton (disabled)
  - 7B.6.1 guest_retention_days
  - 7B.6.2 citizen_retention_days
  - 7B.6.3 monarch_retention_days = unlimited
  - 7B.6.4 ARCHIVE_ENABLED=false

## 7B.7 IDEMPOTENCY CORE

- 7B.7.1 process-once via platform_message_id
- 7B.7.2 race-safe inserts (insert-first + unique handling)
- 7B.7.3 correct handling of Telegram/webhook retries

## 7B.8 LOCAL CHAT HISTORY RESTORE

- 7B.8.1 safe-limited local history retrieval
- 7B.8.2 no raw unlimited history in prompt
- 7B.8.3 compact context window builder
- 7B.8.4 history-source diagnostics
- 7B.8.5 role-based read limits

## 7B.9 GROUP SOURCE FLAGS (feature-specific memory consumer; keep controlled)

- 7B.9.1 source_enabled default=false
- 7B.9.2 privacy_level enum
- 7B.9.3 allow_quotes=false
- 7B.9.4 allow_raw_snippets=false

## 7B.10 REDACTION RULES

- 7B.10.1 remove @mentions / profile links
- 7B.10.2 remove phone/email/explicit identifiers
- 7B.10.3 safe-truncate snippets (400–800 chars)
- 7B.10.4 ban verbatim quotes for cross-group (no quotes)

## 7B.11 GROUPS AS SOURCES — CHAT REGISTRY META (later consumer boundary)

- 7B.11.1 chat_meta table (chat_id, platform, chat_type, title, alias, created_at)
- 7B.11.2 alias required for group-source (show alias only)
- 7B.11.3 title stored as service field (not shown by default)

**Gate:** Local history and idempotent logging are memory core.  
**Gate:** Cross-group recall remains forbidden until Stage 11.17 and 7B.10 exist.

---
