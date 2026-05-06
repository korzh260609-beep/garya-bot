# SG 2.0 Workflow

> AGENT NOTE:
> This folder is the ordered workflow map for SG 2.0.
> Read this folder before proposing new project steps.
> Do not treat workflow as code or execution status. It is the Monarch-approved build order and rule map.
> Actual implementation status must be verified only from repository code, commits, Actions, Render, or runtime tests.
> This folder belongs inside `pillars/` because workflow is part of the project laws and governance layer.

This folder contains SG 2.0 workflow blocks.

Each block is a separate file.

Current files:

1. `01_living_sg_foundation.md` — first workflow block: living SG foundation.
2. `02_github_access_repo_workflow.md` — second workflow block: GitHub access and repo workflow restrictions.

Rules:

- workflow is a folder, not one root file;
- workflow belongs under `pillars/workflow/`;
- each logical block gets its own file;
- blocks must stay short, clear, and ordered;
- new blocks are added only after Monarch approval;
- every new file must include an `AGENT NOTE` near the top;
- `AGENT NOTE` must explain the file purpose, boundaries, and what an agent must not change without approval;
- this folder does not track completion status;
- status claims must come from code, commits, Actions, Render, or runtime tests.
