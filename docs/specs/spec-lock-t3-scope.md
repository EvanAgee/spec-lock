# spec-lock: scope and exemptions (AC4, AC5, AC6, AC7, AC8)

This is the public copy of one ticket from the spec-lock design, cut to this ticket's five criteria. Criteria ids match the full design, which is why they are not consecutive. It extends the local landing check from `docs/specs/spec-lock-t2-local-check.md`.

## 1. Problem Statement

The local landing check refuses every unproved move of `main` and nothing else. That is too wide in three places and too narrow in two. It refuses documentation-only changes, a plain pull of work already on the remote, and the first commit of a new repository, none of which needs a proof. It misses a default branch with another name and the integration branches that are protected like main. There is also no way to leave a whole repository out, and no record of which landings were checked.

## 2. Solution

The shared checker learns two exemptions. A landing whose changed paths are all documentation needs no proof, although any proof it carries is still checked. A path whose landed content already matches the tip of a remote's default branch is not part of the landing, so a pull brings nothing to prove while local code on top of it still needs a proof.

The git adapter decides scope. It guards each remote's default branch, `main` and `master`, and the integration branches named in one central file. That file also lists repositories to leave out. Only the owner edits it. The adapter tells a repository's first commit from a branch that is deleted and recreated. It logs every checked move, and it keeps each tip a landing leaves behind reachable so a later audit can recheck it.

## 3. Seams

- `spec-lock check <old> <new>`, the shared command. Fixture repositories exercise the documentation and pulled-commit rules through it and through real git commands.
- `bin/spec-lock-hook`, the git adapter. It reads the central file and git's hook input, picks the guarded updates, and passes them to the checker. It uses only shell builtins and git, so it can still tell guarded branches from free ones when Node is missing.

## 4. Decisions

- Documentation is a path under `docs/` or a path ending in `.md`. A landing made only of such paths needs no proof. Every proof it carries must still be complete.
- Commits already on the remote default branch, pulled locally, need no new proof. Local code in the same operation still does.
- A repository's first commit is allowed. An update that names no old value on an existing branch is not a first commit, and a deleted and recreated branch is not either.
- The lock guards each repository's default branch and the integration branches listed in the central file. Ordinary branch commits stay free.
- Every repository is covered by default. The owner can leave a whole repository out through the central opt-out list, and nothing inside a repository can do that.
- Every checked move of a guarded branch is logged with the repository, ref, old and new commits, verdict and time. The commits a move leaves behind are kept, so an audit can recheck landings a force update later removes.
- The owner's one-shot escape stays `git -c hook.spec-lock-reference-transaction.enabled=false <command>`. Agents never use it.

## 5. Acceptance Criteria

| AC | Requirement (EARS) | Red test, fixture, and the mutation that proves it red | Observable on the real surface | Judge |
|---|---|---|---|---|
| AC4 | When the entire landing changes only paths under docs/ or paths ending in .md, the lock shall allow it without a proof and shall still refuse a mixed code landing without a proof. | `test/spec-lock.test.mjs`: AC4 seeds changes to docs/guide.txt and README.md and expects allow; add src/main.js and expect refusal. Include code deletion and code-to-markdown rename as non-doc controls. Mutate the path predicate to accept all paths; the controls must fail. | The docs-only move succeeds; adding, deleting, or renaming code outside the exemption makes the unproved move fail. | AC4 documentation exemption fixture |
| AC5 | When a local update only brings in commits already on the remote default branch, the lock shall allow it without a new proof and shall check additional local code. | `test/spec-lock.test.mjs`: AC5 seeds a known remote default tip R with no new-format proof, local main A, and a separate local code child L. A to R allows; A to L refuses without a proof. Mutate remote membership to always true; the L assertion must fail. | A plain pull succeeds; mixing an unproved local code commit into that pull refuses the local branch update. | AC5 pulled-commit fixture |
| AC6 | When an empty repository receives its first commit, the lock shall allow it, and shall not treat an existing protected ref with an unspecified old value as a first commit. | `test/spec-lock.test.mjs`: AC6 creates root A and allows it, then attempts update-ref main B without an explicit old SHA, where B changes code without proof. Assert refusal. Mutate every all-zero old value into a bootstrap exemption; the second assertion must fail. | The first commit works; an unconditional update of an existing main cannot claim the first-commit exemption. | AC6 bootstrap fixture |
| AC7 | When a ref targets the repository default branch or a configured integration branch, the lock shall enforce the check, while ordinary feature-branch commits remain free. | `test/spec-lock.test.mjs`: AC7 seeds default trunk, integration integration/candidate, and feature/demo. Unproved code refuses on the first two and commits on feature/demo. Mutate matching to main only; trunk and integration refusal assertions must fail. | Ref output identifies the actual protected branch, including a default branch not named main. | AC7 protected-ref fixture |
| AC8 | When a repository appears in the captain-managed opt-out list, the local lock shall exempt it, and shall enforce the same unproved code update in an unlisted repository. | `test/spec-lock.test.mjs`: AC8 seeds listed repo A and unlisted repo B, including a linked worktree of B. A allows and B refuses. Add a repo-local pretend exemption and confirm B still refuses. Mutate exemption matching to always true; B must fail its refusal assertion. | The shared policy reports the repository identity and exemption reason; an unlisted repository remains guarded. | AC8 opt-out fixture |

## 6. End-to-end verification

1. Run `node --test test/spec-lock.test.mjs`. Run each mutation on a throwaway copy of the repository and keep the failed assertions by AC id.
2. In scratch repositories with a scratch global git config, a scratch central file and a scratch landing log, walk each rule through real git commands: a docs-only landing and a mixed one, a clone and a pull of unproved remote work and a local code commit on top, a first commit and an unconditional update, a delete and recreate, a default branch named trunk with an integration branch and a feature branch, and a listed and an unlisted repository. Read the guarded ref after each command, then read the landing log and the kept refs.
3. Run `spec-lock check` on this repository's own landing range, whose proof names this spec.

Expected: every exemption lets its case through, every control stays refused, each mutation turns its criterion's test red, and the log holds one line per checked move.

## 7. Non-goals

- No gate on ordinary feature-branch commits.
- No blocking a plain pull of work already on the remote default branch. New local code in the same operation stays subject to the lock.
- No commit-type or trailer exemption, and no documentation rule wider than the one above.
- No audit in this ticket. It keeps the log and the old commits the audit will need.
- No installation into a real global git config, a real central file, or a real repository.

## 8. Open questions

None.
