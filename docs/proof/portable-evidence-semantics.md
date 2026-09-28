---
tags: [portable-evidence, candidate, semantic, cli]
date: 2026-09-28
issue: local-meaningful-test-evidence
spec: docs/specs/portable-evidence-semantics.md
walked: a73b05e77b2e4ea4fa8f358bdd97b96d1cea4b71
---
# Require meaningful failure and expected-result evidence

The local candidate has completed four code-review rounds and their repairs.
The final full suite and independent replay of the exact source commit passed. No push,
merge, real hook activation or repository enrollment is part of this task.

## What I walked

| Criterion | Test, assertion and independent expected answer | Observed evidence |
|---|---|---|
| AC5 | The synthetic requirement says double(7) equals 14. The red-green CLI fixtures capture the same assertion failing with 0 and passing with 14. Missing, rejected, unlinked, altered or unrelated red evidence must refuse. Command, working directory and selected test bytes must match. | Targeted tests and the full suite cover actual syntax/dependency failures, version downgrade, command/test substitution, quoted control paths and a malformed control baseline. The latter must refuse without creating or overwriting a file. Observed reds and repaired greens are retained below. |
| AC6 | The oracle CLI fixture binds literal 14 to selected requirement and expectation files. A missing, rejected or stale review must refuse. | Positive control passes; missing/rejected/stale cases refuse. Removing oracle enforcement makes the refusal assertion fail. |
| AC7 | The golden CLI fixture changes saved expected output from 0 to 14. Approval must cover exact old/new digests before use. | Missing/wrong approval refuses before capture; missing/wrong/late committed reviews and later edits refuse. A correctly approved 2 MiB golden passes capture/export/check with an approved no-red reason. Unchanged goldens reject duplicate/stale reviews. |
| AC13 | Thirteen frozen logical cases, three repeats each. Recompute outcomes and medians from raw CLI output; tampered outcomes or missing denominators must refuse. | Baseline accepts 36/36 invalid attempts; candidate accepts 0/36. Both refuse 0/3 valid attempts. Actual receipt CLI tampering tests pass. Exact baseline inputs were saved before production edits. |

Run the semantic tests with `node --test test/semantic-evidence.test.mjs`. The older
capture tests remain regression obligations. The offline walk is
`node test/portable-evidence-walk.mjs semantic candidate <output.json>`; the receipt is
`node test/semantic-receipt.mjs <baseline.json> <candidate.json> <impact.json>`.

## Measured impact and scope

The fixed baseline is `068dcdd428ddc029b4ccad8c2e4285da62fc7aea`, checker
`0.0.0+d03b071e9c55`. Frozen cases and baseline hashes are in
[`portable-evidence-semantics/frozen.json`](https://assets.agee.dev/evidence/spec-lock/b38cd51f7fc9a3015513ba5f3dcfb8c0/frozen.json). The raw baseline preserves exact
base/red/green input bytes and every committed case artifact before cleanup.

The baseline uses actual capture/export/check-candidate commands. A fixture adapter
assembles then-unknown semantic fields from those exports. The candidate uses the
production export bundle and check-semantic. The repair added an explicit selected-test
list; the frozen baseline omitted that ignored field. These are paired logical cases,
not identical serialized manifests. The two unrelated-failure corpus cases change
review classifications on an assertion capture. Separate tests capture actual syntax
and missing-dependency errors. Neither is presented as the other.

There are 39 checker calls per revision, two automatic capture records per revision,
and no unexecuted cases in this corpus. Only checker timings are paired; capture and
export are extra costs. Warm denotes repetitions 1 and 2 after repetition 0, without
forcing cache state or controlling machine load. Node v26.7.0 and Git 2.54.0,
Apple Git-157, ran the author measurements. Whole-task tokens and cost are unavailable.
No reliability or productivity claim extends beyond these synthetic cases.

Current pre-commit raw observations and recomputed medians/ranges are [`candidate.json`](https://assets.agee.dev/evidence/spec-lock/892ab6bb7d87b53f23ed58f5d3658835/candidate.json)
and [`impact.json`](https://assets.agee.dev/evidence/spec-lock/80758bcaae4275f3afad10bccbf5986d/impact.json) below this proof directory. Earlier reviewed samples remain under
review-1 through review-4 suffixes; the development sample is not final evidence.
The final independent replay is retained under `final-verifier/` and does not replace them.

## Regressions and controls

- [`red-missing-review.txt`](https://assets.agee.dev/evidence/spec-lock/bcaaf6e6c7bde341e4a0de3c079a7eb9/red-missing-review.txt) shows the prerequisite checker accepting missing red evidence.
- [`red-review-1.txt`](https://assets.agee.dev/evidence/spec-lock/4b183d9d80fcf09d3cef384d5ec981c8/red-review-1.txt) records version-1 downgrade, substituted test bytes and large-golden
  false refusal. [`green-review-1.txt`](https://assets.agee.dev/evidence/spec-lock/741cc4559e4bcaaf090c8bdb60d99db7/green-review-1.txt) records their initial repairs.
- [`red-review-2.txt`](https://assets.agee.dev/evidence/spec-lock/bbc9b35d07d2e32081c394ad89597f79/red-review-2.txt) records command substitution, unchanged-golden and empty-evidence
  reporting failures. [`green-review-2.txt`](https://assets.agee.dev/evidence/spec-lock/c9754447f6eb6b4dc6092a55ec67ad4e/green-review-2.txt) also covers isolated test-byte equality.
- [`red-review-3.txt`](https://assets.agee.dev/evidence/spec-lock/146e4a8c5bc746ca07f584e267b5dcdb/red-review-3.txt) and [`green-review-3.txt`](https://assets.agee.dev/evidence/spec-lock/4541fdbdb7c24b93b1918f20008fd06f/green-review-3.txt) cover accented and newline-containing paths.
- [`red-review-4.txt`](https://assets.agee.dev/evidence/spec-lock/ba2d88fb8c717eb4f290fd32aaa6e6ad/red-review-4.txt) records refused evidence creating a file. Its repaired test also
  preserves an existing sentinel file. [`green-review-4.txt`](https://assets.agee.dev/evidence/spec-lock/943ae818cb668d97a8b4b31f8c27efb8/green-review-4.txt) retains the first green;
  the final suite and replay cover the expanded sentinel assertion.
- [`red-external-cwd.txt`](https://assets.agee.dev/evidence/spec-lock/bd743723ffa13ce975a8aa4326f4ac3e/red-external-cwd.txt) and [`green-external-cwd.txt`](https://assets.agee.dev/evidence/spec-lock/1a015dd0fed4d72213c102b1f36e2d03/green-external-cwd.txt) show the receipt test no longer
  depends on the caller's directory.

The final [`mutations.json`](https://assets.agee.dev/evidence/spec-lock/f3e818627432baf8b58277db198a0eb7/mutations.json) names the exact source and mutated SHA-256 values, patch,
command, exit and transcript for each of five guard-removal checks. The companion
[`control-source-hashes.json`](https://assets.agee.dev/evidence/spec-lock/cf56ff490be90c4413fb5aec303a1d95/control-source-hashes.json) identifies the full copied code/test input set. All five
must fail their intended assertions. Prior transcripts remain in
`controls-before-review-2/` and `controls-before-final/`. Mutations use private
throwaway copies. Original private outputs remain unchanged; public transcript copies
normalize host paths only and preserve incidental whitespace.

## Code-review ownership and receipts

The fixed comparison base for all rounds is the prerequisite commit above.

| Round | Owner | Findings and disposition | Receipt |
|---|---|---|---|
| 1 | Codex gpt-6-astra, high | Three implementation defects plus acceptance coverage gaps. Added observed regressions and repaired all three. | [`portable-evidence-semantics/review-1.md`](https://assets.agee.dev/evidence/spec-lock/836473d5a3e6d13e7fb09d6a6fe75feb/review-1.md) |
| 2 | Claude Opus 5.5, high | Command substitution, unchanged-golden review validation and an inaccurate zero-record message, plus isolated-test gaps. Repaired with new tests and controls. | [`portable-evidence-semantics/review-2.md`](https://assets.agee.dev/evidence/spec-lock/a188618e649d8b72b0253b87844d5204/review-2.md) |
| 3 | Codex gpt-6-astra, high | One quoted-control-path defect and its missing coverage. Reused the existing NUL-delimited helper; two path tests pass. | [`portable-evidence-semantics/review-3.md`](https://assets.agee.dev/evidence/spec-lock/516b74e5d7ea3622da7ee05a05b85247/review-3.md) |
| 4 | Claude Opus 5.5, high | Untrusted control baseline could become a Git output option; mutation provenance, receipt cwd and stale proof findings. Validated control metadata, stopped invalid comparisons, used the validated base, added a no-write regression, recorded patches/hashes and repaired the receipt path. | [`portable-evidence-semantics/review-4.md`](https://assets.agee.dev/evidence/spec-lock/3280f49279cc0ff1681ba89797841a51/review-4.md) |

No fifth code-review round ran. Post-round-4 repairs are covered by their observed
red/green, another full-suite run and the required final independent execution.
They have not received an additional code-review round. The final execution is a
separate Evidence stage, not a substitute or a renamed fifth review.

The four request snapshots are [`review-request-1.txt`](https://assets.agee.dev/evidence/spec-lock/1e6e436e10cdc1238db6be7abd5c425a/review-request-1.txt) through [`review-request-4.txt`](https://assets.agee.dev/evidence/spec-lock/834fb364682e60b1853319e11c36b7df/review-request-4.txt)
below this proof directory. Both Opus modelUsage records name only
`claude-opus-5-5`, with fallback disabled. Their provider-reported partial costs are
$1.5480876000000003 and $1.9636741999999998, not whole-task or per-capture totals.
No capacity fallback occurred.

The commands used the required forms below. `$REVIEW_RECORDS` replaces only the
private stdout directory; exact host commands and original results are in the private
execution record linked by the handoff.

```sh
codex exec --skip-git-repo-check --model "${AGENTS_REVIEW_MODEL:-gpt-6-astra}" -c model_reasoning_effort="high" -o docs/proof/portable-evidence-semantics/review-1.md "$(cat docs/proof/portable-evidence-semantics/review-request.txt)" < /dev/null > "$REVIEW_RECORDS/review-1.raw.txt" 2>&1
PATH="$HOME/.local/bin:$PATH" CLAUDE_CODE_NO_MODEL_FALLBACK=1 CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK=1 claude -p --model claude-opus-5-5 --effort high --output-format json "$(cat docs/proof/portable-evidence-semantics/review-request.txt)" < /dev/null > "$REVIEW_RECORDS/review-2.json"
codex exec --skip-git-repo-check --model "${AGENTS_REVIEW_MODEL:-gpt-6-astra}" -c model_reasoning_effort="high" -o docs/proof/portable-evidence-semantics/review-3.md "$(cat docs/proof/portable-evidence-semantics/review-request.txt)" < /dev/null > "$REVIEW_RECORDS/review-3.raw.txt" 2>&1
PATH="$HOME/.local/bin:$PATH" CLAUDE_CODE_NO_MODEL_FALLBACK=1 CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK=1 claude -p --model claude-opus-5-5 --effort high --output-format json "$(cat docs/proof/portable-evidence-semantics/review-request.txt)" < /dev/null > "$REVIEW_RECORDS/review-4.json"
```

This CLI-only change has no Design review, browser suite or screen-video requirement.
No separate project receipt or delivery review is configured for this local commit.

## Limits

The verifier judges whether a symptom and expected answer support the requirement.
The checker validates required reviews and exact captured/committed bindings. Local
session labels, reviews and timestamps are unauthenticated. Selected snapshot paths
are approved scope, not universal discovery. There is no protected-write boundary,
chat interception, required-repository policy or Claude consumer here. The binding-only
candidate command remains available and discloses its weaker scope. Approved commands
are trusted local commands, not sandboxed programs, and must not daemonize.

## Final pre-commit result

`"$HOME/.agents/bin/full-suite-slot" npm test` exited 0 with 65 tests: 64 passed, zero failed, one opt-in remote canary skipped. Complete output is [`portable-evidence-semantics/full-suite-final.txt`](https://assets.agee.dev/evidence/spec-lock/dbf1c99f417cb290a94f30cce96675f1/full-suite-final.txt). All 17 semantic tests passed, including the final file-creation and sentinel-preservation assertions. All five current mutation patches failed their intended assertions; their source hashes match the files being committed.

The final pre-commit valid-case median is 1839.306 ms, versus 916.435 ms at baseline, adding 922.871 ms. Invalid acceptances remain 0/36 and valid refusals 0/3. Full per-case ranges and all historical samples remain saved.

## Final independent execution

Owner: Evidence verifier session `01a0e8f5-2cd9-7ca2-ba8f-2dfa2ecd0774`, distinct from author `01a0e87d-1020-7d73-907e-4f3d1b1a6a92`. It ran in a separate detached checkout at `a73b05e77b2e4ea4fa8f358bdd97b96d1cea4b71`, checker `0.0.0+e3391fcceabf`. This is an independent manual rerun.

All five approved commands exited 0 within their 240-second limits. The paired capture/semantic tests reported `tests 35`, `pass 35`, `fail 0`, `skipped 0`. The receipt regression also passed as one test from outside the checkout. Before and after every command, source revision was exact, Git status was empty and all nine approved input hashes matched. The verifier approved those bytes against the spec. Runtime was Node v26.7.0 with Apple Git 2.54.0; runtime binary hash, environment and absent dependencies are recorded.

AC5, AC6, AC7 and AC13 each received a supported verdict. The final file-write regression passed both no-create and unchanged-sentinel assertions. See the [per-criterion report](https://assets.agee.dev/evidence/spec-lock/e69dda118cfe0e92c95d90fc54905fcf/report.md), [execution metadata](https://assets.agee.dev/evidence/spec-lock/f9a602fbf816ea07d4c8e38e5238bdb8/metadata.json) and [complete test output](https://assets.agee.dev/evidence/spec-lock/95182bef1316dfebddf7b45eb5e098b9/targeted.stdout).

The independently captured 39 checker calls reproduced 0/36 invalid acceptances and 0/3 valid refusals, compared with baseline 36/36 and 0/3. The verifier recomputed every count, median, range and added median with separate arithmetic, matching the receipt. The valid-case median was 1311.576 ms versus baseline 916.435 ms, adding 395.141 ms. Its range was 1258.040 to 1339.674 ms. See [raw candidate](https://assets.agee.dev/evidence/spec-lock/9f27496c5caec5768d0b15222ca8cd41/candidate.json), [paired receipt](https://assets.agee.dev/evidence/spec-lock/c4b83b3a69b8beb11b3123134335e23f/impact.json) and [independent calculation](https://assets.agee.dev/evidence/spec-lock/e73fcd10a4919c80ff93f3cb2848277f/independent-calculations.json). This single sample does not control machine load or cache state.

The verifier checked all 22 copied mutation-input hashes against the source commit and reconstructed the exact changed bytes from all five saved patches. Historical red and mutation executions were record inspection, not independently rerun. Historical red captures lack the final replay's before/after revision and status metadata; their source provenance is correspondingly weaker. The pre-fix file-creation failure predates the added sentinel assertion. These limits do not change the observed final execution results.

The parent separately checked command exits, output hashes, exact clean revisions, approved input bytes and the paired denominators. Public records normalize only private host paths. [Projection hashes](https://assets.agee.dev/evidence/spec-lock/ede56e518347d1a85209c4ebaec1dda8/projection.json) identify changed copies; private originals remain unchanged. No code or test changed after the walked commit.

## Evidence files

These files were committed under `docs/proof/portable-evidence-semantics/` and now live only on Cloudflare, behind sign-in. The commit named in `walked` is in the history before it was rebuilt without them; the code and tests here are the same, except that `test/policy-evidence.test.mjs` reads its baseline fixture from `test/policy-baseline.json`.

| File | Link |
|---|---|
| `baseline.json` | [link](https://assets.agee.dev/evidence/spec-lock/51e003520f115b0b78d33db5f77ba90c/baseline.json) |
| `candidate-development.json` | [link](https://assets.agee.dev/evidence/spec-lock/10d040f98b88b594c6bbafe1c28b1cea/candidate-development.json) |
| `candidate-review-1.json` | [link](https://assets.agee.dev/evidence/spec-lock/0dfc1f9955acfdc5341c7c94a68f1d89/candidate-review-1.json) |
| `candidate-review-2.json` | [link](https://assets.agee.dev/evidence/spec-lock/9aa888b2f2c84a5920c2adce420f031b/candidate-review-2.json) |
| `candidate-review-3.json` | [link](https://assets.agee.dev/evidence/spec-lock/a9a4ee5671cc2929821e39abc8418ce9/candidate-review-3.json) |
| `candidate-review-4.json` | [link](https://assets.agee.dev/evidence/spec-lock/3c60d46fa733d620c3516a1d07e8297b/candidate-review-4.json) |
| `candidate.json` | [link](https://assets.agee.dev/evidence/spec-lock/892ab6bb7d87b53f23ed58f5d3658835/candidate.json) |
| `control-source-hashes.json` | [link](https://assets.agee.dev/evidence/spec-lock/cf56ff490be90c4413fb5aec303a1d95/control-source-hashes.json) |
| `controls-before-final/golden-review.txt` | [link](https://assets.agee.dev/evidence/spec-lock/5d0955e7901be0038943a62a2fe02608/golden-review.txt) |
| `controls-before-final/mutations.json` | [link](https://assets.agee.dev/evidence/spec-lock/ee008f48fc2204f9403c39942c582ced/mutations.json) |
| `controls-before-final/oracle-review.txt` | [link](https://assets.agee.dev/evidence/spec-lock/7fb2b1e097f93a8307781ccd4cb176cc/oracle-review.txt) |
| `controls-before-final/red-command.txt` | [link](https://assets.agee.dev/evidence/spec-lock/7afb32259808781c67d2f0d54a3d1ee3/red-command.txt) |
| `controls-before-final/red-review.txt` | [link](https://assets.agee.dev/evidence/spec-lock/adfaf4f9a162828296e76e824902b05c/red-review.txt) |
| `controls-before-final/test-equality.txt` | [link](https://assets.agee.dev/evidence/spec-lock/206c50728ef5e9b3be73f58cde29719c/test-equality.txt) |
| `controls-before-review-2/golden-review.txt` | [link](https://assets.agee.dev/evidence/spec-lock/6f7d5fdf543ce0214c6432d4dd40fdc7/golden-review.txt) |
| `controls-before-review-2/mutations.json` | [link](https://assets.agee.dev/evidence/spec-lock/212a83d2719c4baf081f1e6781fc919c/mutations.json) |
| `controls-before-review-2/oracle-review.txt` | [link](https://assets.agee.dev/evidence/spec-lock/e86c6924f0a60e811af55a1026f1b5e9/oracle-review.txt) |
| `controls-before-review-2/red-review.txt` | [link](https://assets.agee.dev/evidence/spec-lock/7b6bf1be240dc16f83ec23df299e6e13/red-review.txt) |
| `final-verifier/approved-inputs.json` | [link](https://assets.agee.dev/evidence/spec-lock/7939e2e403f0a20dbb0fd08f4a96869e/approved-inputs.json) |
| `final-verifier/candidate.json` | [link](https://assets.agee.dev/evidence/spec-lock/9f27496c5caec5768d0b15222ca8cd41/candidate.json) |
| `final-verifier/candidate.stderr` | [link](https://assets.agee.dev/evidence/spec-lock/85a02dd4687ca0ed03227987b09b7bf8/candidate.stderr) |
| `final-verifier/candidate.stdout` | [link](https://assets.agee.dev/evidence/spec-lock/1e3333e06c2263e97ac8c245fb3a255a/candidate.stdout) |
| `final-verifier/external-cwd.stderr` | [link](https://assets.agee.dev/evidence/spec-lock/1d95c0126f4aed0e502235615b2cdb90/external-cwd.stderr) |
| `final-verifier/external-cwd.stdout` | [link](https://assets.agee.dev/evidence/spec-lock/34022b7eaa6c68fb459934f418781546/external-cwd.stdout) |
| `final-verifier/impact.json` | [link](https://assets.agee.dev/evidence/spec-lock/c4b83b3a69b8beb11b3123134335e23f/impact.json) |
| `final-verifier/independent-calculations.json` | [link](https://assets.agee.dev/evidence/spec-lock/e73fcd10a4919c80ff93f3cb2848277f/independent-calculations.json) |
| `final-verifier/metadata.json` | [link](https://assets.agee.dev/evidence/spec-lock/f9a602fbf816ea07d4c8e38e5238bdb8/metadata.json) |
| `final-verifier/projection.json` | [link](https://assets.agee.dev/evidence/spec-lock/ede56e518347d1a85209c4ebaec1dda8/projection.json) |
| `final-verifier/receipt-check.stderr` | [link](https://assets.agee.dev/evidence/spec-lock/4c7f490ab6033baf1364d6abdc9c720d/receipt-check.stderr) |
| `final-verifier/receipt-check.stdout` | [link](https://assets.agee.dev/evidence/spec-lock/ca0bae9dedef391abc6d3f0151ce60af/receipt-check.stdout) |
| `final-verifier/receipt-write.stderr` | [link](https://assets.agee.dev/evidence/spec-lock/1435b6d8e5834670c72229f325e90a73/receipt-write.stderr) |
| `final-verifier/receipt-write.stdout` | [link](https://assets.agee.dev/evidence/spec-lock/1054c62416b1455ba0456b4095b098ba/receipt-write.stdout) |
| `final-verifier/record-inspection.json` | [link](https://assets.agee.dev/evidence/spec-lock/0d43243ec4e90caab24a15edb8a999e6/record-inspection.json) |
| `final-verifier/report.md` | [link](https://assets.agee.dev/evidence/spec-lock/e69dda118cfe0e92c95d90fc54905fcf/report.md) |
| `final-verifier/targeted.stderr` | [link](https://assets.agee.dev/evidence/spec-lock/3de5a89e759a330dae86b781c2e7380f/targeted.stderr) |
| `final-verifier/targeted.stdout` | [link](https://assets.agee.dev/evidence/spec-lock/95182bef1316dfebddf7b45eb5e098b9/targeted.stdout) |
| `frozen.json` | [link](https://assets.agee.dev/evidence/spec-lock/b38cd51f7fc9a3015513ba5f3dcfb8c0/frozen.json) |
| `full-suite-final.txt` | [link](https://assets.agee.dev/evidence/spec-lock/dbf1c99f417cb290a94f30cce96675f1/full-suite-final.txt) |
| `full-suite-review-1.txt` | [link](https://assets.agee.dev/evidence/spec-lock/64155285416272c8c28add80178b0b7c/full-suite-review-1.txt) |
| `full-suite-review-2.txt` | [link](https://assets.agee.dev/evidence/spec-lock/de671fac7b2d16a5297922b25594869a/full-suite-review-2.txt) |
| `full-suite-review-3.txt` | [link](https://assets.agee.dev/evidence/spec-lock/c48af226436e565c08919b4068b7041f/full-suite-review-3.txt) |
| `full-suite.txt` | [link](https://assets.agee.dev/evidence/spec-lock/8ab0e215f2d31b04d9a137b84af1b116/full-suite.txt) |
| `golden-review.patch` | [link](https://assets.agee.dev/evidence/spec-lock/fd1a76c9b1e742258c3c6112a9bb2351/golden-review.patch) |
| `golden-review.txt` | [link](https://assets.agee.dev/evidence/spec-lock/bbd084edeb5aca3e6eb597146151d12d/golden-review.txt) |
| `green-external-cwd.txt` | [link](https://assets.agee.dev/evidence/spec-lock/1a015dd0fed4d72213c102b1f36e2d03/green-external-cwd.txt) |
| `green-review-1.txt` | [link](https://assets.agee.dev/evidence/spec-lock/741cc4559e4bcaaf090c8bdb60d99db7/green-review-1.txt) |
| `green-review-2.txt` | [link](https://assets.agee.dev/evidence/spec-lock/c9754447f6eb6b4dc6092a55ec67ad4e/green-review-2.txt) |
| `green-review-3.txt` | [link](https://assets.agee.dev/evidence/spec-lock/4541fdbdb7c24b93b1918f20008fd06f/green-review-3.txt) |
| `green-review-4.txt` | [link](https://assets.agee.dev/evidence/spec-lock/943ae818cb668d97a8b4b31f8c27efb8/green-review-4.txt) |
| `impact-review-1.json` | [link](https://assets.agee.dev/evidence/spec-lock/3ff959fda12e4c751866656ecf553c6d/impact-review-1.json) |
| `impact-review-2.json` | [link](https://assets.agee.dev/evidence/spec-lock/3e74666eb166271e8891047a5ce6f803/impact-review-2.json) |
| `impact-review-3.json` | [link](https://assets.agee.dev/evidence/spec-lock/1157fcd96012bb37a3e805607ec02ae2/impact-review-3.json) |
| `impact-review-4.json` | [link](https://assets.agee.dev/evidence/spec-lock/3a797f2f465a754bd4fb3e5f467eff36/impact-review-4.json) |
| `impact.json` | [link](https://assets.agee.dev/evidence/spec-lock/80758bcaae4275f3afad10bccbf5986d/impact.json) |
| `mutations.json` | [link](https://assets.agee.dev/evidence/spec-lock/f3e818627432baf8b58277db198a0eb7/mutations.json) |
| `oracle-review.patch` | [link](https://assets.agee.dev/evidence/spec-lock/191f9bcf885f7768c1eeea52a2218366/oracle-review.patch) |
| `oracle-review.txt` | [link](https://assets.agee.dev/evidence/spec-lock/8e1a51495d901786b14a3955ad809afe/oracle-review.txt) |
| `red-command.patch` | [link](https://assets.agee.dev/evidence/spec-lock/eea080ab947950a52d3ef42e626debcd/red-command.patch) |
| `red-command.txt` | [link](https://assets.agee.dev/evidence/spec-lock/ccd872b6d1c4960fc0fbcf2d6a41b829/red-command.txt) |
| `red-external-cwd.txt` | [link](https://assets.agee.dev/evidence/spec-lock/bd743723ffa13ce975a8aa4326f4ac3e/red-external-cwd.txt) |
| `red-missing-review.txt` | [link](https://assets.agee.dev/evidence/spec-lock/bcaaf6e6c7bde341e4a0de3c079a7eb9/red-missing-review.txt) |
| `red-review-1.txt` | [link](https://assets.agee.dev/evidence/spec-lock/4b183d9d80fcf09d3cef384d5ec981c8/red-review-1.txt) |
| `red-review-2.txt` | [link](https://assets.agee.dev/evidence/spec-lock/bbc9b35d07d2e32081c394ad89597f79/red-review-2.txt) |
| `red-review-3.txt` | [link](https://assets.agee.dev/evidence/spec-lock/146e4a8c5bc746ca07f584e267b5dcdb/red-review-3.txt) |
| `red-review-4.txt` | [link](https://assets.agee.dev/evidence/spec-lock/ba2d88fb8c717eb4f290fd32aaa6e6ad/red-review-4.txt) |
| `red-review.patch` | [link](https://assets.agee.dev/evidence/spec-lock/447f2384782bab1c85d26d12b88c21be/red-review.patch) |
| `red-review.txt` | [link](https://assets.agee.dev/evidence/spec-lock/1928fbc92bf148dcc959942162b0c25d/red-review.txt) |
| `review-1.md` | [link](https://assets.agee.dev/evidence/spec-lock/836473d5a3e6d13e7fb09d6a6fe75feb/review-1.md) |
| `review-2-source-hashes.json` | [link](https://assets.agee.dev/evidence/spec-lock/082f92a2a0b06757da545a44eef625f4/review-2-source-hashes.json) |
| `review-2-usage.json` | [link](https://assets.agee.dev/evidence/spec-lock/22c69d234ade0664a09d71b51f5dfc85/review-2-usage.json) |
| `review-2.md` | [link](https://assets.agee.dev/evidence/spec-lock/a188618e649d8b72b0253b87844d5204/review-2.md) |
| `review-3.md` | [link](https://assets.agee.dev/evidence/spec-lock/516b74e5d7ea3622da7ee05a05b85247/review-3.md) |
| `review-4-source-hashes.json` | [link](https://assets.agee.dev/evidence/spec-lock/18488d224ff4285e0c793d151b1815de/review-4-source-hashes.json) |
| `review-4-usage.json` | [link](https://assets.agee.dev/evidence/spec-lock/d37800d70c47ac2874699346b6b4d752/review-4-usage.json) |
| `review-4.md` | [link](https://assets.agee.dev/evidence/spec-lock/3280f49279cc0ff1681ba89797841a51/review-4.md) |
| `review-request-1.txt` | [link](https://assets.agee.dev/evidence/spec-lock/1e6e436e10cdc1238db6be7abd5c425a/review-request-1.txt) |
| `review-request-2.txt` | [link](https://assets.agee.dev/evidence/spec-lock/29bf0dea1e1f90d92ce0f8a081df7c13/review-request-2.txt) |
| `review-request-3.txt` | [link](https://assets.agee.dev/evidence/spec-lock/17d473f954546467a25ba2240d2c711f/review-request-3.txt) |
| `review-request-4.txt` | [link](https://assets.agee.dev/evidence/spec-lock/834fb364682e60b1853319e11c36b7df/review-request-4.txt) |
| `review-request.txt` | [link](https://assets.agee.dev/evidence/spec-lock/efe9e8283a0a487f60632e5723fe41b3/review-request.txt) |
| `targeted.txt` | [link](https://assets.agee.dev/evidence/spec-lock/a238f1d923029674e66d1568d7bbadbb/targeted.txt) |
| `test-equality.patch` | [link](https://assets.agee.dev/evidence/spec-lock/2642a2fbc13759d13dcc1b9fa646b5d1/test-equality.patch) |
| `test-equality.txt` | [link](https://assets.agee.dev/evidence/spec-lock/fa768adde1af38b9cba7d8e1160c314c/test-equality.txt) |
