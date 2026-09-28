# Evidence requirements did not follow repository selection

## Problem

A complete prose proof could support code without execution evidence. A global hook
also blocked repositories that an owner intended to leave outside the pilot.

## Cause

The ordinary checker accepted optional version 1 evidence. The shell hook used an
opt-out list; rollout inventory had no separate enrollment meaning. The frozen
baseline accepted 24 missing/legacy attempts and blocked nine unselected operations.

## Fix

Add explicit selected scope and an owner evidence requirement. Resolve linked
worktrees to the common Git directory and bind exports to exact owner policy bytes.
A persistent registration marker prevents missing settings from restoring legacy
behavior. The contract is in `docs/specs/portable-evidence-policy.md`; actual CLI,
merge and push checks are in `test/policy-evidence.test.mjs`.

## How to spot it again

Try a prose-only proof in a selected repository and unproved code outside selection.
The first must refuse; the second must remain untouched. Preserve unsupported schema
results separately from accepted invalid evidence when comparing the old checker.

## Review findings, 2026-09-28

CLI and shell policy readers must share malformed-input cases, including comments,
empty values and included hook registrations. Two review rounds exposed differing
verdicts there. Directory spelling also failed on a case-insensitive disk; directory
identity preserves selection. Inventory tests must use a distinct repository, since
listing the selected repository twice hides accidental enrollment. The regression
fixtures and controls in the policy proof retain these observations.

Third-round probes also found that an older activation path could clear selected
registration and shell reads could discard binary bytes. Activation must preserve
owner-mode persistence, and shell validation must check the bytes before parsing.
The added regressions retain both failures.

Fourth-round probes found two more format assumptions: JavaScript's dot did not
match Git-valid Unicode separators, and hashing decoded text lost invalid UTF-8
comment bytes. The reader now splits on LF and fingerprints raw bytes. Both cases
remain in the shared adapter regressions. Keep this in the existing workflow and
test suite; another skill would not prevent parser disagreement.
