# Edexcel IAL Arsenal

Interactive study tools for Edexcel International A Level Chemistry and Physics. By students, for students.

Biology isn't covered yet. If you took it and want to co-maintain that side, open an issue or a pull request.

Built with [Astro](https://astro.build) (static output) and [Svelte 5](https://svelte.dev) for interactive parts.

## Run it

```sh
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # type-check + build to dist/
pnpm preview    # serve dist/
```

## Layout

| path | what |
|---|---|
| `src/data/tools.ts` | **Every tool on the site.** Cards, subject pages, unit map and stats all read from this list |
| `src/data/subjects.ts` | The subjects and their six units each (paper codes, titles) |
| `src/data/palettes.ts` | The six palettes × light/dark (for the theme picker) |
| `src/pages/` | `/`, `/[subject]/` (chemistry, physics), `/about/`, 404 |
| `src/layouts/Base.astro` | Shared chrome: top bar, status line, footer, no-flash theme script |
| `src/components/` | `ToolCard`, `ToolFinder` (search island), `Art` (line-drawn artwork), `ThemePicker` |
| `src/styles/global.css` | Hub stylesheet: the general parts of the design system + hub layout |
| `src/scripts/` | `theme.ts` (theme engine), `ui.ts` (sliding indicators, glint) |
| `design-system/` | The full design system the simulations are built on (`DESIGN.md` is the brand book) |

## Adding a tool

Create `src/pages/<subject>/<slug>.astro` using `Base.astro`, build the interactive part as Svelte components (`client:load`), and add an entry to `src/data/tools.ts`.

## Theme

One theme for the whole site: palette and mode are saved in `localStorage` as `arsenal-palette` / `arsenal-mode` (JSON strings). The hub and every simulation read and write the same keys. Every colour is a CSS variable (`var(--accent)` …); never hard-code a hex.

---
Not affiliated with Pearson Edexcel.
