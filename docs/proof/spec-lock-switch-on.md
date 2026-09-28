---
spec: docs/specs/spec-lock-t6-activate.md
tags: [spec-lock, rollout, enrollment, github, switch-on]
date: 2026-09-27
issue: spec-lock-switch-on
walked: e44c38e779253f68632e9abe4574e055a37d1939
---

# Proof: the GitHub side of the switch-on

The owner approved this step on 2026-09-27: enroll this repository and one private repository of the owner's organization on GitHub, and leave switching on the local machine for later. This proof covers only that step. No git hook was registered, no global git config changed, `spec-lock-rollout activate` did not run, and nothing on either repository's main landed except the workflow file that `enroll --apply` writes.

This repository is public, so the private repository is called "the organization repository" below. Its name, and this machine's paths, stay in the owner's switch-on report.

`walked` is the checker commit that ran: the install was pinned to it, and every `spec-lock` workflow run below used `EvanAgee/spec-lock@e44c38e779253f68632e9abe4574e055a37d1939`. The commit after it on this branch, `ec1abce`, is the workflow file `enroll --apply` wrote to this repository's main on GitHub. This branch sits on top of it so local main can fast-forward to GitHub main. The only other file this branch changes is `AGENTS.md`, one note that GitHub now guards this repository's main; it is documentation.

## Criteria

| AC | What this step shows | Status |
|---|---|---|
| AC15 | Two real repositories enrolled, one under each owner: this public one (the owner's user account) and one private organization repository. For each: the workflow commit, the active ruleset and its rules read back from GitHub, an unproved candidate refused by the checker and by GitHub, and a forced unproved candidate refused. | Done for these two repositories. Enrolling any other repository is outside this step. Nothing was landed in either repository (`--no-land`), so the accepting side of AC15 was not walked on them; it was walked on the canary in `docs/proof/spec-lock-t6-activate.md`. |
| AC16 | Nothing new here. No new repository was created. | Pending: the next real new repository, enrolled before its first code lands. The canary walk already covered the template path. |
| AC19 | Not attempted. Switching on this machine waits for the owner's separate yes, after earlier lanes have landed. | Pending switch-on. |

## What I walked

All commands ran from the pinned install, a fresh clone of `https://github.com/EvanAgee/spec-lock.git` detached at `e44c38e779253f68632e9abe4574e055a37d1939`. Main had not moved: the workflow commit that enrollment wrote has `e44c38e` as its parent (read back with `gh api repos/EvanAgee/spec-lock/commits/ec1abce34a8c44fe0f51820e19df0c1733ab1010`).

### This repository (EvanAgee/spec-lock)

Plan, which changes nothing:

```text
$ node bin/spec-lock-rollout enroll EvanAgee/spec-lock
"facts": { "default": "main", "visibility": "public", "owner": "EvanAgee", "ownerType": "User" },
"problems": [],
"writes": [ { "branch": "main" } ],
"rulesets": [ { "body": { "name": "spec-lock", "enforcement": "active", "bypass_actors": [],
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"] } },
  "rules": [ deletion, non_fast_forward,
    required_status_checks [ { "context": "spec-lock", "integration_id": 15368 } ] ] } } ]
exit=0
```

Apply:

```text
$ node bin/spec-lock-rollout enroll EvanAgee/spec-lock --apply
spec-lock-rollout: wrote .github/workflows/spec-lock.yml on main
spec-lock-rollout: created ruleset spec-lock
spec-lock-rollout: EvanAgee/spec-lock requires the check on main
exit=0
```

What changed on GitHub:

- Workflow commit `ec1abce34a8c44fe0f51820e19df0c1733ab1010`, `ci(spec-lock): check each candidate commit before it lands`, parent `e44c38e`, author Evan Agee. It adds `.github/workflows/spec-lock.yml` (15 lines). The repository's own `ci` workflow passed on it: https://github.com/EvanAgee/spec-lock/actions/runs/36360368409.
- Ruleset `24088558` (`spec-lock`, active, https://github.com/EvanAgee/spec-lock/rules/24088558). Read back with `gh api repos/EvanAgee/spec-lock/rules/branches/main`: `deletion`, `non_fast_forward`, `required_status_checks spec-lock@15368`, all from ruleset 24088558.

Walk:

```text
$ node test/github-walk.mjs EvanAgee/spec-lock --no-land
main tip ec1abce34a8c44fe0f51820e19df0c1733ab1010
bad     0aac04de  land/bad-mukh9mo3-0   check failure (job 4 s, queued 2 s)
        https://github.com/EvanAgee/spec-lock/actions/runs/36360376462
        push to main: exit 1
        remote: - Required status check "spec-lock" is failing.
        ! [remote rejected] 0aac04de... -> main (push declined due to repository rule violations)
        tip after: ec1abce
forced  e0e84c57  land/forced-mukh9mo3  check failure (job 6 s, queued 2 s)
        https://github.com/EvanAgee/spec-lock/actions/runs/36360389887
        force push to main: exit 1
        remote: - Cannot force-push to this branch
        remote: - Required status check "spec-lock" is failing.
        tip after: ec1abce
"failures": []
exit=0
```

The two check jobs failed for the checker's reason, not for a policy or setup reason. Both logs show the pinned action downloaded and then:

```text
spec-lock: refused ec1abce34a8c44fe0f51820e19df0c1733ab1010..0aac04de7035c7c295ace72b65346d119aa40eab
- no proof: this code landing adds or edits no docs/proof/*.md file
spec-lock checker 0.0.0+8b25886793ff
```

(and the same for `e0e84c57`). After the walk, `git ls-remote` lists no `land/` branches: the walk deleted its candidates.

### The organization repository (private, organization-owned)

Plan: `"visibility": "private"`, `"ownerType": "Organization"`, `"problems": []`, one write to `main`, the same one ruleset. The plan could not read the organization's Actions policy (`You must be an org admin or have the actions policies fine-grained permission`). The tool records that as a fact, not a problem, because the walk shows whether the check runs. Main already carried one rule from an organization ruleset (automatic Copilot code review), which does not block a direct write.

Apply: `wrote .github/workflows/spec-lock.yml on main`, `created ruleset spec-lock`, `requires the check on main`, exit 0. Its workflow commit's parent is the main tip read just before `--apply`, and it changes only `.github/workflows/spec-lock.yml`. The rules read back on main: the organization's Copilot review rule, then `deletion`, `non_fast_forward` and `required_status_checks spec-lock@15368` from the new repository ruleset.

Walk (`--no-land`), exit 0, `"failures": []`:

- The unproved candidate's check failed (job 7 s). Its push to main was refused with `Required status check "spec-lock" is failing.`, and main's tip did not move.
- The forced candidate's check failed (job 42 s, under the 60-second bound). The force push was refused with `Cannot force-push to this branch` and `Required status check "spec-lock" is failing.`, and main's tip did not move.
- Both job logs show the checker running from the pinned action and refusing with `- no proof: this code landing adds or edits no docs/proof/*.md file`. So the organization's Actions policy allows the public checker. The walk left no `land/` branches.

## What this changes for the next landing

- Pushing main of either repository to GitHub now needs the `spec-lock` check to pass on that exact commit first: push it to another branch, wait for the check, then push main. A direct push of an unchecked commit is refused.
- This proof itself is documentation only. On the pushed commit, the check reads `ec1abce..` this branch as a documentation landing.

## Review

Each round ran this command from the worktree, with the request asking for the Standards, Spec and Evidence axes of the `code-review` skill against `docs/specs/spec-lock-t6-activate.md`, the raw outputs of every step above, and this repository's public-repository rule. `<scratchpad>` is the session's scratch folder on the owner's machine; the full path is in the owner's switch-on report.

```sh
codex exec --skip-git-repo-check --model "${AGENTS_REVIEW_MODEL:-gpt-6-astra}" -c model_reasoning_effort="xhigh" -o <scratchpad>/review-round<n>.md "<the code-review request>" < /dev/null
```

- Round 1 (`review-round1.md`, model gpt-6-astra): a Standards finding, that the first draft named other projects' rollout plans and the organization repository's branch state, which is internal state a public repository must not hold; and an Evidence finding, that four observations had no saved output behind them. Both fixed: those lines were removed, and the remaining claims now cite the GitHub reads that show them. No Spec finding.
- Round 2 (`review-round2.md`, model gpt-6-astra): round 1's fixes confirmed. A Standards finding, that one sentence still described the owner's settings repository on this machine, and an Evidence finding, that "every workflow run" also covered the `ci` run, which does not use the checker. Both fixed: the sentence moved to the owner's report, and the claim now says "every `spec-lock` workflow run". No Spec finding.
- Round 3 (`review-round3.md`, model gpt-6-astra): no findings on any axis; the round 1 and round 2 fixes confirmed.
