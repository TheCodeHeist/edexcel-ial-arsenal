# Quiz

Four-option multiple choice, the self-test pattern everywhere.

- `.qz`: a mono `--accent` prompt (“What forms?”) over a 2 × 2 grid of option buttons.
- Right answer: `--good` border + pulse; wrong: `--bad`, strike-through and a shake; then all options lock and the verdict replaces the prompt.
- Distractors are plausible (same reactant, same family or same class). Score shows in the StatusLine as `SELF-TEST right/total`.
