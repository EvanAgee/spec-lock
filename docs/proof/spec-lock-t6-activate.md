---
spec: docs/specs/spec-lock-t6-activate.md
tags: [spec-lock, rollout, activation, enrollment, github]
date: 2026-09-24
issue: spec-lock-t6-activate
walked: e18afd4a31e54ee0e5b5e06b015b9bf029d40ce1
---

# Proof: switch-on and enrollment

This branch adds `bin/spec-lock-rollout`. Its `activate` command installs the global hooks and the central file only once every lane in a rollout file has landed, and records the drained lanes and each repository's guarded tips. `doctor` reports repository-level hook overrides and remote-tracking tips it cannot trust. `workflow` prints the checker workflow a new repository starts from. `enroll` checks a GitHub repository, then writes that workflow and one ruleset per protected branch. The hook no longer reads `SPEC_LOCK_CONFIG`. `test/github-walk.mjs` now walks an enrolled repository's default and integration branches and has a `--no-land` probe.

The switch-on itself is not in this proof. Nothing on this machine's real git config, central file or landing log changed. No GitHub repository changed except the throwaway canary https://github.com/EvanAgee/spec-lock-canary. The owner does the real activation and the enrollment of real repositories. The parts of each criterion that need them are marked **pending switch-on** below.

Environment: git 2.54.0 (Apple Git-157) and Node v22.22.0 on macOS; the GitHub runner printed the same checker line as the local checker, `spec-lock checker 0.0.0+0fe5fbda58ae`.

## Criteria and evidence

| AC | Evidence | Red before the code | Green | Control that turns it red | Live part |
|---|---|---|---|---|---|
| AC15 | Tests `AC15 and AC16: enrollment writes the checker workflow, then one ruleset per protected branch ...` and `AC15: enrollment refuses, and changes nothing, where public actions or rulesets are not available ...`; the canary enrolled with `--integration integration/candidate` and walked | yes: `Cannot find module .../bin/spec-lock-rollout` | yes, locally and on the canary | M7 to M11 locally; on GitHub, the canary with the integration ruleset deleted and main's required check removed accepted unproved code on both branches | Canary done. **Pending switch-on:** one private repository under each owner, then the rest of the inventory one at a time |
| AC16 | The canary reset to a new repository's state (one README commit), enrolled from the `workflow` template before any code, then walked; the enrollment test's ordering assertion (workflow writes before rulesets) | yes: `Cannot find module .../bin/spec-lock-rollout` | yes: the first unproved code landing was refused, the repaired one landed | M7 to M9 locally; on GitHub, main's required check removed let the unproved candidate land | Canary done. **Pending switch-on:** a real new repository created from the template |
| AC19 | Test `AC19: activation waits until every in-flight lane has landed, records the drained lanes and baselines, and gives an old-style proof no grace`; activation walked under a scratch HOME over the rollout file drafted from this machine | yes: `Cannot find module .../bin/spec-lock-rollout` | yes | M1 drain check removed, M2 grace for a proof with no spec field, M3 unknown rollout lines ignored | Scratch walk done. **Pending switch-on:** the real activation record, after every lane in flight lands |

The T3 and T5 follow-ups the ticket names:

| Follow-up | What this branch does | Test | Control |
|---|---|---|---|
| `SPEC_LOCK_CONFIG` could name a central file that opts a repository out | The hook reads only `$HOME/.config/spec-lock/config` | `repository settings: SPEC_LOCK_CONFIG no longer opts a repository out, ...` | M4 |
| A repository-level `hook.spec-lock-*` setting switches the lock off | `activate` refuses and `doctor` reports any such key outside the global config. That covers `enabled=false`, another `command`, an empty `event` list, and a worktree-scoped key. Git 2.54 drops a hook whose event list a repository empties, and lists a disabled one as `disabled` | same test | M5 |
| The pull rule trusts local remote-tracking tips | `doctor` compares each `refs/remotes/<remote>/HEAD` with `git ls-remote <remote> HEAD`. It reports a tip the remote's history does not contain, and one it cannot confirm until a fetch. On an enrolled repository GitHub rechecks every landing against its own tip | `pulled commits: doctor reports a remote-tracking tip its remote does not have, ...` | M6, M12 |
| A stale pass plus a force push; a same-name check | Each enrolled ruleset blocks force pushes and deletion and binds its check to app 15368, GitHub Actions. Each protected branch requires its own job (`spec-lock`, `spec-lock <branch>`), so a pass against one tip never admits a commit to another | the AC15 and AC16 enrollment test | M7, M8, M9 |

### Red first

The new tests ran before `bin/spec-lock-rollout` existed and before the hook change:

```text
not ok 1 - AC19: ...                 Error: Cannot find module '.../bin/spec-lock-rollout'
not ok 2 - repository settings: ...  error: 'SPEC_LOCK_CONFIG opted the repository out'
not ok 3 - pulled commits: ...       Error: Cannot find module '.../bin/spec-lock-rollout'
not ok 4 - AC15 and AC16: ...
not ok 5 - AC15: enrollment refuses ...
# pass 0
# fail 5
```

### Green

`SPEC_LOCK_CANARY=EvanAgee/spec-lock-canary npm test` at the walked commit, exit 0:

```text
ok 14 - AC14, AC15 and AC21: an enrolled GitHub repository refuses unproved pushes to its default and integration branches and a forced one, lands proved ones, and each check takes under 60 seconds
ok 18 - AC19: activation waits until every in-flight lane has landed, records the drained lanes and baselines, and gives an old-style proof no grace
ok 19 - repository settings: SPEC_LOCK_CONFIG no longer opts a repository out, and each repository-level override of the hooks is found and stops activation
ok 20 - pulled commits: doctor reports a remote-tracking tip its remote does not have, which the pull rule would trust, until a fetch replaces it
ok 21 - AC15 and AC16: enrollment writes the checker workflow, then one ruleset per protected branch that requires its own check from GitHub Actions, blocks force pushes and deletion, and has no bypass
ok 22 - AC15: enrollment refuses, and changes nothing, where public actions or rulesets are not available or a guarded workflow would change
# pass 22
# fail 0
# skipped 0
```

### Mutation controls

Each mutant ran on a throwaway copy of the worktree at the walked commit. A first round of M10 showed the refusal test had no git identity, so a missed refusal stopped before writing for the wrong reason. e18afd4 gives it one, and the round below ran after that. The runner refuses a replacement whose text does not occur exactly once, and it restores each file by copying it back from the worktree. The unmutated copy passed the same tests first.

| Mutant | Test that failed | Failure |
|---|---|---|
| M1 activation ignores a lane's state | AC19 | `activation went ahead with a lane in flight` |
| M2 a proof with no `spec:` field passes (a grace period) | AC19 | `an old-style proof landed after activation` |
| M3 an unknown rollout line is skipped | AC19 | the misspelled `lanes lane-m in-flight` line was not reported |
| M4 the hook honours `SPEC_LOCK_CONFIG` again | repository settings | `SPEC_LOCK_CONFIG opted the repository out` |
| M5 overrides outside the global config are not looked for | repository settings | doctor and activate missed all four overrides |
| M6 doctor trusts a tip the remote does not have | pulled commits | `doctor trusted a tip the remote does not have` |
| M12 doctor trusts a tip it cannot confirm | pulled commits | the stale tip was reported with the wrong reason |
| M7 no ruleset for the integration branch | AC15 and AC16 | the planned rulesets differ |
| M8 the required check is not bound to GitHub Actions | AC15 and AC16 | the planned rulesets differ |
| M9 force pushes allowed | AC15 and AC16 | the planned rulesets differ |
| M10 an Actions policy of local actions only passes | AC15: enrollment refuses | the repository and organization cases were not refused and went on to write (`local actions only: exit 1, 1 writes`) |
| M11 existing branch rules are ignored | AC15: enrollment refuses | the required-check and pull-request cases were not refused and went on to write |

## What I walked

### The canary as a new repository (AC16) and an enrolled one (AC15)

1. Before: the canary's main was 3c9d6c8, guarded by one ruleset (23948916, `spec-lock on main`) that required `spec-lock` and allowed force pushes. I pushed 3c9d6c8 to `archive/t5-main`, deleted that ruleset, and force-pushed a new root commit c03a245 holding only a README to `main` and to a new `integration/candidate`. That is the state `gh repo create --add-readme` leaves.
2. `spec-lock-rollout enroll EvanAgee/spec-lock-canary --integration integration/candidate --action 2856d69...` printed a plan with no problems: two workflow writes and two new rulesets.
3. With `--apply` it wrote `.github/workflows/spec-lock.yml` to `main` (342c4c9) and to `integration/candidate` (3c2a43f), each authored by the local git identity. It then created ruleset 23951818 `spec-lock` on `~DEFAULT_BRANCH` and 23951820 `spec-lock integration/candidate` on `refs/heads/integration/candidate`. Reading `rules/branches/<branch>` back showed `deletion`, `non_fast_forward` and `required_status_checks` with `{"context":"spec-lock","integration_id":15368}` on main and `{"context":"spec-lock integration/candidate","integration_id":15368}` on the integration branch.
4. `node test/github-walk.mjs EvanAgee/spec-lock-canary --integration integration/candidate`, exit 0:

| Candidate | Check | Job | Push | Branch after |
|---|---|---|---|---|
| unproved code on main, e0bf6cb | failure, [run](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36033708635) | 5 s, queued 2 s | refused: `Required status check "spec-lock" is failing.` | 342c4c9, unchanged |
| the same plus spec and proof, d43cb37 | success, [run](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36033738212) | 6 s | exit 0 | d43cb37 |
| unproved code on the integration branch, d8f1846 | failure, [run](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36033781112) | 6 s, queued 3 s | refused: `Required status check "spec-lock integration/candidate" is failing.` | 3c2a43f, unchanged |
| the same plus spec and proof, 5e90e4d | success, [run](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36033812165) | 6 s | exit 0 | 5e90e4d |
| unproved code off main's parent, forced, 37c07e2 | failure, [run](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36033845953) | 6 s | refused: `Cannot force-push to this branch` and `Required status check "spec-lock" is failing.` | d43cb37, unchanged |

   The integration job's log reads `spec-lock: checking d8f1846... as a landing on integration/candidate at 3c2a43f...`, then `- no proof: this code landing adds or edits no docs/proof/*.md file` and `spec-lock checker 0.0.0+0fe5fbda58ae`. So it judged the candidate against the integration tip, not main's (342c4c9), and printed the local checker's line.
5. Mutation on GitHub: I replaced ruleset 23951818's rules with `deletion` and `non_fast_forward` only, and deleted 23951820. The same walk exited 1 with `GitHub accepted the unproved push to main` and `GitHub accepted the unproved push to integration/candidate`: unproved 0fe41bd and f0b2708 landed although their checks failed ([run](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36033907139), [run](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36033991312)). The force push was still refused by the force-push rule alone.
6. `enroll ... --apply` again restored both: `updated ruleset spec-lock`, `created ruleset spec-lock integration/candidate` (now 23952024), no workflow writes.
7. `github-walk.mjs ... --no-land`, the probe for a real repository, exit 0. Unproved 595ea88 was refused on main and 001bab4 on the integration branch, and forced 3edff8a was refused. Both branches kept their tips (47c1966, 77f8ca0), and the canary had 33 branches before and after, so the probe deleted its candidates.
8. At 35aa16d, whose `bin/` the walked commit shares, `enroll` with its default pin (that commit, not the canary's) exited 1: `required_status_checks on main would refuse a direct write of .github/workflows/spec-lock.yml; land it there through the repository's usual flow, then enroll again`, and the same for the integration branch. Nothing was written. With `--action 2856d69...` it exited 0 with no writes and updated both rulesets in place.
9. `SPEC_LOCK_CANARY=EvanAgee/spec-lock-canary npm test` at the walked commit ran the walk again inside the suite: 22 pass, 0 fail.

### Activation over this machine's repositories (AC19), under a scratch HOME

The rollout file drafted from this machine's inventory lists 28 lanes in flight across the owner's workspaces, 42 repositories and one integration branch. I ran `spec-lock-rollout activate` on it with `HOME`, `GIT_CONFIG_GLOBAL` and `SPEC_LOCK_LOG` in a scratch directory:

1. As drafted: exit 1, 28 lines of `lane <id> is in-flight; activate once it has landed`, no override faults, the scratch global config still 0 bytes, no activation record.
2. With every lane marked `landed`: exit 0. The record held 1 `activated`, 28 `drained` and 43 `baseline` lines (one repository has an integration branch as well as main). `git hook list` showed both hooks in every one of the 42 repositories, and the central file held `integration <branch>`.
3. Afterwards `git config --global --get-regexp '^hook\.'` on the real config found nothing (exit 1), and neither `~/.config/spec-lock` nor `~/.local/state/spec-lock` exists.

`doctor` over the same 42 repositories, read-only, found no repository-level `hook.spec-lock-*` key. It found 11 remote-tracking tips it could not confirm because the remote had moved past them unfetched, and one remote it could not reach. None was a tip the remote's history lacks.

### Pending switch-on

- AC15: enroll one private repository under each owner, walk it with `--no-land`, then the rest of the inventory one at a time.
- AC16: create a real new repository with a first commit, enroll it from the template, and see its first unproved code landing refused.
- AC19: the real activation, after every lane in flight lands, and its record.

The commands, the order, the drain and what would be refused today are in the owner's rollout notes, outside this repository.
