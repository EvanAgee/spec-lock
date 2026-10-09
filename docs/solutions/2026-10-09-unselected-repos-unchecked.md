# Repositories outside selection were not checked at all

## Problem
On a machine in selected mode, every repository except the selected ones took unproved code on main,
and `spec-lock check` there printed `spec-lock: ok`. The legacy switch-on for the rest of the machine
refused with `legacy activation cannot replace selected registration`.

## Cause
Selected mode treats every repository without a `select` line as out of scope, in the shell hook and in
`checkRange`. Adding `select` lines would demand version 2 evidence everywhere and change the policy id
that exported manifests carry, because the id hashes the central file's exact bytes.

## Fix
A second owner file, `~/.config/spec-lock/plain`, lists repositories that get the plain proof rule; a
plain rollout registers them per repository with `--plain` and never writes the central file. See
`docs/specs/plain-proof-coverage.md` and `test/plain-coverage.test.mjs`.

## How to spot it again
`spec-lock check` printing `unselected, not checked` before `spec-lock: ok` means the repository is not
covered and the ok proves nothing. `git hook list reference-transaction` printing nothing in a repository
means no landing there is checked.
