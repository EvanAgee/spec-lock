# Enforce complete evidence in selected repositories

Baseline: `6a0d7e5f3c306357f07a4d1fe6bba343fcc48375`. Design: no.

## Problem Statement

The semantic candidate checks are optional. A complete prose proof can still support
code without execution records, and local hooks cover every non-opted-out repository.
Require reviewed version 2 evidence only in repositories the owner explicitly selects.

## Seams

S1 is the actual capture, export and check CLI. S2 is rollout preview/activation plus
real Git merge and pre-push commands, using scratch homes, configs and repositories.
These seams are selected by the parent task. No real hooks or accounts are changed.

## Acceptance Criteria

| AC | Requirement (EARS) | Red test, fixture, and the mutation that proves it red | Observable on the real surface | Judge |
|---|---|---|---|---|
| AC1 | When a covered landing lacks version 2 evidence, the checker shall refuse it without falling back to optional or version 1 evidence. | `test/portable-evidence.test.mjs`, `required-version`: two-criterion spec, code change, complete prose proof, first no manifest then version 1. Baseline admits those proofs. Mutate required-policy enforcement to legacy and prove refusal assertions fail; valid version 2 is the positive control. | S1: `spec-lock check` exits 1, names required evidence/version, and prints effective policy and checker identity. | `required-version` CLI fixture. |
| AC9 | When selected-repositories mode is used, the hook shall enforce required evidence only in explicitly selected repositories and their linked worktrees, with effective scope shown before activation. | `test/portable-evidence.test.mjs`, `selected-scope`: scratch repositories A and B plus A's linked worktree; select A, inventory B only. Current hook covers both. Mutate selection into legacy opt-out behavior and prove B's untouched assertion fails; malformed required policy must refuse A. | S2: real scratch `git merge --ff-only` refuses A and its worktree's bad candidate; B remains unaffected; rollout preview lists only A as selected. | `selected-scope` Git fixture. |
| AC10 | When version 2 policy is used through the local landing and push paths, the adapters shall produce the same required-evidence verdict while legacy installations retain version 1 behavior. | Same test file, `adapter-policy`: same bad/good candidates through CLI, reference transaction and pre-push to a scratch bare remote; remote's own lock disabled. Legacy fixture still accepts optional evidence. Mutate one adapter to drop required policy and prove the mismatch fails. | S2: both covered Git paths refuse the bad candidate without moving their target, then accept the good candidate with the same effective checker/policy identity. | `adapter-policy` Git fixture. |
| AC14 | When selected-repository enforcement is verified, the verification process shall report paired observed Git outcomes and runtime for selected, unselected and linked-worktree cases, counting unintended blocks separately. | `test/portable-evidence-walk.mjs` runs the agreed bad/good candidates through actual scratch Git operations on prerequisite and candidate revisions. Baseline has no selected-only required-evidence route. Mutate the unselected-repository outcome in a throwaway summary and prove receipt review detects the false scope claim. | S2: the proof reports guarded bad landings refused, good landings accepted, unselected operations wrongly blocked, linked-worktree coverage and added check time, with before/after tips. | Independent Evidence review recomputes the scope impact table from saved raw Git observations. |

## Implementation contract

The owner file remains `$HOME/.config/spec-lock/config`. Selected mode has exactly
one `mode selected` and one `evidence semantic-v2` or `evidence legacy` line, followed
by `select <canonical absolute common Git directory>` and optional `integration`
lines. Selection and evidence requirements are explicit separate settings. Duplicate,
unknown or malformed selected settings refuse. `repo` entries in a rollout file are
inventory only. `select <repository or linked worktree path>` in rollout resolves the
common Git directory, deduplicates scope, and never implicitly selects inventory.

`spec-lock-rollout preview <file>` shows mode, evidence requirement, selected common
repositories, inventory, guarded branches, checker identity, policy identity and the
existing exceptions, without writing settings. Selected activation prints the same
plan before writing scratch central configuration and registering hooks. Hook command
registration carries a persistent `--selected` marker. Missing or downgraded central
policy then refuses instead of reverting to legacy. Existing legacy registrations
and version 1 evidence remain unchanged. This task tests activation only in scratch.

Both Git adapters and `spec-lock check` resolve policy from the owner configuration,
never candidate files or repository-local policy keys. Selected policy identity is a
SHA-256 of exact central bytes, with a versioned prefix. Export binds version 2 to
that identity when selected semantic policy applies; changing policy requires export
again. Candidate commands cannot weaken an active owner requirement. The checker
still only reads committed objects; it executes no recorded commands. Fingerprints
cover every decision module and the shell scope adapter.

Under required semantic policy, covered code needs version 2 plus all capture and
semantic checks. Missing, version 1, invalid version 2 and wrong-policy records refuse.
The CLI, local landing and pre-push print the same effective policy/checker identity
on their observed covered verdicts. Unselected repositories pass untouched. Linked
worktrees share common-directory selection. An unselected repository needs no Node
for its hook to pass. Malformed scope that prevents knowing selection fails closed.

Retain documentation, initial-commit and previously landed/pulled-content exceptions.
Ordinary documentation-only landings need no new evidence. Markdown instruction paths
are not newly governed. Existing proof validation and known-tip behavior remain, and
these exceptions are listed in preview and proof. Same-user hook bypass, editable
policy and mutable trusted remote refs remain explicit limits.

## End-to-end verification

Freeze the case list and actual prerequisite observations before production edits.
Use a synthetic two-criterion doubling task with independently reviewed expected 14.
Capture real red and green, export them, attach proof-only records, and run the same
missing, legacy, invalid-v2 and valid-v2 candidates through CLI, merge and local bare
remote push. Disable the receiving remote hook so pre-push owns its refusal. Save
commands, outcomes, stdout/stderr, policy/checker ids and before/after branch tips.
Exercise selected A, its linked worktree, inventory-only B, malformed/missing policy,
legacy behavior and declared exceptions. The default portable walk runs prior capture
and semantic obligations plus this policy stage, covering AC1 through AC10 offline.

For AC14 use three timed repeats per frozen case and retain exact fixture inputs,
raw captures, medians/ranges, false acceptance/refusal denominators, unintended
unselected blocks and unsupported baseline capabilities separately. No missing command
counts as an invalid acceptance. Independently recompute outcomes and times; corrupt
an unselected outcome and a denominator to prove receipt checking refuses. Remove
required-policy, selection and one adapter's policy only in throwaway copies; each
mutation must fail its actual CLI/Git assertion. The full offline suite runs through
the configured full-suite wrapper. Required alternating review rounds precede the
source commit; a distinct verifier replays approved inputs at that exact commit.

## Alternatives and sources

Checked 2026-09-28. [Git hooks](https://git-scm.com/docs/githooks) cover reference moves
and pushes regardless of the coding agent. [Claude hooks](https://code.claude.com/docs/en/hooks)
provide earlier caller-specific feedback but do not cover other Git clients. Keep the
parent's shared Git checker choice. Neither local approach adds a service fee; shared
Git enforcement costs local checking time, which AC14 measures. It still permits
same-user bypass. [Git common directories](https://git-scm.com/docs/git-rev-parse)
identify linked worktrees together; storing checkout paths would need duplicate
selection and could leave a linked checkout uncovered.

## Non-goals

Real enrollment/activation, publication, remote workflow changes, authenticated actors,
protected test writes, generic reply interception and the workflow consumer are deferred.
No synthetic result establishes production reliability. No new paid dependency.

## Open questions

None blocks the local increment. The owner selects real pilot repositories and governed
instruction paths during a separately authorized rollout.
