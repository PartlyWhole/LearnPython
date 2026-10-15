# 04 — Tooltips, Toggletips, Rich Tooltips, Hotspots, Teaching Tips

These are the small, element-anchored surfaces. Choosing the right one is mostly about **trigger** and **content type**.

| Surface | Trigger | Interactive content? | Dismissal | Platform names |
|---|---|---|---|---|
| **Tooltip (plain)** | Hover + keyboard focus (+ long-press on touch) | No | Leave/blur, Esc | ARIA `role="tooltip"`; Material plain tooltip; Mozilla/SAP/PatternFly "tooltip" |
| **Toggletip / popup tip** | Click/tap/Enter/Space on an ⓘ or ? button | Optional (then it's a non-modal dialog) | Click again, outside click, Esc, close button | NN/g "popup tip"; Material *persistent* rich tooltip |
| **Rich tooltip** | Hover/focus (default) or click (persistent) | Default: no. Persistent: links/≤2 actions | As above | Material rich tooltip; Compose `RichTooltip` |
| **Teaching tip / teaching popover** | Programmatic (first reach) or on interaction | Yes: title, body, image, actions | Close, action, outside | Fluent `TeachingTip`, `TeachingPopover`(+Carousel); Apple TipKit `popoverTip`/`TipView` |
| **Hotspot / beacon** | Always-visible marker; opens a card on click | Card may contain actions | Card closed; marker removed once seen | Vendor tools (Appcues, Pendo, Chameleon…) |

## Plain tooltips

### Use for
- Naming **unlabeled icons** (but prefer visible labels — NN/g recommends text labels for icons).
- Brief, **non-essential** clarification ("Why we ask for your email").
- Keyboard shortcuts alongside the name ("Bold (⌘B)").

### Never for
- **Information required to complete a task** (password rules, field formats) — tooltips disappear and force memorization. Put it inline. (NN/g guideline 1)
- Repeating the visible label ("Add new line" on an "Add new line" button).
- Interactive content (links, buttons) — tooltips don't receive focus; use a toggletip/non-modal dialog. (WAI-ARIA APG)
- Disabled-control explanations that only appear on hover (consider inline reason text; disabled buttons often can't receive focus).
- Touch-only interfaces as the sole channel.

### Rules
1. **Brief:** 1–8 words typical; hard ceiling ~2 sentences / 100–150 characters (Emarsys); SAP: 5–10, up to 15 words; Mozilla's old guidance: ~3 words, verb + noun ("Insert link").
2. **Answer "What is this?" or "What will this do?"**; be specific ("Edit email", not "Edit"); use people's words, not internal jargon.
3. **Hover AND keyboard focus** must both trigger it (NN/g guideline 3; WCAG).
4. **Delay** before showing on hover (~300–700 ms; historically ~1 s) to avoid flicker while the pointer passes; once one tooltip is open, moving to an adjacent control shows the next immediately (no second delay).
5. **WCAG 1.4.13**: dismissible without moving pointer/focus (Esc), hoverable (pointer can move onto the tooltip without it vanishing), persistent (stays until trigger removed/dismissed/invalid). No auto-hide timer.
6. **Placement:** don't cover the element or related content; use an arrow/caret when elements are close together (NN/g guideline 4); flip/shift to stay in viewport; never crop.
7. **Consistency:** if some icons in a group have tooltips, all should (NN/g guideline 5); use the same text for the same icon everywhere (PatternFly).
8. **Contrast:** text ≥ 4.5:1 against tooltip background; tooltip distinguishable from page.
9. **Sentence fragments without periods; full sentences with periods** (PatternFly).

### ARIA (web)
```html
<button aria-describedby="tip-save" aria-label="Save">
  <svg aria-hidden="true" focusable="false">…</svg>
</button>
<div role="tooltip" id="tip-save" hidden>Save draft (Ctrl+S)</div>
```
- Container: `role="tooltip"`; trigger references it with `aria-describedby` (it's a *description*; the accessible *name* comes from `aria-label`/text).
- Focus stays on the trigger; tooltip itself never focusable. Esc hides it. If invoked by focus, hides on blur; if by hover, stays while pointer is over trigger *or* tooltip.
- Note: the APG tooltip pattern is still marked work-in-progress — check current guidance before relying on edge-case behavior.
- Native `title` attribute is not a substitute: no keyboard access, inconsistent timing, not hoverable.

## Toggletips / popup tips
For touch, optional detail, or anything with a link.
```html
<button aria-expanded="false" aria-controls="tt-1" aria-label="More info about tax ID">ⓘ</button>
<div id="tt-1" role="status" hidden>Your tax ID is on line 3 of form W-9. <a href="…">Learn more</a></div>
```
- Button toggles on click/Enter/Space; Esc and outside click close; updating a live region announces content.
- If it contains interactive elements → treat as non-modal dialog (`role="dialog"`, labelled, focus moves in, Esc returns focus to trigger).
- Don't attach a click-toggled tip to an element that already has a click action (Material).
- Keep the ⓘ/? next to a specific label — a free-standing "?" tends to be generic and unhelpful (Emarsys). Too many "?" icons on a page is a design smell.

## Rich tooltips (Material)
- Plain: short label, default placement above. Rich: optional title, body, ≤ 2 text-button actions; default placement below-end; wider (Compose defaults: plain ~200dp max, rich ~320dp).
- Default rich: hover/focus; persistent rich: toggled by click/Enter/Space, stays until outside interaction; persistent variant with interactive content uses `role="dialog"`.

## Teaching tips / TipKit tips
For **discovery of a feature at the point of use**, not labeling.
- Fluent TeachingTip: draw attention to new/important features, remind of non-essential options, teach a task; can be **targeted** (tail pointing at the element) or **untargeted** (no tail); *avoid showing too often*; test gamepad accessibility. TeachingPopover: for richer content with a "Learn more"; carousel version for multi-step; if shown programmatically, announce it.
- Apple TipKit: tips have a title, message, optional image and actions; good tips are **actionable, instructional, and easy to remember**; govern with `rules` (parameter + event), `displayFrequency` (global), `MaxDisplayCount`, invalidate on action; inline `TipView` for scrolling content, `popoverTip` for anchored. Test with `showAllTipsForTesting` / `resetDatastore`.

### Rules for any teaching tip
- One on screen at a time; app-wide cooldown (e.g., ≤ 1 per session or per day).
- Show only when the anchored control is visible and the person isn't mid-input.
- Close button always; primary action should *do the thing* ("Try it") when possible.
- Invalidate once the person uses the feature.

## Hotspots / beacons
A small persistent marker (pulsing dot, "New" badge) that the person may open. It's a *pull* invitation, which is why opt-in completion is far higher than auto-shown.
- ≤ 1–2 per screen; never stack on top of each other.
- Remove after opened or after the feature is used; also time-box (e.g., 14–30 days).
- Respect `prefers-reduced-motion` (static dot instead of pulse).
- Accessible name: "New: Saved filters. Show tip" — focusable button, not a decorative div.

## Common failure list
- Tooltip on hover only → keyboard users locked out.
- Tooltip vanishes when moving pointer onto it → fails WCAG 1.4.13.
- Password rules in a tooltip → people fail the form.
- Every element has a tooltip → people ignore all of them.
- Tooltip hides the field it explains.
- Teaching tips firing on every page load.
