# Edexcel IAL Visual Playground — design system export

Unzip anywhere and open the HTML files straight from the folder (no build step, no server needed).

| file | what it is |
|---|---|
| `index.html` | Component gallery: every component, live, with the theme switcher |
| `starter/index.html` | A ready parent-website page (header, theme pill, tabs, status line, simulation cards, hash routing). Copy it and edit the `SIMS` list |
| `css/playground.css` | The whole stylesheet: tokens, glass, components, motion, responsive rules and all 6 palettes × light/dark. Loads the three Google fonts |
| `js/playground.js` | `window.Playground`: theme engine + picker, sliding indicators, glint, boot/enter/fade motion, stat bump, `chem()`/`plain()` equation formatting, copy, phone bottom drawer |
| `js/playground.d.ts` | Typed reference for every `Playground` function |
| `DESIGN.md` | The brand book: baseline rules first, then the later additions |
| `PALETTES.md` | Every hex value for all 12 theme variants |
| `tokens.json` | Tokens as data (Catppuccin Latte/Mocha, type styles, spacing, radii, shadows, sizes, breakpoints) |
| `components/<Name>.html` / `.md` | One standalone preview + usage guidelines per component |

## Minimal page

```html
<link rel="stylesheet" href="css/playground.css">
<script src="js/playground.js"></script>
<div class="aurora" aria-hidden="true"><i></i><i></i><i></i></div>
<div class="wrap">
  <header class="top">
    <div class="brand"><h1><span class="d">E</span>dexcel IAL Visual Playground</h1></div>
    <div id="theme"></div>
    <nav class="tabs" role="tablist"><button role="tab" aria-selected="true">Home</button><button role="tab">About</button></nav>
  </header>
</div>
<script>
  Playground.initTheme();
  Playground.themePicker(document.getElementById('theme'));
  Playground.indicators();
  Playground.boot();
</script>
```

## Notes
- Use `var(--token)` for every colour; never hard-code hex values, or palette switching breaks.
- The theme is saved in the browser under `chem-palette` and `chem-mode`. Pages on the same domain share it, so the website and the simulations stay in sync once they're hosted together.
- The fonts load from Google Fonts, so they need an internet connection. For offline use, download Geist, PT Serif and JetBrains Mono and swap the `@import` at the top of `playground.css` for local `@font-face` rules.
- With a framework (React, Svelte, Astro…), import `playground.css` globally and call the `Playground` functions after the markup mounts.
