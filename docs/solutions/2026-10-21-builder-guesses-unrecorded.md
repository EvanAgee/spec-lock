# A builder's guesses reached landing unrecorded

## Problem
A spec lists the guesses made before a build and a proof lists what the builder saw, but nothing listed the guesses a builder made while building. The owner could not see them at landing.

## Cause
The lock read each proof only for its `spec:` field and the acceptance ids. Nothing asked the proof to say what the builder assumed.

## Fix
A proof dated on or after the go-live date (`ASSUMED_FROM` in `lib/lock.mjs`) must hold a `## What I assumed` section with a line that is not blank; `None` counts. Proofs dated earlier, or with no `YYYY-MM-DD` date, are judged as before. Spec `docs/specs/2026-10-21-proof-assumed.md`; tests `test/proof-assumed.test.mjs`.

## How to spot it again
`spec-lock check` prints `no "## What I assumed" section with a line that is not blank`. Add the section, or write `None` under it. A heading inside a code fence does not count.
