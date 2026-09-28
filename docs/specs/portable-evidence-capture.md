# Record and check a complete verification run

Status: local candidate implementation. No activation or publication.
Prepared: 2026-09-28. Baseline: `6d5ced4`.
Design: no.

## Problem Statement

The existing checker checks supplied evidence but permits incomplete claims and another spec's claims. There is no supported capture command. Add a candidate recorder/export/check path while preserving version 1 and refusing version 2 on production adapters until later policy work.

## Seams

S1 is the public command line in synthetic Git repositories. Tests use `test/portable-evidence.test.mjs`; the capture stage of `test/portable-evidence-walk.mjs` measures this increment. No real hooks, enrollment, external records, pushes or restarts.

## Acceptance Criteria

| AC | Requirement (EARS) | Red test, fixture, and the mutation that proves it red | Observable on the real surface | Judge |
|---|---|---|---|---|
| AC2 | When a version 2 proof is checked, the checker shall require exactly one supported claim for every live criterion of that proof's own spec. | Same test file, `complete-claims`: spec A has AC1 and AC2, spec B has AC1. Omit AC2, duplicate AC1, add AC3, or substitute B's claim. Baseline accepts supplied-only/wrong-spec cases under version 1. Mutate complete-set or same-spec comparison away and prove the corresponding case fails; complete A passes. | S1: refusal names omitted/duplicate/extra criterion or wrong spec; the corrected manifest exits 0. | `complete-claims` CLI fixture. |
| AC3 | When an approved check is captured, the recorder shall execute its exact command on the recorded clean revision and preserve output, input bindings, limits and outcome without converting a failure into success. | Same test file, `capture`: a synthetic command prints `value=14`, with empty stderr; variants exit 3, time out at the fixture's 100 ms limit, exceed its 1024-byte limit, change a selected input, or differ from approval. Baseline has no capture path. Mutate outcome export to success or input checking off and prove failures are detected. | S1: actual capture artifacts contain the observed bytes and revision; failed variants produce failure records and cannot support a claim. | `capture` CLI fixture and independent replay. |
| AC4 | When version 2 records are exported and checked, the checker shall retain exact revision, spec, output and judgment bindings, and identify the checker code used. | Same test file, `v2-bindings`: export a real capture, then change one output byte, rebase, change code after review, substitute a run/judge, or edit a selected input. Version 2 is unsupported at baseline. Mutate a v2 digest/revision check and prove the affected refusal fails. Valid proof-only follow-up passes. | S1: committed-object check names the changed binding; valid v2 exits 0 with a fingerprint covering all decision modules. | `v2-bindings` CLI fixture. |
| AC8 | When a version 2 judgment claims support, the checker shall require resolved distinct author/verifier session records and a concrete observation, and shall report local provenance as unauthenticated. | Same test file, `judgment-limit`: author session A and verifier V review one executed assertion. Same-session, absent identity, zero-test, skipped-test, and unsupported judgments refuse. Baseline v1 treats identity as display text and allows exit-zero records without these observations. Mutate identity/observation enforcement away, or remove the provenance disclosure, and prove the relevant assertion fails. | S1: refusal names the missing/invalid judgment; valid output states records checked and actor provenance unauthenticated. | `judgment-limit` fixture and independent replay with a zero-test run. |
| AC12 | When the capture and binding increment is verified, the verification process shall report paired baseline/candidate outcomes and runtime for the same declared cases, including incomplete claims, wrong specs, altered output and same-session judgment. | The capture stage of `test/portable-evidence-walk.mjs` writes a raw case ledger for baseline and candidate revisions. Baseline has no such paired impact record. Mutate a case result or drop a denominator from a throwaway report and prove the independent receipt check rejects the summary. | S1: the proof reports invalid cases accepted out of attempted, valid cases refused out of attempted, automatically captured records, and timed repeats, with raw observations and missing baseline capabilities disclosed. | Independent Evidence review recomputes the capture impact table from the saved raw runs. |

## Necessary parent requirements


The recorder receives a reviewed command description, task/spec identity, criterion mapping, expected result, selected input list, author/verifier session identities, time and output bounds, and exact revision. Approval is a record of permission already granted by the workflow, not a new prompt for each run. The recorder must reject a command or selected input that differs from that approved description.

Run in a separate verification worktree at the recorded revision. The selected tracked inputs must be clean before the run and unchanged afterward. Record input digests before and after, command arguments, repository-relative working directory, start/end time, outcome, exit status, stdout, and stderr. Keep actual zero-length files for empty streams. Record timeouts, interruption, missing commands, output overflow, and dirty inputs as failures or unsupported observations, never success. Stop only processes started by that capture.

Keep output outside the verification checkout while the command runs, then export it under the existing proof-artifact location. Capture does not commit, push, activate hooks, or update external records. A failing command must leave a usable failure record. Output that cannot safely be included must leave the criterion unsupported until an approved safe rerun supplies evidence; silently edited output is not the original capture.

Do not hardcode one test runner's output as a universal success detector. For a test claim, require the verifier to identify the named tests that actually ran and the assertion that decided the result. A zero-test or skipped-test run cannot support that claim. Unknown formats remain unsupported until a verifier supplies a concrete observation; exit zero alone is insufficient.

#### Version 2 evidence

Write the recorder and checker against the same new contract. Preserve the existing version 1 meaning for legacy policy. Version 1 cannot satisfy a policy that requires version 2; removing the evidence field cannot downgrade that policy. Unknown versions refuse with a diagnostic.

Version 2 must carry these facts. Exact field spelling and command options belong to the implementation contract and must be documented together before the first implementation commit.

| Record | Required facts and binding |
| Manifest | Version, task, proof's spec and blob, review base, reviewed revision, effective policy identity, recorder/checker identity, and local provenance limit. |
| Claim | Exactly one entry for each live criterion of that spec; supported/unsupported state; references to its execution, judgment, oracle, and any required red/golden evidence. Extra, duplicated, omitted, or other-spec claims refuse. |
| Command approval | Exact argument list, working directory, selected inputs and digests, expected outcome, resource bounds, approving actor/session and source of authorization. |
| Execution | Unique run id; approval reference; role such as red, green, or reproducer; actual revision; executor session; before/after input digests; start/end time; outcome and exit; raw output paths, lengths and digests. |
| Judgment | Unique id; author and verifier session references; criterion/spec/base/revision bindings; exact execution and output digests; observed assertion; supported/unsupported verdict and reason. |
| Oracle review | Expected answer, its source and digest, independent review of why it follows from the requirement, and the criterion/input bytes that review covers. |
| Red evidence | A real failing execution, expected symptom and matching observation, connection to the green run, and an explicit reason if a red run does not apply under the task's approved verification plan. |
| Golden review | Changed expected-output paths and old/new digests; approval reason, reviewer, and criterion. Approval covers those exact bytes, not future regenerations. |

For an attached proof, every claim must refer to that proof's spec. Require one supported claim per live criterion. Each record reference must resolve unambiguously. Record ids and actor labels are not signatures.

Retain the existing exact-revision and committed-byte checks in version 2. Green runs and their judgments bind to the reviewed commit. Afterward, only the already permitted ordinary proof artifacts may be added or edited. Rebase, code/spec changes, altered output, changed selected inputs, or a stale golden review require new evidence. Include all checker decision code in its reported fingerprint when adding modules.

A red run is deliberately nonzero and belongs to its own recorded baseline or throwaway control revision. It is not a successful run on the final code. The verifier must match the failure to the criterion's symptom. A syntax error, missing dependency, timeout, or unrelated assertion does not prove the intended red. Preserve the spec and oracle identity across red/green comparison; the old implementation need not already contain the newly written spec. Describe any controlled test overlay and bind its bytes explicitly.

Approval of a changed golden must precede its use in the supporting verification. A later edit invalidates that approval. The checker verifies that the required reviews and byte bindings exist; the independent verifier judges whether the expected answer and symptom are correct.

#### Trust and workflow integration

Reject records where the recorded author and verifier are the same session, required identities are absent, or references do not resolve. The recorder assigns execution ids and records the session metadata supplied by the integration. The current Claude integration can retain its raw JSON result and bind the returned `session_id`; hook input also exposes `session_id` if a later hook adapter is added. Require that source record, not only a typed display name, and bind the approval to the same recorded session and command. A user-supplied name, another local directory, a different process, or matching hashes cannot authenticate independence. A same-user agent can rewrite local records or bypass local hooks. Document that limitation in the command's success output and the workflow instructions.

Update the existing implementation, TDD, and code-review procedures in their owning repository to use the supported recorder and checker. This spec defines their shared interface; their actual edits need that repository's saved spec, worktree, reviews, and proof. Keep the manual procedure available when capture is unavailable, with an explicit unverified status. It cannot satisfy a landing policy requiring version 2.

The recorder's acceptance judgment does not replace the required pre-commit review rounds, project receipt, delivery review, or live end-to-end proof. Each stage keeps its own owner and evidence. Instructions must preserve those walls and identify which records belong to which stage.

Git blocking applies to covered reference updates and pushes where the hook runs. It does not stop arbitrary claims in chat, govern another machine, or install remote branch protection. A Claude Stop or TaskCompleted integration is a separate scope, not an implied part of this spec.


## Implementation contract

- `spec-lock capture <approval.json> <scratch-directory> [-- <argv...>]` reads a reviewed approval outside the verification checkout. Explicit argv must match exactly. It creates a detached clean verification worktree at the full approved revision. Output stays in the scratch directory. It never commits. Exit 0 requires exited/0 with unchanged inputs; failed execution exits 1 and keeps its record. Invalid approval exits 2 before execution.
- `spec-lock export <scratch-directory> <judgments.json> <proof-directory>` copies captured bytes and supplied judgments into an absent directory beneath `docs/proof/` and writes `manifest.json`. It preserves failures as unsupported claims. It does not endorse judgment semantics or run commands.
- `spec-lock check-candidate <old> <new>` is the only opt-in v2 reader in this increment. The regular check and Git adapters refuse v2. Its output identifies candidate binding checks, deferred semantic/policy checks and unauthenticated actor provenance. Version 1 remains unchanged.
- Approval fields: `version: 2`, `id`, `task`, `spec`, `spec_blob`, `base`, `revision`, `criteria`, `argv`, `cwd`, `inputs: [{path, sha256}]`, `expected: {exit, stdout}`, `limits: {timeout_ms, output_bytes}`, `author`, `verifier`, `approved_by`, `authorization`, `sessions: [{id, source: {session_id, ...}, source_raw}]`, `role`. Session `source_raw` is the exact JSON text supplied by the integration and must parse to `source`; it is exported byte-for-byte, with `session_id` resolving the supplied id. Approval and judgments are local records, never authenticated identities.
- Paths are repository relative with no traversal. The input list is nonempty and paths are unique tracked regular files. Individual input files may be zero bytes. Bounds are explicit integers: 1..3600000 milliseconds, 1..16777216 combined output bytes. No implicit defaults. `cwd` is `.` or an existing directory inside the clean worktree. Shell execution is never implicit. POSIX process groups stop descendants that retain the group; unsupported platforms refuse capture. The recorder closes pipes at the deadline even if a child escapes the group. Approved checks must not daemonize: escaped detached processes are outside the cleanup guarantee, and this is not a process sandbox. Commands remain authorized trusted local programs, not sandboxed adversarial code.
- Scratch contains `capture.json`, `stdout`, `stderr`. The capture holds approval bytes/digest, unique run id, revision, executor, role, argv/cwd, before/after input hashes and checkout revision/status, start/end timestamps, monotonic duration, outcome, exit, signal, `expected_match`, limits, and output byte lengths/digests. Outcomes include exited, timeout, interrupted, spawn-error, output-over-bound, tracked-files-changed and inspection-failed. Empty streams remain real zero-byte files. Overflow retains the bounded prefix and is unsupported.
- Only `green` executions whose actual exit and exact stdout match approval can support a claim. `red` and `reproducer` records remain unsupported direct claims for later semantic linking. Expected nonzero executions retain their actual exit and always remain failed for direct claim support.
- Exported manifest fields retain v1 `task`, `base`, `reviewed`, `claims`, `runs`, `judges`; add `version: 2`, `spec`, `spec_blob`, `policy: candidate-bindings-v2`, `recorder`, `checker`, `provenance: unauthenticated`, `approvals`, `sessions`, `oracle_reviews`, `red_evidence`, `golden_reviews`. Claims add `oracle`, `red`, `golden` references, nullable/empty pending later semantic validation. Each judgment binds spec/blob, author/verifier session, ac, base/revision, run, a `run_sha256` over its JSON with object keys sorted by code-unit order and stdout/stderr descriptors reduced to bytes/sha256, and stdout/stderr digests, verdict, reason, and `observation: {kind, tests, executed, skipped, assertion, expected, observed}`. A supporting test observation needs named tests, positive executed count, zero skips and concrete assertion/expected/observed text. No universal runner-output parser is claimed.
- Oracle records carry id, criterion/spec/input bindings, expected answer, source/digest, reviewer and reason; red records carry run, green run, symptom, observation, reviewer or approved non-applicability reason; golden records carry paths, old/new digests, reviewer, reason and approval time. These fields are carried but semantic checks belong to the next task. No claim of completed source contracts follows from their presence.
- The checker validates committed bytes only and never runs manifest commands. Reuse existing exact revision and proof-only follow-up rules. Fingerprint includes CLI plus every decision module. Author and verifier must resolve to distinct retained source records, and approval, execution and judgment agree on verifier.

## Approaches checked

On 2026-09-28, compared Node's [spawn and execFile APIs](https://nodejs.org/api/child_process.html) and Git's [detached worktrees](https://git-scm.com/docs/git-worktree). Buffered execFile needs less stream code but makes precise combined bounds and descendant cleanup harder. Spawn needs explicit lifecycle handling but supports exact argv, bounded streams and owned process groups. Choose spawn and a detached worktree, using only the standard library. No service cost; measure local runtime overhead.

The parent compares shared Git checking with caller-specific completion hooks. This increment keeps shared capture/checking and defers completion hooks, remote enforcement and consumer procedures. A worktree is isolation of files, not write prevention or authenticated independence.

## End-to-end verification

Before implementation, freeze `test/portable-evidence-cases.json` and save three timed baseline runs for the same logical cases in `docs/proof/portable-evidence-capture/baseline.json`. Comparable v1 cases use the original format; absent capture is a capability gap, never a false acceptance. Candidate measurements use real capture/export/check, retain raw commands, exits, stdout/stderr, denominator and runtime median/range. All runs use synthetic inputs and scratch HOME, Git config and logs with inherited Git/recorder variables removed. Fixture commits use the machine's configured identity.

Run `node test/portable-evidence-walk.mjs` for capture-stage evidence, targeted tests and the full offline suite through the machine-wide suite wrapper. Run throwaway mutations for complete-set/spec, outcomes/inputs, revision/digests, identities/observation/disclosure and impact receipts. Independent Evidence review recomputes outcomes and overhead, including missing capabilities and unavailable token/cost data. Two required pre-commit review rounds, Codex high then Opus 5.5 high, precede the implementation commit; run final committed code live and add proof-only follow-up. CLI-only work has no browser suite or video.

## Non-goals

Required v2 policy, selected repositories, semantic red/oracle/golden enforcement, Claude consumer changes, protected-test writes, generic reply interception, authenticated identity, real activation and publication. Existing documentation, initial-commit and imported-content exceptions remain. Candidate success is a binding check only.

## Open questions

None blocking this local implementation. Later activation owns exact repositories and governed instruction paths.

## Review contract update

On 2026-09-28 the owner replaced the review rule during implementation. Odd rounds use Codex at high effort; even rounds use Opus 5.5 at high effort with fallback disabled and modelUsage checked. This supersedes the earlier xhigh wording. Record exact commands and capacity fallbacks in the proof.

### Reserved semantic record fields

These fields are carried for the next increment, not validated as semantic proof here.

- `oracle_reviews`: objects with `id`, `ac`, `spec`, `spec_blob`, `revision`, `inputs: [{path, sha256}]`, `expected`, `source: {path, sha256}`, `verifier`, `verdict`, `reason`.
- `red_evidence`: objects with `id`, `ac`, `spec`, `spec_blob`, `red_run`, `green_run`, `symptom`, `observation`, `verifier`, and `not_applicable`, either null or `{approval, reason}`.
- `golden_reviews`: objects with `id`, `ac`, `spec`, `spec_blob`, `base`, `revision`, `paths: [{path, old_sha256, new_sha256}]`, `verifier`, `verdict`, `reason`, `approved_at`.

A claim's `oracle` and `red` fields reference those ids or are null; `golden` is a list of ids. Later work supplies and checks these records without changing their meanings.
