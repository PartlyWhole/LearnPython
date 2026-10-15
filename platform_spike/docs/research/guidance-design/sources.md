# Sources (annotated, with evidence grade)

Grades: **A** = controlled study / large-sample experiment · **B** = standards & platform guidelines · **C** = vendor benchmark data (large n, uncontrolled, commercial interest) · **D** = practitioner craft / designer interviews / case studies.

## Research
- **A** Andersen, O'Rourke, Liu, Snider, Lowdermilk, Truong, Cooper, Popović. *The Impact of Tutorials on Games of Varying Complexity.* CHI 2012. Multivariate test, 8 conditions, 3 games, >45k players. https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf
- **A** Kendrick (NN/g). *Mobile Tutorials: Wasted Effort or Efficiency Boost?* 70 users, 4 apps, tutorial vs. skip. https://www.nngroup.com/articles/mobile-tutorials/
- **A/D** Carroll & Rosson (1987). *The Paradox of the Active User* (in *Interfacing Thought*); Carroll, *The Nurnberg Funnel* (1990); *Minimalist Design for Active Users* (1985) — Minimal Manual, Training Wheels. Summary: https://www.nngroup.com/articles/paradox-of-the-active-user/
- **A** Kelleher & Pausch. *Stencils-Based Tutorials: Design and Evaluation.* CHI 2005 (cited via Andersen 2012).
- **A** Cook, D. *The Chemistry of Game Design* (skill atoms, skill chains), 2007. https://lostgarden.com/2007/07/19/the-chemistry-of-game-design/ ; empirical skill-chain elicitation: https://par.nsf.gov/servlets/purl/10049718

## UX research syntheses
- **B/D** Laubheimer (NN/g). *Onboarding Tutorials vs. Contextual Help* (push vs. pull; 5 guidelines). https://www.nngroup.com/articles/onboarding-tutorials/
- **B/D** NN/g. *Help and Documentation* (heuristic 10; push/pull revelations). https://www.nngroup.com/articles/help-and-documentation/
- **B/D** Kendrick (NN/g). *Tooltip Guidelines.* https://www.nngroup.com/articles/tooltip-guidelines/
- **B/D** Harley (NN/g). *Instructional Overlays and Coach Marks for Mobile Apps.* https://www.nngroup.com/articles/mobile-instructional-overlay/
- **B/D** NN/g. *Designing Empty States in Complex Applications.* https://www.nngroup.com/articles/empty-state-interface-design/

## Standards & platform guidelines
- **B** W3C. *Understanding SC 1.4.13 Content on Hover or Focus.* https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus
- **B** W3C WAI-ARIA APG. *Tooltip Pattern* (work in progress). https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
- **B** Apple. *TipKit* docs and WWDC23 "Make features discoverable with TipKit." https://developer.apple.com/documentation/tipkit ; https://developer.apple.com/videos/play/wwdc2023/10229
- **B** Microsoft. *Teaching tip* (WinUI) and Fluent `TeachingPopover`. https://learn.microsoft.com/windows/apps/design/controls/dialogs-and-flyouts/teaching-tip
- **B** Google. Material Design *Feature discovery* (M1) and *Tooltips* (plain/rich/persistent). https://m1.material.io/growth-communications/feature-discovery.html ; https://m3.material.io/components/tooltips
- **B** PatternFly. *Tooltips* writing guide. https://www.patternfly.org/content-design/writing-guides/tooltips
- **B** SAP Fiori. *Tooltip texts.* https://www.sap.com/design-system/btp/ui-texts/ui-text-pre-horizon-1/tooltip-texts/usage
- **B** Emarsys design system. *Tooltip guidelines.* https://designsystem.emarsys.net/components/tooltip/guidelines
- **B** Game Accessibility Guidelines. https://gameaccessibilityguidelines.com/

## Vendor benchmarks
- **C** Chameleon. *Product Tour Benchmarks* (2019), *Tours & Experiences Benchmark* (2020 data), *Benchmark Report 2024.* https://www.chameleon.io/blog/product-tour-benchmarks-highlights ; https://www.chameleon.io/blog/chameleon-benchmark-report ; https://www.chameleon.io/benchmark-report-24
- **C** Roblox Creator Docs. *Onboarding (FTUE).* https://create.roblox.com/docs/production/game-design/onboarding
- **C** Unity. *10 first-time user experience tips for games.* https://unity.com/how-to/10-first-time-user-experience-tips-games
- **C** GameAnalytics. *Tips for a great FTUE in F2P games.* https://gameanalytics.com/blog/tips-for-a-great-first-time-user-experience-ftue-in-f2p-games
- **C** devtodev. *How to optimize the tutorial for your game.* https://gamedeveloper.com/business/how-to-optimize-the-tutorial-for-your-game

## Game design craft
- **D** Miyamoto & Tezuka on World 1-1 (Eurogamer 2015 video; Iwata Asks on New Super Mario Bros.). Summaries: https://gonintendo.com/archives/100477 ; https://www.bgr.com/general/super-mario-bros-world-1-1-design/
- **D** Hayashida on kishōtenketsu level design. https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design
- **D** Valve. *Portal* developer commentary (training, pacing). https://theportalwiki.com/wiki/Portal_developer_commentary ; Swift & Wolpaw GDC postmortem: https://www.gamedeveloper.com/pc/best-of-gdc-the-secrets-of-i-portal-i-s-huge-success ; Portal 2 test-chamber process: https://gameinformer.com/b/features/archive/2010/03/17/thinking-with-portals-making-a-test-chamber
- **D** Adams, E. *The Designer's Notebook: Eight Ways to Make a Bad Tutorial* (2011). https://gamedeveloper.com/design/the-designer-s-notebook-eight-ways-to-make-a-bad-tutorial
- **D** Hodent, C. *The Gamer's Brain, Part 2: UX of Onboarding and Player Engagement* (GDC 2016); *The UX of Fortnite* talk. https://gdcvault.com/play/1022951/The-Gamer-s-Brain-Part ; https://interaction19.ixda.org/download/talk-the-ux-of-fortnite-celia-hodent.pdf
- **D** Nintendo *Super Guide* (New Super Mario Bros. Wii; Super Mario Galaxy 2). https://giantbomb.com/super-guide/3015-4045/ ; https://vooks.net/miyamoto-reflects-on-the-super-guide

## Caveats for agents
- Grade C numbers come from customers of one vendor; methods change between years. Use direction, not exact values.
- NN/g's tutorial study is small (n=70) but consistent with Andersen's large game study and Carroll's earlier work — the convergence is the evidence.
- Andersen's games were free browser/download titles; effects in paid commercial games may differ.
