# SAVEPOINT — Living SG Repo Source Provider Boundary Skeleton Merged

Saved at: `2026-05-02T08:40:00+03:00`
Saved by: `SG-advisor`
Scope: `Savepoint after PR #47 merge`

---

## Current confirmed repo state

```text
Repository: korzh260609-beep/garya-bot
Base branch: main
Merged PR: #47 — Add Living repo source provider boundary skeleton
Merge commit: b767d120def6c194cd78e6516758e0e26e5b017d
Previous merged PR: #46 — Add audit for remaining legacy projectIntent path
Previous merge commit: 5f3f55c78dc9f8694020b5b882803e80aae29e3b
```

---

## Confirmed merged result

```text
A disconnected LivingRepoSourceProviderBoundary skeleton now exists.
It defines a future repo source provider boundary contract without runtime execution.
The boundary describes expected sourceResultEnvelope proof shape.
It does not read repositories, write repositories, call sources, use GitHub tokens, connect RepoStateAgent runtime, or create an executor.
```

---

## Files changed by PR #47

```text
src/core/living-sg/LivingRepoSourceProviderBoundary.js
scripts/smokeLivingSGRepoSourceProviderBoundary.js
package.json
```

---

## New smoke command

```bash
npm run smoke:living-sg-repo-source-provider-boundary
```

---

## Current safe status after PR #47

```text
executor: not created
repo-read runtime: not connected
repo-write runtime: not connected
source calls: not added
GitHub token usage: not added
Human Meaning Provider: not connected
RepoStateAgent runtime: not connected
Technical Mode: not expanded
new slash commands: not added
deploy: not performed
```

---

## Current completed microstep

```text
Living SG now has a disconnected repo source provider boundary skeleton.
The next repo source provider step can be designed without reusing projectIntent technical routing as Living SG intelligence.
```

---

## Next safe microstep

```text
Read-only inspection before any provider adapter work:
- compare LivingRepoSourceProviderBoundary with LivingRepoReadRequestPlan;
- decide whether the next step is a legacy snapshot adapter skeleton or provider result adapter skeleton;
- do not connect legacy snapshot runtime yet;
- do not call GitHub;
- do not use GITHUB_TOKEN;
- do not connect RepoStateAgent runtime;
- do not add executor;
- do not deploy.
```

---

## Warnings

```text
Do not treat providerPlan as source proof.
Do not treat expectedSourceResultEnvelope as proof.
Do not treat legacy snapshot as Living SG proof until adapted into a confirmed sourceResultEnvelope.
Do not connect repo-read runtime directly from normal chat.
Do not reconnect diagnostic natural bridge.
Do not expand projectIntent phrase routing.
Any real provider must follow skeleton -> config -> logic.
```
