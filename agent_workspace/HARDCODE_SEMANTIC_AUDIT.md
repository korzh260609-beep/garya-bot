# HARDCODE_SEMANTIC_AUDIT

Date: 2026-04-28
Saved by: SG-advisor

## Monarch rule

SG must work by meaning, logic, context and exact sources.
Phrase/word/template behavior must not be the final decision layer.

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

1. Add explicit semantic intents:
- repo_state_request
- project_map_request
- semantic_map_request
- repo_snapshot_browse
- source_exact_answer_required

2. Convert phrase/token logic to weak signals.

3. Route project/repo-state questions to RepoStateAgent or Project/Semantic Map agent.

4. Add tests with non-literal wording.
