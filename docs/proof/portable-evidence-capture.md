---
tags: [portable-evidence, candidate, cli]
date: 2026-09-28
issue: local-record-and-check
spec: docs/specs/portable-evidence-capture.md
walked: ecf6441eeddf14a26e6c65638b5f3b59ed8653de
---
# Record and check a complete verification run

Local implementation and independent replay are complete. The verifier ran source
commit `ecf6441eeddf14a26e6c65638b5f3b59ed8653de` in a clean detached checkout.
This candidate remains inactive. No push or merge occurred.

## What I walked

The independent verifier ran all 18 targeted tests against the exact source commit.
Every test passed, none skipped. Input hashes and clean Git status matched before
and after all four approved commands. The output and execution metadata are in
`portable-evidence-capture/final-verifier/`.

| Criterion | Assertion and expected result | Observed result and source |
|---|---|---|
| AC2 | Each live criterion has exactly one same-spec supported claim. Missing, duplicate, extra and wrong-spec claims must refuse. | Targeted tests 3 and 4 passed. The complete frozen case passed 3/3; all incomplete, duplicate, extra and wrong-spec variants refused. See the test transcript and candidate ledger. |
| AC3 | Capture the approved command at a clean revision, retain exact bytes and limits, and preserve failures. The good command asserts double(7) = 14 and prints value=14 with empty stderr. | Tests 1, 2, 6 and 8–18 passed, including review reproducers. Eight walk attempts produced one successful record, six failure records and one command-mismatch refusal before execution. Exit 3, timeout, overflow, changed input, missing executable and interruption stayed failures. |
| AC4 | Changed output, revisions, run/judge references, inputs or session bytes must refuse; a proof-only follow-up must pass. The fingerprint must cover decision code. | Tests 3 and 5 passed through the real CLI. The verifier independently recomputed `0.0.0+d03b071e9c55`; every candidate observation named it. |
| AC8 | Require distinct resolved sessions, a named executed assertion and concrete observation. Refuse same-session, absent identity, zero-test, skipped or unsupported claims. Disclose unauthenticated provenance. | Tests 3, 4 and 10 passed. Test 10 executed and captured a real command printing tests=0, then observed the judgment refusal. Separate author and verifier sessions are recorded below; local labels are not authenticated identities. |
| AC12 | Recompute paired outcomes and times from retained runs. Altered outcomes or missing denominators must refuse. | Test 7 passed with actual receipt CLI refusals. The verifier independently recomputed all counts, medians and ranges, then checked the saved receipt. The author rechecked the copied receipt and its output hashes. |

The historical eleven throwaway code mutations all failed their intended assertions.
The final verifier inspected those saved failures and reran the repaired tests; it did
not rerun the historical mutations. Two receipt mutations also refused. The full
pre-commit suite had 48 tests: 47 passed, zero failed, one opt-in remote canary skipped.

## Measured impact

The frozen walk contains 12 logical cases, each run three times per revision.

| Measure | Baseline | Final independent candidate |
|---|---:|---:|
| Invalid attempts accepted | 21/33 | 0/33 |
| Valid attempts refused | 0/3 | 0/3 |
| Automatically captured records | 0 | 7 |
| Valid complete-case checker median | 462.416 ms | 668.172 ms |
| Valid complete-case checker range | 440.179–525.232 ms | 645.171–669.996 ms |

The valid-case median added 205.756 ms. Across cases, added median checker time
ranged from 133.950 to 387.826 ms. Final unpaired capture time was 269.093 ms for
success and 253.576–425.901 ms for the six failures; pre-execution mismatch refusal
took 44.651 ms. These are observed samples, not timing guarantees.

Pre-commit review measurements remain unchanged in [`candidate.json`](https://assets.agee.dev/evidence/spec-lock/194d4c43c5c03e0c55afad6562e2fe18/candidate.json) and [`impact.json`](https://assets.agee.dev/evidence/spec-lock/7cb3f749ef226da284d662724942b409/impact.json)
below this proof directory. The final replay is a separate sample in
[`final-verifier/candidate.json`](https://assets.agee.dev/evidence/spec-lock/4d6565835b695ba3dc13116c52007eff/candidate.json), [`final-verifier/impact.json`](https://assets.agee.dev/evidence/spec-lock/82b4796ce3996e7306c8739f9e8185c1/impact.json) and
[`final-verifier/independent-recomputation.json`](https://assets.agee.dev/evidence/spec-lock/a7041a9038ebf9a3129551cd30584fcb/independent-recomputation.json). The earlier valid-case median was
732.644 ms, adding 270.228 ms. No favorable sample replaced a reviewed record.

The baseline had no capture command. It used v1 hand-built records and a print
command; candidate uses real capture/export plus an actual assertion expecting 14.
This format and runner difference limits interpretation of end-to-end costs.
Only checker invocation timings are paired. Eight captures were attempted: one successful record, six failure records and one pre-execution refusal;
a differing explicit command was refused before execution. This is new capability,
not a counted baseline false acceptance. The baseline's ephemeral fixture inputs
were reconstructed afterward from the same generator and recorded revisions.

## Evidence locations

- Frozen cases: `test/portable-evidence-cases.json`, SHA-256
  `9e7f55947ba4f4897413adcafb1b79751d2be98b70a3e6d7895486babcd2f3f6`.
- Original baseline: [`portable-evidence-capture/baseline.json`](https://assets.agee.dev/evidence/spec-lock/2c82ff90614ea683264aa86be4d7dbbd/baseline.json), SHA-256
  `8cdb4126208c4d9db1d8f5e930caa6a5bf25fdcee6f7c3c1557659fcf9da9aa7`.
- Candidate raw records: [`portable-evidence-capture/candidate.json`](https://assets.agee.dev/evidence/spec-lock/194d4c43c5c03e0c55afad6562e2fe18/candidate.json).
- Recomputed paired results: [`portable-evidence-capture/impact.json`](https://assets.agee.dev/evidence/spec-lock/7cb3f749ef226da284d662724942b409/impact.json).
- Eleven throwaway mutations: [`portable-evidence-capture/mutations.json`](https://assets.agee.dev/evidence/spec-lock/2e015cfd6cddd276769a24960c9999d8/mutations.json) and named
  transcripts. Each targeted test failed an assertion, including the two-dot path and checkout-symlink regressions. Transcripts normalize only
  the private runner path; original raw transcripts remain in the private task record.
- Initial missing-command reds are capability gaps. The baseline's accepted
  incomplete/wrong-spec/self-judged cases are the observed behavioral reds.

## Review ownership

Pre-commit Standards, Spec and Evidence review uses alternating Codex high and
Opus 5.5 high under the owner's replacement rule. Commands and receipts appear below.
This CLI-only change has no Design or browser review stage.

## Limits

Local source/session records are unauthenticated. Input hashes detect persistent
changes but do not prevent writes or transient changes. No generic response hook,
semantic red/oracle/golden enforcement, required policy or selected-repository
activation is implemented. No production reliability or productivity estimate follows
from this synthetic corpus. Whole-task token and cost measurements are unavailable, not zero.
Approved local commands are trusted and must not daemonize. A child that escapes the
process group may survive cleanup; inherited pipes cannot extend the recorder deadline.

## Review repairs before commit

Round 1, Codex high, found lost failure output after checkout metadata damage, an
undeclared input buffer limit and valid two-dot path rejection. Regression reds and
repairs are retained. The first cleanup fix left a registration behind; its full-suite
red is retained too.

Round 2, Opus 5.5 high, found unsupported roles being exported as support, unchecked
expected results and a detached pipe bypassing the time bound. The repairs now require
green support, exact approved exit/stdout and deadline pipe closure. Additional fixes
retain exact session source JSON, compare object content regardless of key order, avoid
creating output directories for invalid cwd, and clean up deleted/replaced checkouts
without following a replacement symlink. Empty input files are explicitly allowed;
nonempty refers to the input list.

Latest full suite is [`portable-evidence-capture/full-suite-round-3-final.txt`](https://assets.agee.dev/evidence/spec-lock/111c5d748a672bb8c25962a1727e1d9a/full-suite-round-3-final.txt), run with
`"$HOME/.agents/bin/full-suite-slot" npm test`. The complete raw output is preserved.
The remote canary test is deliberately not enabled. There is no browser suite.

Codex round 1 reported 90,703 tokens; its cost was unavailable. Opus round 2 reported
$3.9409812 in provider cost and its token/cache counts are in
[`portable-evidence-capture/review-2-usage.json`](https://assets.agee.dev/evidence/spec-lock/2e2e76fe4133659b25bb8e5c807278d7/review-2-usage.json). These are partial review usage, not
whole-task or per-capture costs. Whole-task token and cost totals remain unavailable.

The first round-3 suite exposed a fixture mismatch after exact expected-output checking was added. The real zero-test fixture now approves its actual `tests=0` bytes, so its refusal specifically tests the absent executed assertion. Its earlier full-suite failure is retained as [`full-suite-round-3.txt`](https://assets.agee.dev/evidence/spec-lock/e967b2140b77d3bab20df488881e0670/full-suite-round-3.txt).

## Pre-commit review receipts

Round 1 used Codex high and found three capture defects. Round 2 used Opus 5.5 high
with fallback disabled and found three P2 and five P3 capture/contract findings.
Round 3 used Codex high and found zero Standards, Spec or Evidence findings.
All concrete findings were repaired. The last reviewer independently ran 18 targeted
tests and recomputed the raw paired measurements. The model and usage record for
Opus names only `claude-opus-5-5`; no capacity fallback was used.

The requests at invocation time are saved as [`review-request-1.txt`](https://assets.agee.dev/evidence/spec-lock/5c3963e55da6ec58837a49c992b1ace3/review-request-1.txt),
[`review-request-2.txt`](https://assets.agee.dev/evidence/spec-lock/cdf5045656ed24ce2cd329c9d7b8b077/review-request-2.txt) and [`review-request-3.txt`](https://assets.agee.dev/evidence/spec-lock/e5ae8829086e06ce1331ed9b1eb7660f/review-request-3.txt) below this proof directory.
The commands used the required forms below. Stdout destinations are normalized
to `$REVIEW_RECORDS` here to keep host paths out of this public repository. The
exact host commands and original stdout records are retained in the private execution
record supplied with the handoff.

```sh
codex exec --skip-git-repo-check --model "${AGENTS_REVIEW_MODEL:-gpt-6-astra}" -c model_reasoning_effort="high" -o docs/proof/portable-evidence-capture/review-1.md "$(cat docs/proof/portable-evidence-capture/review-request.txt)" < /dev/null
PATH="$HOME/.local/bin:$PATH" CLAUDE_CODE_NO_MODEL_FALLBACK=1 CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK=1 claude -p --model claude-opus-5-5 --effort high --output-format json "$(cat docs/proof/portable-evidence-capture/review-request.txt)" < /dev/null > "$REVIEW_RECORDS/review-2.json"
codex exec --skip-git-repo-check --model "${AGENTS_REVIEW_MODEL:-gpt-6-astra}" -c model_reasoning_effort="high" -o docs/proof/portable-evidence-capture/review-3.md "$(cat docs/proof/portable-evidence-capture/review-request.txt)" < /dev/null
```

Review owners and receipts: Codex in [`portable-evidence-capture/review-1.md`](https://assets.agee.dev/evidence/spec-lock/3fc66206654518102c2ef93f3322d3ad/review-1.md),
Opus in [`portable-evidence-capture/review-2.md`](https://assets.agee.dev/evidence/spec-lock/a0d284b213aa0e05c6d40734efecfd4d/review-2.md) with its usage JSON, and Codex in
[`portable-evidence-capture/review-3.md`](https://assets.agee.dev/evidence/spec-lock/021f5036a9364ccd4417606482934c27/review-3.md). No separate project receipt or delivery
review is configured for this local commit. No push or merge is authorized.

## Independent final replay

Author session `01a0e87d-1020-7d73-907e-4f3d1b1a6a92` and verifier session
`01a0e8af-384a-7511-8200-68bada4c5c8c` are distinct local records. The verifier ran
Node v22.22.0 and Git 2.54.0, Apple Git-157. All four commands exited 0 within their
120-second limits. Elapsed times were 36.377 s for tests, 30.454 s for the walk,
0.075 s for receipt writing and 0.076 s for receipt verification.

The commands below ran in the clean verifier checkout. `$VERIFIER_OUTPUT` names
an external scratch directory. Exact host paths are retained in the private execution
record. Public metadata replaces only host paths with these aliases; candidate JSON,
output streams, timings and hashes retain their original bytes.

```sh
env -u NODE_TEST_CONTEXT node --test --test-timeout=120000 test/portable-evidence.test.mjs
env -u NODE_TEST_CONTEXT node test/portable-evidence-walk.mjs candidate "$VERIFIER_OUTPUT/candidate.json"
node test/portable-evidence-receipt.mjs docs/proof/portable-evidence-capture/baseline.json "$VERIFIER_OUTPUT/candidate.json" "$VERIFIER_OUTPUT/impact.json" write
node test/portable-evidence-receipt.mjs docs/proof/portable-evidence-capture/baseline.json "$VERIFIER_OUTPUT/candidate.json" "$VERIFIER_OUTPUT/impact.json"
```

Printed test totals: `tests 18`, `pass 18`, `fail 0`, `skipped 0`.
Printed walk result: `saved 36 candidate checks and 7 capture records`.
Printed receipt result:

```json
{"baseline":21,"candidate":0,"invalid_attempted":33,"valid_refused":0,"valid_attempted":3,"automatically_captured":7}
```

Execution metadata contains every before/after revision, clean status, approved input
hash, argv, output hash and timestamp. The separate record-inspection ledger hashes
the historical failure transcripts the verifier inspected. No final finding remained.
After the walked source commit, this branch changes only files under `docs/proof/`.

## Evidence files

These files were committed under `docs/proof/portable-evidence-capture/` and now live only on Cloudflare, behind sign-in. The commit named in `walked` is in the history before it was rebuilt without them; the code and tests here are the same.

| File | Link |
|---|---|
| `baseline-inputs.json` | [link](https://assets.agee.dev/evidence/spec-lock/dbb8ca0f1c33a768f40a8eed6ec67496/baseline-inputs.json) |
| `baseline.json` | [link](https://assets.agee.dev/evidence/spec-lock/2c82ff90614ea683264aa86be4d7dbbd/baseline.json) |
| `candidate-review-1.json` | [link](https://assets.agee.dev/evidence/spec-lock/42034f3f03c1d190ba05826dffe778da/candidate-review-1.json) |
| `candidate-review-2.json` | [link](https://assets.agee.dev/evidence/spec-lock/8d73a749a6dfb66d307c93c3bb3246de/candidate-review-2.json) |
| `candidate.json` | [link](https://assets.agee.dev/evidence/spec-lock/194d4c43c5c03e0c55afad6562e2fe18/candidate.json) |
| `checkout-symlink.txt` | [link](https://assets.agee.dev/evidence/spec-lock/35873f7f8ceabf14bd78cc53c9b565b2/checkout-symlink.txt) |
| `complete-set.txt` | [link](https://assets.agee.dev/evidence/spec-lock/5248b38c0358408ff0168b82a4f87552/complete-set.txt) |
| `disclosure.txt` | [link](https://assets.agee.dev/evidence/spec-lock/2b20f77d3a608b46318618bc083b9abf/disclosure.txt) |
| `failed-export.txt` | [link](https://assets.agee.dev/evidence/spec-lock/7cf6ca96653d81e45d5a1eb145d610b8/failed-export.txt) |
| `final-verifier/candidate.json` | [link](https://assets.agee.dev/evidence/spec-lock/4d6565835b695ba3dc13116c52007eff/candidate.json) |
| `final-verifier/command-1.stderr` | [link](https://assets.agee.dev/evidence/spec-lock/6c1aa71647091bb07100de17cfdadbfd/command-1.stderr) |
| `final-verifier/command-1.stdout` | [link](https://assets.agee.dev/evidence/spec-lock/f68ced95c94b1986e46d74f7af9f26ee/command-1.stdout) |
| `final-verifier/command-2.stderr` | [link](https://assets.agee.dev/evidence/spec-lock/6f2cd09bfba9b196f4f617d1989872fd/command-2.stderr) |
| `final-verifier/command-2.stdout` | [link](https://assets.agee.dev/evidence/spec-lock/419040246e3395dffab5dc3a5914e6b5/command-2.stdout) |
| `final-verifier/command-3.stderr` | [link](https://assets.agee.dev/evidence/spec-lock/b03dd1f74ad1c7f780e2edb2442e5a0f/command-3.stderr) |
| `final-verifier/command-3.stdout` | [link](https://assets.agee.dev/evidence/spec-lock/0392e7dcf97f68e15bb2c6319c2d7f77/command-3.stdout) |
| `final-verifier/command-4.stderr` | [link](https://assets.agee.dev/evidence/spec-lock/ed4739d24bf662fb397f43a86710ecab/command-4.stderr) |
| `final-verifier/command-4.stdout` | [link](https://assets.agee.dev/evidence/spec-lock/8c99ecd7085587086e74b8f396b85005/command-4.stdout) |
| `final-verifier/execution-metadata.json` | [link](https://assets.agee.dev/evidence/spec-lock/dfcefdfabbaffba093099204de717c57/execution-metadata.json) |
| `final-verifier/impact.json` | [link](https://assets.agee.dev/evidence/spec-lock/82b4796ce3996e7306c8739f9e8185c1/impact.json) |
| `final-verifier/independent-recomputation.json` | [link](https://assets.agee.dev/evidence/spec-lock/a7041a9038ebf9a3129551cd30584fcb/independent-recomputation.json) |
| `final-verifier/record-inspection.json` | [link](https://assets.agee.dev/evidence/spec-lock/1032f4cdc306e700def14669feef1673/record-inspection.json) |
| `full-suite-cleanup-red.txt` | [link](https://assets.agee.dev/evidence/spec-lock/1bfe9aa7a70dcaf74d92e2f50ed34db1/full-suite-cleanup-red.txt) |
| `full-suite-final.txt` | [link](https://assets.agee.dev/evidence/spec-lock/0949cd9d50a9c3f724248ea5e78ca671/full-suite-final.txt) |
| `full-suite-invocation.json` | [link](https://assets.agee.dev/evidence/spec-lock/a9fd9fa5b5cd36d22f3e0131ffc00361/full-suite-invocation.json) |
| `full-suite-round-3-final.txt` | [link](https://assets.agee.dev/evidence/spec-lock/111c5d748a672bb8c25962a1727e1d9a/full-suite-round-3-final.txt) |
| `full-suite-round-3.txt` | [link](https://assets.agee.dev/evidence/spec-lock/e967b2140b77d3bab20df488881e0670/full-suite-round-3.txt) |
| `full-suite.txt` | [link](https://assets.agee.dev/evidence/spec-lock/08449b5e3ad323437944a926c1686500/full-suite.txt) |
| `identity.txt` | [link](https://assets.agee.dev/evidence/spec-lock/2922c29fec99421293032c6a76c30de4/identity.txt) |
| `impact-review-1.json` | [link](https://assets.agee.dev/evidence/spec-lock/1de6630c7da2943ef8e6c3820ca421d5/impact-review-1.json) |
| `impact-review-2.json` | [link](https://assets.agee.dev/evidence/spec-lock/bddca13417f7068bd98f1100ecd1d547/impact-review-2.json) |
| `impact.json` | [link](https://assets.agee.dev/evidence/spec-lock/7cb3f749ef226da284d662724942b409/impact.json) |
| `input-change.txt` | [link](https://assets.agee.dev/evidence/spec-lock/faec075bfbd0bb30c46911779888446b/input-change.txt) |
| `mutations.json` | [link](https://assets.agee.dev/evidence/spec-lock/2e015cfd6cddd276769a24960c9999d8/mutations.json) |
| `observation.txt` | [link](https://assets.agee.dev/evidence/spec-lock/9fa0ccbc6fb3d436abc68b0d9e5c5815/observation.txt) |
| `output-digest.txt` | [link](https://assets.agee.dev/evidence/spec-lock/a9bb53b926f3cb4a6b34981e248054e6/output-digest.txt) |
| `receipt-mutations.json` | [link](https://assets.agee.dev/evidence/spec-lock/e77f73b7104f8dbdf10addce55c85727/receipt-mutations.json) |
| `red-capture.txt` | [link](https://assets.agee.dev/evidence/spec-lock/c59a9f00e3cd4614703c2d05af851df2/red-capture.txt) |
| `red-export.txt` | [link](https://assets.agee.dev/evidence/spec-lock/8220cc77cb570f0368a4300ddc03f6b7/red-export.txt) |
| `red-review-1.txt` | [link](https://assets.agee.dev/evidence/spec-lock/6f4f7795840084ef4469f0fb91e7a8d4/red-review-1.txt) |
| `red-review-2-extra.txt` | [link](https://assets.agee.dev/evidence/spec-lock/afc593be2aa5c84c50e3cfa4dac358c5/red-review-2-extra.txt) |
| `red-review-2.txt` | [link](https://assets.agee.dev/evidence/spec-lock/cd1b43b701552f049577a30c8d0b4dd6/red-review-2.txt) |
| `red-source-bytes.txt` | [link](https://assets.agee.dev/evidence/spec-lock/6c4efcbbbe132ca7b7b63cf5dd554b50/red-source-bytes.txt) |
| `review-1.md` | [link](https://assets.agee.dev/evidence/spec-lock/3fc66206654518102c2ef93f3322d3ad/review-1.md) |
| `review-2-usage.json` | [link](https://assets.agee.dev/evidence/spec-lock/2e2e76fe4133659b25bb8e5c807278d7/review-2-usage.json) |
| `review-2.md` | [link](https://assets.agee.dev/evidence/spec-lock/a0d284b213aa0e05c6d40734efecfd4d/review-2.md) |
| `review-3.md` | [link](https://assets.agee.dev/evidence/spec-lock/021f5036a9364ccd4417606482934c27/review-3.md) |
| `review-request-1.txt` | [link](https://assets.agee.dev/evidence/spec-lock/5c3963e55da6ec58837a49c992b1ace3/review-request-1.txt) |
| `review-request-2.txt` | [link](https://assets.agee.dev/evidence/spec-lock/cdf5045656ed24ce2cd329c9d7b8b077/review-request-2.txt) |
| `review-request-3.txt` | [link](https://assets.agee.dev/evidence/spec-lock/e5ae8829086e06ce1331ed9b1eb7660f/review-request-3.txt) |
| `review-request.txt` | [link](https://assets.agee.dev/evidence/spec-lock/820319c6f6f3633158d0b1f991913d84/review-request.txt) |
| `revision.txt` | [link](https://assets.agee.dev/evidence/spec-lock/3149bbe545f69ef92fb36f1dbd1434f8/revision.txt) |
| `same-spec.txt` | [link](https://assets.agee.dev/evidence/spec-lock/179f06708abc6fb4c48940aefb03ff46/same-spec.txt) |
| `two-dot-prefix.txt` | [link](https://assets.agee.dev/evidence/spec-lock/8fd27b753f177b6b3effbe9abdd94b38/two-dot-prefix.txt) |
