---
tags: [spec-lock, registration, verification]
date: 2026-09-28
issue: scoped-evidence-registration
spec: docs/specs/scoped-evidence-registration.md
walked: 633f22f0597413994124b33a4f4fcf7a36c3919c
---
# Selected registration isolation

Selected activation writes hook registration only to selected common Git configurations.
Missing policy or checker files no longer block unrelated Git operations. This is a local
candidate. No real installation, activation, merge or push was performed.

## What I walked

The author ran real rollout, Git configuration, commit, branch-update and push commands
against scratch repositories. The final author suite passed **121 tests, zero failures,
one optional hosted canary skipped**. All 26 scoped cases passed. Source and input hashes
were unchanged throughout the final full run. The distinct verifier repeated the full suite from a clean detached worktree at
`633f22f0597413994124b33a4f4fcf7a36c3919c`: 121 passed, zero failures, one optional hosted
canary skipped. The verifier matched the approved input hashes and all tracked source
bytes before and after the run. The author independently read the output and checked those maps.

The command was `full-suite-slot npm test` under the configured machine routing. See
[full command and hash receipt](https://assets.agee.dev/evidence/spec-lock/c450e5836748740fb4584d2d149011d9/full-suite-final-source.json)
and [complete output](https://assets.agee.dev/evidence/spec-lock/3b6b56603e79f793575eb1b9d1227542/full-suite-final-source.txt).
Tests set scratch HOME, global config and log destinations, disable system config, and strip
inherited Git, rollout and fleet settings. Local bare remotes are synthetic.

| AC | Command seam and expected oracle | Observed author result and red evidence |
|---|---|---|
| AC1 | Real preview and activate; global/inventory bytes remain equal, four common hook keys appear, repeated activation preserves bytes. | Passed. [Baseline red](https://assets.agee.dev/evidence/spec-lock/bc70e528ebc5d8e5568cbad8f95ce39c/ac1-baseline-red.txt) observes changed global bytes before inspecting new preview fields. |
| AC2 | Delete/corrupt policy, then selected update-ref/push and unrelated commit/push. Selected exit is an integer nonzero with unchanged refs; unrelated commands exit zero. | Passed. [Approved baseline red](https://assets.agee.dev/evidence/spec-lock/96831a12faf62eba0e465837b26ca771/red-approved-inputs.txt) observes unrelated commits blocked. |
| AC3 | Delete registered adapter, then real Git operations. Selected refuses with unchanged refs; unrelated succeeds. | Passed. Same approved baseline record observes the missing checker blocking unrelated commits. |
| AC4 | Actual linked/future worktree, bare, nested, similar-name, symlink, case and quoted-path operations. Only the common repository is selected. A moved registered repository refuses. | Passed; case alias available. [Moved-repository red](https://assets.agee.dev/evidence/spec-lock/52e27db4c10db610091258bb1d7bc3d0/review4-red.txt) records a wrongly accepted update before repair. |
| AC5 | Activation with pending lanes/conflicting or shared configuration must refuse before writing; doctor accepts exact registration and reports overrides. | Passed. [Round 1 red](https://assets.agee.dev/evidence/spec-lock/16a0763fc1e3cd29c7731cbb1d5dcbaf/review1-red.txt), [round 2 red](https://assets.agee.dev/evidence/spec-lock/3e7c4c2c206038319d93fe157de8ae70/review2-red.txt), [round 3 red](https://assets.agee.dev/evidence/spec-lock/7c9fe12b84f7de7331d3fd8fd936ddfa/review3-red.txt) capture shared-config, prunable-worktree and include defects. |
| AC6 | Real selected activation followed by valid v2 merge, linked merge and push; legacy suite; rollback removes only owned keys and preserves hooksPath. | Passed in the complete suite. Rollback and coexistence are also in [final scoped output](https://assets.agee.dev/evidence/spec-lock/b37deef8c9d32c30f932b8328a400b60/scoped-final-inputs.txt). |

## Review ownership and repairs

The author owns implementation and regression runs. The separate input verifier owns the
[final exact-input approval](https://assets.agee.dev/evidence/spec-lock/ac3584408325f4723360d99c2b1cc308/independent-inputs.md), including
the final moved-repository repair and refusal assertions that reject timeout/null status.
Session identities establish recorded separation only, not authenticated identity.

Four broad precommit rounds used the required alternating commands at high effort:

1. [Codex Astra](https://assets.agee.dev/evidence/spec-lock/7d096ae3d6c347f4bdd8dc04fa02b63c/round1.md) found symlink/shared common configuration could modify global settings. Both cases now refuse before writes.
2. [Claude Opus 5.5](https://assets.agee.dev/evidence/spec-lock/4247d480df9068bc87170ef696ca31a0/round2.md) found stale worktrees falsely refused activation and valueless keys lost a character in diagnostics. Both have observed-red repairs.
3. [Codex Astra](https://assets.agee.dev/evidence/spec-lock/67d4460a3bb2b3ac16a5606e261269af/round3.md) found inactive conditional includes and empty common configuration escaped preflight. The full include graph is checked, and hook commands verify repository identity before invoking the checker.
4. [Claude Opus 5.5](https://assets.agee.dev/evidence/spec-lock/d41782c52582e447a8bb78e80882ed32/round4.md) found moving a selected repository silently bypassed checking. A direct local registration now refuses on an identity mismatch. The reviewer also required a symptom-bearing AC1 baseline failure; it is retained above.

The exact command receipts and output paths are in
[execution record](https://assets.agee.dev/evidence/spec-lock/4cd61676b4f9013fdc18787cc214f78b/execution-record.md). Public paths are aliases;
private originals retain the literal commands. Both Claude responses named only
`claude-opus-5-5` in modelUsage. Codex headers identified Astra/high. No capacity fallback.
No fifth broad review was run. The final narrow repair received independent targeted input
and logic approval, followed by the exact committed-source execution recorded here.
Design review does not apply: no screen code changed.

## Independent committed-source replay

The verifier's [per-AC report](https://assets.agee.dev/evidence/spec-lock/4e96ac37214751541316edc71e1df354/report.md) names
the commands, assertions, independent expected values and observed results for every criterion.
The verifier owns [command and exit metadata](https://assets.agee.dev/evidence/spec-lock/b2e9e0bf191e3e48b3816ed6b39293c8/command.json),
[complete stdout](https://assets.agee.dev/evidence/spec-lock/b3cc95c23ab3f906cbd906e06fce7631/stdout.txt),
[complete stderr](https://assets.agee.dev/evidence/spec-lock/1d25ed4cad6af873b5d6a601ea2d6be4/stderr.txt), and
[before/after checks](https://assets.agee.dev/evidence/spec-lock/1ac0814e1c83c2782aabef693590c2f2/checks.json).
The full run took 155.295 seconds and exited 0 without a timeout. Stderr contains only an
npm update notice. All AC1–AC6 passed; the scoped sub-suite has 26 passing cases and no skips.
The optional hosted canary is the sole full-suite skip.

The actual running Node executable was v26.7.0, with npm11.19.0 and Apple Git2.54.0.
An earlier environment probe reported Node22.22.0; live process inspection confirmed the
suite used Node26.7.0. This meets the declared Node>=22 engine but does not prove Node22
specifically. The [runtime clarification](https://assets.agee.dev/evidence/spec-lock/10ff92ba2632db470abfcadadae16b0d/runtime-clarification.json)
retains that distinction. No cause for the earlier probe difference is asserted.

The verifier's source tree, external instruction hash inventory and real settings matched
before and after. The author also matched real settings against the starting snapshot.
Only proof files change after the walked source commit. No configured delivery review or
hosted check has run, because this candidate has not been pushed or merged.

## Evidence integrity

[Projection hashes](https://assets.agee.dev/evidence/spec-lock/6af13eeb714b55b9c12fcd3cf34d0c10/projection.json) bind private originals and
public copies. Private paths/session identities are replaced with aliases. Decimal Buffer
dumps that encode private paths are omitted explicitly; originals remain unchanged privately.
Final successful suite output is retained verbatim. Captured transcript whitespace is preserved.
Verifier public snapshots retain tracked-source hashes and clean state. Private external
instruction/settings inventories, PATH and commit identity are omitted; their full original
hashes and the unchanged-state verdict remain recorded. This is an explicit reduced projection.

Historical runs remain labelled. The first full run and full-suite-repair are development
runs because inputs changed during execution; the latter npm run passed but its hash wrapper
returned 1. Neither supports final approval. An early missing-package fixture attempt and
three no-hooks exit-status assertion mistakes are excluded as test-author errors. Missing
preview fields or diagnostic wording alone do not establish a product failure. The final
stable run and explicit symptom-bearing red records support the claims above.

## Limits

Owner-editable config can disable hooks. Multi-file activation is not atomic; I/O failures
can leave partial selected settings. A moved repository requires owner migration. Direct
checker CLI calls still read central policy outside selected repositories. Deleting owner
policy then explicitly invoking legacy activation from an unrelated repository can create
global hooks; this separate owner action is outside selected activation. The hosted canary
was skipped. System-wide include loading, hard-link sharing, unreadable includes and the
depth-limit path have no separate new regression case; no direct execution of each is claimed. No authenticated actors, protected tests, generic reply interception or stronger
handling of existing first-commit/documentation/import exceptions is claimed.

## Process improvement

Keep the common-config inheritance and moved-repository regressions in the existing suite.
They cover the actual isolation boundary; a new skill would add no value for this task.

## Evidence files

These files were committed under `docs/proof/scoped-evidence-registration/` and now live only on Cloudflare, behind sign-in. The commit named in `walked` is in the history before it was rebuilt without them; the code and tests here are the same, except that `test/policy-evidence.test.mjs` reads its baseline fixture from `test/policy-baseline.json`.

| File | Link |
|---|---|
| `ac1-baseline-red.txt` | [link](https://assets.agee.dev/evidence/spec-lock/bc70e528ebc5d8e5568cbad8f95ce39c/ac1-baseline-red.txt) |
| `baseline-record.json` | [link](https://assets.agee.dev/evidence/spec-lock/8d85faecfecedf4b533be53c80e01e1c/baseline-record.json) |
| `execution-record.md` | [link](https://assets.agee.dev/evidence/spec-lock/4cd61676b4f9013fdc18787cc214f78b/execution-record.md) |
| `final-verifier/after.json` | [link](https://assets.agee.dev/evidence/spec-lock/7ba63513e6bf01ed225c9e89bb69475f/after.json) |
| `final-verifier/before.json` | [link](https://assets.agee.dev/evidence/spec-lock/653c7c70dc629eb2f3cb45fd5550c659/before.json) |
| `final-verifier/checks.json` | [link](https://assets.agee.dev/evidence/spec-lock/1ac0814e1c83c2782aabef693590c2f2/checks.json) |
| `final-verifier/command.json` | [link](https://assets.agee.dev/evidence/spec-lock/b2e9e0bf191e3e48b3816ed6b39293c8/command.json) |
| `final-verifier/original-records-inspected.json` | [link](https://assets.agee.dev/evidence/spec-lock/2d7b0f4e21b295dab20fb46dc2dc334b/original-records-inspected.json) |
| `final-verifier/outcome.json` | [link](https://assets.agee.dev/evidence/spec-lock/1e9bd19bf6665302f5759c3168e6cf8c/outcome.json) |
| `final-verifier/process-runtime-observation.json` | [link](https://assets.agee.dev/evidence/spec-lock/546856a2ffc031cee80ce90ff70b4610/process-runtime-observation.json) |
| `final-verifier/report.md` | [link](https://assets.agee.dev/evidence/spec-lock/4e96ac37214751541316edc71e1df354/report.md) |
| `final-verifier/runtime-clarification.json` | [link](https://assets.agee.dev/evidence/spec-lock/10ff92ba2632db470abfcadadae16b0d/runtime-clarification.json) |
| `final-verifier/stderr.txt` | [link](https://assets.agee.dev/evidence/spec-lock/1d25ed4cad6af873b5d6a601ea2d6be4/stderr.txt) |
| `final-verifier/stdout.txt` | [link](https://assets.agee.dev/evidence/spec-lock/b3cc95c23ab3f906cbd906e06fce7631/stdout.txt) |
| `full-suite-final-source.json` | [link](https://assets.agee.dev/evidence/spec-lock/c450e5836748740fb4584d2d149011d9/full-suite-final-source.json) |
| `full-suite-final-source.txt` | [link](https://assets.agee.dev/evidence/spec-lock/3b6b56603e79f793575eb1b9d1227542/full-suite-final-source.txt) |
| `full-suite-final.json` | [link](https://assets.agee.dev/evidence/spec-lock/656e23ae4f3183d687d1bf34a45468f9/full-suite-final.json) |
| `full-suite-final.txt` | [link](https://assets.agee.dev/evidence/spec-lock/4168de2e8da7a0502f4c08e180d6abb2/full-suite-final.txt) |
| `full-suite-reviewed.json` | [link](https://assets.agee.dev/evidence/spec-lock/5da51316b492fcdb4ac2f477571326eb/full-suite-reviewed.json) |
| `full-suite-reviewed.txt` | [link](https://assets.agee.dev/evidence/spec-lock/06f2ed4876a61a5040eeb62fb2b348ff/full-suite-reviewed.txt) |
| `independent-inputs.md` | [link](https://assets.agee.dev/evidence/spec-lock/ac3584408325f4723360d99c2b1cc308/independent-inputs.md) |
| `projection.json` | [link](https://assets.agee.dev/evidence/spec-lock/6af13eeb714b55b9c12fcd3cf34d0c10/projection.json) |
| `red-approved-inputs.txt` | [link](https://assets.agee.dev/evidence/spec-lock/96831a12faf62eba0e465837b26ca771/red-approved-inputs.txt) |
| `review-request.txt` | [link](https://assets.agee.dev/evidence/spec-lock/7b3fcb5fb7104498398475cbd63aac12/review-request.txt) |
| `review1-green.txt` | [link](https://assets.agee.dev/evidence/spec-lock/23abf10f386d659b40455704d2a55b01/review1-green.txt) |
| `review1-red-source.json` | [link](https://assets.agee.dev/evidence/spec-lock/3972e7a356a108f6660c9da83d2c0e5e/review1-red-source.json) |
| `review1-red.txt` | [link](https://assets.agee.dev/evidence/spec-lock/16a0763fc1e3cd29c7731cbb1d5dcbaf/review1-red.txt) |
| `review2-green.txt` | [link](https://assets.agee.dev/evidence/spec-lock/c031aa585b8eb2a91baacb8747e34bd2/review2-green.txt) |
| `review2-red-source.json` | [link](https://assets.agee.dev/evidence/spec-lock/65a2ed00eff046d3c19044fc26a879b1/review2-red-source.json) |
| `review2-red.txt` | [link](https://assets.agee.dev/evidence/spec-lock/3e7c4c2c206038319d93fe157de8ae70/review2-red.txt) |
| `review3-green.txt` | [link](https://assets.agee.dev/evidence/spec-lock/5e788da760739bcf6ddc5a7fb8ef0c51/review3-green.txt) |
| `review3-red-source.json` | [link](https://assets.agee.dev/evidence/spec-lock/67cad27a840a3c470b2d9c30e89409d5/review3-red-source.json) |
| `review3-red.txt` | [link](https://assets.agee.dev/evidence/spec-lock/7c9fe12b84f7de7331d3fd8fd936ddfa/review3-red.txt) |
| `review4-green.txt` | [link](https://assets.agee.dev/evidence/spec-lock/7bc835009ef9cf3f188da95f739bb7c2/review4-green.txt) |
| `review4-red-source.json` | [link](https://assets.agee.dev/evidence/spec-lock/66dac114a92aa64853f2a39c41d037b0/review4-red-source.json) |
| `review4-red.txt` | [link](https://assets.agee.dev/evidence/spec-lock/52e27db4c10db610091258bb1d7bc3d0/review4-red.txt) |
| `reviews/round1.md` | [link](https://assets.agee.dev/evidence/spec-lock/7d096ae3d6c347f4bdd8dc04fa02b63c/round1.md) |
| `reviews/round2.md` | [link](https://assets.agee.dev/evidence/spec-lock/4247d480df9068bc87170ef696ca31a0/round2.md) |
| `reviews/round3.md` | [link](https://assets.agee.dev/evidence/spec-lock/67d4460a3bb2b3ac16a5606e261269af/round3.md) |
| `reviews/round4.md` | [link](https://assets.agee.dev/evidence/spec-lock/d41782c52582e447a8bb78e80882ed32/round4.md) |
| `scoped-final-inputs.txt` | [link](https://assets.agee.dev/evidence/spec-lock/b37deef8c9d32c30f932b8328a400b60/scoped-final-inputs.txt) |
| `scoped-green-final.txt` | [link](https://assets.agee.dev/evidence/spec-lock/103cef519522e7ff8ee7b361c3727244/scoped-green-final.txt) |
| `scoped-reviewed.txt` | [link](https://assets.agee.dev/evidence/spec-lock/ca73d51a9854e34a99387211bcc85b9d/scoped-reviewed.txt) |
| `targeted.txt` | [link](https://assets.agee.dev/evidence/spec-lock/d8ddb0ee96f9b3299c205d19ce5990f1/targeted.txt) |
