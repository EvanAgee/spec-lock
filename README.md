# spec-lock

Refuses code that reaches a protected branch without a spec in the hardened shape and a proof naming every acceptance criterion. One checker, called by two global git hooks on this Mac and by a GitHub action.

## The rule

A landing is the move of a protected branch from an old commit to a new one. When that move changes any file, it must add or edit at least one proof under `docs/proof/*.md`. Each proof names its spec in front matter:

```markdown
---
spec: docs/specs/feature.md
---
```

The spec path is read from the landed commit, relative to the repository root. The spec must pass the hardened-shape lint, and the proof must name every live acceptance id of that spec (`AC1`, `AC2`, ...). Each proof is checked against its own spec. Only committed files count, and a proof already on the branch cannot vouch for new code.

Three moves need no proof:

- A landing whose changed paths are all documentation: under `docs/` or ending in `.md`. Any proof it carries is still checked.
- A pull. A path whose landed content matches the tip of a remote's default branch (`refs/remotes/<remote>/HEAD`) is not part of the landing, so pulled work passes while local code on top of it still needs a proof.
- A repository's first commit. An update that names no old value on an existing branch is not one, and neither is a branch deleted and created again.

## Evidence bindings

A proof may also name an evidence manifest, which binds its acceptance claims to a recorded run of a command on one reviewed commit. The binding is optional: a proof without an `evidence:` field is judged exactly as above.

```markdown
---
spec: docs/specs/feature.md
evidence: docs/proof/feature.evidence.json
---
```

The manifest is a JSON object, version 1. Every path in it is relative to the repository root.

| Field | Meaning |
|---|---|
| `version` | `1` |
| `task` | the task the claims are for |
| `reviewed` | the full commit id C that was reviewed and run |
| `base` | the full commit id of the review base, an ancestor of C |
| `claims[]` | one per criterion: `spec` (path), `spec_blob` (the spec's blob id at C), `ac` (`AC<n>`), `state` (`supported` or `unsupported`), `run` (a run id), `judge` (a judge id) |
| `runs[]` | `id`, `executor`, `command_id`, `argv` (array of strings), `revision`, `exit` (integer, or null when the run never exited), `outcome` (`exited`, `timeout`, `started`, `tracked-files-changed` or `output-over-bound`), `stdout` and `stderr`, each `{path, bytes, sha256}` or null |
| `judges[]` | `id`, `judge`, `run`, `ac`, `revision`, `base`, `evidence` (`{stdout_sha256, stderr_sha256}`), `verdict` (`supported` or `unsupported`) |

When a proof in a landing names a manifest, the landed commit P must meet all of these, read from committed objects alone. Each refusal names the manifest field it concerns.

1. `evidence` is a path under `docs/proof/` with no empty, `.` or `..` segment, and is a regular file at P holding a JSON object with `version` 1.
2. `reviewed` and `base` are full commit ids (40 or 64 hex digits, never a prefix); `base` is an ancestor of `reviewed`; `reviewed` is P or an ancestor of P; and every path that differs between `reviewed` and P is an added or edited regular file (mode 100644) under `docs/proof/`, with no deletion, rename, symlink or executable. Code, specs and other documentation changed after C refuse the landing, even though C is still an ancestor.
3. `claims[]` is not empty. Each claim's `spec` is a regular file at `reviewed` whose blob id is `spec_blob`, and its `ac` is a live criterion of that spec.
4. Each claim's `run` and `judge` name exactly one entry in `runs[]` and `judges[]`, and that judge's `run` is the claim's run and its `ac` is the claim's `ac`.
5. Each claimed run has `revision` equal to `reviewed`, `outcome` `exited` and `exit` 0, and non-null `stdout` and `stderr` whose `path` is under `docs/proof/`, is a regular file at P, and has exactly `bytes` bytes with SHA-256 `sha256`. An empty stream is a zero-length file, and it must be present.
6. Each claimed judge has `revision` equal to `reviewed`, `base` equal to the manifest's `base`, `evidence` equal to its run's two digests, and `verdict` `supported`, and the claim's `state` is `supported`.

The checker cannot know who ran or judged anything. `executor` and `judge` are copies for reading, and the checker never runs a command or fetches a record from anywhere else. The tool that records the runs checks provenance: that the run and judge ids are its own records, made by someone other than the author, with the same bytes.

The check reads C and the review base, so on GitHub a workflow whose proofs carry evidence manifests checks out full history (`fetch-depth: 0`); in a shallow clone those commits are missing and the landing is refused.

## Which branches, which repositories

The guarded branches are each remote's default branch, `main` and `master`, and the integration branches in the central file. Every other branch is free. Every repository is covered unless the central file leaves it out.

The central file is `$SPEC_LOCK_CONFIG`, or `~/.config/spec-lock/config` when that is unset. Only the owner edits it. One entry per line; any other line is ignored:

```text
integration integration/candidate
opt-out /absolute/path/to/repository
```

An opt-out path names the repository's main worktree (or the repository itself when bare), and covers its linked worktrees too. A relative path never matches. Settings inside a repository cannot opt it out.

## The landing log

Every checked move of a guarded branch appends one tab-separated line to `$SPEC_LOCK_LOG`, or `~/.local/state/spec-lock/landings.log`: time, repository, ref, old commit, new commit, and `allowed`, `refused` or `deleted`. A move that drops commits from a branch (a force update or a delete) keeps the old tip as `refs/spec-lock/kept/<commit>`, so `git gc` cannot prune what an audit may need to recheck.

## Commands

```sh
spec-lock check <old> <new>   # exit 0 when the move may land, 1 with the reasons when it may not, 2 when it cannot be checked
```

`bin/spec-lock-hook` is the git adapter. `register(configFile)` in `lib/lock.mjs` adds it to a git config file as two config-defined hooks, and changes nothing else there:

- `spec-lock-reference-transaction` refuses in the `prepared` state, so merges, fast-forwards, resets, commits and `update-ref` on a guarded branch all go through it, and it keeps old tips in the `committed` state.
- `spec-lock-pre-push` judges each push to a guarded remote branch from the tip the remote advertised to the pushed commit. A force push, a tip that is not a descendant, and another branch pushed to main (`git push origin feature:main`) are checked like a local landing. One refused ref stops the whole push. A branch new to the remote is compared with the empty tree, less what a guarded branch in the local repository already holds. A push whose remote tip is not in the local repository cannot be checked and is refused; fetch first.

Git 2.54 runs config-defined hooks beside a repository's own, so neither replaces a husky `.husky/_` folder, a tracked `.githooks` folder, an absolute or default `.git/hooks` folder, or the hooks of a linked worktree, and `HUSKY=0` does not switch the lock off. Both fail closed: a crashed checker, a missing object, or no `node` on the PATH refuses the update or the push. They pick the guarded updates with shell builtins and git alone, so without Node a feature branch still commits and pushes.

A single command can skip a check with `git -c hook.spec-lock-reference-transaction.enabled=false <command>`, or `git -c hook.spec-lock-pre-push.enabled=false push ...` for a push; `git push --no-verify` also skips the push check. These escapes are for the repository owner only; agents never use them.

`node test/time-check.mjs <repository> <old> <new> [samples]` times `spec-lock check` and the adapter on a real repository without changing it.

## On GitHub

The same checker runs as a GitHub action. A branch ruleset only accepts a commit on a protected branch after a required check has passed on that commit, so the check runs on pushes to candidate branches, and the checked commit goes to the protected branch afterwards. The workflow:

```yaml
# .github/workflows/spec-lock.yml
name: spec-lock
on:
  push:
    branches-ignore: [main]
permissions:
  contents: read
jobs:
  spec-lock:
    name: spec-lock
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: EvanAgee/spec-lock@<full commit sha>
```

The action judges the pushed commit as a landing on its `target` input, which defaults to the repository's default branch. It fetches the target's tip when the check runs, never the push event's `before` value, which is the candidate branch's previous tip. It prints that tip, then runs `spec-lock check <tip> <commit>`, the same checker the git hook runs, so both print the same faults and the same `spec-lock checker <version>+<hash>` line for the same range. A push to the target itself fails the check, because comparing a branch with itself would pass anything.

Then add a branch ruleset on the protected branch that requires the status check `spec-lock` from GitHub Actions, with no bypass for the accounts that land work. To land a commit:

```sh
git push origin HEAD:refs/heads/land/my-change   # runs the check on this commit
git push origin HEAD:main                         # accepted once that check has passed
```

What the GitHub side does not do:

- A check result belongs to a commit, not to a range. If the target moves after the check passed, the commit keeps its pass. Block force pushes in the ruleset so that such a commit can only land as a fast-forward, and push it to a new candidate branch to check it again.
- The ruleset binds the check's name to GitHub Actions, not to this workflow. Anyone who can push a workflow can replace the job with one of the same name that always passes.

`node test/github-walk.mjs <owner/repo>` walks a real throwaway repository set up this way. It pushes an unproved commit, a proved one and a forced unproved one through candidate branches to main, and asserts that GitHub refuses the unproved ones, lands the proved one, and that each check job takes under 60 seconds. `SPEC_LOCK_CANARY=<owner/repo> npm test` runs it with the rest of the tests.

## Tests

```sh
npm test
```

Every test builds a synthetic repository in a temp directory with a scratch global git config.
