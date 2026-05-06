# DiagnosticsRenderAgent

DiagnosticsRenderAgent is SG runtime diagnostics instrument for Render evidence.

Purpose:
- collect Render logs requested by the Monarch/Advisor workflow;
- collect interesting Render deploys;
- collect single deploy metadata;
- collect Render status evidence;
- write Advisor-readable reports into `agent_workspace/render/`.

Current SG 2.0 status:
- skeleton only;
- service methods return safe stub reports;
- no Render API integration yet;
- no runtime command runner is connected yet;
- no GitHub writes are performed by this skeleton.

Boundaries:
- must not modify source code;
- must not modify pillars;
- must not expose secrets/env/API keys;
- must not become repo intelligence or repo maintenance agent.
