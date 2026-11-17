# Tabs

Tab bubbles with one sliding accent pill: the primary navigation between a page's modes.

- `nav.tabs[role=tablist]` of `button[role=tab]`; mark the current one `aria-selected="true"`. `Playground.indicators()` adds the pill, which **snaps on first placement and springs after**.
- Height `--ctl`; text Geist 14px 700, `--muted` when idle, `--accent-ink` on the pill.
- Each tab is a hash route with a plain name (`#lab`). Never give an element an id equal to a route.
- Give long labels a short twin: `<span class="lg">Synthesis</span><span class="sm">Make</span>` (shown at 480px and below).
