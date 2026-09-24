# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- This repository is public. Never commit private repository names, host paths, other projects' spec or proof bodies, or internal run state. Test fixtures are synthetic repositories built in a temp directory.
- Tests: `npm test` (Node 22 `node:test`, no dependencies). Every test and manual walk uses a scratch `GIT_CONFIG_GLOBAL` with `GIT_CONFIG_NOSYSTEM=1` and strips inherited `GIT_*` and `FM_*` variables; never register the hook in a real global config or repository.
- The hook's friendly name `spec-lock-reference-transaction` is a contract: the owner's one-shot escape is `git -c hook.spec-lock-reference-transaction.enabled=false <command>`. Renaming it breaks that escape.
- `git pack-refs` (and so `git gc`) sends a delete of `refs/heads/main` through the reference-transaction hook after packing it, so refusing every deletion of a protected branch would break gc.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
