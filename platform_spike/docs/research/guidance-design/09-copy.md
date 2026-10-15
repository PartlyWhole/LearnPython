# 09 — Writing Guidance Copy

People don't read guidance; they glance at it. Write for a 2-second glance.

## Length budgets
| Surface | Budget |
|---|---|
| Icon tooltip | 1–3 words, verb + noun ("Insert link") |
| Explanatory tooltip | ≤ 1 sentence; ceiling ~100–150 characters |
| Coach mark | ≤ ~10 words |
| Teaching tip / tour step | Title 2–5 words + body ≤ ~25 words (Chameleon's average step ≈ 23 words) |
| Game on-screen prompt | ≤ ~8 words (George Fan) |
| Empty state | Headline + 1 line + CTA label |

## Rules
1. **Lead with the verb or the benefit.** "Swipe left to archive." / "Pin chats you check often." Not "This is the pin button."
2. **Say what it does, not what it is called** — unless naming an icon.
3. **Be specific to context:** "Edit email" > "Edit".
4. **Use the person's words**, not internal names ("Email preview", not "Email client screen").
5. **Name controls exactly as labeled** in the UI, and identify them unambiguously (Adams: never reference a button without clearly identifying it). In games, show the input glyph.
6. **Don't repeat the visible label.** If the button says "Save", a tooltip saying "Save" adds nothing.
7. **One idea per surface.** If you need "and", consider two moments.
8. **Second person, present tense, active voice.**
9. **No marketing adjectives** ("powerful", "amazing", "seamless") and no exclamation-mark enthusiasm — tone-deaf when people are stressed (NN/g bank example).
10. **Punctuation:** fragments without periods; full sentences with periods (PatternFly). Sentence case.
11. **Buttons:** specific verbs ("Try it", "Show me", "Add teammate"); dismissal is neutral ("Not now", "Skip tour", "Got it") — never guilt ("No thanks, I don't like saving time").
12. **Progress:** "2 of 4", not "Step 2".
13. **Don't refer to UI by location alone** ("top-right") — layouts reflow, and it fails screen readers; name the control.
14. **Localization:** budget +30–40% length for German/Finnish etc.; avoid idioms and puns; don't bake text into images.
15. **Consistent text for the same icon** everywhere (PatternFly's common-icon table approach).

## Templates
- Tooltip (icon): `<Verb> <object>` + optional shortcut → "Duplicate slide (Ctrl+D)"
- Tooltip (why): `<Reason>` → "We'll send your receipt here."
- Discovery tip: Title `<Outcome>` · Body `<How in one step>` · Action `<Try it>` → "Find anything faster" · "Press / to search from any page." · [Try it] [Not now]
- Moved control: "<Feature> moved to <place>." → "Export moved to Share."
- Rescue: "<What went wrong in plain words>. <One fix>." → "That date is in the past. Pick today or later."
- Empty state: "No <things> yet" · "<What they're for / what appears here>." · [Create <thing>] [Use sample data]
- Game prompt: "<Glyph> <Verb>" → "Ⓐ Jump", "Hold ⓇT to aim"

## Before/after
| Before | After |
|---|---|
| "Welcome to the new and improved Dashboard! Here you can see all your important metrics in one powerful place." | "Your key numbers update here every hour." |
| "Click this button to open the menu where you can find options to share your document with others." | "Share with teammates" |
| "Tip: You can use the keyboard shortcut Command + K to open the command palette, which lets you quickly run any command." | "Press ⌘K to run any command." |
| "Password must be 8+ chars incl. a number" *(in tooltip)* | Same text, **moved inline under the field** |
