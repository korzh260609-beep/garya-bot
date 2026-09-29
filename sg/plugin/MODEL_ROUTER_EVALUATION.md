# SG semantic router — evidence gate

Auto uses the existing `before_model_resolve` hook. The old lexical classifier is removed.
Manual modes still select their named tier. Without a qualified corpus, a missing embedding
provider, weak local evidence, or an unsupported attachment route, Auto uses Terra. No
extra service, model judgment call, user transcript store, or second routing hook exists.
Direct-session continuations may use the preceding user request from that same native
session; group history is never read.

## Corpus contract

Place a JSON file at `<OpenClaw stateDir>/sg/model-router-corpus.json` only after review.
Its root contains `version: 1`, `embedding: {provider, model}`, and `examples`.
Each example contains a unique `taskId`, `familyId` shared by translations or near
duplicates, `language`, a vector from that *same* embedding model, and exactly three
`trials` (tiers `cheap`, `medium`, `expensive`). Each trial has human verified
`succeeded: boolean`, blind rubric `quality: 0..1`, and `totalCost` in a single
currency. Record all provider charges for the entire attempt, including retries,
agent tool calls and the embedding query; failed attempts have a cost too. The vector
must be computed on the actual user task before judging outputs. Obtain consent and
remove personal content; the runtime corpus contains vectors and outcomes, not text.
Version and model identity must change whenever vector generation changes.

A trial is comparable only if Luna/Terra/Sol ran from the same snapshot and tool
state, against the same acceptance rubric. `agent_end.success` means the process ran;
it is not a task outcome. Human review must check completion and blind comparative
quality. The current Render logs do **not** supply these labels or costs.

## Decision and acceptance

The runtime requires at least 100 independent families and three languages with at
least 20 examples each. It checks family-held-out behavior before opening the corpus:
coverage >=80%, completed tasks >= Terra, and observed cost per completed task below
Terra overall and in each sufficiently represented language. These are necessary
gates, not proof of generalization. The local KNN needs
50 independent similar families (cosine >=0.65). A tier needs a 95% Wilson lower
bound on task completion >=0.90; non-Terra choices also need similarity-weighted
paired quality against Terra >=0.5. Of eligible tiers, choose the lowest total
cost per completed task. The comparison is inspired by RouteLLM's similarity
weighted ranking, without importing its two-model checkpoints, separate Python
service, or fixed model IDs. If evidence is inadequate, abstain to Terra.

Before writing the production corpus, freeze the thresholds and evaluate on a
separately held-out family split, including translations, short hard tasks, long easy
tasks, code, audits, attachments, and continuations. Compare against both Terra and
the previously deployed router by language, completion, coverage, latency, full
cost per successful task, and the cost of embeddings. Do not publish a savings claim
from synthetic vectors or in-sample family holdout. Only an operator-verified corpus
and real provider billing can establish a benefit. The corpus is absent from git and
the current service, so an image update alone will conservatively select Terra.
