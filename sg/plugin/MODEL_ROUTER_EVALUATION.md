# SG router: offline candidate gate

`model-router-knn.ts` is an offline candidate only. The production `before_model_resolve`
hook still uses `model-router.ts`; no extra model call, paid embedding, storage, or
second routing hook is introduced.

To evaluate it, collect independent tasks in multiple languages. Embed the user
request with one fixed multilingual model and version. For each task, run Luna,
Terra, and Sol on the same inputs and environment; record human-checked completion,
total provider charge including every retry, tool call, and embedding charge,
and a stable task ID. Exclude personal content from the published dataset.
Split by task ID and task family before tuning thresholds. Run the held-out
set through `evaluateRouterCandidate` and compare its completion rate,
coverage, and cost of successfully completed tasks with the current router
and Terra baseline. Include hard short tasks, long simple tasks, attachments,
coding, audits, and follow-ups across languages. The current data has route
decisions but no checked completions or complete task costs; consequently
there is no valid savings or success estimate and the candidate must stay off.

The vectors in unit tests are artificial and check arithmetic and abstention,
not multilingual embedding quality. Before integration, verify the actual
embedding provider contract and account for its fee and latency; avoid a new
provider or runtime path when the OpenClaw embedding SDK suffices.
