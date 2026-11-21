/* Particle Lab: the four accelerators. Each takes the settings on the panel and returns every number the tab shows,
   worked the way an exam answer would be (Newtonian: eV = ½mv², p = mv, r = p/BQ, f = BQ/2πm), alongside the true
   relativistic speed and momentum so the tab can say honestly when the Newtonian answer stops being right. */

import { E, C, ME, MP, H } from './data';
import { BEAMS, vClassic, vTrue, pTrue, gammaOf, type Beam } from './physics';

export type Kind = 'gun' | 'linac' | 'cyclo' | 'sync';
export const MACHINES: [Kind, string, string][] = [
  ['gun', 'Electron gun', 'Gun'], ['linac', 'Linear accelerator', 'Linac'], ['cyclo', 'Cyclotron', 'Cyclotron'], ['sync', 'Synchrotron (LHC)', 'LHC'],
];
export const NAME: Record<Kind, string> = { gun: 'Electron gun and fine-beam tube', linac: 'Linear accelerator (linac)', cyclo: 'Cyclotron', sync: 'Synchrotron: the Large Hadron Collider' };

/** Newtonian and true speeds differ by more than this fraction: say so. */
export const REL = 0.01;
/** A nucleon is about this big (m): the beam's de Broglie wavelength must be smaller to see inside one. */
export const NUCLEON = 1e-15;

/* ---------- electron gun and fine-beam tube ---------- */

/** Bulb radius and the height of the gun's exit below the centre (m): a 16 cm fine-beam tube. */
export const BULB = 0.08, GUN_Y = 0.055;

export function gun(V: number, BmT: number) {
  const KE = E * V;
  const v = vClassic(KE, ME);
  const p = ME * v;
  const B = BmT * 1e-3;
  const r = p / (E * B);
  const vt = vTrue(KE, ME);
  // does the circle fit in the bulb? it starts at the gun (0, −GUN_Y) moving sideways, centre (0, −GUN_Y + r)
  const top = -GUN_Y + 2 * r;
  return { KE, v, vt, p, B, r, lam: H / p, T: (2 * Math.PI * r) / v, fits: top < BULB * 0.96 };
}

/* ---------- linac ---------- */

export interface Tube { k: number; KE: number; vN: number; vT: number; LN: number; LT: number }
export function linac(beam: Beam, VkV: number, fMHz: number, N: number) {
  const q = Math.abs(beam.q), V = VkV * 1e3, f = fMHz * 1e6;
  const tubes: Tube[] = [];
  for (let k = 1; k <= N; k++) {
    const KE = k * q * V;
    const vN = vClassic(KE, beam.m), vT = vTrue(KE, beam.m);
    tubes.push({ k, KE, vN, vT, LN: vN / (2 * f), LT: vT / (2 * f) });
  }
  const last = tubes[tubes.length - 1];
  const firstOff = tubes.findIndex((t) => Math.abs(t.vN / t.vT - 1) > REL);
  return { q, V, f, tubes, last, half: 1 / (2 * f), firstOff: firstOff < 0 ? null : firstOff + 1, gamma: gammaOf(last.KE, beam.m), p: pTrue(last.KE, beam.m) };
}

/* ---------- cyclotron ---------- */

export function cyclo(beam: Beam, B: number, VkV: number, R: number) {
  const q = Math.abs(beam.q), m = beam.m, V = VkV * 1e3;
  const f = (B * q) / (2 * Math.PI * m);
  const vmax = (B * q * R) / m;                  // from Bqv = mv²/r at r = R
  const pmax = m * vmax;
  const KE = (B * q * R) ** 2 / (2 * m);         // ½mv²
  const crossings = KE / (q * V);                // each gap crossing adds qV
  const turns = crossings / 2;                   // two crossings per turn
  const g = gammaOf(KE, m);
  const vt = vTrue(KE, m);
  return { q, m, V, f, T: 1 / f, vmax, vt, pmax, KE, crossings, turns, g, slip: g - 1, lam: H / pmax };
}

/* ---------- synchrotron (LHC) ---------- */

/** LHC dipole bending radius and ring circumference (m). */
export const LHC_R = 2804, LHC_CIRC = 26659;
export const HIGGS_GEV = 125.2;

export function sync(EGeV: number) {
  const KE = EGeV * 1e9 * E;                    // for protons at these energies, Eₖ ≈ total energy
  const p = pTrue(KE, MP);
  const B = p / (E * LHC_R);
  const g = gammaOf(KE, MP);
  const lag = 1 / (2 * g * g);                  // 1 − v/c
  const v = C * (1 - lag);
  return { KE, p, B, g, lag, v, frev: v / LHC_CIRC, lam: H / p, pN: Math.sqrt(2 * MP * KE), coll: 2 * EGeV };
}

export const BEAM = BEAMS;

/* ---------- motion on a real clock ----------
   Every machine is turned into a plan: a list of segments in real time (s) and real distance (m). In a field-free
   region (a drift tube, a dee seen from above) the speed is constant; in a uniform electric field (a gap) the force
   F = QV/g is constant, so the momentum rises steadily, p = p₀ + Ft, and the distance covered is ΔE/F (exact, even
   near c). The 3D view only has to look up where the particle is at the current time; slowing time down is the only
   liberty taken. */

const mc2 = (m: number) => m * C * C;
const energy = (p: number, m: number) => Math.hypot(p * C, mc2(m));
/** Speed from momentum (true): v = pc²/E. */
export const vOfP = (p: number, m: number) => (p * C * C) / energy(p, m);
/** Under a constant force F for time t from momentum p0: [distance, momentum]. */
export function push(m: number, p0: number, F: number, t: number): [number, number] {
  const p = p0 + F * t;
  return [(energy(p, m) - energy(p0, m)) / F, p];
}
/** Time for a constant force F to carry a particle a distance d starting with momentum p0. */
export function pushTime(m: number, p0: number, F: number, d: number) {
  const E1 = energy(p0, m) + F * d;
  return (Math.sqrt(E1 * E1 - mc2(m) ** 2) / C - p0) / F;
}

/* electron gun: filament to anode (uniform field over d), then round the circle */
export const GUN_D = 0.032;                    // filament to anode, m (as drawn)
export interface GunPlan { tAcc: number; v: number; F: number; m: number; loop: number }
export function gunPlan(V: number, BmT: number): GunPlan {
  const F = (E * V) / GUN_D, p = pTrue(E * V, ME);
  const v = vOfP(p, ME);
  return { tAcc: p / F, v, F, m: ME, loop: (2 * Math.PI * ME) / (E * BmT * 1e-3) };
}

/* linac */
export interface LinSeg { t0: number; t1: number; x0: number; p0: number; F: number /* 0: drifting */; gap: number /* gap index, −1 in a tube */ }
export interface LinacPlan {
  m: number; f: number; half: number; g: number;
  tubes: [number, number][];      // [start, end] of each tube, m
  gaps: [number, number][];       // [start, end] of each gap, m (gap 0 is between the source and the first tube)
  tc0: number;                    // time the particle crosses the centre of gap 0
  segs: LinSeg[];
  target: number;                 // x of the target, m
  tEnd: number;                   // reaches the target
  cycle: number;                  // a whole number of periods, so the p.d. carries on smoothly when it starts again
  neg: boolean;
}
export function linacPlan(beam: Beam, VkV: number, fMHz: number, N: number): LinacPlan {
  const q = Math.abs(beam.q), m = beam.m, V = VkV * 1e3, f = fMHz * 1e6, half = 1 / (2 * f);
  const p = Array.from({ length: N + 1 }, (_, k) => (k ? pTrue(k * q * V, m) : 0));
  const v1 = vOfP(p[1], m);
  const g = 0.22 * v1 * half;                   // the gaps: a fifth of the first tube or so
  const F = (q * V) / g;
  // times to the middle of gap j and from there out
  const tIn = (j: number) => pushTime(m, p[j], F, g / 2);
  const tGap = (j: number) => (p[j + 1] - p[j]) / F;
  const tubes: [number, number][] = [], gaps: [number, number][] = [], segs: LinSeg[] = [];
  let x = 0, t = 0;
  for (let j = 0; j < N; j++) {
    // gap j
    gaps.push([x, x + g]);
    segs.push({ t0: t, t1: t + tGap(j), x0: x, p0: p[j], F, gap: j });
    t += tGap(j); x += g;
    // tube j+1: long enough that the next gap's centre is reached exactly half a period after this one's
    const v = vOfP(p[j + 1], m);
    const tOut = tGap(j) - tIn(j);
    const drift = j < N - 1 ? half - tOut - tIn(j + 1) : half - tOut;
    const L = Math.max(0.2 * g, v * drift);
    tubes.push([x, x + L]);
    segs.push({ t0: t, t1: t + L / v, x0: x, p0: p[j + 1], F: 0, gap: -1 });
    t += L / v; x += L;
  }
  const vN = vOfP(p[N], m), out = 0.6 * (tubes[N - 1][1] - tubes[N - 1][0]) + g;
  segs.push({ t0: t, t1: t + out / vN, x0: x, p0: p[N], F: 0, gap: -1 });
  const tEnd = t + out / vN;
  const cycle = Math.ceil((tEnd + 3 * half) / (2 * half)) * 2 * half;
  return { m, f, half, g, tubes, gaps, tc0: tIn(0), segs, target: x + out, tEnd, cycle, neg: beam.q < 0 };
}
/** Where the bunch is at time t (s): position (m), momentum, speed, and the gap it is in (−1 if none). */
export function linacAt(P: LinacPlan, t: number) {
  const s = P.segs.find((x) => t < x.t1) ?? P.segs[P.segs.length - 1];
  const dt = Math.max(0, Math.min(t, s.t1) - s.t0);
  let x: number, p: number;
  if (s.F) [x, p] = push(P.m, s.p0, s.F, dt), x += s.x0;
  else { p = s.p0; x = s.x0 + vOfP(p, P.m) * dt; }
  return { x, p, v: vOfP(p, P.m), gap: s.gap, done: t >= P.tEnd };
}

/* cyclotron: B everywhere between the poles; across the gap (width g) a uniform electric field adds QV */
export interface CycSeg { t0: number; t1: number; kind: 'gap' | 'dee' | 'out'; p0: number; F: number; x0: number; z: number; dir: number; cz: number; r: number; side: number; ang: number }
export interface CycloPlan { m: number; q: number; B: number; R: number; g: number; n: number; segs: CycSeg[]; tEnd: number; cycle: number; crossT: number[] }
export function cycloPlan(beam: Beam, B: number, VkV: number, R: number, gFrac = 0.03): CycloPlan {
  const q = Math.abs(beam.q), m = beam.m, V = VkV * 1e3, g = gFrac * R;
  // how many crossings fit inside the dees: stop at the last whole semicircle within R
  let n = 1;
  while (n < 200000 && pTrue((n + 1) * q * V, m) / (B * q) <= R) n++;
  const p = (k: number) => (k ? pTrue(k * q * V, m) : 0);
  const segs: CycSeg[] = [], crossT: number[] = [];
  let t = 0, z = 0;
  // first push: from the source in the middle of the gap to the edge of the right dee (half the gap, the whole QV)
  {
    const F = (q * V) / (g / 2), dt = p(1) / F;
    segs.push({ t0: t, t1: t + dt, kind: 'gap', p0: 0, F, x0: 0, z, dir: 1, cz: 0, r: 0, side: 1, ang: 0 });
    crossT.push(t + pushTime(m, 0, F, g / 4)); t += dt;
  }
  const F = (q * V) / g;
  for (let k = 1; k <= n; k++) {
    const pk = p(k), r = pk / (B * q), side = k % 2 ? 1 : -1;
    const T = (Math.PI * energy(pk, m)) / (C * C * B * q);     // half a turn: πγm/QB
    const last = k === n;
    // dee: centre at (side·g/2, z + side·r), sweeping half a turn (a quarter for the last, to the deflector)
    segs.push({ t0: t, t1: t + (last ? T / 2 : T), kind: 'dee', p0: pk, F: 0, x0: side * g / 2, z, dir: side, cz: z + side * r, r, side, ang: last ? Math.PI / 2 : Math.PI });
    t += last ? T / 2 : T;
    if (last) {
      const v = vOfP(pk, m), d = 0.45 * R;
      segs.push({ t0: t, t1: t + d / v, kind: 'out', p0: pk, F: 0, x0: side * (g / 2 + r), z: z + side * r, dir: side, cz: 0, r, side, ang: 0 });
      t += d / v;
      break;
    }
    z += side * 2 * r;
    // cross the gap the other way
    const dt = (p(k + 1) - pk) / F;
    segs.push({ t0: t, t1: t + dt, kind: 'gap', p0: pk, F, x0: side * g / 2, z, dir: -side, cz: 0, r: 0, side: -side, ang: 0 });
    crossT.push(t + pushTime(m, pk, F, g / 2));
    t += dt;
  }
  const cycle = t * 1.04;
  return { m, q, B, R, g, n, segs, tEnd: t, cycle, crossT };
}
/** Position (m, in the plane: x across the gap, z along it), momentum and progress of the cyclotron particle at t. */
export function cycloAt(P: CycloPlan, t: number) {
  // binary search: segments are in time order
  let lo = 0, hi = P.segs.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (P.segs[mid].t1 <= t) lo = mid + 1; else hi = mid; }
  const s = P.segs[lo], dt = Math.max(0, Math.min(t, s.t1) - s.t0);
  let x: number, z: number, p = s.p0;
  if (s.kind === 'gap') { const [d, pp] = push(P.m, s.p0, s.F, dt); p = pp; x = s.x0 + s.dir * d; z = s.z; }
  else if (s.kind === 'out') { x = s.x0; z = s.z + s.dir * vOfP(p, P.m) * dt; }
  else {
    const ph = (s.ang * dt) / (s.t1 - s.t0);
    // starts at (x0, z) moving in the side direction, curving towards cz
    x = s.x0 + s.side * s.r * Math.sin(ph);
    z = s.cz - s.side * s.r * Math.cos(ph);
  }
  const half = segs_index_half(P, lo);
  return { x, z, p, v: vOfP(p, P.m), r: s.kind === 'gap' ? 0 : s.r, kind: s.kind, half, done: t >= P.tEnd };
}
const segs_index_half = (P: CycloPlan, i: number) => Math.min(P.n, Math.floor((i + 1) / 2));
