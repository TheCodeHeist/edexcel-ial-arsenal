/* Kinetics Lab, Mechanisms (spec 11.6–11.9): the data behind the tab.

   1. The rate equation ↔ rate-determining step exercise: real reactions, each with its overall equation, its
      experimental rate equation, the accepted mechanism and plausible wrong ones. Every candidate mechanism adds up
      to the overall equation; what it predicts for the rate equation comes from its slow step (species made in an
      earlier fast step are traced back to the reactants that made them).
   2. The acid-catalysed iodination of propanone: an initial-rates table (consistent with CP9a’s k) and a four-step
      mechanism drawn with curly arrows (coordinates for the SVG in Mechanism.svelte).
   3. SN1 and SN2: the timelines for the 3D scene live in mechanism3d.ts. */

export type Speed = 'slow' | 'fast' | 'fast ⇌';
export interface Mech { steps: [string, Speed][]; ok: boolean; predicts: string; why: string }
export interface Example {
  id: string; name: string; overall: string;
  species: string[];                 // the reactants, in the order shown in the rate equation
  orders: number[];                  // experimental orders, same order as species
  rate: string;                      // the rate equation written out
  mechs: Mech[];                     // mechs[0] is the accepted one
  note: string;
}

export const EXAMPLES: Example[] = [
  {
    id: 'no2co', name: 'NO₂ and CO (below 500 K)', overall: 'NO₂ + CO → NO + CO₂',
    species: ['NO₂', 'CO'], orders: [2, 0], rate: 'rate = k[NO₂]²',
    mechs: [
      { steps: [['NO₂ + NO₂ → NO₃ + NO', 'slow'], ['NO₃ + CO → NO₂ + CO₂', 'fast']], ok: true, predicts: 'rate = k[NO₂]²',
        why: 'Two NO₂ molecules collide in the slow step and CO only reacts afterwards, so the rate is second order in NO₂ and zero order in CO. The steps add up to the overall equation (NO₃ is an intermediate).' },
      { steps: [['NO₂ + CO → NO + CO₂', 'slow']], ok: false, predicts: 'rate = k[NO₂][CO]',
        why: 'A one-step reaction would be first order in each reactant; the data show zero order in CO.' },
      { steps: [['NO₂ → NO + O', 'slow'], ['O + CO → CO₂', 'fast']], ok: false, predicts: 'rate = k[NO₂]',
        why: 'Only one NO₂ is in this slow step, so it predicts first order in NO₂, not second.' },
    ],
    note: 'Zero order in CO: CO must enter after the rate-determining step.',
  },
  {
    id: 'no2f2', name: 'NO₂ and fluorine', overall: '2NO₂ + F₂ → 2NO₂F',
    species: ['NO₂', 'F₂'], orders: [1, 1], rate: 'rate = k[NO₂][F₂]',
    mechs: [
      { steps: [['NO₂ + F₂ → NO₂F + F', 'slow'], ['NO₂ + F → NO₂F', 'fast']], ok: true, predicts: 'rate = k[NO₂][F₂]',
        why: 'One NO₂ and one F₂ collide in the slow step; the second NO₂ reacts later with the F atom (an intermediate), so it does not appear in the rate equation.' },
      { steps: [['2NO₂ + F₂ → 2NO₂F', 'slow']], ok: false, predicts: 'rate = k[NO₂]²[F₂]',
        why: 'A single step would need three particles to collide at once (very unlikely), and it predicts second order in NO₂.' },
      { steps: [['F₂ → 2F', 'slow'], ['NO₂ + F → NO₂F', 'fast'], ['NO₂ + F → NO₂F', 'fast']], ok: false, predicts: 'rate = k[F₂]',
        why: 'No NO₂ in this slow step, so it predicts zero order in NO₂.' },
    ],
    note: 'The stoichiometry (2 NO₂) and the orders (1 NO₂) differ: the reaction must take more than one step.',
  },
  {
    id: 'h2o2', name: 'Hydrogen peroxide and iodide (the clock reaction)', overall: 'H₂O₂ + 2I⁻ + 2H⁺ → I₂ + 2H₂O',
    species: ['H₂O₂', 'I⁻', 'H⁺'], orders: [1, 1, 0], rate: 'rate = k[H₂O₂][I⁻]',
    mechs: [
      { steps: [['H₂O₂ + I⁻ → IO⁻ + H₂O', 'slow'], ['IO⁻ + H⁺ → HIO', 'fast'], ['HIO + I⁻ + H⁺ → I₂ + H₂O', 'fast']], ok: true, predicts: 'rate = k[H₂O₂][I⁻]',
        why: 'H₂O₂ and one I⁻ meet in the slow step; the H⁺ ions and the second I⁻ react afterwards, so they are not in the rate equation.' },
      { steps: [['H₂O₂ + H⁺ → H₃O₂⁺', 'slow'], ['H₃O₂⁺ + I⁻ → HIO + H₂O', 'fast'], ['HIO + I⁻ + H⁺ → I₂ + H₂O', 'fast']], ok: false, predicts: 'rate = k[H₂O₂][H⁺]',
        why: 'This slow step contains H⁺ and no I⁻: it predicts first order in H⁺ and zero order in I⁻, the opposite of the data.' },
    ],
    note: 'This is the reaction timed in Core Practicals 9b and 10.',
  },
  {
    id: 'propanone', name: 'Iodination of propanone (acid catalyst)', overall: 'CH₃COCH₃ + I₂ → CH₃COCH₂I + HI',
    species: ['CH₃COCH₃', 'I₂', 'H⁺'], orders: [1, 0, 1], rate: 'rate = k[CH₃COCH₃][H⁺]',
    mechs: [
      { steps: [['CH₃COCH₃ + H⁺ ⇌ CH₃C(OH⁺)CH₃', 'fast ⇌'], ['CH₃C(OH⁺)CH₃ → CH₂=C(OH)CH₃ + H⁺', 'slow'], ['CH₂=C(OH)CH₃ + I₂ → CH₃COCH₂I + HI', 'fast']], ok: true, predicts: 'rate = k[CH₃COCH₃][H⁺]',
        why: 'The slow step uses the protonated propanone, which was made from one propanone and one H⁺; I₂ reacts only with the enol, after the slow step: zero order in I₂. H⁺ is given back, so it is a catalyst.' },
      { steps: [['CH₃COCH₃ + I₂ → CH₃COCH₂I + HI', 'slow']], ok: false, predicts: 'rate = k[CH₃COCH₃][I₂]',
        why: 'This would be first order in I₂ and zero in H⁺: but CP9a shows iodine is used up at a constant rate (zero order) and the rate depends on [H⁺].' },
      { steps: [['CH₃COCH₃ ⇌ CH₂=C(OH)CH₃', 'slow'], ['CH₂=C(OH)CH₃ + I₂ → CH₃COCH₂I + HI', 'fast']], ok: false, predicts: 'rate = k[CH₃COCH₃]',
        why: 'With no H⁺ before or in the slow step, the rate would not depend on the acid; the data show first order in H⁺.' },
    ],
    note: 'A catalyst can appear in the rate equation: it takes part in the slow step and is regenerated later.',
  },
  {
    id: 'sn1', name: '2-bromo-2-methylpropane + OH⁻ (tertiary)', overall: '(CH₃)₃CBr + OH⁻ → (CH₃)₃COH + Br⁻',
    species: ['(CH₃)₃CBr', 'OH⁻'], orders: [1, 0], rate: 'rate = k[(CH₃)₃CBr]',
    mechs: [
      { steps: [['(CH₃)₃CBr → (CH₃)₃C⁺ + Br⁻', 'slow'], ['(CH₃)₃C⁺ + OH⁻ → (CH₃)₃COH', 'fast']], ok: true, predicts: 'rate = k[(CH₃)₃CBr]',
        why: 'SN1: the C–Br bond breaks on its own in the slow step; OH⁻ attacks the carbocation afterwards, so it is zero order in OH⁻. The 1 in SN1 is the one species in the rate-determining step.' },
      { steps: [['(CH₃)₃CBr + OH⁻ → (CH₃)₃COH + Br⁻', 'slow']], ok: false, predicts: 'rate = k[(CH₃)₃CBr][OH⁻]',
        why: 'A one-step (SN2) mechanism would be first order in OH⁻ as well. Three methyl groups also block the back of the carbon.' },
    ],
    note: 'Tertiary halogenoalkanes: SN1.',
  },
  {
    id: 'sn2', name: '1-bromobutane + OH⁻ (primary)', overall: 'CH₃CH₂CH₂CH₂Br + OH⁻ → CH₃CH₂CH₂CH₂OH + Br⁻',
    species: ['C₄H₉Br', 'OH⁻'], orders: [1, 1], rate: 'rate = k[C₄H₉Br][OH⁻]',
    mechs: [
      { steps: [['C₄H₉Br + OH⁻ → C₄H₉OH + Br⁻', 'slow']], ok: true, predicts: 'rate = k[C₄H₉Br][OH⁻]',
        why: 'SN2: one step, through a transition state with both OH and Br partly bonded to the carbon. Both are in that step, so first order in each: second order overall (the 2 in SN2).' },
      { steps: [['C₄H₉Br → C₄H₉⁺ + Br⁻', 'slow'], ['C₄H₉⁺ + OH⁻ → C₄H₉OH', 'fast']], ok: false, predicts: 'rate = k[C₄H₉Br]',
        why: 'An SN1 route would be zero order in OH⁻. A primary carbocation is too unstable to form, and the back of a primary carbon is open to attack.' },
    ],
    note: 'Primary halogenoalkanes: SN2. Secondary ones can react by both.',
  },
  {
    id: 'no', name: 'Nitrogen monoxide and oxygen', overall: '2NO + O₂ → 2NO₂',
    species: ['NO', 'O₂'], orders: [2, 1], rate: 'rate = k[NO]²[O₂]',
    mechs: [
      { steps: [['2NO ⇌ N₂O₂', 'fast ⇌'], ['N₂O₂ + O₂ → 2NO₂', 'slow']], ok: true, predicts: 'rate = k[NO]²[O₂]',
        why: 'The slow step uses N₂O₂, an intermediate made from two NO in a fast step before it, and one O₂: so second order in NO and first order in O₂.' },
      { steps: [['NO + O₂ → NO₃', 'slow'], ['NO₃ + NO → 2NO₂', 'fast']], ok: false, predicts: 'rate = k[NO][O₂]',
        why: 'Only one NO is involved up to and including this slow step, so it predicts first order in NO.' },
    ],
    note: 'Species made in a fast step before the slow step count through the reactants that made them.',
  },
];

/* ---------- iodination of propanone: an initial-rates table (k = 2.8 × 10⁻⁵ dm³ mol⁻¹ s⁻¹, as CP9a) ---------- */
export const IOD_K = 2.8e-5;
export const IOD_RUNS: { P: number; I: number; H: number }[] = [
  { P: 0.20, I: 0.0020, H: 0.20 },
  { P: 0.40, I: 0.0020, H: 0.20 },
  { P: 0.20, I: 0.0040, H: 0.20 },
  { P: 0.20, I: 0.0020, H: 0.40 },
];
export const iodRate = (r: { P: number; H: number }) => IOD_K * r.P * r.H;

/* ---------- the curly-arrow mechanism (SVG, viewBox 600 × 200) ---------- */
export interface Atom { x: number; y: number; t: string; q?: string; lp?: [number, number] }       // lp: lone-pair dots, offset from the atom
export interface Bond { a: number; b: number; n: 1 | 2 }
export interface Curl { from: [number, number]; to: [number, number]; c: [number, number] }        // quadratic Bézier
export interface Panel { atoms: Atom[]; bonds: Bond[]; arrows: Curl[]; extra: { x: number; y: number; t: string; cls?: string }[] }
export interface IodStep { title: string; speed: Speed; left: Panel; right: Panel; say: string }

const ketone = (x: number, left: string, oq: string, oH: boolean): Pick<Panel, 'atoms' | 'bonds'> => ({
  atoms: [
    { x, y: 112, t: 'C' }, { x, y: 58, t: 'O', q: oq, lp: oH ? [-14, -6] : [0, -14] },
    { x: x - 48, y: 138, t: left }, { x: x + 48, y: 138, t: 'CH₃' },
    ...(oH ? [{ x: x + 38, y: 36, t: 'H' }] : []),
  ],
  bonds: [{ a: 0, b: 1, n: 2 }, { a: 0, b: 2, n: 1 }, { a: 0, b: 3, n: 1 }, ...(oH ? [{ a: 1, b: 4, n: 1 as const }] : [])],
});
const enol = (x: number): Pick<Panel, 'atoms' | 'bonds'> => ({
  atoms: [{ x, y: 112, t: 'C' }, { x, y: 58, t: 'O', lp: [-15, -4] }, { x: x - 48, y: 138, t: 'H₂C' }, { x: x + 48, y: 138, t: 'CH₃' }, { x: x + 38, y: 36, t: 'H' }],
  bonds: [{ a: 0, b: 1, n: 1 }, { a: 0, b: 2, n: 2 }, { a: 0, b: 3, n: 1 }, { a: 1, b: 4, n: 1 }],
});

export const IOD_STEPS: IodStep[] = [
  {
    title: 'Step 1: protonation', speed: 'fast ⇌',
    left: { ...ketone(110, 'H₃C', '', false), arrows: [{ from: [110, 42], to: [196, 52], c: [150, 6] }], extra: [{ x: 210, y: 64, t: 'H⁺', cls: 'hp' }] },
    right: { ...ketone(440, 'H₃C', '+', true), arrows: [], extra: [] },
    say: 'A lone pair on the carbonyl oxygen forms a bond to H⁺ from the acid catalyst. Fast and reversible.',
  },
  {
    title: 'Step 2: the enol forms', speed: 'slow',
    left: {
      atoms: [{ x: 120, y: 112, t: 'C' }, { x: 120, y: 58, t: 'O', q: '+' }, { x: 70, y: 138, t: 'C' }, { x: 168, y: 138, t: 'CH₃' }, { x: 158, y: 36, t: 'H' },
        { x: 34, y: 168, t: 'H' }, { x: 44, y: 124, t: 'H' }, { x: 78, y: 180, t: 'H' }],
      bonds: [{ a: 0, b: 1, n: 2 }, { a: 0, b: 2, n: 1 }, { a: 0, b: 3, n: 1 }, { a: 1, b: 4, n: 1 }, { a: 2, b: 5, n: 1 }, { a: 2, b: 6, n: 1 }, { a: 2, b: 7, n: 1 }],
      arrows: [{ from: [52, 153], to: [94, 123], c: [56, 118] }, { from: [126, 86], to: [134, 60], c: [148, 76] }],
      extra: [{ x: 6, y: 196, t: 'H⁺ is lost (to water)', cls: 'note' }],
    },
    right: { ...enol(440), arrows: [], extra: [{ x: 560, y: 70, t: '+ H⁺', cls: 'hp' }] },
    say: 'A C–H bond on a methyl group breaks; its electrons form C=C, and the C=O electrons move onto the O⁺. This is the slow, rate-determining step. The species in it came from one propanone and one H⁺.',
  },
  {
    title: 'Step 3: the enol attacks iodine', speed: 'fast',
    left: {
      ...enol(150),
      atoms: [...enol(150).atoms, { x: 40, y: 84, t: 'I' }, { x: 40, y: 28, t: 'I' }],
      bonds: [...enol(150).bonds, { a: 5, b: 6, n: 1 }],
      arrows: [{ from: [124, 126], to: [52, 92], c: [80, 132] }, { from: [40, 56], to: [24, 30], c: [18, 50] }, { from: [134, 52], to: [146, 84], c: [128, 76] }],
      extra: [],
    },
    right: { ...ketone(440, 'ICH₂', '+', true), arrows: [], extra: [{ x: 560, y: 70, t: '+ I⁻', cls: 'hp' }] },
    say: 'The electron-rich C=C attacks iodine; the I–I bond breaks to give I⁻, and an oxygen lone pair re-forms C=O⁺. Fast: iodine joins only after the slow step, so the reaction is zero order in I₂.',
  },
  {
    title: 'Step 4: H⁺ is given back', speed: 'fast',
    left: { ...ketone(120, 'ICH₂', '+', true), arrows: [{ from: [140, 46], to: [128, 62], c: [146, 62] }], extra: [] },
    right: { ...ketone(440, 'ICH₂', '', false), arrows: [], extra: [{ x: 560, y: 70, t: '+ H⁺', cls: 'hp' }] },
    say: 'The O–H bond breaks, its electrons going to the oxygen. Iodopropanone forms and H⁺ is regenerated: it is a catalyst. Overall: CH₃COCH₃ + I₂ → CH₃COCH₂I + H⁺ + I⁻ (HI).',
  },
];
