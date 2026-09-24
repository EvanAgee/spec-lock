---
spec: docs/specs/fleet-evidence-e1-lock.md
tags: [spec-lock, evidence, proof, binding]
date: 2026-09-24
issue: fleet-evidence-e1-lock
walked: cc0d994da00d6940dfe7d13f9367c141abda284f
---

# Proof: evidence bindings in the checker

This branch lets a proof name an evidence manifest with an `evidence:` field beside `spec:`. When a proof in a landing does, `spec-lock check` validates the manifest from committed objects alone, by the six rules of the version 1 binding in `README.md` ("Evidence bindings"), and each refusal names the manifest field it concerns. A proof with no `evidence:` field is judged exactly as before. The code is `evidenceFaults` and its helpers in `lib/lock.mjs`, reached from `proofFaults`, so the git hooks and the GitHub action run it through the same `spec-lock check` with no rules of their own. The tests are `test/evidence.test.mjs`, now part of `npm test`.

The binding format is the version 1 contract written by the run recorder, the other half of this ticket, which lives outside this repository. It owns AC3's independent execution and all provenance; this repository covers the refusals the three criteria need from committed records. Where the contract's six rules are silent, the checker follows the recorder's own verify step: an empty `claims[]` is refused, `base` may equal `reviewed` (git's ancestor test), and commit ids are lowercase hex.

Every test, control and walk used a scratch `HOME`, a scratch global git config (`GIT_CONFIG_GLOBAL`, `GIT_CONFIG_NOSYSTEM=1`), a scratch central file and a scratch landing log, with inherited `GIT_*`, `FM_*` and `SPEC_LOCK_*` variables removed. The real global git config was last modified on 2026-09-16 and no real landing log exists. Nothing was pushed and no GitHub run was made for this lane.

Environment: git 2.54.0 (Apple Git-157), Node v22.22.0, macOS 27.0. The machine's load average was between 17 and 45 throughout.

## Criteria and evidence

| AC | Test in `test/evidence.test.mjs` | Red before the code | Green at cc0d994 | Controls that turn it red |
|---|---|---|---|---|
| AC3 | `AC3 (checker side): a failed, unfinished or timed-out run, a run on another commit, or an unsupported verdict cannot back a claim` | yes: all 9 cases landed with `spec-lock: ok` | yes | M12 to M16 |
| AC6 | `AC6: committed output that is absent, altered, hand-written or unrelated is refused; the recorded bytes land, an empty stream as a zero-length file` | yes: all 8 cases landed | yes, through `spec-lock check` and the git hook | M8 to M11 |
| AC7 | `AC7: a binding resolves to one run and one judge of the same criterion, spec and reviewed commit, and nothing but proof files may follow that commit` | yes: all 24 cases landed | yes | M1 to M7 |

The fourth test, `a proof that names no evidence manifest is judged as before, whatever lies beside it`, commits a proof without the field next to a manifest of `[]` and an output of `PASS`, and lands. The 17 tests of `test/spec-lock.test.mjs` are the regression check that nothing changed for landings with no binding.

### AC3

The run recorder's tests cover the independent run itself: the author's own run, an unapproved command, the author's environment, and executor and judge provenance. Those need its records, which this checker never reads. On the checker's side, a claim is refused when its run exited 1 (`runs[0].exit`), timed out with exit null, never finished, changed tracked files or overran its output bound (`runs[0].outcome`), ran on a later commit (`runs[0].revision`), or when its judge judged a later commit (`judges[0].revision`), found the criterion unsupported (`judges[0].verdict`), or the claim itself is unsupported (`claims[0].state`).

### AC6

The fixture's run printed `value=14` with an empty stderr, and the good attachment commits both files with their digests; the zero-length stderr file is present, and that case lands. Each of these is refused with its field:

- the output file removed: `runs[0].stdout.path`
- a hand-written `PASS` line in place of the output: `runs[0].stdout.sha256` (and `.bytes`)
- the manifest's digest altered: `runs[0].stdout.sha256`
- the byte count altered: `runs[0].stdout.bytes`
- no stdout recorded: `runs[0].stdout`
- the empty stderr file removed: `runs[0].stderr.path`
- the output pointed at `test/value.mjs`, outside `docs/proof/`: `runs[0].stdout.path`
- an unrelated receipt, another task's output with its own correct digest: `judges[0].evidence`

The same test registers the git hooks in the scratch config and fast-forwards main: the missing-output candidate is refused by the reference-transaction hook with `runs[0].stdout.path`, main stays at B, and the good candidate lands.

### AC7

Proof-only commits after the reviewed commit C, a later prose repair included, land. Each of these is refused with its field:

- after C: a code commit, a spec edit, a deleted file under `docs/proof/`, a symlink under `docs/proof/`, an executable under `docs/proof/` (`reviewed`)
- the old run after C is rewritten (the manifest names old C, which is no longer an ancestor): `reviewed`
- the rewritten commit named, with the run and judge from before: `runs[0].revision`
- a 12-digit prefix for C: `reviewed`
- a base that is not an ancestor of C: `base`; a judge on another base: `judges[0].base`
- a forged run id `t1-r99`, a claim with no judge, two runs with one id: `claims[0].run`, `claims[0].judge`
- a judge of another run or another criterion: `judges[0].run`, `judges[0].ac`
- another spec with its own AC1: `claims[0].spec_blob`; a spec not in C: `claims[0].spec`; a criterion the spec lacks: `claims[0].ac`
- a substituted observation digest: `judges[0].evidence`
- no claims, version 2, a manifest of `[]`, a manifest path through `..`, a manifest that is not committed

The code case prints `reviewed: src/value.mjs changed after the reviewed commit <C>; after it, only regular files under docs/proof/ may be added or edited`.

## Red first

The committed test file ran against the base commit's code (9f7f933's `bin/`, `lib/` and `package.json`) in a throwaway copy: `# pass 1`, `# fail 3`. All 41 broken bindings landed with `exit 0` and `spec-lock: ok`, for example `'output removed: exit 0\nspec-lock: ok\nspec-lock checker 0.0.0+e70e0e6d0daf\n'`. The failures are the named `deepEqual` assertion listing the unrefused cases, not a crash or a missing file. The no-binding test passed there too, as it should.

## Controls

Each control copied the worktree at cc0d994 (without `.git`) into a throwaway directory, replaced one exact line in the copy's `lib/lock.mjs`, and ran only the named test there; the file was copied back from the worktree before the next one. The unmutated copy passed all three tests. Every mutation failed its test on the named assertion, with these cases unrefused:

| # | Mutation | Cases that were no longer refused |
|---|---|---|
| M1 | AC7: equality into ancestry only (the C-to-P path check removed) | code, spec edit, deletion, symlink and executable after C |
| M2 | AC7: any mode or kind of change under `docs/proof/` accepted | deletion, symlink and executable after C |
| M3 | AC7: a duplicated run id resolves to nothing instead of a fault | two runs with one id |
| M4 | AC7: spec blob not compared | another spec with its own AC1 |
| M5 | AC7: judge's evidence digests not compared | substituted observation digest |
| M6 | AC7: base ancestry not checked | base not an ancestor of C |
| M7 | AC7: judge's base not compared | review on another base |
| M8 | AC6: missing committed output accepted | output removed, empty stderr file removed, output outside `docs/proof/` |
| M9 | AC6: null stdout or stderr accepted | no stdout recorded (refused by the judge-digest check instead, without the named field) |
| M10 | AC6: output digest not compared | hand-written pass line (refused on its byte count only) and digest altered (refused on the judge's digests only), each without `runs[0].stdout.sha256` |
| M11 | AC6: output byte count not compared | byte count altered |
| M12 | AC3: exit status not checked | failed run |
| M13 | AC3: outcome not checked | changed tracked files, output over its bound; timed out and never finished were refused on exit null only, without the named field |
| M14 | AC3: run revision not compared | run on a later commit |
| M15 | AC3: judge verdict not checked | unsupported verdict |
| M16 | AC3: claim state not checked | unsupported claim |

All 16 mutations failed their test.

## Checks run locally

- `npm test` at cc0d994: `# tests 21`, `# pass 20`, `# fail 0`, `# skipped 1`. The skipped test is the GitHub canary walk, which needs `SPEC_LOCK_CANARY`; this lane makes no GitHub run.
- `spec-lint docs/specs/fleet-evidence-e1-lock.md`: `spec-lint: ok (3 acceptance criteria: AC3, AC6, AC7)`.
- `npx unslop` on every changed file: `Total: 0 issues`. Its first pass found two: the manifest's JSON parse sat in an empty `catch`, which also turned an unreadable git object into "not a JSON object" instead of a failed check, and `evidenceFaults` was one 87-line function. The parse now reads the blob outside the `try`, and the rules are split into `changedAfter`, `claimFaults`, `runFaults` and `judgeFaults`.
- Review: the brief for this lane allows no subagents, so the standards and spec review ran in this session against the contract's six rules and the diff. Besides the two findings above, it changed the missing-id message from `nothing names 0 entries` to `names no judge`.

## What I walked

I walked commit cc0d994 with the real `bin/spec-lock`, `bin/spec-lock-action` and git hook against a synthetic repository in a scratch directory under the system temp directory, with the scratch environment above.

1. Main held B, a program printing `value=0`. The lane's commit C doubled the value and added a hardened spec with AC1. I ran `node test/value.mjs` on C, which printed `value=14` and exited 0, kept its stdout and empty stderr under `docs/proof/t1.evidence/`, wrote a manifest for run t1-r1 and judge t1-j1 on C against B, and committed it with the proof as P. `git diff --stat C P` listed only the manifest, the two output files and the proof.
2. `spec-lock check B P` printed `spec-lock: ok` and the checker line `spec-lock checker 0.0.0+d262d0b72881`, exit 0.
3. A code commit on top of P was refused, exit 1: `- docs/proof/t1.md: evidence docs/proof/t1.evidence.json: reviewed: src/value.mjs changed after the reviewed commit <C>; after it, only regular files under docs/proof/ may be added or edited`.
4. Replacing the committed stdout with `PASS` was refused, exit 1, with `runs[0].stdout.bytes: ... holds 5 bytes, not 9` and `runs[0].stdout.sha256: ... has sha256 c26de83a..., not "e41cdd04..."`.
5. The same broken candidate with the `evidence:` line removed from the proof printed `spec-lock: ok`, exit 0: without a binding, the proof is judged as before.
6. The action adapter on a full clone of the lane (`INPUT_TARGET=main`, `GITHUB_SHA=P`) printed `spec-lock: checking <P> as a landing on main at <B>` and `spec-lock: ok`, exit 0. On a `--depth 1` clone it refused, exit 1, with `reviewed: "<C>" is not a full commit id in this repository`, because C is not in a depth-1 clone. The README now says a workflow whose proofs carry manifests checks out full history.
7. With the hooks registered in the scratch global config, `git merge --ff-only` of the `PASS` candidate onto main was refused by the reference-transaction hook with the same two faults (`fatal: in 'prepared' phase, update aborted by the reference-transaction hook`), and main stayed at B. After `git reset --hard main`, `git merge --ff-only lane` fast-forwarded main to P. The scratch landing log held one `refused` line for the `PASS` candidate and one `allowed` line for P.

## Follow-ups, not fixed here

- The README's sample GitHub workflow uses `actions/checkout` at its default depth of 1, which refuses every landing whose proof carries an evidence manifest (step 6). The README now says to use `fetch-depth: 0` for such workflows; the sample and the action were not changed.
- `test/evidence.test.mjs` sets up its scratch environment with a smaller copy of the `scratch()` helper in `test/spec-lock.test.mjs`. A shared `test/fixture.mjs` could serve both files.
- The run recorder does not yet call `spec-lock check` for committed structure; its own proof names that wiring as later work.
