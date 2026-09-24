---
spec: docs/specs/spec-lock-t3-scope.md
tags: [spec-lock, scope, exemptions, landing-log]
date: 2026-09-24
issue: spec-lock-t3-scope
walked: 18b4fca876979fafda6079795091464d02a1880c
---

# Proof: scope and exemptions

This branch adds the documentation and pulled-commit rules to `spec-lock check` (`lib/lock.mjs`), and moves the choice of guarded branches and repositories into the git adapter `bin/spec-lock-hook`. The adapter reads one central file (`$SPEC_LOCK_CONFIG`, default `~/.config/spec-lock/config`) with `integration <branch>` and `opt-out <path>` lines. The Node side of the adapter tells a first commit from a recreated branch, appends every checked move to a landing log (`$SPEC_LOCK_LOG`, default `~/.local/state/spec-lock/landings.log`), and keeps tips that a move leaves behind under `refs/spec-lock/kept/`. All tests and walks used a scratch `HOME`, a scratch global git config (`GIT_CONFIG_GLOBAL`, `GIT_CONFIG_NOSYSTEM=1`), a scratch central file and a scratch log, with inherited `GIT_*`, `FM_*` and `SPEC_LOCK_*` variables removed. No real global config, central file, log or repository was changed.

Environment: git 2.54.0 (Apple Git-157), Node v22.22.0, macOS.

## Criteria and evidence

| AC | Test in `test/spec-lock.test.mjs` | Red before the code | Green | Mutation that turns it red |
|---|---|---|---|---|
| AC4 | `AC4: a landing that changes only docs/ or .md paths needs no proof...` | yes: the docs-only fast-forward was refused, "no proof" | yes | M1, the path rule accepts every path: the code added, deleted and renamed controls all pass |
| AC5 | `AC5: a pull of commits already on the remote default branch...` | yes: `git clone` of the remote was refused, "no proof" | yes | M3, remote membership always true: "unproved local code rode in on a pull" |
| AC6 | `AC6: an empty repository takes its first commit...` | yes: "the first commit of an empty repository was refused" | yes | M5, every all-zero old value is a first commit: "update-ref with no old value on an existing main was read as a first commit" |
| AC7 | `AC7: the default branch, whatever its name, and each listed integration branch...` | yes: unproved commits on trunk and on integration/candidate exited 0 | yes | M8, only main and master guarded: the trunk and integration refusals fail |
| AC8 | `AC8: a repository on the central opt-out list is not checked...` | yes: the listed repository's fast-forward was refused | yes | M10, opt-out matching always true: "an unlisted repository was exempted" |

The landing log has its own test, `landing log: every checked move of a guarded branch is logged...`. It was red before the code too: the log held no rows.

### Red first

The new tests ran against T2's code (commit 0868d73's `lib/` and `bin/`). AC1, AC2, AC3, AC11 and AC12 passed, and every new test failed at its first T3 assertion:

```text
not ok 4 - AC4: ... spec-lock: refused refs/heads/main db2c3d5dffcf..1319faaa91b7
                    - no proof: this code landing adds or edits no docs/proof/*.md file
not ok 5 - AC5: ... git clone -q $SCRATCH/remote.git $SCRATCH/upstream: spec-lock: refused refs/heads/main (none)..5d97fd334b3d
not ok 6 - AC6: ... the first commit of an empty repository was refused: spec-lock: refused refs/heads/main (none)..e2e60f6ba864
not ok 7 - AC7: ... + [ 'trunk: exit 0 ', 'integration/candidate: exit 0 ' ]  - []
not ok 8 - AC8: ... spec-lock: refused refs/heads/main 72cc68493dfa..024b9e311301   (the listed repository)
not ok 9 - landing log: ... + []   (no log rows)
# tests 11  # pass 5  # fail 6
```

### Green

`npm test` at the walked commit, exit 0:

```text
ok 1 - AC1: a code landing with no proof is refused and main stays put; the same change with a committed proof lands
ok 2 - AC2: a proof whose spec is absent, unreadable, or not hardened is refused with the proof path and fault
ok 3 - AC3: every proof in a landing is checked against its own spec, and at least one is required
ok 4 - AC4: a landing that changes only docs/ or .md paths needs no proof; code added, deleted or renamed to .md still does
ok 5 - AC5: a pull of commits already on the remote default branch lands without a new proof; local code on top is still checked
ok 6 - AC6: an empty repository takes its first commit; an existing or deleted and recreated main cannot claim that exemption
ok 7 - AC7: the default branch, whatever its name, and each listed integration branch are guarded; a feature branch is not
ok 8 - AC8: a repository on the central opt-out list is not checked; an unlisted one, and its linked worktrees, still are
ok 9 - landing log: every checked move of a guarded branch is logged, and a tip a move leaves behind stays reachable
ok 10 - AC11: merge, fast-forward, reset, commit and update-ref cannot move main to unproved code in a repository with no remote
ok 11 - AC12: a crashed checker, missing Node, or an unreadable object refuses the update with a diagnostic
# tests 11
# pass 11
# fail 0
```

### Mutation controls

Each mutation ran on a throwaway copy of `bin/`, `lib/`, `test/` and `package.json`, never in the worktree. The unmutated copy passed 11/11 first. Seventeen mutations, all red. The full set ran before the branch was rebuilt to give the integration branch a generic name. That rebuild changed only strings in `test/`, `README.md` and the spec, and left `lib/` and `bin/` byte for byte the same. M8 and M9, the two that exercise that branch, ran again at the walked commit with the same results.

| What was broken | What failed |
|---|---|
| M1: the documentation rule accepts every path | AC4: "code added", "code deleted" and "code renamed to markdown" all printed `spec-lock: ok`. AC1, AC3, AC5, AC6, AC7, AC8, AC11 and the log test also red |
| M2: a documentation landing skips its proofs | AC4: the documentation landing with an incomplete proof passed |
| M3: remote membership always true (every path counts as pulled) | AC5: "unproved local code rode in on a pull". AC6 and AC7 also red |
| M4: remote default tips ignored | AC5: the clone of the remote refused. AC7: the clone of trunk refused |
| M5: every all-zero old value is a first commit | AC6: "update-ref with no old value on an existing main was read as a first commit". AC3 and AC11 also red |
| M6: any absent branch is a first commit | AC6: "a deleted and recreated main let its old proof vouch for new code" |
| M7: a created branch is compared with the empty tree only | AC6: "a deleted and recreated main let its old proof vouch for new code" |
| M17: guarded tips matched as for-each-ref prefixes | AC6: "a deleted and recreated main let its old proof vouch for new code", through the tip of the free branch `master/later` |
| M8: only main and master guarded | AC7: unproved commits on `trunk` and `integration/candidate` exited 0 |
| M9: every branch guarded | AC7: the feature branch commit refused. Every other test but AC12 also red |
| M10: opt-out matching always true | AC8: "an unlisted repository was exempted" |
| M11: relative opt-out paths accepted | AC8: "an unlisted repository was exempted", through the `opt-out .` entry |
| M12: repository identity per worktree, not per repository | AC8: the listed repository's linked worktree was refused ("node is not on PATH") |
| M13: no tip kept | Log test: no `refs/spec-lock/kept/` ref for the tip the force move dropped. AC6: the recreated main let its old proof vouch |
| M14: `committed` settles moves that have not happened | Log test: pack-refs wrote a `deleted` row for a main it had only packed |
| M15: `committed` drops moves still waiting | Log test: the delete of a main that was packed and loose was never logged |
| M16: no landing log | Log test: no allowed or refused rows |

Each criterion's own mutation from the spec table (M1, M3, M5, M8, M10) fails that criterion's test at the assertion the spec names.

## What I walked

Scratch repositories under a temp directory (`$SCRATCH`), a scratch global config holding only the registered hook, a scratch central file and a scratch log, and real git commands. `$REPO` is this repository's checkout. After every command the walk read the guarded ref.

```text
git 2.54.0 (Apple Git-157), node v22.22.0
hook.spec-lock-reference-transaction.command '$REPO/bin/spec-lock-hook' reference-transaction
hook.spec-lock-reference-transaction.event reference-transaction

AC4, main A holds base.txt. Branch docs adds docs/guide.txt and README.md; mixed adds src/main.js
too; gone deletes base.txt; renamed moves base.txt to base.md.
$ git merge --ff-only mixed     -> spec-lock: refused refs/heads/main cbeb1bebe874..330984fd57c6
                                   - no proof: this code landing adds or edits no docs/proof/*.md file
                                   [exit 128] main=cbeb1be
$ git merge --ff-only gone      -> refused, "no proof", [exit 128] main=cbeb1be
$ git merge --ff-only renamed   -> refused, "no proof", [exit 128] main=cbeb1be
$ git merge --ff-only docs      -> Fast-forward, README.md and docs/guide.txt, [exit 0] main=00e8248

AC5, a bare remote stands in for GitHub (the lock is off there). Upstream lands R: code.js and an
old-style proof with no spec field. Local main is at A; branch local is R plus code, no proof.
$ git clone -q $SCRATCH/remote.git $SCRATCH/upstream   [exit 0]
$ git merge --ff-only local     -> spec-lock: refused refs/heads/main 9d9fb423e52f..5f4f80e3fd4e
                                   - no proof: this code landing adds or edits no docs/proof/*.md file
                                   [exit 128] main=9d9fb42
$ git pull -q --ff-only         -> [exit 0] main=f6728c0 (R)
local gets a spec and a proof naming AC1:
$ git merge --ff-only local     -> Fast-forward, [exit 0] main=a9d3776 (R's old-style proof not held against it)

AC6, an empty repository.
$ git commit -qm 'first commit: code, no proof'   -> [exit 0] main=dfbcdef
$ git update-ref refs/heads/main more             -> spec-lock: refused refs/heads/main dfbcdef711da..6e2238b96c98
                                                     - no proof: ...  [exit 128] main=dfbcdef
$ git merge --ff-only proved    (a spec and a complete proof)   -> [exit 0] main=9283b0b
$ git update-ref -d refs/heads/main                -> [exit 0] main=(none)
$ git update-ref refs/heads/main later  (unproved code on top of 9283b0b)
                                                   -> spec-lock: refused refs/heads/main (none)..64c8fe756049
                                                      - no proof: ...  [exit 128] main=(none)
$ git update-ref refs/heads/main 9283b0b...        -> [exit 0] main=9283b0b
$ git pack-refs --all                              -> [exit 0] main=9283b0b

AC7, central file "integration integration/candidate"; a bare remote whose default is trunk.
$ git clone -q $SCRATCH/trunk.git $SCRATCH/work    -> [exit 0], trunk=d2c4ab4, origin/HEAD -> refs/remotes/origin/trunk
$ git switch -q -c integration/candidate    -> [exit 0]
$ git commit -qm 'feat: code on a feature branch'  (on feature/demo) -> [exit 0]
$ git commit -qm 'feat: code on trunk'             -> spec-lock: refused refs/heads/trunk d2c4ab439855..191474e18a9e
                                                      [exit 128] trunk=d2c4ab4
$ git commit -qm 'feat: code on the integration branch'
                                                   -> spec-lock: refused refs/heads/integration/candidate d2c4ab439855..b0b0cc378acb
                                                      [exit 128] integration/candidate=d2c4ab4
With PATH=/usr/bin:/bin, where there is no node:
$ git commit -qm 'feat: feature commit without node'  -> [exit 0] feature/demo=12d80b7
$ git update-ref refs/heads/trunk feature/demo d2c4ab4...
      -> spec-lock: node is not on PATH, so this update of a guarded branch cannot be checked and is refused. ...
         [exit 128] trunk=d2c4ab4

AC8, central file: "opt-out $SCRATCH/listed" and "opt-out .". Inside unlisted, pretend exemptions:
git config spec-lock.opt-out true, and a .config/spec-lock/config listing itself.
unlisted$ git merge --ff-only feature   -> spec-lock: refused refs/heads/main b563f5932d63..f0d4ff7179a4  [exit 128]
unlisted-wt$ git update-ref refs/heads/main feature main   (a linked worktree)
                                        -> spec-lock: refused refs/heads/main b563f5932d63..f0d4ff7179a4  [exit 128]
listed$ git merge --ff-only feature     -> spec-lock: not checked: $SCRATCH/listed is on the opt-out list in $SCRATCH/central
                                           [exit 0] main=1865262
listed-wt$ PATH=/usr/bin:/bin git update-ref refs/heads/main main~1 main
                                        -> spec-lock: not checked: ... [exit 0] main=6165787

The landing log after the walk (time, repository, ref, old..new, verdict):
15:32:14  $SCRATCH/docs     refs/heads/main  cbeb1be..330984f  refused
15:32:15  $SCRATCH/docs     refs/heads/main  cbeb1be..c8dcaa8  refused
15:32:15  $SCRATCH/docs     refs/heads/main  cbeb1be..60667ac  refused
15:32:16  $SCRATCH/docs     refs/heads/main  cbeb1be..00e8248  allowed
15:32:17  $SCRATCH/upstream refs/heads/main  0000000..9d9fb42  allowed
15:32:18  $SCRATCH/pull     refs/heads/main  9d9fb42..5f4f80e  refused
15:32:19  $SCRATCH/pull     refs/heads/main  9d9fb42..f6728c0  allowed
15:32:20  $SCRATCH/pull     refs/heads/main  f6728c0..a9d3776  allowed
15:32:20  $SCRATCH/boot     refs/heads/main  0000000..dfbcdef  allowed
15:32:21  $SCRATCH/boot     refs/heads/main  dfbcdef..6e2238b  refused
15:32:22  $SCRATCH/boot     refs/heads/main  dfbcdef..9283b0b  allowed
15:32:23  $SCRATCH/boot     refs/heads/main  9283b0b..0000000  deleted
15:32:23  $SCRATCH/boot     refs/heads/main  0000000..64c8fe7  refused
15:32:23  $SCRATCH/boot     refs/heads/main  0000000..9283b0b  allowed
15:32:25  $SCRATCH/work     refs/heads/trunk  0000000..d2c4ab4  allowed
15:32:25  $SCRATCH/work     refs/heads/integration/candidate  0000000..d2c4ab4  allowed
15:32:26  $SCRATCH/work     refs/heads/trunk  d2c4ab4..191474e  refused
15:32:27  $SCRATCH/work     refs/heads/integration/candidate  d2c4ab4..b0b0cc3  refused
15:32:30  $SCRATCH/unlisted refs/heads/main  b563f59..f0d4ff7  refused
15:32:31  $SCRATCH/unlisted refs/heads/main  b563f59..f0d4ff7  refused
kept in boot: refs/spec-lock/kept/9283b0b...

A repository with the reftable ref backend:
$ git commit -qm 'first commit'               -> [exit 0] main=435c648
$ git commit -qm 'feat: unproved code'        -> spec-lock: refused refs/heads/main 435c6481af17..527e25b58c83  [exit 128]
$ git update-ref refs/heads/main side         -> [exit 0] main=76ff8e0  (a spec, a proof and code)
$ git update-ref refs/heads/main side2        -> [exit 0] main=a9e5ccd  (a sibling with its own proof)
kept: refs/spec-lock/kept/<side>
```

Every unproved move of a guarded branch exited nonzero and left the branch where it was. Each exemption let its case through: documentation, a clone, a pull, a first commit, a listed repository. Its control stayed refused: code added, deleted or renamed, local code on a pull, an unconditional update, a recreate, an unlisted repository and its worktree. Feature branches committed with and without Node. The opted-out moves wrote no log rows, because they are not checked. The deleted tip `9283b0b` stayed under `refs/spec-lock/kept/`, and the reftable repository kept a tip the same way. Git printed "Fast-forward" before some refusals, so that line alone does not mean a landing happened; the ref read after each command is what counts.

## This repository's own landing

This proof names its spec as `spec: docs/specs/spec-lock-t3-scope.md`, so the lock checks this branch too. In the worktree, `spec-lock check 0868d73 18b4fca` (the code and the spec, no proof) refused with "no proof: this code landing adds or edits no docs/proof/*.md file" and exit 1. `spec-lock check 0868d73 <the commit that adds this proof>` printed `spec-lock: ok`, exit 0.

Then through real git: a scratch clone of this repository on `main` (0868d73), `origin/HEAD` set to `origin/main`, the hook registered in a scratch global config after the clone, and the branch fetched:

```text
$ git update-ref refs/heads/main b73bed5   (the code commit, no proof)
spec-lock: refused refs/heads/main 0868d7310123..b73bed512504
- no proof: this code landing adds or edits no docs/proof/*.md file
[exit 128] main=0868d73

$ git update-ref refs/heads/main 18b4fca   (code and spec, no proof)
spec-lock: refused refs/heads/main 0868d7310123..18b4fca87697
- no proof: this code landing adds or edits no docs/proof/*.md file
[exit 128] main=0868d73

$ git merge --ff-only <the commit that adds this proof>
Fast-forward
 8 files changed, 741 insertions(+), 81 deletions(-)
[exit 0] main=<that commit>

log: refs/heads/main 0868d73..b73bed5 refused
log: refs/heads/main 0868d73..18b4fca refused
log: refs/heads/main 0868d73..<that commit> allowed
```

`origin/HEAD` was pointed at `origin/main` on purpose: a clone of a worktree takes that worktree's branch as the remote default, and the pulled-commit rule would then read this branch as already on the remote.

## Review

Reviewed in this session without subagents, as the launch brief requires, on both axes: this repository's standards (`AGENTS.md`, the T2 code's idiom) and the spec above. The review and the walk found four problems, all fixed before the walked commit:

1. Deleting a main that was both packed and loose did not log or keep the old tip. Git runs a nested transaction for the packed copy, and its `committed` call comes while the loose ref still stands; the first version consumed the pending move there. The landing-log test caught it. `committed` now settles only the moves that have happened and keeps the rest for the transaction that finishes them. M15 holds it.
2. A free branch named below a guarded name could vouch for a recreated main. `git for-each-ref refs/heads/master` also matches `refs/heads/master/later`, so the tip of that free branch counted as content already on a guarded branch. Guarded tips are now matched by exact name. AC6 recreates main on a branch called `master/later`, and M17 holds it.
3. The hook ran git before it looked for a branch in the update, so `git init` and `git clone` printed two "fatal: not a git repository" lines from inside the hook. It now reads the updates first and does nothing more when no branch is among them. The rerun walk showed no such line.
4. `npx unslop` flagged an empty `catch` around reading the pending-moves file. Only a missing file is ignored now. `npx unslop` on every changed file then reported 0 findings.

On the spec axis: every row's red test, fixture and mutation matches the table. AC5's red came at `git clone`, the first place a pull happens in that test. AC8's "reports the repository identity and exemption reason" is the `spec-lock: not checked: <repository> is on the opt-out list in <file>` line. One reading is recorded here rather than guessed silently: the decisions say every proof in a landing must be complete, so a documentation-only landing needs no proof but any proof it carries is still checked (AC4 asserts this).

## Left for later tickets

- The pulled-commit rule trusts `refs/remotes/<remote>/HEAD` and the remote-tracking refs, and any local command can move those. A forged remote-tracking ref lets unproved code land locally. The log records such a landing as `allowed`, so the audit (T8) should check logged landings against the real remote.
- Only the remote default branch counts as pulled. Pulling an integration branch from its remote copy is checked like local work.
- A fetch that writes `refs/heads/*` directly, as a mirror does, is checked like a local move. The hook cannot see where the commits came from.
- `SPEC_LOCK_CONFIG` set for one command picks another central file, and a repository-local `git config hook.spec-lock-reference-transaction.enabled false` switches the lock off for that repository until someone removes it. Both need a deliberate command, like the one-shot escape, and the audit (T8) is what catches them.
- Deleting `refs/spec-lock/kept/*` by hand and then a guarded branch lets a recreated branch be compared with the empty tree again, and a repository with no refs left reads as empty.
- Without Node, a refused update is not logged, because the Node side writes the log.
- The log records the lock's verdict for each line. A move the lock allowed is logged `allowed` even when another line or another hook then aborts the transaction. Deletions are logged only once they have happened.
- `master` is guarded everywhere as the fallback default name, so a repository whose default branch has another name and that keeps a free branch called `master` has that branch gated.
- Opt-out entries are matched by physical path. `~` is not expanded, and a relative path never matches.
- Carried from T2: the private spec-lint CLI still has its own copy of the parser.
