---
tags: [portable-evidence, policy, cli, selected-repositories]
date: 2026-09-28
issue: local-selected-repository-enforcement
spec: docs/specs/portable-evidence-policy.md
walked: pending
---
# Enforce complete evidence in selected repositories

Local implementation and four review rounds are complete. Observed defects are
repaired. Final commit replay and proof-only completion remain pending. No production activation, publication,
real repository enrollment or remote workflow update is authorized or performed.

## What I walked

| AC | Assertion and expected result | Observed evidence |
|---|---|---|
| AC1 | Required-version CLI cases require missing and version 1 evidence to exit 1; a complete captured version 2 record exits 0. The saved policy spec supplies this rule. | Observed red accepted missing evidence, actual 0 versus expected 1. Candidate CLI refuses missing/legacy/invalid records and accepts complete evidence. Candidate commands and local repository settings cannot lower the owner requirement. |
| AC9 | Real merge/push attempts outside selection must exit 0, including no-Node hooks. Selected repository and linked worktree attempts must share scope. Inventory alone cannot select. | Initial candidate walk has 0/9 unintended blocks; selected linked-worktree cases share main-repository verdicts. Preview and scratch activation tests pass. Missing, empty, downgraded and malformed policy refuse after selected registration. |
| AC10 | CLI, reference transaction and pre-push apply the same required policy. Bad Git attempts leave their target unchanged; complete evidence moves it. Legacy prose/version 1 and documentation exemptions remain. | Adapter regression initially allowed a bad merge. Candidate Git tests refuse bad records with unchanged target and accept good records. Legacy tests pass. An extra prose documentation-proof test exposed an overstrict requirement; its repaired regression passes. |
| AC14 | Frozen case list has 57 attempts: selected 4 cases x 4 adapters x 3 repeats, plus unselected 3 adapters x 3 repeats. Recompute raw exits, before/after tips, medians/ranges and denominators. | Baseline accepts 24/24 applicable invalid attempts, blocks 9/9 unselected attempts and has 24 unsupported v2 attempts. Initial candidate accepts 0/36 invalid, refuses 0/12 valid and blocks 0/9 unselected attempts. Receipt tampering tests reject altered movement and missing counts. |

## Baseline and measurement limits

The prerequisite is `6a0d7e5f3c306357f07a4d1fe6bba343fcc48375`.
[`portable-evidence-policy/frozen.json`](https://assets.agee.dev/evidence/spec-lock/46d0ce00fc3012956d6533f693f83f18/frozen.json) pins the baseline, case list and initial fixture
bytes before production edits. The baseline uses the actual prerequisite capture,
export, ordinary check and hooks. It records 24 unsupported v2 verdicts, split between
12 invalid and 12 valid attempts, separately from false acceptances/refusals. The
candidate adds support and required semantic validation. Unsupported baseline timing
measures its refusal route, not a full valid check. No valid baseline denominator is
invented. The applicable baseline invalid denominator is 24; candidate is 36.

Initial raw before/after observations are [`baseline.json`](https://assets.agee.dev/evidence/spec-lock/6443c945bf0316d9dada9a36b18e7f7d/baseline.json) and [`candidate.json`](https://assets.agee.dev/evidence/spec-lock/228d2f7ccb2730e0e2b9357373235266/candidate.json) below
this proof directory. [`impact.json`](https://assets.agee.dev/evidence/spec-lock/0e183e7bad12b5594821149b5b39a3cc/impact.json) retains per-case medians and ranges. Three repeats
use the same runtime, with repeats 1 and 2 marked warm but no forced cache or load
control. Captures and export are outside paired operation timings. Synthetic input
snapshots and captured records are retained. Public raw observations replace scratch
and checker host paths with aliases; private originals remain unchanged. Whole-task
usage and cost are unavailable, not zero. No production reliability claim follows.

## Tests and controls

The initial full suite exited 0: 76 tests, 75 passed, one opt-in remote canary skipped.
[`portable-evidence-policy/full-suite.txt`](https://assets.agee.dev/evidence/spec-lock/730f6e317b6d959a700eb18109eb5004/full-suite.txt) retains the output. The combined offline
walk exited 0 with 36 capture checks, 39 semantic checks and 57 policy attempts, and
printed `AC1 through AC10 offline walks passed`.

Four development guard removals failed their intended assertions: required evidence,
unselected hook bypass, pre-push enforcement and manifest policy identity. Exact
patches, source/mutated hashes and transcripts are under `controls-development/`.
They precede the documentation exemption repair and are not final-source receipts.
Final-source controls will be saved separately.

## Review ownership

Required code-review rounds use Codex gpt-6-astra high, then Claude Opus 5.5 high.
Their fixed comparison base is the prerequisite above. Round receipts and exact
commands will be added here. No project-specific additional receipt is configured.
This CLI-only work has no browser, Design or video stage. Final independent execution
will use a distinct session and detached checkout, exact source revision and approved
input hashes before/after each command.

## Limits

Owner policy and records are editable by the same user. They do not authenticate
actors or prevent test writes. Hook bypass and remote-default-ref trust remain.
Documentation, initial-commit and previously landed/pulled-content exceptions remain;
the owner must review them before any pilot. Generic chat claims and the workflow
consumer remain outside this increment. No active repository has adopted this policy.

## First review and repair

Codex gpt-6-astra high found one public-artifact Standards violation, five Spec defects
and one preview coverage gap. The request snapshots now omit the private skill path.
Policy scope validates actual common Git directories; indented selected settings no
longer become legacy; final integration entries without a newline remain guarded;
duplicate integration settings refuse consistently. Documentation-only version 1
proofs retain legacy validation. Preview tests check existing owner bytes/timestamp
and absence of a newly created owner or activation file, as well as Git config.

All 17 policy tests passed after these repairs. A further parity run passed two tests,
including selected legacy policy; adapter assertions compare exact policy/checker ids.
The no-final-newline test now also exercises pushing to the integration branch; the
next full run covers that added assertion. The first attempted documentation-v1 red
hit a missing fixture object; that is not defect evidence. [`red-doc-v1.txt`](https://assets.agee.dev/evidence/spec-lock/8c9592cd4b52542a298fc077cc99ee4d/red-doc-v1.txt) is the
corrected symptom-bearing red, which refused specifically for the semantic version.

Review receipt: [`portable-evidence-policy/review-1.md`](https://assets.agee.dev/evidence/spec-lock/a76e91a042e3c13f8dcc3cb71541306a/review-1.md). Exact command:

```sh
codex exec --skip-git-repo-check --model "${AGENTS_REVIEW_MODEL:-gpt-6-astra}" -c model_reasoning_effort="high" -o docs/proof/portable-evidence-policy/review-1.md "$(cat docs/proof/portable-evidence-policy/review-request.txt)" < /dev/null > "$REVIEW_RECORDS/review-1.raw.txt" 2>&1
```

The private execution record keeps the unmodified request and original host command;
public request snapshots replace only the private skill path.

## Second review and repair

Claude Opus 5.5 high found four actual policy defects: a case alias silently removed
selection; CR comments and bare keywords split CLI/hook decisions; included global
registrations lost the persistent marker. The regression reds are [`red-review-2.txt`](https://assets.agee.dev/evidence/spec-lock/c8650429cddf490db1e54510400f7926/red-review-2.txt)
and [`red-cr-comment.txt`](https://assets.agee.dev/evidence/spec-lock/052256df1699bf7633dbd6b32c6e1aa3/red-cr-comment.txt); all fail the intended assertions. Production inputs were
the round-2 reviewed bytes. [`green-review-2.txt`](https://assets.agee.dev/evidence/spec-lock/f600c62d925e9ee0f8d7b55766009e9c/green-review-2.txt) passes all 22 policy tests after repair.

Selection now compares directory identity. LF validation precedes shell comment
skipping, discovery handles bare keywords, and global lookup follows includes. Each
Node check/export uses one owner-policy snapshot. Inventory preview and activation
now use a distinct unselected repository; an additional control mutates inventory
into selection. Project fingerprint and registration notes are corrected. Further
coverage checks stale selected-policy exports and first-commit/pull exceptions.

The review receipt is [`portable-evidence-policy/review-2.md`](https://assets.agee.dev/evidence/spec-lock/abfa80d2479fa70e50a8b6fff651a764/review-2.md); exact model usage is
[`review-2-usage.json`](https://assets.agee.dev/evidence/spec-lock/fe170ca69191833e310a513b231b5dab/review-2-usage.json) and names only `claude-opus-5-5`. Its partial provider cost is
$2.682508, not whole-task cost. Exact command:

```sh
PATH="$HOME/.local/bin:$PATH" CLAUDE_CODE_NO_MODEL_FALLBACK=1 CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK=1 claude -p --model claude-opus-5-5 --effort high --output-format json "$(cat docs/proof/portable-evidence-policy/review-request.txt)" < /dev/null > "$REVIEW_RECORDS/review-2.json"
```

Missing or malformed selected settings deliberately refuse every head update before
scope/branch filtering, including unselected feature commits and garbage collection
that packs refs. Happy-policy AC14 denominators do not cover this recovery condition.
In a code landing, every touched top-level proof needs version 2, including edited
older proofs. These limits are now explicit in the spec.

## Post-round-2 verification

The full offline suite exited 0: 89 tests, 88 passed, zero failed, one opt-in remote
canary skipped. Output: [`portable-evidence-policy/full-suite-review-2.txt`](https://assets.agee.dev/evidence/spec-lock/5fd08be15432a58385cffca9c2242b50/full-suite-review-2.txt). It ran
through the shared full-suite wrapper. The additional two exception tests pass in
[`green-exceptions.txt`](https://assets.agee.dev/evidence/spec-lock/d62567697cb7625b504aa54da9fa7c35/green-exceptions.txt). Their initial owner-edit assertion mistakenly expected Git's
refusal exit to equal the CLI's 1; Git correctly refused with 128. That assertion-only
error is excluded from production defect counts.

Five controls failed at intended assertions, including inventory enrollment. Root
control patches, transcripts and hash maps are this generation; `controls-development/`
retains the earlier generation. Frozen case-list, fixture, walk and baseline hashes
still match. Regression-test bytes changed to cover review findings.

## Third review and repair

Codex high reported zero Standards findings, two Spec defects and zero additional
Evidence findings. Legacy activation could erase the persistent selected marker.
Shell reads discarded NUL bytes and disagreed with Node on malformed policy. The
four regressions in [`red-review-3.txt`](https://assets.agee.dev/evidence/spec-lock/6144fec2a577eebfb5df501a0b645f87/red-review-3.txt) fail at intended assertions, including NUL in
comments. Legacy activation now refuses selected registrations, including when the
owner file is missing. A byte-preserving shell round-trip check rejects NUL before
parsing without requiring Node in unselected repositories. Node also rejects NUL.

Review receipt: [`portable-evidence-policy/review-3.md`](https://assets.agee.dev/evidence/spec-lock/21c069f676a28842a7b42b53a5a98974/review-3.md). Exact command:

```sh
codex exec --skip-git-repo-check --model "${AGENTS_REVIEW_MODEL:-gpt-6-astra}" -c model_reasoning_effort="high" -o docs/proof/portable-evidence-policy/review-3.md "$(cat docs/proof/portable-evidence-policy/review-request.txt)" < /dev/null > "$REVIEW_RECORDS/review-3.raw.txt" 2>&1
```

The prior combined walk passed all 132 observations but predates these two repairs.
The fourth and final review, refreshed final-source execution and independent
exact-commit replay remain pending.

Post-round-3 repair: all six targeted regressions passed in [`green-review-3.txt`](https://assets.agee.dev/evidence/spec-lock/46f3b42ac20a932aa6631cabf8d884c4/green-review-3.txt).

## Final-source checks before commit

After the third-round repairs, the full suite exited 0 with 93 tests: 92 passed, zero
failed, one opt-in remote canary skipped. The output is [`full-suite-final.txt`](https://assets.agee.dev/evidence/spec-lock/c985accdcbc240eb55e6b61d9db6e1cb/full-suite-final.txt). All
five guard-removal controls failed their intended assertions on the same source.
The review-four source map and final control source map match the current source
and test bytes. The independent commit replay remains pending.

The final author walk exited 0: 36 capture checks, 39 semantic checks and 57 policy
attempts. It printed `AC1 through AC10 offline walks passed`. Raw records are
[`capture-final.json`](https://assets.agee.dev/evidence/spec-lock/b1ceb3ff6ca4aa2ef6db8693691ee9fe/capture-final.json), [`semantic-final.json`](https://assets.agee.dev/evidence/spec-lock/368e154f9685fc76de4a9d15cc07ff47/semantic-final.json) and [`policy-final.json`](https://assets.agee.dev/evidence/spec-lock/506edd3a10601f1039dadb5ae3497627/policy-final.json); [`impact-final.json`](https://assets.agee.dev/evidence/spec-lock/8767364d02d77d1317742265f507ec4c/impact-final.json)
recomputes the policy receipt. Candidate results are 0/36 invalid accepted, 0/12 valid
refused and 0/9 unselected blocked. Baseline remains 24/24 applicable invalid accepted,
9/9 unselected blocked, and 24 unsupported v2 results.

A separate cross-format comparison uses the baseline's accepted legacy proof and
the candidate's complete v2 proof for identical non-proof code/spec/test bytes. It
does not relabel frozen cases. The three-repeat median timings are:

| Operation | Old accepted proof | Required v2 proof | Added time |
|---|---:|---:|---:|
| CLI | 462 ms | 1,565 ms | 1,103 ms |
| Local merge | 612 ms | 1,087 ms | 475 ms |
| Pre-push | 387 ms | 905 ms | 518 ms |
| Linked worktree merge | 525 ms | 1,151 ms | 626 ms |

Exact values are in [`valid-upgrade-final.json`](https://assets.agee.dev/evidence/spec-lock/e083d5c506a0aa9f2f47c618ef2112a7/valid-upgrade-final.json); per-case ranges are in
[`impact-final.json`](https://assets.agee.dev/evidence/spec-lock/8767364d02d77d1317742265f507ec4c/impact-final.json). Load and cache were not controlled. These are synthetic local
checker timings, not complete workflow costs or production reliability measurements.

## Fourth review and final repairs

Claude Opus 5.5 high reported zero Standards violations and two P3 Spec defects.
Unicode line separators could split CLI/hook verdicts; decoded UTF-8 text could
collapse different owner comment bytes into one fingerprint. The three regressions
in [`red-review-4.txt`](https://assets.agee.dev/evidence/spec-lock/e09d07cbd4ed36924a1021e1c3f2a804/red-review-4.txt) reproduce both defects and LF-only setting discovery. The
repairs hash the raw buffer and parse LF-delimited values with dotAll. Unused forced
selection input and stale shell comments are removed. No fifth code review runs.

Receipt: [`portable-evidence-policy/review-4.md`](https://assets.agee.dev/evidence/spec-lock/a1fa6d4becc1e1ac64939d0893391670/review-4.md). [`review-4-usage.json`](https://assets.agee.dev/evidence/spec-lock/28a6671e0fde2f49d8d6c378e10d09e8/review-4-usage.json) names only
`claude-opus-5-5`; partial provider cost $2.8493206. Exact command:

```sh
PATH="$HOME/.local/bin:$PATH" CLAUDE_CODE_NO_MODEL_FALLBACK=1 CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK=1 claude -p --model claude-opus-5-5 --effort high --output-format json "$(cat docs/proof/portable-evidence-policy/review-request.txt)" < /dev/null > "$REVIEW_RECORDS/review-4.json"
```

Known limits from this review: every owner-file byte edit, even a comment, invalidates
pending exports across all selected repositories. Moving or deleting a selected
repository makes its entry invalid and triggers the documented all-head refusal.
Supported registration is global, as the rollout writes it. Manually placing selected
hooks only in system or repository-local config is outside that registration contract
and may split missing-policy CLI/hook behavior; this was a reading-based concern,
not an observed probe. The shell and Node readers remain separate because unselected
hooks must work without Node; regression samples exercise their agreement.

The earlier files named `*-final` are the pre-round-4-repair generation. The refreshed
completion suite/walk/controls and exact-commit replay below identify the final source.

Post-round-4 targeted checks passed all five tests in [`green-review-4.txt`](https://assets.agee.dev/evidence/spec-lock/8285213c2cf61844c8525dcdc90b7d73/green-review-4.txt). The final
replacement inputs are recorded in [`completion-source-hashes.json`](https://assets.agee.dev/evidence/spec-lock/56ed757ce917796c894f7bf36c1097b9/completion-source-hashes.json). Four broad
code reviews completed, in the required Codex/Opus/Codex/Opus order. The final
formatting repairs receive regression execution and independent input approval in
the commit replay, not a fifth code-review round.

Completion full suite exited 0: 96 tests, 95 passed, zero failed, one optional remote
canary skipped. [`full-suite-completion.txt`](https://assets.agee.dev/evidence/spec-lock/d35697c95e897052a13f62786546fee8/full-suite-completion.txt) is the current source's complete suite
output. Five controls were refreshed and failed their intended assertions; root
control hash maps now match [`completion-source-hashes.json`](https://assets.agee.dev/evidence/spec-lock/56ed757ce917796c894f7bf36c1097b9/completion-source-hashes.json). The source is ready
for the exact-commit replay.

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
| `targeted.txt` | [link](https://assets.agee.dev/evidence/spec-lock/19cca362ccc2821862152f7d2614483e/targeted.txt) |
| `unselected-scope.patch` | [link](https://assets.agee.dev/evidence/spec-lock/aa0cde5cff418939fd890bffd2396fd9/unselected-scope.patch) |
| `unselected-scope.txt` | [link](https://assets.agee.dev/evidence/spec-lock/f4542c0a4df989d3f682cf2eb5a4a646/unselected-scope.txt) |
| `valid-upgrade-final.json` | [link](https://assets.agee.dev/evidence/spec-lock/e083d5c506a0aa9f2f47c618ef2112a7/valid-upgrade-final.json) |
| `valid-upgrade-review-1.json` | [link](https://assets.agee.dev/evidence/spec-lock/1a6f3315aca84105286c162f3debfeb5/valid-upgrade-review-1.json) |
