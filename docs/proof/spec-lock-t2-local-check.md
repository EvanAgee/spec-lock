---
spec: docs/specs/spec-lock-t2-local-check.md
tags: [spec-lock, local-check, reference-transaction]
date: 2026-09-24
issue: spec-lock-t2-local-check
walked: ddfe45fc9ace1338cabb4aed544c5e6841df76bc
---

# Proof: refuse and accept a local landing

This branch adds `spec-lock check <old> <new>` (`bin/spec-lock`, `lib/lock.mjs`), the hardened-shape parser extracted from spec-lint (`lib/spec.mjs`), and the git adapter `bin/spec-lock-hook`, registered as the config-defined hook `spec-lock-reference-transaction`. All tests and walks used a scratch global git config (`GIT_CONFIG_GLOBAL` in a temp directory, `GIT_CONFIG_NOSYSTEM=1`, inherited `GIT_*` and `FM_*` variables removed). No real global config or repository was changed.

Environment: git 2.54.0 (Apple Git-157), Node v22.22.0, macOS.

## Criteria and evidence

| AC | Test in `test/spec-lock.test.mjs` | Red before the code | Green | Mutation that turns it red |
|---|---|---|---|---|
| AC1 | `AC1: a code landing with no proof is refused...` | yes: the unproved fast-forward exited 0 | yes | checker always allows: "the unproved fast-forward was allowed" |
| AC2 | `AC2: a proof whose spec is absent, unreadable, or not hardened...` | yes: the no-spec-field case exited 0 | yes | spec validation always succeeds: all five bad cases let through |
| AC3 | `AC3: every proof in a landing is checked against its own spec...` | yes: the incomplete second proof exited 0 | yes | proofs concatenated, and only the first proof checked: each lets the incomplete second proof through |
| AC11 | `AC11: merge, fast-forward, reset, commit and update-ref...` | yes: merge --no-ff was allowed | yes | adapter registered on pre-merge-commit only: all six ref moves let through |
| AC12 | `AC12: a crashed checker, missing Node, or an unreadable object...` | yes: the crashed checker exited 0 | yes | three mutations, one per failure path, each red at its own assertion |

### Red first

The tests were written before the checker. They ran against a stub whose hook and CLI both exit 0, so every landing was allowed. All five failed at their refusal assertion:

```text
not ok 1 - AC1: ... error: 'Expected "actual" to be strictly unequal to: 0'
not ok 2 - AC2: ... expected: 1, actual: 0
not ok 3 - AC3: ... expected: 1, actual: 0
not ok 4 - AC11: ... error: 'merge --no-ff was allowed'
not ok 5 - AC12: ... error: 'Expected "actual" to be strictly unequal to: 0'
# tests 5  # pass 0  # fail 5
```

### Green

`npm test` at the walked commit, exit 0:

```text
ok 1 - AC1: a code landing with no proof is refused and main stays put; the same change with a committed proof lands
ok 2 - AC2: a proof whose spec is absent, unreadable, or not hardened is refused with the proof path and fault
ok 3 - AC3: every proof in a landing is checked against its own spec, and at least one is required
ok 4 - AC11: merge, fast-forward, reset, commit and update-ref cannot move main to unproved code in a repository with no remote
ok 5 - AC12: a crashed checker, missing Node, or an unreadable object refuses the update with a diagnostic
# tests 5
# pass 5
# fail 0
```

AC11 reports what each refused command left in the checkout, separately from the ref assertion. Main stayed at A every time:

```text
merge --no-ff: exit 128; checkout after refusal: A  code.js, A  docs/specs/x.md
merge --ff-only: exit 128; checkout after refusal: A  code.js, A  docs/specs/x.md
reset --hard: exit 128; checkout after refusal: A  code.js, A  docs/specs/x.md
update-ref with old: exit 128; checkout after refusal: clean
update-ref without old: exit 128; checkout after refusal: clean
commit on main: exit 128; checkout after refusal: A  code.js
```

A refused merge or reset can leave files staged in the checkout. The lock guards the branch, not the working tree.

### Mutation controls

Each mutation ran on a throwaway copy of `bin/`, `lib/`, `test/` and `package.json`, never in the worktree. The unmutated copy passed 5/5 first. Nine mutations, all red:

| What was broken | What failed |
|---|---|
| Checker always allows | AC1 ("the unproved fast-forward was allowed"), AC2 (all five bad cases), AC3, AC11 (all six moves), AC12 (unreadable object) |
| Spec validation always succeeds | AC2: no spec field, nonexistent spec, spec missing Seams, spec outside the repository, absolute host path, all let through. AC3 and AC12 also red |
| Proofs concatenated | AC3: "an incomplete second proof was let through" |
| Only the first proof checked | AC3: "an incomplete second proof was let through" |
| An all-zero old value read as a new branch | AC3: "update-ref with no old value let historic proofs vouch for new code"; AC11: `git pack-refs --all` refused |
| Adapter registered on pre-merge-commit only | AC11: merge --no-ff, merge --ff-only, reset --hard, update-ref with and without old, and commit on main, all let through. AC1, AC2, AC3 and AC12 also red |
| Adapter exits 0 when the checker fails | AC12: "a crashed checker was read as a pass" |
| Adapter exits 0 when Node is missing | AC12: "missing Node was read as a pass" |
| Checker exits 0 when an object is unreadable | AC12: "an unreadable object was read as a pass" |

The AC11 mutation proves the adapter covers more than merges, and the three AC12 mutations each break one failure path while the other two still refuse.

## What I walked

A scratch repository with no remote, a scratch global config holding only the registered hook, and real git commands. `$REPO` is this repository's checkout and `$SCRATCH` the temp directory. After every command the walk read `refs/heads/main`.

```text
$ git config --global --get-regexp ^hook\.
hook.spec-lock-reference-transaction.command '$REPO/bin/spec-lock-hook' reference-transaction
hook.spec-lock-reference-transaction.event reference-transaction
$ git hook list reference-transaction
spec-lock-reference-transaction
A=07cda7c B=d9578cb   (B: code.js and docs/specs/x.md with AC1 and AC2, no proof)

$ git merge --ff-only feature
Updating 07cda7c..d9578cb
Fast-forward
spec-lock: refused refs/heads/main 07cda7c182c5..d9578cb740d5
- no proof: this code landing adds or edits no docs/proof/*.md file
fatal: in 'prepared' phase, update aborted by the reference-transaction hook
[exit 128] main=07cda7c

$ git merge --no-ff --no-edit feature
Merge made by the 'ort' strategy.
spec-lock: refused refs/heads/main 07cda7c182c5..f09107fe527b
- no proof: this code landing adds or edits no docs/proof/*.md file
fatal: in 'prepared' phase, update aborted by the reference-transaction hook
[exit 128] main=07cda7c

$ git reset --hard d9578cb                        -> refused, [exit 128] main=07cda7c
$ git update-ref refs/heads/main d9578cb 07cda7c  -> refused, [exit 128] main=07cda7c
$ git update-ref refs/heads/main d9578cb          -> refused, [exit 128] main=07cda7c
$ spec-lock check 07cda7c d9578cb                 -> "no proof", [exit 1]

A proof naming AC1 and AC20 but not AC2:
$ git merge --ff-only feature
spec-lock: refused refs/heads/main 07cda7c182c5..c0b9bc055304
- docs/proof/x.md: does not name AC2 from docs/specs/x.md
[exit 128] main=07cda7c

The repair written and staged but not committed:
$ spec-lock check 07cda7c feature
- docs/proof/x.md: does not name AC2 from docs/specs/x.md
[exit 1]

Committed repair C=f848691:
$ git merge --ff-only feature
Fast-forward
 code.js         |  1 +
 docs/proof/x.md |  6 ++++++
 docs/specs/x.md | 23 +++++++++++++++++++++++
[exit 0] main=f848691

$ git commit -qm 'feat: change code on a feature branch'   (on branch later)
[exit 0] main=f848691

Old proofs on main cannot vouch for that new code:
$ git update-ref refs/heads/main 4bea0ce
spec-lock: refused refs/heads/main f8486919802f..4bea0cebfb90
- no proof: this code landing adds or edits no docs/proof/*.md file
[exit 128] main=f848691

The owner's one-shot escape, then the lock again on the next command:
$ git -c hook.spec-lock-reference-transaction.enabled=false update-ref refs/heads/main 4bea0ce
[exit 0] main=4bea0ce
$ git update-ref refs/heads/main d9578cb 4bea0ce
spec-lock: refused refs/heads/main 4bea0cebfb90..d9578cb740d5
[exit 128] main=4bea0ce
```

Every unproved move exited nonzero and left main where it was. The complete proof landed. A commit on a feature branch went through. Git printed "Fast-forward" and "Merge made by the 'ort' strategy." before refusing, so those lines alone do not mean a landing happened; the ref read after each command is what counts.

## This repository's own landing

This proof names its spec as `spec: docs/specs/spec-lock-t2-local-check.md`, so the lock checks this branch too. Before this proof was committed, `spec-lock check 29875de HEAD` refused the branch with "no proof: this code landing adds or edits no docs/proof/*.md file". With it committed, the same command printed `spec-lock: ok`.

Then through real git: a scratch clone of this repository on `main` (29875de), the hook registered in a scratch global config after the clone, and the branch fetched:

```text
$ git update-ref refs/heads/main 61156eb   (the code commit, no proof)
spec-lock: refused refs/heads/main 29875de8f193..61156eb1579d
- no proof: this code landing adds or edits no docs/proof/*.md file
[exit 128] main=29875de

$ git update-ref refs/heads/main ddfe45f   (code and spec, no proof)
spec-lock: refused refs/heads/main 29875de8f193..ddfe45fc9ace
- no proof: this code landing adds or edits no docs/proof/*.md file
[exit 128] main=29875de

$ git merge --ff-only <the commit that adds this proof>
Fast-forward
 11 files changed, 784 insertions(+)
[exit 0] main=<that commit>
```

## Review

Reviewed in this session without subagents, as the launch brief requires. The review found one gap and fixed it: git sends an all-zero old value for `update-ref` with no old value, and reading that as a new branch would let proofs already on main vouch for new code. The adapter now reads the branch's real tip; AC3 and AC11 hold that. `npx unslop` on the changed files reported 0 findings.

## Left for later tickets

- Deleting main is allowed. `git pack-refs` (and so `git gc`) sends a delete of `refs/heads/main` through the hook after packing it, so refusing every delete would break gc. A recreated main is compared with the empty tree, so proofs already in its tree count. The first-commit rule (AC6) must close that.
- With the hook registered, `git clone` creates `refs/heads/main` from nothing and the full tree is checked. A probe showed `refs/remotes/origin/main` is written before `refs/heads/main`, so the pulled-commit exemption (AC5) can cover clone.
- Without Node, the adapter refuses every local branch update, not only protected ones, because the policy that names protected branches runs in Node. Registration could pin Node's absolute path.
- The protected branch is only `refs/heads/main`; default-branch and integration-branch matching come later.
- The private spec-lint CLI still has its own copy of the parser; it should import `lib/spec.mjs`.
