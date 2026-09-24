# spec-lock: the GitHub check (AC13, AC14, AC21)

This is the public copy of one ticket from the spec-lock design, cut to this ticket's three criteria. Criteria ids match the full design, which is why they are not consecutive. It builds on the local landing check in `docs/specs/spec-lock-t2-local-check.md` and its scope in `docs/specs/spec-lock-t3-scope.md`.

## 1. Problem Statement

The local lock only guards landings made on this Mac. Work from cloud sessions and other machines reaches GitHub without passing through it, so code can still land on a protected branch there without a hardened spec and a complete proof.

## 2. Solution

The shared checker runs as a GitHub action from this public repository. A repository's workflow runs it on pushes to candidate branches. It judges the pushed commit as a landing on the protected branch, from that branch's tip when the check runs, and calls the same `spec-lock check <old> <new>` the local hook uses. A branch ruleset on the protected branch requires the check, so GitHub accepts a commit there only after the check has passed on it. To land, a commit is pushed to a candidate branch, checked, and then pushed to the protected branch.

## 3. Seams

- `spec-lock check <old> <new>`, the shared command. The git hook and the GitHub action both reach it; neither holds rules of its own.
- `bin/spec-lock-action`, the action adapter. It turns the runner's inputs (the pushed commit and the target branch) into the old and new commits of the check.
- The branch ruleset on the test repository, observed through real pushes.

## 4. Decisions

- The checker lives in the small public repository EvanAgee/spec-lock, and nothing private goes into it.
- The GitHub check runs the same checker as the local lock, and a dedicated public test repository proves it with real pushes.
- A rejected and an accepted GitHub push are both proved, with the live walk recorded in the proof.
- The GitHub check finishes in less than 60 seconds.
- The check covers force pushes.

## 5. Acceptance Criteria

| AC | Requirement (EARS) | Red test, fixture, and the mutation that proves it red | Observable on the real surface | Judge |
|---|---|---|---|---|
| AC13 | When local hooks and the GitHub action judge the same old and new commits, they shall invoke the shared spec-lock check program and return the same proof verdict. | `test/spec-lock.test.mjs`: AC13 supplies the AC3 two-proof repository to the installed local entry point and the action entry point. Both refuse the second proof; repairing it allows both. Mutate either adapter to always allow; parity and refusal assertions must fail. | Both adapters print the same missing AC id and proof, along with the checker version used. | AC13 adapter parity fixture |
| AC14 | When an unproved candidate is pushed to a protected GitHub branch, the required check shall refuse the update, and shall permit a complete candidate after an eligible check passes. | `test/spec-lock.test.mjs`: AC14 uses a dedicated GitHub test repository: push bad B to a candidate branch, observe failure, attempt B to main and assert remote refusal; repeat with repaired C and assert success. Include a forced bad update in a test ruleset that permits force updates but requires this check; assert the refusal names the required check. Mutate action to always allow; the bad-push refusal assertion must fail. Run with an actor subject to the ruleset. | GitHub run URL and push exit codes show bad rejected and good accepted, on the exact candidate SHA. | AC14 GitHub push walk |
| AC21 | When the GitHub spec check runs, it shall finish in less than 60 seconds. | `test/spec-lock.test.mjs`: AC21 records the actual check job timestamps and candidate SHA for good and bad runs. Mutate a 61-second delay into the checker; the duration assertion must fail. An always-allow checker must fail the paired bad-candidate assertion. | GitHub run evidence records check duration below 60 seconds and reports queue delay separately without calling it a guaranteed bound. | AC21 GitHub timing walk |

## 6. End-to-end verification

1. Run `node --test test/spec-lock.test.mjs`. Run each mutation on a throwaway copy of the repository and keep the failed assertions by AC id.
2. Publish the checker to EvanAgee/spec-lock. In the public test repository, install the workflow pinned to that commit, run it once, then add a branch ruleset on main that requires the `spec-lock` check from GitHub Actions, allows force pushes and has no bypass.
3. Push unproved B to a candidate branch and then to main; push repaired C the same way; push an unproved commit that is not a descendant of main with `--force`. Keep the run URLs, push exit codes, git output, main's tip after each push, and the job timestamps.

Expected: GitHub refuses B and the forced commit and names the required check, lands C, and each check job takes under 60 seconds, with queue delay reported separately.

## 7. Non-goals

- No rulesets or workflows on any repository other than the public test repository. Enrolling the fleet is a later ticket.
- No pull-request flow. Candidates reach the protected branch by direct push.
- No claim that the ruleset stops someone who can replace the workflow with a same-name job that always passes, or a repository administrator.
- No guaranteed bound on GitHub's queue delay.

## 8. Open questions

None.
