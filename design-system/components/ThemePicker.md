# ThemePicker

The glass theme pill and its popover: six palettes, each light and dark, plus Auto / Light / Dark.

- The pill shows **four palette dots** (accent, redox, ligand, acid–base) and **“Palette • Variant”**: a small dot separator, the variant in `--muted` (*Catppuccin • Latte*). Below 760px it collapses to a round dots-only button.
- The popover lists every palette with a **light and a dark swatch strip**; the current one is outlined in `--accent`. Under it, a segmented Auto / Light / Dark control.
- Picking plays a **circular reveal from the click point** (View Transitions API; instant under reduced motion).
- **Auto** follows the host's `data-theme`, otherwise `prefers-color-scheme`. Choices persist in localStorage.
- Use: `<div id="theme"></div>` then `Playground.initTheme(); Playground.themePicker(el)`. The consumer provides only the empty container.
