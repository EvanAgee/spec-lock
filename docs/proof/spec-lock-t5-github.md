---
spec: docs/specs/spec-lock-t5-github.md
tags: [spec-lock, github, action, ruleset]
date: 2026-09-24
issue: spec-lock-t5-github
walked: ec8aff44e552713bf793b74cbe2cd279a71ba8a5
---

# Proof: the GitHub check

This branch runs the shared checker as a GitHub action. `action.yml` starts `bin/spec-lock-action` on the runner's Node 24. The adapter fetches the target branch's tip when the check runs, prints it, and calls `bin/spec-lock check <tip> <pushed commit>`, the same checker the git hook reaches. Every verdict from `bin/spec-lock` now ends with a checker line, `spec-lock checker <package version>+<first 12 hex of a sha256 over bin/spec-lock, lib/lock.mjs and lib/spec.mjs>`, so the hook and the action show which code judged the range. `test/github-walk.mjs` walks a real repository, and `.github/workflows/ci.yml` runs the tests on GitHub Actions.

The public repository is https://github.com/EvanAgee/spec-lock. Its `main` is 3a086fb, this repository's main before this branch. The branch `fm/spec-lock-t5-github` holds this work. The throwaway test repository is https://github.com/EvanAgee/spec-lock-canary, where every file is made up. Its workflow pins the action at `EvanAgee/spec-lock@b81bbac85b4b85a48f208160bfb2456c5e443efd`. The action's files (`action.yml`, `bin/`, `lib/`) have not changed since b81bbac, and every run below printed the same checker line, `0.0.0+a8bf17f64e57`, as the local checker at the walked commit.

The local tests and walks used a scratch `HOME`, a scratch global git config (`GIT_CONFIG_GLOBAL`, `GIT_CONFIG_NOSYSTEM=1`), a scratch central file and a scratch log, with inherited `GIT_*`, `FM_*` and `SPEC_LOCK_*` variables removed. Pushes to GitHub went over HTTPS as EvanAgee, with the gh CLI as credential helper.

Environment: git 2.54.0 (Apple Git-157) and Node v22.22.0 on macOS; the GitHub runner was Ubuntu 24.04.5 with git 2.55.0 and runner 2.337.0.

## Criteria and evidence

| AC | Evidence | Red before the code | Green | Control that turns it red |
|---|---|---|---|---|
| AC13 | Test `AC13: the git hook and the GitHub action run the same check and print the same verdict and checker line`, and the same ranges run through the hook here and the action on GitHub | yes: `1 !== 2`, the hook printed the fault but no checker line | yes, in the test and on the real ranges below | M1 hook always allows, M2 action always allows, M6 checker line dropped |
| AC14 | Test `AC14: the action judges the pushed commit against each target as it stands when the check runs`, and the live walk on the canary | yes: `Cannot find module .../bin/spec-lock-action` | yes, three live walks | M2 to M5 locally; on GitHub, a candidate whose check always passes lands unproved code on main |
| AC21 | The live walk's job timestamps for the bad, good and forced candidates | not applicable before the action existed | yes: every check job took 5 to 7 seconds | on GitHub, a candidate whose check job sleeps 61 seconds before the checker fails every duration assertion |

### Red first

The new tests ran against the base commit's code (3a086fb's `bin/` and `lib/`) in a throwaway copy:

```text
not ok 1 - AC13: ... The input did not match /spec-lock: checking 4b81507... as a landing on main at 939e5da.../. Input: ''
not ok 2 - AC14: ... Error: Cannot find module '.../bin/spec-lock-action'
# pass 0  # fail 2
```

Then the same copy with only `bin/spec-lock-action` added, so the checker line was still missing:

```text
not ok 1 - AC13: ... spec-lock: refused refs/heads/main b68aa11e4a5b..967bda42abb4
                     - docs/proof/two.md: does not name AC2 from docs/specs/two.md
                     1 !== 2
ok 2 - AC14: ...
```

### Green

`npm test` at the walked commit's code, before the proof, exit 0: 13 pass, 0 fail, 1 skipped. The skipped test is the live walk, which runs only when `SPEC_LOCK_CANARY` names a repository. With `SPEC_LOCK_CANARY=EvanAgee/spec-lock-canary` at the walked commit:

```text
ok 1 - AC14 and AC21: GitHub refuses an unproved push to main and a forced one, lands a proved one, and each check takes under 60 seconds
  duration_ms: 68397.006083
# pass 1  # fail 0
```

### Mutation controls

Local mutants ran on throwaway copies of the worktree (the runner throws when the text to replace is missing, so a mutant cannot pass by not applying). Each turned its test red:

| Mutant | Test that failed | Failure |
|---|---|---|
| M1: the git hook exits 0 first | AC13 | the hook's refusal assertion (`the git hook let the incomplete proof land`) |
| M2: the action exits 0 first | AC13 and AC14 | `the action passed the incomplete proof: 0 !== 1` |
| M3: the action ignores its target and checks main | AC14 | the action refused the integration-branch landing with `- no proof`, judged against main |
| M4: the action reuses a target tip it fetched earlier | AC14 | `a check against a stale main passed: ... at 246baf8... spec-lock: ok` |
| M5: no refusal of a push to the target itself | AC14 | `checking d5cfe9f... as a landing on main at d5cfe9f...` then `spec-lock: ok`, the empty range passing |
| M6: the checker line dropped from `spec-lock check` refusals | AC13 | the action's verdict lacked `spec-lock checker 0.0.0+85306c563a71` |

The two GitHub controls ran the walk from a throwaway copy that rewrote the workflow file in every candidate it committed:

- Always-allow check (AC14 and AC21's paired assertion). The `EvanAgee/spec-lock@...` step became `run: "true"`. Every check passed and GitHub took every push: bad 021d8b6 ([run](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36025226208), push exit 0), and forced ae157d0 ([run](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36025346991), `--force` exit 0). The walk reported four failures: "the check passed the unproved candidate", "GitHub accepted the unproved push to main", "the check passed the forced unproved candidate", "GitHub accepted the forced unproved push to main". An earlier try of this control stopped on a bug in the control script after its first candidate, 06ff36c, had already passed its always-allow check ([run](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36025114339)) and landed on main.
- 61-second delay (AC21). A `run: sleep 61` step went before the checker step. The walk reported "the bad check job took 66 seconds", "the good check job took 126 seconds" and "the forced check job took 67 seconds" ([bad](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36025471645), [good](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36025658521), [forced](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36026056132)). The good candidate carried two sleep steps because the copy added one to its parent's already-changed workflow. The refusals still held: bad and forced pushes exited 1.

After each control, canary main was put back to the proved commit 0350b7b with `git push --force`, which the ruleset accepted because that commit's check had passed.

## What I walked

### The public repository and the canary

1. `gh repo create EvanAgee/spec-lock --public`, then pushed 3a086fb as `main` and this branch at b81bbac, over HTTPS through a second remote named `github`. `gh api repos/EvanAgee/spec-lock` read `main public`. The push of the branch started the ci workflow: [run 36024516599](https://github.com/EvanAgee/spec-lock/actions/runs/36024516599), `git version 2.55.0`, `# tests 14 # pass 13 # fail 0 # skipped 1`.
2. `gh repo create EvanAgee/spec-lock-canary --public`, first commit 11b6728 with `README.md`, `app.js`, a made-up hardened spec `docs/specs/canary.md` (AC1) and `.github/workflows/spec-lock.yml`. The workflow runs on pushes to every branch but main, with `permissions: contents: read`, and its job `spec-lock` runs `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` (v7.0.1) and then the action.
3. Pushed 11b6728 to `land/first` so the check existed before the ruleset. [Run 36024626707](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36024626707) printed `target: main`, `spec-lock: checking 11b6728... as a landing on main at 11b6728...`, `spec-lock: ok`, `spec-lock checker 0.0.0+a8bf17f64e57`. Its check run reported app `github-actions`, id 15368.
4. Created ruleset 23948916, "spec-lock on main": target `~DEFAULT_BRANCH`, enforcement `active`, `bypass_actors: []`, one rule `required_status_checks` with `{"context": "spec-lock", "integration_id": 15368}`, and no rule against force pushes. `gh api .../rulesets/23948916` read `"current_user_can_bypass": "never"` for EvanAgee, who is an admin of the repository (`permissions.admin: true`).

### AC14 and AC21: the live walk

`node test/github-walk.mjs EvanAgee/spec-lock-canary`, exit 0, `"failures": []`. Main started at 6dd7750:

| Candidate | Commit | Check run | Check | Queue (s) | Job (s) | Push to main | Main after |
|---|---|---|---|---|---|---|---|
| bad: `app.js` changed, no proof | 862660625d4e | [36024904014](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36024904014) | failure | 3 | 6 | `git push` exit 1 | 6dd7750 |
| good: bad plus `docs/proof/walk-mufq3x55.md` naming AC1 | 0350b7b4c3d0 | [36024947423](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36024947423) | success | 2 | 7 | `git push` exit 0 | 0350b7b |
| forced: `app.js` changed off 6dd7750, no proof | f20a316c47e3 | [36024994723](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36024994723) | failure | 2 | 5 | `git push --force` exit 1 | 0350b7b |

Queue is the time from the run's creation to the job's start; job is the job's start to its completion, from the Actions API. The queue figures are what these runs saw, not a bound GitHub guarantees.

GitHub's answer to the bad push, word for word; the forced push got the same lines for f20a316:

```text
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: Review all repository rules at https://github.com/EvanAgee/spec-lock-canary/rules?ref=refs%2Fheads%2Fmain
remote:
remote: - Required status check "spec-lock" is failing.
remote:
To https://github.com/EvanAgee/spec-lock-canary.git
 ! [remote rejected] 862660625d4eb1a30f4f341c154e50477f0ee516 -> main (push declined due to repository rule violations)
error: failed to push some refs to 'https://github.com/EvanAgee/spec-lock-canary.git'
```

The good push printed `6dd7750..0350b7b  0350b7b4c3d09c987224af9a3f149fd97e09db62 -> main`.

What the action printed in the three runs:

```text
bad     spec-lock: checking 862660625d4eb1a30f4f341c154e50477f0ee516 as a landing on main at 6dd7750e483969f6a6e20e4411faddd0d8c7b5ab
        spec-lock: refused 6dd7750e483969f6a6e20e4411faddd0d8c7b5ab..862660625d4eb1a30f4f341c154e50477f0ee516
        - no proof: this code landing adds or edits no docs/proof/*.md file
        spec-lock checker 0.0.0+a8bf17f64e57
good    spec-lock: checking 0350b7b4c3d09c987224af9a3f149fd97e09db62 as a landing on main at 6dd7750e483969f6a6e20e4411faddd0d8c7b5ab
        spec-lock: ok
        spec-lock checker 0.0.0+a8bf17f64e57
forced  spec-lock: checking f20a316c47e3f88f8f7f340c08e10da3a31c18e1 as a landing on main at 0350b7b4c3d09c987224af9a3f149fd97e09db62
        spec-lock: refused 0350b7b4c3d09c987224af9a3f149fd97e09db62..f20a316c47e3f88f8f7f340c08e10da3a31c18e1
        - no proof: this code landing adds or edits no docs/proof/*.md file
        spec-lock checker 0.0.0+a8bf17f64e57
```

The action checked the forced candidate against 0350b7b, main's tip when its check ran, and not against 6dd7750, the commit it sits on.

The walk ran three more times, each with the same results: once before this one, which stopped on a dropped API read ("unexpected EOF") after its good push landed 6dd7750, with main never taking its bad commit 313f3a0; and twice through the gated test, the second at the walked commit ec8aff4. The last one ran bad 65638e9 ([run](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36026953639), failure, queue 3 s, job 6 s), good 3c9d6c8 ([run](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36026989722), success, queue 5 s, job 6 s) and forced 02739ab ([run](https://github.com/EvanAgee/spec-lock-canary/actions/runs/36027040898), failure, queue 2 s, job 7 s). The canary's activity log shows main moving only to proved commits, apart from the two controls, whose moves were undone as described above.

### AC13 on the real ranges

In a scratch clone of the canary, with the lock registered in a scratch global config, local `main` and `origin/main` set to what GitHub held when it checked each candidate, the hook judged the same three ranges:

```text
--- local hook, bad: git update-ref main 8626606 6dd7750
spec-lock: refused refs/heads/main 6dd7750e4839..862660625d4e
- no proof: this code landing adds or edits no docs/proof/*.md file
spec-lock checker 0.0.0+a8bf17f64e57
fatal: in 'prepared' phase, update aborted by the reference-transaction hook
[exit 128] main=6dd7750
--- local hook, good: git update-ref main 0350b7b 6dd7750
[exit 0] main=0350b7b
--- spec-lock check 6dd7750 0350b7b
spec-lock: ok
spec-lock checker 0.0.0+a8bf17f64e57
--- local hook, forced: git update-ref main f20a316 0350b7b
spec-lock: refused refs/heads/main 0350b7b4c3d0..f20a316c47e3
- no proof: this code landing adds or edits no docs/proof/*.md file
spec-lock checker 0.0.0+a8bf17f64e57
fatal: in 'prepared' phase, update aborted by the reference-transaction hook
[exit 128] main=0350b7b
```

The fault lines and the checker line match the action's output on GitHub for each range. The landing log held `refused`, `allowed`, `refused` for the three moves.

A first attempt of this walk left the clone's `origin/main` at canary main as it is now (0350b7b), and the hook then allowed the bad range. That is the pulled-commit rule from `docs/specs/spec-lock-t3-scope.md`: once the proved commit had landed on GitHub, the bad commit's `app.js` matched the remote default branch, so the hook read it as a pull. The runner has no `refs/remotes/*/HEAD`, so the action never applies that rule. The two adapters agree when the repository holds the same remote state.

## Review

Reviewed in this session without subagents, as the launch brief requires, against this repository's standards (`AGENTS.md`, the idiom of `bin/` and `test/`) and against the spec above. The review and the walk found four problems, all fixed before the walked commit:

1. The walk's clone ran as `git -C <clone> clone ...`, which cannot work before the clone exists. The first live run failed at once, and the clone now runs without `-C`.
2. One dropped API response ("unexpected EOF") ended a walk while it waited for a check. Each API read now gets three tries.
3. The walk's refusal assertions matched `/spec-lock/`, and GitHub's refusal prints the canary's rules URL, which contains `spec-lock`, so any rule's refusal would have passed. They now match `Required status check "spec-lock"`. The recorded bad and forced outputs match the new pattern and the good one does not.
4. The action printed nothing when Node could not start the checker. It now rethrows the spawn error, and the catch prints it before the exit 2.

On the spec axis, every row's red test, fixture and mutation matches the table. I record two readings here rather than guess silently. First, I ran "Mutate a 61-second delay into the checker" as a 61-second step in the check job, before the checker step. GitHub runs the checker from the pinned public commit, so a mutant inside the checker would have meant publishing it to the public repository. The step adds the same job time. Second, for "Mutate action to always allow" on GitHub, I replaced the action step with `run: "true"` in the candidates' workflow, for the same reason. The local mutants M1 to M6 change the adapters' code itself.

## Left for later tickets

- A check result belongs to a commit, not to a range. When main moves after a candidate's check passed, the commit keeps its pass, and with force pushes allowed, as on the canary, it can land over the newer main. The README advises blocking force pushes in real rulesets; the audit (T8) should recheck logged GitHub landings.
- Anyone who can push a workflow can replace the `spec-lock` job with one of the same name that always passes, as the always-allow control showed. The ruleset binds the name to GitHub Actions, not to the workflow file.
- The action fetches the target from `origin` with the checkout's credentials. A private repository whose workflow checks out with `persist-credentials: false` will fail the check closed. Enrollment (T6) should use the workflow above as written.
- The pulled-commit rule applies locally but not on the runner, so the same range can pass on this Mac after a fetch of a newer remote main while GitHub refuses it (see AC13 above).
- The action only handles push events. A pull-request run would check GitHub's test merge commit.
- The canary keeps its `land/*` branches from the walks and controls as evidence.
