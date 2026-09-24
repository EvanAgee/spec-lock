# spec-lock: refuse and accept a local landing (AC1, AC2, AC3, AC11, AC12)

This is the public copy of one ticket from the spec-lock design, cut to this ticket's five criteria. Criteria ids match the full design, which is why they are not consecutive.

## 1. Problem Statement

Code can reach a repository's main branch without a hardened spec and a proof naming its acceptance criteria. Checks that live inside one agent tool miss plain Git, other tools, and manual work. The outcome is one landing rule that every tool on the machine passes through, while work on ordinary branches stays unrestricted.

## 2. Solution

A shared `spec-lock check <old> <new>` reads committed changes, follows each proof's spec reference, lints that spec for the hardened shape, and checks each proof for every live acceptance id of its own spec. A local Git adapter, registered as a global config-defined `reference-transaction` hook, refuses a protected branch move in the `prepared` state. Git 2.54 runs config-defined hooks beside a repository's own hooks, so existing hook setups stay as they are.

The lock is an ordinary Git enforcement mechanism, not a security boundary against someone who controls the Git configuration. The owner's emergency escape is a one-shot command that switches the hook off for a single Git command.

## 3. Seams

- `spec-lock check <old> <new>`, the shared command. Fixture repositories and the real Git adapter exercise it. The adapter translates Git's old, new, and ref input into this command; it owns no spec or proof rule of its own.

## 4. Decisions

- Each proof's front matter names its spec as a repository-relative path, for example `spec: docs/specs/x.md`. The lock lints that spec and requires the proof to name every live AC id.
- Every proof in a landing must be complete, and a code landing must contain at least one proof. Proofs are never combined.
- Reuse the existing spec-lint shape rules and word-boundary id comparison rather than writing a second parser.
- Refuse when the checker crashes or Node is missing.
- Emergency escape: `git -c hook.spec-lock-reference-transaction.enabled=false <command>`, typed by the owner, for that single command. Agents never use it.
- Later tickets add the documentation-only and pulled-commit exemptions, the first-commit rule, the opt-out list, integration branches, the landing log, pushes, and timing. This ticket leaves room for them.

## 5. Acceptance Criteria

| AC | Requirement (EARS) | Red test, fixture, and the mutation that proves it red | Observable on the real surface | Judge |
|---|---|---|---|---|
| AC1 | When a non-exempt code range lands on a protected local branch, the lock shall refuse a missing proof and allow the same change with a complete committed proof. | `test/spec-lock.test.mjs`: AC1 seeds main A and feature B with code.js, a spec with AC1 and AC2, and no proof; assert refusal and unchanged main. Add a committed proof naming both ids and assert success. Mutate the checker to always allow; the missing-proof assertion must fail. | A real scratch fast-forward exits nonzero naming the missing proof; its repaired counterpart exits zero and main equals the repaired tip. | AC1 local landing fixture |
| AC2 | When a proof names its spec, the lock shall lint that committed spec and refuse an absent, unreadable, malformed, or non-hardened spec with the proof path and fault. | `test/spec-lock.test.mjs`: AC2 seeds a proof with no spec field, a nonexistent target, and a spec missing Seams; each refuses. A passing spec and all ids allow. Mutate spec validation to success; each bad case must fail its refusal assertion. An uncommitted repair must not help. | The checker diagnostic names the proof and missing spec field or spec-lint fault; only committed repairs change its exit status. | AC2 proof-to-spec fixture |
| AC3 | When a code landing contains several proof files, the lock shall require at least one and shall check every proof against every live AC id of its own spec. | `test/spec-lock.test.mjs`: AC3 seeds two proofs: one has AC1 and AC2, the other only AC1 for a second spec requiring AC1 and AC2. Assert refusal naming the second proof and AC2; repair it and allow. Mutate to concatenate proofs or check only the first; the refusal assertion must fail. AC20 must not satisfy AC2; a struck AC3 is not live. | One complete proof cannot hide another incomplete proof in the same landing. | AC3 multiple-proof fixture |
| AC11 | When merge, fast-forward, reset, or update-ref moves a protected local branch, the reference-transaction adapter shall refuse an invalid range in the prepared state, using the old local ref when no remote exists. | `test/spec-lock.test.mjs`: AC11 seeds main A and unproved code B in a no-remote repository. Run merge --no-ff, merge --ff-only, reset --hard, update-ref with and without old SHA; each refuses and main remains A. Mutate the adapter to pre-merge-commit only; fast-forward, reset, and update-ref assertions must fail. | Real Git commands exit nonzero; rev-parse of the protected ref remains A. Worktree side effects are reported separately from ref safety. | AC11 reference transaction fixture |
| AC12 | If the checker crashes, cannot read required objects, or Node is unavailable, then the landing adapters shall refuse the protected update with an actionable diagnostic. | `test/spec-lock.test.mjs`: AC12 replaces the checker with exit 73, removes Node from its test PATH, and supplies an unavailable object. Each refuses without moving the target ref; restored dependencies allow a valid proof. Mutate error handling to return zero; all three refusal assertions must fail. | Git stderr identifies checker failure, missing Node, or missing object, rather than reporting a pass. | AC12 failure fixture |

## 6. End-to-end verification

1. Run `node --test test/spec-lock.test.mjs`. Run each mutation on a throwaway copy of the repository and keep the failed assertions by AC id.
2. In a scratch repository with a scratch global Git config, create main A, code B without a proof, and a repaired C. Attempt a fast-forward and the other AC11 operations. B must be refused without changing main; C must land. Read the protected ref after each command.
3. Run `spec-lock check` on this repository's own landing range, whose proof names this spec.

Expected: bad candidates never move main through the tested routes, complete candidates do, and every mutation turns its criterion's test red.

## 7. Non-goals

- No gate on ordinary feature-branch commits, so work-in-progress saves stay possible.
- No hook for any particular agent tool. Git owns the local landing boundary.
- No rewriting of historical commits.
- No judgment of prose quality from AC names. The lock checks that each id is named, not that the proof is true.
- No installation into a real global Git config or repository in this ticket. Activation is a later ticket.

## 8. Open questions

None.
