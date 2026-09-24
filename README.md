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

Today the protected branch is `main`. Documentation-only exemptions, the default branch and integration branches, and the opt-out list come later.

## Commands

```sh
spec-lock check <old> <new>   # exit 0 when the move may land, 1 with the reasons when it may not, 2 when it cannot be checked
```

`bin/spec-lock-hook` is the git adapter. `register(configFile)` in `lib/lock.mjs` adds it to a git config file as the config-defined hook `spec-lock-reference-transaction`, which git 2.54 runs beside a repository's own hooks. It refuses in the `prepared` state, so merges, fast-forwards, resets, commits and `update-ref` on the protected branch all go through it. It fails closed: a crashed checker, a missing object, or no `node` on the PATH refuses the update.

A single command can skip the check with `git -c hook.spec-lock-reference-transaction.enabled=false <command>`. That escape is for the repository owner only; agents never use it.

## Tests

```sh
npm test
```

Every test builds a synthetic repository in a temp directory with a scratch global git config.
