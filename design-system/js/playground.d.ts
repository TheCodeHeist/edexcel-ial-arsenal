/** Edexcel IAL Visual Playground runtime: window.Playground (components/bundle.js). Load components/bundle.css first. */
type PaletteId = 'catppuccin' | 'tokyo' | 'nord' | 'rosepine' | 'gruvbox' | 'everforest';
type Mode = 'auto' | 'light' | 'dark';
interface ThemeState { palette: PaletteId; mode: Mode; effective: 'light' | 'dark'; name: string; variant: string; colors: Record<string, string>; }
interface Playground {
  /** All six palettes, each {name, light:{v, bg, surf, ink, muted, line, accent, redox, ligand, acidbase, amph, cond, b1, b2, b3}, dark:{…}}. */
  PALETTES: Record<PaletteId, any>;
  /** Restore the saved palette + mode (localStorage chem-palette / chem-mode) and follow the OS or host data-theme while on Auto. */
  initTheme(): ThemeState;
  /** Switch palette and/or mode; pass the click event for the circular reveal. */
  setTheme(next: { palette?: PaletteId; mode?: Mode }, ev?: MouseEvent): void;
  getTheme(): ThemeState;
  onTheme(fn: (t: ThemeState) => void): void;
  /** Render the glass theme pill + popover into an empty container. */
  themePicker(container: HTMLElement): { open(): void; close(): void };
  /** Sliding pills for .tabs / .seg and underline for .subtabs (aria-selected / aria-pressed). */
  indicators(scope?: ParentNode): void;
  /** Mouse-only accent glint on cards matching the selector. */
  glint(selector: string): void;
  /** The 0.3s view crossfade. */ fadeIn(el: HTMLElement): void;
  /** First-load rise-in (.booting, 1.4s). */ boot(): void;
  /** Stagger children after a filter change (.enter). */ enter(el: HTMLElement, selector?: string): void;
  /** Stat-pill bump. */ bump(el: HTMLElement): void;
  /** 'Cr2O7^2- -> 2Cr^3+' → HTML with <sub>/<sup> and arrows. */ chem(text: string): string;
  /** Same with Unicode sub/superscripts, for copying. */ plain(text: string): string;
  /** Clipboard copy from a click; the button's <span> shows Copied. */ copy(button: HTMLElement, text: string): void;
  /** Phone bottom sheet controller. */
  drawer(o: { dock?: HTMLElement; sheet: HTMLElement; backdrop?: HTMLElement }): { open(pane?: string): void; close(fast?: boolean): void; isOpen: boolean; pane?: string };
}
declare const Playground: Playground;
