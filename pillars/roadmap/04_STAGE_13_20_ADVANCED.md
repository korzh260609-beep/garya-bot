# SG 2.1 ROADMAP — BLOCKS 5–7: INTERFACES, AUTOMATION AND DOMAINS

## Block 5 — Interfaces
Build thin adapters only after the core contracts are stable.

Order:
1. local CLI/test harness
2. Web/API adapter
3. Telegram adapter
4. Discord/email adapters
5. voice adapter

Rules:
- Transports own delivery only.
- Global identity resolves outside transport-specific business logic.
- Natural language remains primary.
- Diagnostic commands are optional shortcuts.

## Block 6 — Automation and Agents
Deliverables:
- task and job contracts
- scheduler
- workers
- retries and DLQ
- agent contracts
- prepare-only planning
- PR/diff preparation
- external-action confirmation
- budget and safety caps

Rules:
- Agents are SG components, not separate SG entities.
- Autonomous protected actions are forbidden without Action Gate approval.
- Merge, deploy and external mutation require explicit permission and confirmation.

## Block 7 — Domain Modules
Examples:
- repository analysis
- documents and diagrams
- market and risk support
- psychology support mode
- billing and legal controls
- monitoring and alerts

Rules:
- Domain modules are optional plugins over stable platform contracts.
- No domain module may redefine Semantic Kernel, memory trust, Action Gate or identity rules.
- Each domain module has its own roadmap and acceptance criteria.
