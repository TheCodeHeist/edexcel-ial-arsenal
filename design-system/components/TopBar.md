# TopBar

The top bar: title, theme selector and tab bubbles, and nothing else.

- **Holds exactly three things.** Never put scores, stats or extra buttons here; they go in the StatusLine below it.
- **Title:** PT Serif 700, `clamp(30px, 3.8vw, 46px)`, with an italic `--accent` first letter (`<span class="d">`). An optional mono eyebrow sits above it.
- **One height:** the theme pill and the tabs both use `--ctl` (44px, 42px on phones).
- **Layout:** above 1180px `title | theme | tabs` on one row; at 1180px and below the title gets its own row and the tabs become 4 equal columns beside the theme pill; below 760px the pill is dots-only; at 480px tabs switch to their `.sm` short labels.
- Markup: `header.top > .brand + .theme-wrap + nav.tabs[role=tablist] > button[role=tab][aria-selected]`.
- Call `Playground.themePicker(el)` and `Playground.indicators()` after the markup exists.
