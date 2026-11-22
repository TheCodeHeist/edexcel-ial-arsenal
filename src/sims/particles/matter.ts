/* Particle Lab: annihilation and pair production, the two ways matter and energy turn into each other (ΔE = c²Δm).

   Everything is worked out here as plain numbers, then flown by matter3d.ts. Lengths are in cm (one world unit),
   times in real seconds, energies in MeV, on a real clock that the tab slows down by a factor of about 10⁹.

   Annihilation: a particle and its antiparticle, each with kinetic energy K, meet head-on. Total momentum is zero, so
   the two photons go off back to back with equal energies, each E = mc² + K. (A proton and an antiproton usually make
   pions instead; the spec's two-photon picture is drawn, with that noted.)

   Pair production: a γ-ray passes close to a nucleus (which takes up a little momentum but almost no energy) and
   becomes a particle and its antiparticle. It needs E ≥ 2mc²; the rest is shared as kinetic energy. In a magnetic
   field the two tracks curl opposite ways, with radius r = p/BQ, and spiral inwards as they lose energy ionising the
   liquid. A positron that stops annihilates with an electron of the liquid: two 0.511 MeV photons, which leave no
   tracks. */

import { C, E, MEV, H } from './data';

export type Who = 'e' | 'mu' | 'p' | 'n';
export const REST: Record<Who, number> = { e: 0.511, mu: 105.7, p: 938.3, n: 939.6 };  // MeV/c²
export const WHO_NAME: Record<Who, [string, string]> = {
  e: ['electron', 'positron'], mu: ['muon', 'antimuon'], p: ['proton', 'antiproton'], n: ['neutron', 'antineutron'],
};
export const WHO_SYM: Record<Who, [string, string]> = { e: ['e⁻', 'e⁺'], mu: ['μ⁻', 'μ⁺'], p: ['p', 'p̄'], n: ['n', 'n̄'] };
/** charge of the particle (the antiparticle has the opposite) */
export const CHARGE: Record<Who, number> = { e: -1, mu: -1, p: 1, n: 0 };

export const R_CH = 15;            // chamber radius / cm
export const DEDX = 0.28;          // MeV lost per cm in liquid hydrogen by a fast charged particle (minimum ionising)

/** speed (m/s) from kinetic energy, relativistic */
export function speed(K: number, m: number) { const g = 1 + K / m; return C * Math.sqrt(Math.max(0, 1 - 1 / (g * g))); }
/** momentum in MeV/c from kinetic energy, relativistic: (pc)² = K² + 2Kmc² */
export const pMeV = (K: number, m: number) => Math.sqrt(K * K + 2 * K * m);
/** radius (cm) of a track: r = p/BQ with p in SI */
export function radiusCm(pmev: number, B: number) { const p = (pmev * MEV) / C; return B > 0 ? (p / (E * B)) * 100 : Infinity; }
export const fOf = (mev: number) => (mev * MEV) / H;
export const lamOf = (mev: number) => (H * C) / (mev * MEV);

export interface Seg {
  kind: 'ball' | 'track' | 'photon' | 'ghost';     // ghost: a photon in the chamber, which leaves no track
  q: number;                                       // charge (sign only)
  name: string;                                    // symbol for the label
  pts: number[];                                   // x, z pairs (cm)
  ts: number[];                                    // real time (s) at each point
  E?: number;                                      // photon energy / MeV
}
export interface Flash { t: number; x: number; z: number; big: boolean }
export interface Event { segs: Seg[]; flashes: Flash[]; end: number; note: string; share?: number; kp?: number; km?: number }

/* ---------- annihilation ---------- */
export function annihilation(who: Who, K: number, rnd: () => number): Event {
  const m = REST[who], [a, b] = WHO_SYM[who];
  const v = Math.max(speed(K, m), 0.25 * C);       // at rest: drawn drifting together (else they would never meet on screen)
  const d0 = 6, t0 = (d0 / 100) / v;
  const line = (x0: number): Seg => ({ kind: 'ball', q: 0, name: x0 < 0 ? a : b, pts: [x0, 0, x0 * 0.02, 0], ts: [0, t0] });
  const phi = rnd() * Math.PI * 2, Eg = m + K;
  const ray = (s: number): Seg => {
    const L = R_CH, n = 60, pts: number[] = [], ts: number[] = [];
    for (let i = 0; i <= n; i++) { const r = (L * i) / n; pts.push(s * r * Math.cos(phi), s * r * Math.sin(phi)); ts.push(t0 + r / 100 / C); }
    return { kind: 'photon', q: 0, name: 'γ', pts, ts, E: Eg };
  };
  return { segs: [line(-d0), line(d0), ray(1), ray(-1)], flashes: [{ t: t0, x: 0, z: 0, big: true }], end: t0 + R_CH / 100 / C,
    note: who === 'p' || who === 'n' ? 'A real proton–antiproton (or neutron–antineutron) annihilation nearly always makes pions; two photons is the spec’s model.' : '' };
}

/* ---------- pair production ---------- */
export function pair(who: Exclude<Who, 'n'>, Eg: number, B: number, rnd: () => number): Event {
  const m = REST[who], [a, b] = WHO_SYM[who];
  const xin = -R_CH, tin = 0, t0 = -xin / 100 / C;
  const inc: Seg = { kind: 'ghost', q: 0, name: 'γ', pts: [xin, 0, 0, 0], ts: [tin, t0], E: Eg };
  // densify the incoming photon so its wiggle draws smoothly
  inc.pts = []; inc.ts = [];
  for (let i = 0; i <= 50; i++) { const x = xin + (-xin * i) / 50; inc.pts.push(x, 0); inc.ts.push(tin + (x - xin) / 100 / C); }
  if (Eg < 2 * m) return { segs: [{ ...inc, pts: inc.pts.concat(R_CH, 0), ts: inc.ts.concat(t0 + R_CH / 100 / C) }], flashes: [], end: t0 + R_CH / 100 / C, note: 'below' };
  const Kt = Eg - 2 * m;
  const s = 0.18 + 0.64 * rnd();                    // share of the kinetic energy taken by the antiparticle
  const kp = Kt * s, km = Kt - kp;
  const qA = CHARGE[who];                          // particle's charge; antiparticle has −qA
  const open = Math.min(0.5, (m / Math.max(Eg, 1e-9)) * 1.2);   // typical opening angle ~ mc²/E
  const segs: Seg[] = [inc];
  const flashes: Flash[] = [{ t: t0, x: 0, z: 0, big: false }];
  let end = t0;
  const fly = (name: string, q: number, K0: number, th0: number) => {
    const pts = [0, 0], ts = [t0];
    let x = 0, z = 0, th = th0, K = K0, t = t0;
    const ds = 0.04;
    for (let i = 0; i < 6000 && K > 0.004; i++) {
      const p = pMeV(K, m), r = radiusCm(p, B), v = speed(K, m);
      th += (q * ds) / r;                           // B up out of the floor: a positive charge turns towards +z
      x += ds * Math.cos(th); z += ds * Math.sin(th);
      t += ds / 100 / Math.max(v, 1e3);
      K -= DEDX * ds;
      if (i % 2 === 0) { pts.push(x, z); ts.push(t); }
      if (Math.hypot(x, z) > R_CH) break;
    }
    pts.push(x, z); ts.push(t);
    segs.push({ kind: 'track', q, name, pts, ts });
    end = Math.max(end, t);
    return { x, z, t, stopped: Math.hypot(x, z) <= R_CH };
  };
  fly(a, qA, km, open * (rnd() - 0.5) - open / 2);
  const anti = fly(b, -qA, kp, open * (rnd() - 0.5) + open / 2);
  if (anti.stopped) {
    flashes.push({ t: anti.t, x: anti.x, z: anti.z, big: who !== 'e' });
    if (who === 'e') {
      const phi = rnd() * Math.PI * 2;
      for (const sg of [1, -1]) {
        const pts: number[] = [], ts: number[] = [];
        for (let i = 0; i <= 30; i++) { const r = (8 * i) / 30; pts.push(anti.x + sg * r * Math.cos(phi), anti.z + sg * r * Math.sin(phi)); ts.push(anti.t + r / 100 / C); }
        segs.push({ kind: 'ghost', q: 0, name: 'γ', pts, ts, E: 0.511 });
      }
      end = Math.max(end, anti.t + 8 / 100 / C);
    }
  }
  return { segs, flashes, end, note: '', share: s, kp, km };
}
