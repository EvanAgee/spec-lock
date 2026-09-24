# spec-lock: only top-level docs/proof/*.md files are proofs

This is the public spec for one fix to spec-lock. It narrows which files the landing check from `docs/specs/spec-lock-t2-local-check.md` treats as proofs, and keeps the documentation rule from `docs/specs/spec-lock-t3-scope.md` as it is.

## 1. Problem Statement

The README says a code landing must add or edit a proof under `docs/proof/*.md`. The checker treats every `.md` file anywhere under `docs/proof/` as a proof instead. Some projects keep review transcripts and other working notes in folders below `docs/proof/`, such as `docs/proof/reviews/review-r1.md`. Those files have no `spec:` field and name no criteria, so every landing that adds one is refused, even when a complete top-level proof sits beside it. The same rule works the other way too: a nested file that happens to carry a `spec:` field and every id can stand in for the top-level proof the README asks for.

## 2. Solution

Only a file directly in `docs/proof/` whose name ends in `.md` is a proof. A `.md` file in a folder below `docs/proof/` is ordinary documentation: the checker neither reads it as a proof nor lets it satisfy the proof requirement. A landing that changes only such nested files, with no code, is a documentation landing and needs no proof. Top-level proofs are checked exactly as before. The git reference-transaction hook, the pre-push adapter and the GitHub action all run the same checker, so the one change reaches all three.

## 3. Seams

- `spec-lock check <old> <new>` and the real git commands behind the hooks (`git merge --ff-only`, `git push`), plus `bin/spec-lock-action` in a runner clone: existing. This is the highest seam, the one AC1 to AC3 of the earlier specs already test at. Every criterion here runs through synthetic repositories built in a temp directory.

## 4. User Stories

### US1: Review transcripts beside a proof (P1)
As a lane that keeps review rounds in `docs/proof/<topic>/`, I want those files ignored by the lock, so that a landing with a complete top-level proof lands.
**Independent Test:** land code with a complete `docs/proof/x.md` and a `docs/proof/reviews/r1.md` that has no front matter.
**Criteria:** AC1, AC3, AC4

### US2: A nested file is no substitute (P1)
As the owner of a protected branch, I want a code landing to carry a top-level proof, so that the rule the README states is the rule the lock enforces.
**Independent Test:** land code with only `docs/proof/reviews/x.md`, complete as a proof, and see it refused.
**Criteria:** AC2, AC4

## 5. Decisions

- A proof is a path of the form `docs/proof/<name>.md` with no further `/` in `<name>`. Decided by the maintainer, 2026-09-24: "The checker counts only top-level `docs/proof/*.md`, as the README says."
- Nested `.md` files under `docs/proof/` become documentation. They fall under the existing documentation rule (a path under `docs/` or ending in `.md`), so a landing of only nested files needs no proof.
- The evidence binding keeps its own path rule: an evidence manifest and its committed run output may still sit anywhere under `docs/proof/`. That rule is version 1 of a contract shared with the run recorder and does not change here.
- The "no proof" refusal text stays `no proof: this code landing adds or edits no docs/proof/*.md file`, since the glob already means top level.
- The README says in one sentence that nested files are documentation, so the rule is not left to the reader's reading of a glob.
- Tests go in `test/spec-lock.test.mjs` and reuse its scratch fixture helpers. Their names start with `proof-toplevel` so they do not collide with the earlier specs' AC ids.

## 6. Acceptance Criteria

| AC | Requirement (EARS) | Red test, fixture, and the mutation that proves it red | Observable on the real surface | Judge |
|---|---|---|---|---|
| AC1 | When a landing adds or edits a `.md` file in a folder below `docs/proof/`, spec-lock shall not check that file as a proof: a code landing that carries `docs/proof/reviews/x.md` with no front matter beside a complete `docs/proof/x.md` lands, and a landing that changes only `docs/proof/reviews/x.md` lands with no proof. | `test/spec-lock.test.mjs`, `proof-toplevel AC1`: seeds `code.js`, `docs/specs/x.md` with AC1 and AC2, a complete `docs/proof/x.md` and `docs/proof/reviews/x.md` holding `# Review round 1`; `spec-lock check` exits 0 and `git merge --ff-only` moves main. A second branch changes only `docs/proof/reviews/x.md` and adds `docs/proof/reviews/deeper/r2.md`, and lands too. **Mutate the proof matcher back to any depth (`[^/]+` to `.+`) and prove AC1 goes red with `docs/proof/reviews/x.md: no spec: field`.** | `spec-lock check <old> <new>` prints `spec-lock: ok` and the checker line; `git rev-parse main` shows the landed commit. | `proof-toplevel AC1` test |
| AC2 | If a code landing adds or edits no top-level `docs/proof/*.md` file, then spec-lock shall refuse it with the no-proof fault, even when a nested `docs/proof/reviews/x.md` names a hardened spec and every one of its ids. | `test/spec-lock.test.mjs`, `proof-toplevel AC2`: seeds `code.js`, `docs/specs/x.md` with AC1 and AC2, and `docs/proof/reviews/x.md` with `spec: docs/specs/x.md` naming AC1 and AC2; `spec-lock check` exits 1 with `no proof`, and `git merge --ff-only` fails with main unmoved. **Mutate the no-proof decision to count any changed `docs/proof/**/*.md` and prove AC2 goes red.** | `spec-lock check` prints `- no proof: this code landing adds or edits no docs/proof/*.md file`; `git merge --ff-only` prints `spec-lock: refused refs/heads/main`. | `proof-toplevel AC2` test |
| AC3 | When a landing adds or edits a top-level `docs/proof/*.md` file beside nested files, spec-lock shall check that proof against its own spec: an incomplete one refuses the landing with a fault naming only the top-level proof, and the completed one lands. | `test/spec-lock.test.mjs`, `proof-toplevel AC3`: seeds `code.js`, `docs/specs/x.md` with AC1 and AC2, `docs/proof/x.md` naming only AC1, and `docs/proof/reviews/x.md` with no front matter; `spec-lock check` exits 1 with exactly one fault, `docs/proof/x.md: does not name AC2 from docs/specs/x.md`. After `docs/proof/x.md` names AC2 the fast-forward lands. **Mutate the checker to skip reading proof contents (return no faults for the proofs found) and prove AC3 goes red.** | `spec-lock check` prints one fault line for `docs/proof/x.md` and none for `docs/proof/reviews/x.md`; after the fix `git merge --ff-only` moves main. | `proof-toplevel AC3` test |
| AC4 | When the AC1 and AC2 landings reach the reference-transaction hook, the pre-push adapter and the GitHub action, each of the three shall give the same verdict: the AC1 landing passes all three, and the AC2 landing is refused by all three with the same fault line and checker line. | `test/spec-lock.test.mjs`, `proof-toplevel AC4`: seeds both landings on candidate branches of a bare stand-in remote with its own lock off; runs `git merge --ff-only` (hook), `git push origin <branch>:main` (pre-push) and `bin/spec-lock-action` in a runner clone; asserts the AC1 landing passes all three and the AC2 landing prints the same `- no proof` line and checker line on all three. **Point `bin/spec-lock-action` at a second checker that still counts nested files, as a consumer pinned to an older commit would run, and prove AC4 goes red.** | The hook's and pre-push adapter's stderr and the action's stdout each show `- no proof: ...` and the same `spec-lock checker <version>+<hash>` line for the AC2 landing; all three exit 0 for the AC1 landing. | `proof-toplevel AC4` test |

## 7. End-to-end verification

```
npm test
```

Then, in a scratch directory with a scratch `HOME`, `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_NOSYSTEM=1` and `SPEC_LOCK_LOG`, and with the lock registered only in that scratch config: build a repository whose main holds one file, then fast-forward main to a branch that adds `code.js`, a spec, a complete `docs/proof/x.md` and `docs/proof/reviews/r1.md` with no front matter. Then try a branch that adds code and only a complete `docs/proof/reviews/x.md`.

Expected: `npm test` passes every test. In the walk, the first fast-forward moves main, and the second is refused with `- no proof: this code landing adds or edits no docs/proof/*.md file` while main stays put. Failure looks like the first move refused with `docs/proof/reviews/r1.md: no spec: field`, or the second move landing.

## 8. Non-goals

- No change to where an evidence manifest or its committed output may live. That path rule is part of a versioned contract with the run recorder.
- No new place for review transcripts. Lanes may keep them wherever they like, and under `docs/proof/` they are now documentation.
- No change to the documentation rule, the pull rule or the first-commit rule.
- No push, enrollment or activation. The real switch-on is the owner's.

## 9. Open questions

None.
