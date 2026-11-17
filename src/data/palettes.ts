/* The six palettes, each with a light and a dark variant. Copied from the design system (design-system/js/playground.js).
   Colours reach the page through CSS variables in src/styles/palettes.css; this file feeds the theme picker swatches. */

export type PaletteId = "catppuccin" | "tokyo" | "nord" | "rosepine" | "gruvbox" | "everforest";
export interface Variant { v: string; bg: string; surf: string; ink: string; muted: string; line: string; accent: string; redox: string; ligand: string; acidbase: string; amph: string; cond: string; b1: string; b2: string; b3: string }
export interface Palette { name: string; light: Variant; dark: Variant }

export const PALETTES: Record<PaletteId, Palette> = {
  "catppuccin": {
    "name": "Catppuccin",
    "light": {
      "v": "Latte",
      "bg": "#eff1f5",
      "surf": "#ffffff",
      "ink": "#4c4f69",
      "muted": "#6c6f85",
      "line": "#ccd0da",
      "accent": "#1e66f5",
      "redox": "#d20f39",
      "ligand": "#8839ef",
      "acidbase": "#40a02b",
      "amph": "#df8e1d",
      "cond": "#ea76cb",
      "b1": "#7287fd",
      "b2": "#ea76cb",
      "b3": "#179299"
    },
    "dark": {
      "v": "Mocha",
      "bg": "#1e1e2e",
      "surf": "#313244",
      "ink": "#cdd6f4",
      "muted": "#a6adc8",
      "line": "#45475a",
      "accent": "#89b4fa",
      "redox": "#f38ba8",
      "ligand": "#cba6f7",
      "acidbase": "#a6e3a1",
      "amph": "#f9e2af",
      "cond": "#f5c2e7",
      "b1": "#cba6f7",
      "b2": "#89b4fa",
      "b3": "#f5c2e7"
    }
  },
  "tokyo": {
    "name": "Tokyo Night",
    "light": {
      "v": "Day",
      "bg": "#e1e2e7",
      "surf": "#f4f5f9",
      "ink": "#3760bf",
      "muted": "#6172b0",
      "line": "#c4c8da",
      "accent": "#2e7de9",
      "redox": "#f52a65",
      "ligand": "#9854f1",
      "acidbase": "#587539",
      "amph": "#b15c00",
      "cond": "#007197",
      "b1": "#2e7de9",
      "b2": "#9854f1",
      "b3": "#007197"
    },
    "dark": {
      "v": "Night",
      "bg": "#1a1b26",
      "surf": "#24283b",
      "ink": "#c0caf5",
      "muted": "#9aa5ce",
      "line": "#3b4261",
      "accent": "#7aa2f7",
      "redox": "#f7768e",
      "ligand": "#bb9af7",
      "acidbase": "#9ece6a",
      "amph": "#e0af68",
      "cond": "#7dcfff",
      "b1": "#7aa2f7",
      "b2": "#bb9af7",
      "b3": "#7dcfff"
    }
  },
  "nord": {
    "name": "Nord",
    "light": {
      "v": "Snow Storm",
      "bg": "#e5e9f0",
      "surf": "#f6f8fb",
      "ink": "#2e3440",
      "muted": "#4c566a",
      "line": "#d1d8e3",
      "accent": "#5e81ac",
      "redox": "#bf616a",
      "ligand": "#9a6f94",
      "acidbase": "#6d8a55",
      "amph": "#b97d1e",
      "cond": "#4f8a89",
      "b1": "#88c0d0",
      "b2": "#81a1c1",
      "b3": "#b48ead"
    },
    "dark": {
      "v": "Polar Night",
      "bg": "#2e3440",
      "surf": "#3b4252",
      "ink": "#eceff4",
      "muted": "#c0c8d6",
      "line": "#4c566a",
      "accent": "#88c0d0",
      "redox": "#bf616a",
      "ligand": "#b48ead",
      "acidbase": "#a3be8c",
      "amph": "#ebcb8b",
      "cond": "#8fbcbb",
      "b1": "#5e81ac",
      "b2": "#88c0d0",
      "b3": "#b48ead"
    }
  },
  "rosepine": {
    "name": "Rosé Pine",
    "light": {
      "v": "Dawn",
      "bg": "#faf4ed",
      "surf": "#fffaf3",
      "ink": "#575279",
      "muted": "#797593",
      "line": "#dfdad9",
      "accent": "#286983",
      "redox": "#b4637a",
      "ligand": "#907aa9",
      "acidbase": "#56949f",
      "amph": "#ea9d34",
      "cond": "#d7827e",
      "b1": "#d7827e",
      "b2": "#907aa9",
      "b3": "#56949f"
    },
    "dark": {
      "v": "Moon",
      "bg": "#232136",
      "surf": "#2a273f",
      "ink": "#e0def4",
      "muted": "#908caa",
      "line": "#44415a",
      "accent": "#9ccfd8",
      "redox": "#eb6f92",
      "ligand": "#c4a7e7",
      "acidbase": "#3e8fb0",
      "amph": "#f6c177",
      "cond": "#ea9a97",
      "b1": "#ea9a97",
      "b2": "#c4a7e7",
      "b3": "#3e8fb0"
    }
  },
  "gruvbox": {
    "name": "Gruvbox",
    "light": {
      "v": "Light",
      "bg": "#fbf1c7",
      "surf": "#fdf6dc",
      "ink": "#3c3836",
      "muted": "#7c6f64",
      "line": "#d5c4a1",
      "accent": "#076678",
      "redox": "#9d0006",
      "ligand": "#8f3f71",
      "acidbase": "#79740e",
      "amph": "#b57614",
      "cond": "#427b58",
      "b1": "#d79921",
      "b2": "#689d6a",
      "b3": "#d65d0e"
    },
    "dark": {
      "v": "Dark",
      "bg": "#282828",
      "surf": "#3c3836",
      "ink": "#ebdbb2",
      "muted": "#a89984",
      "line": "#504945",
      "accent": "#83a598",
      "redox": "#fb4934",
      "ligand": "#d3869b",
      "acidbase": "#b8bb26",
      "amph": "#fabd2f",
      "cond": "#8ec07c",
      "b1": "#fe8019",
      "b2": "#83a598",
      "b3": "#8ec07c"
    }
  },
  "everforest": {
    "name": "Everforest",
    "light": {
      "v": "Light",
      "bg": "#fdf6e3",
      "surf": "#fffbef",
      "ink": "#5c6a72",
      "muted": "#829181",
      "line": "#e0dcc7",
      "accent": "#3a94c5",
      "redox": "#f85552",
      "ligand": "#df69ba",
      "acidbase": "#8da101",
      "amph": "#dfa000",
      "cond": "#f57d26",
      "b1": "#93b259",
      "b2": "#35a77c",
      "b3": "#e66868"
    },
    "dark": {
      "v": "Dark",
      "bg": "#2d353b",
      "surf": "#343f44",
      "ink": "#d3c6aa",
      "muted": "#9da9a0",
      "line": "#475258",
      "accent": "#7fbbb3",
      "redox": "#e67e80",
      "ligand": "#d699b6",
      "acidbase": "#a7c080",
      "amph": "#dbbc7f",
      "cond": "#e69875",
      "b1": "#a7c080",
      "b2": "#83c092",
      "b3": "#e69875"
    }
  }
};
