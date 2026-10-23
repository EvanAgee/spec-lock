# Own-branch evidence stands on the landed commit

Baseline: `1ed1a13` on `main`. Design: no.

## Problem Statement

In a selected repository, a job records its version 2 evidence on its own commit C, then lands inside a batch that also merges other jobs. The evidence binding refuses any path outside `docs/proof/` that differs between C and the landed commit P, so every other job's code in the batch voids the evidence: `<path> changed after the reviewed commit <C>; after it, only regular files under docs/proof/ may be added or edited`. Batches therefore capture every job's evidence again on the frozen batch tip, which is the slowest step of a landing, even when nothing the evidence reads has changed.

## Intent

The owner wants a job's evidence, recorded once on its own commit, to stand on the batch that lands it when the files that evidence reads are unchanged. On 2026-10-22 the owner answered "your picks" for the two landing-speed choices and then "B" for the narrower rule: a job's version 2 evidence recorded on its own commit C stands on a landed commit P when every file bound by the manifest's approvals recorded on C (approvals whose `revision` equals C, their inputs, outside `docs/proof/`) has the same git blob at C and at P. Files the job changed but its evidence never reads may differ. The owner's words and the relay are in the task's decision record (`decided.md`, kept outside this public repository).

## Solution

For a version 2 manifest checked under semantic checking (the selected `semantic-v2` policy, or `spec-lock check-semantic`), the binding's after-review rule changes for paths outside `docs/proof/`: a path is refused only when an approval recorded on C binds it and its blob at P differs from its blob at C, a file absent on one side included. The refusal reads `<path> is bound by the evidence recorded on <C> and changed before the landed commit <P>; capture it on the landed tip`. Everything else stays: C must still be P or an ancestor of it, paths under `docs/proof/` may only be added or edited as regular files, runs and judgments still bind to C, and version 1 manifests and the candidate binding-only check (`check-candidate` outside a required policy) keep exact identity.

The code is built on this repository's `main`. The change note that asked for it names approved revision `c9679452` as its starting point; where that revision is installed is in the task's record, outside this public repository. `c9679452` is an earlier build of the after-review line; `main` rebuilt that line without committed evidence and added two rules on top: plain coverage for unselected repositories and the `## What I assumed` proof section. `changedAfter` and its caller are byte for byte the same in both. Building on `main` keeps one line of history; the cost is that moving the selected copy to this build also brings those two later rules to the selected repository, which the owner decides at that switch.

## Seams

- `spec-lock check <old> <new>` under a selected `semantic-v2` policy, and `spec-lock check-candidate`: existing. The same `checkRange` runs behind both Git hooks and the GitHub action, so the CLI is the highest seam that judges a landing. AC1 also lands through the registered reference-transaction hook.
- `node test/own-branch-replay.mjs <repository> <batches.json> [<spec-lock CLI>]`: **new** walk over the same CLI, for AC5. It needs a real repository's commits, which a unit test cannot hold, so it is a walk like `test/after-review-walk.mjs`.

Every criterion except AC4 and AC5 is tested in `test/own-branch-evidence.test.mjs`, on synthetic repositories in a temp directory with a scratch HOME and global git config. AC4 reads `README.md`.

## User Stories

### US1: evidence recorded on the job's own commit lands in a batch (P1)
As the owner, I want a job's version 2 evidence to stand when the batch changes only files the evidence never reads, so that batches stop capturing evidence again on the frozen tip.
**Independent Test:** merge another branch on top of a valid landing and run `spec-lock check`.
**Criteria:** AC1, AC3

### US2: a changed bound file still refuses (P1)
As the owner, I want a landing refused, naming the file, when a file the evidence reads changed after C, so that evidence never vouches for bytes it did not see.
**Independent Test:** edit a bound input after C and run `spec-lock check`.
**Criteria:** AC2

### US3: the rule is written down and proved on real batches (P2)
As the owner, I want the README to state the rule, and a replay of two real batches to show which jobs it would have saved.
**Criteria:** AC4, AC5

## Decided

- The rule itself, quoted in Intent: version 2 evidence recorded on C stands on P when every file bound by the approvals recorded on C, outside `docs/proof/`, has the same git blob at C and at P; files the job changed but its evidence never reads may differ. Owner, 2026-10-22: "your picks" for 2B and 3B, then "B" for the narrower rule, relayed by the supervisor; record `decided.md`, kept outside this public repository.
- The change applies to version 2 manifests under the semantic policy only; version 1 manifests and the candidate binding-only check keep exact identity; the refusal message is the one in Solution; the test cases are the change note's table. From the change note (section 1) that carries the owner's 2026-10-22 answer, "B" for the narrower rule, cited by the record `decided.md`, kept outside this public repository.
- This task builds the checker only. Switching or reinstalling any installed spec-lock copy needs the owner's yes after landing; nothing is pushed. From the supervisor's brief for this task, which carries the owner's 2026-10-22 answers, "your picks" and "B", from the record `decided.md`, kept outside this public repository.

## Assumptions

- technical: Built on `main`, not on `c9679452`; the reasons are in Solution. Moving the selected copy to this build also brings the plain-coverage and `What I assumed` rules to the selected repository.
- technical: "Semantic policy" means the checker's semantic mode: a required selected `semantic-v2` policy, or the `check-semantic` command. `check-candidate` under such a policy is already turned into semantic checking by the policy, as today.
- technical: A bound path compares its whole tree entry at C and at P, mode and object id, absence included. A bound file whose blob stays but whose mode changes (made executable, turned into a link) is refused, and a bound path that is a folder, or becomes one, is refused when that folder's tree differs. The owner's rule names the blob; the mode and a folder's contents are part of what a run reads.
- technical: When the approvals recorded on C bind nothing outside `docs/proof/`, the manifest keeps exact identity. Such evidence reads nothing the rule could compare, and the reference code in the selected repository's own tooling refuses it too ("nothing it binds lies outside docs/proof/").
- technical: For version 2 manifests under semantic checking, the owner's after-review list no longer decides paths outside `docs/proof/`: an unbound listed file passes because it is unbound, and a bound listed file is refused, because the owner's rule says evidence stands only when every bound file is unchanged. The list still applies wherever exact identity holds (version 1 manifests and the binding-only check), and a malformed list still refuses every evidence-bound check. The after-review tests (`test/after-review.test.mjs`) move to a version 1 landing under legacy policy, where the list still decides, and the semantic test of a golden edited after C (`test/semantic-evidence.test.mjs`) now expects the bound-file refusal.
- technical: The checker identity printed by `spec-lock policy` changes, because it hashes `lib/lock.mjs`. The selected policy id does not: it is the SHA-256 of the central file's bytes, which this change does not touch.

## Acceptance Criteria

| AC | Requirement (EARS) | Red test, fixture, and the mutation that proves it red | Observable on the real surface | Judge |
|---|---|---|---|---|
| AC1 | While a version 2 manifest is checked under semantic checking, when paths outside `docs/proof/` that no approval recorded on C binds differ between C and P, `spec-lock check` shall print `spec-lock: ok`, where a version 1 manifest, the candidate binding-only check, and a version 2 manifest whose approvals on C bind nothing outside `docs/proof/` each still refuse the same kind of change with `changed after the reviewed commit`. | `test/own-branch-evidence.test.mjs` "AC1": a selected `semantic-v2` scratch repository whose job commit C also adds `src/notes.mjs`, which no approval binds; on top of the valid landing: a merge of a branch adding `src/other.ts`, a later edit of `src/notes.mjs`, and an edit of `docs/proof/t1.md`; assert exit 0 and `spec-lock: ok`, and `git update-ref refs/heads/main <merge>` through the registered hook moves `main`. Guards: a version 1 manifest carrying an `approvals` list, landed as documentation with `docs/notes/later.md` changed after C; a `check-candidate` landing in an unselected scratch repository with `src/other.ts` changed after C; the valid manifest with its approval's `revision` set to another commit; each exits 1 with `<path> changed after the reviewed commit`. Red at the baseline: the merge is refused with `src/other.ts changed after the reviewed commit`. **Drop the version 2 and semantic gate, and separately drop the nothing-bound fallback, and prove AC1 goes red.** | `spec-lock check` prints `spec-lock: ok` for the merge; `git rev-parse main` prints the merge after the hooked `update-ref`. | `test/own-branch-evidence.test.mjs` |
| AC2 | If a file bound by an approval recorded on C differs between C and P, including a bound file deleted after C or absent at C and added after it, then `spec-lock check` shall exit 1 with `<path> is bound by the evidence recorded on <C> and changed before the landed commit <P>; capture it on the landed tip`, and shall still refuse a symbolic link added under `docs/proof/` and a P that does not contain C. | Same file "AC2": on top of the valid landing, separately, edit `test/expected.txt`, delete `requirements.txt`, and add `src/later.mjs`, which a second approval recorded on C binds and C does not hold; assert exit 1 and the exact line naming each path, C and P, as the only fault. The same holds for `test/expected.txt` edited while the owner's after-review list names it, for `requirements.txt` made executable with its bytes unchanged, for a bound folder `src` whose file `src/notes.mjs` changes, and for a bound `src/later` absent at C and added as a folder. Then a symbolic link `docs/proof/t1.link` added after C (`changed after the reviewed commit`) and a commit with the valid landing's tree built on the base, not on C (`is not the landed commit`). Red at the baseline: the lines read `changed after the reviewed commit`, not the bound-file message. **Compare bound paths by presence only; compare the object id and ignore the mode; ignore bound folders; let the owner's list win over a bound file; and prove AC2 goes red each time.** | `spec-lock check` prints `- docs/proof/t1.md: evidence docs/proof/<export>/manifest.json: reviewed: test/expected.txt is bound by the evidence recorded on <C> and changed before the landed commit <P>; capture it on the landed tip`. | `test/own-branch-evidence.test.mjs` |
| AC3 | When an approval recorded on another revision than C binds a path that changes after C, and no approval recorded on C binds it, `spec-lock check` shall print `spec-lock: ok`. | Same file "AC3": the valid manifest with a second, red approval recorded on the red commit R that binds `src/red.ts`; a later commit adds `src/red.ts`; assert exit 0 and `spec-lock: ok`. Red at the baseline: refused with `src/red.ts changed after the reviewed commit`. **Bind the inputs of every approval regardless of revision and prove AC3 goes red.** | `spec-lock check` prints `spec-lock: ok`. | `test/own-branch-evidence.test.mjs` |
| AC4 | The README shall state, in its evidence-binding rules, that for a version 2 manifest under semantic checking only files bound by the approvals recorded on `reviewed`, outside `docs/proof/`, must keep their blob, quote the bound-file refusal, and say that version 1 and the binding-only check keep exact identity. | Same file "AC4": read `README.md`, assert the evidence rules name `approvals`, `reviewed`, the refusal text and `exact identity` for version 1. Red at the baseline: the README has none of it. **Delete the README paragraph and prove AC4 goes red.** | `grep -n "is bound by the evidence" README.md` prints the paragraph. | `test/own-branch-evidence.test.mjs` |
| AC5 | When the replay walk runs five lanes of two real landing batches, each lane's evidence moved to its walked commit with the inputs its batch approval bound, the checker shall report no reviewed-commit fault for the three lanes whose bound files are unchanged on the batch tip, and shall refuse the two lanes whose bound proof-run script was added after their walked commit, naming that script. | `node test/own-branch-replay.mjs <repository> <batches.json>` on a shared clone in a temp directory: for each lane, a commit on the frozen tip adds a synthetic spec, a proof and a version 2 manifest whose approval is recorded on the walked commit and binds the lane's inputs; run `spec-lock check-semantic <tip> <commit>` and read its `reviewed:` lines; the walk exits 0 only when the five verdicts match the batch file. Red at the baseline: run with `main`'s CLI as the third argument, all five lanes print `changed after the reviewed commit` lines and the walk exits 1. **Run the walk against the baseline checker and prove AC5 goes red.** | The walk prints one verdict line per lane and `replay: ok`. | `node test/own-branch-replay.mjs` |

## End-to-end verification

```
npm test
node test/own-branch-replay.mjs <selected repository> <batches-177-178.json>
```

Expected: every test passes, including `test/own-branch-evidence.test.mjs`, and the replay prints three lanes that stand, two lanes refused naming their bound proof-run script, and `replay: ok`. Failure is any test failing, or the replay printing `replay: failed`. The replay reads the selected repository's objects through a shared clone in a temp directory and writes nothing in that repository.

## Non-goals

- The shared evidence procedure and the supervisor's brief changes (sections 2 and 3 of the change note): they live in other repositories and wait for other work.
- Reusing a verifier's approval across revisions (`reuse-plan`): a separate checker decision the change note leaves open.
- Changing what runs, judgments, red evidence or golden reviews bind to: they still bind to C.
- Moving the machine-wide hook pin or the selected copy, and pushing: the owner decides after landing.

## Open questions

None.

## Further Notes

Solution notes used: `docs/solutions/2026-10-09-bot-file-voids-proofs.md`: the same refusal, one bot path at a time; this rule makes the owner's list unnecessary for version 2 manifests under semantic checking, so the after-review tests move to a version 1 landing where the list still decides.
