# What the builder assumed, checked at landing

Baseline: `097c8fa` on `main`. Design: no.

## Problem Statement

A spec records the guesses made before a build, in its Assumptions section, and a proof records what the builder saw. Nothing records the guesses a builder makes while building: a default it picked, a gap in the spec it filled, a way two parts of the code talk to each other that nobody decided. The owner reads the proof at landing and cannot see those guesses, so a wrong one is found later, in use.

The lock already reads every proof a landing adds or edits. It checks the proof's spec and its acceptance ids, and nothing else in the proof's body.

## Intent

The owner wants every handover to list the guesses the builder made, written down and checked before the work lands. In the owner's words, 2026-10-21, answering "A fore ach" (A for each) to this choice:

> "What the builder guessed. [...] every handover to list the guesses the builder made.
> A: a required 'What I assumed' section in every proof, checked before the work can land. Guesses that change what a person sees, or how two parts of the code talk to each other, are marked for you. 'None' is allowed, but it has to be written."

This spec is the check. The rulebook text that tells builders to write the section is separate work.

## Solution

When a landing adds or edits a proof that the lock checks, and the proof's front matter `date` is on or after the go-live date, the proof must hold a `## What I assumed` section with at least one line that is not blank. "None" is such a line. A proof without one is refused, and the refusal names the proof file and the missing section. A proof dated before the go-live date is judged as before, so work already under way still lands.

## Seams

- `spec-lock check <old> <new>`: existing. It runs the same checker the two Git hooks and the GitHub action run, and workers run it before reporting done, so it is the highest seam that judges a landing.

Every criterion is tested at this seam in `test/proof-assumed.test.mjs`, on a synthetic repository in a temp directory with a scratch HOME and global git config, except AC4, which reads `README.md`.

## User Stories

### US1: a new proof must list the builder's guesses (P1)
As the owner, I want a proof dated on or after go-live refused when it has no `What I assumed` section, so that every handover tells me what the builder guessed.
**Independent Test:** run `spec-lock check` on a landing whose proof has no section, then on one whose section says "None".
**Criteria:** AC1, AC2

### US2: work under way still lands (P1)
As the owner, I want proofs dated before go-live judged as before, so that work started before the rule still lands without rework.
**Independent Test:** run `spec-lock check` on a landing whose proof is dated the day before go-live and has no section.
**Criteria:** AC3

### US3: the rule and its date are written down (P2)
As the owner, I want the README to state the section rule and say where the go-live date is set, so that I can read and move it.
**Independent Test:** read the README's rule section.
**Criteria:** AC4

## Decided

- A required "What I assumed" section in every proof, checked before the work can land; "None" is allowed but has to be written. 2026-10-21, the owner: "A fore ach" (A for each), recorded in the owner's grill record (`decided.md`, question 3, kept outside this public repository).
- Marking guesses that change what a person sees, or how two parts of the code talk to each other, is a reading aid, not a gate: the lock does not refuse on it. From the supervisor's brief for this task, which carries the owner's 2026-10-21 answer, "A fore ach", from the owner's grill record (`decided.md`, question 3, kept outside this public repository).
- Work already under way must still land: the rule applies only to proofs whose front matter `date` is on or after a go-live date set in one place. From the same brief, carrying the owner's 2026-10-21 answer, "A fore ach", from the owner's grill record (`decided.md`, question 3, kept outside this public repository).

## Assumptions

- technical: The go-live date is one constant in the checker's landing rule, `2026-10-22`, the day after the owner's answer. A constant, not an owner file in HOME, because the GitHub action runs the same checker on a runner with no owner files, and the hook and the action must agree. Moving the date is a one-line code change that ships like any other checker change.
- technical: The section is a level-two Markdown heading whose text is `What I assumed` (case and spacing do not matter), written `## What I assumed` (up to three spaces of indent, closing `#` marks allowed) or underlined with `-`. It ends at the next level-one or level-two heading of either form, or the end of the file; a level-three heading inside it counts as a line. Line endings may be LF or CRLF. Text inside fenced code blocks does not count, so a quoted example cannot stand in for the section.
- technical: The rule reads `date` as its first ten characters when they look like `YYYY-MM-DD`. A proof with no `date`, or one in another form, is not on or after the go-live date, so the rule does not apply to it. The rulebook already requires `date` in every proof; refusing a proof for a missing date would be a new rule.
- technical: The rule applies wherever the lock checks a proof today: legacy, plain and selected repositories, documentation-only landings that carry a proof, the hooks, the CLI and the GitHub action. An unselected repository is still not checked.

## Acceptance Criteria

| AC | Requirement (EARS) | Red test, fixture, and the mutation that proves it red | Observable on the real surface | Judge |
|---|---|---|---|---|
| AC1 | If a landing adds or edits a proof whose front matter `date` is on or after the go-live date and the proof has no `## What I assumed` section, or the section holds only blank lines, then `spec-lock check` shall exit 1 with a line naming the proof file and the missing `What I assumed` section. | `test/proof-assumed.test.mjs` "AC1": a scratch repository, a code commit with a hardened spec (AC1) and `docs/proof/value.md` dated the go-live date, naming AC1, with no section; a second proof whose section heading is followed only by blank lines; assert exit 1 and `docs/proof/value.md: no "## What I assumed" section`. Red at the baseline: the check prints `spec-lock: ok`. **Remove the section check from the proof rule and prove AC1 goes red.** | `spec-lock check` prints `- docs/proof/value.md: no "## What I assumed" section ...` then `spec-lock: refused`. | `test/proof-assumed.test.mjs` |
| AC2 | When a landing adds a proof dated on or after the go-live date whose `## What I assumed` section holds the line `None`, `spec-lock check` shall print `spec-lock: ok`, where the same landing with that line removed is refused. | Same file "AC2": the AC1 landing with `## What I assumed\n\nNone.\n` in the proof; assert exit 0 and `spec-lock: ok`, and assert the same proof with the `None.` line deleted exits 1 naming the section. Red at the baseline: the proof without the line is not refused. **Make the section check treat a line that says `None` as blank and prove AC2 goes red; remove the section check and prove AC2 goes red.** | `spec-lock check` prints `spec-lock: ok` for the `None` proof. | `test/proof-assumed.test.mjs` |
| AC3 | While a proof's front matter `date` is before the go-live date, when a landing adds that proof with no `## What I assumed` section, `spec-lock check` shall print `spec-lock: ok`, where the same proof dated the go-live date is refused. | Same file "AC3": the AC1 landing with the proof dated the day before the go-live date; assert exit 0, and assert the same proof dated the go-live date exits 1 naming the section. Red at the baseline: the proof dated the go-live date is not refused. **Remove the date comparison so the rule applies to every proof and prove AC3 goes red; remove the section check and prove AC3 goes red.** | `spec-lock check` prints `spec-lock: ok` for the earlier date. | `test/proof-assumed.test.mjs` |
| AC4 | The README shall state, in its rule section, that a proof dated on or after the go-live date needs a `## What I assumed` section with at least one non-blank line, that `None` counts, and where the go-live date is set. | Same file "AC4": read `README.md`, assert the rule section names `## What I assumed`, `None` and the go-live constant's name and value. Red at the baseline: the README never mentions the section. **Delete the README paragraph and prove AC4 goes red.** | `grep -n "What I assumed" README.md` prints the paragraph. | `test/proof-assumed.test.mjs` |

## End-to-end verification

```
npm test
```

Expected: every test passes, including `test/proof-assumed.test.mjs`. Then, on a throwaway repository, `node bin/spec-lock check <base> <tip>` for three landings: a proof dated the go-live date with no section prints `spec-lock: refused` and names the proof and the section; the same proof with `None` under the section prints `spec-lock: ok`; the first proof dated the day before go-live prints `spec-lock: ok`. Failure is any test failing or any of the three verdicts differing.

## Non-goals

- Refusing on whether a guess is marked for the owner: the marking is a reading aid.
- Judging what the section says beyond one non-blank line: whether the guesses are honest or complete is for the reader and the reviewers.
- Requiring a `date` in every proof: a separate rule, with its own effect on work under way.
- The rulebook text that tells builders to write the section, another project's own proof check, and the supervisor's own code: other tasks.
- Moving the machine-wide hook pin or the selected copies: the supervisor does that after landing.

## Open questions

None.

## Further Notes

Solution notes used: `docs/solutions/2026-10-09-unselected-repos-unchecked.md`: the rule changes only what a checked proof must hold, so what `spec-lock check` proves in an unselected repository stays as that note says.
