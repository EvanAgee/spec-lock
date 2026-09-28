# Missing checker settings blocked unrelated repositories

## Problem
Selected-only rollout installed global hooks. An unrelated commit could fail when owner
settings disappeared, and deleting the registered adapter blocked unrelated Git operations.

## Cause
The adapter must read and validate owner settings before it knows repository selection.
Global registration invoked that adapter everywhere. The baseline integration tests observed
unrelated commits refused for missing policy and missing executable failures.

## Fix
Selected activation registers in each common repository config. Worktrees share that config.
The policy CLI reads effective hook markers. Rollout checks all global/system include
paths and worktree overrides. Commands verify common-directory identity before invoking
the checker; moved repositories with direct registration refuse until the owner migrates. See `docs/specs/scoped-evidence-registration.md` and
`test/scoped-registration.test.mjs`.

## How to spot it again
Inspect the configuration origin of `hook.spec-lock-reference-transaction.command`.
If selected activation writes a global key, repository isolation is lost. Test actual
unrelated commits with deleted policy and checker files, not only valid-policy selection.
