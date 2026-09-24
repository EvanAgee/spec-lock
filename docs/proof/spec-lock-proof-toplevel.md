---
spec: docs/specs/spec-lock-proof-toplevel.md
tags: [spec-lock, proof-path, docs-proof]
date: 2026-09-24
issue: spec-lock-proof-toplevel
walked: a658e5e0c58723249b26428810f26a41db4463f8
---

# Proof: only top-level docs/proof/*.md files are proofs

This branch narrows the proof matcher in `lib/lock.mjs` from any `.md` under `docs/proof/` to a file directly in `docs/proof/`. A `.md` file in a folder below it now falls under the documentation rule. `README.md` says so in one sentence. The evidence binding's path rule is unchanged. The four new tests are at the end of `test/spec-lock.test.mjs`, named `proof-toplevel AC1` to `proof-toplevel AC4`.

Every test and walk used a scratch `HOME`, a scratch global git config (`GIT_CONFIG_GLOBAL`, `GIT_CONFIG_NOSYSTEM=1`) and a scratch landing log, with inherited `GIT_*`, `FM_*` and `SPEC_LOCK_*` variables removed. No real global config, central file, log or repository changed. Nothing was pushed, per the task: the local suite and the breaks stand in for a CI run.

Environment: git 2.54.0 (Apple Git-157), Node v22.22.0, macOS.

## Criteria and evidence

| AC | Test in `test/spec-lock.test.mjs` | Red before the fix | Green | Break that turns it red |
|---|---|---|---|---|
| AC1 | `proof-toplevel AC1: a .md file below docs/proof/ is not checked as a proof, beside a proof or alone` | yes: `- docs/proof/reviews/x.md: no spec: field in its front matter` | yes | M1 |
| AC2 | `proof-toplevel AC2: a code landing whose only proof-shaped file is nested is refused with no proof` | yes: "a nested file stood in for a top-level proof: spec-lock: ok", `0 !== 1` | yes | M2 |
| AC3 | `proof-toplevel AC3: a top-level proof beside nested files is still checked against its own spec` | yes: the fault list also held `- docs/proof/reviews/x.md: no spec: field in its front matter` | yes | M3 |
| AC4 | `proof-toplevel AC4: the git hook, the pre-push adapter and the action agree on nested files under docs/proof/` | yes: for the nested-only landing, `{ action: 0, hook: false, push: false }` instead of `{ action: 1, hook: true, push: true }` | yes | M4 |

### Red first

The four tests were added before the fix and run against the unchanged `lib/lock.mjs` of b7b64f0, with `node --test --test-name-pattern='^proof-toplevel' test/spec-lock.test.mjs`:

```text
not ok 1 - proof-toplevel AC1: ...
    - docs/proof/reviews/x.md: no spec: field in its front matter
not ok 2 - proof-toplevel AC2: ...
    a nested file stood in for a top-level proof: spec-lock: ok
    0 !== 1
not ok 3 - proof-toplevel AC3: ...
    +   '- docs/proof/reviews/x.md: no spec: field in its front matter',
not ok 4 - proof-toplevel AC4: ...
    +   action: 0,  hook: false,  push: false
    -   action: 1,  hook: true,   push: true
# tests 4
# pass 0
# fail 4
```

### Green

`npm test` at the walked commit, exit 0: 30 tests, 29 pass, 0 fail, 1 skipped. The skipped test is the live GitHub canary walk, which needs `SPEC_LOCK_CANARY` and a push; this task allows no push.

```text
ok 27 - proof-toplevel AC1: a .md file below docs/proof/ is not checked as a proof, beside a proof or alone
ok 28 - proof-toplevel AC2: a code landing whose only proof-shaped file is nested is refused with no proof
ok 29 - proof-toplevel AC3: a top-level proof beside nested files is still checked against its own spec
ok 30 - proof-toplevel AC4: the git hook, the pre-push adapter and the action agree on nested files under docs/proof/
# tests 30
# pass 29
# fail 0
# skipped 1
```

## Breaks

Each break ran on a throwaway copy of the worktree (an rsync copy without `.git`), never in the worktree. Before each one, `lib/` and `bin/` were copied fresh from the worktree. The unbroken copy passed all four tests first. After the last break the copy's `lib/` and `bin/` matched the worktree again (`diff -r`, no output), and `git status` in the worktree showed only this branch's own edits.

| Break | What was broken | What failed |
|---|---|---|
| M1 (AC1) | `PROOF` back to `/^docs\/proof\/.+\.md$/` | all four: AC1 with `- docs/proof/reviews/x.md: no spec: field in its front matter`; AC2 with `spec-lock: ok`; AC3 with the nested fault in its list; AC4 because all three surfaces let the nested-only landing through |
| M2 (AC2) | the no-proof decision skipped when any changed `docs/proof/**/*.md` exists: `if (proofs.length === 0 && !changed.some((p) => /^docs\/proof\/.+\.md$/.test(p))) return` | AC2 (`a nested file stood in for a top-level proof: spec-lock: ok`) and AC4; AC1 and AC3 passed |
| M3 (AC3) | `return proofs.flatMap(([p, e]) => proofFaults(to, p, e))` became `return []` | AC3 only: `an incomplete top-level proof was let through: spec-lock: ok` |
| M4 (AC4) | `bin/spec-lock-action` spawned `bin/spec-lock-old`, a second checker importing a copy of `lib/lock.mjs` with the any-depth matcher, as a consumer pinned to an older checker would run | AC4 only: the hook and the pre-push adapter refused the nested-only landing with `- no proof: ...`, and the action printed `spec-lock: ok`, so `{ action: 0, hook: true, push: true }` did not equal `{ action: 1, hook: true, push: true }` |

## What I walked

Walked at a658e5e0c58723249b26428810f26a41db4463f8, in a fresh scratch directory: its own `HOME`, a `GIT_CONFIG_GLOBAL` holding only the two spec-lock hooks, which `register()` wrote to that file, `GIT_CONFIG_NOSYSTEM=1`, and a scratch `SPEC_LOCK_LOG`. The environment was otherwise empty (`env -i` with `PATH`).

1. Made a repository whose main held `base.txt`, then registered the lock in the scratch config.
2. Branch `beside` added `code.js`, `docs/specs/x.md` (a copy of this spec), a complete `docs/proof/x.md` naming AC1 to AC4, and `docs/proof/reviews/r1.md` with no front matter. `git merge --ff-only beside` printed `Fast-forward` and exited 0. `git rev-parse main` then gave the branch tip.
3. Branch `nested-only` changed `code.js` and added a complete proof only at `docs/proof/reviews/x.md`. `git merge --ff-only nested-only` exited 128 with:

   ```text
   spec-lock: refused refs/heads/main cbcef00360f3..2ea59eb1f198
   - no proof: this code landing adds or edits no docs/proof/*.md file
   spec-lock checker 0.0.0+8b25886793ff
   fatal: in 'prepared' phase, update aborted by the reference-transaction hook
   ```

   main stayed at the `beside` tip.
4. `spec-lock check <beside tip> <nested-only tip>` printed the same fault and checker line and exited 1.
5. The landing log held two rows: `refs/heads/main ecf0cd260f23..cbcef00360f3 allowed` and `refs/heads/main cbcef00360f3..2ea59eb1f198 refused`.

This matches the expected result in the spec's end-to-end section. For contrast, the same walk against the checker from b7b64f0 (a `git archive` copy) refused step 2 with `- docs/proof/reviews/r1.md: no spec: field in its front matter`, and step 4's `spec-lock check` printed `spec-lock: ok` and exited 0, so the nested-only proof would have landed.

This change has no screen, so there are no screenshots.
