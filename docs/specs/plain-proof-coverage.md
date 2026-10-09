# Plain proof rule for repositories outside selection

Baseline: `5d9d61b8` on `main`. Design: no.

## Problem Statement

A machine in selected mode checks only the repositories on a `select` line of the central file, and holds them to version 2 semantic evidence. Every other repository is not checked at all: its hooks are not registered, and `spec-lock check` there prints `unselected, not checked` and then `spec-lock: ok` for any range, code without a proof included. The legacy way to cover the rest, global hooks with an opt-out list, cannot be used: `spec-lock-rollout activate` refuses a legacy rollout on a selected machine (`legacy activation cannot replace selected registration`), and the shell hook skips every repository that no `select` line names.

Selecting the other repositories does not help either. Every one of them would then need version 2 semantic evidence for each code landing, and any edit to the central file changes the selected policy id, `selected-v1:<sha256 of its exact bytes>`, which every version 2 manifest carries. Manifests already exported for the selected repository would stop passing.

The owner wants the plain proof rule (a proof that names a committed spec and every one of its acceptance ids) on every repository of the machine except a few opt-outs, while the selected repository keeps its stricter rule, its installed checker copy, its hook commands and its policy id exactly as they are.

Solution notes used: `docs/solutions/2026-09-28-scoped-registration.md`: registration goes in each repository's common config, never the global config, so a missing checker or owner file cannot stop git in unrelated repositories. `docs/solutions/2026-09-28-evidence-policy-scope.md`: the shell and CLI readers share the malformed-input cases, check raw bytes before parsing, and match directories by identity rather than spelling. `docs/solutions/2026-10-09-bot-file-voids-proofs.md`: an owner list that must not change the policy id lives in its own HOME file.

## Solution

The owner lists the repositories that get the plain rule in a second owner file, `~/.config/spec-lock/plain`. A plain rollout registers the two hooks in each listed repository's common config with a `--plain` marker and writes that file. It reads the central file only to confirm selected mode, never writes it, and never touches a selected registration. In a listed, registered repository the hooks and `spec-lock check` judge every landing by the plain proof rule. Repositories that are neither selected nor listed stay unchecked, and `spec-lock check` keeps saying so on its first line.

## Seams

- `spec-lock-rollout activate|preview|doctor <file or repository>`: existing. It is the owner's only way to register hooks, and the seam the real switch-on uses.
- A real `git merge --ff-only`, `git update-ref` and `git push` on `main` in a scratch repository whose hooks the rollout registered: existing. It proves the shell hook and the Node adapter agree.
- `spec-lock check <old> <new>`: existing. Workers run it before reporting done.
- The README's plain rollback block, read from `README.md` and run with `sh`: **new**, because the rollback is a documented owner command and nothing higher runs it.

Every criterion is tested at one of these seams in `test/plain-coverage.test.mjs`, on synthetic repositories in a temp directory with a scratch HOME and global git config, reusing `test/policy-fixture.mjs` for the selected repository.

## User Stories

### US1: every other repository gets the plain rule (P1)
As the owner, I want unproved code refused on the main branch of every listed repository, and proved code accepted without evidence manifests, so that the lock covers the whole machine without asking every project for semantic evidence.
**Independent Test:** activate a plain rollout for one scratch repository, then try an unproved and a proved landing by merge, update-ref and push.
**Criteria:** AC1, AC2

### US2: the selected repository is untouched (P1)
As the owner, I want the selected repository's policy id, checker copy, hook commands and verdicts unchanged by the plain rollout, so that its exported manifests keep passing.
**Independent Test:** compare the central file, the selected common config and `spec-lock policy` before and after a plain activation, and rerun a selected landing.
**Criteria:** AC3

### US3: opt-outs and failures are safe (P1)
As the owner, I want unlisted repositories left alone, a broken owner file to refuse rather than let code through, and activation to stop before writing anything when its plan is unsafe.
**Independent Test:** an unlisted repository commits unproved code; a malformed plain file refuses a listed repository's landing; each unsafe rollout changes no file.
**Criteria:** AC4, AC5, AC6

### US4: the owner can check and undo it (P2)
As the owner, I want `doctor` to confirm each plain registration, and one documented block to remove every plain registration, so that I can verify and roll back the switch-on myself.
**Independent Test:** `doctor` on a registered repository, then the README block, then an unproved landing that now passes.
**Criteria:** AC7, AC8

## Decisions

- **Plain rule (supervisor decision, 2026-10-09).** A repository on the plain list is judged exactly as the legacy rule judges it: a code landing must add or edit a proof directly in `docs/proof/` whose `spec:` names a committed spec in the hardened shape, and the proof names every live AC id of that spec. An `evidence:` field stays optional and, when present, is checked as version 1. The documentation, pull and first-commit exceptions apply as before.
- **Its own owner file (supervisor decision, 2026-10-09).** `~/.config/spec-lock/plain` under the HOME git runs with, beside `config` and `after-review`. Only HOME places it; no environment variable, repository file or git config key names it. The central file and the selected policy id are never read differently or written by anything in this change.
- **Format.** One entry per line: `plain <absolute path of a common git directory>`, written as a `select` line writes it. Blank lines and lines starting with `#` are ignored; leading and trailing spaces and tabs are trimmed. Any other line, a relative path, a missing path, a carriage return, a NUL byte or a byte sequence that is not UTF-8 makes the file malformed. An entry whose directory does not exist never matches anything, so a removed clone does not break the others.
- **Matching by identity.** An entry covers the repository whose common git directory is the same directory (the shell's `-ef`, device and inode in Node), so a case-insensitive disk or a symbolic link in the spelling cannot drop a repository out.
- **Per-repository registration (supervisor decision, 2026-10-09).** The two hooks go into each listed repository's common config, as selected registration does, with the same moved-repository guard and the marker `--plain` in place of `--selected`. Nothing goes into the global config, so an unregistered repository never runs the hook and never needs Node.
- **Plain rollouts are separate.** A rollout file with `plain` lines holds only `lane`, `repo` and `plain` entries. Mixing them with `mode`, `evidence`, `select`, `integration` or `opt-out` refuses, because those change the central file. Plain activation requires an existing central file in valid selected mode and leaves its bytes as they are; integration branches stay whatever that file lists.
- **Selected wins.** A repository on a `select` line is judged by the selected rule even if a plain entry also names it. Plain activation refuses to list a selected repository.
- **Fail closed.** In a repository registered with `--plain`, a missing or malformed central file, or a missing or malformed plain file, refuses every branch update and push of a branch, exactly as a broken central file does for a selected registration, and `spec-lock check` exits 2. A plain registration whose repository the file does not list is not checked, as a selected registration whose repository no `select` line names is not.
- **What `spec-lock check` proves.** On a selected machine its first line is `spec-lock policy <id>; <rule>; ...`. The rule is `semantic-v2` or `legacy` in a selected repository, `plain` in a listed one whose hooks carry `--plain`, and `unselected, not checked` in any other, a listed but unregistered one included, because no hook checks it. Only the first three make a later `spec-lock: ok` mean the range would land; under `unselected, not checked` the ok proves nothing, and a worker's report must say the repository is not covered rather than quote the ok as a pass.
- **Opt-outs.** A repository the owner leaves out is simply not listed and not registered. There is no opt-out line in plain mode.
- **Rollback.** A README block removes, in the common config of each listed repository, each hook `command` value that ends in ` --plain`, and that hook's `event` once no command value is left, then empties the plain file. It empties rather than deletes it, because a plain registration left behind (a repository whose line was removed earlier) would refuse every branch update with no file, but is simply not checked with an empty one.
- **Existing plain file.** Activation compares the entries of an existing plain file with the plan, not its bytes, so the owner's comments and spacing stay; a file that lists nothing, as a rollback leaves it, counts as no file and is rewritten.
- **Activation record.** Plain activation appends one JSON line with `event: activated-plain` to the `activation` file beside the landing log: the plain entries, the drained lanes, the inventory, the checker line, each repository's guarded branches and the registration files.

## Acceptance Criteria

| AC | Requirement (EARS) | Red test, fixture, and the mutation that proves it red | Observable on the real surface | Judge |
|---|---|---|---|---|
| AC1 | When the main branch of a repository the plain rollout listed and registered is moved to a commit that adds code without a proof, by `git merge --ff-only` in its main worktree or a linked worktree, by `git update-ref`, or by `git push` to a remote's `main`, the system shall refuse the move, leave the branch where it was, and make `spec-lock check` exit 1 with `no proof:` after a first line naming `plain`. | `test/plain-coverage.test.mjs` "AC1": a scratch repository with `main` at a base commit and a lane commit adding `src/value.mjs`; plain rollout `plain <repo>`; assert each move exits non-zero and `rev-parse main` is unchanged; assert the CLI output. Red at the baseline: activation exits non-zero on the `plain` line. **Mutate the policy reader to ignore the plain file and prove AC1 goes red.** | `git merge --ff-only lane` prints `spec-lock: refused refs/heads/main` and `no proof`; `spec-lock check` prints `; plain;` then `spec-lock: refused`. | `test/plain-coverage.test.mjs` |
| AC2 | When the same repository's main is moved to a commit that also adds a proof naming a committed hardened spec and each of its AC ids, with no `evidence:` field, the system shall accept the move by merge and by push, and `spec-lock check` shall print `spec-lock: ok`. | Same file "AC2": the lane plus `docs/specs/value.md` (AC1, AC2) and `docs/proof/value.md` naming both. Red at the baseline: activation fails. **Mutate the plain policy to require version 2 evidence and prove AC2 goes red with `required version 2 evidence is missing`.** | `git merge --ff-only` moves `main`; the remote's `main` equals the pushed commit; the CLI prints `spec-lock: ok`. | `test/plain-coverage.test.mjs` |
| AC3 | When a plain rollout is activated on a machine with a selected repository, the system shall leave the central file's bytes, the selected policy id printed by `spec-lock policy`, and the selected repository's common config byte for byte as they were, and the selected repository shall still refuse a proof without version 2 evidence and accept the valid semantic landing. | Same file "AC3": the `test/policy-fixture.mjs` selected repository registered from this checkout, plus a plain repository; read the three before and after `activate`; then `spec-lock check` on the fixture's `legacy` tip (exit 1, `required version 2 evidence is missing`) and `valid` tip (exit 0). Red at the baseline: activation fails. **Mutate plain activation to append its entries to the central file and prove AC3 goes red.** | `cmp` of the central file and selected config; `spec-lock policy` prints the same `selected-v1:` id. | `test/plain-coverage.test.mjs` |
| AC4 | While a repository is neither selected nor on the plain list, the system shall register no hook in it, let unproved code commit to and push to its `main`, and make `spec-lock check` there print `unselected, not checked` before `spec-lock: ok`; and while a repository is listed but its hooks were never registered, `spec-lock check` shall print the same, as no hook checks it. | Same file "AC4": a second scratch repository on a `repo` inventory line of the plain rollout but not on a `plain` line; assert `git hook list reference-transaction` is empty, an unproved commit on `main` and its push succeed, and the CLI lines; then list it in the plain file by hand and assert the CLI still prints `unselected, not checked`. Red at the baseline: activation fails. **Mutate plain activation to register inventory repositories too and prove AC4 goes red.** | `git hook list reference-transaction` prints nothing; `spec-lock check` prints `unselected, not checked`. | `test/plain-coverage.test.mjs` |
| AC5 | If a repository is registered for the plain rule and the plain file is missing, holds a relative path, an unknown first word, a `plain` line with no path, a carriage return, a NUL byte or a byte that is not UTF-8, or the central file is missing, then the system shall refuse an update of `main` with a message naming the policy and make `spec-lock check` exit 2; and if an entry names a directory that does not exist, then the system shall judge the listed repository as before. | Same file "AC5": after a valid activation, replace the plain file with each case and try `git update-ref refs/heads/main <proved tip>` and the CLI; then a valid file with an extra `plain /no/such/dir/.git` line: the proved tip lands and the unproved one is refused. Red at the baseline: activation fails. **Mutate the shell hook's plain parser to skip lines it does not know and prove AC5 goes red.** | `git update-ref` prints `spec-lock: required policy is missing or malformed` (from the shell reader) or `required plain coverage ... is not UTF-8 text` (from the Node reader, which alone decodes text); `spec-lock check` exits 2. | `test/plain-coverage.test.mjs` |
| AC6 | If a plain rollout names a lane that has not landed, a plain repository that is also selected, a repository whose config sets a `hook.spec-lock-*` key, or mixes `plain` with `select`, `mode`, `evidence`, `integration` or `opt-out` lines, or the central file is missing or not in selected mode, or a plain file already exists with other entries, then the system shall exit non-zero naming the reason and write no file. | Same file "AC6": one rollout per case; snapshot the central file, the plain file, the activation record and every repository config before and after; assert all equal and the reason in stderr. Red at the baseline: the rollout is refused for the `plain` line instead of the named reason. Also: an existing file with a comment, a blank line and the same entry with trailing spaces activates again without change. **Mutate activation to skip the existing-file comparison and prove AC6 goes red.** | `spec-lock-rollout activate` prints `spec-lock-rollout: <reason>` and exits 1. | `test/plain-coverage.test.mjs` |
| AC7 | When `spec-lock-rollout doctor` runs from the checker the hooks name, the system shall print `<repository>: ok` for a plain-registered repository on the list, and shall report a plain registration whose repository the file does not list or whose plain file is missing, and a local `hook.spec-lock-reference-transaction.enabled=false`, each as a line for that repository with exit 1. | Same file "AC7": doctor after activation; then remove the entry; then delete the plain file; then restore it and set the local key. Red at the baseline: activation fails. **Mutate doctor to skip the listing check and prove AC7 goes red.** | `doctor` prints `<repo>: ok`, then a line naming the plain file, then the overriding key. | `test/plain-coverage.test.mjs` |
| AC8 | The README shall state the plain rule, the plain file's format, the plain rollout lines, what `spec-lock check` proves in a repository that is neither selected nor listed, and give the plain rollback as one shell block that, run with `sh`, leaves no plain hook registered in a listed repository and a plain file that lists nothing, removes only the plain values of a mixed registration, including a hook holding both a selected and a plain command value, lets a repository whose plain line was removed earlier still create branches, and leaves a selected repository's config byte for byte the same, even when the plain file also names it. | Same file "AC8": append `plain <selected common dir>` to the plain file, as an owner slip would, then read the block under `#### Rolling back plain coverage` from `README.md` and run it with `sh` under the scratch HOME; assert `git hook list` is empty in the plain repository, an unproved landing there succeeds, the same rollout activates again afterwards, the plain file lists nothing, a mixed registration keeps its selected command values and their event, `git branch` succeeds in a plain-registered repository that was not listed, and the selected config is unchanged. Red at the baseline: the heading is missing. **Break the block's `--plain` guard so it also unsets the selected repository and prove AC8 goes red.** | `grep -n "^### Plain coverage\|^#### Rolling back plain coverage" README.md` lists both headings; the test prints the block's exit 0. | `test/plain-coverage.test.mjs` and the grep |

## End-to-end verification

```
npm test
```

Expected: every test passes, including `test/plain-coverage.test.mjs`, which builds a scratch HOME with a selected repository, runs the real `spec-lock-rollout activate` on a plain rollout, moves `main` by merge, update-ref and push in the plain repository (unproved refused, proved accepted), confirms the selected repository's bytes and verdicts are unchanged, and runs the README rollback block. Failure is any test failing, or a skipped test other than the GitHub canary.

## Non-goals

- Changing the selected rule, the selected policy id, the central file's format, or how a selected copy is refreshed.
- Opt-out lines, globs or folder entries in the plain file: a repository is covered by naming it.
- Global hook registration: it lets a missing checker stop git in every repository.
- The GitHub action and rulesets: a runner has no owner files, and enrolling repositories on GitHub is separate work.
- Writing the real plain file, registering real repositories or moving a real checker pin: the supervisor does that after landing, with a refreshed rollout file.

## Open questions

None.
