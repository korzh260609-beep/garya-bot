# RepoStateAgent — Repo Intelligence

RepoStateAgent is a read-only SG component.

Purpose:

```text
Understand what currently exists in the repository/project.
```

Boundary:

- observes repository/project facts;
- builds compact project maps from provided input;
- builds deterministic architecture health summaries;
- builds deterministic next-action guidance;
- does not call AI;
- does not write files;
- does not change repository state;
- does not own runtime diagnostics;
- does not become SG itself.

Initial mode:

```text
skeleton -> config -> logic
```

This folder is the skeleton boundary for future repo intelligence work.
