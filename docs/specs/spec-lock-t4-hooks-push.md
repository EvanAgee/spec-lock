# spec-lock: hook coexistence, pushes and local timing (AC9, AC10, AC20)

This is the public copy of one ticket from the spec-lock design, cut to this ticket's three criteria. Criteria ids match the full design, which is why they are not consecutive. It extends the local landing check from `docs/specs/spec-lock-t2-local-check.md` and the scope rules from `docs/specs/spec-lock-t3-scope.md`.

## 1. Problem Statement

The lock refuses unproved local moves of a guarded branch, but two gaps remain before it can be switched on for every repository on the machine. Repositories already carry their own hooks in several layouts: a husky `.husky/_` folder, a tracked `.githooks` folder, an absolute path to `.git/hooks`, and linked worktrees. Nothing yet shows the shared hook runs beside each of them without changing their config. A push also moves a protected branch, on the remote, and no local check sees it. That includes a force push, a tip that does not descend from the remote's, and a push of a feature branch straight to `main`.

The lock also runs on every local landing, so it has to stay fast on the largest repository it guards.

## 2. Solution

Register the shared adapter under two config-defined hook names in the global git config: `spec-lock-reference-transaction` for local moves and `spec-lock-pre-push` for pushes. Git 2.54 runs config-defined hooks before, and beside, a repository's own hook folder, so no repository's `core.hooksPath` or hook scripts change.

The pre-push adapter reads git's `<local ref> <local oid> <remote ref> <remote oid>` lines, keeps those whose remote ref is a guarded branch, and judges each as the move the remote would make, from the tip the remote advertised to the pushed commit. It uses the same `spec-lock check` rules, so a force push and a non-descendant tip get the same verdict as the equivalent local move.

Measure the local check on the largest local repository, read-only, with the machine load recorded beside each sample.

## 3. Seams

- `spec-lock check <old> <new>`, the shared command. Both adapters call its rules; the timing walk calls it directly.
- `bin/spec-lock-hook`, the git adapter, now for two events. It picks guarded updates from either input format with shell builtins and git alone.
- `register(configFile)` in `lib/lock.mjs`, the one place that writes git config. Fixture repositories with each hook layout and a local bare remote exercise all three through real git commands.

## 4. Decisions

- Prefer global config-defined hooks when the installed git runs them beside existing hooks. Do not overwrite `core.hooksPath` or add calls to repository hook scripts.
- Use separate friendly hook names for reference-transaction and pre-push, so the adapter knows which input format it receives, and so the owner can skip either for one command with `git -c hook.<name>.enabled=false`. Agents never use that escape.
- Check force pushes. Judge a push from the remote's advertised old tip, never from a local ref.
- The local check adds less than one second in the largest local repository.

## 5. Acceptance Criteria

| AC | Requirement (EARS) | Red test, fixture, and the mutation that proves it red | Observable on the real surface | Judge |
|---|---|---|---|---|
| AC9 | When a repository uses Husky, a tracked hooks folder, an absolute hooks folder, or a linked worktree, the shared hook shall run alongside its existing hooks without changing their configured paths. | `test/spec-lock.test.mjs`: AC9 seeds all three core.hooksPath forms and a linked worktree, with a repo hook writing a marker. On an allowed update both hooks run; unproved code refuses. Mutate shared registration away for local-hook repos; the refusal cases must fail. Mutate replacement of core.hooksPath; marker assertions must fail. | Git hook listings and hook output show both implementations; before/after config snapshots are equal except the explicitly installed global hook entries. | AC9 hook coexistence fixture and rollout inventory |
| AC10 | When a push targets a protected remote ref, the pre-push adapter shall check the advertised old remote SHA and proposed new SHA, including force pushes, before accepting the push. | `test/spec-lock.test.mjs`: AC10 seeds a local bare remote at A and candidate B with unproved code, including a non-ancestor B and a feature-to-main refspec. Normal and forced pushes refuse; complete proofs allow. Include two pushed refs with the protected one second. Mutate to use local HEAD or skip non-fast-forwards; bad cases must fail. | Future live push stderr names the remote ref and missing evidence, with its remote tip unchanged on refusal. | AC10 push fixture |
| AC20 | When a local landing is checked in the largest local repository, the shared lock shall add less than 1 second. | `test/spec-lock.test.mjs`: AC20 measures the same valid and invalid representative range with and without the adapter after full correctness tests. Record commands, SHAs, hardware, cold/warm samples and added elapsed time. Mutate a 1100 ms delay into the checker; the timing assertion must fail. An always-allow checker must still fail its paired invalid-range assertion. | The live timing receipt on the largest local repository records added time below 1000 ms. | AC20 local timing walk |

## 6. End-to-end verification

1. Run `node --test test/spec-lock.test.mjs`. Run each mutation on a throwaway copy of the repository and keep the failed assertions by AC id.
2. In scratch repositories with a scratch global git config, one per hook layout (husky, tracked, absolute, default) plus a linked worktree, each with its own hooks writing a marker: register the shared hooks, list them with `git hook list`, compare config before and after, then attempt a refused and an allowed landing and a refused and an allowed push to a local bare remote. Read the guarded refs, the markers and the landing log after each command.
3. Against a local bare remote, push unproved code as a plain push, a feature-to-main refspec, a force push of a tip that is not a descendant, a push of two refs with the guarded one second, and a guarded branch new to the remote. Each must refuse and name the remote ref; the remote tip must not move. The same pushes with complete proofs must land.
4. Time `spec-lock check` and the adapter on the largest local repository with `node test/time-check.mjs`, on commit pairs from its history, without registering a hook there or changing its config, refs or files. Record the load beside each sample.

Expected: the shared hooks and every repository hook run side by side and no repository config changes; every unproved push to a guarded remote ref refuses without moving the remote; the added time stays below one second.

## 7. Non-goals

- No change to any repository's `core.hooksPath` or hook scripts, and no per-repository hook calls.
- No installation into a real global git config, and no real push, GitHub run or ruleset.
- No timing of the GitHub check; that is a separate criterion.
- No judgment of pushes to free branches, and no network fetch inside a hook.

## 8. Open questions

None.
