# 07 — Teaching in Games: Tutorials, Level Design, FTUE, Adaptive Help

Games are the richest source of guidance craft because players *choose* to learn and leave instantly if bored. The best game teaching is mostly invisible.

## Core findings
- **Tutorial value depends on complexity/novelty.** Andersen et al. (CHI 2012, >45k players): tutorials raised play time up to 29% and progress up to 75% in Foldit (complex, unconventional) but did nothing measurable in two genre-typical games. Context-sensitive beat up-front manuals only where tutorials helped at all. Blocking (forced action) didn't help. A help button hurt one simple game (−12% levels, −15% time). Conclusion: players learn more from experimentation than from text; design early levels for safe discovery.
- **Attention is scarce, memory fallible** (Hodent): don't put tutorial text on screen while the player is fighting; distribute learning; reinforce with practice; plan onboarding in pre-production, not at ship.
- **Playtest relentlessly.** Valve's Portal team called playtesting the most important thing they did and tested from the first room; developer commentary describes inserting two extra chambers when energy-ball training was introduced too fast, and that early builds let players stumble through without understanding portals, which broke later teaching. Portal 2 playtests showed people don't want to listen to GLaDOS while actively solving a puzzle — narration timing matters.

## Teaching through level design

### The canonical sequence: safe introduction → practice → test → twist
- **Super Mario Bros. World 1-1** (Miyamoto/Tezuka): designed *after* the later levels so they knew which skills to teach; the first Goomba approaches slowly in open space so the player learns jump (or dies once, cheaply); the first mushroom emerges, slides toward Mario and bounces off a pipe so the player can hardly avoid touching it, discovering it's good — because Goombas had just taught "mushroom = bad". Goal: let players learn without a manual; Miyamoto's framing is that the game becomes the player's once they understand it themselves.
- **Kishōtenketsu** (Koichi Hayashida, Super Mario 3D Land/3D World; from four-panel manga): each level has one core concept — **introduce** it safely, **develop** it with more complex use, **twist** it in a surprising way, **conclude**. Concepts are taught, developed, and discarded within a single short level.
- **Half-Life 2 / Portal (Valve):** first encounter with a threat or tool in a safe, framed situation; environmental demonstration (a zombie cut in half by a saw blade → player learns saw blades are lethal ammo); gate-free diegetic instruction; layered training where each chamber trains one idea.

### Skill atoms and chains (Daniel Cook, "The Chemistry of Game Design")
A **skill atom** is a learning loop: *action* (press button) → *simulation* (game resolves it) → *feedback* (animation, sound) → *modeling* (player updates mental model: "I can jump!"). Atoms link into **skill chains** — directed graphs of prerequisites. Use it to:
1. List every skill the game demands.
2. Draw dependencies (jump → jump gaps → jump on enemies → ...).
3. Order teaching by the chain; never test a skill whose prerequisites weren't taught.
4. Find "burnout" points: atoms players stop exercising or never master.
Researchers have since developed methods to elicit the *empirical* skill chain from player data — designers' intended chain and players' actual one can differ.

## Text and prompts: when you must
- **As few words as possible** (George Fan, Plants vs. Zombies: no more than eight words on screen at once).
- Button prompts use the **actual glyph** of the current input device; update on device switch; respect remapping.
- Show a prompt **when the action becomes possible**, hide it **after successful use** (or N successes), bring it back if the player hasn't used it in a long time.
- Never during high cognitive load (combat, timed puzzle) unless it's the very action needed now.
- Narrative mentors: short, skippable, not in place of play (Ernest Adams mocks the faux-medieval "The A button swingeth thy sword!" mentor).

## Ernest Adams' "Eight Ways to Make a Bad Tutorial" (invert them)
Don't: force the tutorial (especially on every new game); make the player read a lot; refer to buttons without clearly identifying them; let the player fail the tutorial; force completion of the whole tutorial; offer no tutorial at all for a complex game. Do: let it be skipped or turned off if integrated into the main game; ideally make the game so obvious no instruction is needed.

## FTUE (first-time user experience) — especially mobile/F2P
- Purpose (Unity): teach the rules, convince the player it's worth their time; reach the fun fast.
- Measure the **funnel per tutorial step**; biggest leaks are often non-design (load times — devtodev reports an optimization of heavy/slow tutorial loading raising D1 by 10%); fix tutorial bugs first, they hit every new player.
- **Day-1 retention** is the headline FTUE metric (Roblox, Unity); ~45% D1 is cited as a strong start for mobile titles (practitioner figure — benchmark your genre).
- Reward early mastery; end the first session on an accomplishment; segment by skill (skilled/mid/novice) and adapt.
- Don't front-load meta systems (shop, crafting, guilds): unlock them with a contextual intro when first relevant.

## Adaptive and rescue help
- **Escalating hints:** after N failures or T seconds stuck, offer (not force) a hint; ladder: highlight → nudge text → explicit solution → skip/assist.
- **Nintendo Super Guide** (New Super Mario Bros. Wii, 2009): after 8 deaths on a stage, a block appears; hitting it lets a CPU Luigi play the section, and the player can take over any time. Iwata Asks: it was moved off the main menu, and the threshold was debated (5? 10? → 8). Super Mario Galaxy 2's version marked stars earned with help as bronze — offering help without erasing the achievement of unaided play.
- Configurable hint systems (Game Accessibility Guidelines): reminder of current objective, highlight interactive elements by name and visual cue, hints for which items combine.
- Difficulty/assist modes and the option to skip non-core challenges help players who otherwise churn.

## Re-learnability
Players return after days away: provide a controls reminder in HUD or pause menu, a codex/"how to play" list of every taught mechanic, and replayable tutorial segments **without starting a new save** (game accessibility guidelines; cognitive accessibility).

## Checklist for a game tutorial
- [ ] Skill chain drawn; every tested skill has a teaching moment before it.
- [ ] First encounter with each mechanic is safe (low penalty, slow pace, clear framing).
- [ ] Teach → practice → test → twist per mechanic.
- [ ] On-screen text ≤ ~8 words, correct device glyphs, disappears after mastery.
- [ ] No text during high-load moments.
- [ ] Tutorial can't be failed or soft-locked.
- [ ] Skippable for experienced players; never forced again on new game.
- [ ] Controls reminder + codex available anytime.
- [ ] Escalating, opt-in help after repeated failure.
- [ ] Playtested with genuine novices; step funnel instrumented; D1 tracked.
