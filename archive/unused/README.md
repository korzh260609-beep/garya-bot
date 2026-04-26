# archive/unused

This folder is for old or unused files that must stay in the repository for reference, but must not participate in SG runtime behavior.

## Rules

- Files placed here are considered inactive.
- Files here must not be imported by runtime code.
- Files here must not be used as source of truth.
- Files here are kept only for history, comparison, or manual recovery.
- If a file is moved here, any active import/reference to it must be removed or disabled first.
- Do not place secrets, tokens, credentials, dumps, or private user data here.

## Recommended use

Use this folder for:

- old drafts;
- obsolete experimental files;
- replaced skeletons;
- previous versions kept for comparison;
- files that are no longer connected to SG runtime.

## Not for

Do not use this folder for:

- active source code;
- active configuration;
- active prompts;
- active workflow files;
- database migrations that may still be needed;
- files referenced by imports, scripts, deployment, or diagnostics.
