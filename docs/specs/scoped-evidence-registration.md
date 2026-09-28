# Isolate selected hook registration

Baseline: `af25a151526080b51918e823bbdeea7849e7d929`. Design: no.

## Problem Statement

Selected activation currently registers hooks globally. Missing owner settings or a missing
checker can therefore block unrelated repositories before selection can be checked. Register
only inside explicitly selected repositories. Real activation remains a separate owner step.

## Seams

S1 is `spec-lock-rollout preview`, `activate` and `doctor` invoked in scratch homes.
S2 is actual Git branch updates and pushes to scratch bare remotes. S3 is the policy CLI.
Use the common repository configuration, shared by its current and future linked worktrees.
Keep owner policy outside candidate files. Keep legacy installation behavior unchanged.

## Acceptance Criteria

| AC | Requirement (EARS) | Red test, fixture, and mutation | Observable | Judge |
|---|---|---|---|---|
| AC1 | When selected activation runs, it shall register both named hooks only in each selected common Git config, preserve global and inventory configs, and show the registration files in a read-only preview. | `scoped-registration.test.mjs`: scratch selected and inventory repositories, preview snapshots, then activation. Baseline global registration fails config equality. | S1 exact config bytes before/after, effective hook lists, idempotent activation. | Node assertions on real Git config. |
| AC2 | When owner settings are missing or malformed, unrelated repository commits and pushes shall succeed while selected branch updates and pushes refuse without moving their targets. | Same test: delete/corrupt scratch owner config after actual activation; baseline blocks unrelated commits. | S2 exit status and target object ids, S3 missing-policy refusal. | Scratch Git integration assertions. |
| AC3 | When the registered checker disappears, unrelated Git operations shall succeed while selected updates and pushes refuse. | Same test: register a disposable copy then remove its adapter; baseline globally invokes the missing path. | S2 real exits and before/after refs. | Scratch Git integration assertions. |
| AC4 | When selection uses a linked worktree, a bare repository, or a path alias, registration shall cover that common repository and future worktrees without selecting a separate nested or similarly named repository. | Same test: spaces/glob characters, symlink, available case alias, linked and bare repositories; common config inspection plus actual Git updates. | S2 selected refusals, unrelated updates succeed, effective hook names. | Real Git config and update assertions. |
| AC5 | When conflicting hook settings or pending lanes exist, activation shall refuse before writing policy or registrations; doctor shall accept exact common registration and report worktree or included overrides. | Same test: global registration, local conflict, linked-worktree override, disabled hook and pending lane. | S1 nonzero exits and unchanged config bytes. | Scratch rollout CLI assertions. |
| AC6 | When selected registration is used, valid evidence and legacy installations shall retain their prior outcomes, and rollback shall remove only the four task-owned common-config keys. | Existing policy/legacy suite plus scratch rollback after a verified registration, preserving unrelated settings. | S2 valid evidence accepted, invalid evidence refused, legacy suite passes, rollback config values preserved. | Existing full offline suite and scoped tests. |

## Implementation contract

Selected activation writes four named hook command/event keys into each selected canonical
common Git directory's config. Reuse the existing registration helper and persistent
`--selected` argument. Bind each new selected command to its common directory using
Git and shell file identity before invoking the checker or reading policy. Inherited
registration in another repository must exit without invoking the checker. On an identity
mismatch, a direct command key in its own local config must refuse, so moving or copying
a registered repository cannot silently disable checking. Read that key without includes. No new global hook keys or conditional include files. Preview names
each destination and method. Effective policy lookup recognizes the local selected marker.

Preflight all selected repositories and their currently accessible worktrees. Refuse existing
global registrations, mismatched local hook entries, included or per-worktree hook overrides,
incomplete/disabled registration, a symlinked common config, or a common config also
reachable through global or system includes, even when empty or conditionally inactive.
Inspect the entire include graph conservatively, refusing unreadable paths or nesting
beyond ten levels. Exact existing common registration is idempotent.
Doctor accepts only the exact common registration from this checker installation, while
retaining legacy global diagnostics. Existing global installations need explicit owner migration;
this task must not silently remove or rewrite them. Existing repository hooksPath stays intact.

Write an activation record only after registration readback succeeds. Registration is not a multi-file transaction. An I/O error during writes can leave partial
selected registration, which the command reports as a failure. It never writes unrelated or
global configuration. Owner settings, local config and the checker remain owner-editable.
Deleting registration disables checking. With owner policy deleted, manual legacy
activation from an unrelated repository cannot discover selected registrations elsewhere;
it can still add global hooks. Preventing that separate owner action is out of scope. Moving a selected repository requires re-planning its
owner policy. These limits are not authenticated or tamper-resistant enforcement.

## End-to-end verification

Save symptom-bearing baseline failures using the same scratch activation and Git commands.
Run the new tests after each production change. Use the full offline npm suite through the
configured full-suite wrapper once after fixes. No real settings, hooks, logs or remote records
may change. Required alternating precommit reviews cover standards, this spec and evidence.
Commit source, then a distinct verifier checks approved input hashes and replays the scoped
cases from a clean worktree at that exact commit. Save each AC's command, assertion, expected
value, observed result and red/green link. Proof-only changes may follow the verified source.
No browser suite or video applies to this command-line-only change. Optional hosted canary
is not part of this offline registration increment.

## Alternatives and sources

Checked 2026-09-28 against [Git configuration](https://git-scm.com/docs/git-config#_conditional_includes)
and [Git worktrees](https://git-scm.com/docs/git-worktree). Conditional global includes keep
hooks outside repository config, but need glob escaping, alias matching and a retained include
file. Missing includes silently remove registration. Common repository config needs no glob or
extra file and follows linked worktrees, including when worktreeConfig is enabled. Per-worktree
settings can override either approach. Both are local, dependency-free and have no service cost.
Choose common config and explicitly diagnose overrides. Use
[Git configuration paths](https://git-scm.com/docs/git-var) to inspect every global/system
include target, rather than only effective origins. A command-level common-directory
check also protects unrelated repositories if an owner later shares registration locally.

[Git hooks](https://git-scm.com/docs/githooks) cover Git clients independently of the coding
agent. [Claude hooks](https://code.claude.com/docs/en/hooks) and
[Codex hooks](https://learn.chatgpt.com/docs/hooks) cover agent lifecycle events; they do not
replace the existing Git enforcement seam. Keep that seam and change only registration scope.

## Non-goals

Real activation, installation into real settings, migration of existing global hooks, publication,
merge, push, new evidence formats, authenticated identities, protected tests, generic reply
checking, or a change to documented first-commit/documentation/imported-content exceptions.

## Open questions

None blocks implementation. The owner must separately approve the concrete real deployment.
