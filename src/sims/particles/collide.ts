/* Particle Lab: the bubble-chamber collision lab. Fire any particle at a proton (liquid hydrogen), at a deuteron, or
   head-on at a second beam, and see what comes out.

   What can come out is worked out, not listed by hand: every final state built from the common hadrons (nucleons,
   Λ, Σ, Ξ, Ω, pions, kaons) that conserves charge, baryon number and strangeness (the strong interaction conserves
   strangeness) is a candidate, and it is open only if √s, the energy available in the centre-of-mass frame, is at
   least the sum of its rest masses. Lepton and photon beams get their own short lists (scattering, pair production,
   annihilation, deep inelastic scattering). Each open channel gets a weight that rewards energy to spare and a
   sensible number of particles for the energy, and penalises making strange quarks or extra baryon–antibaryon pairs:
   a rough model of how often each happens, not a measured cross-section.

   Kinematics are exact: the products share √s in the centre-of-mass frame (two bodies back to back; more by a
   sequential phase-space generator), then are boosted to the lab. Everything moves in the plane of the photograph,
   which keeps momentum and energy conservation exact and visible. Unstable products then fly a distance drawn from
   an exponential with mean βγcτ (their real lifetimes) and decay; slow ones stop in the liquid and decay or are
   captured at rest; photons convert to e⁺e⁻ pairs after a distance drawn from their mean free path (9/7 of the
   radiation length). */

import { get, anti, symOf, type Particle } from './data';
import { check, type Row } from './rules';
import { trace, neutral, seeded, BUBBLE_B, LH2, CHAMBER, type Track, type BEvent, type Box } from './detect';

/* ---------- four-vectors in the plane (MeV) ---------- */

export interface V { E: number; x: number; y: number }
const mass = (id: string) => get(id).mass;
const qOf = (id: string) => get(id).q3 / 3;
const vec = (m: number, p: number, a: number): V => ({ E: Math.sqrt(p * p + m * m), x: p * Math.cos(a), y: p * Math.sin(a) });
const pStar = (M: number, m1: number, m2: number) => Math.sqrt(Math.max(0, (M * M - (m1 + m2) ** 2) * (M * M - (m1 - m2) ** 2))) / (2 * M);
/** Boost v by velocity (bx, by): the frame where v was measured moves with that velocity in the new frame. */
export function boost(v: V, bx: number, by: number): V {
  const b2 = bx * bx + by * by;
  if (b2 < 1e-18) return { ...v };
  const g = 1 / Math.sqrt(1 - b2), bp = bx * v.x + by * v.y, k = (g - 1) / b2;
  return { E: g * (v.E + bp), x: v.x + k * bp * bx + g * bx * v.E, y: v.y + k * bp * by + g * by * v.E };
}

/** n bodies sharing a total mass M, at rest overall: sequential two-body splits with phase-space weighting. */
export function nBody(M: number, ms: number[], rnd: () => number, axisAng?: (rnd: () => number) => number): V[] {
  const n = ms.length;
  if (n === 1) return [{ E: M, x: 0, y: 0 }];
  if (n === 2) {
    const p = pStar(M, ms[0], ms[1]), a = axisAng ? axisAng(rnd) : rnd() * Math.PI * 2;
    return [vec(ms[0], p, a), vec(ms[1], p, a + Math.PI)];
  }
  const sum = ms.reduce((a, b) => a + b, 0), T = M - sum;
  const sample = () => {
    const r = Array.from({ length: n - 2 }, rnd).sort((a, b) => a - b);
    const Mk: number[] = [ms[0]];
    let acc = ms[0];
    for (let k = 1; k < n - 1; k++) { acc += ms[k]; Mk.push(acc + r[k - 1] * T); }
    Mk.push(M);
    let w = 1;
    for (let k = 1; k < n; k++) w *= pStar(Mk[k], Mk[k - 1], ms[k]);
    return { Mk, w };
  };
  let wmax = 0;
  for (let i = 0; i < 40; i++) wmax = Math.max(wmax, sample().w);
  let pick = sample();
  for (let i = 0; i < 400; i++) { const s = sample(); if (rnd() * wmax * 1.1 <= s.w) { pick = s; break; } }
  const { Mk } = pick;
  // build up: subsystem k (particles 0..k) at rest decays into subsystem k−1 and particle k
  let vs: V[] = [{ E: ms[0], x: 0, y: 0 }];
  for (let k = 1; k < n; k++) {
    const p = pStar(Mk[k], Mk[k - 1], ms[k]), a = rnd() * Math.PI * 2;
    const sub = vec(Mk[k - 1], p, a + Math.PI), me = vec(ms[k], p, a);
    vs = vs.map((v) => boost(v, sub.x / sub.E, sub.y / sub.E));
    vs.push(me);
  }
  return vs;
}

/* ---------- the particles a collision can make ---------- */

const BARYONS = ['p', 'n', 'Lambda', 'Sigma+', 'Sigma0', 'Sigma-', 'Xi0', 'Xi-', 'Omega-'];
const MESONS = ['pi+', 'anti-pi+', 'pi0', 'K+', 'anti-K+', 'K0', 'anti-K0'];
const isBaryon = (id: string) => get(id).family === 'baryon';
const isHadron = (id: string) => { const f = get(id).family; return f === 'baryon' || f === 'meson'; };
const isLepton = (id: string) => get(id).family === 'lepton';
const sCount = (ids: string[]) => ids.reduce((a, id) => a + (get(id).quarks ?? []).filter((q) => q === 's' || q === '-s').length, 0);
const bCount = (ids: string[]) => ids.filter(isBaryon).length;

function multisets<T>(items: T[], k: number, start = 0): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  for (let i = start; i < items.length; i++) for (const rest of multisets(items, k - 1, i)) out.push([items[i], ...rest]);
  return out;
}

const cache = new Map<string, { ids: string[]; m: number }[]>();
/** Every hadronic final state with this charge (in e), baryon number and strangeness, up to a few particles. */
function hadronStates(Q: number, B: number, S: number): { ids: string[]; m: number }[] {
  const key = `${Q},${B},${S}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const bars = (b: number): string[][] => {
    if (b === 0) return [[]];
    const base = b > 0 ? BARYONS : BARYONS.map((id) => anti(get(id)).id);
    const set = Math.abs(b) === 2 ? base.slice(0, 6) : base;
    return multisets(set, Math.abs(b));
  };
  const cores: string[][] = [...bars(B)];
  // one extra baryon–antibaryon pair (antiprotons are made like this)
  const pairs = B === 0 ? ['p', 'n', 'Lambda', 'Sigma+', 'Sigma0', 'Sigma-'] : ['p', 'n', 'Lambda'];
  for (const c of bars(B)) for (const b of pairs) for (const ab of pairs) cores.push([...c, b, anti(get(ab)).id]);
  const kmax = B === 0 ? 6 : 5;
  const out: { ids: string[]; m: number }[] = [];
  const mesonSets: string[][] = [];
  for (let k = 0; k <= kmax; k++) mesonSets.push(...multisets(MESONS, k));
  for (const c of cores) {
    for (const ms of mesonSets) {
      const ids = [...c, ...ms];
      if (ids.length < 2 || ids.length > 7) continue;
      let q = 0, s = 0, m = 0;
      for (const id of ids) { const p = get(id); q += p.q3; s += p.S; m += p.mass; }
      if (q !== 3 * Q || s !== S) continue;
      out.push({ ids, m });
    }
  }
  cache.set(key, out);
  return out;
}

/* ---------- channels ---------- */

export type Kind = 'elastic' | 'inelastic' | 'annihilation' | 'pair' | 'through' | 'compton' | 'dis' | 'none';
export interface Channel { key: string; kind: Kind; ids: string[]; m: number; w: number; label: string; beyond?: boolean; note: string }

const poisson = (k: number, l: number) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return Math.exp(-l) * l ** k / f; };
const sortIds = (ids: string[]) => [...ids].sort((a, b) => order(a) - order(b));
const ORDER = ['p', 'anti-p', 'n', 'anti-n', 'Lambda', 'anti-Lambda', 'Sigma+', 'Sigma0', 'Sigma-', 'Xi0', 'Xi-', 'Omega-', 'K+', 'anti-K+', 'K0', 'anti-K0', 'pi+', 'anti-pi+', 'pi0', 'e', 'anti-e', 'mu', 'anti-mu', 'tau', 'anti-tau', 'gamma'];
const order = (id: string) => { const i = ORDER.indexOf(id); return i < 0 ? 50 + ORDER.indexOf(anti(get(id)).id) : i; };
const text = (ids: string[]) => ids.map(symOf).join(' + ');

/** All channels for a and b colliding with energy √s (MeV): open ones (with weights), and nearby closed ones. */
export function channels(a: string, b: string, W: number, fixed = true): { open: Channel[]; closed: Channel[] } {
  const init = [a, b];
  const head = text(init) + ' → ';
  const mk = (kind: Kind, ids: string[], w: number, note: string, beyond = false): Channel => {
    const s = kind === 'through' || kind === 'pair' ? ids : sortIds(ids);
    return { key: kind + ':' + s.join(','), kind, ids: s, m: s.reduce((x, id) => x + mass(id), 0), w, label: kind === 'through' ? `${symOf(a)} passes through` : head + text(s), note, beyond };
  };
  const open: Channel[] = [], closed: Channel[] = [];
  const add = (c: Channel) => {
    // leptons or photons made near their threshold: rarely, rising as the spare energy grows
    if ((c.kind === 'annihilation' || c.kind === 'pair') && c.ids.every((id) => !isHadron(id))) c.w *= 1 - Math.exp(-Math.max(0, W - c.m) / 150);
    if (c.m <= W - 1e-6) open.push(c); else if (c.m < W + 900 && c.ids.length <= 4) closed.push(c);
  };
  const la = isLepton(a), lb = isLepton(b), ga = a === 'gamma', gb = b === 'gamma';
  const Q = (qOf(a) + qOf(b)), B = (get(a).b3 + get(b).b3) / 3, S = get(a).S + get(b).S;
  const mIn = mass(a) + mass(b);

  /** Hadronic final states with weights; extra: a lepton spectator kept in the final state (deep inelastic). */
  const hadronic = (Qh: number, Bh: number, Sh: number, kind: Kind, scale: number, keep: string[] = [], beyond = false, note = '') => {
    const states = hadronStates(Qh, Bh, Sh);
    const ann = kind === 'annihilation';
    const avail = W - mIn;
    const lam = ann ? 3 + Math.log(Math.max(1, W / 1877)) : 0.4 + 1.5 * Math.log(1 + Math.max(0, avail) / 1000);
    const elasticKey = sortIds(init).join(',');
    const nsIn = sCount(init), nbIn = bCount(init) + init.filter((id) => get(id).family === 'baryon' && get(id).b3 < 0).length;
    const keepM = keep.reduce((x, id) => x + mass(id), 0);
    for (const st of states) {
      if (st.m + keepM > W + 900) continue;                           // far out of reach: not even worth listing
      const ids = [...keep, ...st.ids];
      if (ids.length === 2 && sortIds(ids).join(',') === elasticKey) continue;   // that is elastic scattering
      if (keep.length && st.ids.length < 2) continue;
      const nMes = st.ids.filter((id) => get(id).family === 'meson').length;
      const extra = ann ? Math.max(0, nMes - 2) : Math.max(0, ids.length - 2);
      const pairsS = Math.max(0, sCount(ids) - nsIn) / 2;
      const nbOut = st.ids.filter(isBaryon).length;
      const pairsB = Math.max(0, nbOut - nbIn) / 2;
      const Qf = W - (st.m + keepM);
      const w = scale * poisson(Math.min(extra, 12), Math.max(0.05, lam)) * (1 - Math.exp(-Math.max(0, Qf) / 120)) * 0.25 ** pairsS * 0.04 ** pairsB;
      add(mk(kind, ids, w, note, beyond));
    }
  };

  if (isHadron(a) && isHadron(b)) {
    const annih = B === 0 && (isBaryon(a) || isBaryon(b)) && get(a).b3 * get(b).b3 < 0;
    hadronic(Q, B, S, annih ? 'annihilation' : 'inelastic', 1, [], false, annih ? 'A baryon meets an antibaryon: they annihilate, and their energy becomes mesons.' : '');
    const winel = open.reduce((x, c) => x + c.w, 0);
    const above = Math.max(0, W - mIn - 135);
    const e = annih ? 0.3 : 0.22 + 0.75 * Math.exp(-above / 350);
    add(mk('elastic', init, winel > 0 ? (winel * e) / (1 - e) : 1, 'Elastic scattering: the same particles come out, sharing the momentum differently.'));
  } else if ((ga && isHadron(b)) || (gb && isHadron(a))) {
    hadronic(Q, B, S, 'inelastic', 1, [], false, 'Photoproduction: the photon’s energy makes new hadrons.');
    const H = open.reduce((x, c) => x + c.w, 0) || 1;
    const h = ga ? b : a;
    if (W > mass(h) + 1.022) add(mk('pair', ['e', 'anti-e', h], 100 * H, 'Pair production in the field of the proton: about 99% of photon interactions in hydrogen.'));
    add(mk('compton', init, 0.01 * H, 'Compton scattering off the proton: the photon bounces off and the proton recoils.'));
  } else if ((la && (isHadron(b) || gb)) || (lb && (isHadron(a) || ga))) {
    const l = la ? a : b, h = la ? b : a;
    if (h === 'gamma') add(mk('compton', init, 1, 'Compton scattering: the photon bounces off the charged lepton.'));
    else {
      add(mk('through', init, 0.85, 'Most of the time nothing happens: the lepton only ionises the liquid as it passes, knocking out δ-ray electrons.'));
      add(mk('elastic', init, 0.13, 'Elastic scattering off a proton: the proton recoils.'));
      const hq = qOf(h), hb = get(h).b3 / 3, hs = get(h).S;
      if (W > mass(l) + mass(h) + 300) hadronic(hq, hb, hs, 'dis', 0.02, [l], true, 'Deep inelastic scattering: the lepton hits a quark inside the proton hard enough to break it up. This is how quarks were found (SLAC, 1968).');
      if (l === 'anti-e' && fixed && la) add(mk('annihilation', ['gamma', 'gamma'], 0.02, 'The positron annihilates in flight with an atomic electron (shown as part of the target): two photons.'));
    }
  } else if (la && lb) {
    const pa = get(a), pb = get(b);
    const conj = anti(pa).id === b;
    if (conj) {
      add(mk('annihilation', ['gamma', 'gamma'], 1, 'Annihilation: particle and antiparticle become two photons (two, so momentum can be conserved).'));
      for (const l of ['e', 'mu', 'tau']) if (l !== a && l !== b) add(mk('annihilation', [l, anti(get(l)).id], 1, 'Annihilation into a different pair of leptons: enough energy, ΔE = c²Δm, to make heavier particles.'));
      const before = open.length;
      hadronic(0, 0, 0, 'annihilation', 0.6, [], false, 'Annihilation into hadrons: the energy makes a quark and an antiquark, which become mesons (or a baryon and an antibaryon).');
      // through a single (virtual) photon only states that can come from one photon: never π⁰s alone (C-parity, beyond the spec)
      for (let i = open.length - 1; i >= before; i--) if (open[i].ids.every((id) => id === 'pi0')) open.splice(i, 1);
      add(mk('elastic', init, 1, 'Elastic scattering: they bounce off each other.'));
    } else add(mk('elastic', init, 1, 'They repel or attract electrically and scatter off each other.'));
    void pb;
  } else if (ga && gb) {
    for (const l of ['e', 'mu']) add(mk('pair', [l, anti(get(l)).id], 1, 'Two photons make a particle–antiparticle pair (the Breit–Wheeler process).', true));
  }
  // conservation of everything, double-checked against the Reactions tab’s rules
  const ok = (c: Channel) => c.kind === 'through' || (c.kind === 'annihilation' && l2(init, c)) || allConserved(init, c.ids);
  const fo = open.filter((c) => c.w > 0 && ok(c));
  const tot = fo.reduce((x, c) => x + c.w, 0) || 1;
  for (const c of fo) c.w /= tot;
  fo.sort((x, y) => y.w - x.w);
  closed.sort((x, y) => x.m - y.m);
  const seen = new Set<string>();
  return { open: fo, closed: closed.filter((c) => ok(c) && !seen.has(c.key) && seen.add(c.key)).slice(0, 6) };
}
// a positron annihilating with an atomic electron: the target's electron is part of the reaction
const l2 = (init: string[], c: Channel) => (init.includes('anti-e') ? allConserved(['anti-e', 'e'], c.ids) : allConserved(init, c.ids));

/** Charge, baryon number, every lepton number and strangeness (strong and electromagnetic processes conserve it). */
export function allConserved(lhs: string[], rhs: string[]) {
  const c = check(lhs, rhs);
  return c.rows.every((r) => r.ok);
}

/* ---------- running one collision ---------- */

export interface Setup { beam: string; pb: number /* MeV/c */; target: 'p' | 'd' | 'beam'; beam2: string; pb2: number; chan: string; heavy: boolean; seed: number }
export interface Result {
  ok: boolean; message?: string;
  initial: string[]; final: string[]; channel: Channel | null;
  W: number; thr: number; open: Channel[]; closed: Channel[];
  rows: Row[]; Ein: number; Eout: number; Pin: [number, number]; Pout: [number, number];
  ev: BEvent; struck?: string;
}

export const HEAVY = { loss: 2.4, X0: 11 };          // a freon (CF₃Br) chamber: MeV cm⁻¹ and radiation length / cm
export const HYDROGEN = { loss: LH2, X0: 890 };

/** √s for beam a (momentum pa) on b: at rest, or coming the other way with momentum pb. */
export function sqrtS(a: string, pa: number, b: string, pb: number, headOn: boolean) {
  const ma = mass(a), mb = mass(b);
  const Ea = Math.sqrt(pa * pa + ma * ma), Eb = headOn ? Math.sqrt(pb * pb + mb * mb) : mb;
  const px = pa - (headOn ? pb : 0);
  return Math.sqrt(Math.max(0, (Ea + Eb) ** 2 - px * px));
}

const DECAYS: Record<string, [number, string[]][]> = {
  'pi+': [[1, ['anti-mu', 'numu']]],
  pi0: [[1, ['gamma', 'gamma']]],
  'K+': [[0.64, ['anti-mu', 'numu']], [0.21, ['pi+', 'pi0']], [0.056, ['pi+', 'pi+', 'anti-pi+']], [0.05, ['pi0', 'anti-e', 'nue']], [0.034, ['pi0', 'anti-mu', 'numu']]],
  K0S: [[0.69, ['pi+', 'anti-pi+']], [0.31, ['pi0', 'pi0']]],
  K0L: [[0.2, ['pi+', 'e', 'anti-nue']], [0.2, ['anti-pi+', 'anti-e', 'nue']], [0.135, ['pi+', 'mu', 'anti-numu']], [0.135, ['anti-pi+', 'anti-mu', 'numu']], [0.195, ['pi0', 'pi0', 'pi0']], [0.125, ['pi+', 'anti-pi+', 'pi0']]],
  Lambda: [[0.64, ['p', 'anti-pi+']], [0.36, ['n', 'pi0']]],
  'Sigma+': [[0.516, ['p', 'pi0']], [0.484, ['n', 'pi+']]],
  Sigma0: [[1, ['Lambda', 'gamma']]],
  'Sigma-': [[1, ['n', 'anti-pi+']]],
  Xi0: [[1, ['Lambda', 'pi0']]],
  'Xi-': [[1, ['Lambda', 'anti-pi+']]],
  'Omega-': [[0.678, ['Lambda', 'anti-K+']], [0.236, ['Xi0', 'anti-pi+']], [0.086, ['Xi-', 'pi0']]],
  mu: [[1, ['e', 'anti-nue', 'numu']]],
  tau: [[0.174, ['mu', 'anti-numu', 'nutau']], [0.178, ['e', 'anti-nue', 'nutau']], [0.108, ['anti-pi+', 'nutau']], [0.255, ['anti-pi+', 'pi0', 'nutau']], [0.285, ['anti-pi+', 'anti-pi+', 'pi+', 'nutau']]],
};
const conj = (id: string) => anti(get(id)).id;
/** Decay modes of a particle (antiparticles: every product conjugated). K⁰ as its short- or long-lived form. */
function modes(id: string, form: 'S' | 'L' | ''): [number, string[]][] | null {
  if (id === 'K0' || id === 'anti-K0') return DECAYS[form === 'L' ? 'K0L' : 'K0S'];
  if (DECAYS[id]) return DECAYS[id];
  const p = get(id);
  if (p.anti) { const base = conj(id); if (DECAYS[base]) return DECAYS[base].map(([w, ps]) => [w, ps.map(conj)]); }
  return null;
}
const LIFE: Record<string, number> = { K0L: 5.116e-8 };

interface Ctx {
  rnd: () => number; g: () => number; B: number; loss: number; X0: number; box: Box;
  tracks: Track[]; vertex: BEvent['vertex']; what: string[]; decays: string[]; depth: number; dur: number;
  esc: Record<string, number>;    // neutral particles that left the chamber unseen, by symbol
}

const C_CM = 3e10;
const speedOf = (p: number, m: number) => (m === 0 ? 1 : p / Math.sqrt(p * p + m * m));
const vDraw = (p: number, m: number) => Math.max(3, 36 * speedOf(p, m));   // drawing speed: cm per second of animation, ∝ the particle’s speed
function toEdge(box: Box, x: number, y: number, a: number) {
  const c = Math.cos(a), s = Math.sin(a);
  const tx = c > 0 ? (box.x1 - x) / c : c < 0 ? (box.x0 - x) / c : Infinity;
  const ty = s > 0 ? (box.y1 - y) / s : s < 0 ? (box.y0 - y) / s : Infinity;
  return Math.max(0, Math.min(tx, ty));
}
const nameOf = (id: string) => `${get(id).name} (${symOf(id)})`;
const fmtP = (p: number) => (p >= 1000 ? `${(p / 1000).toPrecision(3)} GeV/c` : `${p.toPrecision(3)} MeV/c`);
const fmtL = (cm: number) => (cm >= 100 ? `${(cm / 100).toPrecision(3)} m` : cm >= 1 ? `${cm.toPrecision(3)} cm` : `${(cm * 10).toPrecision(2)} mm`);

const SIDE = (q: number) => (q > 0 ? 'Curves clockwise (B out of the screen): positive.' : 'Curves anticlockwise (B out of the screen): negative.');

/** Fly one particle from (x, y) at angle a with momentum p, then let it decay, stop, convert or leave. */
function fly(c: Ctx, id: string, x: number, y: number, a: number, p: number, t0: number, origin: string, form: 'S' | 'L' | '' = '') {
  const P = get(id), m = P.mass, q = qOf(id);
  if (c.depth > 5) return;
  // which form a neutral kaon is in
  if ((id === 'K0' || id === 'anti-K0') && !form) form = c.rnd() < 0.5 ? 'S' : 'L';
  const life = form === 'L' ? LIFE.K0L : P.life;
  const bg = m > 0 ? p / m : Infinity;
  const v = vDraw(p, m);
  // where it would decay (or, for a photon, convert)
  let L = Infinity;
  if (id === 'gamma') L = -(9 / 7) * c.X0 * Math.log(1 - c.rnd());
  else if (isFinite(life) && life < 1) L = life < 1e-18 ? 0 : -bg * C_CM * life * Math.log(1 - c.rnd());
  if (q === 0) {
    const D = toEdge(c.box, x, y, a);
    if (L > 0.02) {
      const len = Math.min(L, D);
      const n = neutral(id, nameOf(id), x, y, a, Math.max(0.05, len), p, t0, `${P.name[0].toUpperCase() + P.name.slice(1)}: no charge, so no ionisation and no bubbles. ${origin}`, v);
      c.tracks.push(n.track);
      c.dur = Math.max(c.dur, n.end.t);
      if (L >= D) {
        if (isFinite(life) && life < 1 && id !== 'gamma') c.what.push(`${symOf(id)} left the chamber before decaying (its mean path βγcτ is ${fmtL(bg * C_CM * life)}).`);
        else { const k = symOf(id); c.esc[k] = (c.esc[k] ?? 0) + 1; }
        return;
      }
      x = n.end.x; y = n.end.y; t0 = n.end.t;
    }
    if (id === 'gamma') {
      // pair production next to a nucleus: e⁺ and e⁻ share the photon's energy, both going forwards
      if (p <= 1.03) return;
      const T = p - 2 * 0.511, f = 0.15 + 0.7 * c.rnd();
      const p1 = Math.sqrt((f * T) ** 2 + 2 * f * T * 0.511), p2 = Math.sqrt(((1 - f) * T) ** 2 + 2 * (1 - f) * T * 0.511);
      c.vertex?.push({ x, y, label: 'γ → e⁺e⁻' });
      c.what.push(`A photon (${fmtP(p).replace('/c', '')}) converted into an e⁺e⁻ pair ${fmtL(L)} from where it was made: a V of two tracks curling opposite ways, pointing back along the photon.`);
      c.decays.push('γ → e⁺ + e⁻');
      c.depth++;
      fly(c, 'anti-e', x, y, a - 0.01, p1, t0, 'Made with an electron by a photon (pair production).');
      fly(c, 'e', x, y, a + 0.01, p2, t0, 'Made with a positron by a photon (pair production).');
      c.depth--;
      return;
    }
    decayAt(c, id, form, x, y, a, p, t0);
    return;
  }
  // charged: trace it through the liquid
  const maxLen = Math.max(0.05, L);
  const r = trace({ pid: id, name: nameOf(id), q, m, x, y, ang: a, p, B: c.B, loss: c.loss, t0, box: c.box, maxLen: isFinite(maxLen) ? maxLen : 400, v,
    rnd: c.rnd, scatter: id === 'e' || id === 'anti-e' ? 0.6 : 0, pStop: id === 'e' || id === 'anti-e' ? 0.8 : undefined,
    why: `${SIDE(q)} ${origin} Momentum here ${fmtP(p)}.` });
  if (r.track.pts.length > 1) c.tracks.push(r.track);
  c.dur = Math.max(c.dur, r.end.t);
  // δ-rays from fast tracks
  if ((id !== 'e' && id !== 'anti-e') && p / Math.max(m, 1) > 1.5 && r.track.pts.length > 10) {
    const len = r.track.pts.length * 0.24;
    const n = Math.floor(len * 0.05 * q * q + c.rnd());
    for (let j = 0; j < Math.min(4, n); j++) {
      const at = r.track.pts[Math.floor((0.1 + 0.8 * c.rnd()) * r.track.pts.length)];
      const T = 1.5 + c.rnd() * 7, pe = Math.sqrt(T * T + 2 * T * 0.511);
      const th = Math.acos(Math.min(1, Math.sqrt(T / (T + 2 * 0.511)) * 0.99)) * (c.rnd() < 0.5 ? 1 : -1);
      const k = r.track.pts.indexOf(at), nx = r.track.pts[Math.min(k + 1, r.track.pts.length - 1)];
      const dir = Math.atan2(nx.y - at.y, nx.x - at.x) || a;
      const dr = trace({ pid: 'e', name: 'δ-ray (knock-on electron)', q: -1, m: 0.511, x: at.x, y: at.y, ang: dir + th, p: pe, B: c.B, loss: c.loss, t0: at.t, box: c.box, pStop: 0.8, v: 30,
        rnd: c.rnd, scatter: 0.6, why: 'A small curl starting on a fast track: an atomic electron knocked out by the passing particle (a δ-ray). Curls anticlockwise: negative.' });
      c.tracks.push(dr.track);
    }
  }
  const travelled = (r.track.pts.length - 1) * 0.24;
  const leftBox = !r.end.stopped && travelled < maxLen - 0.3;
  if (leftBox) {
    if (isFinite(life) && life < 1) c.what.push(`${symOf(id)} (${fmtP(p)}) left the chamber before it could decay: on average it would fly ${fmtL(bg * C_CM * life)} first.`);
    return;
  }
  if (!r.end.stopped) { decayAt(c, id, form, r.end.x, r.end.y, r.end.ang, r.end.p, r.end.t); return; }
  // it stopped in the liquid: decay at rest, or be captured
  atRest(c, id, r.end.x, r.end.y, r.end.t);
}

function chooseMode(c: Ctx, ms: [number, string[]][]) {
  const tot = ms.reduce((x, [w]) => x + w, 0);
  let u = c.rnd() * tot;
  for (const [w, ps] of ms) { if ((u -= w) <= 0) return ps; }
  return ms[ms.length - 1][1];
}

/** A decay in flight (or instantly, for π⁰ and Σ⁰): products made in the rest frame and boosted. */
function decayAt(c: Ctx, id: string, form: 'S' | 'L' | '', x: number, y: number, a: number, p: number, t0: number) {
  const ms = modes(id, form);
  if (!ms) return;
  const prods = chooseMode(c, ms);
  const M = mass(id);
  const vs = nBody(M, prods.map(mass), c.rnd);
  const E = Math.sqrt(p * p + M * M), bx = (p / E) * Math.cos(a), by = (p / E) * Math.sin(a);
  const lab = vs.map((v) => boost(v, bx, by));
  const label = `${symOf(id)} → ${prods.map(symOf).join(' ')}`;
  c.decays.push(`${symOf(id)} → ${prods.map(symOf).join(' + ')}`);
  if (get(id).life > 1e-15 || form === 'L') c.vertex?.push({ x, y, label });
  if (id !== 'pi0' && id !== 'Sigma0') c.what.push(`${symOf(id)} decayed ${get(id).q3 === 0 ? 'where its invisible path ended (a V or a fork from nowhere)' : 'in flight (a kink or a fork in its track)'}: ${symOf(id)} → ${prods.map(symOf).join(' + ')}.`);
  c.depth++;
  for (const [i, pid] of prods.entries()) {
    const v = lab[i];
    fly(c, pid, x, y, Math.atan2(v.y, v.x), Math.hypot(v.x, v.y), t0 + 0.05, `From the decay ${c.decays[c.decays.length - 1]}.`);
  }
  c.depth--;
}

/** A particle that has stopped in the liquid. */
function atRest(c: Ctx, id: string, x: number, y: number, t0: number) {
  const t = t0 + 0.25;
  const decayRest = (prods: string[], what: string) => {
    const vs = nBody(mass(id), prods.map(mass), c.rnd);
    c.vertex?.push({ x, y, label: `${symOf(id)} → ${prods.map(symOf).join(' ')}` });
    c.decays.push(`${symOf(id)} → ${prods.map(symOf).join(' + ')} (at rest)`);
    c.what.push(what);
    c.depth++;
    for (const [i, pid] of prods.entries()) fly(c, pid, x, y, Math.atan2(vs[i].y, vs[i].x), Math.hypot(vs[i].x, vs[i].y), t, 'From a decay at rest.');
    c.depth--;
  };
  const ms = modes(id, '');
  if (id === 'anti-e') {
    // a stopped positron annihilates with an electron: two 511 keV photons back to back
    const a = c.rnd() * Math.PI * 2;
    c.vertex?.push({ x, y, label: 'e⁺e⁻ → γγ' });
    c.decays.push('e⁺ + e⁻ → γ + γ (at rest)');
    c.what.push('The positron slowed to a stop and annihilated with an electron: two 0.511 MeV photons back to back (no tracks).');
    c.depth++;
    fly(c, 'gamma', x, y, a, 0.511, t, 'From positron annihilation.');
    fly(c, 'gamma', x, y, a + Math.PI, 0.511, t, 'From positron annihilation.');
    c.depth--;
  } else if (id === 'anti-p') {
    const prods = chooseMode(c, [[0.35, ['pi+', 'anti-pi+', 'pi+', 'anti-pi+', 'pi0']], [0.25, ['pi+', 'anti-pi+', 'pi0', 'pi0']], [0.2, ['pi+', 'anti-pi+', 'pi+', 'anti-pi+']], [0.2, ['pi+', 'anti-pi+', 'pi0', 'pi0', 'pi0']]]);
    const vs = nBody(2 * mass('p'), prods.map(mass), c.rnd);
    c.vertex?.push({ x, y, label: 'p̄p → pions' });
    c.decays.push(`p̄ + p → ${prods.map(symOf).join(' + ')} (at rest)`);
    c.what.push('The antiproton stopped and annihilated with a proton of the liquid: 1.88 GeV of rest energy became a star of pions.');
    c.depth++;
    for (const [i, pid] of prods.entries()) fly(c, pid, x, y, Math.atan2(vs[i].y, vs[i].x), Math.hypot(vs[i].x, vs[i].y), t, 'From an antiproton annihilating at rest.');
    c.depth--;
  } else if (id === 'anti-K+') {
    const prods = chooseMode(c, [[0.45, ['Sigma+', 'anti-pi+']], [0.25, ['Sigma-', 'pi+']], [0.2, ['Sigma0', 'pi0']], [0.1, ['Lambda', 'pi0']]]);
    const M = mass('anti-K+') + mass('p');
    const vs = nBody(M, prods.map(mass), c.rnd);
    c.vertex?.push({ x, y, label: `K⁻p → ${prods.map(symOf).join(' ')}` });
    c.decays.push(`K⁻ + p → ${prods.map(symOf).join(' + ')} (at rest)`);
    c.what.push('The K⁻ stopped and was captured by a proton, making a hyperon and a pion.');
    c.depth++;
    for (const [i, pid] of prods.entries()) fly(c, pid, x, y, Math.atan2(vs[i].y, vs[i].x), Math.hypot(vs[i].x, vs[i].y), t, 'From K⁻ capture at rest.');
    c.depth--;
  } else if (id === 'Sigma-' || id === 'Xi-' || id === 'Omega-') {
    c.what.push(`The ${symOf(id)} stopped and was captured by a proton: its track just ends.`);
  } else if (id === 'anti-pi+') {
    c.what.push('The π⁻ stopped and was captured by a proton (π⁻p → nγ or nπ⁰): no charged particle comes out, so its track just ends.');
  } else if (id === 'pi+' || id === 'K+' || id === 'mu' || id === 'anti-mu' || id === 'tau' || id === 'anti-tau' || id === 'Sigma+' || id === 'anti-Sigma-') {
    if (ms) decayAt2(c, id, x, y, t, decayRest);
  } else if (id === 'p' || id === 'e') {
    // stable: it just stops
  } else if (ms) decayAt2(c, id, x, y, t, decayRest);
}
function decayAt2(c: Ctx, id: string, x: number, y: number, t: number, decayRest: (prods: string[], what: string) => void) {
  const prods = chooseMode(c, modes(id, '')!);
  void x; void y; void t;
  decayRest(prods, `${symOf(id)} came to rest and decayed: ${symOf(id)} → ${prods.map(symOf).join(' + ')}.${id === 'pi+' ? ' The μ⁺ always gets the same 4.1 MeV, so its track is always the same short length.' : ''}`);
}

/** Run one collision with this set-up. */
export function collide(s: Setup): Result {
  const rnd = seeded(s.seed), g = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
  const med = s.heavy ? HEAVY : HYDROGEN;
  const headOn = s.target === 'beam';
  const struck = s.target === 'beam' ? s.beam2 : s.target === 'd' ? (rnd() < 0.5 ? 'p' : 'n') : 'p';
  const a = s.beam, b = struck;
  const pa = s.pb, pb2 = headOn ? s.pb2 : 0;
  const W = sqrtS(a, pa, b, pb2, headOn);
  const { open, closed } = channels(a, b, W, !headOn);
  const ctx: Ctx = { rnd, g, B: BUBBLE_B, loss: med.loss, X0: med.X0, box: CHAMBER, tracks: [], vertex: [], what: [], decays: [], depth: 0, dur: 0, esc: {} };
  const vx = headOn ? 0 : -14, vy = headOn ? 0 : 0;
  const tv = 0.9;   // when the beam reaches the vertex
  const ma = mass(a), mb = mass(b);
  const Ea = Math.sqrt(pa * pa + ma * ma), Eb = headOn ? Math.sqrt(pb2 * pb2 + mb * mb) : mb;
  const initial = [a, b];
  const Pin: [number, number] = [pa - pb2, 0];

  // the incoming beam(s), traced backwards from the vertex so they arrive exactly there with exactly this momentum
  const incoming = (id: string, p: number, dir: 1 | -1, label: string) => {
    const q = qOf(id), m = mass(id);
    if (q === 0) {
      const len = dir > 0 ? vx - CHAMBER.x0 : CHAMBER.x1 - vx;
      const n = neutral(id, nameOf(id), dir > 0 ? CHAMBER.x0 : CHAMBER.x1, vy, dir > 0 ? 0 : Math.PI, len, p, tv - len / vDraw(p, m), `${label} Neutral, so it leaves no track: you only see where it hit something.`, vDraw(p, m));
      ctx.tracks.push(n.track);
      return;
    }
    const r = trace({ pid: id, name: nameOf(id), q: -q, m, x: vx, y: vy, ang: dir > 0 ? Math.PI : 0, p, B: BUBBLE_B, loss: -med.loss, t0: 0, box: CHAMBER, maxLen: 60, v: vDraw(p, m),
      why: `${SIDE(q)} ${label} Momentum at the collision ${fmtP(p)}.` });
    const tr = r.track;
    tr.q = q; tr.pts.reverse();
    const tEnd = tr.pts[0].t;
    void tEnd;
    for (const pt of tr.pts) pt.t = tv - pt.t;
    ctx.tracks.push(tr);
  };
  incoming(a, pa, 1, 'A beam particle from the accelerator, coming in from the left.');
  if (headOn) incoming(s.beam2, pb2, -1, 'The second beam, coming the other way.');
  const t0 = Math.min(...ctx.tracks.flatMap((t) => [t.pts[0]?.t ?? 0]));
  if (t0 < 0) for (const t of ctx.tracks) for (const pt of t.pts) pt.t -= t0;
  const tV = tv - Math.min(0, t0);

  const base: Omit<Result, 'ev'> = { ok: false, initial, final: [], channel: null, W, thr: 0, open, closed, rows: [], Ein: Ea + Eb, Eout: 0, Pin, Pout: [0, 0], struck: s.target === 'd' ? struck : undefined };
  const evOf = (title: string, eq: string): BEvent => {
    const esc = Object.entries(ctx.esc);
    if (esc.length) ctx.what.push(`Left the chamber unseen (no charge, no track): ${esc.map(([k, n]) => (n > 1 ? `${n} × ${k}` : k)).join(', ')}.${ctx.esc['γ'] ? ` Photons in ${s.heavy ? 'heavy liquid convert within about ' + fmtL((9 / 7) * HEAVY.X0) : 'liquid hydrogen travel about ' + fmtL((9 / 7) * HYDROGEN.X0) + ' on average before converting, so most escape'}.` : ''}`);
    return ({
    id: 'collide', name: title, title, equation: eq, what: ctx.what, checks: [], momentum: '', tracks: ctx.tracks, vertex: ctx.vertex, dur: Math.max(ctx.dur, tV) + 0.4,
  }); };
  if (!open.length) {
    ctx.what.push(`√s = ${(W / 1000).toPrecision(3)} GeV is not enough to make anything: nothing happens.`);
    return { ...base, message: 'No reaction is possible at this energy.', ev: evOf('Nothing happens', `${text(initial)}: no reaction`) };
  }
  // the channel: the one asked for, or one chosen by weight
  let ch = s.chan !== 'auto' ? open.find((c) => c.key === s.chan) ?? null : null;
  if (!ch) { let u = rnd(); ch = open[open.length - 1]; for (const c of open) { if ((u -= c.w) <= 0) { ch = c; break; } } }

  if (ch.kind === 'through') {
    // nothing hard happens: the beam carries on across the chamber
    ctx.tracks.length = 0;
    const startX = CHAMBER.x0;
    fly(ctx, a, startX, 0, 0, pa, 0, 'A beam particle that passed straight through without hitting anything: it only ionised the liquid.');
    ctx.what.unshift(`The ${get(a).name} passed through without a hard collision. All you see is its ionisation, and the δ-ray electrons it knocked out of atoms on the way.`);
    return { ...base, ok: true, final: initial, channel: ch, rows: check(initial, initial).rows, Eout: Ea + Eb, Pout: Pin, thr: 0, ev: evOf(ch.label, `${symOf(a)} passes through the liquid`) };
  }

  // the final state at the vertex, made in the centre-of-mass frame and boosted to the lab
  let fin = ch.ids;
  let initForCheck = initial;
  let Etot = Ea + Eb, Px = Pin[0];
  if (ch.kind === 'annihilation' && a === 'anti-e' && !headOn && b !== 'e') {
    // in flight with an atomic electron (at rest): the electron is the target, not the proton
    initForCheck = ['anti-e', 'e'];
    Etot = Ea + 0.511; Px = pa;
  }
  const Wv = Math.sqrt(Math.max(0, Etot * Etot - Px * Px));
  const ms = fin.map(mass);
  let cm: V[];
  if (ch.kind === 'pair' && fin.length === 3) {
    // γ p → e⁺e⁻ p: the pair goes forwards, the proton barely recoils (an e⁺e⁻ "system" of small mass, then split)
    const Mee = 1.022 + Math.min(Wv - ms[2] - 1.0221, Math.abs(g()) * 6 + rnd() * 2);
    const two = nBody(Wv, [Mee, ms[2]], rnd, () => g() * 0.04);
    const ee = nBody(Mee, [ms[0], ms[1]], rnd);
    const bx = two[0].x / two[0].E, by = two[0].y / two[0].E;
    cm = [boost(ee[0], bx, by), boost(ee[1], bx, by), two[1]];
  } else if ((ch.kind === 'elastic' || ch.kind === 'compton') && fin.length === 2) {
    // elastic scattering prefers small angles
    const order2 = fin[0] === initial[0] ? fin : [fin[1], fin[0]];
    const two = nBody(Wv, order2.map(mass), rnd, (r) => (r() < 0.5 ? 1 : -1) * Math.min(Math.PI, -0.35 * Math.log(1 - r() * 0.999)));
    fin = order2; cm = two;
  } else cm = nBody(Wv, ms, rnd);
  const bx = Px / Etot;
  const lab = cm.map((v) => boost(v, bx, 0));
  const Eout = lab.reduce((x, v) => x + v.E, 0), Pout: [number, number] = [lab.reduce((x, v) => x + v.x, 0), lab.reduce((x, v) => x + v.y, 0)];

  ctx.vertex?.push({ x: vx, y: vy, label: ch.kind === 'elastic' ? 'elastic' : 'collision' });
  if (ch.note) ctx.what.unshift(ch.note);
  else ctx.what.unshift(`The ${get(a).name} hit ${headOn ? 'the oncoming ' + get(b).name : 'a ' + (b === 'n' ? 'neutron' : 'proton')} and its energy made new particles: ${text(fin)}. ΔE = c²Δm: the kinetic energy of the collision became rest mass.`);
  if (s.target === 'd') {
    const spec = struck === 'p' ? 'n' : 'p';
    ctx.what.push(`The deuteron is a proton and a neutron; the beam hit the ${struck === 'p' ? 'proton' : 'neutron'}. The ${spec === 'p' ? 'proton' : 'neutron'} was only a spectator${spec === 'p' ? ', recoiling slowly: a very short, thick stub' : ', and leaves no track'}.`);
    const ps = Math.abs(g()) * 60 + 15;
    fly(ctx, spec, vx, vy, rnd() * Math.PI * 2, ps, tV, 'A spectator from the deuteron, recoiling slowly.');
  }
  const elasticTarget = ch.kind === 'elastic' && !headOn;
  for (const [i, id] of fin.entries()) {
    const v = lab[i];
    const p = Math.hypot(v.x, v.y);
    const origin = elasticTarget && i === 1 ? 'The target proton, knocked out of its atom by the collision.' : `Made at the collision vertex (${ch.kind === 'elastic' ? 'it scattered there' : 'reaction ' + text(initForCheck) + ' → ' + text(fin)}).`;
    fly(ctx, id, vx, vy, Math.atan2(v.y, v.x), p, tV, origin);
  }
  const rows = check(initForCheck, fin).rows;
  const thr = fin.reduce((x, id) => x + mass(id), 0);
  return {
    ...base, ok: true, final: fin, channel: ch, rows, Eout, Pout, thr, initial: initForCheck,
    Ein: Etot, Pin: [Px, 0],
    ev: evOf(ch.label, `${text(initForCheck)} → ${text(fin)}${ctx.decays.length ? ';  then ' + ctx.decays.join(',  ') : ''}`),
  };
}

export const BEAMS: string[] = ['p', 'anti-p', 'n', 'pi+', 'anti-pi+', 'K+', 'anti-K+', 'e', 'anti-e', 'mu', 'anti-mu', 'gamma', 'Lambda', 'Sigma-', 'Sigma+'];
export const describe = (p: Particle) => p.name;
