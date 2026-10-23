---
tags: [spec-lock, evidence-binding, batches]
date: 2026-10-23
issue: own-branch-evidence
spec: docs/specs/2026-10-23-own-branch-evidence.md
walked: 423f2142
---
# Own-branch evidence stands on the landed commit

A version 2 manifest checked under semantic checking now stands on a batch that changes other files. After its reviewed commit C, a path outside `docs/proof/` refuses only when an approval recorded on C binds it and its tree entry at the landed commit P differs, a deleted or added file included: `<path> is bound by the evidence recorded on <C> and changed before the landed commit <P>; capture it on the landed tip`. Version 1 manifests, the candidate binding-only check, and approvals that bind nothing outside `docs/proof/` keep exact identity. Proof paths, ancestry, runs and judgments are unchanged.

The checker identity is now `spec-lock checker 0.0.0+51e01bebb9a5` (it was `0.0.0+e4d07caf32c5` on `main`, and the selected copy runs `0.0.0+338f1cfb3dc2`). The selected policy id stays `selected-v1:46d981345b6005025f296796b90e42ba15d8888bdb515a394db366e0dee392b5`: it hashes the central file's bytes, which this change does not touch.

This is a local candidate on the task branch: nothing was pushed, and the machine-wide hook pin and the selected copy were not touched.

## What I walked

Every run used a scratch HOME and global git config with `GIT_CONFIG_NOSYSTEM=1`. This change has no screen, so there is no video or design review.

- Red at the test-only commit `a60d7e2`: `node --test test/own-branch-evidence.test.mjs` on an extract of that commit, `# pass 0`, `# fail 4`. AC1 refused `src/other.ts changed after the reviewed commit`; AC2 printed the old `changed after` line instead of the bound-file line; AC3 refused `src/red.ts changed after the reviewed commit`; AC4 found no README text. [Output](https://assets.agee.dev/evidence/spec-lock/8cf9a1762f72858a36837c04ed879d72/red-commit-a60d7e2.txt), and the first red, taken before any code changed, [here](https://assets.agee.dev/evidence/spec-lock/f530f3a4698aac1ca99adf175137748a/red-baseline.txt).
- Full suite at `423f2142`, through `full-suite-slot npm test`: `# tests 144`, `# pass 143`, `# fail 0`, `# skipped 1` (the GitHub canary, which pushes to a real repository). [Output](https://assets.agee.dev/evidence/spec-lock/87001cd1e9b3f5aea126f6ba2803fa35/full-suite-walked.txt).
- Real-batch replay at `423f2142` (AC5): `node test/own-branch-replay.mjs <selected repository> <batch file>`, with the batch file the selected repository froze from two real landing batches. The walk works in a shared clone in a temp directory; the selected repository's `git status` was empty afterwards. Three lanes stand; the two whose proof-run script was absent at their walked commit are refused, naming that script; `replay: ok`. [Output](https://assets.agee.dev/evidence/spec-lock/61066b5aea877806968565a629d1e9ab/replay-walked.txt). The same walk with `main`'s checker: every lane refused with 82 to 197 `changed after the reviewed commit` lines, `replay: failed (5 lanes)`. [Output](https://assets.agee.dev/evidence/spec-lock/6cb7b23fe5737f2c8964c559eec53d6e/replay-base-2.txt). The replay judges only the after-review part of the check: the real manifests were captured on the frozen tips, so the walk commits a stand-in manifest whose approval is recorded on each walked commit with the lane's real inputs, and reads only its `reviewed:` lines. It also fails a lane when the checker does not judge (seen with a missing checker path) and an empty lane list.
- Controls on throwaway copies made by `control-copy run`, on the final code: 9 mutations, each red on its criterion. [Controls](https://assets.agee.dev/evidence/spec-lock/78d1f805f4236654a065c9a0c6c93dcf/controls.json), [summary](https://assets.agee.dev/evidence/spec-lock/30c8506e0ad6b77421aecfd070d3f1b3/controls-summary.txt), [logs](https://assets.agee.dev/evidence/spec-lock/4fa835a59391200b585b1fe1dd343922/controls-logs.txt).

| what was broken | what failed |
| --- | --- |
| the version 2 and semantic gate dropped | AC1 (the version 1 guard is no longer refused) |
| the nothing-bound fallback dropped | AC1 (approvals bound nowhere on C let `src/other.ts` through) |
| proof inputs counted as bound | AC1 (an approval binding only `docs/proof/t1.md` let `src/other.ts` through) |
| every approval binds, whatever its revision | AC1 and AC3 |
| bound paths compared by presence only | AC2 |
| the object id compared, the mode ignored | AC2 (the executable `requirements.txt` passed) |
| bound folders ignored | AC2 (the `src` and `src/later` folder cases passed) |
| the owner's list wins over a bound file | AC2 |
| the README paragraph deleted | AC4 |

| AC | Test and its oracle | Observed |
|---|---|---|
| AC1 | `test/own-branch-evidence.test.mjs` "AC1": under a selected `semantic-v2` policy, `spec-lock check` exits 0 with `spec-lock: ok` for a merge of a branch adding `src/other.ts`, an edit of `src/notes.mjs` (changed by the job, bound by nothing) and a proof edit; `git update-ref refs/heads/main <merge>` through the registered hook moves `main`. A version 1 manifest carrying an `approvals` list, a `check-candidate` landing, and manifests whose approvals bind nothing on C or only `docs/proof/t1.md` each exit 1 with `<path> changed after the reviewed commit`. | ok at `423f2142`; red at `a60d7e2`; four controls red. |
| AC2 | "AC2": the fault list equals exactly the one line `- docs/proof/t1.md: evidence docs/proof/valid/manifest.json: reviewed: <path> is bound by the evidence recorded on <C> and changed before the landed commit <P>; capture it on the landed tip` for `test/expected.txt` edited, `requirements.txt` deleted, `src/later.mjs` added after C, `test/expected.txt` edited while the owner lists it, `requirements.txt` made executable, a bound folder `src` with a changed file, and a bound `src/later` added as a folder. A symbolic link under `docs/proof/` and a commit that does not contain C still refuse. | ok; red at `a60d7e2`; four controls red. |
| AC3 | "AC3": a red approval recorded on R binds `src/red.ts`; adding it after C gives exit 0 and `spec-lock: ok`. | ok; red at `a60d7e2`; one control red. |
| AC4 | "AC4": the README's evidence-binding section holds the refusal text, `` `approvals[]` whose `revision` is `reviewed` `` and `Version 1 manifests and the candidate binding-only check keep exact identity`. | ok; red at `a60d7e2`; one control red. |
| AC5 | `node test/own-branch-replay.mjs`: lane verdicts must equal those derived from the batch file's recorded blobs (independent of the checker). | `replay: ok` at `423f2142`; `replay: failed (5 lanes)` with `main`'s checker. |

## What I assumed

- other: Built on `main`, not on `c9679452`, the revision the change note started from. Their `changedAfter` and its caller are identical; `main` adds the plain-coverage and `What I assumed` rules. Marked for the owner: moving the selected copy to this build brings those two rules to the selected repository as well.
- wiring: A bound path compares its whole tree entry at C and P, mode and object id: a bound file made executable with the same bytes refuses, and a bound folder refuses when anything in it changes.
- wiring: When the approvals recorded on C bind nothing outside `docs/proof/`, the manifest keeps exact identity, as the selected repository's own reference code refuses such evidence.
- wiring: For version 2 under semantic checking, the owner's after-review list no longer decides paths outside `docs/proof/`: an unbound listed file passes because it is unbound, and a bound listed file now refuses where it passed before. The owner's rule says evidence stands only when every bound file is unchanged. The after-review tests moved to a version 1 landing, where the list still decides.
- wiring: The spec a manifest claims against is only compared at P when an approval lists it as an input. Every fixture and all five real lanes do bind it, so a spec edited after C refuses there. A recorder that leaves the spec out would let a reworded criterion through; adding the manifest's `spec` to the bound set would close it, and is the owner's call.

## Reviews

Two rounds, alternating, both at high effort, run from the worktree. `$W` is the supervisor's task data folder outside the repository.

1. Codex: `codex exec --skip-git-repo-check --model "${AGENTS_REVIEW_MODEL:-gpt-6-astra}" -c model_reasoning_effort="high" -o $W/review-round1-codex.md "$(cat $W/review-request-1.txt)" < /dev/null > $W/review-round1-codex.log 2>&1`. [Request](https://assets.agee.dev/evidence/spec-lock/9c4c2cb730ebd8f3248939d5d3beb1b2/review-request-1.txt), [review](https://assets.agee.dev/evidence/spec-lock/20e19a0ef9f5c7012bf25aa16ad27392/review-round1-codex.md). One bug, fixed: a bound path that is a folder, or is added as one, slipped through, because the rule matched only the file paths the diff lists; each bound path's tree entry is now compared directly, with two new AC2 cases and a control. Three more, fixed: a host path in the spec, `npm test` not running the new file, and the replay trusting a checker that printed nothing.
2. Claude Opus 5.5: `CLAUDE_CODE_NO_MODEL_FALLBACK=1 CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK=1 claude -p --model claude-opus-5-5 --effort high --output-format json --settings '{"env":{"CLAUDE_CODE_SUBAGENT_MODEL":"claude-opus-5-5"}}' "$(cat $W/review-request-2.txt)" < /dev/null > $W/review-round2-opus.json`. `modelUsage` names only `claude-opus-5-5`. [Request](https://assets.agee.dev/evidence/spec-lock/7e218006da9284070aeda343e9858b21/review-request-2.txt), [review](https://assets.agee.dev/evidence/spec-lock/4b61822a904c2c9a3d11fd23b1465cb5/review-round2-opus.json). No code bug. One evidence gap, fixed: no test covered approvals that bind only `docs/proof/` files, and a mutation there stayed green; the AC1 guard and the "proof inputs counted as bound" control now cover it. A comment was reworded. The unbound-spec point is listed above as an assumption for the owner.

No third round: round 2 found no bug in the code. The round 2 fixes (one test case, one comment) were not reviewed again.

## Files the spec did not name

- `docs/solutions/2026-10-23-batch-voids-own-branch-evidence.md`: the solution note every job writes.
- `package.json`: its `test` script lists test files by name, so the new test file had to be added.

Ran: `node --test test/own-branch-evidence.test.mjs` on an extract of `a60d7e2` and in the worktree; `full-suite-slot npm test` at `423f2142`; `node test/own-branch-replay.mjs` with this checker, `main`'s checker, a missing checker path and an empty batch file; `control-copy run` with 9 controls; `node bin/spec-lock policy`; two review rounds.
Printed: red `# fail 4`; suite `# tests 144`, `# pass 143`, `# fail 0`, `# skipped 1`; replay `replay: ok` and, with `main`'s checker, `replay: failed (5 lanes)`; 9 of 9 controls `red`; `spec-lock checker 0.0.0+51e01bebb9a5` and the policy id `selected-v1:46d98134…`.
Did not run: the GitHub canary walk (it pushes to a real repository); a video or design review (no screen); a browser suite (the project has none); a third review round (round 2 found no code bug); any switch of the installed or selected copy, which waits for the owner.
Unverified: that real recorders always bind the spec; the replay checks only the after-review part of each lane's evidence, not its runs or judgments.
