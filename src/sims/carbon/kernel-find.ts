/* Carbon Alchemy for Kernel: the pure half. Loose names → the lab's compounds, reagents and tests (IUPAC, common
   names, structural or molecular formulae), shortest routes over the lab's own reaction table, the bench conditions a
   reaction needs, and plain-text write-ups. No DOM, no UI state: kernel.ts does the on-screen part. */

import { plain } from '../../lib/chem';
import { molFormula } from '../../lib/molecule';
import { CP, RG, RGLIST, RX, TESTS, LABSET, CLASSN, FAM, CATS, TEMPS, explore, route, rxPlain, type Bench, type Reaction, type Cat, type Temp } from './data';

/** Something the student or the AI typed doesn't name anything in the lab: the message lists what would. */
const fail = (msg: string): never => { throw new Error(msg); };

/* ---------- names ---------- */
const SUBS: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '⁺': '+', '⁻': '-', '⁰': '0', '¹': '1', '²': '2', '³': '3' };
const undo = (s: string) => s.replace(/[₀-₉⁺⁻⁰¹²³]/g, (c) => SUBS[c] ?? c).replace(/[–—−]/g, '-').trim();
/** letters and digits only, lower case */
const key = (s: string) => undo(s).toLowerCase().replace(/[^a-z0-9]/g, '');
/** name with its locants pulled out, so propan-2-ol, 2-propanol and propan 2 ol all meet: [letters, sorted digits] */
const split = (s: string): [string, string] => { const k = key(s); return [k.replace(/\d/g, ''), k.replace(/\D/g, '').split('').sort().join('')]; };

/** common and older names → the lab's names */
const ALIAS: Record<string, string> = {
  'acetic acid': 'ethanoic acid', 'ethanoic': 'ethanoic acid', 'acetone': 'propanone', 'dimethyl ketone': 'propanone', 'acetaldehyde': 'ethanal',
  'formaldehyde': 'methanal', 'propionaldehyde': 'propanal', 'methyl ethyl ketone': 'butanone', 'mek': 'butanone', 'butan-2-one': 'butanone',
  'acetophenone': 'phenylethanone', 'benzyl alcohol': 'phenylmethanol', 'ethylene': 'ethene', 'propylene': 'propene', 'isobutene': '2-methylpropene',
  'isobutylene': '2-methylpropene', 'toluene': 'methylbenzene', 'aniline': 'phenylamine', 'aminobenzene': 'phenylamine', 'ethylene glycol': 'ethane-1,2-diol',
  'glycol': 'ethane-1,2-diol', 'propylene glycol': 'propane-1,2-diol', 'lactic acid': '2-hydroxypropanoic acid', 'acetonitrile': 'ethanenitrile',
  'methyl cyanide': 'ethanenitrile', 'ethyl cyanide': 'propanenitrile', 'propionitrile': 'propanenitrile', 'acetyl chloride': 'ethanoyl chloride',
  'propionyl chloride': 'propanoyl chloride', 'acetamide': 'ethanamide', 'propionamide': 'propanamide', 'acetanilide': 'N-phenylethanamide',
  'propionic acid': 'propanoic acid', 'isopropanol': 'propan-2-ol', 'isopropyl alcohol': 'propan-2-ol', 'ipa': 'propan-2-ol', 'n-propanol': 'propan-1-ol',
  'propyl alcohol': 'propan-1-ol', 'ethyl alcohol': 'ethanol', 'alcohol': 'ethanol', 'methyl alcohol': 'methanol', 'tert-butanol': '2-methylpropan-2-ol',
  't-butanol': '2-methylpropan-2-ol', 'tert-butyl alcohol': '2-methylpropan-2-ol', 'sec-butanol': 'butan-2-ol', 'sec-butyl alcohol': 'butan-2-ol',
  'ethyl bromide': 'bromoethane', 'ethyl chloride': 'chloroethane', 'ethyl iodide': 'iodoethane', 'methyl bromide': 'bromomethane', 'methyl chloride': 'chloromethane',
  'propyl bromide': '1-bromopropane', 'n-propyl bromide': '1-bromopropane', 'isopropyl bromide': '2-bromopropane', 'tert-butyl bromide': '2-bromo-2-methylpropane',
  't-butyl bromide': '2-bromo-2-methylpropane', 'tert-butyl chloride': '2-chloro-2-methylpropane', 't-butyl chloride': '2-chloro-2-methylpropane',
  'carbolic acid': 'phenol', 'ethylene dibromide': '1,2-dibromoethane', 'polyethylene': 'poly(ethene)', 'polythene': 'poly(ethene)', 'polyethene': 'poly(ethene)',
  'polypropylene': 'poly(propene)', 'polypropene': 'poly(propene)', 'aminoethanoic acid': 'glycine (2-aminoethanoic acid)', 'glycine': 'glycine (2-aminoethanoic acid)',
  'benzoic': 'benzoic acid', 'nitrobenzol': 'nitrobenzene', 'ethyl amine': 'ethylamine', 'aminoethane': 'ethylamine', 'aminomethane': 'methylamine',
  '1-aminopropane': 'propylamine', 'propan-1-amine': 'propylamine', 'ethanamine': 'ethylamine', 'methanamine': 'methylamine', 'phenylethanoate': 'phenyl ethanoate',
  'diazonium': 'benzenediazonium chloride', 'azo dye': '4-hydroxyazobenzene',
};
/** older prefixes and endings inside longer names (isopropyl ethanoate, tert-butyl acetate…) */
const PARTS: [RegExp, string][] = [[/\biso-?propyl\b/g, '1-methylethyl'], [/\b(tert|t)-?butyl\b/g, '1,1-dimethylethyl'], [/\bsec-?butyl\b/g, '1-methylpropyl'],
  [/\bn-/g, ''], [/\bacetate\b/g, 'ethanoate'], [/\bpropionate\b/g, 'propanoate'], [/\bbenzyl alcohol\b/g, 'phenylmethanol']];

const IDS = Object.keys(CP);
/** every name a compound answers to: its lab name, the parts of a name like "glycine (2-aminoethanoic acid)", aliases */
const NAMES = new Map<string, string[]>(IDS.map((id) => {
  const n = CP[id].n, m = /^(.*?)\s*\((.*)\)$/.exec(n);
  return [id, m && !n.startsWith('poly') ? [n, m[1], m[2]] : [n]];
}));
const BYNAME = new Map<string, string>(IDS.map((id) => [CP[id].n.toLowerCase(), id]));
for (const [a, n] of Object.entries(ALIAS)) { const id = BYNAME.get(n.toLowerCase()); if (id) NAMES.get(id)!.push(a); }

/** a formula as typed (CH3CH2OH, C2H5OH, CH₃COOH) → a comparable string */
const fkey = (s: string) => undo(s).replace(/\^/g, '').replace(/[\s·.\-–]/g, '').replace(/C2H5/g, 'CH3CH2').replace(/C3H7/g, 'CH3CH2CH2').replace(/COOH$/, 'COOH');
const looksLikeFormula = (s: string) => /^[A-Z(][A-Za-z0-9()=\-^+\s₀-₉]*$/.test(undo(s).replace(/\s/g, '')) && /[A-Z].*[A-Z0-9]|[0-9]/.test(s) && !/[a-z]{3}/.test(s);

const label = (id: string) => `${CP[id].n} (${plain(CP[id].st)})`;
const list = (ids: string[], n = 10) => ids.slice(0, n).map(label).join('; ') + (ids.length > n ? `; … ${ids.length - n} more` : '');

/** The lab compound a loose name or formula means. Throws, listing candidates, when it is unknown or ambiguous. */
export function findCompound(q: string): string {
  const raw = String(q ?? '').trim();
  if (!raw) fail('No compound given.');
  if (CP[raw]) return raw;
  let low = undo(raw).toLowerCase().replace(/\s+/g, ' ');
  for (const [re, to] of PARTS) low = low.replace(re, to);
  const lk = key(low);
  // 1. a name or alias, letter for letter
  const exact = IDS.filter((id) => NAMES.get(id)!.some((n) => key(n) === lk || key(n) === key(raw)));
  if (exact.length === 1) return exact[0];
  // 2. a formula: structural first, then molecular (which can be ambiguous between isomers)
  if (looksLikeFormula(raw)) {
    const fk = fkey(raw);
    const st = IDS.filter((id) => fkey(CP[id].st) === fk);
    if (st.length === 1) return st[0];
    const mf = IDS.filter((id) => fkey(molFormula(CP[id].smi)) === fk);
    if (mf.length === 1) return mf[0];
    if (mf.length > 1 || st.length > 1) fail(`“${raw}” fits more than one compound in the lab: ${list(mf.length ? mf : st)}. Give the name.`);
  }
  // 3. the same name with its locants moved (2-propanol = propan-2-ol), then with them left out (propanol)
  const [l, d] = split(low);
  const loc = IDS.filter((id) => NAMES.get(id)!.some((n) => { const [a, b] = split(n); return a === l && b === d; }));
  if (loc.length === 1) return loc[0];
  // (only when the lab's own name has no locants, so butan-1-ol never turns into butan-2-ol)
  const lets = IDS.filter((id) => NAMES.get(id)!.some((n) => { const [a, b] = split(n); return a === l && (!d || !b); }));
  if (lets.length === 1) return lets[0];
  if (lets.length > 1) fail(`“${raw}” could be ${list(lets)}. Say which.`);
  // nothing: suggest names that share a stem
  const stem = l.slice(0, Math.max(4, Math.min(6, l.length)));
  const near = IDS.filter((id) => NAMES.get(id)!.some((n) => { const a = split(n)[0]; return a.includes(l) || l.includes(a) || a.startsWith(stem); }));
  return fail(`No compound called “${raw}” in Carbon Alchemy.${near.length ? ` Did you mean: ${list(near, 8)}?` : ''} The lab has ${IDS.length} compounds (hydrocarbons, halogenoalkanes, alcohols, carbonyls, acids and derivatives, nitrogen compounds); carbon_state lists the ones the student has.`);
}

/* ---------- reagents ---------- */
const RGTXT = (id: string) => `${plain(RG[id].f)} (${plain(RG[id].n)})`;
/** key phrases → reagent card, first match wins (so "KBr / H2SO4" is KBr, not conc. H2SO4) */
const RG_RULES: [RegExp, string][] = [
  [/hno3|nitrat|nitric/, 'nitrate'], [/hno2|nano2|nitrous/, 'hno2'],
  [/kbr|nabr|potassium bromide|sodium bromide/, 'kbr'], [/hbr|hydrogen bromide|hydrobromic/, 'hbr'],
  [/(dichromate|cr2o7|k2cr2o7|na2cr2o7).*(reflux)|reflux.*(dichromate|cr2o7)/, 'crreflux'],
  [/(dichromate|cr2o7).*(distil)|distil.*(dichromate|cr2o7)/, 'crdist'], [/dichromate|cr2o7/, 'cr'],
  [/kmno4|manganate|permanganate|mno4/, 'kmno4'], [/lialh4|lithium alumin|lithal/, 'lialh4'],
  [/hcn|hydrogen cyanide/, 'hcn'], [/(h2|hydrogen).*(ni\b|nickel)/, 'h2ni'], [/^(h2|hydrogen|hydrogen gas)(\s*\/?\s*(pt|platinum))?$/, 'h2'],
  [/sn\b.*hcl|tin/, 'snhcl'], [/pcl5|phosphorus.*chloride|phosphorus pentachloride/, 'pcl5'],
  [/(koh|naoh|hydroxide|oh-).*(ethanol|alcohol|eth\b|ethanolic|alc)|(ethanolic|alcoholic).*(koh|naoh|hydroxide)/, 'kohalc'],
  [/(koh|naoh|hydroxide|oh-|alkali)/, 'naoh'],
  [/kcn|nacn|cyanide|potassium cyanide|sodium cyanide/, 'kcn'],
  [/nh3|ammonia/, 'nh3'], [/cl2|chlorine/, 'cl2uv'],
  [/(br2|bromine).*(uv|light|sunlight)/, 'br2uv'], [/(br2|bromine).*(fe|iron|febr3|alcl3|carrier)/, 'br2fe'], [/br2|bromine/, 'br2'],
  [/nahco3|na2co3|carbonate|bicarb/, 'na2co3'], [/h3po4|phosphoric|steam/, 'steam'],
  [/h2so4|sulfuric|sulphuric|dehydrat/, 'h2so4'], [/hcl|hydrochloric/, 'hcl'],
  [/^(h2o|water)$/, 'water'], [/\bmg\b|magnesium/, 'mg'], [/co2|carbon dioxide|dry ice/, 'co2'],
  [/pressure|polymer/, 'poly'],
];
/** The reagent card a loose phrase means, or null if it isn't a reagent (it may be a compound). Throws when ambiguous. */
export function findReagent(q: string): string | null {
  const raw = String(q ?? '').trim();
  if (!raw) return null;
  if (RG[raw]) return raw;
  const low = undo(raw).toLowerCase(), k = key(raw);
  // a bare KOH is either card: say which, since they do different things
  if (/^koh$|^potassium hydroxide$/.test(low.trim())) fail('KOH could be aqueous (NaOH(aq) card: substitution, gives an alcohol) or ethanolic (KOH(eth) card: elimination, gives an alkene). Say "KOH in ethanol" or "aqueous NaOH".');
  const ex = RGLIST.filter((id) => key(RG[id].n) === k);
  if (ex.length === 1) return ex[0];
  for (const [re, id] of RG_RULES) if (re.test(low)) return id;
  const f = RGLIST.filter((id) => key(plain(RG[id].f)) === k);
  if (f.length === 1) return f[0];
  return null;
}
export const reagentList = () => RGLIST.map(RGTXT).join('; ');
export const reagentText = RGTXT;

/* ---------- tests ---------- */
const TEST_RULES: [RegExp, string][] = [
  [/tollen|silver mirror|ammoniacal silver/, 'tollens'], [/fehling|benedict/, 'fehling'], [/dnph|brady|dinitrophenylhydrazine/, 'dnph'],
  [/iodoform|tri-?iodomethane|i2.*naoh|iodine/, 'iodo'], [/agno3|silver nitrate|halide|halogen/, 'agno3'], [/bromine|br2/, 'brw'],
  [/dichromate|cr2o7|oxidi/, 'crox'], [/nahco3|carbonate|bicarb|effervesc/, 'carb'], [/pcl5|phosphorus/, 'pcl5'],
  [/litmus|ph\b|indicator/, 'litmus'], [/smell|odou?r|waft|sniff/, 'smell'],
];
/** The identification test a loose phrase means. Throws, listing the tests, when nothing matches. */
export function findTest(q: string): string {
  const raw = String(q ?? '').trim(), low = undo(raw).toLowerCase(), k = key(raw);
  const t = TESTS.find((x) => x.id === raw || key(x.n) === k || key(plain(x.f)) === k);
  if (t) return t.id;
  for (const [re, id] of TEST_RULES) if (re.test(low)) return id;
  return fail(`No test called “${raw}”. The tests are: ${TESTS.map((x) => x.n).join('; ')} (or "all").`);
}

/* ---------- routes ---------- */
/** The compounds the student can use in the Lab: what they have discovered, plus the whole core set in free play. */
export const usable = (found: string[], free: boolean) => [...new Set([...found, ...(free ? LABSET : [])])];

/** A shortest route (fewest rounds, then the hand-written reactions first) to target from the start compounds, over the
    whole reaction table, rule-made reactions included. null when it can't be made from them. */
export function planRoute(target: string, start: string[]): Reaction[] | null {
  const from = start.filter((c) => c !== target);
  if (!from.length) return null;
  const ex = explore(from, RX);
  return ex.depth.has(target) ? route(target, ex) : null;
}

/** The reactions that make a compound, as text (for "can't make it" messages). */
export const madeBy = (id: string) => RX.filter((r) => r.p.includes(id)).map((r) => `${CP[r.a].n} + ${RG[r.b] ? RGTXT(r.b) : CP[r.b].n}`);
/** What a compound reacts with in the lab, as text. */
export const usesOf = (id: string) => RX.filter((r) => r.a === id || r.b === id).map((r) => {
  const other = r.a === id ? r.b : r.a;
  return `${RG[other] ? RGTXT(other) : CP[other].n}${r.need ? ` [${needPlain(r)}]` : ''} → ${r.p.map((p) => CP[p].n).join(' + ')}`;
});

/* ---------- the bench ---------- */
const TEMPN = Object.fromEntries(TEMPS.map(([t, n]) => [t, n])) as Record<Temp, string>;
const CATN = Object.fromEntries(CATS.map(([c, f]) => [c, plain(f)])) as Record<Cat, string>;
export const TEMP_IDS = TEMPS.map(([t]) => t) as Temp[];
export const CAT_IDS = CATS.map(([c]) => c) as Cat[];
/** the conditions a reaction needs, in words */
export const needPlain = (r: Reaction) => !r.need ? '' : [r.need.cat ? CATN[r.need.cat[0]] + ' catalyst' : '', r.need.temp ? TEMPN[r.need.temp[0]].toLowerCase() : '', r.need.uv ? 'UV light' : '', r.need.dry ? 'dry' : ''].filter(Boolean).join(', ');
/** The bench set so that a reaction's needs are met, changing as little as possible. */
export function benchFor(r: Reaction, b: Bench): Bench {
  const n = r.need; if (!n) return { ...b };
  return { temp: n.temp && !n.temp.includes(b.temp) ? n.temp[0] : b.temp, cat: n.cat && !(b.cat && n.cat.includes(b.cat)) ? n.cat[0] : b.cat, uv: b.uv || !!n.uv, dry: b.dry || !!n.dry };
}
export const benchPlain = (b: Bench) => [TEMPN[b.temp].toLowerCase(), b.cat ? CATN[b.cat] + ' catalyst' : 'no catalyst', b.uv ? 'UV light on' : '', b.dry ? 'dry' : ''].filter(Boolean).join(', ');

/* ---------- write-ups ---------- */
export const cpLabel = label;
export const cpName = (id: string) => CP[id].n;
export const cpClass = (id: string) => CLASSN[CP[id].cls];
/** a reaction as the AI should read it: equation, type, conditions, note */
export const rxText = (r: Reaction) => rxPlain(r) + (r.need ? `\nBench: ${needPlain(r)}` : '');
export const stepLine = (r: Reaction) => `${CP[r.a].n} + ${RG[r.b] ? RGTXT(r.b) : CP[r.b].n}${r.need ? ` [${needPlain(r)}]` : ''} → ${r.p.map((p) => CP[p].n).join(' + ')} (${FAM[r.fam][0]}: ${r.mech}; ${plain(r.cond)})`;
/** HTML from a toast → plain text */
export const unhtml = (h: string) => h.replace(/<span class="fix">/g, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
