/* Kernel helpers for Energetics Lab: loose matching (formulae, names, Unicode/ASCII charges & subscripts),
   numeric clamping, and plain-text summaries of on-screen readouts. Pure: no DOM or Svelte state. */

import { plain } from '../../lib/chem';
import { CAL_REACTIONS, simulateCal, type CalReaction } from './calorimetry';
import { HESS_CYCLES, calcHess, type HessCycle } from './hess';
import { BOND_REACTIONS, sumBonds, type BondReaction } from './bonds';
import { BH_CYCLES, solEnthalpy, type BHCycle } from './bornhaber';
import { FEAS_PRESETS, calcThermo, type EntropyPhase, type FeasPreset } from './entropy';
import { TOPICS, type Topic } from './practice';
import { C_WATER, signed } from './consts';
import type { CalPrefs } from './Calorimetry.svelte';
import type { HessPrefs } from './Hess.svelte';
import type { BondsPrefs } from './Bonds.svelte';
import type { BHPrefs } from './BornHaber.svelte';
import type { EntropyPrefs } from './Entropy.svelte';

const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹', SUBS = '₀₁₂₃₄₅₆₇₈₉';

/** Lower-case, Unicode super/subscripts & dashes normalised, spaces/punctuation stripped. */
export function norm(s: string): string {
  return String(s).toLowerCase()
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => String(SUPS.indexOf(c)))
    .replace(/[₀-₉]/g, (c) => String(SUBS.indexOf(c)))
    .replace(/⁺/g, '+').replace(/[⁻−–—]/g, '-')
    .replace(/\((aq|s|l|g)\)/g, '')
    .replace(/[\s^_'"`.,·:()]/g, '');
}

export function clamp(v: number, lo: number, hi: number, step?: number): number {
  const c = Math.max(lo, Math.min(hi, v));
  return step ? Math.round((c - lo) / step) * step + lo : c;
}

export function num(v: unknown, name: string): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number.`);
  return n;
}

function matchBy<T>(items: T[], q: string, what: string, keysOf: (x: T) => string[], list: () => string): T {
  const k = norm(q);
  if (!k) throw new Error(`Specify a ${what}. ${list()}`);
  const exact = items.filter((x) => keysOf(x).some((a) => norm(a) === k));
  if (exact.length === 1) return exact[0];
  const sub = items.filter((x) => keysOf(x).some((a) => {
    const na = norm(a);
    return na.length >= 2 && (na.includes(k) || (k.length >= 3 && k.includes(na)));
  }));
  if (sub.length === 1) return sub[0];
  if (sub.length > 1) throw new Error(`"${q}" matches more than one ${what}. Be more specific. ${list()}`);
  throw new Error(`No ${what} matches "${q}". ${list()}`);
}

export const calList = () => 'Calorimetry reactions: ' + CAL_REACTIONS.map((r) => `${r.id} (${r.name})`).join('; ') + '.';
export const hessList = () => 'Hess cycles: ' + HESS_CYCLES.map((c) => `${c.id} (${c.name})`).join('; ') + '.';
export const bondList = () => 'Bond enthalpy reactions: ' + BOND_REACTIONS.map((r) => `${r.id} (${r.name})`).join('; ') + '.';
export const bhList = () => 'Born–Haber compounds: ' + BH_CYCLES.map((c) => `${c.formula} (${c.name})`).join('; ') + '.';
export const entropyList = () => 'Entropy presets: ' + FEAS_PRESETS.map((p) => `${p.id} (${p.name})`).join('; ') + '.';
export const topicList = () => 'Practice topics: ' + TOPICS.map(([id, nm]) => `${id} (${nm})`).join('; ') + '.';

const CAL_KEYS: Record<string, string[]> = {
  zn_cuso4: ['zn_cuso4', 'zn+cuso4', 'zncuso4', 'zinc', 'copper sulfate', 'coppersulphate', 'displacement'],
  hcl_naoh: ['hcl_naoh', 'hcl+naoh', 'hclnaoh', 'naoh+hcl', 'neutralisation', 'neutralization', 'acid alkali', 'hydrochloric', 'sodium hydroxide'],
  nh4no3: ['nh4no3', 'ammonium nitrate', 'dissolving', 'endothermic'],
  ethanol: ['ethanol', 'c2h5oh', 'ch3ch2oh', 'ethanol combustion'],
  propanol: ['propanol', 'propan-1-ol', 'propan1ol', 'c3h7oh', 'propanol combustion'],
};
export const matchCal = (q: string): CalReaction =>
  matchBy(CAL_REACTIONS, q, 'calorimetry reaction', (r) => [r.id, r.name, plain(r.eq), ...(CAL_KEYS[r.id] ?? [])], calList);

const HESS_KEYS: Record<string, string[]> = {
  form_caco3: ['form_caco3', 'caco3', 'calcium carbonate', 'decomposition of caco3', 'formation', 'thermal decomposition of calcium carbonate'],
  comb_etoh: ['comb_etoh', 'ethanol', 'c2h5oh', 'formation of ethanol', 'combustion', 'ethanol combustion'],
  cp5_khco3: ['cp5_khco3', 'khco3', 'cp2', 'core practical 2', 'potassium hydrogencarbonate', 'potassium bicarbonate', 'k2co3'],
  cp5_cuso4: ['cp5_cuso4', 'cuso4', 'hydration', 'anhydrous cuso4', 'copper sulfate', 'coppersulphate', 'cuso4.5h2o'],
};
export const matchHess = (q: string): HessCycle =>
  matchBy(HESS_CYCLES, q, 'Hess cycle', (c) => [c.id, c.name, c.reactants, c.products, ...(HESS_KEYS[c.id] ?? [])], hessList);

const BOND_KEYS: Record<string, string[]> = {
  ch4_comb: ['ch4_comb', 'ch4', 'methane', 'combustion of methane'],
  h2_cl2: ['h2_cl2', 'h2+cl2', 'hcl', 'hydrogen + chlorine', 'hydrogen chloride'],
  c2h4_h2: ['c2h4_h2', 'c2h4', 'ethene', 'ethane', 'hydrogenation', 'hydrogenation of ethene'],
  haber: ['haber', 'nh3', 'ammonia', 'n2+3h2', 'haber process'],
};
export const matchBond = (q: string): BondReaction =>
  matchBy(BOND_REACTIONS, q, 'bond-enthalpy reaction', (r) => [r.id, r.name, plain(r.eq), ...(BOND_KEYS[r.id] ?? [])], bondList);

export const matchBH = (q: string): BHCycle =>
  matchBy(BH_CYCLES, q, 'Born–Haber compound', (c) => [c.id, c.formula, c.name], bhList);

const ENT_KEYS: Record<string, string[]> = {
  caco3: ['caco3', 'calcium carbonate', 'decomposition', 'high-t', 'endo +ds'],
  haber: ['haber', 'nh3', 'ammonia', 'n2+3h2', 'low-t'],
  h2o2: ['h2o2', 'hydrogen peroxide', 'always feasible'],
  photosyn: ['photosyn', 'photosynthesis', 'glucose', 'c6h12o6', 'never feasible'],
};
export const matchEntropy = (q: string): FeasPreset =>
  matchBy(FEAS_PRESETS, q, 'entropy preset', (p) => [p.id, p.name, plain(p.eq), ...(ENT_KEYS[p.id] ?? [])], entropyList);

export function matchPhase(q: string): EntropyPhase {
  const k = norm(q);
  if (k === 'solid' || k === 's') return 'solid';
  if (k === 'liquid' || k === 'l') return 'liquid';
  if (k === 'gas' || k === 'g') return 'gas';
  if (k === 'decomp' || k === 'solidgas' || k === 'solid->gas' || k === 'decomposition') return 'decomp';
  throw new Error(`No entropy phase matches "${q}". Valid phases: solid, liquid, gas, decomp.`);
}

export function matchTopic(q: string): Topic | 'all' {
  const k = norm(q);
  const hit = TOPICS.find(([id, nm]) => norm(id) === k || norm(nm).includes(k));
  if (hit) return hit[0];
  throw new Error(`No practice topic matches "${q}". ${topicList()}`);
}

export function matchBHStep(c: BHCycle, q: unknown): number {
  if (typeof q === 'number' && Number.isFinite(q)) {
    const i = Math.round(q);
    // accept 0-based (0..n-1) or 1-based if === n
    return Math.max(0, Math.min(c.steps.length - 1, i === c.steps.length ? i - 1 : i));
  }
  const s = String(q ?? '');
  if (/^\d+$/.test(s.trim())) return matchBHStep(c, Number(s));
  const k = norm(s);
  const idx = c.steps.findIndex((st) => norm(st.id) === k || norm(st.name).includes(k) || norm(st.symbol).includes(k));
  if (idx >= 0) return idx;
  throw new Error(`No Born–Haber step in ${c.formula} matches "${s}". Valid steps (0–${c.steps.length - 1}): ${c.steps.map((st, i) => `${i}: ${st.id} (${st.name})`).join('; ')}.`);
}

/* ---------- plain-text readouts ---------- */
export function describeCal(p: CalPrefs): string {
  const rxn = CAL_REACTIONS.find((r) => r.id === p.rxn) ?? CAL_REACTIONS[0];
  const effLoss = rxn.mode === 'cup' && p.lid ? p.loss * 0.55 : p.loss;
  const sim = simulateCal(rxn, p.mass, p.mol, effLoss);
  const lines = [
    `Calorimetry (${rxn.mode === 'cup' ? 'polystyrene cup' : 'spirit burner'}): ${rxn.name}`,
    `Equation: ${plain(rxn.eq)}`,
    `Settings: mass = ${p.mass} g (range 25–150 g), limiting moles n = ${p.mol.toFixed(3)} mol (range 0.005–0.120 mol), heat loss = ${Math.round(p.loss * 100)}% (0–100%)${rxn.mode === 'cup' ? `, lid = ${p.lid ? 'on' : 'off'}` : ''}.`,
  ];
  if (rxn.id === 'hcl_naoh') {
    const half = p.mass / 2, conc = p.mol / (half / 1000);
    lines.push(`Solution mix: ${half.toFixed(0)} cm³ HCl + ${half.toFixed(0)} cm³ NaOH at ${conc.toFixed(2)} mol dm⁻³ (total ${p.mass} g, ${p.mol.toFixed(3)} mol H₂O).`);
  } else if (rxn.id === 'zn_cuso4') {
    lines.push(`Solution mix: excess Zn + ${p.mass} cm³ of ${(p.mol / (p.mass / 1000)).toFixed(2)} mol dm⁻³ CuSO₄(aq).`);
  } else if (rxn.id === 'nh4no3') {
    lines.push(`Solution mix: ${(p.mol * (rxn.molarMass ?? 80)).toFixed(2)} g NH₄NO₃ in ${p.mass} cm³ water.`);
  }
  if (rxn.mode === 'cup') {
    lines.push(`Results: T0 = ${sim.t0.toFixed(1)} °C, raw peak ΔT = ${signed(sim.peakDeltaT, 1)} °C, extrapolated ΔT (at t = 4 min) = ${signed(sim.extrapDeltaT, 1)} °C.`);
  } else {
    lines.push(`Results: T0 = ${sim.t0.toFixed(1)} °C, final T = ${(sim.t0 + sim.peakDeltaT).toFixed(1)} °C, ΔT = ${signed(sim.peakDeltaT, 1)} °C, fuel burned Δm = ${(sim.massFuel ?? 0).toFixed(2)} g.`);
  }
  lines.push(`q = m c ΔT = ${p.mass} × ${C_WATER} × ${Math.abs(sim.extrapDeltaT).toFixed(2)} = ${Math.abs(sim.qExp).toFixed(0)} J (${(Math.abs(sim.qExp) / 1000).toFixed(2)} kJ).`);
  lines.push(`Experimental ΔH = ${signed(sim.dhExp, 1)} kJ mol⁻¹ (Data Booklet: ${signed(rxn.dhLit, 1)} kJ mol⁻¹).`);
  return lines.join('\n');
}

export function describeHess(p: HessPrefs): string {
  const cyc = HESS_CYCLES.find((c) => c.id === p.cycle) ?? HESS_CYCLES[0];
  const dh1 = p.custom ? p.dh1 : cyc.dh1, dh2 = p.custom ? p.dh2 : cyc.dh2;
  const dhr = calcHess(cyc.arrowDir, dh1, dh2);
  return [
    `Hess cycle: ${cyc.name} (${cyc.kind}, route highlighted: ${p.route}${p.custom ? ', custom values' : ''})`,
    `Reaction: ${plain(cyc.reactants)} → ${plain(cyc.products)}; bottom intermediate: ${plain(cyc.bottom)} (arrows ${cyc.arrowDir}${cyc.arrowReagent ? `, reagent ${cyc.arrowReagent}` : ''}).`,
    `Left leg ${cyc.dh1Label} = ${signed(dh1, 1)} kJ mol⁻¹; Right leg ${cyc.dh2Label} = ${signed(dh2, 1)} kJ mol⁻¹ (custom range −2000 to +500 kJ mol⁻¹).`,
    `Formula: ${cyc.formulaText} → ΔrH = ${signed(dhr, 1)} kJ mol⁻¹.`,
    cyc.note,
  ].join('\n');
}

export function describeBonds(p: BondsPrefs): string {
  const rxn = BOND_REACTIONS.find((r) => r.id === p.rxn) ?? BOND_REACTIONS[0];
  const broken = sumBonds(rxn.broken), made = sumBonds(rxn.made), est = broken - made;
  const stage = p.progress < 0.25 ? 'Reactants' : p.progress < 0.75 ? 'Gaseous atoms' : 'Products';
  return [
    `Bond enthalpies: ${rxn.name} — ${plain(rxn.eq)}`,
    `Progress: ${Math.round(p.progress * 100)}% (${stage}; range 0–100%).`,
    `Bonds broken (+): ${rxn.broken.map((b) => `${b.count}×(${b.bond}) = +${b.count * b.be}`).join(', ')} → total +${broken} kJ mol⁻¹.`,
    `Bonds made (−): ${rxn.made.map((b) => `${b.count}×(${b.bond}) = −${b.count * b.be}`).join(', ')} → total −${made} kJ mol⁻¹.`,
    `Estimated ΔH = +${broken} − ${made} = ${signed(est, 0)} kJ mol⁻¹ (actual ΔrH⊖ = ${signed(rxn.dhLit, 0)} kJ mol⁻¹).`,
    `Difference: ${rxn.whyDiff}`,
  ].join('\n');
}

export function describeBH(p: BHPrefs): string {
  const c = BH_CYCLES.find((x) => x.id === p.id) ?? BH_CYCLES[0];
  const stepIdx = Math.min(p.step, c.steps.length - 1);
  const st = c.steps[stepIdx] ?? c.steps[0];
  const dSol = solEnthalpy(c);
  const stepLines = c.steps.map((s, i) => `  ${i + 1}. ${s.symbol} (${s.name}) = ${signed(s.dh, 0)} kJ mol⁻¹ → ${s.stateAfter}${i === stepIdx ? ' [highlighted]' : ''}`);
  return [
    `Born–Haber cycle: ${c.name} (${c.formula}), starting from ${c.elements}`,
    `Steps:\n${stepLines.join('\n')}`,
    `Highlighted step ${stepIdx + 1}/${c.steps.length}: ${st.name} (${signed(st.dh, 0)} kJ mol⁻¹) — ${st.note}`,
    `ΔfH⊖ = ${signed(c.dfH, 0)} kJ mol⁻¹; ΔlattH⊖ (cycle) = ${signed(c.leExp, 0)} kJ mol⁻¹; ΔlattH⊖ (theoretical) = ${signed(c.leTheo, 0)} kJ mol⁻¹ (discrepancy ${Math.abs(c.leExp - c.leTheo)} kJ mol⁻¹).`,
    `Polarisation: ${c.polarNote}`,
    dSol !== null
      ? `ΔsolH = +${-c.leExp} + (${c.hydCat}) + ${c.nAn > 1 ? `${c.nAn}×(${c.hydAn})` : `(${c.hydAn})`} = ${signed(dSol, 0)} kJ mol⁻¹.`
      : (c.solNote ?? 'ΔsolH not applicable.'),
  ].join('\n');
}

export function describeEntropy(p: EntropyPrefs): string {
  const cur = FEAS_PRESETS.find((x) => x.id === p.preset) ?? FEAS_PRESETS[0];
  const dh = p.custom ? p.dh : cur.dh, ds = p.custom ? p.ds : cur.ds;
  const th = calcThermo(dh, ds, p.T);
  return [
    `Entropy & ΔG: ${p.custom ? 'Custom ΔH / ΔS' : `${cur.name} (${plain(cur.eq)})`}`,
    `3D phase box: ${p.phase} (options: solid, liquid, gas, decomp).`,
    `Parameters: T = ${p.T} K (${p.T - 273} °C; range 100–1500 K), ΔH = ${signed(dh, 0)} kJ mol⁻¹ (−1000..3000), ΔSsystem = ${signed(ds, 0)} J K⁻¹ mol⁻¹ (−300..300).`,
    `Results: ΔSsurroundings = ${signed(th.dsSurr, 1)} J K⁻¹ mol⁻¹, ΔStotal = ${signed(th.dsTotal, 1)} J K⁻¹ mol⁻¹, ΔG = ${signed(th.dg, 1)} kJ mol⁻¹ → ${th.feasible ? 'Thermodynamically feasible (ΔG ≤ 0)' : 'Not feasible (ΔG > 0)'}.`,
    th.crossoverK !== null ? `Feasibility crossover temperature T = ΔH/ΔS = ${Math.round(th.crossoverK)} K (${Math.round(th.crossoverK - 273)} °C).` : 'No temperature crossover (sign of ΔG does not flip with T).',
    ...(p.custom ? [] : [`${cur.quadrant}: ${cur.note}`]),
  ].join('\n');
}
