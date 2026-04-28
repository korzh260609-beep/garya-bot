# SG_CAPABILITY_ACCESS.md

## Core rule

Everything useful created inside SG must become accessible through SG.

SG is the project itself and the user-facing Advisor entity.

Internal capabilities must not be designed only for external helpers or developer-only usage.

## Applies to

- agents
- modules
- tools
- sources
- memory types
- project memory
- reports
- diagnostics
- integrations
- task engine
- document/file intake
- future services

## Monarch access

The Monarch owns SG and must be able to interact with SG and its capabilities through supported transports:

- Telegram
- future web/client UI
- Discord or other chat transports
- future voice/document interfaces
- controlled project tools

## Required flow

```text
Monarch/user
-> transport adapter
-> SG
-> internal capability
-> SG
-> transport adapter
-> Monarch/user
```

## Forbidden flow

```text
Monarch/user
-> external helper or raw developer command
-> internal capability bypassing SG
```

## Practical rule

When we create an agent, module, source, memory type, report, diagnostic tool or integration, we must plan how SG will expose it to the Monarch/user in normal human language.

Developer commands and AgentWorkspace may exist for testing and diagnostics, but they are not the final user interface.
