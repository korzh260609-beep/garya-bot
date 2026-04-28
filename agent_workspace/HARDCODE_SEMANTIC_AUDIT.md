# HARDCODE_SEMANTIC_AUDIT

Date: 2026-04-28
Saved by: SG-advisor

## Monarch rule

SG must work by meaning, logic, context and exact sources.
Phrase/word/template behavior must not be the final decision layer.

## Development order decided by Monarch

Current order is:

1. Agents.
2. Memory types and memory architecture.
3. Global semantic routing.

Reason:
- agents provide exact work units and source/tool execution;
- memory types define what SG remembers, separates and reuses;
- global semantics should route into already defined agents and memory, not into empty abstractions.

Do not jump directly into global SemanticRouter before agent and memory work is stable enough.
All new agent and memory work must still follow the meaning-first rule and must not add new phrase-bound crutches.

## Main findings

1. HIGH RISK: `src/core/projectIntent/semantic/projectIntentSemanticIntentDetector.js`
- Uses `normalized.includes(...)` and prefix hits to decide final repo intent.
- Must become weak signal extraction only.

2. HIGH RISK: `src/core/projectIntent/projectIntentScope.js`
- Contains large hardcoded phrase/token lists for scope/action classification.
- Must be split into LexicalSignalExtractor + SemanticScopeResolver.

3. HIGH RISK: `src/core/meaning/MeaningEngine.js`
- Domain detection uses regex keyword matching.
- Must become fallback only; primary should be semantic meaning object.

4. MEDIUM/HIGH RISK: `src/projectExperience/ProjectContextEngine.js`
- Project depth uses regex word checks.
- Must accept meaning object and use lexical checks only as fallback.

5. MEDIUM RISK: `src/core/projectIntent/conversation/projectIntentConversationHumanReplies.js`
- Contains template replies.
- `humanRepoStatusReply()` was adapted to label legacy snapshot, but repo/project-state questions should route to RepoStateAgent / Project Map / Semantic Map.

6. MEDIUM RISK: `src/core/meaning/ToolSelectionEngine.js`
- Not phrase-bound directly, but inherits weak meaning.
- Needs tools: repo_state_agent, project_map_builder, semantic_map_builder.

## Target architecture

User message -> MeaningEngineV2 -> ToolSelectionEngineV2 -> exact Source/Agent -> answer.

Legacy snapshot is only a fallback browser, not project truth.

## Required next steps

1. Continue agent work first.
2. Work on memory types and memory architecture next.
3. Build global semantic routing after agents and memory are clear.
4. Convert phrase/token logic to weak signals during this migration.
5. Route project/repo-state questions to RepoStateAgent or Project/Semantic Map agent.
6. Add tests with non-literal wording.
