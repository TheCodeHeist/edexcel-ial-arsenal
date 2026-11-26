/* Kernel's hands on the Circuit Builder: the pure part (no Svelte, no DOM), so it can be tested on its own.
   App.svelte wraps these in Kernel's live tools and hands the results to the editor, so every change lands on the
   board, in Undo, exactly as if the student had made it.

   Building: an AI is bad at grid coordinates and at matching up terminal pairs, but good at the way a physics
   teacher describes a circuit: "a cell, an ammeter, then R1 and R2 in parallel". So a circuit is a loop written as a
   short expression, "E1 - A1 - (R1 | R2)": items in series round the loop, parallel branches in brackets separated
   by |, nested as deep as needed. A voltmeter can be given `across` a part instead, which is just one more parallel
   branch. The expression is a series–parallel tree, and that lays out the way people draw circuits: the supply on
   the bottom edge, the rest along the top, branches stacked under each other. Every layout is checked against the
   tree with the solver's own netlist before it is used, so a wire can never touch a terminal it shouldn't.

   Editing: small changes happen in place (settings, add a part across or in series with another, remove one,
   join two terminals with a wire), looking for a clean spot on the board and refusing rather than making a mess. */

import { KINDS, LAMPS, LEDS, terminals, key, same, onSeg, thermR, ldrR, type CircuitData, type Kind, type Part, type Pt, type Props, type Rot, type Wire } from './parts';
import { BW, BH, nextId, nextName, cutUnder, tidy, wirePath } from './editor.svelte';
import { solve, type Solution } from './solve';
import { si, ohms, num, meter } from './format';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/* ---------- values ---------- */

/** Which setting `value` means for each kind (the rest have no single value). */
export const VALUE_KEY: Partial<Record<Kind, keyof Props>> = { cell: 'emf', ac: 'emf', resistor: 'R', varres: 'R', pot: 'R', thermistor: 'T', ldr: 'lux', capacitor: 'C' };
const UNIT: Partial<Record<keyof Props, string>> = { emf: 'V', r: 'Ω', R: 'Ω', T: '°C', lux: 'lx', C: 'F', freq: 'Hz' };
const PREFIX: Record<string, number> = { p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, μ: 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6 };

/** A number, or a string the way people write one: "2.2k", "470 µF", "10 ohms", "6V", "0.5". */
export function parseNum(x: unknown, what: string): number {
  if (typeof x === 'number' && isFinite(x)) return x;
  if (typeof x === 'string') {
    const m = x.trim().match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)\s*([pnuµμmkKM]?)\s*(ohms?|Ω|Ω|v|volts?|a|amps?|f|farads?|hz|lx|lux|°?c)?$/i);
    if (m) {
      // "m" is milli and "M" mega, but a bare "M" before "Ω" or "ohm" also reads as mega; "MF" is never meant
      let f = m[2] ? PREFIX[m[2]] : 1;
      if (m[2] === 'M' && /^f/i.test(m[3] ?? '')) f = 1e-6;
      return Number(m[1]) * f;
    }
  }
  throw new Error(`${what} should be a number in SI units (e.g. 2200, or "2.2k"); got ${JSON.stringify(x)}.`);
}

/** Settings a tool may give a part, as the AI sends them. */
export interface Settings {
  value?: unknown; internal_resistance?: unknown; frequency?: unknown; wiper?: unknown;
  closed?: unknown; position?: unknown; rating?: unknown; colour?: unknown;
}
const SETTING_KEYS = ['value', 'internal_resistance', 'frequency', 'wiper', 'closed', 'position', 'rating', 'colour'] as const;

function inRange(kind: Kind, k: keyof Props, v: number): number {
  const c = KINDS[kind].controls.find((x) => x.key === k);
  if (c && c.min !== undefined && c.max !== undefined && (v < c.min - 1e-12 || v > c.max + 1e-12)) {
    const u = UNIT[k] ?? '';
    const f = (x: number) => (k === 'C' ? si(x, 'F') : num(x) + (u ? ' ' + u : ''));
    throw new Error(`a ${KINDS[kind].label.replace('­', '').toLowerCase()}'s ${c.label.toLowerCase()} must be from ${f(c.min)} to ${f(c.max)} in this lab (got ${f(v)}).`);
  }
  return v;
}

/** The Props a set of settings means for this kind; complains about settings the kind doesn't have. */
export function settingsToProps(kind: Kind, s: Settings, name: string): Props {
  const out: Props = {}, label = KINDS[kind].label.replace('­', '').toLowerCase();
  const no = (field: string, hint = '') => new Error(`${name} is a ${label}, which has no ${field}.${hint}`);
  if (s.value !== undefined && s.value !== null) {
    const k = VALUE_KEY[kind];
    if (!k) throw no('value', kind === 'lamp' ? ' Give its rating instead: "2.5V", "6V" or "12V".' : kind === 'led' ? ' Give its colour instead.' : kind === 'switch' ? ' Use closed: true or false.' : kind === 'switch2' ? ' Use position: "A" or "B".' : ' Leave value out.');
    out[k] = inRange(kind, k, parseNum(s.value, `${name}'s value`)) as never;
  }
  if (s.internal_resistance !== undefined && s.internal_resistance !== null) {
    if (kind !== 'cell') throw no('internal resistance', ' Only a cell has one.');
    out.r = inRange(kind, 'r', parseNum(s.internal_resistance, `${name}'s internal resistance`));
  }
  if (s.frequency !== undefined && s.frequency !== null) {
    if (kind !== 'ac') throw no('frequency', ' Only an a.c. supply has one.');
    out.freq = inRange(kind, 'freq', parseNum(s.frequency, `${name}'s frequency`));
  }
  if (s.wiper !== undefined && s.wiper !== null) {
    if (kind !== 'pot') throw no('slider', ' Only a potentiometer has one.');
    const raw = typeof s.wiper === 'string' && s.wiper.trim().endsWith('%') ? parseNum(s.wiper.trim().slice(0, -1), 'wiper') / 100 : parseNum(s.wiper, 'wiper');
    if (raw < 0 || raw > 1) throw new Error(`wiper is the slider position as a fraction from 0 to 1 (or "50%"); got ${raw}.`);
    out.wiper = raw;
  }
  if (s.closed !== undefined && s.closed !== null) {
    if (kind !== 'switch') throw no('open/closed setting', kind === 'switch2' ? ' A two-way switch takes position: "A" or "B".' : '');
    out.on = s.closed === true || s.closed === 'true';
  }
  if (s.position !== undefined && s.position !== null) {
    if (kind !== 'switch2') throw no('position', kind === 'switch' ? ' A switch takes closed: true or false.' : '');
    const p = String(s.position).toUpperCase();
    if (p !== 'A' && p !== 'B') throw new Error(`position must be "A" or "B"; got ${JSON.stringify(s.position)}.`);
    out.on = p === 'A';
  }
  if (s.rating !== undefined && s.rating !== null) {
    if (kind !== 'lamp') throw no('rating');
    const r = String(s.rating).replace(/\s+/g, '').toUpperCase().replace(/V.*$/, 'V');
    if (!(r in LAMPS)) throw new Error(`a lamp's rating must be one of ${Object.keys(LAMPS).join(', ')}; got ${JSON.stringify(s.rating)}.`);
    out.rating = r as Props['rating'];
  }
  if (s.colour !== undefined && s.colour !== null) {
    if (kind !== 'led') throw no('colour');
    const c = String(s.colour).toLowerCase();
    if (!(c in LEDS)) throw new Error(`an LED's colour must be one of ${Object.keys(LEDS).join(', ')}; got ${JSON.stringify(s.colour)}.`);
    out.colour = c as Props['colour'];
  }
  return out;
}
export const hasSettings = (s: Settings) => SETTING_KEYS.some((k) => s[k] !== undefined && s[k] !== null);

/* ---------- names and lookups ---------- */

const NAME = /^[A-Za-z][A-Za-z0-9]{0,5}$/;
const ALIAS: Record<string, Kind> = {
  battery: 'cell', supply: 'cell', 'dc supply': 'cell', 'a.c. supply': 'ac', 'ac supply': 'ac', bulb: 'lamp', 'filament lamp': 'lamp',
  'variable resistor': 'varres', rheostat: 'varres', potentiometer: 'pot', 'two-way switch': 'switch2', ntc: 'thermistor',
};
/** The lab's kind for a type the AI wrote, forgiving everyday names ("battery", "bulb", "rheostat"). */
export function toKind(t: unknown, who = 'type'): Kind {
  const s = String(t ?? '').trim().toLowerCase();
  if (s in KINDS) return s as Kind;
  if (s in ALIAS) return ALIAS[s];
  throw new Error(`${who}: ${JSON.stringify(t)} is not a part this lab has. Types: ${Object.keys(KINDS).join(', ')}.`);
}
export const kindLabel = (k: Kind) => KINDS[k].label.replace('­', '');

export function findPart(c: CircuitData, name: unknown): Part {
  const n = String(name ?? '').trim().replace(/\..*$/, '');
  const p = c.parts.find((q) => q.name === n) ?? c.parts.find((q) => q.name.toLowerCase() === n.toLowerCase()) ?? c.parts.find((q) => q.id === n);
  if (!p) throw new Error(`there is no part called ${JSON.stringify(n)} on the board. Parts now: ${c.parts.map((q) => q.name).join(', ') || 'none'}.`);
  return p;
}

/** What each terminal is called: "1", "2" (and "3"), with the names that matter for the polarised parts. */
export function termNames(k: Kind): string[] {
  switch (k) {
    case 'cell': case 'ac': return ['+', '−'];
    case 'diode': case 'led': return ['anode', 'cathode'];
    case 'switch2': return ['common', 'A', 'B'];
    case 'pot': return ['end', 'end', 'wiper'];
    default: return KINDS[k].terms.map(() => '');
  }
}

export const terminalAt = (p: Part, t: number): Pt => terminals(p)[t];

/** "R1.2", "E1.+", "E1.-", "S1.A", "P1.wiper" → the part and the terminal index. */
export function findTerminal(c: CircuitData, ref: unknown): { part: Part; t: number } {
  const s = String(ref ?? '').trim(), dot = s.lastIndexOf('.');
  if (dot < 0) throw new Error(`a terminal is written PART.N, e.g. "R1.1" or "E1.+"; got ${JSON.stringify(s)}.`);
  const part = findPart(c, s.slice(0, dot)), t = s.slice(dot + 1).toLowerCase().replace('−', '-');
  const names = termNames(part.kind).map((x) => x.toLowerCase().replace('−', '-'));
  let i = /^\d$/.test(t) ? Number(t) - 1 : names.indexOf(t);
  if (part.kind === 'pot' && t === 'end') i = -1;
  if (i < 0 || i >= KINDS[part.kind].terms.length)
    throw new Error(`${part.name} has terminals ${KINDS[part.kind].terms.map((_, j) => `${part.name}.${j + 1}${names[j] ? ` (${termNames(part.kind)[j]})` : ''}`).join(', ')}; got ${JSON.stringify(s)}.`);
  return { part, t: i };
}

/* ---------- the loop expression ---------- */

/* A bridge is the one common shape that is not series–parallel (full-wave rectifier, Wheatstone bridge): from its
   entry IN to its exit OUT run two paths, IN–a1–P–a2–OUT on top and IN–b1–Q–b2–OUT below, and `mid` joins P to Q. */
export type Node = { t: 'part'; name: string } | { t: 'ser'; items: Node[] } | { t: 'par'; branches: Node[] }
  | { t: 'bridge'; arms: [Ser, Ser, Ser, Ser]; mid: Ser };
type Ser = { t: 'ser'; items: Node[] };
type Par = Extract<Node, { t: 'par' }>;
type Bridge = Extract<Node, { t: 'bridge' }>;

/** "E1 - A1 - (R1 | R2 - L1)" → a series node. Separators between series items: spaces, "-", "," or "→". */
export function parseLoop(src: string): Ser {
  const toks: string[] = [];
  const re = /\s*(?:([A-Za-z][A-Za-z0-9_]*)|([()|;])|([-,–—→>]+))\s*/y;
  let at = 0;
  while (at < src.length) {
    re.lastIndex = at;
    const m = re.exec(src);
    if (!m || m[0] === '') throw new Error(`the loop expression has something unexpected at ${JSON.stringify(src.slice(at, at + 12))}. Use part names, "-" between series parts, "(A | B)" for parallel branches and bridge(a1; a2; b1; b2; mid) for a bridge.`);
    if (m[1] || m[2]) toks.push(m[1] ?? m[2]);
    at = re.lastIndex;
  }
  let i = 0;
  const group = (): Ser => { // a series run, or branches in parallel (inside a bridge's brackets, "R1 | C1" needs none)
    const branches = [series()];
    while (toks[i] === '|') { i++; branches.push(series()); }
    return branches.length === 1 ? branches[0] : { t: 'ser', items: [{ t: 'par', branches }] };
  };
  const series = (): Ser => {
    const items: Node[] = [];
    while (i < toks.length && toks[i] !== ')' && toks[i] !== '|' && toks[i] !== ';') {
      if (/^bridge$/i.test(toks[i]) && toks[i + 1] === '(') {
        i += 2;
        const args = [group()];
        while (toks[i] === ';') { i++; args.push(group()); }
        if (toks[i] !== ')') throw new Error('bridge( … ) is never closed.');
        i++;
        if (args.length !== 5) throw new Error(`bridge takes 5 parts separated by ";": bridge(a1; a2; b1; b2; mid), the top path a1 then a2, the bottom path b1 then b2, and mid joining the two middle points. Got ${args.length}.`);
        items.push({ t: 'bridge', arms: [args[0], args[1], args[2], args[3]], mid: args[4] });
      } else if (toks[i] === '(') {
        i++;
        const branches = [series()];
        while (toks[i] === '|') { i++; branches.push(series()); }
        if (toks[i] !== ')') throw new Error('a bracket in the loop expression is never closed.');
        i++;
        if (branches.length === 1) items.push(...branches[0].items); // plain brackets: just a series group
        else items.push({ t: 'par', branches });
      } else items.push({ t: 'part', name: toks[i++] });
    }
    if (!items.length) throw new Error('the loop expression has an empty branch or group, like "( | R1)" or "()". Every branch needs at least one part.');
    return { t: 'ser', items };
  };
  const root = series();
  if (i < toks.length) throw new Error(toks[i] === '|'
    ? 'parallel branches must be inside brackets: write "E1 - (R1 | R2)", not "E1 - R1 | R2".'
    : toks[i] === ';' ? '";" only separates the five parts of bridge(a1; a2; b1; b2; mid).'
    : 'the loop expression has a ")" with no "(" to match.');
  return root;
}

const names = (n: Node): string[] => n.t === 'part' ? [n.name] : n.t === 'ser' ? n.items.flatMap(names)
  : n.t === 'par' ? n.branches.flatMap(names) : [...n.arms, n.mid].flatMap(names);

/** Put voltmeter (or any part) `v` across the run of series parts `targets`: one more parallel branch. */
export function addAcross(root: Ser, v: string, targets: string[]): void {
  const want = new Set(targets.map((t) => t.toLowerCase()));
  const visit = (s: Ser, parent: Par | null): boolean => {
    const idx = s.items.map((n, k) => (n.t === 'part' && want.has(n.name.toLowerCase()) ? k : -1)).filter((k) => k >= 0);
    if (idx.length === want.size) {
      const i = Math.min(...idx), j = Math.max(...idx);
      if (j - i + 1 !== idx.length) throw new Error(`${v} is across ${targets.join(', ')}, but they are not next to each other in the loop. Put ${v} in the loop expression as a parallel branch instead, e.g. "(R1 - R2 | ${v})".`);
      const branch: Ser = { t: 'ser', items: [{ t: 'part', name: v }] };
      if (parent && i === 0 && j === s.items.length - 1) parent.branches.push(branch); // across a whole branch = across the group
      else s.items.splice(i, j - i + 1, { t: 'par', branches: [{ t: 'ser', items: s.items.slice(i, j + 1) }, branch] });
      return true;
    }
    for (const n of s.items) {
      if (n.t === 'par') { for (const b of n.branches) if (visit(b as Ser, n)) return true; }
      else if (n.t === 'bridge') { for (const b of [...n.arms, n.mid]) if (visit(b, null)) return true; }
    }
    return false;
  };
  if (!visit(root, null)) throw new Error(`${v} is across ${targets.join(', ')}, but ${targets.length > 1 ? 'they are not all in one series run' : 'that is not in the loop'}. Across a parallel group, add ${v} as one more branch: "(R1 | R2 | ${v})".`);
}

/* ---------- layout ---------- */

interface Placed { name: string; x: number; y: number; rot: Rot }
interface Blk { w: number; h: number; parts: Placed[]; wires: [Pt, Pt][] }

/** Lay a node out from its entry (0, 0) to its exit (w, 0), growing downwards to y = h. */
function lay(n: Node, flip: (name: string) => boolean, sgap: number, vgap: number): Blk {
  if (n.t === 'bridge') return layBridge(n, flip, sgap, vgap);
  if (n.t === 'part') return { w: 2, h: 0, parts: [{ name: n.name, x: 1, y: 0, rot: flip(n.name) ? 2 : 0 }], wires: [] };
  const out: Blk = { w: 0, h: 0, parts: [], wires: [] };
  const put = (b: Blk, dx: number, dy: number) => {
    out.parts.push(...b.parts.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })));
    out.wires.push(...b.wires.map(([a, c]) => [[a[0] + dx, a[1] + dy], [c[0] + dx, c[1] + dy]] as [Pt, Pt]));
  };
  if (n.t === 'ser') {
    let x = 0;
    n.items.forEach((it, k) => {
      if (k && sgap) { out.wires.push([[x, 0], [x + sgap, 0]]); x += sgap; }
      const b = lay(it, flip, sgap, vgap);
      put(b, x, 0); x += b.w; out.h = Math.max(out.h, b.h);
    });
    out.w = x;
    return out;
  }
  const bs = n.branches.map((b) => lay(b, flip, sgap, vgap)), m = Math.max(...bs.map((b) => b.w)), W = m + 2;
  let y = 0, last = 0;
  bs.forEach((b) => {
    const o = 1 + Math.floor((m - b.w) / 2);
    put(b, o, y);
    out.wires.push([[0, y], [o, y]], [[o + b.w, y], [W, y]]);
    last = y; out.h = y + b.h; y += b.h + vgap;
  });
  out.wires.push([[0, 0], [0, last]], [[W, 0], [W, last]]);
  out.w = W;
  return out;
}

/** A bridge drawn as a box: the top path along y = 0, the bottom path along y = Y, the side rails at x = 0 and x = W,
    and `mid` hanging down from P to Q (its parallel branches step out to the left). */
function layBridge(n: Bridge, flip: (name: string) => boolean, sgap: number, vgap: number): Blk {
  const out: Blk = { w: 0, h: 0, parts: [], wires: [] };
  const put = (b: Blk, f: (p: Pt) => Pt, turn = 0) => {
    out.parts.push(...b.parts.map((p) => { const [x, y] = f([p.x, p.y]); return { ...p, x, y, rot: ((p.rot + turn) % 4) as Rot }; }));
    out.wires.push(...b.wires.map(([a, c]) => [f(a), f(c)] as [Pt, Pt]));
  };
  const seg = (a: Pt, b: Pt) => { if (a[0] !== b[0] || a[1] !== b[1]) out.wires.push([a, b]); };
  const [a1, a2, b1, b2] = n.arms.map((a) => lay(a, flip, sgap, vgap)), m = lay(n.mid, flip, sgap, vgap);
  const px = 2 + Math.max(a1.w, b1.w) + m.h;              // P and Q: clear of the left arms and of mid's branches
  const Y = Math.max(m.w + 2, Math.max(a1.h, a2.h) + vgap, 3);
  const W = px + 2 + Math.max(a2.w, b2.w);
  for (const [l, r, y] of [[a1, a2, 0], [b1, b2, Y]] as [Blk, Blk, number][]) {
    put(l, ([x, yy]) => [x + 1, yy + y]); put(r, ([x, yy]) => [x + px + 1, yy + y]);
    seg([0, y], [1, y]); seg([1 + l.w, y], [px, y]); seg([px, y], [px + 1, y]); seg([px + 1 + r.w, y], [W, y]);
  }
  seg([0, 0], [0, Y]); seg([W, 0], [W, Y]);
  // mid runs from P (px, 0) down to Q (px, Y): its block turned a quarter, so its +x is down and its +y is left
  const down = ([x, y]: Pt): Pt => [px - y, x];
  put(m, ([x, y]) => down([x + 1, y]), 1);
  seg(down([0, 0]), down([1, 0])); seg(down([1 + m.w, 0]), down([Y, 0]));
  out.w = W; out.h = Y + Math.max(b1.h, b2.h);
  return out;
}

const isSource = (k: Kind) => k === 'cell' || k === 'ac';

/** A component as circuit_build receives it. */
export interface CompSpec extends Settings { id: string; type: Kind; reverse?: boolean; across?: string | string[] }

/** Kinds a built loop may use: every two-terminal part (the potentiometer and two-way switch need an example). */
export const BUILD_KINDS: Kind[] = ['cell', 'ac', 'resistor', 'varres', 'lamp', 'diode', 'led', 'thermistor', 'ldr', 'switch', 'ammeter', 'voltmeter', 'capacitor'];

/** Components + loop expression → a laid-out board. Throws an Error that says how to fix the call. */
export function buildCircuit(comps: CompSpec[], loop: string): CircuitData {
  if (!Array.isArray(comps) || !comps.length) throw new Error('components must be a non-empty list like [{"id":"E1","type":"cell","value":6}, …].');
  const byName = new Map<string, CompSpec>();
  for (const c of comps) {
    if (!c || typeof c !== 'object') throw new Error('each component must be an object with id and type.');
    c.type = toKind(c.type, String(c.id));
    if (!NAME.test(String(c.id ?? ''))) throw new Error(`component id ${JSON.stringify(c.id)} must be a short name: a letter then up to 5 letters or digits, e.g. R1, E1, A2, LDR1.`);
    if (!BUILD_KINDS.includes(c.type)) throw new Error(`${c.id}: type ${JSON.stringify(c.type)} is not one the builder can place. Use one of: ${BUILD_KINDS.join(', ')}.${c.type === 'pot' || c.type === 'switch2' ? ' For a potentiometer or two-way switch circuit, load an example with circuit_example (lamp dimmer "pot", capacitor rig "rc").' : ''}`);
    if (byName.has(c.id.toLowerCase())) throw new Error(`two components are called ${c.id}; ids must be different.`);
    byName.set(c.id.toLowerCase(), c);
  }
  const root = parseLoop(String(loop ?? ''));
  for (const n of names(root)) if (!byName.has(n.toLowerCase())) throw new Error(`the loop uses ${n}, which is not in components. Components: ${comps.map((c) => c.id).join(', ')}.`);
  for (const c of comps) {
    if (c.across === undefined || c.across === null || c.across === '') continue;
    const t = (Array.isArray(c.across) ? c.across : [c.across]).map(String);
    for (const x of t) if (!byName.has(x.toLowerCase())) throw new Error(`${c.id} is across ${x}, which is not in components.`);
    addAcross(root, c.id, t);
  }
  const used = names(root).map((n) => n.toLowerCase());
  for (const c of comps) {
    const k = used.filter((n) => n === c.id.toLowerCase()).length;
    if (k === 0) throw new Error(`${c.id} is not in the loop and has no "across". Put it in the loop expression${c.type === 'voltmeter' ? ', or give it across: the part it measures' : ''}.`);
    if (k > 1) throw new Error(`${c.id} appears ${k} times; each part goes in the circuit once.`);
  }
  const props = new Map(comps.map((c) => [c.id.toLowerCase(), { ...clone(KINDS[c.type].defaults), ...settingsToProps(c.type, c, c.id) }]));
  const spec = (n: string) => byName.get(n.toLowerCase())!;
  // a cell is laid so the walk round the loop goes from − to + through it; diodes point along the walk
  const flip = (n: string) => isSource(spec(n).type) !== !!spec(n).reverse;

  const items = root.items, N = items.length;
  const s = items.findIndex((it) => names(it).some((n) => isSource(spec(n).type)));
  const meterTop = (top: Node[]) => top.some((it) => it.t === 'part' && /meter/.test(spec(it.name).type));
  let best: { score: number; top: Node[]; bot: Node[]; bt: Blk; bb: Blk; sg: number; vg: number } | null = null;
  for (const [sg, vg] of [[1, 3], [0, 3], [1, 2], [0, 2]]) {
    // the bottom edge is a run of the loop that holds the supply (no supply: the bottom edge is a plain wire)
    const cands: [number, number][] = s < 0 ? [[0, 0]] : [];
    if (s >= 0) for (let len = 1; len <= N; len++) for (let off = 0; off < len; off++) cands.push([(s - off + N) % N, len]);
    for (const [i, len] of cands) {
      if (len === N && N > 1) continue;
      const bot = Array.from({ length: len }, (_, k) => items[(i + k) % N]);
      const top = Array.from({ length: N - len }, (_, k) => items[(i + len + k) % N]);
      const bt = lay({ t: 'ser', items: top }, flip, sg, vg), bb = lay({ t: 'ser', items: bot }, flip, sg, vg);
      const wmax = Math.max(bt.w, bb.w), ytMin = meterTop(top) ? 2 : 1;
      if (wmax + 2 > BW - 2 || bt.h + bb.h + vg > BH - 1 - ytMin) continue;
      const score = wmax + 3 * (len - 1) + (bt.h + bb.h) / 10;
      if (!best || score < best.score) best = { score, top, bot, bt, bb, sg, vg };
    }
    if (best) break;
  }
  if (!best) throw new Error('that circuit is too big for the 20 × 12 board. Use fewer parts (about 8 in a row at most, and up to 3 parallel branches).');

  const { top, bt, bb, vg } = best;
  const wmax = Math.max(bt.w, bb.w), ytMin = meterTop(top) ? 2 : 1;
  const Wr = Math.min(BW - 2, Math.max(wmax + 4, 10)), L = Math.floor((BW - Wr) / 2), R = L + Wr;
  const Hr = Math.max(bt.h + bb.h + vg, Math.min(7, BH - 1 - ytMin));
  const yt = Math.min(Math.max(ytMin, Math.ceil((BH - Hr) / 2)), BH - 1 - Hr), yb = yt + Hr;
  const xt = L + Math.floor((Wr - bt.w) / 2), xb = L + Math.floor((Wr - bb.w) / 2);

  const placed: Placed[] = [], segs: [Pt, Pt][] = [];
  for (const p of bt.parts) placed.push({ ...p, x: p.x + xt, y: p.y + yt });
  for (const [a, b] of bt.wires) segs.push([[a[0] + xt, a[1] + yt], [b[0] + xt, b[1] + yt]]);
  // the bottom edge is walked right to left: mirror its block in x (and in y, so its branches grow up into the loop)
  for (const p of bb.parts) placed.push({ ...p, x: xb + bb.w - p.x, y: yb - p.y, rot: ((p.rot + 2) % 4) as Rot });
  for (const [a, b] of bb.wires) segs.push([[xb + bb.w - a[0], yb - a[1]], [xb + bb.w - b[0], yb - b[1]]]);
  segs.push([[L, yt], [L, yb]], [[R, yt], [R, yb]]);
  if (top.length) segs.push([[L, yt], [xt, yt]], [[xt + bt.w, yt], [R, yt]]); else segs.push([[L, yt], [R, yt]]);
  if (best.bot.length) segs.push([[R, yb], [xb + bb.w, yb]], [[xb, yb], [L, yb]]); else segs.push([[R, yb], [L, yb]]);

  const c: CircuitData = { parts: [], wires: [] };
  comps.forEach((cs, k) => {
    const pl = placed.find((p) => p.name.toLowerCase() === cs.id.toLowerCase())!;
    c.parts.push({ id: 'p' + (k + 1), kind: cs.type, name: cs.id, x: pl.x, y: pl.y, rot: pl.rot, p: props.get(cs.id.toLowerCase())! });
  });
  c.wires = segs.map(([a, b], k) => ({ id: 'w' + (k + 1), a, b }));
  tidy(c);
  c.wires.forEach((w, k) => (w.id = 'w' + (k + 1)));
  const bad = checkLayout(c, root, flip);
  if (bad) throw new Error(`the layout came out wrong (${bad}); try writing the loop a different way.`);
  return c;
}

/** Does the board join exactly the terminals the loop expression joins? null if so, otherwise what is wrong. */
export function checkLayout(c: CircuitData, root: Ser, flip: (name: string) => boolean): string | null {
  const par = new Map<string, string>();
  const find = (x: string): string => { while (par.has(x) && par.get(x) !== x) x = par.get(x)!; return x; };
  const join = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) par.set(ra, rb); };
  let k = 0;
  const conn = (n: Node, a: string, b: string) => {
    if (n.t === 'part') { const f = flip(n.name); join(`${n.name}.${f ? 1 : 0}`, a); join(`${n.name}.${f ? 0 : 1}`, b); }
    else if (n.t === 'bridge') {
      const P = `n${++k}`, Q = `n${++k}`;
      conn(n.arms[0], a, P); conn(n.arms[1], P, b); conn(n.arms[2], a, Q); conn(n.arms[3], Q, b); conn(n.mid, P, Q);
    }
    else if (n.t === 'par') n.branches.forEach((br) => conn(br, a, b));
    else {
      let from = a;
      n.items.forEach((it, i) => { const to = i === n.items.length - 1 ? b : `n${++k}`; conn(it, from, to); from = to; });
    }
  };
  conn(root, 'loop', 'loop');
  const net = solve(c).netOf, want = new Map<string, number>(), got = new Map<number, string>();
  for (const p of c.parts) for (const [t, pt] of terminals(p).entries()) {
    const e = find(`${p.name}.${t}`), g = net[key(pt)];
    if (want.has(e) && want.get(e) !== g) return `${p.name}.${t + 1} is not joined to the rest of its node`;
    if (got.has(g) && got.get(g) !== e) return `${p.name}.${t + 1} touches a node it should not`;
    want.set(e, g); got.set(g, e);
  }
  return null;
}

/* ---------- edits on the board as it is ---------- */

const orient = (a: Pt, b: Pt, c: Pt) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
function meets(a: Pt, b: Pt, c: Pt, d: Pt) {
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && onSeg(c, a, b)) || (o2 === 0 && onSeg(d, a, b)) || (o3 === 0 && onSeg(a, c, d)) || (o4 === 0 && onSeg(b, c, d));
}
const inBoard = ([x, y]: Pt) => x >= 0 && x <= BW && y >= 0 && y <= BH;
const attachPts = (c: CircuitData) => [...c.parts.flatMap(terminals), ...c.wires.flatMap((w) => [w.a, w.b])];

/** How many wires new wire pieces would cross, or -1 if they would touch anything except at `ok` points. */
function routeCost(c: CircuitData, segs: [Pt, Pt][], ok: Pt[]): number {
  const pts = attachPts(c), isOk = (p: Pt) => ok.some((q) => same(p, q));
  let n = 0;
  for (const [a, b] of segs) {
    if (!inBoard(a) || !inBoard(b)) return -1;
    if (pts.some((p) => !isOk(p) && onSeg(p, a, b))) return -1;
    for (const q of [a, b]) if (!isOk(q) && c.wires.some((w) => onSeg(q, w.a, w.b))) return -1;
    if (c.parts.some((p) => onSeg([p.x, p.y], a, b))) return -1;
    for (const w of c.wires) if (meets(a, b, w.a, w.b) && !ok.some((q) => onSeg(q, a, b) && onSeg(q, w.a, w.b))) n++;
  }
  return n;
}
/** Is there room for a horizontal or vertical part centred at m, along axis u, clear of every other part? */
function roomFor(c: CircuitData, m: Pt, u: Pt, skip: Part[] = []) {
  return c.parts.every((q) => skip.includes(q) || Math.abs((q.x - m[0]) * u[0] + (q.y - m[1]) * u[1]) >= 3 || Math.abs((q.x - m[0]) * u[1] - (q.y - m[1]) * u[0]) >= 2);
}
const rotFor = ([dx, dy]: Pt): Rot => (dx > 0 ? 0 : dy > 0 ? 1 : dx < 0 ? 2 : 3);
const sgn = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0);
const newPart = (c: CircuitData, kind: Kind, name: string | undefined, props: Props, x: number, y: number, rot: Rot): Part => {
  const nm = name ?? nextName(c, kind);
  if (!NAME.test(nm)) throw new Error(`name ${JSON.stringify(nm)} must be a letter then up to 5 letters or digits, e.g. V2.`);
  if (c.parts.some((q) => q.name.toLowerCase() === nm.toLowerCase())) throw new Error(`there is already a part called ${nm}; pick another name or leave it out.`);
  return { id: nextId(c, 'p'), kind, name: nm, x, y, rot, p: { ...clone(KINDS[kind].defaults), ...props } };
};

/** A new part in parallel with `target`: beside it, joined to its two end terminals by two short wires. */
export function addAcrossPart(c0: CircuitData, target: Part, kind: Kind, props: Props, name?: string, reverse = false): { c: CircuitData; part: Part } {
  if (target.diag) throw new Error(`${target.name} sits at 45°, so there is no tidy place beside it. Rebuild the circuit with circuit_build instead.`);
  const c = clone(c0), [t0, t1] = terminals(target), u: Pt = [sgn(t1[0] - t0[0]), sgn(t1[1] - t0[1])], nrm: Pt = [-u[1], u[0]];
  const span = Math.hypot(t1[0] - t0[0], t1[1] - t0[1]);
  const mid: Pt = [(t0[0] + t1[0]) / 2, (t0[1] + t1[1]) / 2];
  let best: { cost: number; d: number } | null = null;
  for (const d of [2, -2, 3, -3, 4, -4, 5, -5]) {
    const m: Pt = [mid[0] + nrm[0] * d, mid[1] + nrm[1] * d];
    if (m[0] < 1 || m[0] > BW - 1 || m[1] < 1 || m[1] > BH - 1 || !Number.isInteger(m[0]) || !Number.isInteger(m[1])) continue;
    const s0: Pt = [t0[0] + nrm[0] * d, t0[1] + nrm[1] * d], s1: Pt = [t1[0] + nrm[0] * d, t1[1] + nrm[1] * d];
    if (!roomFor(c, m, u, [target])) continue;
    // a two-terminal part is 2 squares long: across a longer target, the new part's leads run in to meet it
    const segs: [Pt, Pt][] = [[t0, s0], [t1, s1]];
    const a0: Pt = [m[0] - u[0], m[1] - u[1]], a1: Pt = [m[0] + u[0], m[1] + u[1]];
    if (span > 2) segs.push([s0, a0], [a1, s1]);
    const cost = routeCost(c, segs, [t0, t1]);
    if (cost < 0) continue;
    // nothing may lie on the new part's own body either
    if (attachPts(c).some((p) => onSeg(p, a0, a1)) || c.wires.some((w) => meets(a0, a1, w.a, w.b))) continue;
    const score = cost * 10 + Math.abs(d);
    if (!best || score < best.cost) best = { cost: score, d };
  }
  if (!best) throw new Error(`there is no clear space beside ${target.name} for a new part. Rebuild the whole circuit with circuit_build (give the new part "across": "${target.name}").`);
  const d = best.d, m: Pt = [mid[0] + nrm[0] * d, mid[1] + nrm[1] * d];
  const part = newPart(c, kind, name, props, m[0], m[1], ((rotFor(u) + (reverse ? 2 : 0)) % 4) as Rot);
  const s0: Pt = [t0[0] + nrm[0] * d, t0[1] + nrm[1] * d], s1: Pt = [t1[0] + nrm[0] * d, t1[1] + nrm[1] * d];
  c.parts.push(part);
  // across a 2-square target the last two pieces have no length, and tidy() drops them
  for (const [a, b] of [[t0, s0], [t1, s1], [s0, [m[0] - u[0], m[1] - u[1]]], [[m[0] + u[0], m[1] + u[1]], s1]] as [Pt, Pt][]) c.wires.push({ id: nextId(c, 'w'), a: [...a] as Pt, b: [...b] as Pt });
  tidy(c);
  return { c, part };
}

/** A new part in series next to `target`: dropped onto a straight run of the wire leaving one of its terminals
    (the editor's own rule then cuts the wire under it). Faces the way current already flows there. */
export function addSeriesPart(c0: CircuitData, sol: Solution | null, target: Part, term: number | null, kind: Kind, props: Props, name?: string, reverse = false): { c: CircuitData; part: Part } {
  const c = clone(c0), ts = terminals(target), termKeys = new Map<string, number>();
  for (const p of c.parts) for (const t of terminals(p)) termKeys.set(key(t), (termKeys.get(key(t)) ?? 0) + 1);
  const pts = attachPts(c);
  type Run = { a: Pt; b: Pt; len: number; w: Wire };
  const runs: Run[] = [];
  for (const ti of term === null ? ts.map((_, i) => i) : [term]) {
    // walk the wire from this terminal until it reaches a junction or another part
    let cur = ts[ti], prev: Wire | null = null;
    for (let step = 0; step < 12; step++) {
      if ((termKeys.get(key(cur)) ?? 0) > (step ? 0 : 1)) break;
      if (c.wires.some((w) => !same(w.a, cur) && !same(w.b, cur) && onSeg(cur, w.a, w.b))) break;
      const out = c.wires.filter((w) => w !== prev && (same(w.a, cur) || same(w.b, cur)));
      if (out.length !== 1 || (step && c.wires.filter((w) => same(w.a, cur) || same(w.b, cur)).length !== 2)) break;
      const w = out[0], far = same(w.a, cur) ? w.b : w.a;
      // stop at the first point along it where something else attaches
      const inner = pts.filter((p) => !same(p, cur) && onSeg(p, cur, far)).sort((p, q) => Math.hypot(p[0] - cur[0], p[1] - cur[1]) - Math.hypot(q[0] - cur[0], q[1] - cur[1]));
      const end = inner[0] ?? far, len = Math.hypot(end[0] - cur[0], end[1] - cur[1]);
      if ((end[0] === cur[0] || end[1] === cur[1]) && len >= 2) runs.push({ a: cur, b: end, len, w });
      if (!same(end, far)) break;
      prev = w; cur = far;
    }
  }
  const fits = runs.map((r) => {
    const u: Pt = [sgn(r.b[0] - r.a[0]), sgn(r.b[1] - r.a[1])], k = Math.floor((r.len - 2) / 2);
    const p0: Pt = [r.a[0] + u[0] * k, r.a[1] + u[1] * k], m: Pt = [p0[0] + u[0], p0[1] + u[1]];
    return { r, u, p0, m };
  }).filter((f) => roomFor(c, f.m, f.u)).sort((x, y) => y.r.len - x.r.len);
  if (!fits.length) throw new Error(`there is no straight piece of wire next to ${target.name} long enough for a new part. Rebuild the circuit with circuit_build instead.`);
  const { r, u, m } = fits[0];
  // which way does conventional current go along this wire now? (none: away from the target)
  let dir = 1;
  const f = sol?.flows[r.w.id]?.find((x) => onSeg(m, x.a, x.b));
  if (f && Math.abs(f.i) > 1e-9) dir = sgn((f.b[0] - f.a[0]) * u[0] + (f.b[1] - f.a[1]) * u[1]) * sgn(f.i) || 1;
  // terminal 0 upstream (a cell: + downstream, so it pushes the current on)
  const down: Pt = [u[0] * dir, u[1] * dir], fwd = isSource(kind) === reverse;
  const part = newPart(c, kind, name, props, m[0], m[1], rotFor(fwd ? down : [-down[0], -down[1]]));
  c.parts.push(part);
  cutUnder(c, part); tidy(c);
  return { c, part };
}

/** Take a part off the board. join: put a plain wire where it was (keeps a series loop complete). Otherwise any wire
    left leading only to where it was goes too, back to the nearest junction or part. */
export function removePart(c0: CircuitData, target: Part, join: boolean): CircuitData {
  const c = clone(c0), ts = terminals(target);
  c.parts = c.parts.filter((p) => p.id !== target.id);
  if (join) {
    if (ts.length !== 2) throw new Error(`${target.name} has three terminals, so it can't be replaced by one wire. Remove it without join, then add wires with action "connect".`);
    c.wires.push({ id: nextId(c, 'w'), a: [...ts[0]] as Pt, b: [...ts[1]] as Pt });
    tidy(c);
    return c;
  }
  const isTerm = (p: Pt) => c.parts.some((q) => terminals(q).some((t) => same(t, p)));
  const todo = [...ts];
  while (todo.length) {
    const p = todo.pop()!;
    if (isTerm(p) || c.wires.some((w) => !same(w.a, p) && !same(w.b, p) && onSeg(p, w.a, w.b))) continue;
    const at = c.wires.filter((w) => same(w.a, p) || same(w.b, p));
    if (at.length !== 1) continue;
    c.wires = c.wires.filter((w) => w !== at[0]);
    todo.push(same(at[0].a, p) ? at[0].b : at[0].a);
  }
  return c;
}

/** A wire from one terminal to another: straight if they line up, otherwise an L, never touching anything else. */
export function connectTerminals(c0: CircuitData, A: Pt, B: Pt): CircuitData {
  if (same(A, B)) throw new Error('those two terminals are already at the same point, so they are already joined.');
  const c = clone(c0);
  let best: { cost: number; pts: Pt[] } | null = null;
  for (const first of ['h', 'v'] as const) {
    const pts = wirePath(A, B, first), segs = pts.slice(1).map((b, i) => [pts[i], b] as [Pt, Pt]);
    const cost = routeCost(c, segs, [A, B]);
    if (cost >= 0 && (!best || cost < best.cost)) best = { cost, pts };
  }
  if (!best) throw new Error('there is no clean straight or L-shaped route between those terminals that avoids every other part and wire. Rebuild the circuit with circuit_build instead.');
  for (let i = 1; i < best.pts.length; i++) c.wires.push({ id: nextId(c, 'w'), a: [...best.pts[i - 1]] as Pt, b: [...best.pts[i]] as Pt });
  tidy(c);
  return c;
}

/* ---------- describing the board ---------- */

const clean = (x: number) => (Math.abs(x) < 1e-6 ? 0 : x);

export function settingText(p: Part): string {
  const P = p.p;
  switch (p.kind) {
    case 'cell': return `e.m.f. ${num(P.emf ?? 0)} V, internal resistance ${ohms(P.r ?? 0)}`;
    case 'ac': return `peak e.m.f. ${num(P.emf ?? 0)} V, ${num(P.freq ?? 1, 2)} Hz`;
    case 'resistor': case 'varres': return ohms(P.R ?? 0);
    case 'pot': return `${ohms(P.R ?? 0)} end to end, slider at ${Math.round((P.wiper ?? 0.5) * 100)}% from terminal 1`;
    case 'thermistor': return `${num(P.T ?? 20)} °C (so ${ohms(thermR(P.T ?? 20))})`;
    case 'ldr': return `${num(P.lux ?? 100, 2)} lx (so ${ohms(ldrR(P.lux ?? 100))})`;
    case 'lamp': return `rated ${LAMPS[P.rating ?? '6V'].label}`;
    case 'led': return P.colour ?? 'red';
    case 'switch': return P.on ? 'closed' : 'open';
    case 'switch2': return `at ${P.on ? 'A' : 'B'}`;
    case 'capacitor': return si(P.C ?? 0, 'F', 2);
    default: return '';
  }
}

function readingText(p: Part, r: Solution['parts'][string] | undefined): string {
  if (!r) return '';
  const V = si(clean(r.v), 'V'), I = si(clean(r.i), 'A'), W = si(clean(r.p), 'W');
  switch (p.kind) {
    case 'ammeter': return `reads ${meter(r.reading ?? 0, 'A')}`;
    case 'voltmeter': return `reads ${meter(r.reading ?? 0, 'V')}`;
    case 'cell': return `terminal p.d. ${V}, current ${I}, power to circuit ${W}${r.short ? ', SHORT-CIRCUITED' : ''}`;
    case 'ac': return `e.m.f. now ${V}, current now ${I}`;
    case 'capacitor': return `p.d. ${V}, charge ${si(clean(r.q ?? 0), 'C')}, energy ${si(clean(r.energy ?? 0), 'J')}, current ${I}`;
    case 'switch': case 'switch2': return `current ${I}`;
    case 'lamp': return `p.d. ${V}, current ${I}, power ${W}, ${Math.round((r.bright ?? 0) * 100)}% of rated power`;
    case 'led': return `p.d. ${V}, current ${I}, ${(r.bright ?? 0) > 0.05 ? 'lit' : 'not lit'}`;
    default: return `p.d. ${V}, current ${I}, power ${W}`;
  }
}

/** The board in words: every part with its setting, what each terminal is joined to, and the live readings. */
export function describe(c: CircuitData, sol: Solution): string {
  if (!c.parts.length) return 'The board is empty.';
  const nets = new Map<number, string[]>(), label = new Map<number, string>();
  const tname = (p: Part, t: number) => { const n = termNames(p.kind)[t]; return `${p.name}.${t + 1}${n ? `(${n})` : ''}`; };
  for (const p of c.parts) terminals(p).forEach((pt, t) => {
    const g = sol.netOf[key(pt)];
    if (!nets.has(g)) { nets.set(g, []); label.set(g, 'N' + (label.size + 1)); }
    nets.get(g)!.push(tname(p, t));
  });
  const lines = ['Parts (name: type, setting; terminal → node; live readings):'];
  for (const p of c.parts) {
    const conns = terminals(p).map((pt, t) => `${tname(p, t)}→${label.get(sol.netOf[key(pt)])}`).join(' ');
    const set = settingText(p);
    lines.push(`- ${p.name}: ${kindLabel(p.kind).toLowerCase()}${set ? ', ' + set : ''}; ${conns}; ${readingText(p, sol.parts[p.id])}`);
  }
  lines.push('Nodes (terminals joined by wire):');
  for (const [g, ts] of nets) lines.push(`- ${label.get(g)}: ${ts.join(', ')}${ts.length < 2 ? ' (connected to nothing else)' : ''}`);
  const notes: string[] = [];
  const shorts = sol.shorts.map((id) => c.parts.find((p) => p.id === id)?.name).filter(Boolean);
  if (shorts.length) notes.push(`Short circuit across ${shorts.join(', ')} (the board shows a warning).`);
  if (!sol.converged) notes.push('The solver did not fully settle; readings may be slightly off.');
  const src = c.parts.filter((p) => isSource(p.kind));
  if (src.length && src.every((p) => Math.abs(sol.parts[p.id]?.i ?? 0) < 1e-9)) notes.push('No current flows from the supply (an open switch, a gap, or only a capacitor in the way).');
  if (notes.length) lines.push('Notes: ' + notes.join(' '));
  return lines.join('\n');
}
