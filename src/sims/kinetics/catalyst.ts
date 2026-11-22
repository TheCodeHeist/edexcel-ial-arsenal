/* Kinetics Lab, Catalysts: the data behind the tab.

   Reaction profiles: smooth curves through key points (flat at every reactant, peak, intermediate and product), for an
   exothermic or endothermic reaction, with and without a catalyst. The catalysed route has two humps with an
   intermediate between them; its activation energy is the height of its highest hump above the reactants. ΔH is the
   same either way: the catalyst changes the route, not the start or the end.

   Surface catalysis: keyframes for the atoms of two heterogeneous catalyses on a metal (spec 11.11): the hydrogenation
   of ethene on nickel, and the Haber process on iron. Each stage lists every atom's position and the bonds present;
   the 3D view glides between stages. Positions are schematic (world units, the metal atoms 1 unit apart). */

/* ---------- reaction profiles ---------- */
export type Kind = 'exo' | 'endo';
export interface Levels { R: number; P: number; peak: number; p1: number; inter: number; p2: number }
export const LEVELS: Record<Kind, Levels> = {
  exo: { R: 0.45, P: 0.12, peak: 0.95, p1: 0.8, inter: 0.66, p2: 0.75 },
  endo: { R: 0.18, P: 0.55, peak: 0.95, p1: 0.74, inter: 0.67, p2: 0.8 },
};
/** key points [x, E] for one route */
export function keys(k: Kind, cat: boolean): [number, number][] {
  const L = LEVELS[k];
  return cat
    ? [[0, L.R], [0.14, L.R], [0.34, L.p1], [0.5, L.inter], [0.66, L.p2], [0.86, L.P], [1, L.P]]
    : [[0, L.R], [0.14, L.R], [0.5, L.peak], [0.86, L.P], [1, L.P]];
}
/** the profile as points, cosine-eased between key points (so every key point is a smooth turning point) */
export function profile(k: Kind, cat: boolean, n = 200): [number, number][] {
  const K = keys(k, cat), out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    let j = 0;
    while (j < K.length - 2 && x > K[j + 1][0]) j++;
    const [x0, y0] = K[j], [x1, y1] = K[j + 1];
    const u = x1 > x0 ? (x - x0) / (x1 - x0) : 0;
    out.push([x, y0 + (y1 - y0) * (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, u)))) / 2]);
  }
  return out;
}

/* ---------- surface catalysis ---------- */
export type Surf = 'ethene' | 'haber';
export type El = 'C' | 'H' | 'N';
export interface Stage { title: string; text: string; pos: [number, number, number][]; bonds: [number, number, number][]; ads: number[] }
export interface Surface { metal: string; metalName: string; equation: string; atoms: El[]; stages: Stage[]; note: string }

const NH3 = (x: number, y: number, z: number, up = 1): [number, number, number][] =>
  [0, 1, 2].map((k) => [x + 0.78 * Math.cos((k * 2 * Math.PI) / 3 + 0.5), y + 0.32 * up, z + 0.78 * Math.sin((k * 2 * Math.PI) / 3 + 0.5)]);

const ETH: Surface = {
  metal: 'Ni', metalName: 'nickel', equation: 'CH₂=CH₂ + H₂ → CH₃CH₃',
  atoms: ['C', 'C', 'H', 'H', 'H', 'H', 'H', 'H'],      // C1, C2, H on C1 ×2, H on C2 ×2, Ha, Hb (the H₂)
  note: 'Used to harden vegetable oils into margarine (adding H₂ across C=C bonds), at about 150 °C with finely divided nickel.',
  stages: [
    {
      title: 'Reactants arrive', text: 'Ethene and hydrogen molecules diffuse to the surface of the nickel.',
      pos: [[-1.67, 3.3, 0], [-0.33, 3.3, 0], [-2.2, 3.3, 0.92], [-2.2, 3.3, -0.92], [0.2, 3.3, 0.92], [0.2, 3.3, -0.92], [1.9, 3.0, 0.37], [1.9, 3.0, -0.37]],
      bonds: [[0, 1, 2], [0, 2, 1], [0, 3, 1], [1, 4, 1], [1, 5, 1], [6, 7, 1]], ads: [],
    },
    {
      title: 'Adsorption', text: 'The molecules form weak bonds to the metal atoms at active sites. H–H breaks into two H atoms on the surface; ethene’s π bond is used to bond to the surface, so C=C becomes C–C.',
      pos: [[-1.25, 1.3, 0], [0.25, 1.3, 0], [-1.8, 1.9, 0.85], [-1.8, 1.9, -0.85], [0.8, 1.9, 0.85], [0.8, 1.9, -0.85], [2, 0.98, 1], [2, 0.98, -1]],
      bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [1, 4, 1], [1, 5, 1]], ads: [0, 1, 6, 7],
    },
    {
      title: 'Reaction on the surface', text: 'The reactants are held close together, at the right angle, with their bonds weakened: an adsorbed H atom moves across and bonds to one carbon.',
      pos: [[-1.25, 1.3, 0], [0.25, 1.75, 0], [-1.8, 1.9, 0.85], [-1.8, 1.9, -0.85], [0.6, 2.3, 0.85], [0.6, 2.3, -0.85], [0.95, 1.4, 0], [2, 0.98, -1]],
      bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [1, 4, 1], [1, 5, 1], [1, 6, 1]], ads: [0, 7],
    },
    {
      title: 'Second H adds', text: 'The second H atom bonds to the other carbon: ethane has formed, held only weakly on the surface.',
      pos: [[-1.25, 1.75, 0], [0.25, 1.75, 0], [-1.6, 2.3, 0.85], [-1.6, 2.3, -0.85], [0.6, 2.3, 0.85], [0.6, 2.3, -0.85], [0.95, 1.4, 0], [-1.95, 1.4, 0]],
      bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [1, 4, 1], [1, 5, 1], [1, 6, 1], [0, 7, 1]], ads: [],
    },
    {
      title: 'Desorption', text: 'The ethane leaves the surface (desorbs), freeing the active sites for more reactants. The nickel is unchanged.',
      pos: [[-0.75, 3.6, 0], [0.75, 3.6, 0], [-1.1, 4.15, 0.85], [-1.1, 4.15, -0.85], [1.1, 4.15, 0.85], [1.1, 4.15, -0.85], [1.45, 3.25, 0], [-1.45, 3.25, 0]],
      bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [1, 4, 1], [1, 5, 1], [1, 6, 1], [0, 7, 1]], ads: [],
    },
  ],
};

const n1 = NH3(-2, 1.0, 0), n2 = NH3(0, 1.0, 0);
const HAB: Surface = {
  metal: 'Fe', metalName: 'iron', equation: 'N₂ + 3H₂ ⇌ 2NH₃',
  atoms: ['N', 'N', 'H', 'H', 'H', 'H', 'H', 'H'],
  note: 'The Haber process: iron at about 450 °C and 200 atm. Without the catalyst the reaction would be far too slow at any temperature that still gives a useful yield.',
  stages: [
    {
      title: 'Reactants arrive', text: 'Nitrogen and hydrogen molecules diffuse to the surface of the iron.',
      pos: [[-1.6, 3.2, 0], [-0.5, 3.2, 0], [1.0, 3.4, -1.2], [1.0, 3.4, -0.46], [1.8, 2.9, 0.3], [1.8, 2.9, 1.04], [0.2, 3.7, 1.6], [0.94, 3.7, 1.6]],
      bonds: [[0, 1, 3], [2, 3, 1], [4, 5, 1], [6, 7, 1]], ads: [],
    },
    {
      title: 'Adsorption', text: 'The gases adsorb: H–H bonds break, leaving H atoms on the surface; N₂ lies on the iron and its triple bond is weakened.',
      pos: [[-1.55, 1.05, 0], [-0.45, 1.05, 0], [1, 0.98, -1], [2, 0.98, -1], [1, 0.98, 1], [2, 0.98, 1], [3, 0.98, 0], [-3, 0.98, 1]],
      bonds: [[0, 1, 0.5]], ads: [0, 1, 2, 3, 4, 5, 6, 7],
    },
    {
      title: 'N≡N breaks', text: 'The weakened N≡N bond breaks, leaving two N atoms bonded to the iron. Breaking N≡N (945 kJ mol⁻¹) is the hardest step: the surface makes it possible.',
      pos: [[-2, 1.0, 0], [0, 1.0, 0], [1, 0.98, -1], [2, 0.98, -1], [1, 0.98, 1], [2, 0.98, 1], [3, 0.98, 0], [-3, 0.98, 1]],
      bonds: [], ads: [0, 1, 2, 3, 4, 5, 6, 7],
    },
    {
      title: 'N–H bonds form', text: 'Adsorbed H atoms move across the surface and bond to the N atoms one at a time: NH, then NH₂.',
      pos: [[-2, 1.0, 0], [0, 1.0, 0], n2[0], n2[1], [1, 0.98, 1], n1[0], n1[1], [-3, 0.98, 1]],
      bonds: [[1, 2, 1], [1, 3, 1], [0, 5, 1], [0, 6, 1]], ads: [0, 1, 4, 7],
    },
    {
      title: 'Ammonia forms', text: 'Each N gains its third H: two NH₃ molecules, held weakly on the surface.',
      pos: [[-2, 1.0, 0], [0, 1.0, 0], n2[0], n2[1], n2[2], n1[0], n1[1], n1[2]],
      bonds: [[1, 2, 1], [1, 3, 1], [1, 4, 1], [0, 5, 1], [0, 6, 1], [0, 7, 1]], ads: [0, 1],
    },
    {
      title: 'Desorption', text: 'The ammonia desorbs and leaves; the active sites are free again and the iron is unchanged.',
      pos: [[-2.3, 3.2, 0.4], [0.6, 3.5, -0.3], ...NH3(0.6, 3.5, -0.3).map(([x, y, z]) => [x, y, z] as [number, number, number]), ...NH3(-2.3, 3.2, 0.4)],
      bonds: [[1, 2, 1], [1, 3, 1], [1, 4, 1], [0, 5, 1], [0, 6, 1], [0, 7, 1]], ads: [],
    },
  ],
};
export const SURFACES: Record<Surf, Surface> = { ethene: ETH, haber: HAB };

/* ---------- the cobalt(II) demonstration ---------- */
export interface CoStep { id: string; title: string; text: string; colour: string; fizz: number; temp: string }
export const CO_STEPS: CoStep[] = [
  { id: 'start', title: 'Heat the mixture', colour: '#eef3f6', fizz: 0.08, temp: '~70 °C',
    text: 'Potassium sodium tartrate (Rochelle salt) and hydrogen peroxide, warmed to about 70 °C: almost colourless, with only a few slow bubbles. The reaction is very slow.' },
  { id: 'add', title: 'Add cobalt(II) chloride', colour: '#f4a6bd', fizz: 0.25, temp: '~70 °C',
    text: 'A little pink cobalt(II) chloride solution is added. Co²⁺(aq) is pink. It is in the same phase as the reactants: a homogeneous catalyst.' },
  { id: 'green', title: 'Green intermediate', colour: '#5fae6e', fizz: 1, temp: 'rising',
    text: 'The solution turns green and fizzes vigorously as carbon dioxide (and some oxygen) is given off. H₂O₂ has oxidised Co²⁺ to a green cobalt(III)–tartrate complex: the intermediate, on the lower-energy route.' },
  { id: 'pink', title: 'Pink again', colour: '#f2a2bb', fizz: 0.15, temp: 'cooling',
    text: 'As the tartrate is used up, the cobalt(III) is reduced back to cobalt(II): the pink colour returns. The catalyst is regenerated, chemically unchanged at the end.' },
];

/* ---------- industry ---------- */
export interface Case { name: string; cat: string; kind: 'hetero' | 'homo' | 'both' | 'enzyme'; eq: string; gain: string }
export const CASES: Case[] = [
  { name: 'Haber process', cat: 'iron', kind: 'hetero', eq: 'N₂ + 3H₂ ⇌ 2NH₃', gain: 'A useful rate at about 450 °C. Without iron a much higher temperature would be needed: more fuel burned, and a lower yield (the forward reaction is exothermic).' },
  { name: 'Contact process', cat: 'vanadium(V) oxide, V₂O₅', kind: 'hetero', eq: '2SO₂ + O₂ ⇌ 2SO₃', gain: 'Fast conversion at about 450 °C and only 1–2 atm: lower energy costs for sulfuric acid.' },
  { name: 'Ethanol by hydration', cat: 'phosphoric acid on silica', kind: 'hetero', eq: 'C₂H₄ + H₂O → C₂H₅OH', gain: 'An addition reaction: atom economy 100%, against 51% for fermentation (C₆H₁₂O₆ → 2C₂H₅OH + 2CO₂).' },
  { name: 'Ibuprofen (BHC route)', cat: 'HF, Raney nickel and palladium', kind: 'both', eq: '3 catalysed steps', gain: 'Three steps instead of six: atom economy about 77% instead of 40%, with far less waste.' },
  { name: 'Catalytic converters', cat: 'platinum, rhodium, palladium', kind: 'hetero', eq: '2CO + 2NO → 2CO₂ + N₂', gain: 'Removes toxic CO, NOₓ and unburnt fuel at exhaust temperatures; the metal is a thin coat on a honeycomb, for a huge surface area.' },
  { name: 'Enzymes', cat: 'proteins (biological catalysts)', kind: 'enzyme', eq: 'e.g. low-temperature washing', gain: 'Work at about 37 °C and atmospheric pressure, and are very specific, so fewer by-products.' },
];

/** atom economy = Mr of the wanted product ÷ total Mr of the reactants × 100 */
export const AE = { hydration: (46.0 / (28.0 + 18.0)) * 100, fermentation: ((2 * 46.0) / 180.0) * 100 };
