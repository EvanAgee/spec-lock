# spec-lock: switch-on and enrollment (AC15, AC16, AC19)

This is the public copy of one ticket from the spec-lock design, cut to this ticket's three criteria. Criteria ids match the full design, which is why they are not consecutive. It builds on the local lock in `docs/specs/spec-lock-t2-local-check.md`, `docs/specs/spec-lock-t3-scope.md` and `docs/specs/spec-lock-t4-hooks-push.md`, and on the GitHub check in `docs/specs/spec-lock-t5-github.md`.

## 1. Problem Statement

The checker, the git hooks and the GitHub action exist, but nothing switches them on. The global hooks are in no real git config, the central file does not exist, and no GitHub repository other than a test repository requires the check. Switching the local lock on while work started under the old rules is still in flight would refuse that work on landing. Enrolling a GitHub repository by hand risks a ruleset that misses a protected branch, allows force pushes, or accepts a same-name status from any source.

## 2. Solution

`bin/spec-lock-rollout` switches the lock on and enrolls repositories, in four commands:

- `activate <rollout file>` refuses while any listed lane has not landed. Otherwise it writes the central file, adds the two hooks to the global git config, and records the drained lanes and each listed repository's guarded tips.
- `doctor <repository>...` reports repository-level settings that switch a hook off, and remote-tracking default tips the remote does not have.
- `workflow` prints the checker workflow, one job per protected branch. A new repository starts from it.
- `enroll <owner/repo>` checks the repository's Actions policy, plan, permissions and existing branch rules. With `--apply` it writes the workflow to each protected branch, then one branch ruleset per protected branch that requires that branch's own check from GitHub Actions and blocks force pushes and deletion.

The hook no longer reads an environment variable for the central file.

## 3. Seams

- `bin/spec-lock-rollout`, the rollout command. Tests drive it as a program with a scratch HOME and global git config, and with a stand-in for the `gh` CLI that answers from a table and logs each write.
- The branch rulesets and workflow of the public test repository, observed through real pushes with `test/github-walk.mjs`.
- `spec-lock check <old> <new>`, unchanged, reached through the real git hooks after activation.

## 4. Decisions

- Every repository on this machine is covered by default, and only the owner edits the central opt-out list.
- Every GitHub repository the fleet lands on is enrolled, one at a time, and new repositories start from a template.
- The guarded branches are the default branch and the integration branches listed centrally.
- There is no grace period: the lock is switched on only after the lanes in flight have landed, and a proof in the old style is refused from the first landing.
- From activation, every move of a protected branch is logged, and each repository's baseline is recorded.

## 5. Acceptance Criteria

| AC | Requirement (EARS) | Red test, fixture, and the mutation that proves it red | Observable on the real surface | Judge |
|---|---|---|---|---|
| AC15 | When each fleet GitHub repository is enrolled, its workflow shall use the public checker and its active branch ruleset shall require that check for the default and configured integration branches. | `test/spec-lock.test.mjs`: AC15 enrolls one private repository under each owner before expanding the fleet inventory. Bad candidate pushes refuse and complete candidates pass in each. Mutate a required-check rule or omit one protected branch; its bad push assertion must fail. Detect denied public-action policy before activation. | Each inventory row links a workflow SHA, active ruleset, targeted refs, and rejected/accepted push evidence. | AC15 per-repository enrollment walk |
| AC16 | When a new fleet repository starts from the template, its enrollment shall provide the public checker workflow and required-check setup before its first non-bootstrap code landing. | `test/spec-lock.test.mjs`: AC16 creates a disposable repository from the proposed template and performs its setup, seeds initial A, then attempts unproved B. Assert refusal and repaired C success. Mutate away the required-check setup; the B refusal assertion must fail. | A new repository has an active check rule and rejects its first unproved post-bootstrap code landing. | AC16 new-repository walk |
| AC19 | When the lock is activated, rollout shall wait until in-flight lanes land and shall grant no grace period for old-style proofs. | `test/spec-lock.test.mjs`: AC19 seeds an isolated rollout inventory with lane L in flight and asserts activation is refused; mark L landed and activate. Then an old-style proof on code refuses and its repaired proof allows. Mutate drain checking or add a grace bypass; the corresponding refusal assertion must fail. | The activation record identifies drained lanes, lock date, and per-repo baseline SHA; the first old-style code landing is refused. | AC19 activation walk |

## 6. End-to-end verification

1. Run `node --test test/spec-lock.test.mjs`. Run each mutation on a throwaway copy of the repository and keep the failed assertions by criterion.
2. Reset the public test repository to a new repository's state: one README commit, no rulesets, no workflow. Enroll it with an integration branch, plan first and then `--apply`, and read back the rules on each branch.
3. Walk it with `test/github-walk.mjs`: an unproved candidate to the default and to the integration branch, each repaired, and a forced unproved candidate. Remove the integration ruleset and the default branch's required check, walk again and see it fail, then enroll again to restore. Run the probe with `--no-land`.
4. The real switch-on waits for the owner: activation on this machine and enrollment of each real repository, with the commands, the order and the drain written down beside the inventory.

Expected: GitHub refuses each unproved candidate and the force push and names the rule, lands each proved one, and fails the walk when a rule is removed. A refused activation changes nothing, and the old-style proof is refused after activation.

## 7. Non-goals

- No change to the real global git config, a real repository's config, hooks or rulesets, or any GitHub repository other than the test repository. The switch-on is the owner's step.
- No new rules in the checker. The old-style proof is refused by the rule that already requires a spec field.
- No claim that doctor or the rulesets stop someone who controls the git configuration, the environment git runs with, or a repository's administration. The landing log and the audit recheck landings.
- No pull-request flow of its own; a repository that lands through pull requests keeps doing so, and the check runs on the pushed head.

## 8. Open questions

None.
