---
tags: [spec-lock, proof-rule, assumptions]
date: 2026-10-21
issue: proof-assumed
spec: docs/specs/2026-10-21-proof-assumed.md
walked: 944ba003
---
# What the builder assumed, checked at landing

A proof dated on or after 2026-10-22 must now say what the builder guessed while building, in a `## What I assumed` section with at least one line that is not blank. `None` counts. Without it, `spec-lock check`, both Git hooks and the GitHub action refuse the landing, and the refusal names the proof file and the section. Proofs dated earlier, or with no `YYYY-MM-DD` date, are judged as before, so work already under way still lands. The go-live date is one constant, `ASSUMED_FROM` in `lib/lock.mjs`, and the README says so. Nothing checks whether a guess is marked for the owner.

This is a local candidate on the task branch: nothing was pushed, and the machine-wide hook pin and the selected copies were not touched.

## What I walked

Every run used a scratch HOME, a scratch global git config with `GIT_CONFIG_NOSYSTEM=1`, and synthetic repositories in a temp directory. This change has no screen, so there is no video or design review.

- Live walk at `944ba003`, `node bin/spec-lock check <base> <tip>` on a throwaway repository with one code change, a hardened spec and three proofs. [Script](https://assets.agee.dev/evidence/spec-lock/a690f97bda5bf642eae38db8e687dd53/walk.sh), [output](https://assets.agee.dev/evidence/spec-lock/5288c8911c8c7fb0f5c727ccf9ed71f9/walk.txt). What it printed:

  ```text
  ### 1. dated go-live, no What I assumed section
  spec-lock: refused 04bce310373c64740e9f1009f3724080bc2c8ca6..8314cf24c7ef3586230ab1167cff1d00c0ec8cef
  - docs/proof/value.md: no "## What I assumed" section with a line that is not blank ("None" counts); a proof dated 2026-10-22 or later must say what the builder assumed
  spec-lock checker 0.0.0+e4d07caf32c5
  (exit 1)
  ### 2. dated go-live, section says None
  spec-lock: ok
  spec-lock checker 0.0.0+e4d07caf32c5
  (exit 0)
  ### 3. dated the day before go-live, no section
  spec-lock: ok
  spec-lock checker 0.0.0+e4d07caf32c5
  (exit 0)
  ```

- Full suite at `944ba003`'s code, through `full-suite-slot npm test`: `# tests 140`, `# pass 139`, `# fail 0`, `# skipped 1` (the GitHub canary, which pushes to a real repository). [Output](https://assets.agee.dev/evidence/spec-lock/6fa1b783c28fdb9853d14f79c02087f7/full-suite.txt).
- First red, before the rule existed: with only the `ASSUMED_FROM` constant added, all four tests failed, AC1 to AC3 because `spec-lock check` printed `spec-lock: ok`, AC4 with `the rule section does not mention ## What I assumed`. [Output](https://assets.agee.dev/evidence/spec-lock/756255794d66219141a77a577365cd71/red-baseline.txt).
- Controls on a throwaway copy made with `control-copy`, on the final code: 17 mutations, one per AC guard and one per review bug, each turning the named test red. A first version of the "fenced text counts" mutation crashed the checker after the round 2 change, so it went red for the wrong reason; it was rewritten and rerun, and now only AC1 goes red. [Script](https://assets.agee.dev/evidence/spec-lock/62b54b438f694fe0cede05b14162aadf/controls.sh), [output](https://assets.agee.dev/evidence/spec-lock/e9c511f1d64a6c39613a51ca11ed3dca/controls.txt).

| AC | Test and its oracle | Observed |
|---|---|---|
| AC1 | `test/proof-assumed.test.mjs` "AC1": `spec-lock check` exits 1 and prints `- docs/proof/value.md: no "## What I assumed" section` for a proof dated go-live with no section, a quoted date, a section of blank lines, a section holding only a fence, CRLF with a fence, an empty section closed by an indented, setext or level-one heading, a level-three heading, a fake heading built across a fence, tab-indented text, a setext heading that continues a paragraph, an edited proof, and a documentation-only landing. Through the registered Git hook, `git update-ref refs/heads/main <tip>` exits non-zero with the same line and `main` stays at base. | ok. Baseline red. "The section check removed": AC1, AC2, AC3 red. "Fenced text counts", "setext underline not skipped", "a level-one heading does not end the section", "paragraph start guard removed": only AC1 red. "Fenced lines dropped", "round 1 parser put back", "list item guard removed", "tab indent guard removed": AC1 and AC2 red. Walk case 1: exit 1 with the line. |
| AC2 | "AC2": a section saying `None.` prints `spec-lock: ok`, and the same proof without that line exits 1 naming the section. Other spellings pass: CRLF, `  ## what i assumed ##`, a setext heading, a level-three heading inside, and `None` written as a list item, tab or four-space code, quote, ordered item or rule above `---`. | ok. Baseline red (the proof without the line was not refused). "A line saying None counts as blank": AC2 red. "Four-space", "quote", "ordered list" guards and "underline self-check" removed: only AC2 red. "List item" and "tab" guards removed: AC1 and AC2 red. Walk case 2: `spec-lock: ok`. |
| AC3 | "AC3": the proof dated the day before `ASSUMED_FROM`, with no section, prints `spec-lock: ok`; the same proof dated `ASSUMED_FROM` and dated `2027-01-01` each exit 1 naming the section. | ok. Baseline red. "The date comparison removed" and "the date compared for equality only": AC3 red. Walk case 3: `spec-lock: ok`. |
| AC4 | "AC4": the README's rule section contains `## What I assumed`, `on or after the go-live date`, `line that is not blank`, `` `None` counts ``, `ASSUMED_FROM` and its value `2026-10-22`. | ok. Baseline red. "The README paragraph deleted": AC4 red. |

## What I assumed

- The go-live date is `2026-10-22`, the day after the owner's answer. It is a constant in the checker, not an owner file, because the GitHub action runs on a machine with no owner files and must agree with the hooks. The supervisor may move it with a one-line change before the pin moves. Marked for the owner: from that date, a builder who has not yet read the new rulebook text gets a refusal until the section is written.
- A proof with no `date`, or a date not written `YYYY-MM-DD`, is not covered. Refusing it would be a new rule that also hits work under way.
- The section is found the way Markdown draws headings: `##` headings (indent up to three spaces, closing `#` marks), `-` underlined headings that start a paragraph, any case and spacing, CRLF or LF, and nothing inside code fences. A level-three heading inside the section counts as a line.
- The rule runs wherever the lock already checks a proof: legacy, plain and selected repositories, documentation-only landings, the hooks, the CLI and the GitHub action. Unselected repositories stay unchecked.

## Reviews

Four rounds, alternating, both reviewers at high effort, run from the worktree. `$D` is the supervisor's task data folder outside the repository; each request and review was saved there and then uploaded. Rounds 3 and 4 ran because the round before each still found real bugs. Four is the limit.

1. Codex: `codex exec --skip-git-repo-check --model "${AGENTS_REVIEW_MODEL:-gpt-6-astra}" -c model_reasoning_effort="high" -o $D/review-round1-codex.md "$(cat $D/review-request.txt)" < /dev/null > $D/review-round1-codex.log 2>&1`. [Request](https://assets.agee.dev/evidence/spec-lock/6a76cd69ed3b862d472c0766db0570f7/review-request.txt), [review](https://assets.agee.dev/evidence/spec-lock/ab7a9f11926facd3d6b25a40db7fbaa4/review-round1-codex.md). Two bugs, fixed: CRLF line endings hid the section, and closing `#` marks, indented and setext headings were not read as headings, so an empty section followed by one passed. Two evidence gaps, fixed: a weak README test, and no edited-proof, documentation-only or hook case.
2. Claude Opus 5.5: `CLAUDE_CODE_NO_MODEL_FALLBACK=1 CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK=1 claude -p --model claude-opus-5-5 --effort high --output-format json --settings '{"env":{"CLAUDE_CODE_SUBAGENT_MODEL":"claude-opus-5-5"}}' "$(cat $D/review-request-round2.txt)" < /dev/null > $D/review-round2-opus.json`. `modelUsage` names only `claude-opus-5-5`. [Request](https://assets.agee.dev/evidence/spec-lock/f695edb6e92dcb6d5f1d653bb62321ef/review-request-round2.txt), [review](https://assets.agee.dev/evidence/spec-lock/89ce0a7de47c6133e1101319f735eac3/review-round2-opus.json). Two low bugs, fixed: dropping fenced lines joined the lines around a fence into a fake heading, and a list item above `---` was read as a heading. One gap, fixed: no date after go-live was tested. It also flagged the stale walk and suite records, both rerun above, and the duplicated underline pattern, now one constant.
3. Codex: `codex exec --skip-git-repo-check --model "${AGENTS_REVIEW_MODEL:-gpt-6-astra}" -c model_reasoning_effort="high" -o $D/review-round3-codex.md "$(cat $D/review-request-round3.txt)" < /dev/null > $D/review-round3-codex.log 2>&1`. [Request](https://assets.agee.dev/evidence/spec-lock/727ec9d25d853908ede816aed8a3e7d8/review-request-round3.txt), [review](https://assets.agee.dev/evidence/spec-lock/de1448f4b1be9c18938c75339eb08759/review-round3-codex.md). One bug, fixed: tab-indented text could be read as heading text, making a fake section or a false refusal. It confirmed `unfenced` with its default argument matches the old output on 20,736 generated inputs.
4. Claude Opus 5.5: `CLAUDE_CODE_NO_MODEL_FALLBACK=1 CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK=1 claude -p --model claude-opus-5-5 --effort high --output-format json --settings '{"env":{"CLAUDE_CODE_SUBAGENT_MODEL":"claude-opus-5-5"}}' "$(cat $D/review-request-round4.txt)" < /dev/null > $D/review-round4-opus.json`. `modelUsage` names only `claude-opus-5-5`. [Request](https://assets.agee.dev/evidence/spec-lock/1c978033b3b68db24063941ada521d78/review-request-round4.txt), [review](https://assets.agee.dev/evidence/spec-lock/add261000d2594b9e8872c5255406cc9/review-round4-opus.json). One bug, fixed: a line continuing a paragraph above `---` was read as the section's heading. Three evidence gaps, fixed with tests and controls: the underline skip, a level-one heading ending the section, and the indent, quote, ordered-list and underline guards. The front-matter strip it called untested was removed: front matter cannot form a "What I assumed" heading. These fixes came after the last round, so no reviewer has read them; the 17 controls and the full suite above ran on them.

## Known limits

- A proof can skip the rule by leaving out `date` or writing an earlier one. The rulebook requires `date`, but the lock does not check it.
- A horizontal rule or an HTML comment alone counts as the required line.
- The parser covers the heading forms above, not all of Markdown: a heading inside a block quote or a list, or HTML headings, are read as plain lines.
- The rule goes live on 2026-10-22 whether or not the rulebook text that asks builders for the section has landed by then; the refusal names the fix.
- The GitHub action shares the checker but was not run: enrolled repositories run it only after the pin moves.

```text
Ran: node --test test/proof-assumed.test.mjs (red with only the constant, then after each fix); test/spec-lock.test.mjs after the fence change; the control script on a throwaway copy (17 mutations, rerun once after fixing a mutation that crashed the checker); full-suite-slot npm test; the walk script at 944ba003; spec-lint on the spec; four review rounds.
Printed: 4/4 red at the start, 4/4 green at the end; each mutation red on its named test; 140 tests, 139 pass, 0 fail, 1 skipped; walk exits 1, 0, 0 with the refusal line above; spec-lint ok (AC1 to AC4); modelUsage claude-opus-5-5 alone on both Opus rounds.
Did not run: the GitHub canary walk (it pushes to a real repository); a video or design review (no screen); a fifth review round (four is the limit), so the round 4 fixes were checked by tests and controls only.
Unverified: the GitHub action's verdict on the new rule (same checker code, not run on a runner).
```
