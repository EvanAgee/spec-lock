# spec-lock: evidence bindings (AC3, AC6, AC7)

This is the public copy of one ticket from a larger design for recorded, independently judged acceptance runs, cut to the checker's half of three criteria. Criterion ids match the full design, which is why they are not consecutive. The other half, which runs the commands, records who ran and judged them, and writes the binding, is the run recorder. It lives outside this repository and owns AC3; this repository covers only the refusals AC3 needs from committed records. The binding format below is the recorder's version 1 contract, and this checker implements it as written.

## 1. Problem Statement

A proof can name every acceptance id of its spec and still say nothing about what ran. A pasted "PASS" line, output from another commit, or a judgment of other output reads the same as the real thing, and code can change after the commit that was reviewed and run. The lock checks a proof's structure, so none of that is refused today.

## 2. Solution

A proof may name an evidence manifest in its front matter with an `evidence:` field, next to `spec:`. When it does, `spec-lock check` validates the manifest from committed objects alone: the manifest's shape, the reviewed commit C and its relation to the landed commit P, each claim's spec blob and criterion, the one run and one judge each claim names, and the committed output bytes and digests. Each refusal names the manifest field it concerns. A proof without an `evidence:` field is judged exactly as before, so nothing changes for a landing that carries no binding.

The checker cannot know who ran or judged anything. The executor and judge fields are copies for reading. The run recorder resolves provenance against its own records and calls this checker for the committed structure.

## 3. Seams

- `spec-lock check <old> <new>`, the shared command. `lib/lock.mjs` routes a proof's `evidence:` field to the evidence validation, beside the existing spec and AC-name checks. The git hooks and the GitHub action reach it unchanged. Fixture repositories exercise real git objects.
- The reference-transaction git hook, through which one fixture case lands and one is refused, so the refusal is shown on the path a real landing takes.

## 4. Decisions

- The owner approved this plan on 2026-09-24.
- Extend the one checker; no second parser and no second landing rule.
- Evidence validation is off by default: only a proof that names a manifest is checked against it.
- The binding format is the run recorder's version 1 contract, documented in `README.md`. Where it is silent, this checker follows the recorder: an empty `claims[]` is refused, `base` may equal `reviewed` (git's ancestor test), and commit ids are lowercase hex.
- The repository is public. Fixtures are synthetic and every id, task and output in them is invented.

## 5. Acceptance Criteria

| AC | Requirement (EARS) | Red test, fixture, and the mutation that proves it red | Observable on the real surface | Judge |
|---|---|---|---|---|
| AC3 | When a committed binding claims a run, the checker shall refuse a run that exited non-zero, never finished, timed out, changed tracked files, overran its output bound or ran on another commit, and a judge or claim that is not supported. Independent execution and executor and judge provenance are owned by the run recorder outside this repository. | `test/evidence.test.mjs`: AC3 (checker side) seeds a supported run of AC1 on C, then exit 1, outcome `timeout` with exit null, `started`, `tracked-files-changed`, `output-over-bound`, a run and a judge on a later commit, an unsupported verdict and an unsupported claim; each refuses with its field. Mutate the exit check away; the failed-run case must fail. | `spec-lock check` prints the field, for example `runs[0].exit: run t1-r1 exited 1, not 0`, and exits 1. | AC3 run-outcome fixture; the independent run itself is judged by the run recorder's own fixture |
| AC6 | When a proof's evidence manifest claims a run, the checker shall refuse the landing unless that run's stdout and stderr are committed regular files under docs/proof/ with exactly the recorded byte count and SHA-256, an empty stream being a present zero-length file, and the claim's judge compared those same digests. | `test/evidence.test.mjs`: AC6 seeds stdout `value=14` and an empty stderr with their digests. Remove the output, substitute a hand-written pass line, alter the digest or byte count, record no stdout, remove the empty stderr file, point the output outside docs/proof, or cite output the judge never compared; each refuses. The recorded bytes land, through `spec-lock check` and through the git hook. Mutate output verification to accept missing artifacts; AC6 must fail. | `spec-lock check` and the git hook refuse a corrupted committed attachment with the field, such as `runs[0].stdout.sha256`, and main stays put; the intact attachment lands. | AC6 committed-artifact fixture |
| AC7 | When a proof names an evidence manifest, the checker shall resolve each claim to exactly one run and one judge of the same spec blob, criterion, reviewed commit and review base, and shall refuse the landing when anything other than an added or edited regular file under docs/proof/ changed after the reviewed commit. | `test/evidence.test.mjs`: AC7 seeds spec S1 with AC1, reviewed commit C, run R1 and judge J1. A missing judge, a forged run id, a duplicated run id, a judge of another run or criterion, another spec with its own AC1, a criterion the spec lacks, a short commit id, a base that is not an ancestor, a review on another base, a substituted observation digest, an old run after a rebase, and code, a spec edit, a deletion, a symlink or an executable after C each refuse; proof-only commits after C, a later prose repair included, pass. Mutate equality into ancestry-only matching; AC7 must fail on C followed by changed code. | `spec-lock check` names the mismatched field, for example `reviewed: src/value.mjs changed after the reviewed commit <C>`. | AC7 binding fixture through the existing `spec-lock check` |

## 6. End-to-end verification

1. Run `npm test`. The existing suite is the regression check that a landing with no binding is judged as before.
2. Run each mutation named above, and one per remaining rule, on a throwaway copy of the repository, never the worktree, and keep the failed case for each.
3. In a synthetic repository with a scratch global git config, run the acceptance command on C, commit its output and a manifest at P, and call the real `bin/spec-lock check`, the action adapter `bin/spec-lock-action` on a full and on a depth-1 clone, and the registered git hook.

Expected: P passes; a code commit on top and a hand-written output are refused with their fields; the same proof without its `evidence:` line passes; the depth-1 clone refuses because C is not in it; the hook refuses the corrupted candidate, keeps main, and lands P.

## 7. Non-goals

- No execution of any command, and no fetch of any record, from the checker.
- No claim about who ran or judged a command; provenance belongs to the run recorder.
- No change for a proof without an `evidence:` field, and no retroactive check of existing proofs.
- No manifest version other than 1.
- No change to the GitHub action's fetch depth; the README tells a workflow that lands bindings to check out full history.

## 8. Open questions

None.
