# ReactionCard

A reaction card for Cards layouts: picture, names, family badge, equation, conditions and a Copy button.

- `.rxc.f-<family>`: a 3.5px family-coloured edge marker, glass `--panel` fill, `--r-lg`.
- `.rxc-vis`: reactant → reagent arrow → product, drawn molecules on a faint `--ink` wash; the reagent in mono above the arrow, its name below.
- Equation in `.eq` (mono, built with `Playground.chem()`), then `.why`: **mechanism** · conditions — one-sentence reason.
- Equation, names and notes are selectable; chrome is not. `.cpy` copies `Playground.plain()` text.
- **Self-test:** inside `.quiz2`, the product, name and equation hide behind a hatched “?” until answered with four options (see Quiz).
