---
tags: [spec-lock, evidence, after-review]
date: 2026-10-09
issue: after-review-allowlist
spec: docs/specs/after-review-allowlist.md
walked: a8146418602790ab6572f5c0d9b7ac350a2d2bdd
---
# Owner-listed bot files after the reviewed commit

The owner can list exact bot-written paths per repository in `~/.config/spec-lock/after-review`. A listed path may be added or edited as a regular file after a proof's reviewed commit without voiding the proof. Everything else is judged as before. This is a local candidate: nothing was pushed, and no real owner file, hook registration or installed copy was touched.

It is built on `970d640b`, the tip of the selected-evidence line, not on `main`. The installed selected checker copy that a selected repository's hooks run comes from that line, and `main`'s hook ignores the `--selected` flag those hooks pass. So a build from `main` could not be installed there. Where it lands is the owner's call.

## What I walked

All runs used a scratch HOME, a scratch global git config with `GIT_CONFIG_NOSYSTEM=1`, and synthetic repositories in a temp directory. No screen changes, so there is no video or design review.

- Full suite at `a8146418`: `full-suite-slot npm test` printed `# tests 128`, `# pass 127`, `# fail 0`, `# skipped 1` (the GitHub canary, which pushes to a real repository). [Output](https://assets.agee.dev/evidence/spec-lock/dd43d0e441e0216e1ddcc020c103607c/full-suite-final.txt). The earlier run before the review fixes: [output](https://assets.agee.dev/evidence/spec-lock/4e17dee4258cd58486aa092a85823716/full-suite.txt).
- End-to-end walk at `a8146418`: `node test/after-review-walk.mjs 970d640b HEAD`. The hooks registered to the `970d640b` copy refused the merge with `data/changelog.json changed after the reviewed commit`, and `main` did not move. It then ran the README's refresh block word for word, which printed `exit 0`, `<repo>: ok` from `doctor`, and `spec-lock checker 0.0.0+338f1cfb3dc2` (baseline `0.0.0+bbea717421a7`). After that the same merge exited 0 and `main` moved to the bot commit. [Output](https://assets.agee.dev/evidence/spec-lock/bb342d03eb5bb207df07c8832707f15b/walk-final.txt).
- First red, before any production change: AC1 refused with the production message. [Output](https://assets.agee.dev/evidence/spec-lock/121938339ea60f2ff4646a6b8be1b5f8/ac1-red.txt).
- Controls on a throwaway copy at `a8146418`, one mutation each, rerun after the last code change. [Output](https://assets.agee.dev/evidence/spec-lock/8e4c8e1e95af780749ca6405fa05aa28/controls-final.txt). Earlier runs: [first set](https://assets.agee.dev/evidence/spec-lock/9390cb4bf78fff7990a9abac1ae73b55/controls.txt) (its first AC6 lazy-read mutation was faulty) and [corrected AC6 lazy-read run](https://assets.agee.dev/evidence/spec-lock/4b07241bf4fd447f6971d843222fe311/controls-ac6-lazy.txt).

| AC | Test or command and its oracle | Observed |
|---|---|---|
| AC1 | `test/after-review.test.mjs` "AC1": with the entry `after-review <common dir> data/changelog.json`, `spec-lock check` exits 0 and prints `spec-lock: ok` for the bot tip that adds the file and the one that edits it. `git merge --ff-only` and `git push` both move `main` to the edit. | ok. Baseline lib red (exit 1, changed-after message). Mutation "the allowance never matches": only AC1 red. Walk: merge lands after the refresh. |
| AC2 | "AC2": an unlisted `data/other.json`, and the entries `data/*.json` and `data`, each exit 1 with the changed-after line. | ok. Mutation "prefix match": only AC2 red. |
| AC3 | "AC3": an entry naming another scratch repository's common directory exits 1. | ok. Mutation "any repository matches": only AC3 red. |
| AC4 | "AC4": the listed path committed as a symlink (ls-tree `120000`) and as an executable (`100755`), and a listed `test/golden.txt` deleted, each exit 1. | ok. Mutation "listed path skips mode and status": only AC4 red. |
| AC5 | "AC5": no file, an empty file, and a comment-and-blank file each exit 1 with the baseline message. | ok. Mutation "missing file lists the bot path": only AC5 red. |
| AC6 | "AC6": a `..` path, an absolute path, a missing path, an unknown first word, `garbage`, and a CR line ending each exit 2 with `after-review` in stderr, on both the bot tip and the proof-only valid tip. A directory in the file's place also exits 2. | ok. Baseline lib red (exit 1). Mutation "parser skips malformed lines": only AC6 red. Mutation "list read only when a path needs it": only AC6 red. |
| AC7 | `grep -n "^### Bot files after review\|^#### Refreshing the selected copy" README.md` lists both headings; the walk reads the refresh block from `README.md` and runs it with `sh`. | Walk: block `exit 0`. The baseline README has 0 of the headings. Mutation "sed substitution broken" on a clone: block `exit 1`, `doctor` reports conflicting registration, walk fails. |

## Reviews

Two rounds, both at high effort, run from the worktree with the request saved beside each review.

1. Codex: `codex exec --skip-git-repo-check --model "${AGENTS_REVIEW_MODEL:-gpt-6-astra}" -c model_reasoning_effort="high" -o "$TASK_DIR/reviews/round1-codex.md" "$(cat "$TASK_DIR/reviews/request.txt")" < /dev/null`. [Request](https://assets.agee.dev/evidence/spec-lock/97547e25e8a89f112012f634486d13a4/request.txt), [review](https://assets.agee.dev/evidence/spec-lock/37efef52a38da9a4ee6aed7865a7e65a/round1-codex.md), [log](https://assets.agee.dev/evidence/spec-lock/30d0cab0fc1074939368daf041ac8eef/round1-codex.log). Verdict: changes required. It found three bugs, all fixed: a malformed owner file was not read when only proof files changed (it is now read before the loop, with an AC6 case and control); the README's refresh command broke the hook command's quoting (it is now one `sh` block that the walk runs); and the README overstated what the list protects. It also found that the AC7 grep was weak; its judge is now the walk plus heading greps.
2. Claude Opus 5.5: `CLAUDE_CODE_NO_MODEL_FALLBACK=1 CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK=1 claude -p --model claude-opus-5-5 --effort high --output-format json "$(cat "$TASK_DIR/reviews/request-2.txt")" < /dev/null > "$TASK_DIR/reviews/round2-opus.json"`. `modelUsage` names only `claude-opus-5-5`. [Request](https://assets.agee.dev/evidence/spec-lock/26dbdfd79d5c36951df41006a16e052c/request-2.txt), [review](https://assets.agee.dev/evidence/spec-lock/67a5906db86f23077483eacc0b17afe0/round2-opus.json). Verdict: approve, no correctness bug. Fixed after it: the README now names the characters `COPIES` may not hold and says an entry with a space never matches; CR line endings now refuse; the AC4 spec wording matches the test; the walk asserts why the old copy refused and strips the inherited environment; and AC1 also pushes. No third round, since round 2 found no real bug.

## Known limits

- A manifest does not record which paths were listed (see the spec's Decisions).
- An entry naming a missing repository, or a path with a space, is silently dead; it refuses as before.
- The list is not exercised through the linked-worktree adapter. By code reading it shares `checkRange` and the common directory; unverified.
- A submodule or a type change at a listed path is covered only by the AC4 mutation, not by a case of its own.

```text
Ran: node --test test/after-review.test.mjs; full-suite-slot npm test (twice, the last at a8146418); node test/after-review-walk.mjs 970d640b HEAD at a8146418; the control-copy script (baseline lib, seven mutations, AC7 README mutation) at a8146418; spec-lint and lintSpec on the spec; two review rounds.
Printed: 6/6 pass; 128 tests, 127 pass, 0 fail, 1 skipped; walk ok with the old copy refusing and the new copy landing; each mutation red on exactly its AC; spec-lint ok with AC1 to AC7.
Did not run: the GitHub canary walk (it pushes to a real repository, and pushing waits for the owner); a design review or video (no screen).
Unverified: the linked-worktree adapter with an owner entry; the refresh against the real installed copy, which is the supervisor's step after landing.
```
