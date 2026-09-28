# Require meaningful failure and expected-result evidence

Baseline: `068dcdd428ddc029b4ccad8c2e4285da62fc7aea`. Design: no.

## Problem Statement

Candidate binding checks accept claims without checking the recorded reason that a
failure demonstrates the defect or the source of the expected answer. Saved expected
output can change without a review of that change. Add explicit semantic-record checks
while preserving the existing binding-only candidate and version 1 contracts.

## Seams

S1 is the real capture, export and checker CLI in isolated synthetic repositories.
The approved task already selects this seam. No real hooks or accounts are changed.

## Acceptance Criteria

| AC | Requirement (EARS) | Red test, fixture, and the mutation that proves it red | Observable on the real surface | Judge |
|---|---|---|---|---|
| AC5 | When a criterion requires red/green evidence, the checker shall require linked red and green records plus a verifier judgment identifying the intended failure and the successful correction. | Same test file, `red-green`: `double(7)` first returns 0, then 14; assertion expects 14. Replace the intended red with a syntax error, missing dependency, omitted red, or unlinked failure. Baseline v1 has no red obligation. Mutate the red-review requirement away and prove refusal assertions fail. | S1: missing or rejected symptom review refuses; recorded intended red with reviewed green passes. | `red-green` fixture; independent verifier judges the raw symptom. |
| AC6 | When a claim relies on an expected answer, the checker shall require an oracle review bound to the criterion and selected expectation bytes. | Same test file, `oracle`: requirement says doubling 7 yields 14; run prints 14. Remove the expectation source/review, substitute bytes after review, or attach a review rejecting a code-derived expectation. Baseline accepts a supported v1 judgment without these records. Mutate oracle binding enforcement away and prove the cases fail. | S1: refusal identifies missing, stale or unsupported oracle review; reviewed requirement-derived expectation passes. | `oracle` fixture; independent verifier judges expectation source. |
| AC7 | When selected golden files change, the checker shall require approval of the exact old/new bytes before those bytes support the verification. | Same test file, `golden`: expected output changes from 0 to 14 with recorded reason. Omit approval, attach one for 13, or alter the golden after approval. Baseline v1 requires none. Mutate approval matching away and prove refusal assertions fail; the approved 14 fixture passes. | S1: capture/export/check refuse unsupported golden changes and accept the separately reviewed exact bytes. | `golden` fixture; independent reviewer judges the approved change. |
| AC13 | When the meaningful-evidence increment is verified, the verification process shall report paired outcomes and runtime for the same intended-red, unrelated-failure, oracle and golden cases before and after the change. | The semantic-evidence stage of `test/portable-evidence-walk.mjs` records the prerequisite revision and candidate revision against the same logical cases. Baseline lacks the newly required refusals. Mutate an unrelated-failure case into an asserted pass in a throwaway summary and prove receipt review detects it. | S1: the proof names new observed refusals, valid controls that still pass, false acceptance/refusal counts, and measured overhead. | Independent Evidence review recomputes the semantic-evidence impact table from saved raw runs. |

## Implementation contract

Use `check-semantic <old> <new>` for the stronger candidate check. It runs all existing
binding checks plus the rules below. `check-candidate` remains explicitly binding-only;
normal check and Git adapters still refuse version 2. Required policy is later work.
Stripping semantic records never makes `check-semantic` accept a binding-only manifest.

Command approvals optionally carry `semantic`, version 1, with `criteria`, one per
approved criterion, and `goldens`, the selected expected-output paths. Each criterion
has `ac`, `red_required`, and a reason if red is not required, plus `oracle` review.
The oracle has a unique id, criterion, reviewer matching the verifier, supported verdict,
reason, expected string, and `expectation` and `source` objects naming selected tracked
paths and SHA-256 bytes. Source kind is requirement, reference or approved-fixture;
code-derived is not support. Every semantic claim requires an oracle, even when red
is explicitly not applicable. The reviewed source and expectation must be selected
inputs at the green revision. The checker verifies bindings; it cannot establish that
prose follows from the requirement without the verifier's judgment.

The semantic approval also has `golden_reviews`. Each changed selected golden needs
an exact path, nullable old digest for an addition, nullable new digest for deletion,
criterion, reviewer, supported verdict, reason and approved_at timestamp. The recorder
checks base/revision bytes before starting. The checker independently compares those
committed bytes and requires approval no later than the supporting run's start. An
unchanged selected golden needs no change approval. Unknown paths, duplicates and
changed reviews are refused. The selected list is the verifier-approved scope; it is
not automatic discovery of every possible snapshot in a repository.

Export continues to accept the legacy judgment array. For semantic work its second
file contains `{judges, red_captures}`. Each red capture entry has a scratch directory
and per-criterion reviews. Export copies actual approval, session and output bytes
under proof artifacts, never scratch paths. A red review names id, ac, oracle id,
green run and hash, red run and hash, reviewer, supported verdict, failure_kind
`assertion`, expected symptom, observed symptom and correction reason. The expected
symptom must occur verbatim in captured red output. Syntax, dependency, timeout and
unrelated failures with rejected or mismatched reviews refuse. A typed label is not
an authenticated or automatic semantic decision.

Red runs must be captured nonzero ordinary exits, match their own approved expected
outcome, retain clean status and exact input/output bindings, and precede green.
Red and green bind the same spec bytes, oracle source, expectation and test inputs.
Different implementation bytes are allowed at the red revision. A controlled revision
may add the new spec and test to old code, but its approval must identify `control`
with original baseline and exact overlay paths/digests; all differences from that
baseline must be listed, and every overlay byte must match the green revision.
The final checker reads committed objects only and never executes manifest commands.

Claim oracle/red/golden references come from these exported records and resolve once.
The semantic manifest still uses version 2 and candidate-bindings-v2 for compatibility;
the stronger command explicitly selects the additional interpretation. The existing
fingerprint includes every decision module. No unauthenticated provenance claim changes.

## End-to-end verification

Create a synthetic requirement that double(7) equals 14. Commit the test, independent
source and expectation before capturing broken code returning 0, then capture the
repair returning 14. Export actual red and green output with separately supplied
reviews. Commit proof-only records and check the exact candidate. Repeat with omitted
red, unlinked red, syntax/dependency failure, absent/rejected/stale oracle, missing
or wrong golden approval and a later golden change. Exact reviewed positive controls
pass. Preserve prerequisite capture tests and run the full offline suite through the
machine's configured full-suite wrapper. No browser or video applies.

Before production changes, freeze all semantic cases and three repetitions. Run the
same records through the prerequisite binding checker, saving exact fixture input
bytes and output artifacts before cleanup. Candidate runs use check-semantic; absent
commands are capability gaps, never counted as false acceptances. Retain per-case
raw timings, medians and ranges, denominators, automatic capture counts and unavailable
usage as null. Independent Evidence review recomputes the paired result. Tamper with
a saved outcome and prove receipt checking refuses it. Remove red/oracle/golden guards
only in throwaway copies and observe each relevant test fail.

## Alternatives and sources

Checked 2026-09-28. Node's [test runner](https://nodejs.org/api/test.html) can report
execution and skips; parsing its reporter would add runner-specific code and still
not decide whether a failure proves the intended defect. Explicit verifier judgments
plus [assertion output](https://nodejs.org/api/assert.html) preserve the semantic
responsibility and work across runners, at the cost of review effort. Choose that
existing parent-spec approach. Both use local tools with no added service fee.
[Git blob reads](https://git-scm.com/docs/git-cat-file) supply the committed bytes;
working-tree reads alone could accept later edits. Runtime is the installed Node 22.

## Non-goals

Activation, selected repository policy, remote publication, authenticated reviewers,
write prevention, chat interception, a universal failure parser, and the Claude consumer.
No result establishes reliability outside the frozen synthetic corpus.

## Open questions

None blocks the authorized local increment. Review rounds use Codex high then Opus 5.5
high, with further rounds only for actual bugs under the current owner contract.
