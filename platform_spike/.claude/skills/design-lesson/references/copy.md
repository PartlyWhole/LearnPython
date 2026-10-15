# Writing lesson copy

The UI is minimal and visual (D21): the world, dots and icons carry most of the meaning, so copy is
the one line a picture can't replace. Learners glance at it; they don't read it. Write for a two-second glance, for a 10–14-year-old
as much as for an adult (G-09).

| Surface | Budget |
|---|---|
| Drive-mode prompt | 8 words or fewer |
| Demo caption (`say`) | 25 words or fewer, usually one sentence |
| Guide step (`say`) | 20 words or fewer: one subgoal |
| `done` line, recap | 1 sentence |
| Hint rung | 1–2 sentences, or a skeleton |

Rules:
1. **Lead with the verb or the outcome.** "Indent put() under the loop so it repeats."
2. **Code is code.** Write commands exactly as they're typed, with parentheses: `move()`,
   `for i in range(5):`. The UI renders them in code font.
3. **Name controls by their accessible label** (Run, Reset code, Show me, Goal), never by position ("the
   button on the right"), because layouts reflow and screen readers can't see position.
4. **Say why once, briefly**, when the why is the lesson ("Indentation decides what repeats").
5. **No praise inflation.** Confirm the result: "Five gems, one loop." Avoid "Amazing!!! 🎉". A
   confirmation that states what happened teaches; generic praise doesn't.
6. **Neutral dismiss labels:** "Not now", "Hide steps", "Skip". Never guilt.
7. **Mistakes are information.** Rescue copy says what happened, then one fix: "Only put()
   repeats. Indent move() too."
8. **Second person, present tense.** No "we" for the robot, and no "simply" or "just" (they
   make a stuck learner feel worse).
9. **Same word for the same thing everywhere:** gem (not beeper), robot (not Karel), cell (not
   corner), world, bag, goal.

Before / after:
| Before | After |
|---|---|
| "Now we are going to learn about for loops, which are a very powerful way to repeat code!" | "for repeats the indented lines." |
| "Click the button on the right to see the solution." | "Show me previews this step." |
| "Oops! That's wrong. Try again!" | "Only put() repeats. Indent move() too." |
| "Type the following: for i in range(5):" | "Start a loop that runs 5 times." |
