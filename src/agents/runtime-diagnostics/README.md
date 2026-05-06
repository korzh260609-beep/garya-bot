# Runtime Diagnostics Agents

Runtime diagnostics agents collect facts about runtime, deploys, logs, health, and diagnostics.

Boundary:
- may collect runtime evidence;
- must not own repo architecture decisions;
- must not become repo intelligence or repo maintenance logic;
- must not perform production changes by default.

Current SG 2.0 status:
- DiagnosticsRenderAgent skeleton is present;
- no runtime runner is connected yet;
- no Render API reads are connected yet.
