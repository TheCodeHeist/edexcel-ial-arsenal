/* Ready-made sets of shots for the Launch tab. Each one makes a single point you can see. */
import type { Launch } from './physics';

export interface Example {
  id: string;
  name: string;
  note: string;
  shots: Launch[];
  show?: Partial<{ strobe: boolean; shadows: boolean; vectors: boolean }>;
}

const E = 9.81;
const s = (u: number, deg: number, h = 0, g = E, k = 0): Launch => ({ u, deg, h, g, k });

export const EXAMPLES: Example[] = [
  { id: 'drop', name: 'Drop and throw', note: 'Dropped and thrown sideways from 20 m: they land together.',
    shots: [s(0, 0, 20), s(8, 0, 20), s(16, 0, 20)], show: { shadows: true, strobe: true } },
  { id: 'cliff', name: 'Off a cliff', note: 'Thrown horizontally: the horizontal shadow moves at a steady pace.',
    shots: [s(12, 0, 45)], show: { shadows: true, strobe: true, vectors: true } },
  { id: 'complement', name: '30° and 60°', note: 'Angles that add to 90° give the same range.',
    shots: [s(20, 30), s(20, 60)] },
  { id: 'best', name: 'Best angle', note: 'On level ground 45° goes furthest.',
    shots: [s(20, 15), s(20, 30), s(20, 45), s(20, 60), s(20, 75)] },
  { id: 'top', name: 'At the top', note: 'At the highest point the vertical velocity is zero, not the speed.',
    shots: [s(18, 55)], show: { vectors: true, strobe: false } },
  { id: 'drag', name: 'Air resistance', note: 'Same launch with and without drag: shorter, and steeper on the way down.',
    shots: [s(30, 45), s(30, 45, 0, E, 0.004), s(30, 45, 0, E, 0.02)] },
  { id: 'moon', name: 'Earth and Moon', note: 'Same throw on the Moon: g is about a sixth, so everything is six times bigger.',
    shots: [s(10, 45, 0, E), s(10, 45, 0, 1.62)] },
];
