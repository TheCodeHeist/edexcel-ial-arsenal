# Edexcel IAL Arsenal

Interactive study tools for Edexcel International A Level Chemistry and Physics. By students, for students.

Biology isn't covered yet. If you took it and want to co-maintain that side, open an issue or a pull request.

Built with [Astro](https://astro.build) (static output) and [Svelte 5](https://svelte.dev) for interactive parts.

## Run it

```sh
pnpm install
pnpm dev        # http://localhost:4321
pnpm check      # astro check + svelte-check
pnpm build      # check, then build to dist/
pnpm preview    # serve dist/
```

## Layout

| path | what |
|---|---|
| `src/data/` | Tools, subjects/units, palettes. **`tools.ts` lists every tool**; cards, subject pages, unit maps and stats read from it |
| `src/styles/` | The design system as CSS: `tokens` → `base` → `controls` → `motion`, then `hub.css` (hub pages) or `sim.css` (simulation building blocks) |
| `src/lib/` | Shared TypeScript: `theme` (palette engine), `motion` (sliding indicators, crossfades, staggers, glint), `chem` (formula formatting), `util`, `persist.svelte` (scores saved to the browser) |
| `src/components/ui/` | Shared Svelte components: `SimHeader`, `StatusLine`, `ThemePicker`, `Seg`, `SubTabs`, `FilterRow`, `QuizBox`, `Flowchart` |
| `src/components/` | Hub components: `ToolCard`, `ToolFinder`, `Art` |
| `src/layouts/` | `Base.astro` (hub pages), `Sim.astro` (simulation pages) |
| `src/sims/<name>/` | One folder per simulation: `data.ts` (chemistry data, pure), state (`*.svelte.ts`), Svelte views, its own CSS |
| `src/pages/` | Routes: `/`, `/[subject]/`, `/about/`, `/chemistry/d-block-colour-bench/` … |
| `design-system/` | The original design-system export and brand book (`DESIGN.md`) |

## Adding a simulation

1. Make `src/sims/<name>/` with `data.ts`, an `App.svelte` that renders `SimHeader` + `StatusLine` + its views, and `<name>.css` for its own layout.
2. Add `src/pages/<subject>/<slug>.astro`:
   ```astro
   ---
   import Sim from '../../layouts/Sim.astro';
   import App from '../../sims/<name>/App.svelte';
   import '../../sims/<name>/<name>.css';
   ---
   <Sim title="…" description="…"><App client:only="svelte" /></Sim>
   ```
3. Add an entry to `src/data/tools.ts`.

Reuse `src/components/ui/` and the classes in `sim.css` before inventing new ones (design book §1.4).

## Theme

One theme for the whole site: palette and mode are saved in `localStorage` as `arsenal-palette` / `arsenal-mode` (JSON strings). The hub and every simulation read and write the same keys. Every colour is a CSS variable (`var(--accent)` …); never hard-code a hex.

---
Not affiliated with Pearson Edexcel.
