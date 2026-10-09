# A bot's daily commit voided every proof in a landing batch

## Problem
A selected repository's bot commits one generated file to the default branch every day. A landing batch that merged the default branch after its proofs were exported was refused for every proof: `<file> changed after the reviewed commit <C>; after it, only regular files under docs/proof/ may be added or edited`.

## Cause
The evidence binding's `changedAfter` in `lib/lock.mjs` allowed nothing but regular files under `docs/proof/` to differ between the reviewed commit and the landed one, so a file no claim depends on counted like reviewed code.

## Fix
The owner lists exact bot paths per repository in `~/.config/spec-lock/after-review` (`after-review <canonical common git dir> <path>`), read by `afterReview()` in `lib/policy.mjs`. It is a separate file because the selected policy id hashes `~/.config/spec-lock/config` and every version 2 manifest carries that id. Spec `docs/specs/after-review-allowlist.md`; tests `test/after-review.test.mjs`; walk `test/after-review-walk.mjs`.

## How to spot it again
Search a refusal for `changed after the reviewed commit` naming a path no person edits. Check the owner file's entry uses the exact string `git rev-parse --path-format=absolute --git-common-dir` prints in that repository.
