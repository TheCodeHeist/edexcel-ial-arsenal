/* Carbon Alchemy: chemistry data. Compounds (with SMILES for drawing), reagents, reactions, "no reaction"
   explanations, identification tests, route maps and preparation procedures for Edexcel IAL organic chemistry,
   plus the pure logic over them (reaction lookup, reachability, challenge generation). No DOM, no UI state. */

import { chem, esc, plain } from '../../lib/chem';
import { shuffle, pick, unique } from '../../lib/util';
import { molFormula } from '../../lib/molecule';

export type ClassId = 'alkane' | 'alkene' | 'arene' | 'polymer' | 'halo' | 'haloarene' | 'grignard' | 'alc1' | 'alc2' | 'alc3' | 'diol' | 'phenol'
  | 'ald' | 'ket' | 'nitrile' | 'hnitrile' | 'acid' | 'salt' | 'acylcl' | 'ester' | 'amine' | 'amide' | 'nitroarene' | 'diazonium' | 'azo' | 'aminoacid';
export type Fam = 'redox' | 'subst' | 'addn' | 'elim' | 'cond' | 'acid';
export type Level = 'AS' | 'A2';
export type ReagentGroup = 'hal' | 'ox' | 'ab' | 'nu' | 'sp';
/** st: structural formula (chem() notation) */
export interface Compound { id: string; n: string; smi: string; st: string; cls: ClassId; note?: string }
export interface Reagent { id: string; f: string; n: string; g: ReagentGroup }
/** a + b → p. b is a reagent id or a second compound id. */
export interface Reaction { id: number; a: string; b: string; p: string[]; fam: Fam; mech: string; cond: string; eq: string[]; unit: Level; note: string }
export interface Test { id: string; n: string; f: string; proc: string; pos: string; obs: string; from: string }
export interface TestVis { to?: string; ppt?: string; mirror?: boolean; bubbles?: boolean; fumes?: boolean; paper?: [string, string]; waft?: boolean }
export interface TestResult { pos: boolean; obs: string; vis: TestVis }
/** node: [column, row, label, structure, compound id?] */
export interface Flow { id: string; title: string; blurb: string; nodes: Record<string, [number, number, string | null, string | null, string?]>; edges: [string, string, string, string, Fam][] }
export interface Technique { id: string; n: string; app: string | null; what: string; why: string; tips: string[] }
export interface Prep { id: string; n: string; kind: string; cid: string; steps: [string, string][] }

// Compounds: id, name, SMILES (for drawing), structural formula, class
export const CP: Record<string, Compound> = {};
const M = (id: string, n: string, smi: string, st: string, cls: ClassId, o: { note?: string } = {}) => { CP[id] = { id, n, smi, st, cls, ...o }; };
// hydrocarbons
M('C1', 'methane', 'C', 'CH4', 'alkane');
M('C2', 'ethane', 'CC', 'CH3CH3', 'alkane');
M('C3', 'propane', 'CCC', 'CH3CH2CH3', 'alkane');
M('chx', 'cyclohexane', 'C1CCCCC1', 'C6H12', 'alkane');
M('ethene', 'ethene', 'C=C', 'CH2=CH2', 'alkene');
M('propene', 'propene', 'C=CC', 'CH2=CHCH3', 'alkene');
M('but2', 'but-2-ene', 'CC=CC', 'CH3CH=CHCH3', 'alkene');
M('mprop', '2-methylpropene', 'C=C(C)C', 'CH2=C(CH3)2', 'alkene');
M('chxe', 'cyclohexene', 'C1=CCCCC1', 'C6H10', 'alkene');
M('benzene', 'benzene', 'c1ccccc1', 'C6H6', 'arene');
M('tol', 'methylbenzene', 'Cc1ccccc1', 'C6H5CH3', 'arene');
M('pe', 'poly(ethene)', '*CC*', '–[CH2–CH2]n–', 'polymer');
M('pp', 'poly(propene)', '*CC(C)*', '–[CH2–CH(CH3)]n–', 'polymer');
// halogen compounds
M('clme', 'chloromethane', 'CCl', 'CH3Cl', 'halo');
M('brme', 'bromomethane', 'CBr', 'CH3Br', 'halo');
M('clet', 'chloroethane', 'CCCl', 'CH3CH2Cl', 'halo');
M('bret', 'bromoethane', 'CCBr', 'CH3CH2Br', 'halo');
M('iet', 'iodoethane', 'CCI', 'CH3CH2I', 'halo');
M('br1p', '1-bromopropane', 'CCCBr', 'CH3CH2CH2Br', 'halo');
M('br2p', '2-bromopropane', 'CC(Br)C', 'CH3CHBrCH3', 'halo');
M('brtb', '2-bromo-2-methylpropane', 'CC(C)(Br)C', '(CH3)3CBr', 'halo');
M('cltb', '2-chloro-2-methylpropane', 'CC(C)(Cl)C', '(CH3)3CCl', 'halo');
M('dbe', '1,2-dibromoethane', 'BrCCBr', 'CH2BrCH2Br', 'halo');
M('dbp', '1,2-dibromopropane', 'CC(Br)CBr', 'CH3CHBrCH2Br', 'halo');
M('brbz', 'bromobenzene', 'Brc1ccccc1', 'C6H5Br', 'haloarene');
M('mgme', 'methylmagnesium bromide', 'C[Mg]Br', 'CH3MgBr', 'grignard');
M('mget', 'ethylmagnesium bromide', 'CC[Mg]Br', 'CH3CH2MgBr', 'grignard');
M('mgph', 'phenylmagnesium bromide', 'Br[Mg]c1ccccc1', 'C6H5MgBr', 'grignard');
// alcohols & phenols
M('meoh', 'methanol', 'CO', 'CH3OH', 'alc1');
M('etoh', 'ethanol', 'CCO', 'CH3CH2OH', 'alc1');
M('p1ol', 'propan-1-ol', 'CCCO', 'CH3CH2CH2OH', 'alc1');
M('phmeoh', 'phenylmethanol', 'OCc1ccccc1', 'C6H5CH2OH', 'alc1');
M('p2ol', 'propan-2-ol', 'CC(O)C', 'CH3CH(OH)CH3', 'alc2');
M('b2ol', 'butan-2-ol', 'CCC(O)C', 'CH3CH2CH(OH)CH3', 'alc2');
M('phetoh', '1-phenylethanol', 'CC(O)c1ccccc1', 'C6H5CH(OH)CH3', 'alc2');
M('tbuoh', '2-methylpropan-2-ol', 'CC(C)(O)C', '(CH3)3COH', 'alc3');
M('mb2ol', '2-methylbutan-2-ol', 'CCC(C)(C)O', 'CH3CH2C(CH3)2OH', 'alc3');
M('diol', 'ethane-1,2-diol', 'OCCO', 'HOCH2CH2OH', 'diol');
M('pdiol', 'propane-1,2-diol', 'CC(O)CO', 'CH3CH(OH)CH2OH', 'diol');
M('phoh', 'phenol', 'Oc1ccccc1', 'C6H5OH', 'phenol');
M('tbp', '2,4,6-tribromophenol', 'Oc1c(Br)cc(Br)cc1Br', 'C6H2Br3OH', 'phenol');
// carbonyls
M('hcho', 'methanal', 'C=O', 'HCHO', 'ald');
M('mecho', 'ethanal', 'CC=O', 'CH3CHO', 'ald');
M('etcho', 'propanal', 'CCC=O', 'CH3CH2CHO', 'ald');
M('bzald', 'benzaldehyde', 'O=Cc1ccccc1', 'C6H5CHO', 'ald');
M('acetone', 'propanone', 'CC(=O)C', 'CH3COCH3', 'ket');
M('butanone', 'butanone', 'CCC(=O)C', 'CH3CH2COCH3', 'ket');
M('acph', 'phenylethanone', 'CC(=O)c1ccccc1', 'C6H5COCH3', 'ket');
// nitriles
M('mecn', 'ethanenitrile', 'CC#N', 'CH3CN', 'nitrile');
M('etcn', 'propanenitrile', 'CCC#N', 'CH3CH2CN', 'nitrile');
M('hn1', '2-hydroxypropanenitrile', 'CC(O)C#N', 'CH3CH(OH)CN', 'hnitrile');
M('hn3', '2-hydroxybutanenitrile', 'CCC(O)C#N', 'CH3CH2CH(OH)CN', 'hnitrile');
M('hn2', '2-hydroxy-2-methylpropanenitrile', 'CC(C)(O)C#N', '(CH3)2C(OH)CN', 'hnitrile');
// acids & derivatives
M('acoh', 'ethanoic acid', 'CC(=O)O', 'CH3COOH', 'acid');
M('pacoh', 'propanoic acid', 'CCC(=O)O', 'CH3CH2COOH', 'acid');
M('bzoh', 'benzoic acid', 'OC(=O)c1ccccc1', 'C6H5COOH', 'acid');
M('lact', '2-hydroxypropanoic acid', 'CC(O)C(=O)O', 'CH3CH(OH)COOH', 'acid');
M('hba', '2-hydroxybutanoic acid', 'CCC(O)C(=O)O', 'CH3CH2CH(OH)COOH', 'acid');
M('hmpa', '2-hydroxy-2-methylpropanoic acid', 'CC(C)(O)C(=O)O', '(CH3)2C(OH)COOH', 'acid');
M('naoac', 'sodium ethanoate', 'CC(=O)[O-].[Na+]', 'CH3COO^-Na^+', 'salt');
M('naprop', 'sodium propanoate', 'CCC(=O)[O-].[Na+]', 'CH3CH2COO^-Na^+', 'salt');
M('naphenox', 'sodium phenoxide', '[O-]c1ccccc1.[Na+]', 'C6H5O^-Na^+', 'salt');
M('accl', 'ethanoyl chloride', 'CC(=O)Cl', 'CH3COCl', 'acylcl');
M('prcl', 'propanoyl chloride', 'CCC(=O)Cl', 'CH3CH2COCl', 'acylcl');
M('bzcl', 'benzoyl chloride', 'ClC(=O)c1ccccc1', 'C6H5COCl', 'acylcl');
M('meoac', 'methyl ethanoate', 'CC(=O)OC', 'CH3COOCH3', 'ester');
M('etoac', 'ethyl ethanoate', 'CC(=O)OCC', 'CH3COOCH2CH3', 'ester');
M('etprop', 'ethyl propanoate', 'CCC(=O)OCC', 'CH3CH2COOCH2CH3', 'ester');
// nitrogen compounds
M('menh2', 'methylamine', 'CN', 'CH3NH2', 'amine');
M('etnh2', 'ethylamine', 'CCN', 'CH3CH2NH2', 'amine');
M('prnh2', 'propylamine', 'CCCN', 'CH3CH2CH2NH2', 'amine');
M('phnh2', 'phenylamine', 'Nc1ccccc1', 'C6H5NH2', 'amine');
M('etnh3cl', 'ethylammonium chloride', 'CC[NH3+].[Cl-]', 'CH3CH2NH3^+Cl^-', 'salt');
M('phnh3cl', 'phenylammonium chloride', '[NH3+]c1ccccc1.[Cl-]', 'C6H5NH3^+Cl^-', 'salt');
M('acnh2', 'ethanamide', 'CC(=O)N', 'CH3CONH2', 'amide');
M('pram', 'propanamide', 'CCC(=O)N', 'CH3CH2CONH2', 'amide');
M('nmeam', 'N-methylethanamide', 'CC(=O)NC', 'CH3CONHCH3', 'amide');
M('netam', 'N-ethylethanamide', 'CC(=O)NCC', 'CH3CONHCH2CH3', 'amide');
M('nphenam', 'N-phenylethanamide', 'CC(=O)Nc1ccccc1', 'CH3CONHC6H5', 'amide');
M('nitrobz', 'nitrobenzene', '{NO2|O2N}c1ccccc1', 'C6H5NO2', 'nitroarene');
M('diaz', 'benzenediazonium chloride', 'N#[N+]c1ccccc1.[Cl-]', 'C6H5N2^+Cl^-', 'diazonium');
M('azo', '4-hydroxyazobenzene', 'Oc1ccc(cc1)N=Nc1ccccc1', 'C6H5N=NC6H4OH', 'azo', { note: 'An azo dye (yellow–orange).' });
M('gly', 'glycine (2-aminoethanoic acid)', 'NCC(=O)O', 'H2NCH2COOH', 'aminoacid');
M('glyH', 'glycine cation (in acid)', '[NH3+]CC(=O)O.[Cl-]', '^+H3NCH2COOH Cl^-', 'salt');
M('glyNa', 'sodium glycinate (in alkali)', 'NCC(=O)[O-].[Na+]', 'H2NCH2COO^-Na^+', 'salt');

export const CLASSN: Record<ClassId, string> = { alkane: 'Alkane', alkene: 'Alkene', arene: 'Arene', polymer: 'Polymer', halo: 'Halogenoalkane', haloarene: 'Halogenoarene', grignard: 'Grignard reagent',
  alc1: 'Primary alcohol', alc2: 'Secondary alcohol', alc3: 'Tertiary alcohol', diol: 'Diol', phenol: 'Phenol', ald: 'Aldehyde', ket: 'Ketone',
  nitrile: 'Nitrile', hnitrile: 'Hydroxynitrile', acid: 'Carboxylic acid', salt: 'Salt', acylcl: 'Acyl chloride', ester: 'Ester', amine: 'Amine', amide: 'Amide',
  nitroarene: 'Nitroarene', diazonium: 'Diazonium salt', azo: 'Azo compound', aminoacid: 'Amino acid' };
export const GROUPS: [string, string, ClassId[] | null][] = [
  ['all', 'All', null],
  ['hc', 'Hydrocarbons', ['alkane', 'alkene', 'arene', 'polymer']],
  ['hal', 'Halogen & Mg', ['halo', 'haloarene', 'grignard']],
  ['oh', 'Alcohols & phenols', ['alc1', 'alc2', 'alc3', 'diol', 'phenol']],
  ['co', 'Carbonyls', ['ald', 'ket']],
  ['acid', 'Acids & derivatives', ['acid', 'acylcl', 'ester', 'salt']],
  ['n', 'Nitrogen', ['amine', 'amide', 'nitrile', 'hnitrile', 'nitroarene', 'diazonium', 'azo', 'aminoacid']],
];
export const STARTERS = ['C1', 'C2', 'ethene', 'propene', 'chxe', 'benzene', 'phoh', 'gly'];

/* Reagents */
export const RG: Record<string, Reagent> = {};
export const RGLIST: string[] = [];
const G_ = (id: string, f: string, n: string, g: ReagentGroup) => { RG[id] = { id, f, n, g }; RGLIST.push(id); };
G_('cl2uv', 'Cl2 / UV', 'chlorine in UV light', 'hal');
G_('br2uv', 'Br2 / UV', 'bromine in UV light', 'hal');
G_('br2', 'Br2', 'bromine (or bromine water)', 'hal');
G_('br2fe', 'Br2 / FeBr3', 'bromine + halogen carrier', 'hal');
G_('hbr', 'HBr', 'hydrogen bromide', 'hal');
G_('kbr', 'KBr / H2SO4', 'makes HBr in situ', 'hal');
G_('pcl5', 'PCl5', 'phosphorus(V) chloride', 'hal');
G_('crdist', 'Cr2O7^2- / H^+', 'acidified dichromate · distil', 'ox');
G_('crreflux', 'Cr2O7^2- / H^+', 'acidified dichromate · reflux', 'ox');
G_('kmno4', 'KMnO4 / H^+', 'acidified manganate(VII)', 'ox');
G_('lialh4', 'LiAlH4', 'in dry ether', 'ox');
G_('h2ni', 'H2 / Ni', 'hydrogen, nickel catalyst', 'ox');
G_('snhcl', 'Sn / HCl', 'tin + conc. HCl, then NaOH', 'ox');
G_('naoh', 'NaOH(aq)', 'aqueous, warm', 'ab');
G_('kohalc', 'KOH(eth)', 'ethanolic, heat', 'ab');
G_('hcl', 'HCl(aq)', 'hydrochloric acid', 'ab');
G_('na2co3', 'NaHCO3', 'sodium hydrogencarbonate', 'ab');
G_('h2so4', 'conc. H2SO4', 'concentrated, hot', 'ab');
G_('steam', 'H2O(g) / H3PO4', 'steam, acid catalyst', 'ab');
G_('water', 'H2O', 'water', 'nu');
G_('kcn', 'KCN(eth)', 'ethanolic, reflux', 'nu');
G_('hcn', 'HCN / KCN', 'hydrogen cyanide', 'nu');
G_('nh3', 'NH3', 'ammonia', 'nu');
G_('nitrate', 'HNO3 / H2SO4', 'conc. nitrating mixture', 'sp');
G_('hno2', 'NaNO2 / HCl', 'nitrous acid, < 10 °C', 'sp');
G_('mg', 'Mg', 'magnesium, dry ether', 'sp');
G_('co2', 'CO2', 'dry ice, then H^+', 'sp');
G_('poly', 'Pressure', 'heat, pressure, catalyst', 'sp');
export const RG_GROUPS: [ReagentGroup, string][] = [['hal', 'Halogenation'], ['ox', 'Oxidation & reduction'], ['ab', 'Acids, bases & dehydration'], ['nu', 'Nucleophiles'], ['sp', 'Arenes, Grignard & polymers']];

/* Reaction families (colour + label) */
export const FAM: Record<Fam, [string, string]> = {
  redox: ['Redox', 'var(--redox)'],
  subst: ['Substitution', 'var(--ligand)'],
  addn: ['Addition', 'var(--accent)'],
  elim: ['Elimination', 'var(--amph)'],
  cond: ['Condensation / hydrolysis', 'var(--cond)'],
  acid: ['Acid–base', 'var(--acidbase)'],
};

/* Reactions */
export const RX: Reaction[] = [];
export const UNIT: Record<Level, string> = { AS: 'AS · Units 1–3', A2: 'A2 · Units 4–6' };
function rx(a: string, b: string, p: string | string[], fam: Fam, mech: string, cond: string, eq: string | string[], unit: Level, note?: string) {
  RX.push({ id: RX.length, a, b, p: ([] as string[]).concat(p), fam, mech, cond, eq: ([] as string[]).concat(eq), unit, note: note || '' });
}
// free-radical substitution
const FRS = 'Free-radical substitution', FRN = 'Initiation, propagation and termination steps. Further substitution gives a mixture of products.';
rx('C1', 'cl2uv', 'clme', 'subst', FRS, 'UV light', 'CH4 + Cl2 -> CH3Cl + HCl', 'AS', FRN);
rx('C1', 'br2uv', 'brme', 'subst', FRS, 'UV light', 'CH4 + Br2 -> CH3Br + HBr', 'AS', FRN);
rx('C2', 'cl2uv', 'clet', 'subst', FRS, 'UV light', 'CH3CH3 + Cl2 -> CH3CH2Cl + HCl', 'AS', FRN);
rx('C2', 'br2uv', 'bret', 'subst', FRS, 'UV light', 'CH3CH3 + Br2 -> CH3CH2Br + HBr', 'AS', FRN);
rx('C3', 'br2uv', ['br1p', 'br2p'], 'subst', FRS, 'UV light', ['CH3CH2CH3 + Br2 -> CH3CH2CH2Br + HBr', 'CH3CH2CH3 + Br2 -> CH3CHBrCH3 + HBr'], 'AS', 'Two isomers form, because H atoms on either the end or the middle carbon can be substituted.');
// alkenes
const HYD = 'Addition (hydrogenation)';
rx('ethene', 'h2ni', 'C2', 'addn', HYD, 'Ni catalyst, 150 °C', 'CH2=CH2 + H2 -> CH3CH3', 'AS');
rx('propene', 'h2ni', 'C3', 'addn', HYD, 'Ni catalyst, 150 °C', 'CH2=CHCH3 + H2 -> CH3CH2CH3', 'AS');
rx('chxe', 'h2ni', 'chx', 'addn', HYD, 'Ni catalyst, 150 °C', 'C6H10 + H2 -> C6H12', 'AS', 'ΔH ≈ −120 kJ mol⁻¹ — the reference value used to show benzene is extra stable.');
rx('benzene', 'h2ni', 'chx', 'addn', HYD, 'Ni catalyst, ~200 °C, high pressure', 'C6H6 + 3H2 -> C6H12', 'A2', 'ΔH is about 150 kJ mol⁻¹ less exothermic than 3 × cyclohexene: evidence for the delocalised ring.');
const EA = 'Electrophilic addition';
rx('ethene', 'br2', 'dbe', 'addn', EA, 'room temperature', 'CH2=CH2 + Br2 -> CH2BrCH2Br', 'AS', 'Test for C=C: orange bromine water is decolourised.');
rx('propene', 'br2', 'dbp', 'addn', EA, 'room temperature', 'CH2=CHCH3 + Br2 -> CH2BrCHBrCH3', 'AS', 'Test for C=C: orange bromine water is decolourised.');
rx('ethene', 'hbr', 'bret', 'addn', EA, 'room temperature', 'CH2=CH2 + HBr -> CH3CH2Br', 'AS');
rx('propene', 'hbr', 'br2p', 'addn', EA, 'room temperature', 'CH2=CHCH3 + HBr -> CH3CHBrCH3', 'AS', 'Major product: the secondary carbocation is more stable than the primary one, so 2-bromopropane beats 1-bromopropane.');
rx('mprop', 'hbr', 'brtb', 'addn', EA, 'room temperature', 'CH2=C(CH3)2 + HBr -> (CH3)3CBr', 'AS', 'Goes via the very stable tertiary carbocation.');
rx('ethene', 'steam', 'etoh', 'addn', 'Electrophilic addition (hydration)', 'H3PO4 catalyst, 300 °C, 60 atm', 'CH2=CH2 + H2O -> CH3CH2OH', 'AS');
rx('propene', 'steam', 'p2ol', 'addn', 'Electrophilic addition (hydration)', 'H3PO4 catalyst, 300 °C, 60 atm', 'CH2=CHCH3 + H2O -> CH3CH(OH)CH3', 'AS', 'Major product, via the more stable secondary carbocation.');
rx('mprop', 'steam', 'tbuoh', 'addn', 'Electrophilic addition (hydration)', 'H3PO4 catalyst, heat, pressure', 'CH2=C(CH3)2 + H2O -> (CH3)3COH', 'AS');
rx('ethene', 'kmno4', 'diol', 'redox', 'Oxidation', 'acidified, room temperature', 'CH2=CH2 + [O] + H2O -> HOCH2CH2OH', 'AS', 'Purple manganate(VII) is decolourised.');
rx('propene', 'kmno4', 'pdiol', 'redox', 'Oxidation', 'acidified, room temperature', 'CH2=CHCH3 + [O] + H2O -> CH2(OH)CH(OH)CH3', 'AS', 'Purple manganate(VII) is decolourised.');
rx('ethene', 'poly', 'pe', 'addn', 'Addition polymerisation', 'high pressure, catalyst', 'nCH2=CH2 -> –[CH2–CH2]n–', 'AS', 'Saturated, unreactive chain: hard to biodegrade.');
rx('propene', 'poly', 'pp', 'addn', 'Addition polymerisation', 'high pressure, catalyst', 'nCH2=CHCH3 -> –[CH2–CH(CH3)]n–', 'AS', 'The repeat unit has two main-chain carbons; CH3 is a side group.');
// halogenoalkanes
const NS = 'Nucleophilic substitution';
[['clme', 'meoh'], ['brme', 'meoh'], ['clet', 'etoh'], ['bret', 'etoh'], ['iet', 'etoh'], ['br1p', 'p1ol'], ['br2p', 'p2ol'], ['brtb', 'tbuoh'], ['cltb', 'tbuoh']].forEach(([h, o]) => {
  const X = CP[h].st.match(/Cl|Br|I/)![0];
  const tert = CP[h].cls === 'halo' && /^\(CH3\)3/.test(CP[h].st);
  rx(h, 'naoh', o, 'subst', NS, 'NaOH(aq), warm under reflux', `${CP[h].st} + OH^- -> ${CP[o].st} + ${X}^-`, 'AS',
    tert ? 'Tertiary: SN1, via a carbocation.' : (X === 'I' ? 'Fastest of the halogenoalkanes: the C–I bond is the weakest.' : 'Rate: C–I > C–Br > C–Cl, as the C–X bond enthalpy falls.'));
});
rx('dbe', 'naoh', 'diol', 'subst', NS, 'NaOH(aq), warm under reflux', 'CH2BrCH2Br + 2OH^- -> HOCH2CH2OH + 2Br^-', 'AS');
[['clet', 'ethene'], ['bret', 'ethene'], ['iet', 'ethene'], ['br1p', 'propene'], ['br2p', 'propene'], ['brtb', 'mprop'], ['cltb', 'mprop']].forEach(([h, a]) => {
  const X = CP[h].st.match(/Cl|Br|I/)![0];
  rx(h, 'kohalc', a, 'elim', 'Elimination', 'KOH in ethanol, heat under reflux', `${CP[h].st} + KOH -> ${CP[a].st} + K${X} + H2O`, 'AS', 'In ethanol, OH⁻ acts as a base (removes H⁺) rather than a nucleophile.');
});
[['clme', 'mecn'], ['brme', 'mecn'], ['clet', 'etcn'], ['bret', 'etcn'], ['iet', 'etcn']].forEach(([h, n]) => {
  const X = CP[h].st.match(/Cl|Br|I/)![0];
  rx(h, 'kcn', n, 'subst', NS, 'KCN in ethanol, heat under reflux', `${CP[h].st} + CN^- -> ${CP[n].st} + ${X}^-`, 'A2', 'Adds one carbon to the chain.');
});
[['clme', 'menh2'], ['brme', 'menh2'], ['clet', 'etnh2'], ['bret', 'etnh2'], ['iet', 'etnh2'], ['br1p', 'prnh2']].forEach(([h, n]) => {
  const X = CP[h].st.match(/Cl|Br|I/)![0];
  rx(h, 'nh3', n, 'subst', NS, 'excess ammonia in ethanol, heated in a sealed tube', `${CP[h].st} + 2NH3 -> ${CP[n].st} + NH4${X}`, 'AS', 'Excess NH₃ cuts down further substitution to secondary and tertiary amines.');
});
rx('brme', 'mg', 'mgme', 'redox', 'Grignard formation', 'dry ether, warm under reflux', 'CH3Br + Mg -> CH3MgBr', 'A2', 'Everything must be dry: water destroys Grignard reagents.');
rx('bret', 'mg', 'mget', 'redox', 'Grignard formation', 'dry ether, warm under reflux', 'CH3CH2Br + Mg -> CH3CH2MgBr', 'A2', 'Everything must be dry: water destroys Grignard reagents.');
rx('brbz', 'mg', 'mgph', 'redox', 'Grignard formation', 'dry ether, warm under reflux', 'C6H5Br + Mg -> C6H5MgBr', 'A2', 'Everything must be dry: water destroys Grignard reagents.');
// alcohols: oxidation
const OXD = 'acidified K2Cr2O7, heat; distil off the aldehyde as it forms', OXR = 'excess acidified K2Cr2O7, heat under reflux', OX2 = 'acidified K2Cr2O7, heat';
[['meoh', 'hcho'], ['etoh', 'mecho'], ['p1ol', 'etcho'], ['phmeoh', 'bzald']].forEach(([a, b]) =>
  rx(a, 'crdist', b, 'redox', 'Oxidation', OXD, `${CP[a].st} + [O] -> ${CP[b].st} + H2O`, 'AS', 'Distilling removes the aldehyde before it can be oxidised further. Orange → green.'));
[['p2ol', 'acetone'], ['b2ol', 'butanone'], ['phetoh', 'acph']].forEach(([a, b]) => {
  rx(a, 'crdist', b, 'redox', 'Oxidation', OX2, `${CP[a].st} + [O] -> ${CP[b].st} + H2O`, 'AS', 'Secondary alcohol → ketone, which is not oxidised further. Orange → green.');
  rx(a, 'crreflux', b, 'redox', 'Oxidation', OX2, `${CP[a].st} + [O] -> ${CP[b].st} + H2O`, 'AS', 'Secondary alcohol → ketone, which is not oxidised further. Orange → green.');
});
[['etoh', 'acoh'], ['p1ol', 'pacoh'], ['phmeoh', 'bzoh']].forEach(([a, b]) =>
  rx(a, 'crreflux', b, 'redox', 'Oxidation', OXR, `${CP[a].st} + 2[O] -> ${CP[b].st} + H2O`, 'AS', 'Reflux keeps the aldehyde in the flask until it is fully oxidised to the acid. Orange → green.'));
[['mecho', 'acoh'], ['etcho', 'pacoh'], ['bzald', 'bzoh']].forEach(([a, b]) =>
  rx(a, 'crreflux', b, 'redox', 'Oxidation', OXR, `${CP[a].st} + [O] -> ${CP[b].st}`, 'A2', 'Aldehydes are easily oxidised — the basis of the Tollens’ and Fehling’s tests.'));
// alcohols: dehydration, halogenation
[['etoh', 'ethene'], ['p1ol', 'propene'], ['p2ol', 'propene'], ['tbuoh', 'mprop']].forEach(([a, b]) =>
  rx(a, 'h2so4', b, 'elim', 'Elimination (dehydration)', 'conc. H2SO4 (or H3PO4), heat', `${CP[a].st} -> ${CP[b].st} + H2O`, 'AS'));
rx('b2ol', 'h2so4', 'but2', 'elim', 'Elimination (dehydration)', 'conc. H2SO4 (or H3PO4), heat', 'CH3CH2CH(OH)CH3 -> CH3CH=CHCH3 + H2O', 'AS', 'But-1-ene forms too, and but-2-ene exists as E and Z isomers.');
[['meoh', 'clme'], ['etoh', 'clet'], ['tbuoh', 'cltb']].forEach(([a, b]) =>
  rx(a, 'pcl5', b, 'subst', 'Substitution', 'room temperature, dry', `${CP[a].st} + PCl5 -> ${CP[b].st} + POCl3 + HCl`, 'AS', 'Steamy white fumes of HCl: a test for –OH groups.'));
[['acoh', 'accl'], ['pacoh', 'prcl'], ['bzoh', 'bzcl']].forEach(([a, b]) =>
  rx(a, 'pcl5', b, 'subst', 'Substitution', 'room temperature, dry', `${CP[a].st} + PCl5 -> ${CP[b].st} + POCl3 + HCl`, 'A2', 'Steamy white fumes of HCl. Acyl chlorides are far more reactive than the acids.'));
[['meoh', 'brme'], ['etoh', 'bret'], ['p1ol', 'br1p'], ['p2ol', 'br2p'], ['tbuoh', 'brtb']].forEach(([a, b]) =>
  rx(a, 'kbr', b, 'subst', NS, 'KBr + 50% H2SO4 (forms HBr), warm; distil off the product', `${CP[a].st} + HBr -> ${CP[b].st} + H2O`, 'AS'));
rx('tbuoh', 'hcl', 'cltb', 'subst', 'Nucleophilic substitution (SN1)', 'concentrated HCl, shake at room temperature', '(CH3)3COH + HCl -> (CH3)3CCl + H2O', 'AS', 'Tertiary alcohols react readily — the basis of a standard preparation (see Codex → Preparation).');
// esters
const EST = 'Esterification (condensation)', ESC = 'conc. H2SO4 catalyst, heat under reflux';
rx('acoh', 'etoh', 'etoac', 'cond', EST, ESC, 'CH3COOH + CH3CH2OH <=> CH3COOCH2CH3 + H2O', 'A2', 'Reversible and slow, so the yield is limited. Fruity-smelling product.');
rx('acoh', 'meoh', 'meoac', 'cond', EST, ESC, 'CH3COOH + CH3OH <=> CH3COOCH3 + H2O', 'A2', 'Reversible and slow, so the yield is limited.');
rx('pacoh', 'etoh', 'etprop', 'cond', EST, ESC, 'CH3CH2COOH + CH3CH2OH <=> CH3CH2COOCH2CH3 + H2O', 'A2', 'Reversible and slow, so the yield is limited.');
const AE = 'Nucleophilic addition–elimination';
rx('accl', 'etoh', 'etoac', 'cond', AE, 'room temperature, dry', 'CH3COCl + CH3CH2OH -> CH3COOCH2CH3 + HCl', 'A2', 'Fast and not reversible: a better yield than using the acid.');
rx('accl', 'meoh', 'meoac', 'cond', AE, 'room temperature, dry', 'CH3COCl + CH3OH -> CH3COOCH3 + HCl', 'A2', 'Fast and not reversible: a better yield than using the acid.');
rx('prcl', 'etoh', 'etprop', 'cond', AE, 'room temperature, dry', 'CH3CH2COCl + CH3CH2OH -> CH3CH2COOCH2CH3 + HCl', 'A2', 'Fast and not reversible.');
[['accl', 'acoh'], ['prcl', 'pacoh'], ['bzcl', 'bzoh']].forEach(([a, b]) =>
  rx(a, 'water', b, 'cond', AE, 'room temperature (vigorous)', `${CP[a].st} + H2O -> ${CP[b].st} + HCl`, 'A2', 'Steamy fumes of HCl appear at once.'));
rx('accl', 'nh3', 'acnh2', 'cond', AE, 'concentrated aqueous ammonia, room temperature', 'CH3COCl + 2NH3 -> CH3CONH2 + NH4Cl', 'A2', 'The second NH₃ neutralises the HCl formed.');
rx('prcl', 'nh3', 'pram', 'cond', AE, 'concentrated aqueous ammonia, room temperature', 'CH3CH2COCl + 2NH3 -> CH3CH2CONH2 + NH4Cl', 'A2', 'The second NH₃ neutralises the HCl formed.');
rx('accl', 'menh2', 'nmeam', 'cond', AE, 'room temperature', 'CH3COCl + 2CH3NH2 -> CH3CONHCH3 + CH3NH3^+Cl^-', 'A2', 'A primary amine gives an N-substituted amide.');
rx('accl', 'etnh2', 'netam', 'cond', AE, 'room temperature', 'CH3COCl + 2CH3CH2NH2 -> CH3CONHCH2CH3 + CH3CH2NH3^+Cl^-', 'A2', 'A primary amine gives an N-substituted amide.');
rx('accl', 'phnh2', 'nphenam', 'cond', AE, 'room temperature', 'CH3COCl + C6H5NH2 -> CH3CONHC6H5 + HCl', 'A2', 'Phenylamine is acylated on nitrogen.');
[['etoac', 'acoh', 'etoh'], ['meoac', 'acoh', 'meoh'], ['etprop', 'pacoh', 'etoh']].forEach(([e, a, o]) => {
  rx(e, 'hcl', [a, o], 'cond', 'Hydrolysis (acid)', 'dilute HCl, heat under reflux', `${CP[e].st} + H2O <=> ${CP[a].st} + ${CP[o].st}`, 'A2', 'Reversible, so hydrolysis is incomplete.');
  const s = a === 'acoh' ? 'naoac' : 'naprop';
  rx(e, 'naoh', [s, o], 'cond', 'Hydrolysis (alkaline)', 'NaOH(aq), heat under reflux', `${CP[e].st} + NaOH -> ${CP[s].st} + ${CP[o].st}`, 'A2', 'Goes to completion. Acidify afterwards to get the free acid.');
});
// carbonyls & nitriles
const RD = 'LiAlH4 in dry ether, then dilute acid';
[['hcho', 'meoh'], ['mecho', 'etoh'], ['etcho', 'p1ol'], ['bzald', 'phmeoh']].forEach(([a, b]) =>
  rx(a, 'lialh4', b, 'redox', 'Reduction', RD, `${CP[a].st} + 2[H] -> ${CP[b].st}`, 'A2', 'Aldehyde → primary alcohol.'));
[['acetone', 'p2ol'], ['butanone', 'b2ol'], ['acph', 'phetoh']].forEach(([a, b]) =>
  rx(a, 'lialh4', b, 'redox', 'Reduction', RD, `${CP[a].st} + 2[H] -> ${CP[b].st}`, 'A2', 'Ketone → secondary alcohol.'));
[['acoh', 'etoh'], ['pacoh', 'p1ol'], ['bzoh', 'phmeoh']].forEach(([a, b]) =>
  rx(a, 'lialh4', b, 'redox', 'Reduction', RD, `${CP[a].st} + 4[H] -> ${CP[b].st} + H2O`, 'A2', 'Carboxylic acid → primary alcohol.'));
[['mecn', 'etnh2'], ['etcn', 'prnh2']].forEach(([a, b]) =>
  rx(a, 'lialh4', b, 'redox', 'Reduction', RD, `${CP[a].st} + 4[H] -> ${CP[b].st}`, 'A2', 'Nitrile → primary amine (C≡N becomes CH₂NH₂).'));
rx('mecho', 'hcn', 'hn1', 'addn', 'Nucleophilic addition', 'HCN with a little KCN (source of CN⁻)', 'CH3CHO + HCN -> CH3CH(OH)CN', 'A2', 'CN⁻ attacks the planar C=O equally from either face → a racemic mixture.');
rx('etcho', 'hcn', 'hn3', 'addn', 'Nucleophilic addition', 'HCN with a little KCN (source of CN⁻)', 'CH3CH2CHO + HCN -> CH3CH2CH(OH)CN', 'A2', 'CN⁻ attacks the planar C=O equally from either face → a racemic mixture.');
rx('acetone', 'hcn', 'hn2', 'addn', 'Nucleophilic addition', 'HCN with a little KCN (source of CN⁻)', 'CH3COCH3 + HCN -> (CH3)2C(OH)CN', 'A2', 'Not chiral: the carbon carries two identical CH₃ groups.');
[['mecn', 'acoh'], ['etcn', 'pacoh'], ['hn1', 'lact'], ['hn3', 'hba'], ['hn2', 'hmpa']].forEach(([a, b]) =>
  rx(a, 'hcl', b, 'cond', 'Hydrolysis', 'dilute HCl, heat under reflux', `${CP[a].st} + 2H2O + HCl -> ${CP[b].st} + NH4Cl`, 'A2', 'The –CN carbon becomes –COOH.'));
// acid–base
rx('acoh', 'naoh', 'naoac', 'acid', 'Neutralisation', 'room temperature', 'CH3COOH + NaOH -> CH3COO^-Na^+ + H2O', 'A2');
rx('pacoh', 'naoh', 'naprop', 'acid', 'Neutralisation', 'room temperature', 'CH3CH2COOH + NaOH -> CH3CH2COO^-Na^+ + H2O', 'A2');
rx('acoh', 'na2co3', 'naoac', 'acid', 'Neutralisation', 'room temperature', 'CH3COOH + NaHCO3 -> CH3COO^-Na^+ + CO2 + H2O', 'A2', 'Effervescence of CO₂: the test for a carboxylic acid.');
rx('pacoh', 'na2co3', 'naprop', 'acid', 'Neutralisation', 'room temperature', 'CH3CH2COOH + NaHCO3 -> CH3CH2COO^-Na^+ + CO2 + H2O', 'A2', 'Effervescence of CO₂: the test for a carboxylic acid.');
rx('naoac', 'hcl', 'acoh', 'acid', 'Acid–base (protonation)', 'room temperature', 'CH3COO^-Na^+ + HCl -> CH3COOH + NaCl', 'A2', 'A stronger acid releases the weaker carboxylic acid.');
rx('naprop', 'hcl', 'pacoh', 'acid', 'Acid–base (protonation)', 'room temperature', 'CH3CH2COO^-Na^+ + HCl -> CH3CH2COOH + NaCl', 'A2', 'A stronger acid releases the weaker carboxylic acid.');
rx('phoh', 'naoh', 'naphenox', 'acid', 'Neutralisation', 'room temperature', 'C6H5OH + NaOH -> C6H5O^-Na^+ + H2O', 'A2', 'Phenol is weakly acidic: the negative charge on O⁻ spreads into the ring.');
rx('naphenox', 'hcl', 'phoh', 'acid', 'Acid–base (protonation)', 'room temperature', 'C6H5O^-Na^+ + HCl -> C6H5OH + NaCl', 'A2');
rx('etnh2', 'hcl', 'etnh3cl', 'acid', 'Acid–base', 'room temperature', 'CH3CH2NH2 + HCl -> CH3CH2NH3^+Cl^-', 'A2', 'The lone pair on N accepts H⁺. Ethylamine is a stronger base than NH₃ (the ethyl group pushes electrons onto N).');
rx('phnh2', 'hcl', 'phnh3cl', 'acid', 'Acid–base', 'room temperature', 'C6H5NH2 + HCl -> C6H5NH3^+Cl^-', 'A2', 'Phenylamine is a weaker base than NH₃: its lone pair is delocalised into the ring.');
rx('etnh3cl', 'naoh', 'etnh2', 'acid', 'Acid–base', 'warm', 'CH3CH2NH3^+Cl^- + NaOH -> CH3CH2NH2 + NaCl + H2O', 'A2', 'A strong base frees the amine from its salt.');
rx('phnh3cl', 'naoh', 'phnh2', 'acid', 'Acid–base', 'room temperature', 'C6H5NH3^+Cl^- + NaOH -> C6H5NH2 + NaCl + H2O', 'A2', 'A strong base frees the amine from its salt.');
rx('gly', 'hcl', 'glyH', 'acid', 'Acid–base', 'room temperature', 'H2NCH2COOH + HCl -> ^+H3NCH2COOH Cl^-', 'A2', 'In acid, the –NH₂ group is protonated. (In neutral solution glycine is a zwitterion, ⁺H₃NCH₂COO⁻.)');
rx('gly', 'naoh', 'glyNa', 'acid', 'Acid–base', 'room temperature', 'H2NCH2COOH + NaOH -> H2NCH2COO^-Na^+ + H2O', 'A2', 'In alkali, the –COOH group loses H⁺.');
// arenes
const ES = 'Electrophilic substitution';
rx('benzene', 'nitrate', 'nitrobz', 'subst', ES + ' (nitration)', 'conc. HNO3 + conc. H2SO4, below 55 °C', 'C6H6 + HNO3 -> C6H5NO2 + H2O', 'A2', 'Electrophile: NO₂⁺, from HNO₃ + 2H₂SO₄. Hotter conditions give more substitution.');
rx('benzene', 'br2fe', 'brbz', 'subst', ES + ' (halogenation)', 'FeBr3 (or iron) halogen carrier, room temperature', 'C6H6 + Br2 -> C6H5Br + HBr', 'A2', 'FeBr₃ polarises Br₂ into a Br⁺ electrophile.');
rx('phoh', 'br2', 'tbp', 'subst', ES, 'bromine water, room temperature', 'C6H5OH + 3Br2 -> C6H2Br3OH + 3HBr', 'A2', 'No catalyst needed: an O lone pair feeds into the ring, raising its electron density. White precipitate.');
rx('phoh', 'br2fe', 'tbp', 'subst', ES, 'bromine water is enough (no carrier needed)', 'C6H5OH + 3Br2 -> C6H2Br3OH + 3HBr', 'A2', 'Phenol is so activated that it substitutes three times.');
rx('benzene', 'clme', 'tol', 'subst', ES + ' (Friedel–Crafts alkylation)', 'AlCl3 catalyst, warm, dry', 'C6H6 + CH3Cl -> C6H5CH3 + HCl', 'A2', 'AlCl₃ generates the CH₃⁺ electrophile and is regenerated.');
rx('benzene', 'brme', 'tol', 'subst', ES + ' (Friedel–Crafts alkylation)', 'AlBr3 / AlCl3 catalyst, warm, dry', 'C6H6 + CH3Br -> C6H5CH3 + HBr', 'A2', 'The halogen carrier generates the CH₃⁺ electrophile.');
rx('benzene', 'accl', 'acph', 'subst', ES + ' (Friedel–Crafts acylation)', 'AlCl3 catalyst, heat under reflux, dry', 'C6H6 + CH3COCl -> C6H5COCH3 + HCl', 'A2', 'Electrophile: CH₃CO⁺. Makes an aromatic ketone.');
rx('nitrobz', 'snhcl', 'phnh2', 'redox', 'Reduction', 'tin + conc. HCl, heat under reflux; then excess NaOH(aq)', 'C6H5NO2 + 6[H] -> C6H5NH2 + 2H2O', 'A2', 'The acid gives the salt C₆H₅NH₃⁺; NaOH releases free phenylamine.');
rx('phnh2', 'hno2', 'diaz', 'cond', 'Diazotisation', 'NaNO2 + dilute HCl (makes HNO2), below 10 °C', 'C6H5NH2 + HNO2 + HCl -> C6H5N2^+Cl^- + 2H2O', 'A2', 'Keep below 10 °C: warmer diazonium ions decompose and release N₂.');
rx('diaz', 'phoh', 'azo', 'subst', 'Coupling (electrophilic substitution)', 'phenol in NaOH(aq), below 10 °C', 'C6H5N2^+ + C6H5OH -> C6H5N=NC6H4OH + H^+', 'A2', 'A yellow–orange azo dye: colour comes from delocalisation across –N=N–.');
rx('diaz', 'naphenox', 'azo', 'subst', 'Coupling (electrophilic substitution)', 'alkaline solution, below 10 °C', 'C6H5N2^+ + C6H5O^- -> C6H5N=NC6H4OH', 'A2', 'A yellow–orange azo dye: colour comes from delocalisation across –N=N–.');
// Grignard
[['mgme', 'acoh'], ['mget', 'pacoh'], ['mgph', 'bzoh']].forEach(([g, a]) => {
  const R = CP[g].st.replace('MgBr', '');
  rx(g, 'co2', a, 'addn', 'Nucleophilic addition', 'dry ice (solid CO2) in dry ether, then dilute acid',
    [`${R}MgBr + CO2 -> ${R}COOMgBr`, `${R}COOMgBr + H2O -> ${CP[a].st} + Mg(OH)Br`], 'A2', 'Adds one carbon as –COOH.');
});
[['mgme', 'hcho', 'etoh'], ['mget', 'hcho', 'p1ol'], ['mgph', 'hcho', 'phmeoh'], ['mgme', 'mecho', 'p2ol'], ['mget', 'mecho', 'b2ol'], ['mgph', 'mecho', 'phetoh'],
 ['mgme', 'etcho', 'b2ol'], ['mgme', 'acetone', 'tbuoh'], ['mget', 'acetone', 'mb2ol'], ['mgme', 'butanone', 'mb2ol']].forEach(([g, c, p]) => {
  const ps = CP[p].st, i = ps.lastIndexOf('OH'), alk = ps.slice(0, i) + 'OMgBr' + ps.slice(i + 2);
  const kind = c === 'hcho' ? 'Methanal → primary alcohol.' : CP[c].cls === 'ald' ? 'Aldehyde → secondary alcohol.' : 'Ketone → tertiary alcohol.';
  rx(g, c, p, 'addn', 'Nucleophilic addition', 'dry ether, then dilute acid', [`${CP[g].st} + ${CP[c].st} -> ${alk}`, `${alk} + H2O -> ${ps} + Mg(OH)Br`], 'A2', 'The δ− carbon of the Grignard attacks the δ+ carbonyl carbon, making a new C–C bond. ' + kind);
});
[['mgme', 'C1'], ['mget', 'C2'], ['mgph', 'benzene']].forEach(([g, h]) =>
  rx(g, 'water', h, 'cond', 'Hydrolysis', 'any trace of water', `${CP[g].st} + H2O -> ${CP[h].st} + Mg(OH)Br`, 'A2', 'This is why Grignard reactions must be kept completely dry.'));

/* Specific "no reaction" explanations (order-free keys) */
export const NOREACT: Record<string, string> = {
  'benzene|br2': 'No reaction. Benzene’s delocalised ring is too stable to add Br₂; it needs a halogen carrier (FeBr₃) to substitute instead.',
  'benzene|hbr': 'No reaction. Benzene does not undergo electrophilic addition — that would destroy the delocalised ring.',
  'benzene|kmno4': 'No reaction. Benzene is not oxidised by manganate(VII): no C=C to attack.',
  'clme|kohalc': 'No reaction. There is no carbon next to C–X carrying an H to remove, so a halogenomethane cannot eliminate.',
  'brme|kohalc': 'No reaction. There is no carbon next to C–X carrying an H to remove, so a halogenomethane cannot eliminate.',
  'meoh|h2so4': 'No reaction. Methanol has one carbon, so it cannot form a C=C.',
  'phoh|na2co3': 'No reaction. Phenol is too weak an acid to release CO₂ from carbonates — no fizz. This tells it apart from carboxylic acids.',
  'phoh|crdist': 'No reaction under these conditions. Phenol is not oxidised like an alcohol: the dichromate stays orange.',
  'phoh|crreflux': 'No reaction under these conditions. Phenol is not oxidised like an alcohol: the dichromate stays orange.',
  'brbz|naoh': 'No reaction. The C–Br bond in bromobenzene is strengthened by overlap with the ring, so OH⁻ cannot substitute it.',
  'brbz|kcn': 'No reaction. The C–Br bond in bromobenzene is strengthened by overlap with the ring.',
  'brbz|nh3': 'No reaction. The C–Br bond in bromobenzene is strengthened by overlap with the ring.',
  'chx|br2': 'No reaction in the dark. Alkanes need UV light for free-radical substitution.',
  'C1|br2': 'No reaction in the dark. Alkanes need UV light for free-radical substitution.',
  'C2|br2': 'No reaction in the dark. Alkanes need UV light for free-radical substitution.',
  'C3|br2': 'No reaction in the dark. Alkanes need UV light for free-radical substitution.',
};
['tbuoh', 'mb2ol'].forEach(a => ['crdist', 'crreflux'].forEach(r => NOREACT[a + '|' + r] = 'No reaction. A tertiary alcohol has no H on the carbon carrying –OH, so it cannot be oxidised: the dichromate stays orange.'));
['acetone', 'butanone', 'acph'].forEach(a => ['crdist', 'crreflux'].forEach(r => NOREACT[a + '|' + r] = 'No reaction. Ketones resist oxidation: the dichromate stays orange. (This is how aldehydes and ketones are told apart.)'));
['mgme', 'mget', 'mgph'].forEach(a => ['naoh', 'hcl', 'steam'].forEach(r => NOREACT[a + '|' + r] = 'The Grignard reagent is destroyed by water: it is protonated to the alkane/arene. Grignard reactions need dry ether.'));

/* For unknown combos: does this reagent touch this class at all? */
export const REACTS: Record<string, ClassId[]> = {
  cl2uv: ['alkane'], br2uv: ['alkane'], br2: ['alkene', 'phenol'], hbr: ['alkene'], steam: ['alkene'], kmno4: ['alkene'], poly: ['alkene'], h2ni: ['alkene'],
  naoh: ['halo', 'ester', 'acid', 'phenol', 'acylcl'], kohalc: ['halo'], kcn: ['halo'], nh3: ['halo', 'acylcl'], mg: ['halo'],
  crdist: ['alc1', 'alc2', 'ald', 'diol'], crreflux: ['alc1', 'alc2', 'ald', 'diol'], lialh4: ['ald', 'ket', 'acid', 'nitrile', 'hnitrile'], hcn: ['ald', 'ket'],
  pcl5: ['alc1', 'alc2', 'alc3', 'acid', 'diol', 'phenol'], kbr: ['alc1', 'alc2', 'alc3', 'diol'], h2so4: ['alc1', 'alc2', 'alc3'],
  hcl: ['amine', 'nitrile', 'hnitrile', 'ester', 'salt'], water: ['acylcl', 'grignard'], nitrate: ['arene'], br2fe: ['arene'], co2: ['grignard'], hno2: ['amine'], na2co3: ['acid', 'acylcl'],
};

/* ===== Identification tests ===== */
export const TESTS: Test[] = [
  { id: 'brw', n: 'Bromine water', f: 'Br2(aq)', proc: 'Shake with a few drops of bromine water.', pos: 'Alkenes (C=C) and phenols', obs: 'Orange → colourless (phenol also gives a white precipitate)', from: '#e58a2c' },
  { id: 'crox', n: 'Acidified dichromate(VI)', f: 'K2Cr2O7 / H^+', proc: 'Warm with acidified potassium dichromate(VI).', pos: 'Primary and secondary alcohols, aldehydes', obs: 'Orange → green', from: '#ef8a1c' },
  { id: 'dnph', n: '2,4-DNPH (Brady’s reagent)', f: '2,4-DNPH', proc: 'Add a few drops of 2,4-dinitrophenylhydrazine.', pos: 'Aldehydes and ketones (C=O)', obs: 'Yellow–orange precipitate', from: '#f3cf6a' },
  { id: 'tollens', n: 'Tollens’ reagent', f: '[Ag(NH3)2]^+', proc: 'Warm in a water bath with Tollens’ reagent.', pos: 'Aldehydes', obs: 'Silver mirror on the glass', from: '#e9eef0' },
  { id: 'fehling', n: 'Fehling’s solution', f: 'Cu^2+ (aq), alkaline', proc: 'Warm with Fehling’s (or Benedict’s) solution.', pos: 'Aliphatic aldehydes', obs: 'Blue solution → brick-red precipitate', from: '#2f78d0' },
  { id: 'iodo', n: 'Iodoform test', f: 'I2 / NaOH(aq)', proc: 'Warm with iodine in sodium hydroxide solution.', pos: 'CH3CO– groups and CH3CH(OH)– groups', obs: 'Pale yellow precipitate of CHI₃ (antiseptic smell)', from: '#f1e3a6' },
  { id: 'carb', n: 'Sodium hydrogencarbonate', f: 'NaHCO3', proc: 'Add sodium hydrogencarbonate.', pos: 'Carboxylic acids', obs: 'Effervescence: CO₂ turns limewater milky', from: '#e9eef0' },
  { id: 'pcl5', n: 'Phosphorus(V) chloride', f: 'PCl5', proc: 'Add a little solid PCl₅ (fume cupboard).', pos: '–OH groups (alcohols, carboxylic acids)', obs: 'Steamy white fumes of HCl', from: '#e9eef0' },
  { id: 'agno3', n: 'Hydrolysis + AgNO₃', f: 'NaOH, HNO3, AgNO3', proc: 'Warm with NaOH(aq), acidify with dilute HNO₃, then add AgNO₃(aq).', pos: 'Halogenoalkanes and acyl chlorides', obs: 'White (Cl), cream (Br) or yellow (I) precipitate', from: '#e9eef0' },
  { id: 'litmus', n: 'Damp litmus in the vapour', f: 'litmus', proc: 'Hold damp red and blue litmus paper in the vapour.', pos: 'Amines (red → blue); acids (blue → red)', obs: 'Red litmus turns blue', from: '#e9eef0' },
  { id: 'smell', n: 'Smell (waft gently)', f: 'waft', proc: 'Waft the vapour carefully towards your nose.', pos: 'Esters (fruity), amines (fishy)', obs: 'Sweet, fruity smell', from: '#e9eef0' },
];
const IODO = new Set<string>(['etoh', 'mecho', 'p2ol', 'acetone', 'butanone', 'b2ol', 'phetoh', 'acph']);
const SMELL: Partial<Record<ClassId, string>> = { ester: 'Sweet, fruity smell', amine: 'Fishy smell', acid: 'Sharp, vinegary smell', acylcl: 'Choking — fumes in moist air', ald: 'Sharp, pungent smell' };
export const UNKNOWNS = ['chxe', 'chx', 'etoh', 'p1ol', 'p2ol', 'tbuoh', 'mecho', 'etcho', 'bzald', 'acetone', 'acoh', 'meoac', 'etoac', 'phoh', 'br1p', 'cltb', 'iet', 'accl', 'prnh2', 'pacoh', 'butanone'];

export function testResult(id: string, t: string): TestResult {
  const C = CP[id], k = C.cls, alc = k === 'alc1' || k === 'alc2' || k === 'alc3' || k === 'diol';
  const R = (pos: boolean, obs: string, vis: TestVis = {}): TestResult => ({ pos, obs, vis });
  switch (t) {
    case 'brw':
      if (k === 'phenol') return R(true, 'Decolourised, white precipitate', { to: '#eef2f3', ppt: '#fbfbf7' });
      if (k === 'alkene') return R(true, 'Orange → colourless', { to: '#eef2f3' });
      return R(false, 'Stays orange');
    case 'crox':
      if (k === 'alc1' || k === 'alc2' || k === 'ald') return R(true, 'Orange → green', { to: '#3e9c62' });
      return R(false, 'Stays orange');
    case 'dnph':
      if (k === 'ald' || k === 'ket') return R(true, 'Yellow–orange precipitate', { ppt: '#ef8f16' });
      return R(false, 'No precipitate');
    case 'tollens':
      if (k === 'ald') return R(true, 'Silver mirror forms', { mirror: true });
      return R(false, 'No change');
    case 'fehling':
      if (k === 'ald' && id !== 'bzald') return R(true, 'Blue → brick-red precipitate', { to: '#c49384', ppt: '#b2442a' });
      return R(false, 'Stays blue');
    case 'iodo':
      if (IODO.has(id)) return R(true, 'Pale yellow precipitate (CHI₃)', { to: '#f5efd6', ppt: '#f0d84e' });
      return R(false, 'No precipitate');
    case 'carb':
      if (k === 'acid') return R(true, 'Effervescence (CO₂)', { bubbles: true });
      if (k === 'acylcl') return R(true, 'Effervescence (it hydrolyses to acids)', { bubbles: true, fumes: true });
      return R(false, 'No effervescence');
    case 'pcl5':
      if (alc || k === 'acid' || k === 'phenol') return R(true, 'Steamy white fumes (HCl)', { fumes: true });
      return R(false, 'No fumes');
    case 'agno3': {
      if (k === 'acylcl') return R(true, 'White precipitate (AgCl), immediately', { ppt: '#f8f8f5' });
      if (k === 'halo') {
        const X = C.st.match(/Cl|Br|I/)![0];
        return X === 'Cl' ? R(true, 'White precipitate (AgCl)', { ppt: '#f8f8f5' }) : X === 'Br' ? R(true, 'Cream precipitate (AgBr)', { ppt: '#eee0b8' }) : R(true, 'Yellow precipitate (AgI)', { ppt: '#f0d64a' });
      }
      return R(false, 'No precipitate');
    }
    case 'litmus':
      if (k === 'amine') return R(true, 'Red litmus → blue', { paper: ['#d65a5a', '#4a73cf'] });
      if (k === 'acid' || k === 'acylcl') return R(true, 'Blue litmus → red', { paper: ['#4a73cf', '#d65a5a'], fumes: k === 'acylcl' });
      return R(false, 'No change to either paper', { paper: ['#d65a5a', '#d65a5a'] });
    case 'smell':
      if (SMELL[k]) return R(k === 'ester' || k === 'amine', SMELL[k]!, { waft: true });
      return R(false, 'No distinctive smell', { waft: true });
  }
  return R(false, '');
}

/* ===== Flowcharts (routes maps) ===== */
export const FLOWS: Flow[] = [
  { id: 'aliphatic', title: 'Aliphatic routes', blurb: 'Functional-group interconversions you need for multi-step syntheses.',
    nodes: {
      alkane: [0, 0, 'Alkane', 'R–H'], nitrile: [2, 0, 'Nitrile', 'R–C≡N'], amine: [3, 0, 'Amine', 'R–NH₂'], amide: [4, 0, 'Amide', 'R–CONH₂'], acylcl: [5, 0, 'Acyl chloride', 'R–COCl'],
      halo: [1, 1, 'Halogenoalkane', 'R–X'], ald: [3, 1, 'Aldehyde', 'R–CHO'], acid: [4, 1, 'Carboxylic acid', 'R–COOH'],
      alkene: [0, 2, 'Alkene', 'C=C'], alcohol: [2, 2, 'Alcohol', 'R–OH'], hn: [4, 2, 'Hydroxynitrile', 'R₂C(OH)CN'], ester: [5, 2, 'Ester', 'R–COOR′'],
      diol: [1, 3, 'Diol', 'HO–C–C–OH'], ket: [3, 3, 'Ketone', 'R–CO–R′'], salt: [5, 3, 'Carboxylate salt', 'R–COO⁻Na⁺'],
      poly: [0, 4, 'Poly(alkene)', '–[C–C]n–'], grig: [2, 4, 'Grignard', 'R–MgBr'],
    },
    edges: [
      ['alkane', 'halo', 'X2, UV', '', 'subst'],
      ['alkene', 'alkane', 'H2, Ni', '150 °C', 'addn'],
      ['alkene', 'halo', 'HBr', '', 'addn'],
      ['halo', 'alkene', 'KOH(eth)', 'reflux', 'elim'],
      ['alkene', 'alcohol', 'H2O(g)', 'H3PO4', 'addn'],
      ['alcohol', 'alkene', 'conc. H2SO4', 'heat', 'elim'],
      ['alkene', 'diol', 'KMnO4/H^+', '', 'redox'],
      ['alkene', 'poly', 'pressure', 'catalyst', 'addn'],
      ['halo', 'alcohol', 'NaOH(aq)', 'warm', 'subst'],
      ['alcohol', 'halo', 'KBr/H2SO4', 'or PCl5', 'subst'],
      ['halo', 'nitrile', 'KCN(eth)', 'reflux', 'subst'],
      ['halo', 'amine', 'NH3(eth)', 'sealed tube', 'subst'],
      ['halo', 'grig', 'Mg', 'dry ether', 'redox'],
      ['alcohol', 'ald', 'Cr2O7^2-/H^+', '1°, distil', 'redox'],
      ['ald', 'alcohol', 'LiAlH4', '', 'redox'],
      ['alcohol', 'ket', 'Cr2O7^2-/H^+', '2°', 'redox'],
      ['ket', 'alcohol', 'LiAlH4', '', 'redox'],
      ['ald', 'acid', 'Cr2O7^2-/H^+', 'reflux', 'redox'],
      ['alcohol', 'acid', 'Cr2O7^2-/H^+', '1°, reflux', 'redox'],
      ['acid', 'alcohol', 'LiAlH4', '', 'redox'],
      ['ald', 'hn', 'HCN/KCN', '', 'addn'],
      ['ket', 'hn', 'HCN/KCN', '', 'addn'],
      ['hn', 'acid', 'H^+(aq)', 'reflux', 'cond'],
      ['nitrile', 'acid', 'H^+(aq)', 'reflux', 'cond'],
      ['nitrile', 'amine', 'LiAlH4', '', 'redox'],
      ['acid', 'acylcl', 'PCl5', '', 'subst'],
      ['acylcl', 'acid', 'H2O', '', 'cond'],
      ['acid', 'ester', 'R′OH', 'conc. H2SO4', 'cond'],
      ['ester', 'acid', 'H^+(aq)', 'reflux', 'cond'],
      ['acylcl', 'ester', 'R′OH', '', 'cond'],
      ['acylcl', 'amide', 'NH3', 'or amine', 'cond'],
      ['ester', 'salt', 'NaOH(aq)', 'reflux', 'cond'],
      ['grig', 'alcohol', 'C=O', 'then H^+', 'addn'],
      ['grig', 'acid', 'CO2', 'then H^+', 'addn'],
    ] },
  { id: 'aromatic', title: 'Aromatic routes', blurb: 'Benzene keeps its ring: it substitutes rather than adds.',
    nodes: {
      nitrobz: [1, 0, null, null, 'nitrobz'], phnh2: [2, 0, null, null, 'phnh2'], diaz: [3, 0, null, null, 'diaz'], azo: [4, 0, null, null, 'azo'],
      tol: [1, 1, null, null, 'tol'], nphenam: [2, 1, null, null, 'nphenam'], phoh: [3, 1, null, null, 'phoh'], tbp: [4, 1, null, null, 'tbp'],
      benzene: [0, 2, null, null, 'benzene'], brbz: [1, 2, null, null, 'brbz'], mgph: [2, 2, null, null, 'mgph'], bzoh: [3, 2, null, null, 'bzoh'], bzcl: [4, 2, null, null, 'bzcl'],
      acph: [1, 3, null, null, 'acph'], phetoh: [2, 3, null, null, 'phetoh'],
      chx: [0, 4, null, null, 'chx'],
    },
    edges: [
      ['benzene', 'nitrobz', 'HNO3/H2SO4', '< 55 °C', 'subst'],
      ['nitrobz', 'phnh2', 'Sn/HCl', 'then NaOH', 'redox'],
      ['phnh2', 'diaz', 'HNO2', '< 10 °C', 'cond'],
      ['diaz', 'azo', 'phenol', 'NaOH, < 10 °C', 'subst'],
      ['phnh2', 'nphenam', 'CH3COCl', '', 'cond'],
      ['benzene', 'tol', 'CH3Cl', 'AlCl3', 'subst'],
      ['benzene', 'brbz', 'Br2', 'FeBr3', 'subst'],
      ['brbz', 'mgph', 'Mg', 'dry ether', 'redox'],
      ['mgph', 'bzoh', 'CO2', 'then H^+', 'addn'],
      ['mgph', 'phetoh', 'CH3CHO', 'then H^+', 'addn'],
      ['bzoh', 'bzcl', 'PCl5', '', 'subst'],
      ['benzene', 'acph', 'CH3COCl', 'AlCl3', 'subst'],
      ['acph', 'phetoh', 'LiAlH4', '', 'redox'],
      ['phoh', 'tbp', 'Br2(aq)', 'no catalyst', 'subst'],
      ['benzene', 'chx', 'H2, Ni', 'high T, P', 'addn'],
    ] },
];

/* ===== Preparation ===== */
export const TECH: Technique[] = [
  { id: 'reflux', n: 'Heating under reflux', app: 'reflux', what: 'A vertical condenser on top of a round-bottomed flask, heated with an electric heater or water bath.',
    why: 'Volatile reactants and products condense and drip back, so the mixture can be heated for a long time without losing material or boiling dry.',
    tips: ['Water in at the bottom of the condenser, out at the top', 'Add anti-bumping granules for smooth boiling', 'Never stopper the top: a closed system could explode', 'Use an electric heater or water bath — organic liquids are flammable'] },
  { id: 'distil', n: 'Simple distillation', app: 'distil', what: 'Heat the mixture; the vapour passes a thermometer at the side arm into a sloping condenser and a receiver.',
    why: 'Separates a volatile liquid from less volatile substances. Collect the fraction that boils close to the product’s boiling temperature.',
    tips: ['Thermometer bulb level with the side arm', 'Water in at the lower end of the condenser', 'Cool the receiver in ice for very volatile products (e.g. ethanal)', 'Use to remove a product as it forms (aldehyde)'] },
  { id: 'sepfun', n: 'Separating funnel (solvent extraction & washing)', app: 'sepfun', what: 'Shake two immiscible liquids together, let them settle into layers, and run the lower one off through the tap.',
    why: 'Removes water-soluble impurities. Washing with NaHCO₃ or Na₂CO₃ solution removes acid; washing with water removes soluble salts.',
    tips: ['Invert and open the tap often to release pressure (CO₂ when washing with carbonate)', 'The denser layer is at the bottom — check densities', 'Remove the stopper before running off the lower layer'] },
  { id: 'dry', n: 'Drying a liquid', app: null, what: 'Add an anhydrous drying agent, e.g. anhydrous MgSO₄, Na₂SO₄ or CaCl₂, and swirl.',
    why: 'Removes traces of water. Keep adding until the liquid turns from cloudy to clear and some solid moves freely. Then decant or filter off the solid.',
    tips: ['Cloudy → clear means dry', 'Anhydrous CaCl₂ also absorbs alcohols', 'Decant or filter before distilling'] },
  { id: 'recryst', n: 'Recrystallisation', app: null, what: 'Dissolve the impure solid in the minimum volume of hot solvent, filter hot, then cool to crystallise.',
    why: 'The product crystallises as the solution cools; soluble impurities stay dissolved because they are present in small amounts. Insoluble impurities are removed by the hot filtration.',
    tips: ['Minimum hot solvent → maximum recovery', 'Product should be very soluble hot and only slightly soluble cold', 'Cool slowly for purer, larger crystals'] },
  { id: 'buchner', n: 'Filtration under reduced pressure', app: 'buchner', what: 'A Büchner funnel on a side-arm (Büchner) flask connected to a vacuum pump.',
    why: 'Separates crystals from the liquid quickly and leaves them fairly dry. Wash with a little ice-cold solvent to remove surface impurities.',
    tips: ['Wet the filter paper with solvent first so it seals', 'Wash with a small amount of ice-cold solvent', 'Disconnect the vacuum before turning the pump off'] },
  { id: 'mp', n: 'Melting temperature', app: null, what: 'Heat a little of the dry solid in a sealed capillary tube in a melting-point apparatus.',
    why: 'A pure solid melts sharply (over 1–2 °C) at its data-book value. Impurities lower the melting temperature and make it melt over a range.',
    tips: ['Sharp + matches data value → pure', 'Lower and over a range → impure', 'Heat slowly near the expected value'] },
  { id: 'bp', n: 'Boiling temperature', app: null, what: 'Distil the liquid and read the steady thermometer value while it distils.',
    why: 'A pure liquid boils at a fixed temperature. Collect within a narrow range (± ~2 °C) of the data value.',
    tips: ['Read when the temperature is steady', 'A narrow range means a purer fraction'] },
];
export const PREPS: Prep[] = [
  { id: 'cltb', n: '2-chloro-2-methylpropane', kind: 'Liquid · from a tertiary alcohol', cid: 'cltb', steps: [
    ['Shake 2-methylpropan-2-ol with concentrated HCl in a separating funnel for ~20 minutes, often releasing the pressure.', 'Substitution (SN1) is fast at room temperature for a tertiary alcohol.'],
    ['Let the layers separate; run off and discard the lower aqueous layer.', 'The product is less dense than water, so it is the upper organic layer.'],
    ['Add sodium hydrogencarbonate solution, shake (releasing CO₂ pressure) and discard the aqueous layer.', 'Neutralises and removes leftover acid.'],
    ['Wash with distilled water and discard the aqueous layer.', 'Removes remaining water-soluble impurities.'],
    ['Run the organic layer into a dry flask and add anhydrous sodium sulfate; swirl until clear.', 'Removes dissolved water.'],
    ['Decant into a distillation flask and distil, collecting the fraction at 49–53 °C.', 'Purifies the product (boiling temperature ≈ 51 °C).'],
  ] },
  { id: 'ester', n: 'Ethyl ethanoate', kind: 'Liquid · esterification', cid: 'etoac', steps: [
    ['Mix ethanol and ethanoic acid in a round-bottomed flask; add concentrated sulfuric acid slowly with cooling, plus anti-bumping granules.', 'H₂SO₄ is the catalyst; adding it slowly controls the heat released.'],
    ['Heat under reflux for about 15 minutes.', 'The reaction is slow; reflux stops volatile reactants and product escaping.'],
    ['Rearrange the apparatus and distil off the crude ester.', 'Separates the volatile ester from the acid catalyst and less volatile material.'],
    ['Shake the distillate with sodium carbonate solution in a separating funnel, releasing the pressure; discard the aqueous layer.', 'Removes acidic impurities (ethanoic and sulfuric acid) as CO₂ fizzes off.'],
    ['Shake with concentrated calcium chloride solution and discard the aqueous layer.', 'Removes unreacted ethanol.'],
    ['Dry with anhydrous calcium chloride until the liquid is clear.', 'Removes water.'],
    ['Redistil, collecting the fraction at 74–79 °C.', 'Pure ethyl ethanoate boils at 77 °C.'],
  ] },
  { id: 'ethanal', n: 'Ethanal', kind: 'Liquid · partial oxidation', cid: 'mecho', steps: [
    ['Heat acidified potassium dichromate(VI) in a flask set up for distillation.', 'The oxidising agent is ready; the apparatus lets product escape at once.'],
    ['Add ethanol dropwise from a tap funnel into the hot oxidising mixture.', 'Oxidising agent is in excess at every moment, but the aldehyde forms in small amounts.'],
    ['Distil off the ethanal as soon as it forms.', 'Removing it prevents further oxidation to ethanoic acid (ethanal boils at 21 °C).'],
    ['Collect the distillate in a receiver cooled in ice.', 'Ethanal is very volatile; cooling stops it evaporating.'],
  ] },
  { id: 'solid', n: 'Purifying an organic solid', kind: 'Solid · e.g. aspirin, N-phenylethanamide', cid: 'nphenam', steps: [
    ['Dissolve the crude solid in the minimum volume of hot solvent.', 'A saturated hot solution gives the maximum yield of crystals on cooling.'],
    ['Filter the hot solution through a pre-warmed funnel.', 'Removes insoluble impurities; warming stops crystals forming in the funnel.'],
    ['Leave the filtrate to cool slowly, then stand it in ice.', 'The product crystallises; soluble impurities stay in solution.'],
    ['Filter the crystals under reduced pressure (Büchner funnel).', 'A fast separation that leaves the crystals fairly dry.'],
    ['Wash the crystals with a little ice-cold solvent.', 'Removes impurities on the surface without dissolving much product.'],
    ['Dry the crystals between filter papers or in a desiccator.', 'Removes solvent before weighing.'],
    ['Measure the melting temperature.', 'Sharp and close to the data value → pure.'],
  ] },
];


/* ================= logic ================= */
export const isCompound = (id: string) => id in CP;
/** Plain name of the thing in slot b: reagent formula or compound name (HTML). */
export const rgName = (id: string) => (RG[id] ? chem(RG[id].f) : esc(CP[id].n));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const RXMAP = new Map(RX.map((r) => [r.a + '|' + r.b, r]));
/** The reaction between two things, in either order. */
export const findRx = (x: string, y: string) => RXMAP.get(x + '|' + y) || RXMAP.get(y + '|' + x) || null;

/** Everything reachable from a set of compounds (up to 9 steps), with the reaction that first made each. */
export function explore(start: string[]) {
  const depth = new Map<string, number>(), par = new Map<string, Reaction>();
  start.forEach((c) => depth.set(c, 0));
  for (let round = 1; round <= 9; round++) {
    const add = new Map<string, Reaction>();
    RX.forEach((r) => {
      if (!depth.has(r.a) || depth.get(r.a)! >= round) return;
      if (CP[r.b] && (!depth.has(r.b) || depth.get(r.b)! >= round)) return;
      r.p.forEach((p) => { if (!depth.has(p) && !add.has(p)) add.set(p, r); });
    });
    if (!add.size) break;
    add.forEach((r, p) => { depth.set(p, round); par.set(p, r); });
  }
  return { depth, par };
}
/** The reactions, in order, that make a target from an explore() result. */
export function route(target: string, ex: ReturnType<typeof explore>) {
  const out: Reaction[] = [], seen = new Set<number>();
  (function need(c: string) { const r = ex.par.get(c); if (!r) return; need(r.a); if (CP[r.b]) need(r.b); if (!seen.has(r.id)) { seen.add(r.id); out.push(r); } })(target);
  return out;
}
/** Compounds the lab can reach from the starters, and the reactions among them. */
export const LABSET = new Set(explore(STARTERS).depth.keys());
export const LABRX = RX.filter((r) => LABSET.has(r.a) && (RG[r.b] || LABSET.has(r.b)));

/** Why two things don't react (HTML). kx / ky: 'c' compound or 'r' reagent. */
export function whyNot(x: string, kx: 'c' | 'r', y: string, ky: 'c' | 'r'): string {
  const n1 = NOREACT[x + '|' + y] || NOREACT[y + '|' + x];
  if (n1) return esc(n1);
  if (kx === 'c' && ky === 'c') {
    if (x === y) return `Two portions of ${esc(CP[x].n)} won’t react with each other. Add a reagent.`;
    return `${cap(esc(CP[x].n))} and ${esc(CP[y].n)} don’t react together on the specification. Try a reagent instead.`;
  }
  const c = kx === 'c' ? x : y, r = kx === 'r' ? x : y, cls = CP[c].cls, list = REACTS[r] || [];
  if (list.includes(cls)) return `${cap(CLASSN[cls].toLowerCase())}s do react with ${rgName(r)}, but this lab doesn’t stock that particular product. Try another ${CLASSN[cls].toLowerCase()}.`;
  return `No reaction. ${rgName(r)} is used on ${list.map((k) => CLASSN[k].toLowerCase() + 's').join(', ') || 'other compounds'}.`;
}

/** A reaction as plain text for the Copy button. */
export function rxPlain(r: Reaction): string {
  const with_ = RG[r.b] ? `${plain(RG[r.b].f)} (${plain(RG[r.b].n)})` : CP[r.b].n;
  return [`${CP[r.a].n} + ${with_} → ${r.p.map((p) => CP[p].n).join(' + ')}`, ...r.eq.map(plain), `Type: ${FAM[r.fam][0]} — ${r.mech}`, `Conditions: ${plain(r.cond)}`, r.note ? `Note: ${r.note}` : '']
    .filter(Boolean).join('\n');
}
export const productNames = (r: Reaction) => r.p.map((p) => CP[p].n).join(' + ');

/* ---------- synthesis challenges ---------- */
const FEED = ['C1', 'C2', 'ethene', 'propene', 'benzene', 'phoh', 'etoh', 'bret', 'brme', 'p1ol', 'p2ol', 'acetone', 'mecho', 'acoh', 'tbuoh', 'C3', 'meoh'];
const NOT_TARGET = new Set<ClassId>(['salt', 'grignard']);
export type Difficulty = 'easy' | 'medium' | 'hard';
/** A random target whose shortest route from random starting materials has a length that fits the difficulty. */
export function genChallenge(diff: Difficulty, avoid: string | null) {
  const [lo, hi] = { easy: [1, 2], medium: [2, 3], hard: [3, 6] }[diff];
  for (let t = 0; t < 400; t++) {
    const start = [pick(FEED)];
    if (Math.random() < 0.3) { const s2 = pick(FEED); if (!start.includes(s2)) start.push(s2); }
    const ex = explore(start);
    const cands = [...ex.depth.keys()].filter((c) => !start.includes(c) && !NOT_TARGET.has(CP[c].cls) && c !== avoid)
      .map((c) => [c, route(c, ex)] as const).filter(([, rt]) => rt.length >= lo && rt.length <= hi);
    if (cands.length) { const [c, rt] = pick(cands); return { start, target: c, sol: rt }; }
  }
  return { start: ['ethene'], target: 'etoac', sol: route('etoac', explore(['ethene'])) };
}
/** The next reaction on a shortest route from what is on the bench (for hints). */
export function nextStep(bench: string[], target: string) {
  return route(target, explore(bench)).find((r) => bench.includes(r.a) && (RG[r.b] || bench.includes(r.b)));
}

/* ---------- identification ---------- */
const sig = (id: string) => TESTS.map((t) => testResult(id, t.id).obs).join('|');
/** Four candidates for an unknown: isomers first, then the same family, all with different test results. */
export function makeOpts(cid: string): string[] {
  const f = molFormula(CP[cid].smi), s = sig(cid), ORDER = Object.keys(CP);
  const pool = ORDER.filter((id) => id !== cid && !(['salt', 'grignard', 'polymer', 'diazonium'] as ClassId[]).includes(CP[id].cls) && sig(id) !== s);
  const iso = shuffle(pool.filter((id) => molFormula(CP[id].smi) === f));
  const fam = GROUPS.find((g) => g[2] && g[2].includes(CP[cid].cls));
  const near = shuffle(pool.filter((id) => !iso.includes(id) && UNKNOWNS.includes(id) && fam && fam[2]!.includes(CP[id].cls)));
  const rest = shuffle(pool.filter((id) => !iso.includes(id) && !near.includes(id) && UNKNOWNS.includes(id)));
  return shuffle([cid, ...[...iso, ...near, ...rest].slice(0, 3)]);
}
export const sampleCode = () => 'Sample ' + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + '-' + (10 + Math.floor(Math.random() * 89));
/** The compound each test card in the codex shows as its example. */
export const TEST_EX: Record<string, string> = { brw: 'chxe', crox: 'etoh', dnph: 'acetone', tollens: 'mecho', fehling: 'mecho', iodo: 'acetone', carb: 'acoh', pcl5: 'etoh', agno3: 'br1p', litmus: 'prnh2', smell: 'etoac' };

/* ---------- codex self-test options ---------- */
export function rxQuizOptions(r: Reaction): string[] {
  const ans = productNames(r);
  const alts = shuffle(unique(RX.filter((x) => x !== r && (x.a === r.a || x.fam === r.fam || CP[x.p[0]].cls === CP[r.p[0]].cls)).map(productNames)).filter((n) => n !== ans)).slice(0, 3);
  return shuffle([ans, ...alts]);
}
export function testQuizOptions(t: Test): string[] {
  return shuffle([t.pos, ...shuffle(TESTS.filter((x) => x !== t).map((x) => x.pos)).slice(0, 3)]);
}
