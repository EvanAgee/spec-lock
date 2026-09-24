# spec-lock

Refuses code that reaches a protected branch without a spec in the hardened shape and a proof naming every acceptance criterion. One checker, called by a global git hook on this Mac and by a GitHub action.

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

`bin/spec-lock-hook` is the git adapter. `register(configFile)` in `lib/lock.mjs` adds it to a git config file as the config-defined hook `spec-lock-reference-transaction`, which git 2.54 runs beside a repository's own hooks. It refuses in the `prepared` state, so merges, fast-forwards, resets, commits and `update-ref` on a guarded branch all go through it, and it keeps old tips in the `committed` state. It fails closed: a crashed checker, a missing object, or no `node` on the PATH refuses the update. It picks the guarded updates with shell builtins and git alone, so without Node a feature branch still commits.

A single command can skip the check with `git -c hook.spec-lock-reference-transaction.enabled=false <command>`. That escape is for the repository owner only; agents never use it.

## Tests

```sh
npm test
```

Every test builds a synthetic repository in a temp directory with a scratch global git config.
