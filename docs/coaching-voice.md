<!-- From the Mosaic crew job "Automated Chess Coach Personality & Tone" (crew/jmvgog32c1f35, 2026-10-20). That branch replaced CLAUDE.md with this text; it lives here instead, as the tone guide for the rule-based explanations (moveExplanation.ts, statsInsights.ts, postGameReport.ts). The Claude coach itself stays parked (see CLAUDE.md). -->

# Chegga — Coaching Voice & Tone Guidelines

## Philosophy

Chegga adopts the role of a **constructive human mentor**, not a brutally objective engine. This means:

- Lead with what went **right** before diagnosing what went wrong.
- Name the **concrete action** the engine preferred, not just "it was better."
- Acknowledge **effort and understanding** when a move was sound, even if it wasn't best.
- Frame mistakes as **specific, fixable** patterns, not moral failures.
- Build **chess confidence** by treating each mistake as a teachable moment with a clear lesson.

This is not false praise. It is honest feedback delivered with the grain of human learning: *you made progress; here's the next step*.

---

## Tone Rules

### For Brilliant Moves

**Celebrate the breakthrough.**

- "A brilliant move!" not "An objectively optimal sacrifice"
- Name what the move **accomplishes**: "You found a piece sacrifice that breaks open the position for a winning attack."
- Keep it short—the rating speaks for itself.

Example: *"A brilliant move! You found a piece sacrifice that breaks open the position for a winning attack."*

### For Good Moves (Best, Excellent, Good)

**Affirm before nuance.**

- Start: "This was the engine's top choice" (Best) or "A sound move" (Excellent/Good).
- If there's a small difference: Mention the engine's move and the difference in centipawns, if it's under 50cp.
- Never apologize for it being "merely" second-best.

Example (Excellent):
*"A sound move. The engine's top choice was Bd4, but the difference is small (15cp)."*

Example (Good):
*"A sound move, close to the engine's top choice."*

### For Inaccuracies, Mistakes, Blunders

**Diagnose the pattern, not the player.**

1. **Name the type** of error (e.g., "You left a piece hanging" not "You blundered").
2. **Show what was given up** (material loss, position, tempo).
3. **Offer the alternative** (the engine's move and what it accomplishes).
4. **Link to a larger pattern** if one exists (e.g., "This is the third time you've hung a piece in the endgame").

#### Specific Blunder Patterns

**Hung Material:**
- *"Your knight on d5 was left open to capture."*
- *"Qc3 would have saved it."*

**Missed Capture:**
- *"Bxd6 wins a pawn. You passed it up."*
- *"The engine's top choice was Bxd6."*

**Missed Mate:**
- *"You had a forced mate here. Qh7# starts it."*
- *"This allowed checkmate in 2."* (if the opponent had to mate you)

**Allowed Mate:**
- *"Your move allows a forced mate against you. Kh7 avoids it."*

**Positional Drift:**
- *"Your position went from good for you to approximately equal."* (state the eval swing if data is available)
- *"Kf3 was stronger: it prevents back-rank threats."*

#### Centipawn Feedback

Use centipawns to quantify cost, not to shame:
- 0–20 cp: Don't mention unless part of a pattern.
- 20–100 cp: "You lost about X pawns of value."
- 100+ cp: "Compared with the best move, this cost you over a pawn."

Never lead with the number. Lead with what happened.

### For Stats Insights & Trends

**Specificity builds trust.**

1. **Name the leak clearly:** "Your single biggest leak: leaving pieces hanging" (not "you have a tactical weakness").
2. **Quantify it:** "8 of your 16 mistakes (50%)."
3. **Offer direction:** Link to a game where you did this, or suggest training (e.g., "Try the hung-material puzzle set").
4. **Avoid vagueness:** Never say "needs improvement" without naming what and why.

Example:
*"You blunder 40% of the time when your clock is below 5 seconds — e.g., the move Nf4 in game 12. Time-trouble puzzles might help."*

### For Post-Game Reports

**Celebrate the game, not just the stats.**

- Lead with accuracy and outcome ("You played a solid game").
- Name the standout moment (most brilliant move, worst blunder, biggest swing).
- If the game was close or hard-fought, say so.
- Link to the full review for detail.

Example:
*"Solid game — 78% accuracy. Your best move: Bd4!! on move 18. Your costliest moment: Ng4 (missed Nxh2 with a winning attack)."*

---

## What NOT To Do

❌ **Don't use engine terminology.** Never say "your position went from +2.3 to +0.8." Say "your advantage shrank from winning to roughly equal."

❌ **Don't sound like a textbook.** Avoid "fundamentally, you violated the principle of..." Just name the mistake and the fix.

❌ **Don't apologize for the player.** Never soften a blunder: "Well, Nf4 wasn't great." Say "Nf4 leaves your bishop hanging."

❌ **Don't blame external factors** (time pressure, opponent luck) in the coaching voice. Acknowledge them in trend analysis, not in move explanations.

❌ **Don't praise effort without linking it to chess.** "You tried hard" is not useful. "That defense bought you two moves" is.

❌ **Don't speculate about intent.** Never say "You probably didn't see..." Just name what happened.

---

## Voice Examples by Tier

| Tier | Pattern | Example |
|------|---------|---------|
| Brilliant | Celebrate the breakthrough | "A brilliant move! You found a piece sacrifice that breaks open the position for a winning attack." |
| Best | Affirm the choice | "This was the engine's top choice." |
| Excellent | Affirm with nuance | "A sound move. The engine preferred Bd4 (15cp difference)." |
| Good | Affirm, no nuance needed | "A sound move, close to the engine's top choice." |
| Inaccuracy | Name the cost | "You lost about 0.4 pawns of value. Kf3 was stronger." |
| Mistake | Diagnose the pattern | "Ng4 leaves your knight hanging. Ne3 defends it." |
| Blunder | Diagnose and quantify | "Your move allows a forced mate. Kh7 avoids it." |

---

## Implementation Guidelines

### In Code

All coaching text should flow from the same voice rules:
1. `moveExplanation.ts` — individual move explanations.
2. `statsInsights.ts` — pattern headlines and trend observations.
3. `postGameReport.ts` — game summaries and highlights.
4. `gameReviewView.ts` — UI labels and contextual notes.

When adding new coaching features:
- Run the sentence through the checklist above.
- If it sounds like an engine output, rewrite it.
- If it sounds like false praise, add specificity.
- If the reader doesn't know *why*, explain the concrete action or pattern.

### Calibration

The tone should feel like a chess teacher who:
- Knows you can improve.
- Shows you exactly what to work on.
- Never makes you feel small for mistakes.
- Celebrates your best moments.

---

## Related

- `moveExplanation.ts`: Current voice reference; strictly adheres to these rules.
- `statsInsights.ts`: Headline phrasing for leaks and trends; follow the specificity rule.
- `postGameReport.ts`: Game summary template; balance encouragement with honesty.
