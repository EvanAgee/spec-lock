# A captured failure did not establish the intended defect

## Problem

Binding-only candidate checks accepted records with missing or rejected failure,
expected-answer and changed-golden reviews.

## Cause

The prerequisite checker reserved semantic fields but did not interpret them.
The frozen baseline accepted all 36 invalid attempts in the declared semantic corpus.

## Fix

Add an explicit semantic candidate check and export actual red capture artifacts.
Bind reviews to the approved inputs, expected answer, red/green executions and exact
old/new golden bytes. Capture and export check golden approval before accepting its
use. The contract is in `docs/specs/portable-evidence-semantics.md`; CLI tests are in
`test/semantic-evidence.test.mjs`.

## How to spot it again

Remove the red review, replace the oracle bytes or approve a different golden.
The semantic checker must refuse each while accepting the complete control. Preserve
reviewed semantic judgment as a human or agent responsibility, not an automated truth
claim. Use the saved fixture bytes to replay measurements instead of reconstructing them.

## Verification lesson

Approve the command, working directory and selected test bytes together before a
red/green comparison. Testing only missing metadata left command substitution and
an older-format downgrade undetected. Isolate each guard in a removal test, and
reuse Git's existing NUL-delimited path reader instead of parsing displayed names.
Keep exact baseline inputs before editing. The existing workflow can do this without
another skill.
