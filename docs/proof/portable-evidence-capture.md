---
tags: [portable-evidence, candidate, cli]
date: 2026-09-28
issue: local-record-and-check
spec: docs/specs/portable-evidence-capture.md
walked: pending
---
# Record and check a complete verification run

Pre-commit verification is complete. No activation, public push or merge.
The independent replay of the implementation commit remains pending.

## What I walked

AC2, AC3, AC4 and AC8 have targeted CLI tests in
`test/portable-evidence.test.mjs`. The frozen AC12 walk produced 36 baseline
and 36 candidate checks, three runs of each logical case. Baseline accepted
21/33 invalid attempts and refused 0/3 valid attempts. Candidate observations,
raw times and capture outcomes are retained below this proof directory.

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
Opus 5.5 high under the owner's replacement rule. Exact commands and final receipts
will be listed here. This CLI-only change has no Design or browser review stage.

## Limits

Local source/session records are unauthenticated. Input hashes detect persistent
changes but do not prevent writes or transient changes. No generic response hook,
semantic red/oracle/golden enforcement, required policy or selected-repository
activation is implemented. No production reliability or productivity estimate follows
from this synthetic corpus. Token and cost measurements are unavailable, not zero.

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
