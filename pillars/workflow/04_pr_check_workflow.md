# PR Check Workflow

This document defines the safe repository change protocol for SG 2.0.

Rule:
- do not write directly to `main`;
- prefer changes through a temporary branch;
- open a PR into `dev/v2-start`;
- inspect checks before merge;
- merge only after explicit Monarch approval.

Default flow:
1. Create a branch from current `dev/v2-start`.
2. Apply the minimal planned change in that branch.
3. Open a PR targeting `dev/v2-start`.
4. Review changed files and GitHub Actions checks.
5. Merge only after the Monarch says `МОЖНО` for merge.

Emergency exception:
- direct write to `dev/v2-start` is allowed only when the Monarch explicitly asks for direct execution and the change is small, reversible, and not production-critical.

Forbidden:
- direct writes to `main`;
- hidden merges;
- changing production/runtime configuration without explicit approval;
- bypassing checks for structural changes.
