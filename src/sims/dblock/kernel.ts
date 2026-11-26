/* Kernel's view of the bench: loose name matching (formulae, names, charges written as 2+ or ²⁺) against the lab's
   own data, and route finding (stock solution + the rack's additions) to a target species. Pure: no DOM, no UI state.
   App.svelte wraps these as Kernel's live tools. */

import { plain, ox } from '../../lib/chem';
import { SP, RG, SHELF, RACK, AMT, METAL, plan, type ReagentId, type Amount, type Species } from './data';

const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹', SUBS = '₀₁₂₃₄₅₆₇₈₉';
/** Lower-case, no spaces/carets/state symbols, Unicode super/subscripts and minus signs made plain. */
export function norm(s: string): string {
  return String(s).toLowerCase()
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => String(SUPS.indexOf(c))).replace(/[₀-₉]/g, (c) => String(SUBS.indexOf(c)))
    .replace(/⁺/g, '+').replace(/[⁻−–]/g, '-')
    .replace(/\((aq|s|l|g)\)/g, '').replace(/\b(the|an?|some|ions?|solution|complex)\b/g, '')
    .replace(/[\s^_'"`.,]/g, '');
}
/** Charges written sign-first (+2, -3) are turned round (2+, 3-) so they match the lab's notation. */
const flipCharge = (s: string) => s.replace(/([\])a-z])([+-])(\d)$/, '$1$3$2');
/** Drop water ligands and brackets: '[Cr(OH)3(H2O)3]' → 'cr(oh)3', '[Cu(H2O)6]^2+' → 'cu2+'. */
const bare = (n: string) => n.replace(/\(h2o\)\d*/g, '').replace(/[[\]]/g, '').replace(/^\((.*)\)$/, '$1');
const ROMAN = ['0', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];
const noRoman = (n: string) => n.replace(/\((0|i|ii|iii|iv|v|vi|vii)\)/g, '');

/* every name a species answers to: id, formula (with and without water ligands), name, metal(roman), bottle label */
const SP_KEYS: [string, string[]][] = Object.entries(SP).map(([id, S]) => {
  const f = norm(S.f), n = norm(S.n), keys = [norm(id), f, bare(f), n];
  const stock = SHELF.find((s) => s[0] === id);
  if (stock) keys.push(norm(stock[1]), norm(stock[2]), norm(stock[2]).replace(/,?inacid$/, ''));
  // the plain aqua / oxo ion answers to its metal and oxidation state: 'iron(II)', 'vanadium(V)'
  if (/^\[\w+\(h2o\)6\]/.test(f) || S.geo === 'oxo-cation') keys.push(norm(`${METAL[S.m]}(${ROMAN[S.ox]})`), norm(`${S.m}${S.ox}+`), norm(`${S.m}(${ROMAN[S.ox]})`));
  return [id, keys];
});

/** Charge kept apart from subscripts ('VO₂⁺' → 'vo2^+', 'VO^2+' → 'vo^2+'), to tell VO₂⁺ from VO²⁺ when written so. */
const explicit = (s: string) => String(s).toLowerCase().replace(/[₀-₉]/g, (c) => String(SUBS.indexOf(c)))
  .replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])/g, (_, d: string, c: string) => '^' + [...d].map((x) => SUPS.indexOf(x)).join('') + (c === '⁺' ? '+' : '-'))
  .replace(/[−–]/g, '-').replace(/\((aq|s|l|g)\)/g, '').replace(/\s/g, '');

function uniqueOr<T>(hits: T[], what: string, q: string, options: () => string): T {
  const u = [...new Set(hits)];
  if (u.length === 1) return u[0];
  if (u.length > 1) throw new Error(`"${q}" could mean more than one ${what}: ${u.join(', ')}. Be more specific. ${options()}`);
  throw new Error(`No ${what} in the lab matches "${q}". ${options()}`);
}

export const spLabel = (id: string) => `${plain(SP[id].f)} (${SP[id].n})`;
export const speciesList = () => 'Species in the lab: ' + Object.keys(SP).map(spLabel).join('; ') + '.';
export const stockList = () => 'Stock solutions: ' + SHELF.map(([, ion, nm]) => `${plain(ion)} = ${nm}`).join('; ') + '.';
export const reagentList = () => 'Reagents: ' + RACK.flatMap((g) => g.items).map((it) => `${it.r} (${RG[it.r].n}${it.amt === 'few' || it.amt === 'xs' ? ', ' + AMT[it.amt] : ''})`)
  .filter((x, i, a) => a.indexOf(x) === i).join('; ') + '.';

/** A species from a loose name: exact key first, then without oxidation numerals, then a unique prefix/substring of a name. */
export function matchSpecies(q: string, among?: (id: string) => boolean): string {
  const KEYS = among ? SP_KEYS.filter(([id]) => among(id)) : SP_KEYS;
  const k = flipCharge(norm(q)); if (!k) throw new Error('Name a species. ' + speciesList());
  for (const key of [k, bare(k)]) {
    let hits = KEYS.filter(([, ks]) => ks.includes(key)).map(([id]) => id);
    if (hits.length > 1) { const x = explicit(q), ex = hits.filter((id) => [explicit(SP[id].f), explicit(SP[id].f).replace(/\(h2o\)\d*|[[\]]/g, '')].includes(x)); if (ex.length) hits = ex; }
    if (hits.length) return uniqueOr(hits, 'species', q, speciesList);
  }
  const nr = noRoman(k);
  let hits = KEYS.filter(([, ks]) => ks.some((x) => noRoman(x) === nr)).map(([id]) => id);
  if (!hits.length && k.length >= 4) hits = KEYS.filter(([id]) => norm(SP[id].n).startsWith(k) || noRoman(norm(SP[id].n)).startsWith(nr)).map(([id]) => id);
  if (!hits.length && k.length >= 5) hits = KEYS.filter(([id]) => norm(SP[id].n).includes(k)).map(([id]) => id);
  return uniqueOr(hits, 'species', q, speciesList);
}

/** A stock solution on the shelf (by ion, salt name or species). Ambiguous names ('VO2+') are settled by the shelf. */
const onShelf = (id: string) => SHELF.some((s) => s[0] === id);
const SALT: Record<string, string> = { nh4vo3: 'V5', 'cr2(so4)3': 'Cr3', k2cr2o7: 'Cr2O7', mnso4: 'Mn2', feso4: 'Fe2', fecl3: 'Fe3', cocl2: 'Co2', niso4: 'Ni2', cuso4: 'Cu2', znso4: 'Zn2' };
export function matchStock(q: string): string {
  let id: string;
  try { id = matchSpecies(q); }
  catch (e) {
    try { return matchSpecies(q, onShelf); } catch { /* fall through to the bottle labels */ }
    // 'copper sulfate', 'iron chloride': the bottle labels without the oxidation state
    const k = noRoman(norm(q));
    if (SALT[k]) return SALT[k];
    const hits = SHELF.filter((s) => noRoman(norm(s[2])).startsWith(k) || (k.length >= 5 && noRoman(norm(s[2])).includes(k)) || k.startsWith(noRoman(norm(s[2])).replace(/,?inacid$/, ''))).map((s) => s[0]);
    if (hits.length === 1) return hits[0];
    throw new Error((e as Error).message.replace(/Species in the lab:.*$/, '') + stockList());
  }
  if (!onShelf(id)) throw new Error(`${spLabel(id)} is not a stock solution on the shelf; use dblock_make to make it. ${stockList()}`);
  return id;
}

const RG_ALIAS: Record<ReagentId, string[]> = {
  naoh: ['naoh', 'sodiumhydroxide', 'hydroxide', 'oh-', 'alkali', 'sodiumhydroxidesolution'],
  nh3: ['nh3', 'ammonia', 'aqueousammonia', 'ammoniasolution', 'nh4oh', 'ammoniumhydroxide'],
  h2so4: ['h2so4', 'sulfuricacid', 'sulphuricacid', 'dilutesulfuricacid', 'dilutesulphuricacid', 'acid', 'diluteacid', 'h+', 'h3o+'],
  hcl: ['hcl', 'hydrochloricacid', 'conchcl', 'concentratedhcl', 'concentratedhydrochloricacid', 'conchydrochloricacid', 'chloride', 'chlorideions', 'cl-'],
  water: ['water', 'h2o', 'distilledwater', 'dilute', 'dilutewithwater', 'dilution'],
  zn: ['zn', 'zinc', 'zinc+acid', 'zincandacid', 'zincgranules', 'zn/h+', 'zincinacid', 'zincgranulesinacid'],
  h2o2: ['h2o2', 'hydrogenperoxide', 'peroxide'],
  kmno4: ['kmno4', 'mno4-', 'mno4-/h+', 'manganate', 'manganate(vii)', 'potassiummanganate(vii)', 'permanganate', 'potassiumpermanganate', 'acidifiedpotassiummanganate(vii)', 'acidifiedmanganate(vii)'],
  ki: ['ki', 'potassiumiodide', 'iodide', 'i-'],
  kscn: ['kscn', 'potassiumthiocyanate', 'thiocyanate', 'scn-'],
  air: ['air', 'o2', 'oxygen', 'stand', 'leavetostand', 'shake', 'shakeandleavetostand', 'o2(air)'],
};
export function matchReagent(q: string): ReagentId {
  const k = norm(q).replace(/^(conc|concentrated|dilute|aqueous)(?=(hcl|hydrochloric))/, 'conc');
  const ids = Object.keys(RG) as ReagentId[];
  let hits = ids.filter((r) => r === k || RG_ALIAS[r].includes(k) || norm(RG[r].f) === k || norm(RG[r].n) === k);
  if (!hits.length && k.length >= 4) hits = ids.filter((r) => RG_ALIAS[r].some((a) => a.length >= 4 && (a.startsWith(k) || k.startsWith(a))) || norm(RG[r].n).includes(k));
  return uniqueOr(hits, 'reagent', q, reagentList);
}

/** The amount the rack offers for this reagent: alkalis come as a few drops or in excess; the rest have one button. */
export function matchAmount(r: ReagentId, q?: unknown): Amount {
  const items = RACK.flatMap((g) => g.items).filter((it) => it.r === r);
  if (items.length === 1) return items[0].amt;
  const k = norm(String(q ?? ''));
  if (!k || /^(few|afewdrops|fewdrops|drops?|dropwise|little|alittle|some|small|once|1|one|drop|adrop)$/.test(k) || /drop|few|little/.test(k)) return 'few';
  if (/^(xs|excess|inexcess|lots|alot|more|large|largeexcess|plenty)$/.test(k) || /excess/.test(k)) return 'xs';
  throw new Error(`Amount "${q}" not understood for ${RG[r].n}: use "few" (a few drops / dropwise) or "excess".`);
}

/* ---------- route finding ---------- */
export interface Move { r: ReagentId; amt: Amount }
export interface Route { start: string; moves: Move[]; passes?: boolean }
const MOVES: Move[] = RACK.flatMap((g) => g.items.map(({ r, amt }) => ({ r, amt })));

/** Shortest list of rack additions from one species to another. If the target only ever appears part-way through
    one addition (zinc reduces vanadium straight past VO²⁺), the route ends with that addition and passes = true. */
export function routeFrom(from: string, target: string): Route | null {
  if (from === target) return { start: from, moves: [] };
  const prev = new Map<string, { at: string; m: Move }>([[from, { at: '', m: MOVES[0] }]]);
  const q = [from]; let passing: Route | null = null;
  const back = (sp: string): Move[] => { const ms: Move[] = []; for (let c = sp; c !== from; c = prev.get(c)!.at) ms.unshift(prev.get(c)!.m); return ms; };
  while (q.length) {
    const at = q.shift()!;
    for (const m of MOVES) {
      const steps = plan(at, m.r, m.amt); if (!steps.length) continue;
      const end = steps[steps.length - 1].t;
      if (!passing && steps.slice(0, -1).some((t) => t.t === target)) passing = { start: from, moves: [...back(at), m], passes: true };
      if (prev.has(end)) continue;
      prev.set(end, { at, m });
      if (end === target) return { start: from, moves: back(end) };
      q.push(end);
    }
  }
  return passing;
}

/** Best route to a target: from what is in the tube now if that is no longer than starting fresh, else from the
    stock solution with the shortest route. */
export function findRoute(target: string, current?: string): Route | null {
  const len = (r: Route | null) => (r ? r.moves.length + (r.passes ? 0.5 : 0) : Infinity);
  let best: Route | null = null;
  for (const [id] of SHELF) { const r = routeFrom(id, target); if (len(r) < len(best)) best = r; }
  if (current) { const r = routeFrom(current, target); if (r && (!best || len(r) <= len(best))) return r; }
  return best;
}

/** What can be made at all (for the "not possible" message). */
export function makeable(): string[] { return Object.keys(SP).filter((id) => findRoute(id)); }

/* ---------- text for the AI ---------- */
export const moveText = (m: Move) => `${RG[m.r].n}${AMT[m.amt] ? ' (' + AMT[m.amt] + ')' : ''}`;
export function speciesText(S: Species): string {
  return `${plain(S.f)}, ${S.n}: ${S.look}; ${METAL[S.m]} ${ox(S.ox)}${S.geo ? '; ' + S.geo : ''}`;
}
/** Every species reachable in one addition from this one, for "what can I try next". */
export function nextFrom(sp: string): string[] {
  return MOVES.flatMap((m) => { const s = plan(sp, m.r, m.amt); return s.length ? [`${moveText(m)} → ${SP[s[s.length - 1].t].look} (${plain(SP[s[s.length - 1].t].f)})`] : []; });
}
