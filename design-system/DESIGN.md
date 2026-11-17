# Edexcel IAL Visual Playground

The shared look of every Edexcel IAL simulation — Chemistry (d-Block Colour Bench, Carbon Alchemy) and beyond — and of the parent website that links them. Liquid Glass on a drifting palette glow, squircle corners, three typefaces, six themes in light and dark, and calm, springy motion.

This book lists the **baseline** first (the rules every page starts from), then the rules added while building the simulations. The baseline is the minimum: build on it, never below it.

## Using it on a page

```html
<link rel="stylesheet" href="css/playground.css">   <!-- loads the fonts too -->
<script src="js/playground.js"></script>             <!-- window.Playground -->
<script>
  Playground.initTheme();                                // restore palette + mode, follow the OS on Auto
  Playground.themePicker(document.querySelector('#theme')); // the glass pill + popover
  Playground.indicators();                               // sliding pills on .tabs / .seg / .subtabs
  Playground.glint('.panel,.card,.tp-row');              // mouse-only accent glint
  Playground.boot();                                     // rise-in on first load only
</script>
```

Every colour is a CSS variable (`var(--accent)`, `var(--panel)` …). Never hard-code a hex in a page; the palette switcher only works through the variables. `Playground.setTheme({palette:'nord', mode:'dark'}, clickEvent)` switches by script.

---

## 1 · Baseline

1. **A range of popular UI themes, each with a light and a dark variant.** Six palettes, twelve variants (see Palettes). Catppuccin is the default.
2. **Liquid Glass with squircle corners.** Translucent glass panels over a slow coloured glow; `corner-shape: squircle` wherever the browser supports it.
3. **Three fonts.** **PT Serif** (serif, display), **Geist** (sans, UI and body), **JetBrains Mono** (mono, labels and data).
4. **Consistent across similar simulations.** Same header, status line, controls, cards and motion everywhere; a new page reuses these components before inventing new ones.
5. **Fully responsive.** Every page works at any width from 320px to 1680px+, and the page body never scrolls sideways.
6. **Every design decision is written down** here (and in the project notes) the moment it is made.
7. **Ambitious, polished, creative.** Polish is part of the brief, not an extra.

## 2 · Page structure

- **Top bar holds exactly three things:** the title, the theme selector and the tab bubbles. Never scores, never stats.
- **One control height.** The theme pill and the tab bar share `--ctl` (44px; 42px on phones). Mismatched heights are a bug.
- **Status line under the top bar on every tab**, justified left/right:
  - left: the mode name in **bold** + a one-line hint, in `--muted`;
  - right: stat pills, each a mono uppercase label + a tabular number (`DISCOVERED 12/84`, `SOLVED`, `STREAK`, `BEST`, `WRONG GUESSES`, `SELF-TEST`). A value that changes **bumps**.
- **Hash routes with plain names** for every view and sub-view: `#lab`, `#reactions`, `#flowchart`.
- **No element id may equal a route name** (`id="reactions"` would make the browser jump to it on load). Suffix ids: `reactionsView`.

## 3 · Colour

### Tokens every variant defines
| token | role |
|---|---|
| `--bg` | page background |
| `--surf` | base of all glass fills |
| `--ink` | text, icons, bond lines |
| `--muted` | hints, labels, eyebrows (12px+) |
| `--line` | hairlines and outlines |
| `--accent` / `--accent-ink` | interaction (selected tab, primary button, focus, links) and text on it |
| `--redox` `--ligand` `--acidbase` `--amph` `--cond` | the reaction-type hues |
| `--b1` `--b2` `--b3` | the three background glow blobs |

### Derived with `color-mix` (never stored per palette)
`--panel` = 58% `--surf` · `--raised` = 80% · `--solid` = 92% `--surf` + `--bg` · `--rim` = 13% `--ink` · `--accent-soft` = 16% `--accent` · `--good` = `--acidbase` · `--bad` = `--redox`.

**Trace colours** `--ch1`…`--ch8` for graph series and oscilloscope channels, in this order: `--accent`, `--redox`, `--acidbase`, `--amph`, `--ligand`, `--cond`, then two mixes (`--redox`+`--amph`, an orange; `--accent`+`--acidbase`, a teal). Always assign them in order, so the first channel is always the accent.

### Theme switching
- Mode is **Auto / Light / Dark**. Auto follows the host page's `data-theme`, otherwise `prefers-color-scheme`.
- Palette and mode are saved per browser (localStorage, keys `chem-palette`, `chem-mode`).
- The **theme pill** shows four palette dots and **“Palette • Variant”**: a small dot separator, the variant in muted text (*Tokyo Night • Night*). Below 760px it becomes a round dots-only button.
- The **popover** lists every palette with a light and a dark swatch strip, plus the Auto/Light/Dark segmented control.
- Switching plays a **circular reveal from the click point** (View Transitions API).

## 4 · Surfaces

- **Glass** = translucent fill (`--panel` / `--raised`) + `backdrop-filter: blur(22px) saturate(175%)` + a 1px `--rim` border + an inset top highlight (`--hl`) + a soft drop shadow (`--shadow`) + a 155° sheen gradient (`--sheen`).
- **Background glow:** three large blurred blobs in `--b1`–`--b3` drift slowly behind everything (`<div class="aurora"><i></i><i></i><i></i></div>`). They stop under reduced motion.
- **Squircles:** inside `@supports (corner-shape: squircle)` the radii are 30 / 22 / 16 / 12px (`--r-xl` → `--r-sm`); the fallback is ordinary rounding at 20 / 15 / 11 / 8px. **Pills stay fully round.**
- **Diagram boxes and labels use a solid fill** (`--solid`) so arrows passing behind them stay legible.

## 5 · Type

| use | face |
|---|---|
| display headings, titles, result names | **PT Serif 700** |
| UI and body | **Geist** (400 body, 650–700 UI) |
| eyebrows, labels, chips, stats, equations, data | **JetBrains Mono** |

- The page title has an **italic, accent-coloured first letter** (`<span class="d">C</span>arbon Alchemy`).
- Mono labels are uppercase with .08–.12em tracking. Numbers in stats are tabular.
- Equations: digits after an element become subscripts, `^2-` becomes a superscript, `->` an arrow, `<=>` an equilibrium arrow (`Playground.chem()`).

## 6 · Motion — subtle and calm

- **Easing:** spring `cubic-bezier(.34,1.45,.55,1)` (`--spring`) for interactions; ease-out `cubic-bezier(.2,.75,.2,1)` (`--ease-out`) for entrances.
- **Sliding indicator:** tabs and segmented controls have ONE pill that springs to the selection; sub-tabs have a sliding underline. It snaps on first placement, then always slides.
- **View switching** is one short crossfade: 0.3s, opacity + 3px lift. No blur, no re-staggering, so rapid switching never flashes.
- **Big rise-ins only on first load** (`.booting`, ~1.4s). Staggered cards, arrows drawing in and labels scaling in only when a list is redrawn by a filter change (`.enter`).
- **Glint:** a soft accent light follows a *mouse* pointer across glass cards (never touch).
- **Press** = scale .96. **Hover lifts** only on devices that hover.
- **Feedback:** a right answer pulses (`--good`), a wrong one shakes (`--bad`); new log entries slide in; detail panels crossfade.
- Entrance animations use `animation-fill-mode: backwards` so they never override resting transforms.
- **Everything is off under `prefers-reduced-motion`.**

## 7 · Responsive

- **Above 1180px:** title | theme pill | tabs on one row. **At 1180px and below:** title on its own row, then a 4-equal-column tab bar beside the theme pill.
- **480px and below:** short tab labels. **380px and below:** 12px tab text. **560px and below:** button grids go to 2 columns.
- Multi-column layouts collapse **3 → 2 → 1**; side lists become horizontal scrollers.
- **Flowcharts below 760px** transpose so chains run downward, use compact spacing, scale to fit (never below 74%) and show a “scroll sideways” hint if still too wide.
- **Phones (≤760px) never make you scroll between items and their drop target.** Items live in a bottom drawer (see Bottom drawer).
- Test at 320, 390, 580, 768, 900, 1024, 1280 and 1680px. The body never scrolls sideways.

## 8 · Text selection

- **Chrome is not selectable** (tabs, buttons, cards, labels, headings): it gets in the way of dragging and long-presses.
- **Useful content stays selectable:** equations, conditions, notes, names, formulae, codex / test / preparation text.
- Any selection is cleared when a drag starts.
- Content people will reuse gets a small **Copy** button that copies a clean plain-text version with Unicode sub/superscripts (`Playground.plain()`, `Playground.copy()`).

## 9 · Chemistry rules

- **The white tile stays light in every theme** (`--tilebg`, grid `--tilegrid`), so test-tube and precipitate colours read true.
- **Reaction-type colours come from each palette's own hues:**

| reaction family | token |
|---|---|
| redox / oxidation / reduction | `--redox` (red) |
| ligand exchange (inorganic) · substitution (organic) | `--ligand` (purple) |
| acid–base | `--acidbase` (green; blue-teal in Rosé Pine) |
| amphoteric (inorganic) · elimination (organic) | `--amph` (amber) |
| addition (organic) | `--accent` |
| condensation / hydrolysis (organic) | `--cond` (the seventh hue) |

- **Reaction views offer Cards and Flowchart layouts.** **Self-test uses four-option multiple choice**, with a running score in the status line.
- **Molecules** are inline SVG drawn from SMILES, with one global formula switch: **Skeletal / Displayed / Structural** (saved per browser). Displayed formulae use a right-angle grid. Heteroatoms are coloured **O = `--redox`, N = `--accent`, halogens = `--acidbase`, Mg = `--amph`**.
- A new product's **functional-group atoms glow** in its reaction-family colour.
- **Drag-and-drop reactions** happen in a transmutation circle: two drop slots over a slowly rotating alchemy sigil with a benzene-hexagon core. Mouse drags, touch long-presses, a tap also adds. A reaction fuses the slots into the centre, flashes, bursts particles in the family colour, then the product pops in with its equation, type badge and conditions.
- **No reaction:** the slots shake, a grey puff rises, and a toast explains why.
- **Identification tubes** sit on the white tile with animated colour changes, precipitates, silver mirror, bubbles, fumes and litmus strips.

## 9b · Physics rules (Circuit Builder)

- **Circuit symbols follow the Edexcel specification**: resistor as a rectangle, cell with a long (+) and short thick (−) plate, lamp as a circle with a cross, meters as circles with A / V, diode as a filled triangle and bar, thermistor and LDR as the resistor with their marks. Thin 2.8-unit strokes in `--ink`, bodies filled with `--solid` so wires and arrows never show through them.
- **The board is a dotted grid**, not the white tile: wires and symbols in `--ink`, junctions as solid dots, unconnected terminals as `--bad` rings. Display-only boards (Predict, Lab) crop to the circuit; on phones their labels are drawn 1.75× larger.
- **Current arrows** sit on every piece of wire (two on long runs), pointing the way the current flows: `--accent` for conventional current, `--cond` for electron flow (switchable, or off). Any real current shows clearly (at least 75% opacity, bolder for larger currents); below 1 µA they fade out. Predict hides them until the question is answered, and says so. They are static on purpose: an impression, not an animation, and cheap while time runs.
- **Light is colour from the palette:** a lit lamp glows `--amph` in proportion to its power; an LED glows in its own hue token (red `--redox`, yellow `--amph`, green `--acidbase`, blue `--accent`).
- **Meter readings** are dark mono pills beside the meter's name, 3 significant figures, amps below 0.1 A in mA. A hidden reading is an accent pill with “?”.
- **Numbers** carry an SI prefix and 3 significant figures (`25.3 mA`, `2.20 kΩ`); component labels drop trailing zeros (`2.2 kΩ`, `6 V`).
- **One syllabus switch** (“Units 2 & 3” / “+ Unit 4: capacitors”) under the status line gates every capacitor feature at once: the part, the clock, capacitor questions and the capacitor practical. It never hides parts already on the board.
- **Time:** with a capacitor on the board a time bar appears (Play/Pause, ×0.1 · ×1 · ×10, the clock, Discharge all) on an `--accent-soft` strip. A charged capacitor's + plate tints `--redox` and its − plate `--accent`, with small + and − marks. The inspector shows a live V–t and I–t trace (solid `--accent`) over the last 10 s of real time.
- **Oscilloscope:** every ammeter and voltmeter is a probe. Pinned probes show below the board on one time axis, Overlay (a voltage screen and a current screen) or Stacked (one lane each); channel colours run `--accent`, `--redox`, `--acidbase`, `--amph`, `--ligand`, `--cond`. Traces are signed, so meters carry a small muted + at their + terminal.
- **Angles:** parts turn in 45° steps (R) and wires run along the grid or at exactly 45°. A 45° part's terminals sit one grid step across and one down, so its leads are drawn √2 longer and its label sits beside it on the right.
- **Graphs** put the axes through the origin, use crosses for readings, a dashed `--accent` line for the true curve and a `--redox` line of best fit. Axis labels are written `I / A`, `V / V`, as on an exam paper.

## 10 · Voice

Plain, exam-accurate and short. Status hints are one line, verbs first (“Drag or tap a compound and a reagent into the circle.”). Explanations say *why* in one sentence (“Reflux keeps the aldehyde in the flask until it is fully oxidised.”). Spellings follow the Edexcel specification: sulfur, aluminium, colourless, ethanoic acid. No emoji in the UI.

## 11 · Iconography and imagery

There is no logo; the title in PT Serif with its italic accent letter is the mark. Icons are thin line drawings (1.6–1.8px strokes, round caps) in `currentColor`. Chemistry is drawn, never photographed: molecules, glassware and apparatus are SVG, the apparatus on the white tile.
