---
spec: docs/specs/spec-lock-t4-hooks-push.md
tags: [spec-lock, hooks, pre-push, timing]
date: 2026-09-24
issue: spec-lock-t4-hooks-push
walked: 341ef8de54f139b4df8f3ab7240fbe09fb8374d8
---

# Proof: hook coexistence, pushes and local timing

This branch adds a second config-defined hook, `spec-lock-pre-push`, beside `spec-lock-reference-transaction`. `register()` in `lib/lock.mjs` writes both and nothing else. `bin/spec-lock-hook` now reads git's pre-push lines too, keeps those whose remote ref is a guarded branch, and passes them to `prePush()`. That function judges each as the move the remote would make, from the tip the remote advertised to the pushed commit. `test/time-check.mjs` times the checker and the adapter on a real repository without changing it. The suite now deletes its temp directories.

The branch was built on T3 (3a086fb) and then rebased onto T5 (baa3a1c), which landed on main meanwhile and added the GitHub action and a checker line to every verdict. The rebase conflicted in `bin/spec-lock` and `test/spec-lock.test.mjs`; the resolution keeps T5's checker line and adds the `pre-push` command beside it. The green run, the walk, the mutation controls, the last timing run and this repository's own landing were all repeated on the rebased tree. Sections below say which run each number comes from.

All tests and walks used a scratch `HOME`, a scratch global git config (`GIT_CONFIG_GLOBAL`, `GIT_CONFIG_NOSYSTEM=1`), a scratch central file and a scratch landing log, with inherited `GIT_*`, `FM_*` and `SPEC_LOCK_*` variables removed. Every remote was a local bare repository; nothing went over the network. Nothing touched a real global config, central file, log or repository, and I registered no hook in the largest local repo.

Environment: git 2.54.0 (Apple Git-157), Node v22.22.0, macOS on an Apple M3 Ultra (Mac15,14), 32 cores, 512 GB.

## Criteria and evidence

| AC | Test in `test/spec-lock.test.mjs` | Red before the code | Green | Mutation that turns it red |
|---|---|---|---|---|
| AC9 | `AC9: the shared hooks run beside husky, tracked, absolute and default hook folders and in a linked worktree...` | yes: only two global entries registered, `git hook list pre-push` showed only the hookdir hook, and the unproved push exited 0, in all five layouts | yes | M1, shared hook skipped where a repository sets `core.hooksPath`: the unproved update exits 0 in the husky, tracked, absolute and worktree layouts. M2, registration also sets a global `core.hooksPath`: the default layout's four marker assertions fail and every layout's config snapshot changes |
| AC10 | `AC10: a push to a guarded remote branch is judged from the tip the remote advertised to the pushed commit...` | yes: the plain, feature-to-main and both force pushes of unproved code exited 0 and moved the remote main | yes | M4, judged from local HEAD: "main, moved past the local lock: exit 0" and "feature to main: exit 0". M5, non-fast-forwards skipped: both force pushes exit 0 |
| AC20 | `AC20: the lock adds less than a second to a local landing, valid or refused` | green before the code, as T2 and T3 already met the budget; its red comes from its mutations | yes | M9, an 1100 ms sleep in the checker: "valid: added 1422 ms", "invalid: added 1365 ms". M10, an always-allow checker: "invalid range: exit 0" |

AC9 seeds five repositories, each with its own `reference-transaction` and `pre-push` hooks that append `<directory> <event> <first argument>` to a marker file. The layouts are a husky `.husky/_` folder (a cut-down copy of husky 9's `h` dispatcher), a tracked `.githooks` folder, an absolute path to `.git/hooks`, the default `.git/hooks` with no `core.hooksPath`, and a linked worktree of a `.githooks` repository used only from the worktree. The spec names three layouts and a worktree; the default layout was added so that M2, a global `core.hooksPath`, has a hook it can hide. For each layout the test compares `git config --list --show-scope` before and after `register()`, reads `git hook list` for both events, and runs a refused and an allowed `update-ref` and a refused and an allowed push. After each it reads the marker file, the refs, and the landing log. It ends with `HUSKY=0`, which turns off husky's hook and leaves the lock on.

AC10 pushes to a bare remote whose own lock is off, so only the pre-push adapter judges. The remote main holds R, landed by a proved push. Six pushes of unproved code must refuse, name the remote ref and "no proof", and leave the remote main at R:

- local main moved past the local lock with the owner's escape, then `git push origin main`
- `git push origin feature:main`
- `git push --force origin sibling:main`, where sibling does not descend from R
- `git push origin +sibling:main`
- `git push origin sibling:master`, a guarded branch the remote does not have yet
- `git push origin aside feature:main`, where `aside` is a free branch the remote already has

The repository's own pre-push hook records the lines git hands the hooks; for the last push they were `refs/heads/aside` then `refs/heads/main`, and the remote's `aside` did not move. A free branch takes unproved code, and a proved sibling of R force-pushes.

### Red first

The new tests ran against T3's code, with only the `PUSH_HOOK` name exported so the file could load. AC1 to AC8, AC11, AC12 and the landing-log test passed; AC9 and AC10 failed:

```text
not ok 12 - AC9: ...
    + `husky: config changed: +["global\thook.spec-lock-reference-transaction.command=...","global\thook.spec-lock-reference-transaction.event=..."] -[]`
    + 'husky: git hook list pre-push: hook from hookdir'
    + 'husky: unproved push: exit 0 '
    (the same three for tracked, absolute, default and worktree)
not ok 13 - AC10: ...
    + 'main, moved past the local lock: exit 0, remote main moved: '
    + 'feature to main: exit 0, remote main moved: '
    + 'force push of a tip that is not a descendant: exit 0, remote main moved: '
    + 'forced refspec of a tip that is not a descendant: exit 0, remote main moved: '
ok 14 - AC20: ...
# tests 14  # pass 12  # fail 2
```

The reference-transaction half of AC9 passed already, because T2 registered that hook through config. M1 and M2 below show that half can fail. I added the AC10 case for a guarded branch new to the remote after the red run, once review found that path untested. M8 holds it.

### Green

`node --test test/spec-lock.test.mjs` on the rebased tree, with `TMPDIR` pointed at an empty scratch folder, exit 0:

```text
ok 1 - AC1 ... ok 11 - AC12   (unchanged from T3)
ok 12 - AC13 ... ok 13 - AC14  (T5)
ok 14 - AC14 and AC21: ... # SKIP set SPEC_LOCK_CANARY=<owner/repo> to walk a real GitHub repository
ok 15 - AC9: the shared hooks run beside husky, tracked, absolute and default hook folders and in a linked worktree, and change none of their config
ok 16 - AC10: a push to a guarded remote branch is judged from the tip the remote advertised to the pushed commit, force pushes and other refspecs included
ok 17 - AC20: the lock adds less than a second to a local landing, valid or refused
# valid: with the lock 355, 397, 409 ms, without 23, 34, 50 ms, median added 364 ms, load 72.0
# invalid: with the lock 199, 203, 307 ms, without 20, 28, 241 ms, median added 175 ms, load 72.0
# tests 17
# pass 16
# fail 0
# skipped 1
```

The skipped test is T5's live GitHub walk, which needs a named canary repository and the network; this ticket uses neither. Before the rebase the same file passed 14 of 14.

The scratch `TMPDIR` held no directories afterwards.

### Mutation controls

Each mutation ran on a throwaway copy of `bin/`, `lib/`, `test/` and `package.json`, never in the worktree, with the AC9, AC10 and AC20 tests and its own `TMPDIR`. The unmutated copy passed all three first. Ten mutations, all red, and every run left its `TMPDIR` empty, failing runs included. The whole set ran twice, before and after the rebase onto T5, and each mutation failed the same tests both times. The quoted lines are from the first set; M9's rebased run read "valid: added 1359 ms".

| What was broken | What failed |
|---|---|
| M1: the shared hook exits 0 in a repository that sets `core.hooksPath` | AC9: "unproved update: exit 0" and "unproved push: exit 0" in the husky, tracked, absolute and worktree layouts; the default layout still refused |
| M2: `register()` also writes a global `core.hooksPath` | AC9: all five layouts' config snapshots gained `global core.hookspath=...`; the default layout's own hooks vanished from `git hook list` and all four of its marker assertions failed. AC10 also red: its recording hook stopped running |
| M3: the pre-push hook is not registered | AC9: the config snapshot gained two entries, not four, `git hook list pre-push` showed only "hook from hookdir", and "unproved push: exit 0", first in the husky layout. AC10 also red |
| M4: a push is judged from local HEAD, not the advertised remote tip | AC10: "main, moved past the local lock: exit 0" and "feature to main: exit 0". AC9 also red |
| M5: a push that is not a fast-forward is skipped | AC10: both force pushes of the non-descendant sibling exit 0 |
| M6: a push is judged by its local ref name | AC10: "feature to main", both force pushes and the new `master` all exit 0. AC9 also red |
| M7: the adapter looks only at the first pushed ref | AC10: "two refs, main second: exit 0" |
| M8: a branch new to the remote always passes | AC10: "a guarded branch new to the remote: exit 0" |
| M9: the checker sleeps 1100 ms | AC20: "valid: added 1422 ms", "invalid: added 1365 ms" |
| M10: the checker always allows | AC20: "invalid range: exit 0". AC9 and AC10 also red |

The spec's own mutations are M1 and M2 for AC9, M4 and M5 for AC10, and M9 and M10 for AC20. Each fails its criterion's test at the assertion the spec names.

## AC20: timing on the largest local repo

The criterion is a live receipt on the largest local repo: 76,881 packed objects in 407 MiB of packs, 7,360 tracked files, 2,215 commits on its main. The walk ran `test/time-check.mjs` there on four ancestor pairs from its main's first-parent history. It registered no hook and changed none of its config or refs. `git for-each-ref`, `git config --list --show-origin` and `ls -la .git` hashed to the same value before and after each run, and no `spec-lock-pending` file appeared. The hash moved between runs, from `dafb5d59f5afda8f` to `f9d1859f8e2c0a34` to `ca2432fa4ea6ac57`; that repository's `packed-refs` changed at 11:17 and its `config` at 11:19 local time, from other sessions that work there. Between runs my only command there was a read-only `spec-lock check`.

Commands, from this repository at the walked commit:

```sh
node test/time-check.mjs <the largest local repo> <old> <new> 7
```

Each sample runs `spec-lock check <old> <new>` alone, without the adapter, then `bin/spec-lock-hook reference-transaction` for the states git sends on a move of main: `preparing`, `prepared`, then `committed`, or `aborted` after a refusal. The adapter's total is the time the lock adds to that landing, because git runs these hooks synchronously and without the lock runs nothing. Sample 1 of each pair is the first run in that process. The OS file cache could not be emptied without `sudo purge`, and other sessions were reading that repository, so no sample is truly cold.

At the walked commit, seven samples per range, load average 67.3 to 72.9:

| Range | old..new | Changed paths | Verdict | `check` median | Adapter median (added) | Slowest adapter sample |
|---|---|---|---|---|---|---|
| documentation only, 1 commit | `47eb775373d4..eb8acf979ac1` | 6 | allowed | 284 ms | 522 ms | 776 ms |
| code, 5 commits | `ed7b9ede0b97..48a8a507eed1` | 14 | allowed, already on the remote's default branch | 227 ms | 534 ms | 924 ms |
| code and a proof, 20 commits | `0687076e7cb0..48a8a507eed1` | 116 | refused | 245 ms | 355 ms | 393 ms |
| 127 commits | `b0fc3f2ea649..48a8a507eed1` | 730 | refused | 244 ms | 426 ms | 465 ms |

The median added time was 534 ms at the worst range, and no sample in this run reached 1000 ms.

Four runs in all, 112 samples, every one with its load recorded:

| Run | Load (1 minute) | Adapter medians: docs, code-5, proof-20, large-100 | Samples at or over 1000 ms |
|---|---|---|---|
| 1, before a comment-only edit to `bin/spec-lock-hook` | 79.7 to 82.9 | 555, 667, 444, 365 ms | 0 of 28; slowest 916 ms |
| 2, at 1813665, the pre-rebase spec commit | 77.7 to 79.6 | 431, 464, 425, 273 ms | 0 of 28; slowest 651 ms |
| 3, same code, the least loaded the machine got | 41.3 to 44.9 | 479, 449, 264, 338 ms | 4 of 28: 1089, 1212 and 1070 ms (docs), 1323 ms (code-5) |
| 4, at the walked commit, the table above | 67.3 to 72.9 | 522, 534, 355, 426 ms | 0 of 28; slowest 924 ms |

**None of these samples is reliable as a typical number.** The load stayed above one runnable process per core all session; the lowest 1-minute reading was 32.4, at the start. A watcher waited 25 minutes for a 1-minute load under 32 and gave up at 41. At 67 to 83, two to 2.6 runnable processes per core from other sessions' test runs, every number is inflated. They are upper bounds under contention, not what a quiet machine sees.

The four slow samples in run 3 are spikes, not the steady cost. In each, one step took two to four times its usual time (`prepared` 690, 989 and 1183 ms against a usual 250 to 350 ms), and in one of them `spec-lock check` alone took 956 ms against its usual 150 to 280 ms. That run's 5-minute load was still about 60 while the 1-minute figure fell, so the recorded load understates the contention those samples met. Every range's median stayed under 700 ms in every run. By the median, which is what the AC20 test asserts, the lock adds under a second. By the single worst sample on a machine this loaded, it did not, 4 times out of 112.

The allowed ranges cost more than the refused ones because git's `committed` call starts Node a second time, about 100 to 180 ms, even when there is nothing to keep. The five-commit code range is allowed because that repository's main is an ancestor of its `origin/main`, so the pulled-commit rule from T3 treats that content as already landed. The two refused ranges are refused with "no proof": later commits on `origin/main` changed some of their code paths again, so those paths count as local work, and the one proof in the 20-commit range matches `origin/main` and drops out.

## What I walked

A script built scratch repositories and ran real git commands at the walked commit, after the rebase; `$SCRATCH` is its temp directory and `$REPO` this repository's checkout. It registered the hooks in a scratch global config with `register()`:

```text
git 2.54.0 (Apple Git-157), node v22.22.0
[hook "spec-lock-reference-transaction"]
	command = '$REPO/bin/spec-lock-hook' reference-transaction
	event = reference-transaction
[hook "spec-lock-pre-push"]
	command = '$REPO/bin/spec-lock-hook' pre-push
	event = pre-push
```

AC9, five layouts, each with its own reference-transaction and pre-push hooks writing a marker and a bare remote with its lock off. The same steps ran in each; husky is shown in full and the rest summarized.

```text
== husky (core.hooksPath: .husky/_)
config lines added: global hook.spec-lock-pre-push.command, .event, hook.spec-lock-reference-transaction.command, .event
config lines removed: 0
$ git hook list reference-transaction   -> spec-lock-reference-transaction / hook from hookdir
$ git hook list pre-push                -> spec-lock-pre-push / hook from hookdir
$ git update-ref refs/heads/main bad main
    spec-lock: refused refs/heads/main af338b436953..8c1334b6c8ae
    - no proof: this code landing adds or edits no docs/proof/*.md file
    spec-lock checker 0.0.0+e70e0e6d0daf
    fatal: in 'prepared' phase, update aborted by the reference-transaction hook
    [exit 128] main=af338b4; own hook: reference-transaction preparing, prepared, aborted
$ git merge -q --ff-only good
    [exit 0] main=5b918ec; own hook: reference-transaction preparing, prepared, committed
$ git push -q origin bad:main
    spec-lock: refused push to origin refs/heads/main af338b436953..8c1334b6c8ae
    - no proof: this code landing adds or edits no docs/proof/*.md file
    spec-lock checker 0.0.0+e70e0e6d0daf
    error: failed to push some refs to '$SCRATCH/husky.git'
    [exit 1] remote main=af338b4; own hook: pre-push origin
$ git push -q origin good:main
    [exit 0] remote main=5b918ec; own hook: pre-push origin

== tracked (.githooks)                  same results: refused 948d4a5..f7d7716, landed d8b7752, push refused, push landed
== absolute ($SCRATCH/absolute/.git/hooks)  same: refused 3cdb851..0c48d12, landed 962dcfe, push refused, push landed
== default (core.hooksPath unset)        same: refused 8e12a78..89cbf42, landed 3262467, push refused, push landed
== worktree (linked worktree, .githooks) same, with update-ref for the landing: refused 82a56dc..429e44d, landed 350fb56
   Every layout: 4 global config lines added, 0 removed, both hooks listed for both events,
   and the repository's own hook wrote its marker on every refused and allowed command.

$ HUSKY=0 git update-ref refs/heads/main worse main   (husky repository, unproved code)
    spec-lock: refused refs/heads/main 5b918ecb99cb..2658c6e83191
    [exit 128] main=5b918ec; husky marker lines: 0
```

AC10, the default-layout repository and its bare remote at R (`3262467`). The owner's escape moved local main to unproved code (`fb259f8`). The repository's own pre-push hook recorded the refs git handed the hooks.

```text
$ git push -q origin main                  -> refused push to origin refs/heads/main 32624675500d..fb259f817b0f, no proof [exit 1] remote main=3262467
$ git push -q origin feature:main          -> refused ... refs/heads/main 32624675500d..fb259f817b0f [exit 1] remote main=3262467
$ git push -q --force origin sibling:main  -> refused ... refs/heads/main 32624675500d..b7bfd2fc4431 [exit 1] remote main=3262467
$ git push -q origin +sibling:main         -> refused ... refs/heads/main 32624675500d..b7bfd2fc4431 [exit 1] remote main=3262467
$ git push -q origin sibling:master        -> refused ... refs/heads/master (none)..b7bfd2fc4431 [exit 1] remote master=none
$ git push -q origin aside feature:main    -> refused ... refs/heads/main 32624675500d..fb259f817b0f [exit 1]
                                              hooks got refs/heads/aside then refs/heads/main; remote aside stayed f50f472
$ git push -q --force origin proved-sibling:main   -> [exit 0] remote main=112f6c1

A clone pushed commit 5ed7f73 to the remote main (with the escape), so this repository lacks it:
$ git push -q --force origin good:main
    spec-lock: cannot read object 5ed7f7313d6fceafdf60653bfb1b2032995763b5
    spec-lock: the checker failed (exit 2), so the update is refused.
    [exit 1] remote main=5ed7f73

With PATH=/usr/bin:/bin, where there is no node:
$ git push -q origin aside                 -> [exit 0] remote aside=bc716cf   (a free branch)
$ git push -q --force origin good:main     -> spec-lock: node is not on PATH, so this update of a guarded branch cannot be checked and is refused. ...
                                              [exit 1] remote main=5ed7f73
```

The landing log held one `refused` and one `allowed` row per layout, the refused `HUSKY=0` move, and the clone's creation of its main. Pushes are not logged; see below.

## This repository's own landing

This proof names its spec as `spec: docs/specs/spec-lock-t4-hooks-push.md`, so the lock checks this branch too. In the worktree, `spec-lock check baa3a1c ed45687` (the code commit) and `spec-lock check baa3a1c 341ef8d` (code and spec, no proof) each refused with "no proof: this code landing adds or edits no docs/proof/*.md file" and exit 1. `spec-lock check baa3a1c <the commit that adds this proof>` printed `spec-lock: ok`, exit 0.

Then through real git: a scratch clone of this repository on `main` (baa3a1c, T5's proof) with `origin/HEAD` set to `origin/main`, a scratch bare copy of `main` as a push target with its own lock off, and the hooks registered in a scratch global config after both clones:

```text
$ git update-ref refs/heads/main ed45687 main
    spec-lock: refused refs/heads/main baa3a1ca1829..ed45687c09e9
    - no proof: this code landing adds or edits no docs/proof/*.md file
    spec-lock checker 0.0.0+e70e0e6d0daf
    [exit 128] main=baa3a1c
$ git update-ref refs/heads/main 341ef8d main
    spec-lock: refused refs/heads/main baa3a1ca1829..341ef8de54f1
    - no proof: ...  [exit 128] main=baa3a1c
$ git push -q target 341ef8d:refs/heads/main
    spec-lock: refused push to target refs/heads/main baa3a1ca1829..341ef8de54f1
    - no proof: ...  [exit 1] target main=baa3a1c
$ git merge -q --ff-only <the commit that adds this proof>   [exit 0] main=<that commit>
$ git push -q target main                                    [exit 0] target main=<that commit>
log: refs/heads/main baa3a1c..ed45687 refused
log: refs/heads/main baa3a1c..341ef8d refused
log: refs/heads/main baa3a1c..<that commit> allowed
```

## Review

Reviewed in this session without subagents, as the launch brief requires, on both axes: this repository's standards (`AGENTS.md`, the T2 and T3 idiom) and the spec above.

1. The first AC10 draft had no case for a guarded branch the remote does not have, so the `prePush` path that compares with the empty tree was untested. The `sibling:master` case and M8 now hold it. Its refusal first printed `000000000000..` as the old tip; it now prints `(none)`, as local refusals do.
2. The walk found that the first AC10 order check read the wrong field, and that git hands pre-push the refs the remote already has in name order, then new ones, whatever the order on the command line. The two-ref case now pushes a free branch the remote already has and whose name sorts before `main`. `AGENTS.md` records this, and that a bare test remote needs its own lock off, because receive-pack runs the global hooks too.
3. AC5's fixture pushed old-style remote work with the lock on and the new pre-push hook refused it. That refusal is correct. The fixture escape `unhooked` now turns off both hooks, as it stands for work landed elsewhere.
4. A header comment line in `bin/spec-lock-hook` ran past the file's width; rewrapped. `npx unslop` on every changed file reported 0 findings.

On the spec axis every row's red test, fixture and mutation matches the table, with one addition (the default layout in AC9) and one reading. "Normal and forced pushes refuse" is read as a plain `git push origin main` whose local main was moved past the local lock by the owner's escape, because the local lock stops any other way of getting unproved code onto local main.

## Temp directories

The suite registers every scratch directory and removes them all in an `after` hook, whether tests pass or fail. Ten mutation runs and the final run, each with its own `TMPDIR`, left none. I removed 381 leftover `spec-lock-test-??????` directories older than 60 minutes from the shared temp folder, matching that exact name. I left the 333 younger ones: another session was running this suite at the same time, and its live directories carry the same prefix.

## Left for later

- Pushes are not written to the landing log, and a force push does not keep the remote's old tip locally. The remote, where GitHub's check runs, is where that history lives.
- A push whose remote tip is not in the local repository is refused as "cannot read object" with exit 2, not with a line that says to fetch first.
- The pulled-commit rule applies to pushes too: content matching any remote's `refs/remotes/*/HEAD` tip is not part of the push, so a forged remote-tracking ref lets unproved code through, as T3 recorded for local moves.
- A guarded branch new to the remote counts what the local guarded branches hold as already landed, so content the owner's escape put on local main can be pushed to a new remote branch.
- `git push --no-verify` skips every pre-push hook, the shared one included. GitHub's required check is what catches that.
- The `committed` state starts Node even when no move is pending, about 100 to 180 ms of each allowed landing under load. The shell could skip it when `spec-lock-pending` does not exist.
- The AC20 receipt was taken at load 41 to 83 on 32 cores, and 4 of 112 samples reached 1000 ms. A run on a quiet machine would give typical numbers; these are upper bounds. Skipping Node in the `committed` state when nothing is pending would take about 100 to 180 ms off every allowed landing.
