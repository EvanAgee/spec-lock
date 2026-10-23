# A batch's other jobs voided evidence recorded on each job's own commit

## Problem
A selected repository wanted each job to record its version 2 evidence once, on its own commit, and land it inside a batch. Every batch landing was refused for every job: `<path> changed after the reviewed commit <C>; after it, only regular files under docs/proof/ may be added or edited`, naming the other jobs' code. So batches captured all evidence again on the frozen tip.

## Cause
`changedAfter` in `lib/lock.mjs` let nothing but regular files under `docs/proof/` differ between the reviewed commit and the landed one, whatever the evidence actually read. The owner's after-review list only helped one exact bot path at a time.

## Fix
For a version 2 manifest under semantic checking, a path outside `docs/proof/` now refuses only when an approval recorded on the reviewed commit binds it and its tree entry changed; version 1 and the binding-only check keep exact identity. Spec `docs/specs/2026-10-23-own-branch-evidence.md`; tests `test/own-branch-evidence.test.mjs`; real-batch walk `test/own-branch-replay.mjs`.

## How to spot it again
A refusal reading `is bound by the evidence recorded on <C> and changed before the landed commit <P>` names a file the evidence reads: capture on the landed tip. A refusal still reading `changed after the reviewed commit` on a version 2 manifest means semantic checking was not on, or its approvals on C bind nothing outside `docs/proof/`.
