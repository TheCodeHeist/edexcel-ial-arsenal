/* Kernel helpers for Atoms & Bonding Lab: loose matching (formulae, names, ion charges like 2+ or ²⁺,
   Roman numerals), numeric clamping, and plain-text summaries of on-screen readouts. Pure: no DOM or Svelte state. */

import { plain } from '../../lib/chem';
import { MOLECULES, buildVsepr, netDipole, type MoleculePreset } from './shapes';
import { ELEMENTS, SUBSHELLS, ORBITAL_DEFS, fillConfig, formatConfig, boxStates, sup, type ElementInfo, type OrbitalDef } from './orbitals';
import { FIRST_IE, SUCCESSIVE_IE, firstJump, type FirstIE, type SuccessiveEntry } from './ie';
import { LATTICES, type LatticeInfo } from './lattices';
import { IMF_INFO, HYDRIDES, ALKANE_ISOMERS, type ImfKind } from './imf';
import { SAMPLES, calcAr, type SamplePreset } from './massspec';
import { TOPICS, type Topic } from './practice';
import { EN } from './consts';
import type { ShapesPrefs } from './Shapes.svelte';
import type { OrbitalsPrefs } from './Orbitals.svelte';
import type { IePrefs } from './Ionisation.svelte';
import type { LatticesPrefs } from './Lattices.svelte';
import type { ImfPrefs } from './Imf.svelte';
import type { MassPrefs } from './MassSpec.svelte';

const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹', SUBS = '₀₁₂₃₄₅₆₇₈₉';

export function norm(s: string): string {
  return String(s).toLowerCase()
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => String(SUPS.indexOf(c)))
    .replace(/[₀-₉]/g, (c) => String(SUBS.indexOf(c)))
    .replace(/⁺/g, '+').replace(/[⁻−–—]/g, '-')
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

export const moleculeList = () => 'Preset molecules: ' + MOLECULES.map((m) => `${plain(m.formula)} (${m.name})`).join('; ') + '.';
export const orbitalList = () => '3D orbitals: ' + ORBITAL_DEFS.map((o) => o.id).join(', ') + '.';
export const succList = () => 'Successive IE elements: ' + SUCCESSIVE_IE.map((s) => `${s.sym} (${s.name})`).join('; ') + '.';
export const latticeList = () => 'Crystal lattices: ' + LATTICES.map((l) => `${l.id} (${l.name}, ${l.formula})`).join('; ') + '.';
export const imfList = () => 'IMF types: london (London dispersion), dipole (permanent dipole–dipole), hbond (hydrogen bonding). Trends: hydrides, alkanes.';
export const sampleList = () => 'Mass spec samples: ' + SAMPLES.map((s) => `${s.id} (${s.name}, ${s.formula})`).join('; ') + '; custom.';
export const topicList = () => 'Practice topics: ' + TOPICS.map(([id, nm]) => `${id} (${nm})`).join('; ') + '.';

const MOL_ALIASES: Record<string, string[]> = {
  becl2: ['becl2', 'beryllium chloride'],
  co2: ['co2', 'carbon dioxide'],
  bf3: ['bf3', 'boron trifluoride'],
  ch4: ['ch4', 'methane'],
  chcl3: ['chcl3', 'trichloromethane', 'chloroform'],
  nh3: ['nh3', 'ammonia'],
  h2o: ['h2o', 'water'],
  so2: ['so2', 'sulfur dioxide', 'sulphur dioxide'],
  nh4: ['nh4+', 'nh4', 'ammonium', 'ammonium ion'],
  c2h4: ['c2h4', 'ethene', 'ethylene'],
  pcl5: ['pcl5', 'phosphorus pentachloride', 'phosphorus(v) chloride', 'phosphorusvchloride'],
  sf6: ['sf6', 'sulfur hexafluoride', 'sulphur hexafluoride'],
  xef4: ['xef4', 'xenon tetrafluoride'],
};
export const matchMolecule = (q: string): MoleculePreset =>
  matchBy(MOLECULES, q, 'molecule', (m) => [m.id, plain(m.formula), m.name, ...(MOL_ALIASES[m.id] ?? [])], moleculeList);

const EL_ALIASES: Record<string, string> = { aluminum: 'al', sulphur: 's' };
const ROMAN_CHARGE: Record<string, number> = { i: 1, ii: 2, iii: 3 };

/** Match an element (Z = 1–36) or ion string (e.g. "iron", "Fe", "Fe2+", "Fe²⁺", "Fe+2", "iron(III)", "O2-", "26"). */
export function matchElementOrIon(q: string): { el: ElementInfo; parsedCharge?: number } {
  const raw = String(q ?? '').trim();
  if (!raw) throw new Error('Specify an element (Z = 1–36) by symbol, name, atomic number, or ion (e.g. "Fe", "iron", "Fe2+", "Cu²⁺").');
  const zNum = raw.match(/^z\s*=?\s*(\d+)$/i) ?? raw.match(/^(\d+)$/);
  if (zNum) {
    const z = Number(zNum[1]);
    const el = ELEMENTS.find((e) => e.z === z);
    if (!el) throw new Error(`Atomic number ${z} is outside the lab range (Z = 1–36, H to Kr).`);
    return { el };
  }
  let parsedCharge: number | undefined;
  let base = raw
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => String(SUPS.indexOf(c)))
    .replace(/[₀-₉]/g, (c) => String(SUBS.indexOf(c)))
    .replace(/⁺/g, '+').replace(/[⁻−–]/g, '-')
    .replace(/\b(atom|ion)\b/gi, '').trim();
  const rom = base.match(/\((i{1,3})\)\s*$/i);
  if (rom) {
    parsedCharge = ROMAN_CHARGE[rom[1].toLowerCase()];
    base = base.slice(0, rom.index).trim();
  } else {
    const ch1 = base.match(/[\s^]*(\d)?([+-])$/);
    const ch2 = base.match(/[\s^]*([+-])(\d)$/);
    if (ch1) {
      const mag = ch1[1] ? Number(ch1[1]) : 1;
      parsedCharge = ch1[2] === '+' ? mag : -mag;
      base = base.slice(0, ch1.index).trim();
    } else if (ch2) {
      const mag = Number(ch2[2]);
      parsedCharge = ch2[1] === '+' ? mag : -mag;
      base = base.slice(0, ch2.index).trim();
    }
  }
  let k = norm(base);
  if (EL_ALIASES[k]) k = EL_ALIASES[k];
  const el = ELEMENTS.find((e) => e.sym.toLowerCase() === k || e.name.toLowerCase() === k);
  if (!el) throw new Error(`No element in Z = 1–36 matches "${raw}". Use a symbol or name from H (Z = 1) to Kr (Z = 36).`);
  return { el, parsedCharge };
}

export function validateCharge(el: ElementInfo, q: number): number {
  const c = Math.round(q);
  if (c < -2 || c > 3) throw new Error(`Charge ${c} is outside the lab range (−2 to +3).`);
  if (c > el.z) throw new Error(`${el.sym} (Z = ${el.z}) cannot have charge +${c}.`);
  if (el.z === 1 && c < -1) throw new Error('Hydrogen charge cannot be below −1.');
  if (el.group === 18 && c !== 0) throw new Error(`${el.name} is a noble gas; the lab keeps its charge at 0.`);
  return c;
}

const ORB_ALIASES: Record<string, string[]> = {
  '1s': ['1s'],
  '2s': ['2s'],
  '2px': ['2px', 'px'],
  '2py': ['2py', 'py'],
  '2pz': ['2pz', 'pz'],
  '3dxy': ['3dxy', 'dxy'],
  '3dx2y2': ['3dx2y2', '3dx2-y2', 'dx2y2', 'dx2-y2'],
  '3dz2': ['3dz2', 'dz2'],
};
export const matchOrbital = (q: string): OrbitalDef =>
  matchBy(ORBITAL_DEFS, q, '3D orbital', (o) => [o.id, o.name, ...(ORB_ALIASES[o.id] ?? [])], orbitalList);

export function matchFirstIE(q: string): FirstIE {
  const { el } = matchElementOrIon(q);
  const hit = FIRST_IE.find((e) => e.z === el.z);
  if (!hit) throw new Error(`1st IE graph covers H (Z = 1) to Ca (Z = 20); ${el.name} (Z = ${el.z}) is outside that range.`);
  return hit;
}

export function matchSuccIE(q: string): SuccessiveEntry {
  const k = norm(q);
  const hit = SUCCESSIVE_IE.find((s) => s.sym.toLowerCase() === k || s.name.toLowerCase() === k || (EL_ALIASES[k] && s.sym.toLowerCase() === EL_ALIASES[k]));
  if (hit) return hit;
  throw new Error(`No successive-IE dataset matches "${q}". ${succList()}`);
}

const LAT_ALIASES: Record<string, string[]> = {
  nacl: ['nacl', 'sodium chloride', 'salt', 'ionic'],
  diamond: ['diamond'],
  graphite: ['graphite'],
  graphene: ['graphene'],
  copper: ['copper', 'cu', 'metal', 'metallic'],
  iodine: ['iodine', 'i2'],
  ice: ['ice', 'h2o', 'water'],
};
export const matchLattice = (q: string): LatticeInfo =>
  matchBy(LATTICES, q, 'crystal lattice', (l) => [l.id, l.name, l.formula, ...(LAT_ALIASES[l.id] ?? [])], latticeList);

export function matchImf(q: string): ImfKind {
  const k = norm(q);
  if (/london|dispers|vanderwaals|vdw|induced/.test(k)) return 'london';
  if (/dipole|permanent|pdd/.test(k)) return 'dipole';
  if (/hbond|hydrogen/.test(k)) return 'hbond';
  throw new Error(`No intermolecular force matches "${q}". ${imfList()}`);
}

export function matchTrend(q: string): 'hydrides' | 'alkanes' {
  const k = norm(q);
  if (/hydride|group|water|hf|hcl|nh3/.test(k)) return 'hydrides';
  if (/alkane|branch|isomer|pentane/.test(k)) return 'alkanes';
  throw new Error(`No boiling-point trend matches "${q}". Use "hydrides" or "alkanes".`);
}

const SAMPLE_ALIASES: Record<string, string[]> = {
  mg: ['mg', 'magnesium'],
  cl2: ['cl2', 'cl', 'chlorine'],
  br2: ['br2', 'br', 'bromine'],
  b: ['b', 'boron'],
  ne: ['ne', 'neon'],
};
export function matchSample(q: string): SamplePreset | 'custom' {
  if (norm(q) === 'custom') return 'custom';
  return matchBy(SAMPLES, q, 'mass spec sample', (s) => [s.id, s.name, s.formula, ...(SAMPLE_ALIASES[s.id] ?? [])], sampleList);
}

export function matchTopic(q: string): Topic | 'all' {
  const k = norm(q);
  const hit = TOPICS.find(([id, nm]) => norm(id) === k || norm(nm).includes(k));
  if (hit) return hit[0];
  throw new Error(`No practice topic matches "${q}". ${topicList()}`);
}

/* ---------- plain-text readouts ---------- */
export function describeShapes(p: ShapesPrefs): string {
  const mol = MOLECULES.find((m) => m.id === p.preset) ?? MOLECULES[0];
  const built = buildVsepr(p.bp, p.lp);
  if (p.mode === 'preset') {
    const dip = netDipole(mol.central, mol.bonds);
    const outers = [...new Set(mol.bonds.map((b) => b.el))].filter((e) => EN[e] !== undefined && e !== mol.central);
    const enStr = EN[mol.central] && outers.length
      ? `EN(${mol.central}) = ${EN[mol.central].toFixed(2)}, ${outers.map((e) => `EN(${e}) = ${EN[e].toFixed(2)}`).join(', ')}, max ΔEN = ${dip.deltaEN.toFixed(2)}.`
      : '';
    return [
      `Shapes & polarity (preset): ${plain(mol.formula)} (${mol.name})`,
      `Geometry: ${mol.shape}, bond angle ${mol.angle} (${mol.bp} bonding region${mol.bp === 1 ? '' : 's'}, ${mol.lp} lone pair${mol.lp === 1 ? '' : 's'}).`,
      `Polarity: ${mol.polar ? 'Polar' : 'Non-polar'} — ${mol.polarWhy}`,
      ...(enStr ? [enStr] : []),
      `Overlays: lone pairs ${p.showLP ? 'on' : 'off'}, bond angles ${p.showAngles ? 'on' : 'off'}, dipoles ${p.showDipoles ? 'on' : 'off'}.`,
      `Key facts: ${mol.facts.join(' ')}`,
    ].join('\n');
  }
  return [
    `Shapes & polarity (VSEPR builder): AX${p.bp}${p.lp ? `E${p.lp}` : ''} (${p.bp} BP, ${p.lp} LP; total regions ${p.bp + p.lp}, range 2–6).`,
    `Geometry: ${built.shape}, bond angle ${built.angle}. Polarity: ${built.polar ? 'Polar' : 'Non-polar'}.`,
    `Overlays: lone pairs ${p.showLP ? 'on' : 'off'}, bond angles ${p.showAngles ? 'on' : 'off'}, dipoles ${p.showDipoles ? 'on' : 'off'}.`,
    built.note,
  ].join('\n');
}

export function describeOrbitals(p: OrbitalsPrefs): string {
  const el = ELEMENTS.find((e) => e.z === p.z) ?? ELEMENTS[0];
  const occ = fillConfig(el.z, p.charge);
  const fullStr = formatConfig(occ, false);
  const shortStr = formatConfig(occ, true);
  const eTotal = Object.values(occ).reduce((a, b) => a + b, 0);
  const orb = ORBITAL_DEFS.find((o) => o.id === p.orbital) ?? ORBITAL_DEFS[0];
  const ionLabel = p.charge === 0 ? el.sym : p.charge === 1 ? `${el.sym}⁺` : p.charge === -1 ? `${el.sym}⁻` : p.charge > 0 ? `${el.sym}${sup(p.charge)}⁺` : `${el.sym}${sup(-p.charge)}⁻`;
  const boxes = SUBSHELLS.filter((s) => occ[s.id] > 0 || (s.id === '4s' && p.z >= 19))
    .map((s) => `${s.id}: [${boxStates(s.boxes, occ[s.id]).map((st) => (st === 2 ? '↑↓' : st === 1 ? '↑' : '·')).join('|')}]`).join('  ');
  return [
    `Orbitals & configuration: ${ionLabel} (${el.name}, Z = ${el.z}, charge = ${p.charge >= 0 ? '+' + p.charge : p.charge}, ${eTotal} electrons, ${el.block}-block).`,
    `Configuration (showing ${p.shorthand ? 'noble-gas shorthand' : 'full'}): ${fullStr}${shortStr !== fullStr ? ` (shorthand: ${shortStr})` : ''}.`,
    `Electrons-in-boxes: ${boxes}`,
    `3D orbital cloud: ${orb.name} (${orb.shape}, axes ${p.showAxes ? 'on' : 'off'}) — ${orb.note}`,
    ...(el.exception && p.charge === 0 ? [`Exception: ${el.exception}`] : []),
    ...(p.z >= 21 && p.z <= 30 && p.charge > 0 ? ['Note: 4s fills before 3d and empties before 3d when forming d-block cations.'] : []),
  ].join('\n');
}

export function describeIE(p: IePrefs, mystery?: { hidden: boolean; sym: string; name: string; group: number; values: number[]; shells: number[] }): string {
  if (p.mode === 'first') {
    const cur = FIRST_IE.find((e) => e.z === p.selectedZ) ?? FIRST_IE[7];
    return [
      `Ionisation energy (1st IE trends, H to Ca): ${cur.name} (${cur.sym}, Z = ${cur.z}, Period ${cur.period}, Group ${cur.group}).`,
      `1st IE = ${cur.ie1} kJ mol⁻¹, covalent radius = ${cur.radiusPm == null ? '— (noble gas)' : `${cur.radiusPm} pm`}, config = ${cur.config}. Radius overlay: ${p.showRadius ? 'on' : 'off'}.`,
      cur.note,
    ].join('\n');
  }
  if (p.mystery && mystery?.hidden) {
    return [
      `Ionisation energy (Successive IEs — Mystery challenge active).`,
      `Successive IE values (kJ mol⁻¹): ${mystery.values.map((v, i) => `IE${i + 1}=${v}`).join(', ')}.`,
      `The element’s identity and group are hidden for the student to deduce from the big jump — do not reveal the element name or group.`,
    ].join('\n');
  }
  const entry = (p.mystery && mystery ? mystery : SUCCESSIVE_IE.find((s) => s.sym === p.succSym) ?? SUCCESSIVE_IE[2]);
  const j = firstJump(entry.values);
  return [
    `Ionisation energy (Successive IEs): ${entry.name} (${entry.sym}, Group ${entry.group}).`,
    `Values (kJ mol⁻¹): ${entry.values.map((v, i) => `IE${i + 1}=${v}`).join(', ')}.`,
    `First big jump: IE${j.after} → IE${j.after + 1} (×${j.ratio.toFixed(1)}) → ${j.after} outer-shell electrons (shells ${entry.shells.slice().reverse().join(', ')}).`,
  ].join('\n');
}

export function describeLattice(p: LatticesPrefs): string {
  const l = LATTICES.find((x) => x.id === p.id) ?? LATTICES[0];
  const canShear = p.id === 'nacl' || p.id === 'copper' || p.id === 'graphite' || p.id === 'iodine';
  const hasE = p.id === 'copper' || p.id === 'graphite' || p.id === 'graphene';
  return [
    `Crystal lattice: ${l.name} (${l.formula}) — ${l.structure}.`,
    `Shear stress: ${canShear ? `${Math.round(p.shear * 100)}% (range 0–100%)` : 'rigid lattice (cannot shear)'}${hasE ? `; delocalised e⁻ ${p.showElectrons ? 'shown' : 'hidden'}` : ''}.`,
    `Bonding: ${l.bonding}. Melting point: ${l.mp}.`,
    `Conductivity: solid — ${l.conductSolid}; molten/aq — ${l.conductMolten}.`,
    `Under stress (${l.shearTitle}): ${l.shearText}`,
  ].join('\n');
}

export function describeImf(p: ImfPrefs): string {
  const info = IMF_INFO[p.kind];
  const cloud = p.electrons === 1 ? 'Small (F₂ / CH₄)' : p.electrons === 2 ? 'Medium (Cl₂)' : 'Large (I₂)';
  const trendText = p.trend === 'hydrides'
    ? 'Hydride boiling points (°C): ' + HYDRIDES.map((s) => `${s.group}: ${s.points.map((pt) => `${pt.formula} ${pt.bp}`).join(', ')}`).join(' | ')
    : 'C₅H₁₂ alkane isomer boiling points (°C): ' + ALKANE_ISOMERS.map((a) => `${a.name} (${a.branches} branches): ${a.bp} °C`).join('; ');
  return [
    `Intermolecular forces: ${info.name}${p.kind === 'london' ? ` (electron cloud size: ${p.electrons}/3 — ${cloud})` : ''}.`,
    `Strength: ${info.strength}. Occurs in: ${info.occursIn}.`,
    info.summary,
    `Boiling-point graph shown: ${p.trend}. ${trendText}`,
    `Key facts: ${info.facts.join(' ')}`,
  ].join('\n');
}

export function describeMassSpec(p: MassPrefs): string {
  const preset = SAMPLES.find((s) => s.id === p.sample) ?? SAMPLES[1];
  const isotopes = p.custom
    ? [{ mass: p.m1, pct: p.p1, label: `${sup(p.m1)}X⁺` }, { mass: p.m2, pct: Math.max(0, 100 - p.p1), label: `${sup(p.m2)}X⁺` }]
    : preset.isotopes;
  const peaks = p.custom
    ? (p.m1 === p.m2 ? [{ mz: p.m1, rel: 100, label: `${sup(p.m1)}X⁺` }] : isotopes.map((x) => ({ mz: x.mass, rel: x.pct, label: x.label })))
    : preset.peaks;
  const ar = calcAr(isotopes);
  return [
    `Mass spectrometer (${p.mode === 'tof' ? 'TOF drift tube' : 'magnetic deflection'}): ${p.custom ? 'Custom two-isotope mix' : `${preset.name} (${preset.formula})`}.`,
    `Isotopes: ${isotopes.map((x) => `${x.label} mass ${x.mass} (${x.pct}%)`).join(', ')}.`,
    `Spectrum peaks (m/z : relative abundance): ${peaks.map((pk) => `${pk.mz} (${pk.label}, ${pk.rel})`).join('; ')}.`,
    `Calculated Ar = ${ar.toFixed(1)} (${ar.toFixed(3)} to 3 d.p.).`,
    ...(p.custom ? ['Custom ranges: mass 10–100, isotope 1 abundance 5–95%.'] : [preset.note]),
  ].join('\n');
}
