# spec-lock

Refuses code that reaches a protected branch without a spec in the hardened shape and a proof naming every acceptance criterion. One checker, called by two Git hooks and a GitHub action. Selected and plain activation register hooks per repository; legacy activation registers them globally.

## The rule

A landing is the move of a protected branch from an old commit to a new one. When that move changes any file, it must add or edit at least one proof under `docs/proof/*.md`. Only files directly in `docs/proof/` are proofs: a `.md` file in a folder below it, such as a review transcript, is ordinary documentation. Each proof names its spec in front matter:

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

A proof may also name an evidence manifest, which binds its acceptance claims to a recorded run of a command on one reviewed commit. Under legacy policy the binding is optional: a proof without an `evidence:` field is judged exactly as above. Selected semantic policy below requires version 2 for covered code.

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
2. `reviewed` and `base` are full commit ids (40 or 64 hex digits, never a prefix); `base` is an ancestor of `reviewed`; `reviewed` is P or an ancestor of P; and every path that differs between `reviewed` and P is an added or edited regular file (mode 100644) under `docs/proof/`, or at a path the owner lists for this repository (see [Bot files after review](#bot-files-after-review)), with no deletion, rename, symlink or executable. Code, specs and other documentation changed after C refuse the landing, even though C is still an ancestor.
3. `claims[]` is not empty. Each claim's `spec` is a regular file at `reviewed` whose blob id is `spec_blob`, and its `ac` is a live criterion of that spec.
4. Each claim's `run` and `judge` name exactly one entry in `runs[]` and `judges[]`, and that judge's `run` is the claim's run and its `ac` is the claim's `ac`.
5. Each claimed run has `revision` equal to `reviewed`, `outcome` `exited` and `exit` 0, and non-null `stdout` and `stderr` whose `path` is under `docs/proof/`, is a regular file at P, and has exactly `bytes` bytes with SHA-256 `sha256`. An empty stream is a zero-length file, and it must be present.
6. Each claimed judge has `revision` equal to `reviewed`, `base` equal to the manifest's `base`, `evidence` equal to its run's two digests, and `verdict` `supported`, and the claim's `state` is `supported`.

The checker cannot know who ran or judged anything. `executor` and `judge` are copies for reading, and the checker never runs a command or fetches a record from anywhere else. The tool that records the runs checks provenance: that the run and judge ids are its own records, made by someone other than the author, with the same bytes.

The check reads C and the review base, so on GitHub a workflow whose proofs carry evidence manifests checks out full history (`fetch-depth: 0`); in a shallow clone those commits are missing and the landing is refused.

### Bot files after review

A bot that commits a generated file to the default branch every day would void every proof in a batch that merges it after export. The owner can list, per repository, the exact paths such a bot writes, in `~/.config/spec-lock/after-review` under the HOME git runs with:

```text
after-review /absolute/canonical/repository/.git data/changelog.json
```

- The directory is the repository's canonical common Git directory, written as a `select` line writes it (`git rev-parse --path-format=absolute --git-common-dir`, symbolic links resolved). An entry counts only in the repository whose common directory is exactly that string.
- The path is exact: no globs, no folders, no spaces, no empty, `.` or `..` segment, never absolute. A listed path may be added or edited after C as a regular file (mode 100644); a deletion, symlink or executable there is still refused.
- Lines end in LF. An entry whose directory names no repository, or whose path holds a space, never matches anything, so it refuses as before.
- A missing file, an empty one, or one of only blank lines and `#` comments changes nothing. Any other line, or a file that cannot be read, makes every evidence-bound check fail (exit 2), which refuses the landing.
- Only HOME places the file. It is never read from the reviewed or landed tree, so a change cannot grant itself an exception.
- It is a separate file so that editing it never changes the selected policy id, which every version 2 manifest carries. A manifest therefore does not record which paths were listed: a manifest exported before an entry existed passes once it is added. The checker lets any listed path through, so list only files a bot generates and no reviewed claim depends on; never code, a spec or a proof.
- The GitHub action reads the runner's HOME, which has no such file unless the workflow writes one, and the workflow is reviewed code like any other.

## Which branches, which repositories

The guarded branches are each remote's default branch, `main` and `master`, and the integration branches in the central file. Every other branch is free. Every repository is covered unless the central file leaves it out. That is the legacy rule; on a machine in selected mode, only selected repositories and those on the plain list are covered (see [Plain coverage](#plain-coverage)).

The central file is `~/.config/spec-lock/config` under the HOME git runs with. No environment variable moves it, because one would let any process point the hook at a file that opts its own repository out. Only the owner edits it. One entry per line; any other line is ignored:

```text
integration integration/candidate
opt-out /absolute/path/to/repository
```

An opt-out path names the repository's main worktree (or the repository itself when bare), and covers its linked worktrees too. A relative path never matches. Settings inside a repository cannot opt it out.

## Switching it on

`bin/spec-lock-rollout` switches the lock on for a machine. It reads a rollout file, one entry per line:

```text
lane <id> <state>          a lane in flight in any workspace; activation waits until each one is "landed"
repo <absolute path>       a repository to check and baseline
integration <branch>       written to the central file
opt-out <absolute path>    written to the central file
```

```sh
spec-lock-rollout activate <rollout file>
spec-lock-rollout doctor <repository>...
```

`activate` changes nothing while any lane has not landed, since there is no grace period for work that started before the lock. It also stops on a line it does not know, on a listed repository whose own config sets a `hook.spec-lock-*` key, and on an existing central file that holds other lines than the rollout file. Otherwise it writes the central file if there is none, adds the two hooks to the global git config, and appends to `activation` beside the landing log: the time, each drained lane, and each repository's guarded branches with their tips. It then confirms git runs both hooks in each repository.

Run it from the checkout the hooks should call, since the global config names that checkout's `bin/spec-lock-hook`.

`doctor` reports what can switch the lock off in a repository or fool it:

- a `hook.spec-lock-*` key in the repository's, a worktree's, or an included config. Such a key can disable a hook, run another command under its name, or empty its event list. Git then skips the lock there without a word.
- a hook `git hook list` does not show as enabled.
- a remote-tracking default tip (`refs/remotes/<remote>/HEAD`) that is not the remote's tip or behind it. The pull rule trusts that local ref, and anything can write it. A fetch replaces a forged one.

The one-shot escape on the command line is not a setting, so neither command sees it.

## The landing log

Every checked move of a guarded branch appends one tab-separated line to `$SPEC_LOCK_LOG`, or `~/.local/state/spec-lock/landings.log`: time, repository, ref, old commit, new commit, and `allowed`, `refused` or `deleted`. A move that drops commits from a branch (a force update or a delete) keeps the old tip as `refs/spec-lock/kept/<commit>`, so `git gc` cannot prune what an audit may need to recheck.

## Commands

```sh
spec-lock check <old> <new>   # exit 0 when the move may land, 1 with the reasons when it may not, 2 when it cannot be checked
```

`bin/spec-lock-hook` is the git adapter. `register(configFile, binDir, mode, common)` in `lib/lock.mjs` adds it to a git config file as two config-defined hooks, and changes nothing else there:

- `spec-lock-reference-transaction` refuses in the `prepared` state, so merges, fast-forwards, resets, commits and `update-ref` on a guarded branch all go through it, and it keeps old tips in the `committed` state.
- `spec-lock-pre-push` judges each push to a guarded remote branch from the tip the remote advertised to the pushed commit. A force push, a tip that is not a descendant, and another branch pushed to main (`git push origin feature:main`) are checked like a local landing. One refused ref stops the whole push. A branch new to the remote is compared with the empty tree, less what a guarded branch in the local repository already holds. A push whose remote tip is not in the local repository cannot be checked and is refused; fetch first.

Git 2.54 runs config-defined hooks beside a repository's own, so neither replaces a husky `.husky/_` folder, a tracked `.githooks` folder, an absolute or default `.git/hooks` folder, or the hooks of a linked worktree, and `HUSKY=0` does not switch the lock off. Both fail closed: a crashed checker, a missing object, or no `node` on the PATH refuses the update or the push. They pick the guarded updates with shell builtins and git alone, so without Node a feature branch still commits and pushes.

A single command can skip a check with `git -c hook.spec-lock-reference-transaction.enabled=false <command>`, or `git -c hook.spec-lock-pre-push.enabled=false push ...` for a push; `git push --no-verify` also skips the push check. These escapes are for the repository owner only; agents never use them.

`node test/time-check.mjs <repository> <old> <new> [samples]` times `spec-lock check` and the adapter on a real repository without changing it.

## On GitHub

The same checker runs as a GitHub action. A branch ruleset only accepts a commit on a protected branch after a required check has passed on that commit. So the check runs on pushes to candidate branches, and the checked commit goes to the protected branch afterwards.

Enroll a repository with `spec-lock-rollout`:

```sh
spec-lock-rollout enroll <owner/repo> [--integration <branch>]... [--action <sha>]          # prints the plan, changes nothing
spec-lock-rollout enroll <owner/repo> [--integration <branch>]... [--action <sha>] --apply
```

`--action` pins the action to a full commit of this repository on GitHub, by default the checkout's own HEAD. The plan lists a problem, and `--apply` changes nothing, when:

- the repository's or its organization's Actions policy does not allow `actions/checkout` and this action at that commit. An organization's policy is readable only by its owners; when it is not, the plan says so, and the first candidate push shows whether the check runs.
- the repository cannot have rulesets. A private repository needs GitHub Pro or Team.
- the account is not an admin of the repository, or a protected branch does not exist.
- a branch's existing rules would refuse a direct write of the workflow: a required check, pull requests only, or branch protection that requires either. Land `.github/workflows/spec-lock.yml` through the repository's usual flow, then enroll again.

With `--apply` it first writes `.github/workflows/spec-lock.yml` to each protected branch, as a commit from `user.name` and `user.email` in the git config. Then it adds one branch ruleset per protected branch and reads back what GitHub applies. Each ruleset requires that branch's own check from the GitHub Actions app, blocks force pushes and deletion, and lets no one bypass it. The workflow runs one job per protected branch on a push to any other branch:

```yaml
# Written by spec-lock-rollout. A branch ruleset requires each job before its branch moves.
name: spec-lock
on:
  push:
    branches-ignore: ["main","integration/candidate"]
permissions:
  contents: read
jobs:
  spec-lock:
    name: "spec-lock"
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: EvanAgee/spec-lock@<full commit sha>
  spec-lock-1:
    name: "spec-lock integration/candidate"
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: EvanAgee/spec-lock@<full commit sha>
        with:
          target: "integration/candidate"
```

`spec-lock-rollout workflow [--default <branch>] [--integration <branch>]... [--action <sha>]` prints the same file. It is the template a new repository starts from. Create the repository with a first commit (`gh repo create <owner/repo> --private --add-readme`), then enroll it before any code lands.

The default branch requires the check `spec-lock`, and each integration branch its own `spec-lock <branch>`, so a pass computed against one branch's tip never admits the commit to another. The action judges the pushed commit as a landing on its `target` input, which defaults to the repository's default branch. It fetches the target's tip when the check runs, never the push event's `before` value, which is the candidate branch's previous tip. It prints that tip, then runs `spec-lock check <tip> <commit>`, the same checker the git hook runs. Both print the same faults and the same `spec-lock checker <version>+<hash>` line for the same range. A push to the target itself fails the check, because comparing a branch with itself would pass anything.

To land a commit:

```sh
git push origin HEAD:refs/heads/land/my-change   # runs the check on this commit
git push origin HEAD:main                         # accepted once that check has passed
```

What the GitHub side does not do:

- A check result belongs to a commit, not to a range. If the target moves after the check passed, the commit keeps its pass. The ruleset blocks force pushes, so such a commit can only land as a fast-forward; push it to a new candidate branch to check it again.
- The required check is bound to the GitHub Actions app, so a commit status posted under the same name does not meet it. It is not bound to this workflow: anyone who can push a workflow can replace the job with one of the same name that always passes.
- Once a branch is enrolled, a change to the workflow is code like any other, and it lands with a proof.

`node test/github-walk.mjs <owner/repo> [--integration <branch>]... [--no-land]` walks an enrolled repository. For the default branch and each integration branch named, it pushes an unproved commit and a proved one through candidate branches, and it pushes one forced unproved commit to the default branch. It asserts that GitHub refuses the unproved ones and lands the proved ones, and that each check job takes under 60 seconds. With `--no-land` it pushes no proved commit and deletes its candidate branches, so no protected branch moves: that is the probe for a real repository. `SPEC_LOCK_CANARY=<owner/repo> npm test` walks the throwaway canary, which is enrolled with `--integration integration/candidate`.

## Tests

```sh
npm test
```

Every test builds a synthetic repository in a temp directory with a scratch global git config.

### Candidate version 2 capture

Version 2 records command, revision, output, claim and session bindings. Semantic
checks add reviewed failures and expected answers. Selected owner policy can require
these records through ordinary checks and Git adapters. Legacy policy still refuses
version 2. Capture and export activate no hook or configuration; workflow consumer
integration and real rollout remain separate work.

```sh
spec-lock capture /scratch/approval.json /scratch/run -- node test/value.mjs
spec-lock export /scratch/run /scratch/judgments.json docs/proof/value.evidence
spec-lock check-candidate <base-commit> <proof-commit>
```

The approval records permission already granted for the exact arguments, clean
revision, selected tracked inputs and limits. Capture creates a detached verification
worktree, saves output outside it, then removes only that checkout. It needs POSIX
process groups and Git. It runs trusted approved commands with local permissions;
it is not a sandbox. Approved checks must not daemonize. A detached child that escapes its process group can survive cleanup, but cannot hold the recorder open past the command deadline. Missing commands, interruptions, timeouts, output overflow and
changed inputs stay failed. Supporting claims require a green run whose exit and exact stdout match approval. Empty streams are saved as zero-byte files. Existing
scratch/export destinations are refused to prevent overwrites.

Export reads the captured bytes and supplied judgments. It does not invent an
observation or turn a failed execution into support. Commit the exported files and
a proof naming their `manifest.json` in its `evidence:` field, after the reviewed
code commit. The checker reads only committed objects and executes no manifest
commands. The full writer/reader contract and fields are in
[the capture specification](docs/specs/portable-evidence-capture.md#implementation-contract).
The synthetic examples in `test/portable-fixture.mjs` create approval and judgment
records; `node test/portable-evidence-walk.mjs` exercises the candidate path.

A supporting judgment needs named executed tests and a concrete assertion,
expected value and observation. Session source records must resolve distinct author
and verifier ids and agree with approval. These are editable local records. Success
reports actor provenance as unauthenticated and does not prove an independent actor,
prevent test writes or intercept claims in chat.

### Candidate semantic evidence

`spec-lock check-semantic <old> <new>` adds AC5–AC7 record checks to the existing
`check-candidate` bindings. It requires a verifier-approved semantic plan on every
claimed command approval. Without selected owner policy this is an opt-in candidate CLI. Selected semantic
policy applies the same stronger checks through ordinary checks and Git adapters.

The approval's `semantic` object has `version: 1`, `tests`, `criteria`, `goldens`, and
`golden_reviews`. The selected test paths must have identical bytes in red and green. The exact command and working
directory must also match.
Manifest version 1 cannot pass check-semantic. Each criterion has `ac`, `red_required`, `red_reason` when red does
not apply, and `oracle`. The oracle names id, ac, reviewer, supported verdict, reason,
expected answer, and selected `expectation` and `source` path/SHA-256 pairs. Source
kind is `requirement`, `reference` or `approved-fixture`. The verifier must explain
why the answer is independent of the implementation. The checker binds that review
to bytes; it cannot decide whether the explanation is correct.

Selected changed goldens require exact old/new SHA-256 values, id, criterion, path,
reviewer, supported verdict, reason and `approved_at` no later than the supporting
run. A missing file is represented by a null digest. Capture checks the approved
bytes before executing; export and semantic checking recheck them. Changes after
the reviewed commit still refuse under the existing proof-only follow-up rule.

For semantic export, the judgment file is `{judges, red_captures}`. Each red entry
contains `{scratch, reviews}`. Scratch paths are read locally and never exported.
The exporter copies red approval, session and output artifacts alongside green
records. Each review binds id, ac, oracle id, red/green run ids and `red_sha256` /
`green_sha256`, reviewer, verdict, `failure_kind: "assertion"`, expected/observed
symptom and correction reason. The observed symptom must occur in the raw output.
A red is a recorded nonzero ordinary exit, never a supporting green. A controlled
old-code revision declares `control: {baseline, overlay}` on its approval; overlay
entries name paths and exact SHA-256 bytes, matching the green revision. Undeclared
changes to that baseline refuse. Spec and oracle identity remain the same.

The exact contract and CLI fixtures are in `docs/specs/portable-evidence-semantics.md`
and `test/semantic-evidence.test.mjs`. Run the offline semantic walk with
`node test/portable-evidence-walk.mjs semantic candidate <output.json>`.
It saves exact synthetic inputs before cleanup. The prior checker uses the same
logical corpus through its binding-only command, with a documented assembly adapter
for the then-new semantic fields. Runtime comparisons cover checker calls only.

### Selected repository policy

A selected rollout file separates inventory from selection:

```text
mode selected
evidence semantic-v2
repo /absolute/inventory-repository
select /absolute/selected-repository-or-linked-worktree
integration integration/candidate
```

`spec-lock-rollout preview <file>` prints effective common repositories, guarded
branches, evidence requirement, policy/checker identity and exceptions without writing.
After the owner authorizes activation, `spec-lock-rollout activate <file>` prints the
plan before registering selected hooks in each selected common Git config. Preview lists
these registration files. No global hook keys are written. An inventory entry never
selects a repository.
The central owner file stores canonical common Git directories, so linked worktrees
share selection. `evidence legacy` explicitly retains legacy evidence rules within
selected scope. Existing legacy installations keep their opt-out behavior.

The hook registration retains a selected marker. Removing the owner configuration or
replacing it with a legacy file then refuses instead of weakening the requirement.
Malformed selection refuses operations in registered repositories because scope cannot
be established. Ordinary unrelated repositories have no new hook to invoke. Each new selected command
also checks common-directory identity before invoking the checker, so even a later local
include cannot spread policy or missing-executable failures into another repository. They require no Node. The owner file remains under the operator's
home; candidate repository files and local policy keys cannot replace it.

Selected activation checks existing worktrees for conflicting hook settings before
writing. Symlinked common configs and common configs also loaded in global or system
scope refuse before writes, including inactive conditional includes and empty files.
Include inspection conservatively follows all conditions and refuses nesting beyond ten levels. Exact common-config registration is idempotent. Existing global registrations
require owner migration; activation never removes them. `doctor` checks the shared
registration and each current worktree, including later worktree-specific overrides. Missing, prunable worktree folders are
skipped; their registrations inherit again if the worktree returns.
Run it from the checker installation named by the hook commands. Preserve that
installation until registration is removed. Existing `core.hooksPath` hooks remain.

To roll back, inspect each previewed common config and confirm its four command/event
values still match the activation. Remove only those four `hook.spec-lock-*` keys with
`git config --file <common-config> --unset-all <key>`. Preserve unrelated settings,
existing hooks and logs. Remove the owner policy only after all its registrations are
removed. Do not restore a whole config snapshot over concurrent edits.

Registration is not a transaction across files. An I/O failure can leave partial
selected registration; activation reports failure and doctor identifies missing keys.
Deleting or disabling registration still bypasses checking. Moving or copying a registered repository refuses operations until its owner updates
policy and registration. Inherited-only commands still leave unrelated repositories alone. No same-user tamper protection is claimed. Direct CLI
calls still parse the central owner policy, including calls from unrelated repositories;
this isolation guarantee covers Git operations that do not register these hooks. If the
owner file is deleted, a separate manual legacy activation from an unrelated repository
cannot discover selected registrations elsewhere. It can still add global legacy hooks.
Do not mix that owner operation with a selected deployment.

#### Refreshing the selected copy

A selected repository's two hook commands name one installed checker copy, `$COPIES/<commit>/bin/spec-lock-hook` (on this owner's machines `~/.local/share/spec-lock-selected/<commit>`). To move them from commit `$OLD` to `$NEW` of this repository, set `COPIES` (a path with no `|`, `&`, `\` or `'`), `OLD` and `NEW` (full commit ids), `CHECKOUT` (a spec-lock checkout that holds `$NEW`) and `REPO` (the selected repository), and run this as a script with `sh`:

```sh
set -e
mkdir "$COPIES/$NEW"
git -C "$CHECKOUT" archive "$NEW" bin lib package.json | tar -x -C "$COPIES/$NEW"
config="$(git -C "$REPO" rev-parse --path-format=absolute --git-common-dir)/config"
for key in hook.spec-lock-reference-transaction.command hook.spec-lock-pre-push.command; do
  value=$(git config --file "$config" --get "$key")
  git config --file "$config" "$key" "$(printf '%s' "$value" | sed "s|$COPIES/$OLD/|$COPIES/$NEW/|")"
done
cd "$REPO"
node "$COPIES/$NEW/bin/spec-lock-rollout" doctor "$REPO"
node "$COPIES/$NEW/bin/spec-lock" policy | tail -n 1
```

It installs the copy from committed objects, then rewrites only the copy's path inside the two `command` values, leaving the `event` keys and everything else alone. `doctor` accepts only the exact registration of the copy it runs from, so it prints `<repository>: ok`, and the last line is the new `spec-lock checker` line. Delete `$COPIES/$OLD` only once no hook command names it.

`node test/after-review-walk.mjs <old commit> [<new commit>]` runs this block, read from this file, on a scratch HOME and repository.

Selected semantic export binds the manifest's `policy` to `selected-v1:<sha256>` of
exact central bytes. The CLI, local landing and pre-push require the same policy,
version 2, complete claims and semantic reviews. Re-export after an owner policy edit.
The checker fingerprint includes the shell scope adapter. Run `spec-lock policy` to
inspect the effective local policy. Candidate commands cannot lower an active owner's
requirement. No remote workflow or GitHub repository is changed by this increment.

Ordinary documentation, first-commit and known landed/pulled-content exceptions
remain. Markdown agent instructions are not newly governed. The owner can still
bypass or modify same-user hooks and policy; this is not a protected execution boundary.
Before a real pilot, review those exceptions and its governed instruction paths.

`node test/portable-evidence-walk.mjs` runs capture, semantic and policy walks offline
and prints the temporary records directory. `all <directory>` saves to an explicit
output directory. `policy candidate <output.json>` runs only the 57 policy attempts.
The [policy specification](docs/specs/portable-evidence-policy.md) and its proof name
the measured scope and remaining limits.

### Plain coverage

On a machine in selected mode, the owner can give other repositories the plain proof rule: a code landing must add or edit a proof directly in `docs/proof/` whose `spec:` names a committed spec in the hardened shape, and the proof names every live AC id of that spec. No evidence manifest is required; an `evidence:` field is checked as version 1 when present. The selected repositories keep their own rule, and the central file, its bytes and the selected policy id are never touched.

The list lives in its own owner file, `~/.config/spec-lock/plain` under the HOME git runs with, one entry per line:

```text
plain /absolute/canonical/repository/.git
```

- The path is the repository's common Git directory, written as a `select` line writes it. An entry covers the repository whose common directory is the same directory, compared by identity, not spelling. An entry naming a directory that does not exist never matches.
- Blank lines and lines starting with `#` are ignored. Any other line, a relative path, a carriage return, a NUL byte or text that is not UTF-8 makes the file malformed.
- A selected repository is judged by the selected rule even when an entry also names it.
- A repository that is neither selected nor listed has no hooks and is not checked. Leaving a repository out is how it opts out. A listed repository is checked only once a plain rollout has registered its hooks, and `spec-lock check` there reports `unselected, not checked` until then.

A plain rollout file holds only these lines:

```text
lane <id> <state>          a lane in flight in any workspace; activation waits until each one is "landed"
repo <absolute path>       an inventory entry, recorded only
plain <absolute path>      a repository to give the plain rule
```

`spec-lock-rollout preview <file>` prints the plan. `spec-lock-rollout activate <file>` refuses, and writes nothing, while a lane has not landed, when the central file is missing or not in selected mode, when a plain repository is also selected or has its own `hook.spec-lock-*` setting, when the file holds any other kind of line, or when a plain file already exists with other entries; only its owner edits it. Otherwise it writes the plain file if there is none, registers the two hooks in each listed repository's common config with the marker `--plain`, confirms git runs them in each worktree, and appends an `activated-plain` line to `activation`. Run it from the checker installation the hooks should call, and keep that installation until the registrations are removed. `doctor` checks a plain registration as it checks a selected one, and also reports one whose repository the plain file does not list.

A plain registration fails closed: a missing or malformed central file or plain file refuses every branch update in that repository, and `spec-lock check` there exits 2. A registration whose repository the file does not list is not checked.

What `spec-lock check` proves: on a selected machine its first line is `spec-lock policy <id>; <rule>; ...`. The rule is `semantic-v2` or `legacy` in a selected repository, `plain` in a listed one registered with `--plain`, and `unselected, not checked` anywhere else. A later `spec-lock: ok` means the range would land only under the first three. Under `unselected, not checked` the ok proves nothing: the repository is not covered, and a report should say so instead of quoting the ok as a pass.

#### Rolling back plain coverage

Run this with `sh`. In the common config of each listed repository, it removes each hook `command` value that ends in ` --plain`, and that hook's `event` once no command value is left, leaving any other registration and every other setting alone, then empties the plain file. Deleting the file instead would make any plain registration left behind refuse every branch update; an empty list leaves it unchecked, and `doctor` reports it. To drop one repository later, run the same two unsets for it before deleting its line.

```sh
plain="$HOME/.config/spec-lock/plain"
while read -r entry dir || [ -n "$entry$dir" ]; do
  [ "$entry" = plain ] || continue
  for hook in spec-lock-reference-transaction spec-lock-pre-push; do
    git config --file "$dir/config" --unset-all "hook.$hook.command" ' --plain$' &&
      { git config --file "$dir/config" --get-all "hook.$hook.command" >/dev/null || git config --file "$dir/config" --unset-all "hook.$hook.event"; }
  done
done < "$plain"
printf '# plain coverage rolled back\n' > "$plain"
```
