/* The parts bin: every component the Circuit Builder knows, its terminals, default settings and the controls the
   inspector shows for it. Pure data; the electrical models are in solve.ts and the symbols in Symbol.svelte.

   Geometry: the board is a grid of points. A part sits on a grid point (its centre) and its terminals are offsets
   from that point in grid units, before rotation. rot turns the part clockwise in 90° steps (screen y points down). */

export type Pt = [number, number];
export type Kind = 'cell' | 'resistor' | 'varres' | 'lamp' | 'diode' | 'led' | 'thermistor' | 'ldr' | 'switch' | 'ammeter' | 'voltmeter' | 'pot';
export type Rot = 0 | 1 | 2 | 3;
export type LedColour = 'red' | 'yellow' | 'green' | 'blue';
export type LampRating = '2.5V' | '6V' | '12V';

export interface Props {
  emf?: number;        // cell: e.m.f. in V
  r?: number;          // cell: internal resistance in Ω
  R?: number;          // resistor, variable resistor, potentiometer (end to end): resistance in Ω
  wiper?: number;      // potentiometer: wiper position 0–1 from terminal 0
  T?: number;          // thermistor: temperature in °C
  lux?: number;        // LDR: light intensity in lux
  on?: boolean;        // switch: closed?
  rating?: LampRating; // filament lamp
  colour?: LedColour;  // LED
}

export interface Part { id: string; kind: Kind; name: string; x: number; y: number; rot: Rot; p: Props }
export interface Wire { id: string; a: Pt; b: Pt }
export interface CircuitData { parts: Part[]; wires: Wire[] }

export interface Control {
  key: keyof Props; label: string; unit: string;
  type: 'range' | 'log' | 'toggle' | 'select';
  min?: number; max?: number; step?: number;
  options?: readonly (readonly [string, string])[];
}

export interface KindInfo {
  label: string;      // shown in the parts bin and inspector
  prefix: string;     // auto-name prefix: R1, R2 …
  terms: Pt[];        // terminal offsets before rotation
  defaults: Props;
  controls: Control[];
  note: string;       // one-line, exam-accurate description
}

const TWO: Pt[] = [[-1, 0], [1, 0]];

export const LAMPS: Record<LampRating, { v: number; i: number; label: string }> = {
  '2.5V': { v: 2.5, i: 0.3, label: '2.5 V, 0.3 A' },
  '6V': { v: 6, i: 0.5, label: '6 V, 0.5 A' },
  '12V': { v: 12, i: 0.5, label: '12 V, 0.5 A' },
};

/** LED forward voltage at 10 mA, and the colour it glows (a palette token, so it follows the theme). */
export const LEDS: Record<LedColour, { vf: number; glow: string; label: string }> = {
  red: { vf: 1.8, glow: 'var(--redox)', label: 'Red' },
  yellow: { vf: 2.0, glow: 'var(--amph)', label: 'Yellow' },
  green: { vf: 2.1, glow: 'var(--acidbase)', label: 'Green' },
  blue: { vf: 2.9, glow: 'var(--accent)', label: 'Blue' },
};

export const KINDS: Record<Kind, KindInfo> = {
  cell: {
    label: 'Cell', prefix: 'E', terms: TWO, defaults: { emf: 6, r: 0 },
    controls: [
      { key: 'emf', label: 'e.m.f.', unit: 'V', type: 'range', min: 0, max: 12, step: 0.1 },
      { key: 'r', label: 'Internal resistance', unit: 'Ω', type: 'range', min: 0, max: 10, step: 0.1 },
    ],
    note: 'The long plate is the positive terminal. Some of the e.m.f. is lost across the internal resistance when current flows.',
  },
  resistor: {
    label: 'Resistor', prefix: 'R', terms: TWO, defaults: { R: 10 },
    controls: [{ key: 'R', label: 'Resistance', unit: 'Ω', type: 'log', min: 1, max: 100000 }],
    note: 'An ohmic conductor: at constant temperature the current is proportional to the potential difference.',
  },
  varres: {
    label: 'Variable resistor', prefix: 'VR', terms: TWO, defaults: { R: 20 },
    controls: [{ key: 'R', label: 'Resistance', unit: 'Ω', type: 'range', min: 0, max: 100, step: 1 }],
    note: 'A rheostat: change its resistance to control the current in a series circuit.',
  },
  lamp: {
    label: 'Filament lamp', prefix: 'L', terms: TWO, defaults: { rating: '6V' },
    controls: [{ key: 'rating', label: 'Rating', unit: '', type: 'select', options: (Object.keys(LAMPS) as LampRating[]).map((k) => [k, LAMPS[k].label] as const) }],
    note: 'As the current rises the filament gets hotter, its ions vibrate more and its resistance increases.',
  },
  diode: {
    label: 'Diode', prefix: 'D', terms: TWO, defaults: {},
    controls: [],
    note: 'Conducts in the forward direction (the way the triangle points) once the p.d. is above about 0.6 V; almost no current in reverse.',
  },
  led: {
    label: 'LED', prefix: 'LED', terms: TWO, defaults: { colour: 'red' },
    controls: [{ key: 'colour', label: 'Colour', unit: '', type: 'select', options: (Object.keys(LEDS) as LedColour[]).map((k) => [k, LEDS[k].label] as const) }],
    note: 'A diode that emits light when it conducts forwards. Bluer light needs a larger forward p.d.',
  },
  thermistor: {
    label: 'Thermistor', prefix: 'TH', terms: TWO, defaults: { T: 20 },
    controls: [{ key: 'T', label: 'Temperature', unit: '°C', type: 'range', min: -10, max: 100, step: 1 }],
    note: 'An NTC thermistor: as temperature rises more charge carriers are released, so its resistance falls.',
  },
  ldr: {
    label: 'LDR', prefix: 'LDR', terms: TWO, defaults: { lux: 100 },
    controls: [{ key: 'lux', label: 'Light intensity', unit: 'lx', type: 'log', min: 1, max: 10000 }],
    note: 'A light-dependent resistor: brighter light releases more charge carriers, so its resistance falls.',
  },
  switch: {
    label: 'Switch', prefix: 'S', terms: TWO, defaults: { on: true },
    controls: [{ key: 'on', label: 'Position', unit: '', type: 'toggle' }],
    note: 'Tap it on the board to open or close it.',
  },
  ammeter: {
    label: 'Ammeter', prefix: 'A', terms: TWO, defaults: {},
    controls: [],
    note: 'Connect in series. An ideal ammeter has zero resistance.',
  },
  voltmeter: {
    label: 'Voltmeter', prefix: 'V', terms: TWO, defaults: {},
    controls: [],
    note: 'Connect in parallel, across the component. An ideal voltmeter has infinite resistance.',
  },
  pot: {
    label: 'Potentio\u00ADmeter', prefix: 'P', terms: [[-1, 0], [1, 0], [0, 1]], defaults: { R: 100, wiper: 0.5 },
    controls: [
      { key: 'R', label: 'Total resistance', unit: 'Ω', type: 'log', min: 10, max: 10000 },
      { key: 'wiper', label: 'Slider position', unit: '%', type: 'range', min: 0, max: 1, step: 0.01 },
    ],
    note: 'A potential divider in one part: the slider (third terminal) picks off any p.d. from zero to the full supply.',
  },
};

/** Parts bin order and groups. */
export const BIN: { g: string; kinds: Kind[] }[] = [
  { g: 'Sources and switches', kinds: ['cell', 'switch'] },
  { g: 'Resistors', kinds: ['resistor', 'varres', 'pot', 'thermistor', 'ldr'] },
  { g: 'Lamps and diodes', kinds: ['lamp', 'diode', 'led'] },
  { g: 'Meters', kinds: ['ammeter', 'voltmeter'] },
];

/* ---------- geometry ---------- */

export const rotate = ([x, y]: Pt, r: Rot): Pt => {
  for (let i = 0; i < r; i++) [x, y] = [-y, x];
  return [x + 0, y + 0]; // +0 turns -0 into 0 so keys match
};
export const terminals = (p: Part): Pt[] => KINDS[p.kind].terms.map((t) => { const [dx, dy] = rotate(t, p.rot); return [p.x + dx, p.y + dy]; });
export const key = ([x, y]: Pt) => x + ',' + y;
export const same = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1];

/** Is point p on segment a–b (ends included)? Works for any direction on the integer grid. */
export function onSeg(p: Pt, a: Pt, b: Pt): boolean {
  const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  if (cross !== 0) return false;
  return p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]) && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
}

/* ---------- component values that depend on settings ---------- */

/** NTC thermistor: 2.2 kΩ at 25 °C, B = 3950 K. */
export const thermR = (T: number) => 2200 * Math.exp(3950 * (1 / (T + 273.15) - 1 / 298.15));
/** LDR: about 1 MΩ in the dark falling to about 100 Ω in bright light. */
export const ldrR = (lux: number) => 4e5 * Math.pow(Math.max(lux, 0.1), -0.9);
