/* Kernel helpers for Kinetics Lab: loose matching across all 10 tabs (reactions, processes, species,
   practicals, mechanisms, equilibria), numeric clamping, and plain-text summaries of on-screen readouts. */

import { EA, EA_CAT, fracAbove, peakE } from './collide';
import { SURFACES, CO_STEPS, type Surf, type Kind as ProfileKind } from './catalyst';
import { RX as MEASURE_RX, METHOD_NAME, type RxId, type Method, type Size } from './measure';
import type { Ord } from './orders';
import { EXAMPLES, type Example } from './mechanism';
import { SYSTEMS as EQ_SYS, dn, kcUnits } from './equil';
import { RXNS as K_RXNS, type KRx } from './constants';
import { PROCS, Kp as indKp, yieldAt, rateRel, costRel, entropy, type Proc } from './industry';
import { TOPICS, type Topic } from './practice';
import { sci, plain } from './consts';
import type { CollidePrefs } from './Collide.svelte';
import type { CatalystPrefs } from './Catalyst.svelte';
import type { IndustryPrefs } from './Industry.svelte';

const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹', SUBS = '₀₁₂₃₄₅₆₇₈₉';

export function norm(s: string): string {
  return String(s).toLowerCase()
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => String(SUPS.indexOf(c)))
    .replace(/[₀-₉]/g, (c) => String(SUBS.indexOf(c)))
    .replace(/⁺/g, '+').replace(/[⁻−–—]/g, '-')
    .replace(/\((aq|s|l|g)\)/g, '')
    .replace(/[⇌⇄↔→=]/g, '=')
    .replace(/[\s^_'"`.,()]/g, '');
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

export const measureList = () => 'Measuring-rates reactions: ' + MEASURE_RX.map((r) => `${r.id} (${r.name}; methods: ${r.methods.join('/')})`).join('; ') + '.';
export const mechExList = () => 'Mechanism examples: ' + EXAMPLES.map((e) => `${e.id} (${e.name})`).join('; ') + '.';
export const equilList = () => 'Dynamic Equilibrium tab systems: no2 (N₂O₄ ⇌ 2NO₂), hi (H₂ + I₂ ⇌ 2HI), icl (ICl + Cl₂ ⇌ ICl₃). (For Haber N₂ + 3H₂ ⇌ 2NH₃, Contact 2SO₂ + O₂ ⇌ 2SO₃ or Methanol CO + 2H₂ ⇌ CH₃OH, use kinetics_industry or kinetics_k.)';
export const kRxnList = () => 'Kc/Kp reactions: ' + K_RXNS.map((r) => `${r.id} (${r.name}, ${[r.kc ? 'Kc' : '', r.kp ? 'Kp' : ''].filter(Boolean).join('/')})`).join('; ') + '.';
export const procList = () => 'Industrial processes: ' + PROCS.map((p) => `${p.id} (${p.name}: ${p.eq})`).join('; ') + '.';
export const topicList = () => 'Practice topics: ' + TOPICS.map(([id, nm]) => `${id} (${nm})`).join('; ') + '.';

export function matchSurf(q: string): Surf {
  const k = norm(q);
  if (/ethene|ni|nickel|c2h4|ch2=ch2|alkene|hydrogenation/.test(k)) return 'ethene';
  if (/haber|fe|iron|nh3|ammonia|n2/.test(k)) return 'haber';
  throw new Error(`No catalyst surface matches "${q}". Valid surfaces: ethene (ethene + H2 on Ni), haber (Haber process on Fe).`);
}

export function matchProfile(q: string): ProfileKind {
  const k = norm(q);
  if (k.startsWith('exo')) return 'exo';
  if (k.startsWith('endo')) return 'endo';
  throw new Error(`No reaction profile matches "${q}". Use "exo" (exothermic) or "endo" (endothermic).`);
}

const MEAS_ALIASES: Record<RxId, string[]> = {
  marble: ['marble', 'caco3', 'calcium carbonate', 'marble+hcl', 'co2'],
  h2o2: ['h2o2', 'hydrogen peroxide', 'peroxide', 'mno2', 'o2'],
  mg: ['mg', 'magnesium', 'mg+hcl', 'h2'],
  thio: ['thio', 'thiosulfate', 'sodium thiosulfate', 'na2s2o3', 's2o32-', 'disappearing cross', 'cross'],
  iodine: ['iodine', 'propanone', 'ch3coch3', 'i2', 'acetone', 'colorimeter'],
};
export const matchMeasureRx = (q: string) =>
  matchBy(MEASURE_RX, q, 'reaction', (r) => [r.id, r.name, r.short, r.eq, ...(MEAS_ALIASES[r.id] ?? [])], measureList);

export function matchMethod(q: string, allowed: Method[]): Method {
  const k = norm(q);
  let m: Method | null = null;
  if (/syringe|gas|volume/.test(k)) m = 'syringe';
  else if (/mass|balance|weight/.test(k)) m = 'mass';
  else if (/cross|disappear|sulfur|sulphur/.test(k)) m = 'cross';
  else if (/colou?r/.test(k)) m = 'colour';
  if (!m || !allowed.includes(m)) {
    throw new Error(`Method "${q}" is not available for this reaction. Valid methods here: ${allowed.map((x) => `${x} (${METHOD_NAME[x]})`).join(', ')}.`);
  }
  return m;
}

export function matchSize(q: string): Size {
  const k = norm(q);
  if (/large|big|lump/.test(k)) return 'large';
  if (/small|chip/.test(k)) return 'small';
  if (/powder|fine|crush/.test(k)) return 'powder';
  throw new Error(`Chip size "${q}" not understood. Valid sizes: large, small, powder.`);
}

export function matchOrd(v: unknown, name: string): Ord {
  const n = Math.round(num(v, name));
  if (n === 0 || n === 1 || n === 2) return n;
  throw new Error(`${name} must be 0, 1, or 2.`);
}

export function matchPractical(q: string): 'cp9a' | 'cp9b' | 'cp10' {
  const k = norm(q);
  if (/9a|iodination|propanone|titrat/.test(k)) return 'cp9a';
  if (/9b|clock/.test(k)) return 'cp9b';
  if (/10|arrhenius|activation/.test(k)) return 'cp10';
  throw new Error(`No core practical matches "${q}". Valid practicals: cp9a (iodination of propanone), cp9b (iodine clock), cp10 (activation energy / Arrhenius).`);
}

export function matchExample(q: string): Example {
  return matchBy(EXAMPLES, q, 'mechanism example', (e) => [e.id, e.name, e.overall, e.rate], mechExList);
}

export function matchEquilSys(q: string): 'no2' | 'hi' | 'icl' {
  const k = norm(q);
  if (/no2|n2o4|nitrogendioxide|dinitrogen/.test(k)) return 'no2';
  if (/^hi$|h2\+i2|hydrogeniodide|iodide/.test(k)) return 'hi';
  if (/icl|icl3|utube|iodine.*chloride/.test(k)) return 'icl';
  if (/haber|nh3|ammonia|n2\+3h2|contact|so2|so3|methanol|ch3oh/.test(k)) {
    throw new Error(`"${q}" is not on the syringe Equilibrium tab; use kinetics_industry (for temperature/pressure & yield) or kinetics_k (for Kc/Kp calculations). ${equilList()}`);
  }
  throw new Error(`No dynamic equilibrium system matches "${q}". ${equilList()}`);
}

const K_ALIASES: Record<string, string[]> = {
  haber: ['haber', 'nh3', 'ammonia', 'n2+3h2=2nh3', 'n2+3h2'],
  hi: ['hi', 'h2+i2=2hi', 'h2+i2', 'hydrogen iodide'],
  no2: ['no2', 'n2o4', 'n2o4=2no2', 'dinitrogen tetroxide', 'nitrogen dioxide'],
  ester: ['ester', 'esterification', 'ethanoic acid', 'ch3cooh', 'ethyl ethanoate', 'ch3cooc2h5'],
  fe: ['fe', 'fe2+', 'ag+', 'iron', 'silver', 'iron(ii)'],
  caco3: ['caco3', 'calcium carbonate', 'cao', 'co2'],
  nh4cl: ['nh4cl', 'ammonium chloride'],
};
export const matchKRxn = (q: string): KRx =>
  matchBy(K_RXNS, q, 'Kc/Kp reaction', (r) => [r.id, r.name, ...(K_ALIASES[r.id] ?? [])], kRxnList);

const PROC_ALIASES: Record<Proc['id'], string[]> = {
  haber: ['haber', 'haber process', 'nh3', 'ammonia', 'n2+3h2=2nh3', 'n2+3h2'],
  contact: ['contact', 'contact process', 'so3', 'so2', '2so2+o2=2so3', 'sulfuric acid', 'sulphuric acid'],
  methanol: ['methanol', 'ch3oh', 'co+2h2=ch3oh', 'co+2h2'],
};
export const matchProc = (q: string): Proc =>
  matchBy(PROCS, q, 'industrial process', (p) => [p.id, p.name, p.eq, p.product, ...(PROC_ALIASES[p.id] ?? [])], procList);

export function matchTopic(q: string): Topic | 'all' {
  const k = norm(q);
  const hit = TOPICS.find(([id, nm]) => norm(id) === k || norm(nm).includes(k));
  if (hit) return hit[0];
  throw new Error(`No practice topic matches "${q}". ${topicList()}`);
}

/* ---------- plain-text readouts ---------- */
export function describeCollide(p: CollidePrefs, live?: { hits: number; wins: number; A: number; B: number; P: number; exposed: number }): string {
  const ea = p.cat ? EA_CAT : EA;
  const above = fracAbove(ea, p.T);
  const conc = p.mode === 'gas' ? p.n / 120 / p.vol : 1;
  const press = p.mode === 'gas' ? (p.n / 120) * (p.T / 300) / p.vol : 1;
  const lines = [
    `Collisions & Maxwell–Boltzmann (${p.mode === 'gas' ? 'two gases A + B' : `solid in acid, ${p.lump ? '1 lump' : 'powder (27 grains)'}`})`,
    `Conditions: T = ${p.T} K (${p.T - 273} °C; range 200–700 K), particles = ${p.n} (40–240), ${p.mode === 'gas' ? `piston volume = ${Math.round(p.vol * 100)}% (35–100%), conc ×${plain(conc, 2)}, pressure ×${plain(press, 2)}` : `solid = ${p.lump ? 'lump' : 'powder'}`}, catalyst = ${p.cat ? `added (Ea = ${EA_CAT} kJ mol⁻¹)` : `none (Ea = ${EA} kJ mol⁻¹)`}.`,
    `Maxwell–Boltzmann: most probable energy ½RT = ${plain(peakE(p.T), 3)} kJ mol⁻¹, fraction with E ≥ Ea = ${plain(above * 100, 3)}%${p.T2 ? `; comparison curve T₂ = ${p.T2} K (${plain(fracAbove(ea, p.T2) * 100, 3)}%, ×${plain(fracAbove(ea, p.T2) / above, 3)})` : ''}. Box histogram: ${p.hist ? 'on' : 'off'}, tail ×10: ${p.mag ? 'on' : 'off'}.`,
  ];
  if (live) {
    const share = live.hits > 0 ? `${plain((live.wins / live.hits) * 100, 2)}%` : '–';
    lines.push(`Live box: ${plain(live.hits, 3)} collisions s⁻¹, ${plain(live.wins, 2)} successful s⁻¹ (${share} succeed)${p.mode === 'solid' ? `, ${live.exposed} exposed faces` : `, A=${live.A}, B=${live.B}, P=${live.P}`}.`);
  }
  return lines.join('\n');
}

export function describeCatalyst(p: CatalystPrefs, st?: { stage: number; playing: boolean; co: number }): string {
  const S = SURFACES[p.surf];
  const si = st ? Math.min(st.stage, S.stages.length - 1) : 0;
  const coStep = CO_STEPS[st?.co ?? 0];
  const fU = fracAbove(EA, p.T) * 100, fC = fracAbove(EA_CAT, p.T) * 100;
  return [
    `Catalysts: 3D surface = ${S.equation} on ${S.metalName} (stage ${si + 1}/${S.stages.length}: ${S.stages[si].title} — ${S.stages[si].text}).`,
    `Reaction profile: ${p.kind === 'exo' ? 'exothermic (ΔH < 0)' : 'endothermic (ΔH > 0)'}, uncatalysed ${p.uncat ? 'shown' : 'hidden'}, catalysed ${p.cat ? 'shown (two humps + intermediate, lower Ea, same ΔH)' : 'hidden'}.`,
    `Maxwell–Boltzmann at T = ${p.T} K (200–700 K): E ≥ Ea (${EA} kJ mol⁻¹) = ${plain(fU, 3)}%; E ≥ Ea(cat) (${EA_CAT} kJ mol⁻¹) = ${plain(fC, 3)}% (×${plain(fC / fU, 3)} molecules can react).`,
    `Homogeneous Co²⁺/tartrate demo: step ${(st?.co ?? 0) + 1}/${CO_STEPS.length} — ${coStep.title}: ${coStep.text}`,
  ].join('\n');
}

export function describeIndustry(p: IndustryPrefs): string {
  const proc = PROCS.find((x) => x.id === p.proc) ?? PROCS[0];
  const TK = p.T + 273;
  const Y = yieldAt(proc, TK, p.P);
  const Yreal = yieldAt(proc, proc.real.T + 273, proc.real.P);
  const K = indKp(proc, TK);
  const rate = rateRel(proc, p.T, p.P);
  const cost = costRel(proc, p.T, p.P);
  const E = entropy(proc, TK);
  const sgn = (x: number) => (x >= 0 ? '+' : '−') + plain(Math.abs(x), 3);
  return [
    `Industrial equilibrium: ${proc.name} — ${proc.eq} (ΔH = ${sgn(proc.dH / 1000)} kJ mol⁻¹, Δn(gas) = ${proc.dn}, catalyst: ${proc.catalyst}).`,
    `Conditions: T = ${p.T} °C (${TK} K; range ${proc.Tr[0]}–${proc.Tr[1]} °C), P = ${p.P} atm (range ${proc.Pr[0]}–${proc.Pr[1]} atm). Real industrial compromise: ${proc.real.T} °C, ${proc.real.P} atm.`,
    `Results: ${proc.product} mole fraction = ${plain(Y.frac * 100, 3)}% (real: ${plain(Yreal.frac * 100, 3)}%), conversion = ${plain(Y.conv * 100, 3)}% (real: ${plain(Yreal.conv * 100, 3)}%), Kp = ${sci(K)} ${proc.units}, relative rate = ${sci(rate, 2)}×, cost index = ${plain(cost, 2)}.`,
    `Entropy at ${TK} K: ΔSsystem = ${sgn(E.sys)}, ΔSsurroundings = ${sgn(E.surr)}, ΔStotal = ${sgn(E.tot)} J K⁻¹ mol⁻¹ = R ln K.`,
    `3D surface: height = ${p.measure === 'frac' ? `% ${proc.product}` : '% converted'}, colour = ${p.colour}.`,
  ].join('\n');
}

export function describeEqSysList(): string {
  return EQ_SYS.map((s) => `${s.id}: ${s.eq} (T ${s.T[0]}–${s.T[2]} K, Δn=${dn(s)}, Kc units: ${kcUnits(dn(s))})`).join('; ') + '; icl: ICl(l) + Cl₂(g) ⇌ ICl₃(s) (T 273–360 K).';
}
