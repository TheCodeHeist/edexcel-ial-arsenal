/* Practice: generated exam-style questions on IAL Chemistry kinetics and equilibria (Topics 9, 11 and 13), four
   options each. Wrong options are the slips students make: forgetting to convert kJ to J or °C to K, swapping the
   M–B explanation for collision frequency, saying a catalyst moves the curve or shifts the equilibrium, writing K
   upside down, keeping solids in K, counting moles of liquid towards pressure. Every question carries its working. */

import { R, plain, sci } from './consts';
import { pick, shuffle } from '../../lib/util';

export type Topic = 'collide' | 'catalyst' | 'measure' | 'orders' | 'mech' | 'arrhenius' | 'equil' | 'k' | 'industry';
export const TOPICS: [Topic | 'all', string][] = [
  ['all', 'Everything'], ['collide', 'Collision theory'], ['catalyst', 'Catalysts and profiles'], ['measure', 'Measuring rates'],
  ['orders', 'Rate equations and orders'], ['mech', 'Mechanisms and the slow step'], ['arrhenius', 'Activation energy and the practicals'],
  ['equil', 'Equilibrium and Le Chatelier'], ['k', 'Kc and Kp'], ['industry', 'Industry, K and temperature'],
];
export const TOPIC_NAME: Record<Topic, string> = {
  collide: 'Collision theory', catalyst: 'Catalysts and reaction profiles', measure: 'Measuring rates', orders: 'Rate equations and orders',
  mech: 'Mechanisms and the rate-determining step', arrhenius: 'Activation energy and the core practicals', equil: 'Equilibrium and Le Chatelier',
  k: 'Kc and Kp', industry: 'Industry, K and temperature',
};
/** the spec statements behind each topic */
export const SPEC: Record<Topic | 'all', string> = {
  all: 'Topics 9, 11 and 13', collide: '9.1, 9.2, 9.4', catalyst: '9.5–9.8, 11.11', measure: '9.3, 11.3, 11.4', orders: '11.1, 11.2, 11.5',
  mech: '11.6–11.9', arrhenius: '11.10, 11.12, 11.13 · CP9, CP10', equil: '9.9, 9.10, 13.4, 13.5, 13.7', k: '13.1–13.3, 13.9', industry: '9.11, 13.6, 13.8',
};

export type Figure =
  | { kind: 'mb'; curves: { T: number; label: string }[]; ea: { E: number; label: string }[]; shade?: number }
  | { kind: 'profile'; dH: number; ea: number; cat?: number; marks?: boolean }
  | { kind: 'ct'; order: 0 | 1 | 2; halves: boolean; yl: string; xl: string }
  | { kind: 'rc'; order: 0 | 1 | 2 }
  | { kind: 'tangent'; X: number; Y: number; xl: string; yl: string; at: number }
  | { kind: 'arrh'; pts: [number, number][]; xl: string; yl: string }
  | { kind: 'table'; head: string[]; rows: string[][] };
export interface Question { topic: Topic; prompt: string; options: string[]; answer: string; working: string[]; why: string; figure?: Figure }

const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const p3 = (x: number) => plain(x, 3);
const p2 = (x: number) => plain(x, 2);
/** true minus sign */
const neg = (x: number | string) => String(x).replace('-', '−');

function opts(ans: number, slips: number[], unit: string, fmt: (x: number) => string = p3) {
  const f = (x: number) => `${neg(fmt(x))} ${unit}`.trim();
  const answer = f(ans);
  const out = new Set([answer]);
  for (const w of [...slips, ans * 10, ans / 10, ans * 2, ans / 2, ans * 4, -ans]) {
    if (out.size >= 4) break;
    if (isFinite(w) && w !== 0 && Math.abs(w / ans - 1) > 0.04 && !out.has(f(w))) out.add(f(w));
  }
  return { options: shuffle([...out]), answer };
}
function choice(answer: string, wrong: string[]) {
  const out = [answer, ...shuffle([...new Set(wrong)].filter((w) => w !== answer)).slice(0, 3)];
  return { options: shuffle(out), answer };
}
const UNITS_K = ['mol dm⁻³ s⁻¹', 's⁻¹', 'dm³ mol⁻¹ s⁻¹', 'dm⁶ mol⁻² s⁻¹'];
/** (mol dm⁻³)^n written out, for Kc */
function kcUnit(dn: number) {
  if (dn === 0) return 'no units';
  if (dn === 1) return 'mol dm⁻³';
  if (dn === 2) return 'mol² dm⁻⁶';
  if (dn === -1) return 'dm³ mol⁻¹';
  if (dn === -2) return 'dm⁶ mol⁻²';
  return `(mol dm⁻³)^${dn}`;
}
const atmUnit = (dn: number) => (dn === 0 ? 'no units' : dn === 1 ? 'atm' : `atm${dn === -1 ? '⁻¹' : dn === -2 ? '⁻²' : dn === 2 ? '²' : `^${dn}`}`);

/* ---------- gas-phase equilibria used across topics ---------- */
interface Rx { eq: string; dH: number; gasL: number; gasR: number; kc: string; kp: string; dnKc: number; name: string }
const RXS: Rx[] = [
  { name: 'the Haber process', eq: 'N₂(g) + 3H₂(g) ⇌ 2NH₃(g)', dH: -92, gasL: 4, gasR: 2, kc: '[NH₃]² / [N₂][H₂]³', kp: 'p(NH₃)² / p(N₂) × p(H₂)³', dnKc: -2 },
  { name: 'the Contact process', eq: '2SO₂(g) + O₂(g) ⇌ 2SO₃(g)', dH: -197, gasL: 3, gasR: 2, kc: '[SO₃]² / [SO₂]²[O₂]', kp: 'p(SO₃)² / p(SO₂)² × p(O₂)', dnKc: -1 },
  { name: 'dinitrogen tetroxide', eq: 'N₂O₄(g) ⇌ 2NO₂(g)', dH: 57, gasL: 1, gasR: 2, kc: '[NO₂]² / [N₂O₄]', kp: 'p(NO₂)² / p(N₂O₄)', dnKc: 1 },
  { name: 'hydrogen iodide', eq: 'H₂(g) + I₂(g) ⇌ 2HI(g)', dH: -10, gasL: 2, gasR: 2, kc: '[HI]² / [H₂][I₂]', kp: 'p(HI)² / p(H₂) × p(I₂)', dnKc: 0 },
  { name: 'steam reforming', eq: 'CH₄(g) + H₂O(g) ⇌ CO(g) + 3H₂(g)', dH: 206, gasL: 2, gasR: 4, kc: '[CO][H₂]³ / [CH₄][H₂O]', kp: 'p(CO) × p(H₂)³ / p(CH₄) × p(H₂O)', dnKc: 2 },
  { name: 'methanol synthesis', eq: 'CO(g) + 2H₂(g) ⇌ CH₃OH(g)', dH: -91, gasL: 3, gasR: 1, kc: '[CH₃OH] / [CO][H₂]²', kp: 'p(CH₃OH) / p(CO) × p(H₂)²', dnKc: -2 },
];
/** the upside-down and wrong-power versions of an expression, as distractors */
function flips(e: string) {
  const [top, bot] = e.split(' / ');
  const strip = (x: string) => x.replace(/[²³]/g, '');
  return [`${bot} / ${top}`, `${strip(top)} / ${strip(bot)}`, `${strip(bot)} / ${strip(top)}`, `${top}${bot}`, `${top} − ${bot}`];
}

/* ---------- collision theory: 9.1, 9.2, 9.4 ---------- */
const COLLIDE: (() => Question)[] = [
  () => ({ topic: 'collide', prompt: 'Why does a small rise in temperature increase the rate of a reaction so much?', ...choice(
    'More molecules have energy greater than or equal to the activation energy, so a greater proportion of collisions are successful', [
      'The activation energy decreases as the temperature rises', 'The molecules collide more often, and that is the main reason',
      'There are more molecules in the container', 'The enthalpy change becomes more negative']),
    working: ['At a higher temperature the Maxwell–Boltzmann curve flattens and shifts to higher energy', 'The area to the right of Ea gets bigger: more molecules have E ≥ Ea', 'So more of the collisions lead to reaction each second'],
    why: 'Collision frequency rises a little too, but the big effect is the larger fraction of molecules with at least the activation energy.' }),
  () => { const f = pick([['concentration of a solution', 'per unit volume'], ['pressure of a gas', 'per unit volume'], ['surface area of a solid (powder instead of lumps)', 'exposed at the surface']] as const);
    return { topic: 'collide', prompt: `Increasing the ${f[0]} increases the rate of reaction. Which is the best explanation?`, ...choice(
      `There are more particles ${f[1]}, so there are more frequent collisions and more successful collisions per second`, [
        'More of the particles have energy greater than the activation energy', 'The activation energy is lowered',
        'Each collision has more energy', 'The particles move faster']),
      working: [`More particles ${f[1]} → collisions happen more often`, 'The fraction of collisions with E ≥ Ea is the same as before (the temperature has not changed)', 'So the number of successful collisions per second rises'],
      why: 'Only temperature changes the energy distribution. Concentration, pressure and surface area change how often particles collide.' }; },
  () => { const hot = pick(['T₁', 'T₂']), cold = hot === 'T₁' ? 'T₂' : 'T₁';
    return { topic: 'collide', prompt: 'The graph shows the Maxwell–Boltzmann distributions for the same gas at two temperatures. Which statement is correct?', ...choice(
      `${hot} is the higher temperature: its peak is lower and further to the right`, [
        `${cold} is the higher temperature: its peak is higher`, `${hot} is the higher temperature because the area under its curve is larger`,
        'The two curves are for different numbers of molecules', `${cold} is the higher temperature: its curve meets the energy axis sooner`]),
      working: ['At a higher temperature the molecules have a wider spread of energies', 'The peak (most likely energy) moves to the right and becomes lower', 'The area under each curve is the same: the same number of molecules'],
      why: 'A higher curve is not a hotter one: the curve spreads out, so its peak drops.',
      figure: { kind: 'mb', curves: hot === 'T₂' ? [{ T: 1, label: 'T₁' }, { T: 1.6, label: 'T₂' }] : [{ T: 1.6, label: 'T₁' }, { T: 1, label: 'T₂' }], ea: [{ E: 4.2, label: 'Ea' }] } }; },
  () => ({ topic: 'collide', prompt: 'What does the total area under a Maxwell–Boltzmann distribution curve represent?', ...choice('The total number of molecules in the sample', [
    'The total energy of the molecules', 'The number of molecules with the activation energy', 'The rate of the reaction', 'The average energy of the molecules']),
    working: ['The y-axis is the number (or fraction) of molecules with each energy', 'Adding them all up gives every molecule'], why: 'Changing the temperature does not change the area: the number of molecules stays the same.' }),
  () => ({ topic: 'collide', prompt: 'Which feature of a Maxwell–Boltzmann distribution is correct?', ...choice('It starts at the origin and never meets the energy axis at high energy', [
    'It is symmetrical about the most probable energy', 'It meets the energy axis at the maximum energy a molecule can have', 'It starts above the origin because some molecules have zero energy',
    'Its peak is at the mean energy']),
    working: ['No molecules have zero energy, so it starts at (0, 0)', 'There is no maximum energy, so the curve approaches the axis but never touches it', 'It is skewed: the mean energy is to the right of the peak'],
    why: 'Exam diagrams lose marks for curves that cross or touch the energy axis.' }),
  () => ({ topic: 'collide', prompt: 'What is meant by the activation energy of a reaction?', ...choice('The minimum energy that colliding particles must have for a reaction to occur', [
    'The energy given out when the reaction happens', 'The average energy of the reacting particles', 'The energy needed to break all the bonds in the reactants', 'The enthalpy change of the reaction']),
    working: ['Reactions only take place when collisions have sufficient energy', 'That threshold is the activation energy, Ea'], why: 'Collisions with less than Ea just bounce apart; the particles must also collide (in the right orientation).' }),
  () => ({ topic: 'collide', prompt: 'The shaded area on the graph is to the right of the activation energy. What does it represent?', ...choice('The number of molecules with enough energy to react on collision', [
    'The number of molecules that have already reacted', 'The activation energy', 'The number of collisions per second', 'The molecules with the most probable energy']),
    working: ['Molecules to the right of Ea have E ≥ Ea', 'Raising the temperature makes this area larger'], why: 'Compare this area for two curves to explain the effect of temperature on rate.',
    figure: { kind: 'mb', curves: [{ T: 1.2, label: '' }], ea: [{ E: 3.8, label: 'Ea' }], shade: 3.8 } }),
  () => ({ topic: 'collide', prompt: 'A block of marble is replaced by the same mass of marble chips, with the same acid. What happens?', ...choice('The rate is faster but the final volume of CO₂ is the same', [
    'The rate is faster and more CO₂ is made', 'The rate is the same but more CO₂ is made', 'The rate is slower because the chips have less mass each', 'The activation energy is lower so the rate is faster']),
    working: ['Chips have a larger surface area: more particles exposed, more frequent collisions with acid', 'The amounts of reactants are unchanged, so the same amount of CO₂ forms in the end'], why: 'Rate and amount of product are different things: the curve is steeper but levels off at the same volume.' }),
];

/* ---------- catalysts and profiles: 9.5–9.8, 11.11 ---------- */
const CATALYST: (() => Question)[] = [
  () => ({ topic: 'catalyst', prompt: 'How does a catalyst increase the rate of a reaction?', ...choice('It provides an alternative reaction route with a lower activation energy', [
    'It gives the reactant molecules more energy', 'It moves the Maxwell–Boltzmann curve to the right', 'It makes the enthalpy change more negative', 'It increases the number of collisions per second']),
    working: ['Same reactants, same products, different route (often via an intermediate)', 'Lower Ea → more molecules have E ≥ Ea at the same temperature'], why: 'The catalyst is regenerated at the end, so it is not used up.' }),
  () => ({ topic: 'catalyst', prompt: 'How is a catalyst shown on a Maxwell–Boltzmann distribution?', ...choice('The curve is unchanged; a second, lower Ea is marked, with a larger area to its right', [
    'The curve moves to the right and becomes lower', 'The curve moves to the left', 'The area under the curve increases', 'The Ea line moves to higher energy']),
    working: ['The temperature is the same, so the distribution of energies is the same', 'Ea(cat) is lower, so more molecules have E ≥ Ea(cat)'], why: 'Only a temperature change alters the curve itself.',
    figure: { kind: 'mb', curves: [{ T: 1.2, label: '' }], ea: [{ E: 4.4, label: 'Ea' }, { E: 2.6, label: 'Ea(cat)' }], shade: 2.6 } }),
  () => { const ea = ri(8, 20) * 10, dH = ri(2, Math.floor(ea / 10) - 2) * 10 * pick([1, -1]), rev = ea - dH;   // an endothermic ΔH stays below the peak
    return { topic: 'catalyst', prompt: `A reaction has an activation energy of ${ea} kJ mol⁻¹ and ΔH = ${neg(dH)} kJ mol⁻¹. What is the activation energy of the reverse reaction?`,
      ...opts(rev, [ea + dH, ea, Math.abs(dH)], 'kJ mol⁻¹', (x) => String(Math.round(x))),
      working: ['Ea(reverse) = Ea(forward) − ΔH(forward)', `= ${ea} − (${neg(dH)}) = ${rev} kJ mol⁻¹`], why: 'Draw the profile: the reverse reaction climbs from the products up to the same peak.',
      figure: { kind: 'profile', dH: dH / ea, ea: 1, marks: true } }; },
  () => ({ topic: 'catalyst', prompt: 'The profile shows a reaction with and without a catalyst. What does the dip between the two peaks on the catalysed route represent?', ...choice('An intermediate formed with the catalyst', [
    'The transition state', 'The products', 'The activation energy', 'The enthalpy change']),
    working: ['The catalysed route has two steps, each with its own (lower) peak', 'The species at the dip is an intermediate: it forms, then reacts on to give the products and regenerate the catalyst'],
    why: 'Peaks are transition states; dips are intermediates. ΔH is the same for both routes.', figure: { kind: 'profile', dH: -0.35, ea: 1, cat: 0.55 } }),
  () => ({ topic: 'catalyst', prompt: 'What effect does a catalyst have on the enthalpy change, ΔH, of a reaction?', ...choice('None: the reactants and products have the same energies', [
    'It makes ΔH more negative', 'It makes ΔH less negative', 'It reduces ΔH by the same amount it reduces Ea', 'It reverses the sign of ΔH']),
    working: ['ΔH depends only on the energies of the reactants and products', 'A catalyst changes the route between them, not the start or the end'], why: 'This is why a catalyst cannot change the position of an equilibrium either.' }),
  () => { const het = pick(['Iron in the Haber process', 'Vanadium(V) oxide in the Contact process', 'Nickel in the hydrogenation of alkenes', 'Platinum and rhodium in a catalytic converter']);
    return { topic: 'catalyst', prompt: 'Which of these is a heterogeneous catalyst?', ...choice(het, [
      'Sulfuric acid in the formation of an ester', 'Hydrogen ions in the iodination of propanone', 'Cobalt(II) ions in the reaction of tartrate ions with hydrogen peroxide', 'Iron(II) ions in the reaction of peroxodisulfate and iodide ions']),
      working: ['Heterogeneous: in a different phase from the reactants (usually a solid with gases or liquids)', 'Homogeneous: in the same phase (e.g. ions in aqueous solution with aqueous reactants)'],
      why: 'A solid catalyst in a gas-phase industrial reaction provides a surface for the reaction.' }; },
  () => ({ topic: 'catalyst', prompt: 'A solid catalyst speeds up a reaction between gases. In what order do the steps happen?', ...choice('Adsorption onto the surface, reaction (bonds weakened), desorption of the products', [
    'Desorption, reaction, adsorption', 'Absorption into the solid, reaction, release', 'Reaction in the gas phase, then adsorption of the products', 'Adsorption, then the catalyst is used up']),
    working: ['Reactant molecules adsorb onto the surface (weak bonds to the metal)', 'Bonds in the reactants weaken, and the molecules are held close together in a good orientation', 'Products desorb, freeing the surface again'],
    why: 'Adsorption is onto the surface, not absorption into the solid.' }),
  () => ({ topic: 'catalyst', prompt: 'Why does using a catalyst make an industrial process more sustainable?', ...choice('The process can run at a lower temperature, using less energy and burning less fossil fuel', [
    'The catalyst increases the equilibrium yield', 'The catalyst is used up so less waste is made', 'It makes the reaction more exothermic', 'It removes the need for any heating at all']),
    working: ['Lower Ea → an acceptable rate at a lower temperature', 'Less energy needed → less fuel burned and less CO₂ emitted', 'Catalysts can also allow routes with a higher atom economy (fewer by-products)'],
    why: 'A catalyst does not change the equilibrium yield, only how fast it is reached.' }),
  () => ({ topic: 'catalyst', prompt: 'Cobalt(II) chloride is added to a hot mixture of potassium sodium tartrate and hydrogen peroxide. The pink solution turns green as it fizzes, then pink again. What does this show?', ...choice('The catalyst takes part, forming an intermediate, and is regenerated at the end', [
    'The cobalt(II) ions are used up in the reaction', 'The reaction is endothermic', 'The cobalt ions are a heterogeneous catalyst', 'The tartrate is the catalyst']),
    working: ['Pink: Co²⁺(aq)', 'Green: an intermediate cobalt(III) complex, formed during the reaction', 'Pink again: Co²⁺ is regenerated once the reaction ends'], why: 'It is homogeneous catalysis: catalyst and reactants are all in solution.' }),
];

/* ---------- measuring rates: 9.3, 11.3, 11.4 ---------- */
const MEASURE: (() => Question)[] = [
  () => { const t = ri(16, 120);
    return { topic: 'measure', prompt: `In the reaction between sodium thiosulfate and hydrochloric acid, the cross is hidden after ${t} s. What is the rate, using rate = 1/time?`,
      ...opts(1 / t, [t, 60 / t, 1 / (t * 60)], 's⁻¹', (x) => sci(x, 3)),
      working: ['rate = 1/time', `= 1 ÷ ${t} = ${sci(1 / t)} s⁻¹`], why: 'The same amount of sulfur must form to hide the cross each time, so rate ∝ 1/time.' }; },
  () => { const X = ri(4, 12) * 10, Y = ri(3, 14) * 5, r = Y / X;
    return { topic: 'measure', prompt: 'The graph shows the volume of gas against time. A tangent has been drawn at t = 0. What is the initial rate?',
      ...opts(r, [X / Y, Y, r * 2], 'cm³ s⁻¹', p3),
      working: [`gradient of the tangent = rise ÷ run = ${Y} cm³ ÷ ${X} s`, `= ${p3(r)} cm³ s⁻¹`], why: 'Draw the tangent long, read two points far apart on it, and use their differences.',
      figure: { kind: 'tangent', X, Y, xl: 'time / s', yl: 'volume / cm³', at: 0 } }; },
  () => { const V = ri(4, 18) * 5, t = ri(3, 12) * 10, mol = V / 24000;
    return { topic: 'measure', prompt: `Marble chips react with acid. ${V} cm³ of CO₂ (measured at room temperature and pressure) is collected in the first ${t} s. What is the mean rate of production of CO₂ in mol s⁻¹? (Molar volume 24.0 dm³ mol⁻¹)`,
      ...opts(mol / t, [V / t, V / 24 / t, mol * t], 'mol s⁻¹', (x) => sci(x)), working: [`n(CO₂) = ${V} ÷ 24 000 = ${sci(mol)} mol`, `mean rate = ${sci(mol)} ÷ ${t} = ${sci(mol / t)} mol s⁻¹`],
      why: 'Convert cm³ to moles with 24 000 cm³ mol⁻¹, not 24.' }; },
  () => { const r = pick([
      ['CH₃COCH₃(aq) + I₂(aq) → CH₃COCH₂I(aq) + HI(aq)', 'Colorimetry, because iodine is the only coloured species'],
      ['Mg(s) + 2HCl(aq) → MgCl₂(aq) + H₂(g)', 'Measuring the volume of hydrogen with a gas syringe'],
      ['CaCO₃(s) + 2HCl(aq) → CaCl₂(aq) + H₂O(l) + CO₂(g)', 'Measuring the loss in mass as carbon dioxide escapes'],
      ['Br₂(aq) + HCOOH(aq) → 2HBr(aq) + CO₂(g)', 'Colorimetry, as the orange bromine is used up'],
      ['(CH₃)₃CBr + H₂O → (CH₃)₃COH + H⁺ + Br⁻', 'Taking samples, quenching and titrating the acid formed'],
    ] as const);
    return { topic: 'measure', prompt: `Which is the most suitable way to follow the rate of this reaction?\n${r[0]}`, ...choice(r[1], [
      'Colorimetry, because iodine is the only coloured species', 'Measuring the volume of hydrogen with a gas syringe', 'Measuring the loss in mass as carbon dioxide escapes',
      'Colorimetry, as the orange bromine is used up', 'Taking samples, quenching and titrating the acid formed', 'Measuring the loss in mass as hydrogen escapes'].filter((x) => x !== r[1])),
      working: ['Look for something that changes measurably as the reaction goes: a coloured species, a gas, or an acid or alkali', 'Mass loss suits a dense gas such as CO₂; hydrogen is too light to weigh accurately'],
      why: 'Choose and justify: say which species changes and why the method can detect it.' }; },
  () => ({ topic: 'measure', prompt: 'In a titration method for following a reaction, samples are added to ice-cold water or to sodium hydrogencarbonate solution before titrating. Why?', ...choice('To quench the reaction, so the concentration is fixed at the moment the sample was taken', [
    'To act as an indicator', 'To make the titration end point sharper', 'To increase the rate so the titration is quicker', 'To dissolve the product']),
    working: ['Cooling and diluting slows the reaction greatly; NaHCO₃ removes an acid catalyst', 'The titre then measures the amount present at that time'], why: 'Without quenching the reaction carries on while you titrate.' }),
  () => ({ topic: 'measure', prompt: 'Why is measuring the loss in mass a poor way to follow the reaction of magnesium with hydrochloric acid?', ...choice('Hydrogen has such a small mass that the change is too small to measure accurately', [
    'Hydrogen dissolves in the acid', 'The magnesium gains mass', 'The reaction is too fast', 'The balance would react with the acid']),
    working: ['0.0010 mol of H₂ is only 0.002 g', 'The same amount of CO₂ would be 0.044 g, 22 times more'], why: 'Collect the hydrogen in a gas syringe instead.' }),
  () => ({ topic: 'measure', prompt: 'Which describes a continuous monitoring method?', ...choice('Following one reaction mixture over time to plot a concentration–time (or volume–time) graph', [
    'Running separate experiments with different starting concentrations and measuring each initial rate', 'Timing how long a clock reaction takes', 'Measuring only the final amount of product', 'Repeating the experiment at different temperatures']),
    working: ['Continuous monitoring: one run, many readings over time', 'Initial-rate method: many runs, each with different starting concentrations; a clock reaction approximates it'],
    why: 'Both appear in the spec; know which graph each gives.' }),
];

/* ---------- orders and rate equations: 11.1, 11.2, 11.5 ---------- */
const ORDERS: (() => Question)[] = [
  () => { const m = pick([0, 1, 2] as const), f = pick([2, 3]), r1 = ri(12, 60) / 10;
    const rows = [['1', '0.10', '0.10', `${p2(r1)} × 10⁻⁴`], ['2', `${p2(0.1 * f)}`, '0.10', `${p3(r1 * f ** m)} × 10⁻⁴`]];
    return { topic: 'orders', prompt: `The initial rates of A + B → products were measured. [B] was kept the same. What is the order with respect to A?`,
      ...choice(String(m), ['0', '1', '2', '3']), working: [`[A] × ${f} while [B] is constant`, `rate × ${p3(f ** m)} = ${f}^${m}`, `so the order in A is ${m}`],
      why: 'Order = the power: ×2 conc gives ×1 (0), ×2 (1) or ×4 (2) rate.', figure: { kind: 'table', head: ['Exp', '[A] / mol dm⁻³', '[B] / mol dm⁻³', 'rate / mol dm⁻³ s⁻¹'], rows } }; },
  () => { const a = pick([0, 1, 2]), b = pick([0, 1, 2]), n = a + b, A = ri(1, 9) / 100 + 0.01, B = ri(1, 9) / 100 + 0.01, k = ri(11, 99) / 10 * 10 ** -ri(0, 3);
    const rate = k * A ** a * B ** b;
    const eq = `rate = k${a ? `[A]${a === 2 ? '²' : ''}` : ''}${b ? `[B]${b === 2 ? '²' : ''}` : ''}${!a && !b ? '' : ''}`;
    const unit = n <= 3 ? UNITS_K[n] : '';
    return { topic: 'orders', prompt: `For the reaction A + B → C, ${eq}. When [A] = ${p3(A)} mol dm⁻³ and [B] = ${p3(B)} mol dm⁻³, the rate is ${sci(rate)} mol dm⁻³ s⁻¹. What is k?`,
      ...opts(k, [rate * A ** a * B ** b, rate / (A * B), rate * A], unit, (x) => sci(x)),
      working: [`k = rate ÷ ${a ? `[A]${a === 2 ? '²' : ''}` : ''}${b ? `[B]${b === 2 ? '²' : ''}` : ''}${!a && !b ? '1' : ''}`, `= ${sci(rate)} ÷ ${sci(A ** a * B ** b)} = ${sci(k)} ${unit}`, `overall order ${n}, so the units are ${unit}`],
      why: 'Rearrange first, then work out the units from (mol dm⁻³ s⁻¹) ÷ (mol dm⁻³)ⁿ.' }; },
  () => { const n = ri(0, 3); const eqs = ['rate = k', 'rate = k[A]', pick(['rate = k[A]²', 'rate = k[A][B]']), pick(['rate = k[A]²[B]', 'rate = k[A][B]²'])];
    return { topic: 'orders', prompt: `What are the units of the rate constant k for ${eqs[n]}?`, ...choice(UNITS_K[n], [...UNITS_K, 'mol⁻¹ dm³ s']),
      working: ['k = rate ÷ (concentration terms)', `units = mol dm⁻³ s⁻¹ ÷ (mol dm⁻³)^${n}`, `= ${UNITS_K[n]}`], why: 'Overall order 0 → mol dm⁻³ s⁻¹, 1 → s⁻¹, 2 → dm³ mol⁻¹ s⁻¹, 3 → dm⁶ mol⁻² s⁻¹.' }; },
  () => { const fa = pick([2, 3, 0.5]), fb = pick([2, 3, 0.5]), a = pick([1, 2]), b = pick([0, 1, 2]), x = fa ** a * fb ** b;
    const eq = `rate = k[A]${a === 2 ? '²' : ''}${b ? `[B]${b === 2 ? '²' : ''}` : ''}`;
    const w = (f: number) => (f === 0.5 ? 'halved' : f === 2 ? 'doubled' : 'tripled');
    return { topic: 'orders', prompt: `For ${eq}, [A] is ${w(fa)} and [B] is ${w(fb)}. By what factor does the rate change?`,
      ...opts(x, [fa * fb, fa ** a, fa * a + fb * b], '', (v) => `× ${p3(v)}`),
      working: [`factor = ${fa}^${a} × ${fb}^${b}`, `= ${p3(x)}`], why: b === 0 ? 'B is zero order: changing [B] has no effect on the rate.' : 'Raise each factor to its own order, then multiply.' }; },
  () => { const ord = pick([0, 1, 2] as const), what = ['zero', 'first', 'second'][ord];
    return { topic: 'orders', prompt: 'The graph shows how the concentration of a reactant changes with time. What is the order with respect to this reactant?', ...choice(what, ['zero', 'first', 'second', 'third']),
      working: ord === 0 ? ['A straight line with a constant (negative) gradient', 'The rate does not change as the concentration falls: zero order'] : ord === 1 ? ['A curve with a constant half-life', 'Constant half-life → first order'] : ['A curve whose half-lives get longer (each one double the last)', 'Increasing half-life → second order'],
      why: 'Check the half-life: constant means first order.', figure: { kind: 'ct', order: ord, halves: ord !== 0, yl: '[A]', xl: 'time' } }; },
  () => { const ord = pick([0, 1, 2] as const), what = ['zero', 'first', 'second'][ord];
    return { topic: 'orders', prompt: 'The graph shows how the initial rate depends on the concentration of a reactant. What is the order with respect to it?', ...choice(what, ['zero', 'first', 'second', 'third']),
      working: [ord === 0 ? 'A horizontal line: the rate does not depend on the concentration' : ord === 1 ? 'A straight line through the origin: rate ∝ [A]' : 'A curve through the origin getting steeper: rate ∝ [A]²'],
      why: 'For second order, a graph of rate against [A]² would be a straight line through the origin.', figure: { kind: 'rc', order: ord } }; },
  () => { const t = ri(2, 9) * 10, n = ri(2, 4), c0 = ri(2, 8) / 10, c = c0 / 2 ** n;
    return { topic: 'orders', prompt: `A first-order reaction has a half-life of ${t} s. The starting concentration is ${p2(c0)} mol dm⁻³. What is the concentration after ${n * t} s?`,
      ...opts(c, [c0 / (2 * n), c0 / 2, c0 / 2 ** (n + 1)], 'mol dm⁻³', (x) => sci(x)),
      working: [`${n * t} s is ${n} half-lives`, `c = ${p2(c0)} × (½)^${n} = ${sci(c)} mol dm⁻³`], why: 'Each half-life halves what is left; it does not take away the same amount each time.' }; },
  () => ({ topic: 'orders', prompt: 'Which change alters the value of the rate constant, k?', ...choice('Raising the temperature', ['Doubling the concentration of a reactant', 'Increasing the pressure of a gas reactant', 'Using smaller particles of a solid', 'Doubling the volume of the mixture']),
    working: ['k = A e^(−Ea/RT): it depends on temperature (and on Ea, so a catalyst changes it too)', 'Concentration changes the rate, not k'], why: 'Rate = k[A]ᵐ[B]ⁿ: concentration changes act through the brackets, not k.' }),
  () => { const a = pick([0, 1, 2]), b = pick([1, 2]);
    return { topic: 'orders', prompt: `What is the overall order of rate = k[X]${a === 0 ? '⁰' : a === 2 ? '²' : ''}[Y]${b === 2 ? '²' : ''}?`, ...choice(String(a + b), ['1', '2', '3', '4', '0']),
      working: [`overall order = sum of the orders = ${a} + ${b} = ${a + b}`], why: 'Orders come from experiment, not from the balanced equation.' }; },
];

/* ---------- mechanisms: 11.6–11.9 ---------- */
const MECH: (() => Question)[] = [
  () => ({ topic: 'mech', prompt: 'For the acid-catalysed iodination of propanone, rate = k[CH₃COCH₃][H⁺]. What can be deduced?', ...choice('Iodine is not involved in the rate-determining step', [
    'Iodine is involved in the rate-determining step', 'H⁺ is used up in the overall reaction', 'The reaction is zero order overall', 'The mechanism has only one step']),
    working: ['Zero order in I₂: iodine reacts only in a fast step after the slow step', 'Propanone and H⁺ appear in the rate equation, so they are in (or before) the slow step', 'H⁺ is a catalyst: it appears in the rate equation but is regenerated'],
    why: 'The rate equation tells you which species take part in, or before, the rate-determining step.' }),
  () => { const m = pick([
      ['2NO₂(g) + F₂(g) → 2NO₂F(g)', 'rate = k[NO₂][F₂]', 'NO₂ + F₂ → NO₂F + F (slow), then NO₂ + F → NO₂F (fast)', ['2NO₂ + F₂ → 2NO₂F in one step', 'NO₂ + NO₂ → N₂O₄ (slow), then N₂O₄ + F₂ → 2NO₂F (fast)', 'F₂ → 2F (slow), then 2NO₂ + 2F → 2NO₂F (fast)']],
      ['NO₂(g) + CO(g) → NO(g) + CO₂(g)', 'rate = k[NO₂]²', 'NO₂ + NO₂ → NO₃ + NO (slow), then NO₃ + CO → NO₂ + CO₂ (fast)', ['NO₂ + CO → NO + CO₂ in one step', 'NO₂ + CO → NO + CO₂ (slow)', 'CO + NO₂ → CO₂ + NO (fast), then NO₂ → NO + O (slow)']],
      ['H₂O₂ + 2I⁻ + 2H⁺ → I₂ + 2H₂O', 'rate = k[H₂O₂][I⁻]', 'H₂O₂ + I⁻ → IO⁻ + H₂O (slow), then IO⁻ + I⁻ + 2H⁺ → I₂ + H₂O (fast)', ['H₂O₂ + 2I⁻ + 2H⁺ → I₂ + 2H₂O in one step', 'I⁻ + H⁺ → HI (slow), then 2HI + H₂O₂ → I₂ + 2H₂O (fast)', 'H₂O₂ + 2H⁺ → … (slow), then fast steps with I⁻']],
    ] as const);
    return { topic: 'mech', prompt: `The overall equation is ${m[0]} and ${m[1]}. Which mechanism is consistent with this?`, ...choice(m[2], [...m[3]]),
      working: ['The species in the rate equation (with their orders) must be the reactants of the slow step, or of steps before it', 'The steps must add up to the overall equation'],
      why: 'A one-step mechanism would need the rate equation to match the whole balanced equation, which it does not.' }; },
  () => { const s = pick([['A + B → C (slow)', 'C + B → D (fast)', 'rate = k[A][B]'], ['2A → A₂ (slow)', 'A₂ + B → P (fast)', 'rate = k[A]²'], ['A → X (slow)', 'X + 2B → P (fast)', 'rate = k[A]']] as const);
    return { topic: 'mech', prompt: `A reaction has this mechanism. Step 1: ${s[0]}. Step 2: ${s[1]}. What is the rate equation?`, ...choice(s[2], ['rate = k[A][B]', 'rate = k[A]²', 'rate = k[A]', 'rate = k[A][B]²', 'rate = k[B]']),
      working: ['The slow step is the rate-determining step', `Its reactants (with their numbers) give the rate equation: ${s[2]}`], why: 'Fast steps after the slow step do not appear in the rate equation.' }; },
  () => { const tert = Math.random() < 0.5;
    return { topic: 'mech', prompt: tert ? 'What is the rate equation for the hydrolysis of 2-bromo-2-methylpropane, (CH₃)₃CBr, by hydroxide ions?' : 'What is the rate equation for the hydrolysis of 1-bromobutane by hydroxide ions?',
      ...choice(tert ? 'rate = k[(CH₃)₃CBr]' : 'rate = k[CH₃CH₂CH₂CH₂Br][OH⁻]', ['rate = k[(CH₃)₃CBr]', 'rate = k[(CH₃)₃CBr][OH⁻]', 'rate = k[CH₃CH₂CH₂CH₂Br][OH⁻]', 'rate = k[CH₃CH₂CH₂CH₂Br]', 'rate = k[OH⁻]']),
      working: tert ? ['Tertiary: SN1', 'Slow step: C–Br breaks heterolytically to give a tertiary carbocation', 'OH⁻ attacks in a fast step, so it is not in the rate equation'] : ['Primary: SN2', 'One step: OH⁻ attacks the δ+ carbon as Br⁻ leaves', 'Both species are in the rate-determining step'],
      why: 'The different rate equations are the evidence for the two mechanisms.' }; },
  () => ({ topic: 'mech', prompt: 'Why do tertiary halogenoalkanes react by SN1 rather than SN2?', ...choice('The tertiary carbocation is stabilised by three alkyl groups, and the bulky groups hinder attack from the back', [
    'Tertiary halogenoalkanes have stronger C–Br bonds', 'Hydroxide ions cannot react with tertiary compounds', 'Tertiary halogenoalkanes are not polar', 'SN1 has a higher activation energy']),
    working: ['Alkyl groups push electron density towards the positive carbon (positive inductive effect)', 'Three methyl groups crowd the carbon, blocking the backside attack SN2 needs'], why: 'Primary halogenoalkanes give an unstable primary carbocation, so they react by SN2.' }),
  () => ({ topic: 'mech', prompt: 'Rate = k[A]²[B]. How many particles of A and of B are involved in, or before, the rate-determining step?', ...choice('Two of A and one of B', ['One of A and two of B', 'One of A and one of B', 'Two of A and none of B', 'It cannot be told from the rate equation']),
    working: ['The order with respect to each species equals the number of its particles in (or before) the slow step'], why: 'Use this both ways: rate equation → slow step, and slow step → rate equation.' }),
  () => ({ topic: 'mech', prompt: 'H⁺ appears in the rate equation for the iodination of propanone but not in the overall equation. Why?', ...choice('H⁺ is a catalyst: it takes part in the rate-determining step and is regenerated later', [
    'H⁺ is a product', 'H⁺ is an intermediate', 'H⁺ is a spectator ion', 'The overall equation is wrong']),
    working: ['CH₃COCH₃ + I₂ → CH₃COCH₂I + HI (H⁺ catalyst)', 'H⁺ protonates propanone in the slow step and is released again'], why: 'A species can be in the rate equation without being in the overall equation, if it is a catalyst.' }),
];

/* ---------- activation energy and core practicals: 11.10, 11.12, 11.13 ---------- */
const ARRH: (() => Question)[] = [
  () => { const g = ri(40, 110) * 100, Ea = (g * R) / 1000;
    return { topic: 'arrhenius', prompt: `A graph of ln k against 1/T is a straight line with gradient −${g.toLocaleString('en-GB')} K. What is the activation energy? (R = 8.31 J mol⁻¹ K⁻¹)`,
      ...opts(Ea, [g * R, g / R, g / R / 1000], 'kJ mol⁻¹', p3),
      working: ['ln k = −Ea/R × 1/T + ln A', 'gradient = −Ea/R', `Ea = ${g.toLocaleString('en-GB')} × 8.31 = ${p3(g * R)} J mol⁻¹ = ${p3(Ea)} kJ mol⁻¹`],
      why: 'Divide by 1000 to get kJ, and keep the sign right: Ea is positive.', figure: { kind: 'arrh', pts: [[3.1, -2], [3.2, -2 - 0.1 * g / 1000], [3.3, -2 - 0.2 * g / 1000], [3.4, -2 - 0.3 * g / 1000]], xl: '1/T / 10⁻³ K⁻¹', yl: 'ln k' } }; },
  () => { const Ea0 = ri(40, 90) * 1000, T1 = ri(290, 300), T2 = T1 + pick([10, 15, 20]), t2 = Number((100 / Math.exp((Ea0 / R) * (1 / T1 - 1 / T2))).toPrecision(3));
    const ratio = 100 / t2, Ea = (R * Math.log(ratio)) / (1 / T1 - 1 / T2);   // from the rounded time the student sees
    return { topic: 'arrhenius', prompt: `A clock reaction takes ${p3(100)} s at ${T1 - 273} °C and ${t2} s at ${T2 - 273} °C. Rate ∝ 1/t. What is the activation energy? (R = 8.31 J mol⁻¹ K⁻¹; T/K = θ/°C + 273)`,
      ...opts(Ea / 1000, [(R * Math.log(ratio)) / (1 / (T1 - 273) - 1 / (T2 - 273)) / 1000, Ea, (Ea / 1000) * 2.303], 'kJ mol⁻¹', p2),
      working: ['ln(k₂/k₁) = (Ea/R)(1/T₁ − 1/T₂), and k ∝ 1/t', `ln(${p3(ratio)}) = ${p3(Math.log(ratio))}`, `1/${T1} − 1/${T2} = ${sci(1 / T1 - 1 / T2)} K⁻¹`, `Ea = 8.31 × ${p3(Math.log(ratio))} ÷ ${sci(1 / T1 - 1 / T2)} = ${p2(Ea / 1000)} kJ mol⁻¹`],
      why: 'Temperatures must be in kelvin; using °C gives nonsense.' }; },
  () => ({ topic: 'arrhenius', prompt: 'To find the activation energy from the Arrhenius equation, which graph should be plotted?', ...choice('ln k (or ln 1/t) against 1/T', ['k against T', 'ln k against T', '1/k against 1/T', 'k against 1/T']),
    working: ['ln k = −Ea/R × (1/T) + ln A has the form y = mx + c', 'Gradient = −Ea/R; intercept = ln A'], why: 'In a clock reaction, k ∝ 1/t, so ln(1/t) can replace ln k: the gradient is the same.' }),
  () => ({ topic: 'arrhenius', prompt: 'In Core Practical 9a, samples of the propanone–iodine mixture are run into sodium hydrogencarbonate solution before titrating with sodium thiosulfate. Why?', ...choice('It neutralises the acid catalyst, stopping the reaction', [
    'It reacts with the iodine', 'It is the indicator', 'It reacts with the propanone', 'It speeds up the titration']),
    working: ['The reaction is acid-catalysed: without H⁺ it effectively stops', 'The remaining I₂ is then titrated with thiosulfate, using starch near the end point'], why: 'This is quenching: it freezes the composition at the moment of sampling.' }),
  () => ({ topic: 'arrhenius', prompt: 'In Core Practical 9a, a graph of titre against time is a straight line sloping down. What does this show?', ...choice('The reaction is zero order with respect to iodine', [
    'The reaction is first order with respect to iodine', 'The reaction is second order with respect to iodine', 'Iodine is a catalyst', 'The reaction has stopped']),
    working: ['Titre ∝ [I₂] remaining', 'A constant gradient means the rate does not change as [I₂] falls → zero order'], why: 'Propanone and acid are in large excess, so their concentrations hardly change.' }),
  () => ({ topic: 'arrhenius', prompt: 'In an iodine clock reaction, a small fixed amount of sodium thiosulfate is added with starch. Why?', ...choice('It removes iodine as it forms; the blue-black colour appears only when it is used up, after the same amount of reaction each time', [
    'It is the catalyst', 'It makes the blue-black colour darker', 'It stops the reaction at a fixed time', 'It keeps the pH constant']),
    working: ['2S₂O₃²⁻ + I₂ → 2I⁻ + S₄O₆²⁻', 'Once the thiosulfate is gone, free I₂ meets the starch: sudden blue-black', 'The same amount of I₂ has formed each time, so rate ∝ 1/t'], why: 'This is why the clock time gives a measure of the initial rate.' }),
  () => ({ topic: 'arrhenius', prompt: 'In a clock-reaction investigation of the order with respect to iodide ions, water is added so the total volume is the same each time. Why?', ...choice('So the iodide concentration is proportional to its volume and the other concentrations stay the same', [
    'To keep the temperature constant', 'To dilute the starch', 'To slow the reaction down', 'So the colour is easier to see']),
    working: ['Only one concentration should change between runs', 'With constant total volume, [I⁻] ∝ volume of KI solution used'], why: 'This is the initial-rate method: change one variable at a time.' }),
];

/* ---------- equilibrium and Le Chatelier: 9.9, 9.10, 13.4, 13.5, 13.7 ---------- */
const EQUIL: (() => Question)[] = [
  () => ({ topic: 'equil', prompt: 'Which statement about a system in dynamic equilibrium is correct?', ...choice('The forward and backward reactions continue at equal rates, so the concentrations stay constant', [
    'Both reactions have stopped', 'The concentrations of reactants and products are equal', 'The forward reaction is faster than the backward reaction', 'Only the forward reaction continues']),
    working: ['Dynamic: both reactions keep going', 'Equal rates → no overall change in concentrations (in a closed system)'], why: 'Constant concentrations does not mean equal concentrations.' }),
  () => { const r = pick(RXS), up = Math.random() < 0.5, exo = r.dH < 0;
    const dir = up === exo ? 'to the left' : 'to the right';
    return { topic: 'equil', prompt: `${r.eq}   ΔH = ${neg(r.dH)} kJ mol⁻¹\nThe temperature is ${up ? 'raised' : 'lowered'}. What happens to the position of equilibrium?`,
      ...choice(`It shifts ${dir}`, ['It shifts to the left', 'It shifts to the right', 'It does not change', 'It shifts to the side with fewer moles of gas']),
      working: [`The forward reaction is ${exo ? 'exothermic' : 'endothermic'}`, up ? 'Raising T favours the endothermic direction' : 'Lowering T favours the exothermic direction', `So the position shifts ${dir}`, `K ${up === exo ? 'decreases' : 'increases'}`],
      why: 'Temperature is the only change that alters K; the position moves because K has changed.' }; },
  () => { const r = pick(RXS), up = Math.random() < 0.5;
    const ans = r.gasL === r.gasR ? 'No change' : (up ? (r.gasL > r.gasR ? 'Shifts to the right' : 'Shifts to the left') : (r.gasL > r.gasR ? 'Shifts to the left' : 'Shifts to the right'));
    return { topic: 'equil', prompt: `${r.eq}\nThe pressure is ${up ? 'increased' : 'decreased'} at constant temperature. What happens to the position of equilibrium?`,
      ...choice(ans, ['Shifts to the right', 'Shifts to the left', 'No change', 'Shifts in the exothermic direction']),
      working: [`Moles of gas: ${r.gasL} on the left, ${r.gasR} on the right`, r.gasL === r.gasR ? 'Equal moles of gas: pressure has no effect on the position' : `${up ? 'Higher' : 'Lower'} pressure favours the side with ${up ? 'fewer' : 'more'} moles of gas`, 'K is unchanged'],
      why: 'Count only gas moles, and remember that K does not change with pressure.' }; },
  () => ({ topic: 'equil', prompt: 'What is the effect of adding a catalyst to a reversible reaction?', ...choice('Equilibrium is reached faster, but its position and K are unchanged', [
    'The equilibrium shifts to the right', 'The equilibrium yield of product increases', 'K increases', 'Only the forward reaction speeds up']),
    working: ['A catalyst lowers Ea for the forward and backward reactions alike', 'Both rates increase by the same factor'], why: 'So industry uses catalysts for rate, never for yield.' }),
  () => ({ topic: 'equil', prompt: 'A sealed syringe contains brown NO₂ in equilibrium with colourless N₂O₄: 2NO₂ ⇌ N₂O₄. The plunger is pushed in quickly. What is seen?', ...choice('The gas gets darker at once, then slowly becomes paler', [
    'The gas gets paler at once, then darker', 'The gas gets darker and stays darker', 'There is no change in colour', 'The gas becomes colourless']),
    working: ['Same NO₂ in a smaller volume: higher concentration → darker at once', 'Higher pressure favours fewer gas moles: 2NO₂ → N₂O₄, so it fades', 'It ends a little darker than at first, as [NO₂] is still higher than before'],
    why: 'Separate the instant concentration effect from the shift in position.' }),
  () => ({ topic: 'equil', prompt: 'Heating a sealed tube of the brown NO₂ / colourless N₂O₄ equilibrium makes it darker. What does this show about N₂O₄ ⇌ 2NO₂?', ...choice('The forward reaction is endothermic', [
    'The forward reaction is exothermic', 'Pressure has decreased', 'K for N₂O₄ ⇌ 2NO₂ decreases as it is heated', 'The reaction has stopped']),
    working: ['Darker → more NO₂ → the equilibrium shifted to the right', 'Heating favours the endothermic direction', 'So N₂O₄ → 2NO₂ is endothermic, and K increases with temperature'], why: 'Equivalently, 2NO₂ → N₂O₄ is exothermic (bonds form).' }),
  () => { const chg = pick(['adding more of a reactant', 'increasing the pressure', 'adding a catalyst', 'removing some product']);
    return { topic: 'equil', prompt: `What happens to the value of Kc when the system is disturbed by ${chg} at constant temperature?`, ...choice('It stays the same', ['It increases', 'It decreases', 'It depends on whether the reaction is exothermic', 'It becomes zero']),
      working: ['Only temperature changes K', 'Concentration or pressure changes alter the quotient; the system changes composition until the quotient equals K again'], why: 'This is how 13.5 and 13.7 fit together: K is fixed at a given temperature.' }; },
  () => ({ topic: 'equil', prompt: 'Explain, in terms of K, why raising the temperature lowers the yield of an exothermic reaction at equilibrium.', ...choice('K decreases, so the products term must fall until the quotient equals the new, smaller K', [
    'The rate of the forward reaction decreases', 'K increases, so the reactants increase', 'The pressure increases, which pushes the equilibrium back', 'The activation energy increases']),
    working: ['For an exothermic reaction K falls as T rises', 'At the old composition the quotient is now bigger than K', 'Products react back until the quotient = K'], why: 'The spec wants the temperature effect explained through K.' }),
  () => ({ topic: 'equil', prompt: 'ICl(l) + Cl₂(g) ⇌ ICl₃(s). Brown liquid ICl is in equilibrium with yellow solid ICl₃ in a U-tube. More chlorine is passed in. What is seen?', ...choice('More yellow solid forms and the brown liquid decreases', [
    'The yellow solid turns into brown liquid', 'No change, as solids are not in the equilibrium', 'The mixture turns colourless', 'Purple iodine vapour forms']),
    working: ['Adding Cl₂ increases its concentration', 'The equilibrium shifts right to remove some of it: more ICl₃(s)'], why: 'Removing chlorine (inverting the tube) shifts it back to the left.' }),
];

/* ---------- Kc and Kp: 13.1–13.3, 13.9 ---------- */
const KCALC: (() => Question)[] = [
  () => { const r = pick(RXS);
    return { topic: 'k', prompt: `What is the expression for Kc for ${r.eq}?`, ...choice(`Kc = ${r.kc}`, flips(r.kc).map((x) => `Kc = ${x}`)),
      working: ['Kc = [products]^coefficients ÷ [reactants]^coefficients', `Kc = ${r.kc}`], why: 'Products on top, each raised to its coefficient in the balanced equation.' }; },
  () => { const r = pick(RXS);
    return { topic: 'k', prompt: `What are the units of Kc for ${r.eq}?`, ...choice(kcUnit(r.dnKc), ['no units', 'mol dm⁻³', 'dm³ mol⁻¹', 'dm⁶ mol⁻²', 'mol² dm⁻⁶']),
      working: [`Kc = ${r.kc}`, `Cancel (mol dm⁻³) terms: ${r.gasR} on top, ${r.gasL} below`, `units = (mol dm⁻³)^${r.dnKc} = ${kcUnit(r.dnKc)}`], why: 'Write out the units for each term and cancel; never just copy a unit.' }; },
  () => { const r = pick(RXS);
    return { topic: 'k', prompt: `What are the units of Kp for ${r.eq}, with partial pressures in atm?`, ...choice(atmUnit(r.dnKc), ['no units', 'atm', 'atm⁻¹', 'atm⁻²', 'atm²']),
      working: [`Kp = ${r.kp}`, `units = atm^(${r.gasR} − ${r.gasL}) = ${atmUnit(r.dnKc)}`], why: 'Same cancelling as for Kc, with atm instead of mol dm⁻³.' }; },
  () => { const s = pick([
      ['CaCO₃(s) ⇌ CaO(s) + CO₂(g)', 'Kp = p(CO₂)', ['Kp = p(CaO) × p(CO₂) / p(CaCO₃)', 'Kp = 1 / p(CO₂)', 'Kp = p(CaCO₃) / p(CO₂)']],
      ['Fe²⁺(aq) + Ag⁺(aq) ⇌ Fe³⁺(aq) + Ag(s)', 'Kc = [Fe³⁺] / [Fe²⁺][Ag⁺]', ['Kc = [Fe³⁺][Ag] / [Fe²⁺][Ag⁺]', 'Kc = [Fe²⁺][Ag⁺] / [Fe³⁺]', 'Kc = [Fe³⁺] / [Fe²⁺]']],
      ['NH₄Cl(s) ⇌ NH₃(g) + HCl(g)', 'Kp = p(NH₃) × p(HCl)', ['Kp = p(NH₃) × p(HCl) / p(NH₄Cl)', 'Kp = p(NH₄Cl) / p(NH₃) × p(HCl)', 'Kp = p(NH₃) + p(HCl)']],
      ['C(s) + H₂O(g) ⇌ CO(g) + H₂(g)', 'Kp = p(CO) × p(H₂) / p(H₂O)', ['Kp = p(CO) × p(H₂) / p(C) × p(H₂O)', 'Kp = p(H₂O) / p(CO) × p(H₂)', 'Kp = p(CO) × p(H₂)']],
    ] as const);
    return { topic: 'k', prompt: `This is a heterogeneous equilibrium: ${s[0]}. What is the correct expression?`, ...choice(s[1], [...s[2]]),
      working: ['Pure solids (and pure liquids) have a constant concentration, so they are left out', `${s[1]}`], why: 'Only species whose concentration (or partial pressure) can change appear in K.' }; },
  () => { const a0 = ri(5, 20) / 10, b0 = a0, x = Number((a0 * (ri(60, 72) / 100)).toPrecision(2)), a = Number((a0 - x).toFixed(2)), K = (x * x) / (a * a);   // K near the real value, about 4
    return { topic: 'k', prompt: `${p2(a0)} mol of ethanoic acid and ${p2(b0)} mol of ethanol are mixed with a little acid catalyst and left to reach equilibrium. ${p2(x)} mol of ethyl ethanoate is present at equilibrium.\nCH₃COOH + C₂H₅OH ⇌ CH₃COOC₂H₅ + H₂O. What is Kc?`,
      ...opts(K, [x / a, (x * x) / (a0 * a0), (a * a) / (x * x)], '', p3),
      working: [`At equilibrium: ester = water = ${p2(x)} mol; acid = alcohol = ${p2(a0)} − ${p2(x)} = ${p2(a)} mol`, 'The volume cancels (2 moles top and bottom)', `Kc = (${p2(x)} × ${p2(x)}) ÷ (${p2(a)} × ${p2(a)}) = ${p3(K)} (no units)`],
      why: 'Use equilibrium amounts, not the starting amounts. Water here is a product in the same liquid mixture, so it is included.',
      figure: { kind: 'table', head: ['', 'acid', 'ethanol', 'ester', 'water'], rows: [['initial / mol', p2(a0), p2(b0), '0', '0'], ['change / mol', `−${p2(x)}`, `−${p2(x)}`, `+${p2(x)}`, `+${p2(x)}`], ['equilibrium / mol', p2(a), p2(a), p2(x), p2(x)]] } }; },
  () => { const n0 = ri(10, 30) / 10, al = ri(15, 45) / 100, P = pick([1, 2, 3, 5]), nN = n0 * (1 - al), nO = 2 * n0 * al, tot = nN + nO, pN = (nN / tot) * P, pO = (nO / tot) * P, Kp = (pO * pO) / pN;
    return { topic: 'k', prompt: `${p2(n0)} mol of N₂O₄ is heated in a container; at equilibrium ${p2(al * 100)}% has dissociated: N₂O₄(g) ⇌ 2NO₂(g). The total pressure is ${P} atm. What is Kp?`,
      ...opts(Kp, [(nO * nO) / nN, pO / pN, (pO * pO) / pN / P], 'atm', p3),
      working: [`n(N₂O₄) = ${p2(n0)} × ${p2(1 - al)} = ${p3(nN)} mol; n(NO₂) = 2 × ${p2(n0)} × ${p2(al)} = ${p3(nO)} mol`, `total = ${p3(tot)} mol`, `p(N₂O₄) = (${p3(nN)} ÷ ${p3(tot)}) × ${P} = ${p3(pN)} atm; p(NO₂) = ${p3(pO)} atm`, `Kp = p(NO₂)² ÷ p(N₂O₄) = ${p3(Kp)} atm`],
      why: 'Partial pressure = mole fraction × total pressure. Each N₂O₄ that dissociates makes two NO₂.' }; },
  () => { const nH = ri(2, 6) / 10, nI = ri(2, 6) / 10, nHI = ri(8, 30) / 10, V = pick([1, 2, 5]), K = (nHI * nHI) / (nH * nI);
    return { topic: 'k', prompt: `An equilibrium mixture in a ${V} dm³ flask contains ${p2(nH)} mol H₂, ${p2(nI)} mol I₂ and ${p2(nHI)} mol HI: H₂(g) + I₂(g) ⇌ 2HI(g). What is Kc?`,
      ...opts(K, [nHI / (nH * nI), (nHI * nHI) / (nH * nI) / V, (2 * nHI) / (nH * nI)], '', p3),
      working: [`[H₂] = ${p2(nH)}/${V}, [I₂] = ${p2(nI)}/${V}, [HI] = ${p2(nHI)}/${V} mol dm⁻³`, 'Kc = [HI]² ÷ [H₂][I₂]: the volumes cancel', `= ${p2(nHI)}² ÷ (${p2(nH)} × ${p2(nI)}) = ${p3(K)}, no units`], why: 'When the moles of gas are equal on both sides, V cancels and Kc has no units.' }; },
  () => { const e = pick([10, -10, 2, -2]);
    const ans = e >= 10 ? 'The reaction goes almost to completion' : e <= -10 ? 'The reaction hardly takes place at all' : e > 0 ? 'Products are favoured, but reactants are still present in significant amounts' : 'Reactants are favoured, but products are present in significant amounts';
    return { topic: 'k', prompt: `A reaction has K = 1 × 10${e < 0 ? '⁻' : ''}${String(Math.abs(e)).split('').map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join('')} at 298 K. What does this suggest?`,
      ...choice(ans, ['The reaction goes almost to completion', 'The reaction hardly takes place at all', 'Products are favoured, but reactants are still present in significant amounts', 'Reactants are favoured, but products are present in significant amounts']),
      working: ['K is roughly products ÷ reactants', 'K > 10¹⁰: effectively complete; K < 10⁻¹⁰: effectively no reaction; in between: a real mixture'], why: 'K says how far, not how fast: a reaction with a huge K can still be very slow.' }; },
];

/* ---------- industry, K and temperature: 9.11, 13.6, 13.8 ---------- */
const INDUSTRY: (() => Question)[] = [
  () => ({ topic: 'industry', prompt: 'The Haber process is exothermic, so a low temperature gives a higher equilibrium yield. Why is about 450 °C used?', ...choice('At a low temperature the rate would be too slow; 450 °C is a compromise between rate and yield', [
    'The yield is highest at 450 °C', 'The iron catalyst only works above 450 °C because it melts below', '450 °C makes the reaction endothermic', 'A higher temperature increases K']),
    working: ['Lower T → higher yield (exothermic), but slower', 'Higher T → faster, but lower yield', '450 °C with an iron catalyst gives an acceptable yield quickly'], why: 'A good answer names both sides: the yield and the rate.' }),
  () => ({ topic: 'industry', prompt: 'A higher pressure gives a higher equilibrium yield of ammonia. Why is the pressure limited to about 200 atm?', ...choice('Higher pressures need much more energy and stronger, more expensive plant, and are more dangerous', [
    'Higher pressure lowers the yield', 'Higher pressure slows the reaction', 'K decreases at higher pressure', 'The catalyst stops working at high pressure']),
    working: ['N₂ + 3H₂ ⇌ 2NH₃: 4 moles of gas → 2, so high pressure favours ammonia', 'But compressing gas costs energy, and thick-walled vessels cost money and carry risk'], why: 'Again a compromise: yield against cost and safety.' }),
  () => ({ topic: 'industry', prompt: 'In the Contact process, 2SO₂ + O₂ ⇌ 2SO₃, high pressure would increase the yield. Why is only 1–2 atm used?', ...choice('The conversion is already about 99% at low pressure, so extra pressure is not worth the cost', [
    'High pressure would decrease the yield', 'The reaction is endothermic', 'SO₃ is a liquid at high pressure', 'The V₂O₅ catalyst needs low pressure']),
    working: ['Fewer gas moles on the right, so pressure would help a little', 'But the yield is already very high, so the cost of compression is not justified'], why: 'Compare with Haber, where the conversion per pass is only about 15%.' }),
  () => ({ topic: 'industry', prompt: 'In the Haber process only about 15% of the gases are converted per pass. How is a high overall conversion achieved?', ...choice('Ammonia is condensed out and the unreacted nitrogen and hydrogen are recycled', [
    'The gases are heated to a higher temperature', 'More catalyst is added', 'The ammonia is left in to push the equilibrium', 'The pressure is lowered']),
    working: ['Cooling liquefies NH₃, removing it', 'Unreacted N₂ and H₂ go back through the converter', 'Overall about 98% of the gases become ammonia'], why: 'Removing product also keeps the reaction mixture away from equilibrium.' }),
  () => { const exo = Math.random() < 0.5;
    return { topic: 'industry', prompt: `How does the value of K change as the temperature is increased, for a reaction whose forward direction is ${exo ? 'exothermic' : 'endothermic'}?`,
      ...choice(exo ? 'K decreases' : 'K increases', ['K decreases', 'K increases', 'K does not change', 'It depends on the pressure']),
      working: [exo ? 'Exothermic: raising T favours the backward (endothermic) reaction' : 'Endothermic: raising T favours the forward reaction', `So K ${exo ? 'falls' : 'rises'}`, 'In terms of entropy: ΔS_surr = −ΔH/T changes with T, so ΔS_total and K change'], why: 'Temperature is the only factor that changes K.' }; },
  () => { const K = pick([2.5, 6.1, 40, 0.15, 0.02, 1.8e3, 7.2e-4]), dS = R * Math.log(K);
    return { topic: 'industry', prompt: `A reaction has K = ${sci(K)} at 298 K. What is ΔS_total? (ΔS_total = R ln K, R = 8.31 J mol⁻¹ K⁻¹)`,
      ...opts(dS, [R * Math.log10(K), Math.log(K) / R, R * K], 'J K⁻¹ mol⁻¹', p3),
      working: [`ΔS_total = 8.31 × ln(${sci(K)})`, `= 8.31 × ${neg(p3(Math.log(K)))} = ${neg(p3(dS))} J K⁻¹ mol⁻¹`], why: 'Use ln (natural log), not log₁₀. K > 1 gives a positive ΔS_total.' }; },
  () => { const dH = pick([-92, -197, -57, 57, 206, -91]), T = pick([298, 400, 500, 700, 723]), s = (-dH * 1000) / T;
    return { topic: 'industry', prompt: `For a reaction with ΔH = ${neg(dH)} kJ mol⁻¹, what is ΔS_surroundings at ${T} K?`,
      ...opts(s, [-s, -dH / T, s * 1000], 'J K⁻¹ mol⁻¹', p3),
      working: ['ΔS_surr = −ΔH / T, with ΔH in J', `= −(${neg(dH * 1000)}) ÷ ${T} = ${neg(p3(s))} J K⁻¹ mol⁻¹`],
      why: `As T rises ΔS_surr gets ${dH < 0 ? 'less positive' : 'less negative'}, so ΔS_total (and K) ${dH < 0 ? 'decreases' : 'increases'}.` }; },
  () => { const dS = pick([-40, -12, 15, 35, 80]), K = Math.exp(dS / R);
    return { topic: 'industry', prompt: `ΔS_total for a reaction is ${neg(dS)} J K⁻¹ mol⁻¹. What is K? (ΔS_total = R ln K)`,
      ...opts(K, [Math.exp(dS * R), 10 ** (dS / R), Math.abs(dS / R)], '', (x) => sci(x)), working: ['ln K = ΔS_total ÷ R', `= ${neg(dS)} ÷ 8.31 = ${neg(p3(dS / R))}`, `K = e^(${neg(p3(dS / R))}) = ${sci(K)}`],
      why: 'A negative ΔS_total gives K < 1; positive gives K > 1.' }; },
];

const BANK: Record<Topic, (() => Question)[]> = { collide: COLLIDE, catalyst: CATALYST, measure: MEASURE, orders: ORDERS, mech: MECH, arrhenius: ARRH, equil: EQUIL, k: KCALC, industry: INDUSTRY };
export const COUNT = Object.values(BANK).reduce((s, b) => s + b.length, 0);

export function newQuestion(topic: Topic | 'all'): Question {
  const t: Topic = topic === 'all' ? pick(Object.keys(BANK) as Topic[]) : topic;
  return pick(BANK[t])();
}
