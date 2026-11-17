/* d-Block Colour Bench: chemistry data. Species, stock solutions, reagents, reactions and flowchart layouts for
   Edexcel IAL transition-metal chemistry. Pure data and pure functions: no DOM, no UI state. */

import { rgba, unique, shuffle } from '../../lib/util';
import { chem } from '../../lib/chem';

export type MetalId = 'V' | 'Cr' | 'Mn' | 'Fe' | 'Co' | 'Ni' | 'Cu' | 'Zn';
export const METAL: Record<MetalId, string> = { V: 'Vanadium', Cr: 'Chromium', Mn: 'Manganese', Fe: 'Iron', Co: 'Cobalt', Ni: 'Nickel', Cu: 'Copper', Zn: 'Zinc' };
export const METALS = Object.keys(METAL) as MetalId[];
const GROUP: Record<MetalId, number> = { V: 5, Cr: 6, Mn: 7, Fe: 8, Co: 9, Ni: 10, Cu: 11, Zn: 12 };
export const COLOURLESS = '#e4eef2';

/* ---------- species ----------
   f formula (chem() notation) · n name · liq solution colour · la its strength (alpha) · ppt precipitate colour ·
   look what you see · geo shape and coordination number (default 'octahedral · 6') · note replaces the d-electron note */
export interface Species { m: MetalId; ox: number; f: string; n: string; liq?: string; la?: number; ppt?: string; look: string; geo?: string; note?: string }
export const SP: Record<string, Species> = {
  V5:{m:'V',ox:5,f:'VO2^+',n:'dioxovanadium(V) ion',liq:'#e8c234',la:.74,look:'Yellow solution',geo:'oxo-cation'},
  V4:{m:'V',ox:4,f:'VO^2+',n:'oxovanadium(IV) ion',liq:'#2d6cc2',la:.72,look:'Blue solution',geo:'oxo-cation'},
  V3:{m:'V',ox:3,f:'[V(H2O)6]^3+',n:'hexaaquavanadium(III) ion',liq:'#2f8752',la:.72,look:'Green solution'},
  V2:{m:'V',ox:2,f:'[V(H2O)6]^2+',n:'hexaaquavanadium(II) ion',liq:'#6b3b9f',la:.74,look:'Violet solution'},

  Cr3:{m:'Cr',ox:3,f:'[Cr(H2O)6]^3+',n:'hexaaquachromium(III) ion',liq:'#3f7a4e',la:.72,look:'Green solution',note:'Strictly violet, but usually seen as green because sulfate or chloride ions replace some water ligands.'},
  CrOH3:{m:'Cr',ox:3,f:'[Cr(OH)3(H2O)3]',n:'chromium(III) hydroxide',ppt:'#6f8c6c',look:'Grey-green precipitate',geo:'octahedral · 6 · neutral'},
  CrOH6:{m:'Cr',ox:3,f:'[Cr(OH)6]^3-',n:'hexahydroxochromate(III) ion',liq:'#2c6a3b',la:.76,look:'Dark green solution'},
  CrNH3:{m:'Cr',ox:3,f:'[Cr(NH3)6]^3+',n:'hexaamminechromium(III) ion',liq:'#8656a6',la:.68,look:'Purple solution'},
  CrO4:{m:'Cr',ox:6,f:'CrO4^2-',n:'chromate(VI) ion',liq:'#f2c31b',la:.78,look:'Yellow solution',geo:'tetrahedral · 4 O'},
  Cr2O7:{m:'Cr',ox:6,f:'Cr2O7^2-',n:'dichromate(VI) ion',liq:'#e2711b',la:.82,look:'Orange solution',geo:'two CrO₄ tetrahedra'},
  Cr2:{m:'Cr',ox:2,f:'[Cr(H2O)6]^2+',n:'hexaaquachromium(II) ion',liq:'#3b78cf',la:.72,look:'Blue solution',note:'Only stable with air excluded.'},

  Mn2:{m:'Mn',ox:2,f:'[Mn(H2O)6]^2+',n:'hexaaquamanganese(II) ion',liq:'#efc6d2',la:.4,look:'Very pale pink solution',note:'d⁵ high-spin: every d–d transition needs an electron to flip spin, so absorption is very weak and the solution is almost colourless.'},
  MnOH2:{m:'Mn',ox:2,f:'[Mn(OH)2(H2O)4]',n:'manganese(II) hydroxide',ppt:'#e4d6c0',look:'Off-white precipitate',geo:'octahedral · 6 · neutral',note:'Darkens to brown on standing in air.'},
  MnOOH:{m:'Mn',ox:4,f:'MnO(OH)2',n:'manganese(IV) oxide-hydroxide',ppt:'#55361f',look:'Dark brown precipitate',geo:'solid'},

  Fe2:{m:'Fe',ox:2,f:'[Fe(H2O)6]^2+',n:'hexaaquairon(II) ion',liq:'#bcd88f',la:.55,look:'Pale green solution'},
  FeOH2:{m:'Fe',ox:2,f:'[Fe(OH)2(H2O)4]',n:'iron(II) hydroxide',ppt:'#4c6b3d',look:'Dark green precipitate',geo:'octahedral · 6 · neutral',note:'Turns orange-brown at the surface on standing in air.'},
  Fe3:{m:'Fe',ox:3,f:'[Fe(H2O)6]^3+',n:'hexaaquairon(III) ion',liq:'#d39a33',la:.68,look:'Yellow-orange solution',note:'Pure [Fe(H₂O)₆]³⁺ is pale violet; solutions look yellow-orange because some is deprotonated to [Fe(OH)(H₂O)₅]²⁺.'},
  FeOH3:{m:'Fe',ox:3,f:'[Fe(OH)3(H2O)3]',n:'iron(III) hydroxide',ppt:'#a14d1a',look:'Orange-brown precipitate',geo:'octahedral · 6 · neutral'},
  FeSCN:{m:'Fe',ox:3,f:'[Fe(SCN)(H2O)5]^2+',n:'thiocyanatopentaaquairon(III) ion',liq:'#8c0e16',la:.9,look:'Blood-red solution'},
  FeI2:{m:'Fe',ox:2,f:'Fe^2+ + I2',n:'iron(II) ions with iodine',liq:'#8a5214',la:.82,look:'Brown solution (iodine)',geo:'mixture'},

  Co2:{m:'Co',ox:2,f:'[Co(H2O)6]^2+',n:'hexaaquacobalt(II) ion',liq:'#e095ac',la:.64,look:'Pink solution'},
  CoOH2:{m:'Co',ox:2,f:'[Co(OH)2(H2O)4]',n:'cobalt(II) hydroxide',ppt:'#4a6eb3',look:'Blue precipitate',geo:'octahedral · 6 · neutral',note:'May turn pink on standing; darkens to brown in air.'},
  CoOH3:{m:'Co',ox:3,f:'Co(OH)3',n:'cobalt(III) hydroxide',ppt:'#4e3320',look:'Dark brown precipitate',geo:'solid'},
  CoNH3:{m:'Co',ox:2,f:'[Co(NH3)6]^2+',n:'hexaamminecobalt(II) ion',liq:'#c9a359',la:.62,look:'Straw-coloured (pale brown) solution',note:'Darkens on standing as air oxidises it to cobalt(III).'},
  CoNH33:{m:'Co',ox:3,f:'[Co(NH3)6]^3+',n:'hexaamminecobalt(III) ion',liq:'#7a3519',la:.82,look:'Dark brown solution'},
  CoCl4:{m:'Co',ox:2,f:'[CoCl4]^2-',n:'tetrachlorocobaltate(II) ion',liq:'#1f46b6',la:.84,look:'Blue solution',geo:'tetrahedral · 4'},

  Ni2:{m:'Ni',ox:2,f:'[Ni(H2O)6]^2+',n:'hexaaquanickel(II) ion',liq:'#5daa6f',la:.64,look:'Green solution'},
  NiOH2:{m:'Ni',ox:2,f:'[Ni(OH)2(H2O)4]',n:'nickel(II) hydroxide',ppt:'#87b36e',look:'Green precipitate',geo:'octahedral · 6 · neutral'},
  NiNH3:{m:'Ni',ox:2,f:'[Ni(NH3)6]^2+',n:'hexaamminenickel(II) ion',liq:'#6b72d0',la:.68,look:'Blue-violet solution'},

  Cu2:{m:'Cu',ox:2,f:'[Cu(H2O)6]^2+',n:'hexaaquacopper(II) ion',liq:'#3a8fd8',la:.72,look:'Blue solution',geo:'distorted octahedral · 6'},
  CuOH2:{m:'Cu',ox:2,f:'[Cu(OH)2(H2O)4]',n:'copper(II) hydroxide',ppt:'#86bde8',look:'Pale blue precipitate',geo:'octahedral · 6 · neutral'},
  CuNH3:{m:'Cu',ox:2,f:'[Cu(NH3)4(H2O)2]^2+',n:'tetraamminediaquacopper(II) ion',liq:'#1b38a6',la:.9,look:'Deep blue solution',geo:'distorted octahedral · 6'},
  CuCl4:{m:'Cu',ox:2,f:'[CuCl4]^2-',n:'tetrachlorocuprate(II) ion',liq:'#b6be34',la:.82,look:'Yellow-green solution',geo:'tetrahedral · 4',note:'Yellow when concentrated; green while some [Cu(H₂O)₆]²⁺ remains.'},
  CuI:{m:'Cu',ox:1,f:'CuI + I2',n:'copper(I) iodide in iodine solution',ppt:'#f1ece2',liq:'#7c4a13',la:.78,look:'White precipitate in a brown solution',geo:'mixture'},

  Zn2:{m:'Zn',ox:2,f:'[Zn(H2O)6]^2+',n:'hexaaquazinc(II) ion',look:'Colourless solution'},
  ZnOH2:{m:'Zn',ox:2,f:'[Zn(OH)2(H2O)4]',n:'zinc hydroxide',ppt:'#f5f5f2',look:'White precipitate',geo:'neutral'},
  ZnOH4:{m:'Zn',ox:2,f:'[Zn(OH)4]^2-',n:'tetrahydroxozincate ion',look:'Colourless solution',geo:'tetrahedral · 4'},
  ZnNH3:{m:'Zn',ox:2,f:'[Zn(NH3)4]^2+',n:'tetraamminezinc(II) ion',look:'Colourless solution',geo:'tetrahedral · 4'},
};

/* ---------- stock solutions on the shelf: [species id, ion, bottle label] ---------- */
export const SHELF: [string, string, string][] = [
  ['V5', 'VO2^+', 'Ammonium vanadate(V), in acid'],
  ['Cr3', 'Cr^3+', 'Chromium(III) sulfate'],
  ['Cr2O7', 'Cr2O7^2-', 'Potassium dichromate(VI)'],
  ['Mn2', 'Mn^2+', 'Manganese(II) sulfate'],
  ['Fe2', 'Fe^2+', 'Iron(II) sulfate'],
  ['Fe3', 'Fe^3+', 'Iron(III) chloride'],
  ['Co2', 'Co^2+', 'Cobalt(II) chloride'],
  ['Ni2', 'Ni^2+', 'Nickel(II) sulfate'],
  ['Cu2', 'Cu^2+', 'Copper(II) sulfate'],
  ['Zn2', 'Zn^2+', 'Zinc sulfate'],
];

/* ---------- reagents ---------- */
export type ReagentId = 'naoh' | 'nh3' | 'h2so4' | 'hcl' | 'water' | 'zn' | 'h2o2' | 'kmno4' | 'ki' | 'kscn' | 'air';
/** how much: a few drops, in excess, a single addition, or a chain (zinc keeps reducing while you wait) */
export type Amount = 'few' | 'xs' | 'once' | 'chain';
export const RG: Record<ReagentId, { f: string; n: string; c: string }> = {
  naoh: { f: 'NaOH(aq)', n: 'sodium hydroxide', c: '#e6f0f3' },
  nh3: { f: 'NH3(aq)', n: 'aqueous ammonia', c: '#e6f0f3' },
  h2so4: { f: 'H2SO4(aq)', n: 'dilute sulfuric acid', c: '#e6f0f3' },
  hcl: { f: 'HCl', n: 'concentrated hydrochloric acid', c: '#eef1d8' },
  water: { f: 'H2O', n: 'distilled water', c: '#e6f0f3' },
  zn: { f: 'Zn', n: 'zinc granules in acid', c: '#9aa3a8' },
  h2o2: { f: 'H2O2(aq)', n: 'hydrogen peroxide', c: '#e6f0f3' },
  kmno4: { f: 'MnO4^-/H^+', n: 'acidified potassium manganate(VII)', c: '#6b1f7a' },
  ki: { f: 'KI(aq)', n: 'potassium iodide', c: '#e6f0f3' },
  kscn: { f: 'KSCN(aq)', n: 'potassium thiocyanate', c: '#e6f0f3' },
  air: { f: 'Air', n: 'shake and leave to stand', c: '#ffffff' },
};
export const RACK: { g: string; items: { r: ReagentId; amt: Amount; s: string }[] }[] = [
  { g: 'Alkalis', items: [
    { r: 'naoh', amt: 'few', s: 'a few drops' }, { r: 'naoh', amt: 'xs', s: 'in excess' },
    { r: 'nh3', amt: 'few', s: 'a few drops' }, { r: 'nh3', amt: 'xs', s: 'in excess' }] },
  { g: 'Acids and water', items: [
    { r: 'h2so4', amt: 'once', s: 'dilute acid' }, { r: 'hcl', amt: 'once', s: 'concentrated' }, { r: 'water', amt: 'once', s: 'dilute with water' }] },
  { g: 'Redox and tests', items: [
    { r: 'zn', amt: 'chain', s: 'zinc + acid, wait' }, { r: 'h2o2', amt: 'once', s: 'oxidising agent' }, { r: 'kmno4', amt: 'once', s: 'acidified, dropwise' },
    { r: 'ki', amt: 'once', s: 'iodide ions' }, { r: 'kscn', amt: 'once', s: 'thiocyanate test' }, { r: 'air', amt: 'once', s: 'shake, leave to stand' }] },
];
export const AMT: Record<Amount, string> = { few: 'a few drops', xs: 'in excess', once: '', chain: '' };

/* ---------- reaction types (cls = the family colour token) ---------- */
export type Family = 'acidbase' | 'amph' | 'ligand' | 'redox';
export type TypeId = 'dep' | 'prot' | 'amph' | 'ab' | 'lig' | 'redox';
export const TY: Record<TypeId, { l: string; cls: Family }> = {
  dep: { l: 'Acid–base · deprotonation', cls: 'acidbase' },
  prot: { l: 'Acid–base · protonation', cls: 'acidbase' },
  amph: { l: 'Acid–base · amphoteric', cls: 'amph' },
  ab: { l: 'Acid–base equilibrium', cls: 'acidbase' },
  lig: { l: 'Ligand exchange', cls: 'ligand' },
  redox: { l: 'Redox', cls: 'redox' },
};

/* ---------- transitions: from + reagent → to ----------
   via: an in-between colour shown briefly (vanadium's green mixture) */
export interface Transition { f: string; r: ReagentId; t: string; ty: TypeId; eq: string; why: string; via?: string }
export const T: Transition[] = [];
const add = (f: string, r: ReagentId, t: string, ty: TypeId, eq: string, why: string, via?: string) => { T.push({ f, r, t, ty, eq, why, via }); };
const DEP_OH = 'OH⁻ removes H⁺ from water ligands. The complex becomes neutral, so it is insoluble and precipitates.';
const DEP_NH3 = 'With a little ammonia, NH₃ acts as a Brønsted base (an H⁺ acceptor), not as a ligand. The same precipitate forms as with NaOH.';
const PROT = 'H⁺ re-protonates the hydroxide ligands and the aqua ion returns.';
for (const M of ['Mn','Fe','Co','Ni','Cu','Zn']){
  add(M+'2','naoh',M+'OH2','dep',`[${M}(H2O)6]^2+ + 2OH^- -> [${M}(OH)2(H2O)4] + 2H2O`,DEP_OH);
  add(M+'2','nh3',M+'OH2','dep',`[${M}(H2O)6]^2+ + 2NH3 -> [${M}(OH)2(H2O)4] + 2NH4^+`,DEP_NH3);
  add(M+'OH2','h2so4',M+'2',M==='Zn'?'amph':'prot',`[${M}(OH)2(H2O)4] + 2H^+ -> [${M}(H2O)6]^2+`,M==='Zn'?'Zinc hydroxide is amphoteric: it dissolves in acid as well as in excess alkali.':PROT);
}
for (const M of ['Cr','Fe']){
  add(M+'3','naoh',M+'OH3','dep',`[${M}(H2O)6]^3+ + 3OH^- -> [${M}(OH)3(H2O)3] + 3H2O`,'OH⁻ removes H⁺ from three water ligands, giving a neutral complex that precipitates.');
  add(M+'3','nh3',M+'OH3','dep',`[${M}(H2O)6]^3+ + 3NH3 -> [${M}(OH)3(H2O)3] + 3NH4^+`,DEP_NH3);
  add(M+'OH3','h2so4',M+'3',M==='Cr'?'amph':'prot',`[${M}(OH)3(H2O)3] + 3H^+ -> [${M}(H2O)6]^3+`,M==='Cr'?'Chromium(III) hydroxide is amphoteric: it dissolves in acid and in excess alkali.':PROT);
}
// Vanadium
add('V5','zn','V4','redox','2VO2^+ + Zn + 4H^+ -> 2VO^2+ + Zn^2+ + 2H2O','Zinc reduces V(+5) to V(+4). Watch for green on the way: that is a mixture of yellow VO₂⁺ and blue VO²⁺, not a separate ion.','#6f9e3c');
add('V4','zn','V3','redox','2VO^2+ + Zn + 4H^+ -> 2V^3+ + Zn^2+ + 2H2O','Further reduction to V(+3).');
add('V3','zn','V2','redox','2V^3+ + Zn -> 2V^2+ + Zn^2+','Zinc reaches V(+2) because E°(Zn²⁺/Zn) = −0.76 V is more negative than E°(V³⁺/V²⁺) = −0.26 V.');
add('V2','air','V3','redox','4V^2+ + O2 + 4H^+ -> 4V^3+ + 2H2O','Violet V²⁺ is easily oxidised by oxygen from the air.');
add('V4','kmno4','V5','redox','5VO^2+ + MnO4^- + H2O -> 5VO2^+ + Mn^2+ + 2H^+','Manganate(VII) oxidises V(+4) back to V(+5); its purple colour disappears.');
// Chromium
add('CrOH3','naoh','CrOH6','amph','[Cr(OH)3(H2O)3] + 3OH^- -> [Cr(OH)6]^3- + 3H2O','Amphoteric: OH⁻ removes three more H⁺, giving a soluble anion.');
add('CrOH3','nh3','CrNH3','lig','[Cr(OH)3(H2O)3] + 6NH3 -> [Cr(NH3)6]^3+ + 3H2O + 3OH^-','With a large excess of ammonia, all six ligands are replaced by NH₃. Coordination number stays 6.');
add('CrOH6','h2o2','CrO4','redox','2[Cr(OH)6]^3- + 3H2O2 -> 2CrO4^2- + 2OH^- + 8H2O','In alkaline solution (warm), H₂O₂ oxidises Cr(+3) to Cr(+6).');
add('CrO4','h2so4','Cr2O7','ab','2CrO4^2- + 2H^+ <=> Cr2O7^2- + H2O','Not redox: chromium stays +6. Adding H⁺ shifts the equilibrium to the right.');
add('Cr2O7','naoh','CrO4','ab','Cr2O7^2- + 2OH^- -> 2CrO4^2- + H2O','Not redox: chromium stays +6. OH⁻ removes H⁺, so the equilibrium moves to yellow chromate(VI).');
add('Cr2O7','zn','Cr3','redox','Cr2O7^2- + 14H^+ + 3Zn -> 2Cr^3+ + 7H2O + 3Zn^2+','Zinc in acid reduces Cr(+6) to Cr(+3).');
add('Cr3','zn','Cr2','redox','2Cr^3+ + Zn -> 2Cr^2+ + Zn^2+','Then Cr(+3) to Cr(+2). Air must be kept out, or the blue colour does not last.');
add('Cr2','air','Cr3','redox','4Cr^2+ + O2 + 4H^+ -> 4Cr^3+ + 2H2O','Oxygen re-oxidises blue Cr²⁺ to green Cr³⁺.');
// Manganese
add('MnOH2','air','MnOOH','redox','2Mn(OH)2 + O2 -> 2MnO(OH)2','Mn(+2) is oxidised to Mn(+4). The off-white precipitate darkens from the surface down.');
add('MnOH2','h2o2','MnOOH','redox','Mn(OH)2 + H2O2 -> MnO(OH)2 + H2O','H₂O₂ oxidises Mn(+2) to Mn(+4) at once.');
// Iron
add('FeOH2','air','FeOH3','redox','4Fe(OH)2 + O2 + 2H2O -> 4Fe(OH)3','Fe(+2) is oxidised to Fe(+3) by air; the surface turns orange-brown first.');
add('FeOH2','h2o2','FeOH3','redox','2Fe(OH)2 + H2O2 -> 2Fe(OH)3','H₂O₂ oxidises Fe(+2) to Fe(+3) immediately.');
add('Fe2','kmno4','Fe3','redox','MnO4^- + 8H^+ + 5Fe^2+ -> Mn^2+ + 4H2O + 5Fe^3+','Each purple drop is decolourised while Fe²⁺ remains. This is the Fe²⁺ titration: self-indicating, end point is the first permanent pink.');
add('Fe2','h2o2','Fe3','redox','2Fe^2+ + H2O2 + 2H^+ -> 2Fe^3+ + 2H2O','H₂O₂ oxidises Fe(+2) to Fe(+3).');
add('Fe3','zn','Fe2','redox','2Fe^3+ + Zn -> 2Fe^2+ + Zn^2+','Zinc reduces Fe(+3) to Fe(+2). This is how Fe³⁺ is converted to Fe²⁺ before a manganate(VII) titration.');
add('Fe3','kscn','FeSCN','lig','[Fe(H2O)6]^3+ + SCN^- -> [Fe(SCN)(H2O)5]^2+ + H2O','One SCN⁻ replaces one water ligand. A very sensitive test for Fe³⁺.');
add('Fe3','ki','FeI2','redox','2Fe^3+ + 2I^- -> 2Fe^2+ + I2','E°(Fe³⁺/Fe²⁺) = +0.77 V is more positive than E°(I₂/I⁻) = +0.54 V, so Fe³⁺ oxidises iodide to brown iodine.');
// Cobalt
add('CoOH2','nh3','CoNH3','lig','[Co(OH)2(H2O)4] + 6NH3 -> [Co(NH3)6]^2+ + 4H2O + 2OH^-','Excess NH₃ replaces all six ligands. Coordination number stays 6.');
add('CoNH3','air','CoNH33','redox','4[Co(NH3)6]^2+ + O2 + 2H2O -> 4[Co(NH3)6]^3+ + 4OH^-','Ammine ligands stabilise Co(+3), so air oxidises the complex and the solution darkens.');
add('CoNH3','h2o2','CoNH33','redox','2[Co(NH3)6]^2+ + H2O2 -> 2[Co(NH3)6]^3+ + 2OH^-','H₂O₂ oxidises Co(+2) to Co(+3) quickly.');
add('CoOH2','air','CoOH3','redox','4Co(OH)2 + O2 + 2H2O -> 4Co(OH)3','Slow oxidation by air to cobalt(III) hydroxide.');
add('CoOH2','h2o2','CoOH3','redox','2Co(OH)2 + H2O2 -> 2Co(OH)3','H₂O₂ oxidises Co(+2) to Co(+3).');
add('Co2','hcl','CoCl4','lig','[Co(H2O)6]^2+ + 4Cl^- <=> [CoCl4]^2- + 6H2O','Cl⁻ is larger than H₂O, so only four fit. Coordination number falls from 6 to 4: octahedral to tetrahedral.');
add('CoCl4','water','Co2','lig','[CoCl4]^2- + 6H2O <=> [Co(H2O)6]^2+ + 4Cl^-','Adding water shifts the equilibrium back to the pink aqua ion.');
// Nickel
add('NiOH2','nh3','NiNH3','lig','[Ni(OH)2(H2O)4] + 6NH3 -> [Ni(NH3)6]^2+ + 4H2O + 2OH^-','Excess NH₃ replaces all six ligands. Coordination number stays 6.');
// Copper
add('CuOH2','nh3','CuNH3','lig','[Cu(OH)2(H2O)4] + 4NH3 -> [Cu(NH3)4(H2O)2]^2+ + 2H2O + 2OH^-','Only four NH₃ replace ligands; two water molecules stay in the axial positions. Still 6-coordinate.');
add('CuNH3','h2so4','Cu2','lig','[Cu(NH3)4(H2O)2]^2+ + 4H^+ + 4H2O -> [Cu(H2O)6]^2+ + 4NH4^+','H⁺ turns NH₃ into NH₄⁺, which has no lone pair, so water ligands return.');
add('Cu2','hcl','CuCl4','lig','[Cu(H2O)6]^2+ + 4Cl^- <=> [CuCl4]^2- + 6H2O','Cl⁻ is larger than H₂O, so only four fit. Coordination number falls from 6 to 4.');
add('CuCl4','water','Cu2','lig','[CuCl4]^2- + 6H2O <=> [Cu(H2O)6]^2+ + 4Cl^-','Dilution shifts the equilibrium back to the blue aqua ion.');
add('Cu2','ki','CuI','redox','2Cu^2+ + 4I^- -> 2CuI + I2','Cu(+2) is reduced to Cu(+1). The iodine released is titrated with thiosulfate to find the copper content.');
// Zinc
add('ZnOH2','naoh','ZnOH4','amph','[Zn(OH)2(H2O)4] + 2OH^- -> [Zn(OH)4]^2- + 4H2O','Zinc hydroxide is amphoteric: it dissolves in excess alkali.');
add('ZnOH2','nh3','ZnNH3','lig','[Zn(OH)2(H2O)4] + 4NH3 -> [Zn(NH3)4]^2+ + 4H2O + 2OH^-','Excess NH₃ forms a soluble, colourless ammine complex.');

const TM: Record<string, Transition> = Object.fromEntries(T.map((t) => [t.f + '|' + t.r, t]));

/** What the student sees when a reagent does nothing. */
export function noChange(sp: string, r: ReagentId): string {
  const S = SP[sp];
  if ((r === 'naoh' || r === 'nh3') && S.ppt) return `The precipitate does not dissolve in excess ${r === 'naoh' ? 'sodium hydroxide' : 'ammonia'}.`;
  if (r === 'air') return 'Nothing changes on standing in air.';
  if (r === 'water') return 'Dilution only makes the colour a little paler.';
  if (r === 'zn') return 'No further reduction with zinc.';
  if (r === 'kmno4') return 'Nothing here reduces manganate(VII); the purple colour stays.';
  return 'No visible reaction.';
}
/** The transitions one addition causes: excess and zinc keep going (up to four steps). */
export function plan(sp: string, r: ReagentId, amt: Amount): Transition[] {
  const steps: Transition[] = []; let cur = sp; const max = amt === 'xs' || amt === 'chain' ? 4 : 1;
  for (let i = 0; i < max; i++) { const t = TM[cur + '|' + r]; if (!t) break; steps.push(t); cur = t.t; }
  return steps;
}

/* ---------- helpers ---------- */
export const liqOf = (S: Species) => S.liq || COLOURLESS;
export const laOf = (S: Species) => (S.liq ? S.la ?? 0.7 : 0.22);
/** number of d electrons */
export const dOf = (S: Species) => GROUP[S.m] - S.ox;
/** fill colours for a swatch / mini tube: --c (solution) and --p (precipitate) */
export const tubeVars = (S: Species, min = 0.25) => `--c:${rgba(liqOf(S), Math.max(laOf(S), min))};--p:${S.ppt || 'transparent'}`;
export function dNote(S: Species): string {
  const d = dOf(S);
  if (S.note) return S.note;
  if (d === 0) return S.liq ? 'd⁰: no d electrons, so the colour comes from charge transfer (oxygen to metal), not d–d transitions.' : 'd⁰: no d–d transitions, so colourless.';
  if (d === 10) return 'd¹⁰: full d sub-shell, so no d–d transitions. Colourless or white.';
  return 'Ligands split the d orbitals. Electrons absorb visible light to jump the gap; we see the complementary colour.';
}
/** How a species is made, for the atlas cards. HTML. */
export function howMade(id: string): string {
  if (SHELF.some((s) => s[0] === id)) return 'Stock solution';
  const t = T.find((t) => t.t === id); if (!t) return '';
  const word: Record<ReagentId, string> = { naoh: 'NaOH', nh3: 'NH₃', h2so4: 'acid', hcl: 'conc. HCl', water: 'water', zn: 'Zn / H⁺', h2o2: 'H₂O₂', kmno4: 'MnO₄⁻', ki: 'KI', kscn: 'SCN⁻', air: 'air' };
  const ex = (t.f.endsWith('OH2') || t.f.endsWith('OH3')) && (t.r === 'naoh' || t.r === 'nh3') ? 'excess ' : '';
  return `${ex}${word[t.r]} on ${chem(SP[t.f].f)}`;
}
/** The amount a reaction card uses when it is run on the bench. */
export const rxAmt = (t: Transition): Amount => (t.r === 'naoh' || t.r === 'nh3') ? (SP[t.f].ppt ? 'xs' : 'few') : t.r === 'zn' ? 'chain' : 'once';
export const rxReagent = (t: Transition) => ({ naoh: 'NaOH', nh3: 'NH3', h2so4: 'H^+', hcl: 'conc. HCl', water: 'H2O', zn: 'Zn / H^+', h2o2: 'H2O2', kmno4: 'MnO4^-/H^+', ki: 'KI', kscn: 'KSCN', air: 'O2 (air)' } as const)[t.r];
export const rxNote = (t: Transition) => { const a = rxAmt(t); return a === 'xs' ? 'excess' : a === 'few' ? 'few drops' : t.r === 'h2o2' && SP[t.f].m === 'Cr' ? 'warm' : ''; };

/* ---------- self-test options ---------- */
const LOOKS = unique(Object.values(SP).map((S) => S.look));
export const speciesForLook = (look: string) => Object.values(SP).find((x) => x.look === look);
/** Four looks: the answer, up to two from the same metal (sometimes the starting look), then similar ones (ppt vs solution). */
export function quizOptions(answer: string, metal: MetalId, startLook?: string): string[] {
  const same = shuffle(unique(Object.values(SP).filter((S) => S.m === metal).map((S) => S.look)).filter((l) => l !== answer));
  const picks: string[] = [];
  if (startLook && startLook !== answer && Math.random() < 0.5) picks.push(startLook);
  for (const l of same) { if (picks.length >= 2) break; if (!picks.includes(l)) picks.push(l); }
  const isPpt = /precipitate/i.test(answer);
  const near = shuffle(LOOKS.filter((l) => l !== answer && !picks.includes(l) && /precipitate/i.test(l) === isPpt));
  const rest = shuffle(LOOKS.filter((l) => l !== answer && !picks.includes(l) && !near.includes(l)));
  for (const l of [...near, ...rest]) { if (picks.length >= 3) break; picks.push(l); }
  return shuffle([answer, ...picks]);
}
/** Predict mode: four options for what you see after an addition (always includes 'No visible change' as a distractor). */
export function predictOptions(curId: string, final: string): string[] {
  const curS = SP[curId];
  let pool = unique(Object.values(SP).filter((S) => S.m === curS.m).map((S) => S.look)).filter((l) => l !== final && l !== curS.look);
  if (final !== 'No visible change') pool.push('No visible change');
  pool = shuffle(pool);
  const others = shuffle(LOOKS.filter((l) => l !== final && !pool.includes(l) && l !== curS.look));
  return shuffle([final, ...pool.slice(0, 3), ...others].slice(0, 4));
}

/* ---------- flowchart layouts: grid position of each species, and a one-line reading tip (HTML) ---------- */
export const FL: Record<MetalId, { pos: Record<string, [number, number]>; tip: string }> = {
  V: {pos:{V5:[0,0],V4:[1,0],V3:[2,0],V2:[3,0]},
      tip:'One straight ladder: zinc steps vanadium down one oxidation state at a time, <b>yellow → blue → green → violet</b> (+5 → +2).'},
  Cr: {pos:{Cr2:[0,0],Cr3:[0,1],CrOH3:[1,1],CrOH6:[2,1],CrNH3:[1,2],Cr2O7:[1,0],CrO4:[2,0]},
      tip:'A loop: Cr³⁺ → grey-green ppt → excess NaOH → dark green [Cr(OH)₆]³⁻ → H₂O₂ → <b>yellow</b> CrO₄²⁻ ⇌ <b>orange</b> Cr₂O₇²⁻ (acid/alkali, not redox) → Zn back to Cr³⁺ → Zn again to <b>blue</b> Cr²⁺.'},
  Mn: {pos:{Mn2:[0,0],MnOH2:[1,0],MnOOH:[2,0]},
      tip:'Pale pink → off-white ppt → <b>browns in air</b>. The colour change on standing is the giveaway for Mn.'},
  Fe: {pos:{Fe2:[0,0],FeOH2:[1,0],Fe3:[0,1],FeOH3:[1,1],FeSCN:[0,2],FeI2:[1,2]},
      tip:'Two parallel rows: the +2 row is <b>green</b> (solution and ppt), the +3 row is <b>orange-brown</b>. Vertical arrows are redox between them. Fe³⁺ has two tests: SCN⁻ gives blood-red, I⁻ gives brown iodine.'},
  Co: {pos:{CoCl4:[0,0],Co2:[1,0],CoOH2:[2,0],CoOH3:[3,0],CoNH3:[2,1],CoNH33:[3,1]},
      tip:'Pink in water, <b>blue</b> with Cl⁻ (tetrahedral) and blue as the hydroxide. Anything Co(II) left in air or H₂O₂ <b>darkens to brown</b> as it becomes Co(III).'},
  Ni: {pos:{Ni2:[0,0],NiOH2:[1,0],NiNH3:[2,0]},
      tip:'Green → green ppt → excess NH₃ → <b>blue-violet</b>. NaOH in excess does nothing.'},
  Cu: {pos:{CuCl4:[0,0],Cu2:[1,0],CuOH2:[2,0],CuNH3:[2,1],CuI:[1,1]},
      tip:'Blue everywhere until a ligand changes it: pale blue ppt → <b>deep blue</b> with excess NH₃, <b>yellow-green</b> with conc. HCl. I⁻ reduces it to white CuI in brown iodine.'},
  Zn: {pos:{Zn2:[0,0],ZnOH2:[1,0],ZnOH4:[2,0],ZnNH3:[1,1]},
      tip:'d¹⁰, so <b>everything is white or colourless</b>. The test is behaviour: the white ppt dissolves in excess of both NaOH and NH₃.'},
};
