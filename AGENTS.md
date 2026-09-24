# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- This repository is public. Never commit private repository names, host paths, other projects' spec or proof bodies, or internal run state. Test fixtures are synthetic repositories built in a temp directory.
- Tests: `npm test` (Node 22 `node:test`, no dependencies). Every test and manual walk uses a scratch `GIT_CONFIG_GLOBAL` with `GIT_CONFIG_NOSYSTEM=1`, strips inherited `GIT_*`, `FM_*` and `SPEC_LOCK_*` variables, and points `HOME`, `SPEC_LOCK_CONFIG` and `SPEC_LOCK_LOG` into the temp directory; never register the hook in a real global config or repository, and never write the real central file or landing log.
- The hooks' friendly names `spec-lock-reference-transaction` and `spec-lock-pre-push` are a contract: the owner's one-shot escape is `git -c hook.<name>.enabled=false <command>`. Renaming either breaks that escape.
- A test that pushes to a local bare remote must switch the remote's own lock off (`hook.spec-lock-reference-transaction.enabled=false` in the remote's config): receive-pack runs the global hooks in the remote too, and the refusal would then come from the wrong side. Git hands pre-push the refs the remote already has in name order, then new ones, whatever the order on the command line (seen on git 2.54).
- `git pack-refs` (and so `git gc`) sends a delete of `refs/heads/main` through the reference-transaction hook after packing it, so refusing every deletion of a protected branch would break gc. Deleting a ref that is both packed and loose runs a nested transaction whose `committed` call comes while the loose ref still stands; `committed` in `lib/lock.mjs` settles only moves that have happened.
- `bin/spec-lock-hook` uses only shell builtins and git: git may run it with a PATH that has no Node and no `sed` or `grep`, and a missing tool must not read as "nothing guarded".
- `action.yml` runs `bin/spec-lock-action` on GitHub, and consumers pin it by full commit SHA. The checker line (`spec-lock checker <version>+<hash>`) hashes `bin/spec-lock` and `lib/*.mjs`, so it changes whenever they do. `test/github-walk.mjs` (also `SPEC_LOCK_CANARY=<owner/repo> npm test`) pushes to a real repository and moves its main: point it only at the throwaway canary `EvanAgee/spec-lock-canary`.
- Write refs from the hook only in the `committed` state. Under the reftable backend a nested `git update-ref` in `prepared` fails with "cannot lock references". Every git command the hook runs re-enters the hook, so refs it writes must stay outside the guarded set (`refs/spec-lock/`).

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
