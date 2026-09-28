# Verification records could omit requirements

## Problem

The version 1 checker accepted supplied claims without requiring every criterion
of the proof's own spec. It had no command recorder.

## Cause

The existing claim loop checked each supplied record in isolation. The saved
baseline accepted 21 of 33 invalid attempts in the frozen synthetic corpus.

## Fix

Add explicit candidate capture, export and checking commands. Bind approvals,
clean revisions, selected input bytes, output and recorded verifier observations.
The spec is `docs/specs/portable-evidence-capture.md`; the CLI tests and paired walk
are `test/portable-evidence.test.mjs` and `test/portable-evidence-walk.mjs`.

## How to spot it again

Remove one criterion or use a claim from another spec. Candidate checking must
refuse both. Keep unauthenticated provenance visible, and count absent capture
capability separately from a false acceptance. Semantic evidence and activation
remain unimplemented.

## Next verification increment

Reuse the frozen-case walker and receipt checker for the next increment. Preserve
the full baseline input payloads before implementation; this run had to reconstruct
those payloads afterward. The existing tools are enough for that improvement; no
additional skill is needed.
