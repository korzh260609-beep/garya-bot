# Risks and Stop Conditions

> AGENT NOTE:
> This file defines hard stop conditions for creating or changing the Coding Agents Team.
> It is documentation only. It does not implement runtime agents and does not enable autonomy.

## 1. Purpose

This file defines when a coding operator, SG, Advisor, or any future coding agent must stop instead of continuing.

These rules protect the project from uncontrolled autonomy, architecture drift, unsafe writes, and hidden production actions.

## 2. Hard stop conditions

Stop immediately if the task requires any of these:

```text
write to main
write to dev/v2-start-clean-copy
push directly to dev/v2-start
merge a PR
enable auto-merge
deploy to production
change Render production settings
change secrets
change SG Core architecture
change pillars/laws
run destructive database changes
delete user data
change balances or payments
add paid provider integration
create unlimited recurring AI/tool calls
create hidden autonomous execution
```

If any hard stop condition appears, report it and wait for explicit Monarch approval.

## 3. Architecture risks

Block or request review if the change:

```text
puts module logic into SG Core
mixes unrelated responsibilities
bypasses Module Registry
creates direct coupling between unrelated modules
creates a giant file with mixed logic
changes existing architecture without command
creates a second competing agent system
```

Required response:

```text
Architecture risk detected. Stop and request ArchitectureGuardAgent review.
```

## 4. Branch risks

Block if the change targets:

```text
main
dev/v2-start-clean-copy
any branch described as clean copy or чистовик
protected branch without explicit approval
```

Required response:

```text
Protected branch risk detected. Stop.
```

## 5. Permission risks

Block if any agent receives these permissions in V1:

```text
canMerge = true
canDeploy = true
canChangeSecrets = true
canChangeProtectedBranches = true
```

Required response:

```text
Dangerous permission detected. Stop.
```

## 6. Runtime autonomy risks

Block if V1 implementation creates:

```text
self-running coding loop
automatic PR merge
automatic deploy
automatic production change
automatic secret access
automatic paid API usage
unlimited repeated tool calls
```

Required response:

```text
Autonomy risk detected. V1 must remain skeleton only.
```

## 7. Security risks

Block if the change includes:

```text
API keys in repo
private tokens in repo
secrets in frontend
logs containing secrets
permission bypass
hidden admin path
unreviewed external tool access
```

Required response:

```text
Security risk detected. Stop and request security review.
```

## 8. Data risks

Block if the change can:

```text
delete user data
mix private user memory
expose private memory
change project memory ownership
change balances without explicit command
run irreversible migration
```

Required response:

```text
Data risk detected. Stop and request explicit approval.
```

## 9. Cost risks

Block if the change creates:

```text
unlimited AI calls
recurring AI tasks without limits
expensive model as default without config
paid external service without approval
missing cost guard
```

Required response:

```text
Cost risk detected. Stop until limits/config exist.
```

## 10. Test evidence risks

Request changes if:

```text
smoke checks are missing
tests are claimed but not shown
failing checks are hidden
tests are deleted to pass
assertions are weakened without approval
```

Required response:

```text
Test evidence insufficient. Request changes.
```

## 11. Documentation risks

Request changes if docs:

```text
claim skeleton is production-ready
claim autonomy is enabled when it is not
hide limitations
mark incomplete work as done
contradict actual code
```

Required response:

```text
Documentation mismatch detected. Request changes.
```

## 12. Safe fallback

If unsure, choose the safest action:

```text
stop
report uncertainty
list missing evidence
ask for Advisor or Monarch review
```

Do not guess.

Do not continue silently.

Do not make architecture decisions alone.

## 13. Final rule

Speed is useful only if control remains intact.

If speed conflicts with safety, architecture, branch discipline, or Monarch approval, safety wins.
