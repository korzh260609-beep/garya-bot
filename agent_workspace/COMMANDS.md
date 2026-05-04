# COMMANDS

Workspace command inbox for SG runtime collectors.

Current default state:

```text
COMMAND_ID: NONE
STATUS: EMPTY
ACTION: NONE
```

Rules:

- commands must be explicit;
- collectors may execute only allowlisted read-only actions;
- no code writes;
- no Render mutations;
- no AI analysis;
- reports must be written only into allowlisted `agent_workspace/*.md` files.
