---
tags: [portable-evidence, policy, cli, selected-repositories]
date: 2026-09-28
issue: local-selected-repository-enforcement
spec: docs/specs/portable-evidence-policy.md
walked: 93f9870f2f981ac72767a1176fbbc778739c297e
---
# Enforce complete evidence in selected repositories

Selected local Git operations now require complete version 2 capture and semantic
records. Inventory alone never selects a repository. Linked worktrees share their
common repository's selection. This is a local, unmerged implementation. No production
activation, publication, push or remote workflow change occurred.

Source commit: `93f9870f2f981ac72767a1176fbbc778739c297e`. Comparison prerequisite:
`6a0d7e5f3c306357f07a4d1fe6bba343fcc48375`. Only proof files follow the source commit.
The committed spec carries AC1, AC9, AC10 and AC14. Design: no; this CLI change has no
browser, Design-review or video stage.

## What I walked

| AC | Assertion and independent expected source | Observed result |
|---|---|---|
| AC1 | The saved spec requires missing/v1/invalid records and wrong owner-policy bindings to refuse; complete captured v2 must pass. `required-version`, owner-edit and fingerprint tests invoke the real CLI and Git adapters. | Supported. Missing, legacy, invalid and wrong-policy records refuse; complete captured evidence passes. Exact-byte fingerprint and stale-owner tests pass in the 66-test replay. |
| AC9 | Explicit selected scope must cover the common repository and linked worktrees. Distinct inventory B must remain outside selection; preview must preserve owner bytes, timestamp and Git config. Missing or malformed selected settings must refuse. | Supported. Selected and linked operations agree; distinct inventory and read-only preview tests pass. All 9 unselected attempts pass, including the separate no-Node regression. |
| AC10 | The same candidates must receive matching CLI, merge and pre-push decisions and identities. Bad Git attempts preserve their target; valid ones move it. Documentation, first-commit, pulled-content and legacy exceptions remain as specified. | Supported. All 114 baseline/candidate policy observations have consistent exits and Git tips. Final covered routes report checker `0.0.0+c99111627faa`; exception and parser regressions pass. |
| AC14 | The frozen list requires 57 actual attempts, three repeats per case. Recompute exits, tips, counts and medians. Unsupported baseline v2 is a separate capability gap; altered scope results or missing denominators must fail receipt checking. | Supported. Independent counts and every timing group match the saved receipt; actual receipt tampering tests refuse changed scope output and missing denominators. |

Final execution records are under [final-verifier](https://assets.agee.dev/evidence/spec-lock/bd3b4b1e2d30f33c06dbbb8b4b611b48/report.md).
The report names each test, assertion, oracle source and actual output. The four approved
commands and complete stdout/stderr are bound in
[execution metadata](https://assets.agee.dev/evidence/spec-lock/d8ab3ef78aef702d6a2a5cf574c6c976/execution-metadata.json).

## Independent commit replay

Procedure: independent manual rerun. Author session
`01a0e87d-1020-7d73-907e-4f3d1b1a6a92`; verifier session
`01a0e947-29ea-78d3-bf44-8028e89635ae`. The verifier used a separate detached checkout
at the full source commit. All four commands exited 0 within their time limits. Before and after each command,
HEAD matched the source commit, Git status was empty and all 46 approved input hashes
matched. The parent separately verified all eight states and captured output hashes.
The replay passed 66 tests with no skips and 132 walk observations. It used Node
v26.7.0 and Apple Git 2.54.0; all 78 captured checker lines matched the independently
computed fingerprint `0.0.0+c99111627faa`.

The verifier approved the exact final regression replacements against the corrected
spec and four review reports. Frozen case-list, fixture, walk and baseline bytes still
match their pre-implementation hashes. Regression tests changed to cover observed
review defects. Runtime and configuration identities are recorded without treating
clean Git status as complete input identity. Session records remain unauthenticated.

The approved commands, run from the verifier checkout, were:

```sh
node --test test/portable-evidence.test.mjs test/semantic-evidence.test.mjs test/policy-evidence.test.mjs
node test/portable-evidence-walk.mjs all "$VERIFIER_RECORDS/all-walk"
node test/policy-receipt.mjs docs/proof/portable-evidence-policy/baseline.json "$VERIFIER_RECORDS/all-walk/policy.json" "$VERIFIER_RECORDS/impact.json" write
node test/policy-receipt.mjs docs/proof/portable-evidence-policy/baseline.json "$VERIFIER_RECORDS/all-walk/policy.json" "$VERIFIER_RECORDS/impact.json"
```

The public metadata aliases host paths; the private execution record retains literal
host commands. The bounded commands allowed only temporary synthetic Git operations
and records outside the checkout. They did not authorize real activation or publication.

## Measured impact

| Measure | Prerequisite | Final candidate |
|---|---:|---:|
| Applicable invalid attempts accepted | 24/24 | 0/36 |
| Applicable valid attempts refused | No applicable v2 baseline | 0/12 |
| Unselected operations blocked | 9/9 | 0/9 |
| Unsupported v2 attempts | 24 | 0 |

The baseline's 24 unsupported v2 attempts split into 12 invalid and 12 valid cases.
They are neither invalid acceptances nor valid false refusals. Its applicable valid
v2 denominator is zero. All frozen selected and unselected cases retain their labels;
Git target movement must agree with command exit. Raw baseline is
[baseline.json](https://assets.agee.dev/evidence/spec-lock/6443c945bf0316d9dada9a36b18e7f7d/baseline.json), final candidate is
[policy.json](https://assets.agee.dev/evidence/spec-lock/bc9c154a68148e07f9f17f43325f7b6b/policy.json).

| Operation | Old accepted proof median | Required v2 median | Added median |
|---|---:|---:|---:|
| CLI | 461.7 ms | 1301.7 ms | 840.0 ms |
| Local merge | 612.4 ms | 937.4 ms | 324.9 ms |
| Pre-push | 387.3 ms | 817.6 ms | 430.3 ms |
| Linked worktree merge | 524.6 ms | 993.6 ms | 468.9 ms |

This supplemental cross-format comparison uses the baseline's accepted legacy proof
and the candidate's complete v2 proof after checking identical non-proof code/spec/test
bytes. It does not relabel frozen cases. The literal baseline-v2 timing measures a
schema-refusal route, not complete valid verification. Three repeats have no forced
cache or load control; repeats 1 and 2 are labeled warm. Capture/export time is outside
these operation timings. No production reliability or whole-workflow speed claim follows.
The independent recomputation retains per-case medians and ranges.

Whole-task token usage and cost are unavailable. The two Opus review responses report
$5.5318286 combined provider cost; this is partial usage, not the task's total cost.

## Tests, failures and controls

The author ran the full suite through the shared full-suite wrapper. Final output is
[full-suite-completion.txt](https://assets.agee.dev/evidence/spec-lock/d35697c95e897052a13f62786546fee8/full-suite-completion.txt):
96 tests, 95 passed, zero failed, one opt-in remote canary skipped. No remote canary
operation was authorized. The independent replay above runs the acceptance tests again
on the committed source. The ordinary committed-range check also printed `spec-lock: ok`
and checker `0.0.0+c99111627faa`; see [source-commit-check.txt](https://assets.agee.dev/evidence/spec-lock/6fd2adbf28e536023c9e10b3c225dc05/source-commit-check.txt).

Five throwaway-copy controls remove required policy, the unselected bypass, pre-push
enforcement, manifest policy binding and inventory/selection separation. Each failed
its intended assertion. [mutations.json](https://assets.agee.dev/evidence/spec-lock/2ba03fefd5530994bf3a9a8ba30bbca7/mutations.json) links
exact patches, source/mutated hashes and transcripts. The final source map is
[completion-source-hashes.json](https://assets.agee.dev/evidence/spec-lock/56ed757ce917796c894f7bf36c1097b9/completion-source-hashes.json).
The verifier checked these records and reconstructed patch hashes in memory; it did
not independently rerun historical controls. `controls-development/` is an older generation.

| Repair stage | Symptom-bearing red | Green and final reproducer |
|---|---|---|
| Required policy and adapters | [`red-required.txt`](https://assets.agee.dev/evidence/spec-lock/6c5bb1ea604f26a291b72ab5da888a1c/red-required.txt), [`red-adapters.txt`](https://assets.agee.dev/evidence/spec-lock/f9f000183c5b4a5dd1af29154c57a293/red-adapters.txt) | Required-version, adapter-policy and inventory tests in the final replay |
| Documentation prose exemption | [`red-doc-proof.txt`](https://assets.agee.dev/evidence/spec-lock/597bf563d7773a2dc98e6b138c6441dc/red-doc-proof.txt) | Documentation exception in the final replay |
| Review 1: parser/scope/documentation defects | [`red-review-1.txt`](https://assets.agee.dev/evidence/spec-lock/d5a791dcf14bb0d500a501ea324ef0c1/red-review-1.txt), corrected [`red-doc-v1.txt`](https://assets.agee.dev/evidence/spec-lock/8c9592cd4b52542a298fc077cc99ee4d/red-doc-v1.txt) | [`green-review-1.txt`](https://assets.agee.dev/evidence/spec-lock/90941ad8aa91e192cbc9bd8c0a63026f/green-review-1.txt), final review-one regressions |
| Review 2: case identity, CR/bare-keyword/includes | [`red-review-2.txt`](https://assets.agee.dev/evidence/spec-lock/c8650429cddf490db1e54510400f7926/red-review-2.txt), [`red-cr-comment.txt`](https://assets.agee.dev/evidence/spec-lock/052256df1699bf7633dbd6b32c6e1aa3/red-cr-comment.txt) | [`green-review-2.txt`](https://assets.agee.dev/evidence/spec-lock/f600c62d925e9ee0f8d7b55766009e9c/green-review-2.txt), final review-two regressions |
| Review 3: legacy reactivation and NUL bytes | [`red-review-3.txt`](https://assets.agee.dev/evidence/spec-lock/6144fec2a577eebfb5df501a0b645f87/red-review-3.txt) | [`green-review-3.txt`](https://assets.agee.dev/evidence/spec-lock/46f3b42ac20a932aa6631cabf8d884c4/green-review-3.txt), final review-three regressions |
| Review 4: Unicode separators, exact bytes and LF discovery | [`red-review-4.txt`](https://assets.agee.dev/evidence/spec-lock/e09d07cbd4ed36924a1021e1c3f2a804/red-review-4.txt) | [`green-review-4.txt`](https://assets.agee.dev/evidence/spec-lock/8285213c2cf61844c8525dcdc90b7d73/green-review-4.txt), final review-four regressions |

All listed files are under `portable-evidence-policy/`. Reviewed source hash maps
identify each pre-fix generation. The initial documentation-v1 red had a missing
fixture object; it is excluded and replaced by the symptom-bearing [`red-doc-v1.txt`](https://assets.agee.dev/evidence/spec-lock/8c9592cd4b52542a298fc077cc99ee4d/red-doc-v1.txt).
An initial owner-edit test wrongly expected Git's refusal exit to equal the CLI's 1;
Git correctly refused with 128. That assertion-only mistake is excluded from production
bug counts. [`red-preview.txt`](https://assets.agee.dev/evidence/spec-lock/527dfe0be5350760754d37c411c1948c/red-preview.txt) records an absent-command capability gap, not a
symptom-bearing defect red. The inventory-enrollment control supplies the behavioral
scope failure. Final tests rerun the corrected reproductions.

## Review ownership

Four code-review rounds used the fixed prerequisite. All observed defects were repaired.
No fifth broad review ran. The final formatting repairs received targeted regressions,
the full suite and independent approval of their exact replacement inputs.

| Round | Owner | Result and receipt |
|---|---|---|
| 1 | Codex gpt-6-astra, high | One Standards violation, five Spec defects and one preview coverage gap; [review-1.md](https://assets.agee.dev/evidence/spec-lock/a76e91a042e3c13f8dcc3cb71541306a/review-1.md) |
| 2 | Claude Opus 5.5, high | Two Standards violations, four Spec defects and coverage gaps; [review-2.md](https://assets.agee.dev/evidence/spec-lock/abfa80d2479fa70e50a8b6fff651a764/review-2.md) |
| 3 | Codex gpt-6-astra, high | Zero Standards findings, two Spec defects, zero additional Evidence findings; [review-3.md](https://assets.agee.dev/evidence/spec-lock/21c069f676a28842a7b42b53a5a98974/review-3.md) |
| 4 | Claude Opus 5.5, high | Zero Standards violations, two P3 Spec defects, no new hard Evidence finding; [review-4.md](https://assets.agee.dev/evidence/spec-lock/a1fa6d4becc1e1ac64939d0893391670/review-4.md) |

Both Claude receipts name only `claude-opus-5-5`. Request snapshots and exact reviewer
source hashes are retained. Commands used, with only private record directories aliased:

```sh
codex exec --skip-git-repo-check --model "${AGENTS_REVIEW_MODEL:-gpt-6-astra}" -c model_reasoning_effort="high" -o docs/proof/portable-evidence-policy/review-1.md "$(cat docs/proof/portable-evidence-policy/review-request.txt)" < /dev/null > "$REVIEW_RECORDS/review-1.raw.txt" 2>&1
PATH="$HOME/.local/bin:$PATH" CLAUDE_CODE_NO_MODEL_FALLBACK=1 CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK=1 claude -p --model claude-opus-5-5 --effort high --output-format json "$(cat docs/proof/portable-evidence-policy/review-request.txt)" < /dev/null > "$REVIEW_RECORDS/review-2.json"
codex exec --skip-git-repo-check --model "${AGENTS_REVIEW_MODEL:-gpt-6-astra}" -c model_reasoning_effort="high" -o docs/proof/portable-evidence-policy/review-3.md "$(cat docs/proof/portable-evidence-policy/review-request.txt)" < /dev/null > "$REVIEW_RECORDS/review-3.raw.txt" 2>&1
PATH="$HOME/.local/bin:$PATH" CLAUDE_CODE_NO_MODEL_FALLBACK=1 CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK=1 claude -p --model claude-opus-5-5 --effort high --output-format json "$(cat docs/proof/portable-evidence-policy/review-request.txt)" < /dev/null > "$REVIEW_RECORDS/review-4.json"
```

There is no additional project-specific review receipt. Delivery review and rollout
checks remain required before an eventual authorized landing; this local commit waives none.

## Limits and retained records

- Owner settings and records are editable by the same user. Hook bypass and trusted
  remote-default refs remain. No authenticated actor identity or protected-write boundary exists.
- Every owner-file byte edit, even a comment, invalidates pending exports across all
  selected repositories. Exports must be recreated for the new policy identity.
- Missing or malformed selected settings refuse every head update before scope/branch
  filtering, including unselected feature commits and garbage-collection ref packing.
  Moving or deleting a selected repository can trigger this condition. Happy-policy
  measurement denominators do not cover recovery from that condition.
- Supported hook registration is global, as rollout writes it. Manually placing selected
  registration only in system or repository-local config may split missing-policy behavior;
  this is a reading-based concern, not an observed probe of the supported rollout.
- Documentation, first-commit and previously landed/pulled-content exceptions remain.
  In code landings every touched top-level proof needs v2, including edited older proofs.
- Shell and Node readers remain separate so unselected hooks work without Node. The
  shared regression cases check their decisions. Generic reply/claim interception and
  the Claude workflow consumer remain outside this increment.

Files named `*-final` outside `final-verifier/` are the pre-round-4-repair author
measurement generation. [`full-suite-completion.txt`](https://assets.agee.dev/evidence/spec-lock/d35697c95e897052a13f62786546fee8/full-suite-completion.txt) and `final-verifier/` identify final
source results. Other earlier generations are retained as history, not substituted for
the exact-commit replay. Public projections replace host paths and machine identity with
aliases and retain captured whitespace. [`final-verifier/projection.json`](https://assets.agee.dev/evidence/spec-lock/e226c1388ccf473cea92039e2452442d/projection.json) binds original
and public artifact hashes; unmodified originals remain in the private execution record.

## Evidence files

These files were committed under `docs/proof/portable-evidence-policy/` and now live only on Cloudflare, behind sign-in. The commit named in `walked` is in the history before it was rebuilt without them; the code and tests here are the same, except that `test/policy-evidence.test.mjs` reads its baseline fixture from `test/policy-baseline.json`.

| File | Link |
|---|---|
| `all-walk-final.txt` | [link](https://assets.agee.dev/evidence/spec-lock/5b83b4f1da1b29f79b8edc5085bbff69/all-walk-final.txt) |
| `all-walk-review-1.txt` | [link](https://assets.agee.dev/evidence/spec-lock/ad8e5543e81ba66833d3a1f516765fc7/all-walk-review-1.txt) |
| `all-walk-review-2.txt` | [link](https://assets.agee.dev/evidence/spec-lock/ae174d3ce3c07caeadc96667b4571536/all-walk-review-2.txt) |
| `all-walk.txt` | [link](https://assets.agee.dev/evidence/spec-lock/92416990c2f4beeced88c7bb54346600/all-walk.txt) |
| `baseline.json` | [link](https://assets.agee.dev/evidence/spec-lock/6443c945bf0316d9dada9a36b18e7f7d/baseline.json) |
| `candidate.json` | [link](https://assets.agee.dev/evidence/spec-lock/228d2f7ccb2730e0e2b9357373235266/candidate.json) |
| `capture-final.json` | [link](https://assets.agee.dev/evidence/spec-lock/b1ceb3ff6ca4aa2ef6db8693691ee9fe/capture-final.json) |
| `capture-review-1.json` | [link](https://assets.agee.dev/evidence/spec-lock/6ffdedd4e215d6aed1cfc3765c919bba/capture-review-1.json) |
| `completion-source-hashes.json` | [link](https://assets.agee.dev/evidence/spec-lock/56ed757ce917796c894f7bf36c1097b9/completion-source-hashes.json) |
| `control-source-hashes.json` | [link](https://assets.agee.dev/evidence/spec-lock/0d621ff9312b42acecb7fb47e0f9d70f/control-source-hashes.json) |
| `controls-development/control-source-hashes.json` | [link](https://assets.agee.dev/evidence/spec-lock/2c7433a1ce58a28ae00613b148d55f90/control-source-hashes.json) |
| `controls-development/mutations.json` | [link](https://assets.agee.dev/evidence/spec-lock/9a4080eaa5f02ffd6c527c4e06598889/mutations.json) |
| `controls-development/policy-binding.patch` | [link](https://assets.agee.dev/evidence/spec-lock/8d6edff353bf7fff4b5d25bb393551e9/policy-binding.patch) |
| `controls-development/policy-binding.txt` | [link](https://assets.agee.dev/evidence/spec-lock/4ddc856224dcb871f14349604b82fe1c/policy-binding.txt) |
| `controls-development/push-adapter.patch` | [link](https://assets.agee.dev/evidence/spec-lock/5ffc676a58ee2fc4c0b4c555e493b391/push-adapter.patch) |
| `controls-development/push-adapter.txt` | [link](https://assets.agee.dev/evidence/spec-lock/5394c8f9e3c0c629833ce5613bf5bb6b/push-adapter.txt) |
| `controls-development/required-policy.patch` | [link](https://assets.agee.dev/evidence/spec-lock/c9bb30877d62e79e683d10f593dbe49c/required-policy.patch) |
| `controls-development/required-policy.txt` | [link](https://assets.agee.dev/evidence/spec-lock/54a81a727a6d200b3ccc322c9a6171ac/required-policy.txt) |
| `controls-development/unselected-scope.patch` | [link](https://assets.agee.dev/evidence/spec-lock/849f009f39615a6e3c63290623182906/unselected-scope.patch) |
| `controls-development/unselected-scope.txt` | [link](https://assets.agee.dev/evidence/spec-lock/85ad4d9726cf8494e100169d9c639680/unselected-scope.txt) |
| `final-verifier/ac-verdicts.json` | [link](https://assets.agee.dev/evidence/spec-lock/b34e2c847f36a3092aa3a00543d6a2d6/ac-verdicts.json) |
| `final-verifier/all-walk/capture.json` | [link](https://assets.agee.dev/evidence/spec-lock/9526023db3e6c414194d80fc1343e36f/capture.json) |
| `final-verifier/all-walk/policy.json` | [link](https://assets.agee.dev/evidence/spec-lock/bc9c154a68148e07f9f17f43325f7b6b/policy.json) |
| `final-verifier/all-walk/semantic.json` | [link](https://assets.agee.dev/evidence/spec-lock/12183bd7cbc5d9da629ca01063b44973/semantic.json) |
| `final-verifier/command-1.stderr.txt` | [link](https://assets.agee.dev/evidence/spec-lock/c70157fd95b89a6a12756028f2a1b4b9/command-1.stderr.txt) |
| `final-verifier/command-1.stdout.txt` | [link](https://assets.agee.dev/evidence/spec-lock/023733fa4cc350793a724a243cf8abf8/command-1.stdout.txt) |
| `final-verifier/command-2.stderr.txt` | [link](https://assets.agee.dev/evidence/spec-lock/2c1894d1601154468b5c97902151233a/command-2.stderr.txt) |
| `final-verifier/command-2.stdout.txt` | [link](https://assets.agee.dev/evidence/spec-lock/4070a0a351b1476e21b0f456fcfedcac/command-2.stdout.txt) |
| `final-verifier/command-3.stderr.txt` | [link](https://assets.agee.dev/evidence/spec-lock/0ff5619bea1416dd874a0c706c0ba17d/command-3.stderr.txt) |
| `final-verifier/command-3.stdout.txt` | [link](https://assets.agee.dev/evidence/spec-lock/59cbf91dc7897747fc0aff94bd9a31b3/command-3.stdout.txt) |
| `final-verifier/command-4.stderr.txt` | [link](https://assets.agee.dev/evidence/spec-lock/92891894fabf8ca0f7da80e169a9f6e1/command-4.stderr.txt) |
| `final-verifier/command-4.stdout.txt` | [link](https://assets.agee.dev/evidence/spec-lock/31d74e196eb27eb5197d4d9f77b27c9b/command-4.stdout.txt) |
| `final-verifier/execution-metadata.json` | [link](https://assets.agee.dev/evidence/spec-lock/d8ab3ef78aef702d6a2a5cf574c6c976/execution-metadata.json) |
| `final-verifier/impact.json` | [link](https://assets.agee.dev/evidence/spec-lock/c14cb629cd57b334d9e149c023b22bd7/impact.json) |
| `final-verifier/independent-recomputation.json` | [link](https://assets.agee.dev/evidence/spec-lock/8606c5366de7d4a461b2b559912e27a7/independent-recomputation.json) |
| `final-verifier/projection.json` | [link](https://assets.agee.dev/evidence/spec-lock/e226c1388ccf473cea92039e2452442d/projection.json) |
| `final-verifier/record-inspection.json` | [link](https://assets.agee.dev/evidence/spec-lock/c07dfa80f192d6742945fcba517d6ea1/record-inspection.json) |
| `final-verifier/report.md` | [link](https://assets.agee.dev/evidence/spec-lock/bd3b4b1e2d30f33c06dbbb8b4b611b48/report.md) |
| `final-verifier/runtime-details.json` | [link](https://assets.agee.dev/evidence/spec-lock/fb068aa4550067aeae7657c0fb400d81/runtime-details.json) |
| `frozen.json` | [link](https://assets.agee.dev/evidence/spec-lock/46d0ce00fc3012956d6533f693f83f18/frozen.json) |
| `full-suite-completion.txt` | [link](https://assets.agee.dev/evidence/spec-lock/d35697c95e897052a13f62786546fee8/full-suite-completion.txt) |
| `full-suite-final.txt` | [link](https://assets.agee.dev/evidence/spec-lock/c985accdcbc240eb55e6b61d9db6e1cb/full-suite-final.txt) |
| `full-suite-review-1.txt` | [link](https://assets.agee.dev/evidence/spec-lock/47ed2fb32a8aff17bffd133f51f2f76f/full-suite-review-1.txt) |
| `full-suite-review-2.txt` | [link](https://assets.agee.dev/evidence/spec-lock/5fd08be15432a58385cffca9c2242b50/full-suite-review-2.txt) |
| `full-suite.txt` | [link](https://assets.agee.dev/evidence/spec-lock/730f6e317b6d959a700eb18109eb5004/full-suite.txt) |
| `green-adapters.txt` | [link](https://assets.agee.dev/evidence/spec-lock/61ace7a728fd60ed9c015b0861a27516/green-adapters.txt) |
| `green-doc-proof.txt` | [link](https://assets.agee.dev/evidence/spec-lock/a505ec0d2efef25676db1636f41cc02a/green-doc-proof.txt) |
| `green-exceptions.txt` | [link](https://assets.agee.dev/evidence/spec-lock/d62567697cb7625b504aa54da9fa7c35/green-exceptions.txt) |
| `green-parity.txt` | [link](https://assets.agee.dev/evidence/spec-lock/b685c53506806234033efcc1e4feb152/green-parity.txt) |
| `green-policy.txt` | [link](https://assets.agee.dev/evidence/spec-lock/75bd4e02160d362fe5eedd40c323dacd/green-policy.txt) |
| `green-required.txt` | [link](https://assets.agee.dev/evidence/spec-lock/150e5389da514c47f690abe2b9fe6357/green-required.txt) |
| `green-review-1.txt` | [link](https://assets.agee.dev/evidence/spec-lock/90941ad8aa91e192cbc9bd8c0a63026f/green-review-1.txt) |
| `green-review-2.txt` | [link](https://assets.agee.dev/evidence/spec-lock/f600c62d925e9ee0f8d7b55766009e9c/green-review-2.txt) |
| `green-review-3.txt` | [link](https://assets.agee.dev/evidence/spec-lock/46f3b42ac20a932aa6631cabf8d884c4/green-review-3.txt) |
| `green-review-4.txt` | [link](https://assets.agee.dev/evidence/spec-lock/8285213c2cf61844c8525dcdc90b7d73/green-review-4.txt) |
| `impact-final.json` | [link](https://assets.agee.dev/evidence/spec-lock/8767364d02d77d1317742265f507ec4c/impact-final.json) |
| `impact-review-1.json` | [link](https://assets.agee.dev/evidence/spec-lock/e38dba776e8c4f94b5a6c06a1fe8a224/impact-review-1.json) |
| `impact.json` | [link](https://assets.agee.dev/evidence/spec-lock/0e183e7bad12b5594821149b5b39a3cc/impact.json) |
| `inventory-enrollment.patch` | [link](https://assets.agee.dev/evidence/spec-lock/8815155267a6946a628104e289a8b0e4/inventory-enrollment.patch) |
| `inventory-enrollment.txt` | [link](https://assets.agee.dev/evidence/spec-lock/4b19d29bb2fe4079c3b80c4f6177be87/inventory-enrollment.txt) |
| `mutations.json` | [link](https://assets.agee.dev/evidence/spec-lock/2ba03fefd5530994bf3a9a8ba30bbca7/mutations.json) |
| `policy-binding.patch` | [link](https://assets.agee.dev/evidence/spec-lock/e87b16aa4e9026841dc5599056ed0c82/policy-binding.patch) |
| `policy-binding.txt` | [link](https://assets.agee.dev/evidence/spec-lock/643bb1f31a4affaa453462196c3ac05f/policy-binding.txt) |
| `policy-final.json` | [link](https://assets.agee.dev/evidence/spec-lock/506edd3a10601f1039dadb5ae3497627/policy-final.json) |
| `policy-review-1.json` | [link](https://assets.agee.dev/evidence/spec-lock/8fac6f793b98b2dfcacbf708c8ff5df4/policy-review-1.json) |
| `push-adapter.patch` | [link](https://assets.agee.dev/evidence/spec-lock/b78d6d978b425cc63685fa86449fd9ee/push-adapter.patch) |
| `push-adapter.txt` | [link](https://assets.agee.dev/evidence/spec-lock/51ea1d70f391cfdad78d9a388c45bb32/push-adapter.txt) |
| `red-adapters.txt` | [link](https://assets.agee.dev/evidence/spec-lock/f9f000183c5b4a5dd1af29154c57a293/red-adapters.txt) |
| `red-cr-comment.txt` | [link](https://assets.agee.dev/evidence/spec-lock/052256df1699bf7633dbd6b32c6e1aa3/red-cr-comment.txt) |
| `red-doc-proof.txt` | [link](https://assets.agee.dev/evidence/spec-lock/597bf563d7773a2dc98e6b138c6441dc/red-doc-proof.txt) |
| `red-doc-v1.txt` | [link](https://assets.agee.dev/evidence/spec-lock/8c9592cd4b52542a298fc077cc99ee4d/red-doc-v1.txt) |
| `red-preview.txt` | [link](https://assets.agee.dev/evidence/spec-lock/527dfe0be5350760754d37c411c1948c/red-preview.txt) |
| `red-required.txt` | [link](https://assets.agee.dev/evidence/spec-lock/6c5bb1ea604f26a291b72ab5da888a1c/red-required.txt) |
| `red-review-1.txt` | [link](https://assets.agee.dev/evidence/spec-lock/d5a791dcf14bb0d500a501ea324ef0c1/red-review-1.txt) |
| `red-review-2.txt` | [link](https://assets.agee.dev/evidence/spec-lock/c8650429cddf490db1e54510400f7926/red-review-2.txt) |
| `red-review-3.txt` | [link](https://assets.agee.dev/evidence/spec-lock/6144fec2a577eebfb5df501a0b645f87/red-review-3.txt) |
| `red-review-4.txt` | [link](https://assets.agee.dev/evidence/spec-lock/e09d07cbd4ed36924a1021e1c3f2a804/red-review-4.txt) |
| `required-policy.patch` | [link](https://assets.agee.dev/evidence/spec-lock/30d4a332e9b22611f3a08a3daf5b9383/required-policy.patch) |
| `required-policy.txt` | [link](https://assets.agee.dev/evidence/spec-lock/fec1bb58f38956bf27e8e6ad2bc59f11/required-policy.txt) |
| `review-1-source-hashes.json` | [link](https://assets.agee.dev/evidence/spec-lock/261a53857100f019d1a3b894ea5028c0/review-1-source-hashes.json) |
| `review-1.md` | [link](https://assets.agee.dev/evidence/spec-lock/a76e91a042e3c13f8dcc3cb71541306a/review-1.md) |
| `review-2-source-hashes.json` | [link](https://assets.agee.dev/evidence/spec-lock/43beec19a93366affc1a44def7447813/review-2-source-hashes.json) |
| `review-2-usage.json` | [link](https://assets.agee.dev/evidence/spec-lock/fe170ca69191833e310a513b231b5dab/review-2-usage.json) |
| `review-2.md` | [link](https://assets.agee.dev/evidence/spec-lock/abfa80d2479fa70e50a8b6fff651a764/review-2.md) |
| `review-3-source-hashes.json` | [link](https://assets.agee.dev/evidence/spec-lock/e173bcaf6a8e84c19c0667d206fe229b/review-3-source-hashes.json) |
| `review-3.md` | [link](https://assets.agee.dev/evidence/spec-lock/21c069f676a28842a7b42b53a5a98974/review-3.md) |
| `review-4-source-hashes.json` | [link](https://assets.agee.dev/evidence/spec-lock/0eeda60349b1aa1418e2b6264904a000/review-4-source-hashes.json) |
| `review-4-usage.json` | [link](https://assets.agee.dev/evidence/spec-lock/28a6671e0fde2f49d8d6c378e10d09e8/review-4-usage.json) |
| `review-4.md` | [link](https://assets.agee.dev/evidence/spec-lock/a1fa6d4becc1e1ac64939d0893391670/review-4.md) |
| `review-request-1.txt` | [link](https://assets.agee.dev/evidence/spec-lock/0961f8fd1fb7434ae50c7d5b8e2f37b1/review-request-1.txt) |
| `review-request-2.txt` | [link](https://assets.agee.dev/evidence/spec-lock/48b75012339b9e72e427d331f99a92f6/review-request-2.txt) |
| `review-request-3.txt` | [link](https://assets.agee.dev/evidence/spec-lock/1584030658864f62ea0edf72fa258ce0/review-request-3.txt) |
| `review-request-4.txt` | [link](https://assets.agee.dev/evidence/spec-lock/0b8cde887198970e9739c67e069ba374/review-request-4.txt) |
| `review-request.txt` | [link](https://assets.agee.dev/evidence/spec-lock/9cf531beaa40d67bc4fa557d8bac9ef7/review-request.txt) |
| `semantic-final.json` | [link](https://assets.agee.dev/evidence/spec-lock/368e154f9685fc76de4a9d15cc07ff47/semantic-final.json) |
| `semantic-review-1.json` | [link](https://assets.agee.dev/evidence/spec-lock/6c84498c850ac55de18ba5accd1a1c86/semantic-review-1.json) |
| `source-commit-check.json` | [link](https://assets.agee.dev/evidence/spec-lock/fc8a0742d0cb3a6f5cf957c1322aa45d/source-commit-check.json) |
| `source-commit-check.txt` | [link](https://assets.agee.dev/evidence/spec-lock/6fd2adbf28e536023c9e10b3c225dc05/source-commit-check.txt) |
| `targeted.txt` | [link](https://assets.agee.dev/evidence/spec-lock/19cca362ccc2821862152f7d2614483e/targeted.txt) |
| `unselected-scope.patch` | [link](https://assets.agee.dev/evidence/spec-lock/aa0cde5cff418939fd890bffd2396fd9/unselected-scope.patch) |
| `unselected-scope.txt` | [link](https://assets.agee.dev/evidence/spec-lock/f4542c0a4df989d3f682cf2eb5a4a646/unselected-scope.txt) |
| `valid-upgrade-final.json` | [link](https://assets.agee.dev/evidence/spec-lock/e083d5c506a0aa9f2f47c618ef2112a7/valid-upgrade-final.json) |
| `valid-upgrade-review-1.json` | [link](https://assets.agee.dev/evidence/spec-lock/1a6f3315aca84105286c162f3debfeb5/valid-upgrade-review-1.json) |
