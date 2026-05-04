# RepoMaintenanceAgent — Repo Maintenance

RepoMaintenanceAgent is a read-only SG component.

Purpose:

```text
After repository changes, detect what must be checked, synchronized, updated, tested, or snapshotted.
```

Boundary:

- consumes changed-file facts and optional RepoStateAgent output;
- produces maintenance recommendations;
- does not replace RepoStateAgent;
- does not own runtime diagnostics;
- does not call AI;
- does not write files;
- does not create commits;
- does not deploy;
- does not become SG itself.

Initial mode:

```text
report_only
```
