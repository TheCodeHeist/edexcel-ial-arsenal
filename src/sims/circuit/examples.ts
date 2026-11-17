/* Ready-made circuits for the Build board, and the small layout helper they (and the Predict questions) use.
   Coordinates are grid points on the 20 × 12 board; a horizontal part at (x, y) has terminals at (x−1, y) and (x+1, y). */

import { KINDS, type CircuitData, type Kind, type Part, type Pt, type Rot, type Props } from './parts';

export type Spec = [kind: Kind, x: number, y: number, rot?: Rot, p?: Props, name?: string];

/** Parts (auto-named R1, R2 … unless a name is given) and wire paths (each a list of corner points). */
export function build(specs: Spec[], paths: Pt[][]): CircuitData {
  const parts: Part[] = [], count: Record<string, number> = {};
  specs.forEach(([kind, x, y, rot = 0, p = {}, name], i) => {
    const pre = KINDS[kind].prefix;
    count[pre] = (count[pre] ?? 0) + 1;
    parts.push({ id: 'p' + (i + 1), kind, name: name ?? pre + count[pre], x, y, rot, p: { ...KINDS[kind].defaults, ...p } });
  });
  const wires = paths.flatMap((pts) => pts.slice(1).map((b, i) => ({ a: [...pts[i]] as Pt, b: [...b] as Pt })))
    .map((w, i) => ({ id: 'w' + (i + 1), ...w }));
  return { parts, wires };
}

export interface Example { id: string; name: string; note: string; data: () => CircuitData }

export const EXAMPLES: Example[] = [
  {
    id: 'series', name: 'Series circuit',
    note: 'The same current flows through every part; the p.d.s across them add up to the e.m.f.',
    data: () => build(
      [['cell', 9, 10, 0, { emf: 6 }], ['resistor', 7, 3, 0, { R: 10 }], ['resistor', 13, 3, 0, { R: 20 }], ['ammeter', 17, 6, 1], ['voltmeter', 13, 1]],
      [[[3, 3], [6, 3]], [[8, 3], [12, 3]], [[14, 3], [17, 3], [17, 5]], [[17, 7], [17, 10], [10, 10]], [[8, 10], [3, 10], [3, 3]], [[12, 1], [12, 3]], [[14, 1], [14, 3]]],
    ),
  },
  {
    id: 'parallel', name: 'Parallel branches',
    note: 'Each branch has the full p.d. across it; the branch currents add up to the current from the cell.',
    data: () => build(
      [['cell', 8, 10, 0, { emf: 6 }], ['ammeter', 13, 10], ['resistor', 8, 3, 0, { R: 20 }], ['ammeter', 13, 3], ['resistor', 8, 6, 0, { R: 30 }], ['ammeter', 13, 6]],
      [[[7, 10], [3, 10], [3, 3], [7, 3]], [[9, 3], [12, 3]], [[14, 3], [17, 3], [17, 10], [14, 10]], [[3, 6], [7, 6]], [[9, 6], [12, 6]], [[14, 6], [17, 6]], [[12, 10], [9, 10]]],
    ),
  },
  {
    id: 'divider', name: 'Temperature sensor',
    note: 'A potential divider: as the thermistor warms, its resistance falls and so does its share of the p.d.',
    data: () => build(
      [['cell', 6, 10, 0, { emf: 6 }], ['resistor', 12, 4, 1, { R: 2200 }], ['thermistor', 12, 8, 1, { T: 20 }], ['voltmeter', 18, 8, 1]],
      [[[5, 10], [3, 10], [3, 2], [12, 2], [12, 3]], [[12, 5], [12, 7]], [[12, 9], [12, 10], [7, 10]], [[18, 7], [18, 6], [12, 6]], [[18, 9], [18, 10], [12, 10]]],
    ),
  },
  {
    id: 'emf', name: 'E.m.f. and internal resistance',
    note: 'Lower the load resistance: the current rises, more volts are lost inside the cell and the terminal p.d. falls.',
    data: () => build(
      [['cell', 5, 7, 1, { emf: 6, r: 1.5 }], ['varres', 10, 4, 0, { R: 10 }], ['ammeter', 15, 4, 0], ['voltmeter', 1, 7, 1]],
      [[[5, 6], [5, 4], [9, 4]], [[11, 4], [14, 4]], [[16, 4], [18, 4], [18, 10], [5, 10], [5, 8]], [[1, 6], [1, 5], [5, 5]], [[1, 8], [1, 9], [5, 9]]],
    ),
  },
  {
    id: 'pot', name: 'Lamp dimmer',
    note: 'The potentiometer divides the 6 V supply; slide it to give the lamp anything from 0 V to 6 V.',
    data: () => build(
      [['cell', 8, 11, 0, { emf: 6 }], ['pot', 8, 3, 0, { R: 20, wiper: 0.5 }], ['lamp', 12, 6, 0, { rating: '6V' }], ['voltmeter', 12, 8]],
      [[[7, 11], [3, 11], [3, 3], [7, 3]], [[9, 3], [16, 3], [16, 11], [9, 11]], [[8, 4], [8, 6], [11, 6]], [[13, 6], [16, 6]], [[11, 8], [11, 6]], [[13, 8], [13, 6]]],
    ),
  },
  {
    id: 'diodes', name: 'Diode direction',
    note: 'Only the diode pointing the way conventional current flows conducts, so only one lamp lights.',
    data: () => build(
      [['cell', 9, 10, 0, { emf: 6 }], ['diode', 7, 3, 0], ['lamp', 13, 3, 0], ['diode', 7, 6, 2], ['lamp', 13, 6, 0]],
      [[[8, 10], [3, 10], [3, 3], [6, 3]], [[8, 3], [12, 3]], [[14, 3], [17, 3], [17, 10], [10, 10]], [[3, 6], [6, 6]], [[8, 6], [12, 6]], [[14, 6], [17, 6]]],
    ),
  },
  {
    id: 'led', name: 'LED and resistor',
    note: 'The resistor limits the current. Close the switch, then try a blue LED: it needs a larger p.d. to light.',
    data: () => build(
      [['cell', 9, 10, 0, { emf: 6 }], ['switch', 5, 3, 0, { on: true }], ['resistor', 10, 3, 0, { R: 220 }], ['led', 15, 6, 1, { colour: 'red' }], ['ammeter', 15, 9, 1, {}]],
      [[[8, 10], [3, 10], [3, 3], [4, 3]], [[6, 3], [9, 3]], [[11, 3], [15, 3], [15, 5]], [[15, 7], [15, 8]], [[15, 10], [10, 10]]],
    ),
  },
];
