# SG 2.1 ROADMAP — BLOCKS 5–7: INTERFACES, AUTOMATION AND DOMAINS

## Interfaces
Add thin adapters only after the platform core is stable:
- local test harness
- Telegram
- Web/API
- Discord
- email
- voice

All transports resolve global identity, create CanonicalRequest and deliver normalized responses.

## Automation and Agents
Add task execution, scheduling, workers, retries, DLQ, planning agents and prepare-only code/PR capabilities. Protected execution always passes Action Gate.

## Domain Modules
Add optional domains such as documents, repository analysis, market analysis, billing and psychology support through capability contracts.

## Acceptance criteria
- Switching transport does not create a new SG identity or separate memory.
- Automation cannot bypass permission or confirmation.
- Domain modules cannot redefine Semantic Kernel, memory trust or Action Gate contracts.
