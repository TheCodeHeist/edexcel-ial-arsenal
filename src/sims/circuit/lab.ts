/* The I–V Lab experiments (core practicals): the circuits, the components you can test, and least-squares fitting.

   I–V characteristics: a variable d.c. supply (−6 V to +6 V; reversing it flips the cell), an ammeter in series
   and a voltmeter across the component. Diodes and LEDs get a 100 Ω protective resistor, as in the lab.
   E.m.f. and internal resistance: a cell of unknown ε and r, a variable resistor, an ammeter, and a voltmeter
   across the cell's terminals. Plot V against I: the intercept is ε and the gradient is −r. */

import { build, type Spec } from './examples';
import { solve } from './solve';
import type { CircuitData, Kind, Props } from './parts';

export type Dut = 'resistor' | 'lamp' | 'diode' | 'led' | 'thermistor' | 'ldr';

export const DUTS: Record<Dut, { label: string; short: string; kind: Kind; p: Props; protect: boolean; shape: string; why: string }> = {
  resistor: {
    label: 'Resistor', short: 'Resistor', kind: 'resistor', p: { R: 20 }, protect: false,
    shape: 'A straight line through the origin: current is directly proportional to p.d.',
    why: 'An ohmic conductor at constant temperature obeys Ohm’s law, so its resistance (V/I) is the same at every point.',
  },
  lamp: {
    label: 'Filament lamp', short: 'Lamp', kind: 'lamp', p: { rating: '6V' }, protect: false,
    shape: 'An S-shaped curve that gets flatter at larger p.d.s, the same in both directions.',
    why: 'A larger current heats the filament; its metal ions vibrate more, electrons collide with them more often, so the resistance rises and the current grows less for each extra volt.',
  },
  diode: {
    label: 'Diode', short: 'Diode', kind: 'diode', p: {}, protect: true,
    shape: 'Almost no current in reverse; in the forward direction the current rises steeply once the p.d. passes about 0.6 V.',
    why: 'A diode has a very high resistance in reverse and a low resistance forwards once the threshold p.d. is reached. The 100 Ω resistor protects it from too large a current.',
  },
  led: {
    label: 'LED (red)', short: 'LED', kind: 'led', p: { colour: 'red' }, protect: true,
    shape: 'Like a diode, but the current only rises steeply above about 1.8 V, and the LED lights.',
    why: 'An LED is a diode; the threshold p.d. depends on the colour (energy of the photons) it emits.',
  },
  thermistor: {
    label: 'Thermistor', short: 'Thermistor', kind: 'thermistor', p: { T: 20 }, protect: false,
    shape: 'A straight line at a fixed temperature; at a higher temperature the line is steeper.',
    why: 'Here the temperature is held constant, so the resistance does not change along the line. Raising the temperature releases more charge carriers, the resistance falls and the gradient (I/V) increases.',
  },
  ldr: {
    label: 'LDR', short: 'LDR', kind: 'ldr', p: { lux: 100 }, protect: false,
    shape: 'A straight line at a fixed light intensity; brighter light gives a steeper line.',
    why: 'Brighter light releases more charge carriers, so the resistance falls and more current flows for each volt.',
  },
};

export const SUPPLY = 6;  // the supply runs from −SUPPLY to +SUPPLY volts

/** The I–V test circuit; the component under test is always the third part. */
export function ivCircuit(d: Dut, vs: number, p: Props): CircuitData {
  const D = DUTS[d];
  const rot = vs < 0 ? 2 : 0;
  return build(
    [['cell', 8, 10, rot, { emf: Math.abs(vs) }, 'Supply'], ['ammeter', 6, 4], [D.kind, 11, 4, 0, { ...D.p, ...p }], ['voltmeter', 11, 2],
      ...(D.protect ? [['resistor', 15, 4, 0, { R: 100 }] as Spec] : [])],
    [[[7, 10], [3, 10], [3, 4], [5, 4]], [[7, 4], [10, 4]], ...(D.protect ? [[[12, 4], [14, 4]], [[16, 4], [18, 4], [18, 10], [9, 10]]] : [[[12, 4], [18, 4], [18, 10], [9, 10]]]) as [number, number][][],
      [[10, 2], [10, 4]], [[12, 2], [12, 4]]],
  );
}

/** p.d. across and current through the component under test (signed, terminal 0 → 1). */
export function measure(c: CircuitData) {
  const s = solve(c), x = c.parts[2];
  return { s, v: s.parts[x.id].v, i: s.parts[x.id].i };
}

/** The whole characteristic, for the “true curve” overlay and the axis range. */
export function ivCurve(d: Dut, p: Props, n = 121): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < n; k++) { const vs = -SUPPLY + (2 * SUPPLY * k) / (n - 1); const m = measure(ivCircuit(d, vs, p)); out.push([m.v, m.i]); }
  return out;
}

/* ---------- e.m.f. and internal resistance ---------- */

export function emfCircuit(E: number, r: number, R: number): CircuitData {
  return build(
    [['cell', 5, 7, 1, { emf: E, r }, 'Cell'], ['varres', 10, 4, 0, { R }], ['ammeter', 15, 4], ['voltmeter', 1, 7, 1]],
    [[[5, 6], [5, 4], [9, 4]], [[11, 4], [14, 4]], [[16, 4], [18, 4], [18, 10], [5, 10], [5, 8]], [[1, 6], [1, 5], [5, 5]], [[1, 8], [1, 9], [5, 9]]],
  );
}

/** Least-squares straight line y = m·x + c through the points (null with fewer than two distinct x values). */
export function fit(pts: { x: number; y: number }[]): { m: number; c: number } | null {
  const n = pts.length; if (n < 2) return null;
  const sx = pts.reduce((a, p) => a + p.x, 0), sy = pts.reduce((a, p) => a + p.y, 0);
  const sxx = pts.reduce((a, p) => a + p.x * p.x, 0), sxy = pts.reduce((a, p) => a + p.x * p.y, 0);
  const den = n * sxx - sx * sx; if (Math.abs(den) < 1e-12) return null;
  const m = (n * sxy - sx * sy) / den;
  return { m, c: (sy - m * sx) / n };
}

/** A tidy axis limit at or above x: 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6 or 8 × a power of ten. */
export function niceMax(x: number): number {
  if (x <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((k) => k * p >= x * 0.999) ?? 10) * p;
}
