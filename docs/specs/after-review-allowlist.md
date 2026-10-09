# Let a listed bot file change after the reviewed commit

Baseline: `970d640b` on the selected-evidence line, the line the selected checker copy is built from. Design: no.

## Problem Statement

A selected repository can have a bot that commits one generated file to its default branch every day, for example a changelog data file. A landing batch that merges the default branch after its proofs were exported then carries that file as a change after each proof's reviewed commit. The evidence binding refuses it: `<path> changed after the reviewed commit <C>; after it, only regular files under docs/proof/ may be added or edited`. One bot commit voids every proof in the batch, although no reviewed code changed.

## Solution

The owner can list, per repository, the exact paths a bot may change after a reviewed commit. A listed path that changes after the reviewed commit as a regular file no longer voids the proof. Everything else is judged exactly as today.

## Seams

- `spec-lock check <old> <new>`: existing. The CLI is the highest seam that runs the evidence binding with the owner's HOME, and the git hooks call the same `checkRange`.
- A real `git merge --ff-only` on `main` with the selected hooks registered in a scratch global config: existing. It proves the hook path reads the same list.

Every criterion is tested at one of these two seams in `test/after-review.test.mjs`, on the synthetic selected repository from `test/policy-fixture.mjs`, whose valid tip is a complete version 2 evidence landing.

## User Stories

### US1: a bot file does not void a proof (P1)
As the owner, I want a listed bot file to change after a proof's reviewed commit without voiding the proof, so that a daily bot commit does not force every batch proof to be redone.
**Independent Test:** add one line to the scratch owner file, then check a valid evidence landing with a later bot commit on top.
**Criteria:** AC1, AC6

### US2: nothing else gets in (P1)
As the owner, I want every other change after the reviewed commit refused as before, so that the list cannot become a hole.
**Independent Test:** the same landing with an unlisted path, another repository's entry, a symbolic link, or an empty list is refused.
**Criteria:** AC2, AC3, AC4, AC5

## Decisions

- **Where the list lives (supervisor decision, 2026-10-09).** Its own owner file, `~/.config/spec-lock/after-review` under the HOME git and the checker run with, beside the central `config`. Only HOME places it; no environment variable, repository file or git config key can name or extend it. It is never read from the reviewed tree or the landed tree, so a change under review cannot grant itself an exception.
- **Why not a line in `config`.** On this line the selected policy id is `selected-v1:<sha256>` of the exact bytes of `config`, and every version 2 manifest must carry that id. A new line there would void every manifest already exported. The separate file leaves the policy id and the strict `config` parser in the shell hook untouched.
- **The manifest does not bind the list.** A manifest exported while a path was unlisted passes later once the owner lists it, and the manifest records nothing about the list. That is acceptable because the list only widens what may change after C to exact paths a bot writes, which no reviewed claim depends on; reviewed code, specs and proofs stay bound to C as before, and only the owner can edit the list.
- **Format.** One entry per line: `after-review <canonical common git directory> <exact repository path>`. The directory is the same canonical common Git directory a `select` line names (for a normal clone, `<repository>/.git` with symbolic links resolved); an entry matches the repository being checked only when the two strings are equal. The path is the last whitespace-separated field, so it cannot contain spaces. Blank lines and lines starting with `#` are ignored.
- **Exact paths only.** A path matches by string equality: no globs (`*`, `?` and `[` are literal and so never match a real bot path), no folders (an entry `data` does not cover `data/x.json`). A path that is absolute, or has an empty, `.` or `..` segment, makes the file malformed.
- **What a listed path may do.** Be added or edited as a regular file with mode 100644, the same rule proofs follow. A deletion, a symbolic link, an executable, a submodule or a type change at a listed path is refused with today's message.
- **Fail closed.** Whenever the evidence binding is checked, the file is read first, so a malformed or unreadable file makes the check fail (exit 2) and refuses the landing even when it changes no bot file. A missing file is an empty list.
- **Reach.** The list only changes the evidence binding's "changed after the reviewed commit" rule. It is read in every mode, keyed by repository. The GitHub action runs with a HOME that has no such file, so on GitHub nothing changes.
- **Checker line.** `bin/spec-lock` prints `spec-lock checker <version>+<hash>` over `bin/spec-lock`, `bin/spec-lock-hook` and `lib/*.mjs`, so the edit to `lib/` changes the hash without further work.

## Acceptance Criteria

AC2 to AC5 hold at the baseline already, because the baseline refuses every change after C; the task asks for them as guards. Their red is the named mutation on a control copy.

| AC | Requirement (EARS) | Red test, fixture, and the mutation that proves it red | Observable on the real surface | Judge |
|---|---|---|---|---|
| AC1 | When the owner file lists `<this repository's common dir> data/changelog.json` and a commit after the valid evidence landing edits `data/changelog.json` as a regular file, the system shall accept the landing with exit 0 at both seams. | `test/after-review.test.mjs` "AC1": policy fixture valid tip plus one bot commit adding `data/changelog.json` as `[]` and a second editing it to `[1]`; owner file with that entry; assert `spec-lock check` exits 0 printing `spec-lock: ok` for both tips, `git merge --ff-only` moves `main` to the second, and `git push` moves the scratch remote's `main` to it. Red at the baseline: exit 1 with `data/changelog.json changed after the reviewed commit`. **Mutate the allowance check to never match and prove AC1 goes red.** | `node bin/spec-lock check <B> <bot tip>` prints `spec-lock: ok`; `git rev-parse main` equals the bot tip after the merge. | `test/after-review.test.mjs` |
| AC2 | If a path that is not listed changes after the reviewed commit, then the system shall refuse the landing with today's message, even while another path is listed. | Same file "AC2": owner file lists `data/changelog.json`; the later commit edits `data/other.json`; assert exit 1 and the message `data/other.json changed after the reviewed commit`. Also entries `data/*.json` and `data` (glob and folder) with an edit to `data/changelog.json`: refused. **Mutate the match to `startsWith` and prove AC2 goes red.** | `spec-lock check` prints `spec-lock: refused` and the changed-after line. | `test/after-review.test.mjs` |
| AC3 | If the only entry for `data/changelog.json` names another repository's common Git directory, then the system shall refuse the landing. | Same file "AC3": a second scratch repository; entry `<its common dir> data/changelog.json`; assert exit 1 with the changed-after line. **Mutate the repository comparison to always match and prove AC3 goes red.** | `spec-lock check` prints the changed-after refusal. | `test/after-review.test.mjs` |
| AC4 | If a listed path is committed after the reviewed commit as a symbolic link, an executable file or a deletion, then the system shall refuse the landing. | Same file "AC4": later commits on the valid tip: `data/changelog.json` as a symlink (mode 120000) and as mode 100755 with the owner file listing it, and `test/golden.txt` (a path C holds) deleted with the owner file listing that; assert exit 1 for each with the changed-after line. **Mutate the mode test to accept any mode and status and prove AC4 goes red.** | `spec-lock check` refuses each of the three tips. | `test/after-review.test.mjs` |
| AC5 | While the owner file is missing or holds no entry, the system shall judge a change after the reviewed commit exactly as the baseline does. | Same file "AC5": the AC1 bot tip with no owner file, an empty owner file, and a file of only a comment and a blank line; assert exit 1 with the same changed-after line the baseline prints. **Mutate a missing file into a list holding `data/changelog.json` and prove AC5 goes red.** | `spec-lock check` refuses with the baseline message. | `test/after-review.test.mjs` |
| AC6 | If the owner file holds a malformed entry (a path with a `..` segment, an absolute path, a missing path, an unknown first word) or cannot be read, then the system shall refuse an evidence-bound landing with exit 2 and a message naming the owner file, whether or not the landing changes a bot file. | Same file "AC6": each malformed file, and a directory in the file's place, with the AC1 bot tip and with the proof-only valid tip; assert exit 2 and `after-review` in stderr. Red at the baseline: exit 1 instead of 2. **Mutate the parser to skip malformed lines and prove AC6 goes red.** | `spec-lock check` exits 2 and prints `spec-lock: ... after-review ...`. | `test/after-review.test.mjs` |
| AC7 | The README shall state the owner file's format and rules, and give the refresh of the selected checker copy a repository's hooks run as one shell block that moves them to a new commit. | `README.md` at the baseline has neither heading. `test/after-review-walk.mjs` reads the block under `#### Refreshing the selected copy` from `README.md` and runs it with `sh`. **Break the block's `sed` substitution on a control copy and prove the walk fails.** | `grep -n "^### Bot files after review\|^#### Refreshing the selected copy" README.md` lists both headings; the walk prints `README refresh block exit 0`, `doctor` ok and the new checker line. | `node test/after-review-walk.mjs 970d640b HEAD` and the grep |

## End-to-end verification

```
npm test
node test/after-review-walk.mjs 970d640b HEAD
```

Expected: `npm test` passes all tests, including `test/after-review.test.mjs`. The walk builds a scratch HOME and selected repository, registers the hooks to the older copy, shows a valid evidence landing with a later bot commit refused there, runs the README's refresh block word for word (install the new copy with `git archive`, rewrite the two hook commands, `doctor`, the checker line), then merges the same landing: `doctor` prints `ok`, the new checker line appears, and `main` moves. Failure is any refusal after the refresh, a doctor problem, or a non-zero block.

## Non-goals

- Any other change to what the lock accepts: the documentation, pull, first-commit and proof rules are untouched.
- Globs, folders or per-branch entries: one exact path per line is enough for one bot file, and anything wider is a hole.
- Binding the list into the manifest or the policy id: see Decisions.
- Writing the real owner file, moving the real hook pin or the real selected copy: the supervisor does that after landing.
- The GitHub action: its runner has no owner file.

## Open questions

None.
