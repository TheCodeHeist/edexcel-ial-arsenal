/* Kinetics Lab, Collisions: the particle box behind the 3D view, and the Maxwell–Boltzmann sums.

   A box of hard spheres. Their velocity components are drawn from a normal distribution whose spread grows as √T, so
   the speeds follow the Maxwell–Boltzmann distribution and the energies ½mv² follow the energy form of it (the curve
   in the spec). Collisions are elastic. When an A meets a B, the energy of the collision is the kinetic energy of their
   relative motion, ½μv²(rel); for equal masses that has exactly the same distribution as one molecule's energy, so the
   same curve and the same Ea line apply. If it reaches Ea they react (A + B → products); otherwise they bounce.

   Energies are in kJ mol⁻¹ on a real temperature scale (RT = 2.49 kJ mol⁻¹ at 300 K). Ea is scaled down (12 kJ mol⁻¹
   instead of the usual 50–200) so that reactions happen often enough to see; the shape of every argument is the same.

   Surface-area mode: the A particles are fixed in a solid (one lump, or the same mass as 27 small grains) and the gas
   is B (think acid particles hitting marble). Only the atoms on the outside can be hit; when one reacts it leaves and
   exposes the atom behind it. The acid is in large excess, so a B that reacts is replaced. */

import { R } from './consts';

export const BOX = 5;                 // half-width of the box (world units)
export const RAD = 0.3;               // particle radius
export const EA = 12;                 // kJ mol⁻¹, uncatalysed
export const EA_CAT = 7;              // kJ mol⁻¹, with the catalyst
export const T_REF = 300;
const SIG_REF = 1.8;                  // velocity spread per component at 300 K (world units per s)
/** kJ mol⁻¹ per unit of ½v² (m = 1) */
const KJ = (R * T_REF) / 1000 / (SIG_REF * SIG_REF);

export type Kind = 0 | 1 | 2 | 3;     // 0 A, 1 B, 2 product, 3 solid A
export interface Part { x: number; y: number; z: number; vx: number; vy: number; vz: number; k: Kind; glow: number; t: number }
export interface Flash { x: number; y: number; z: number; age: number; hit: boolean }

export interface Box {
  mode: 'gas' | 'solid';
  T: number; n: number; vol: number; lump: boolean; cat: boolean;
}

const gauss = () => { let u = 0; while (u === 0) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); };
export const sigma = (T: number) => SIG_REF * Math.sqrt(T / T_REF);
/** energy of one particle (kJ mol⁻¹) */
export const energyOf = (p: Part) => 0.5 * (p.vx * p.vx + p.vy * p.vy + p.vz * p.vz) * KJ;

/* ---------- Maxwell–Boltzmann ---------- */
/** number fraction per kJ mol⁻¹ at energy E (kJ mol⁻¹) and temperature T: f = 2√(E/π) (RT)^(−3/2) e^(−E/RT) */
export function mb(E: number, T: number) {
  const rt = (R * T) / 1000;
  return E <= 0 ? 0 : 2 * Math.sqrt(E / Math.PI) * Math.pow(rt, -1.5) * Math.exp(-E / rt);
}
function erfc(x: number) {
  const t = 1 / (1 + 0.3275911 * x);
  return t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
}
/** fraction of molecules with energy ≥ Ea */
export function fracAbove(Ea: number, T: number) {
  const x = Ea / ((R * T) / 1000);
  return Math.max(0, Math.min(1, erfc(Math.sqrt(x)) + 2 * Math.sqrt(x / Math.PI) * Math.exp(-x)));
}
/** most probable energy (the peak), ½RT */
export const peakE = (T: number) => (R * T) / 2000;

/* ---------- the box ---------- */
export class Sim {
  parts: Part[] = [];
  solid: Part[] = [];
  flashes: Flash[] = [];
  /** the times of recent events, for rates per second */
  hits: number[] = [];
  wins: number[] = [];
  now = 0;
  start = { A: 0, B: 0 };
  done = 0;                          // seconds since the reactants ran low
  cfg: Box;
  #top = BOX;                        // piston height

  constructor(cfg: Box) { this.cfg = { ...cfg }; this.reset(); }

  get top() { return this.#top; }
  get ea() { return this.cfg.cat ? EA_CAT : EA; }
  /** the piston only matters for gases; in the surface-area mode the box stays full size */
  targetTop(c = this.cfg) { return -BOX + 2 * BOX * (c.mode === 'gas' ? c.vol : 1); }

  reset() {
    const c = this.cfg, s = sigma(c.T);
    this.#top = this.targetTop();
    this.parts = []; this.solid = []; this.flashes = []; this.hits = []; this.wins = []; this.done = 0;
    const lo = -BOX + RAD, hi = this.#top - RAD;
    const place = (k: Kind) => {
      for (let tries = 0; tries < 60; tries++) {
        const p: Part = { x: (Math.random() * 2 - 1) * (BOX - RAD), y: lo + Math.random() * (hi - lo), z: (Math.random() * 2 - 1) * (BOX - RAD),
          vx: gauss() * s, vy: gauss() * s, vz: gauss() * s, k, glow: 0, t: 0 };
        if (this.#blocked(p)) continue;
        this.parts.push(p); return;
      }
    };
    if (c.mode === 'gas') {
      for (let i = 0; i < c.n; i++) place((i % 2) as Kind);
      this.start = { A: Math.ceil(c.n / 2), B: Math.floor(c.n / 2) };
    } else {
      this.#buildSolid(c.lump);
      for (let i = 0; i < c.n; i++) place(1);
      this.start = { A: this.solid.length, B: c.n };
    }
  }

  /** the same 216 atoms: one 6 × 6 × 6 lump, or 27 grains of 2 × 2 × 2 */
  #buildSolid(lump: boolean) {
    const d = 2 * RAD, y0 = -BOX + RAD;
    const add = (x: number, y: number, z: number) => this.solid.push({ x, y, z, vx: 0, vy: 0, vz: 0, k: 3, glow: 0, t: 0 });
    if (lump) {
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) for (let k = 0; k < 6; k++) add((i - 2.5) * d, y0 + j * d, (k - 2.5) * d);
    } else {
      // stirred powder: 27 grains spread through the liquid, far enough apart for the acid to reach every face
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
        const cx = (i - 1) * 3.1 + (Math.random() - 0.5) * 0.5, cy = -BOX + 1.2 + j * 2.9, cz = (k - 1) * 3.1 + (Math.random() - 0.5) * 0.5;
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let e = 0; e < 2; e++) add(cx + (a - 0.5) * d, cy + (b - 0.5) * d, cz + (e - 0.5) * d);
      }
    }
  }

  #blocked(p: Part) {
    for (const q of this.solid) if ((p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2 < (2.2 * RAD) ** 2) return true;
    return false;
  }

  /** change the settings; a new mode, particle count or solid rebuilds the box, a new T rescales the speeds */
  configure(c: Box) {
    const o = this.cfg;
    this.cfg = { ...c };
    if (c.mode !== o.mode || c.n !== o.n || c.lump !== o.lump) { this.reset(); return; }
  }

  /** exposed surface faces of the solid (for the readings): faces of atoms with no neighbour on that side */
  exposed() {
    const d = 2 * RAD, key = (x: number, y: number, z: number) => `${Math.round(x / d * 2)},${Math.round(y / d * 2)},${Math.round(z / d * 2)}`;
    const set = new Set(this.solid.map((p) => key(p.x, p.y, p.z)));
    let f = 0;
    for (const p of this.solid) for (const [a, b, c] of [[d, 0, 0], [-d, 0, 0], [0, d, 0], [0, -d, 0], [0, 0, d], [0, 0, -d]])
      if (!(b < 0 && p.y - d < -BOX) && !set.has(key(p.x + a, p.y + b, p.z + c))) f++;
    return f;
  }

  step(dt: number) {
    const c = this.cfg, ps = this.parts;
    this.now += dt;
    // the piston glides to its new height and pushes anything above it down
    const want = this.targetTop();
    this.#top += (want - this.#top) * Math.min(1, dt * 4);
    // thermostat: nudge the kinetic temperature towards T (the walls exchange energy with the surroundings)
    let ke = 0;
    for (const p of ps) ke += p.vx * p.vx + p.vy * p.vy + p.vz * p.vz;
    const s2 = sigma(c.T) ** 2;
    if (ps.length) {
      const now = ke / (3 * ps.length);
      const f = Math.sqrt(1 + (s2 / Math.max(1e-6, now) - 1) * Math.min(1, dt * 2.5));
      if (Number.isFinite(f)) for (const p of ps) { p.vx *= f; p.vy *= f; p.vz *= f; }
    }
    const sub = 2, h = dt / sub, top = this.#top, d2 = (2 * RAD) ** 2;
    const ea = this.ea;
    for (let s = 0; s < sub; s++) {
      for (const p of ps) {
        p.x += p.vx * h; p.y += p.vy * h; p.z += p.vz * h;
        if (p.x < -BOX + RAD) { p.x = -BOX + RAD; p.vx = Math.abs(p.vx); } else if (p.x > BOX - RAD) { p.x = BOX - RAD; p.vx = -Math.abs(p.vx); }
        if (p.z < -BOX + RAD) { p.z = -BOX + RAD; p.vz = Math.abs(p.vz); } else if (p.z > BOX - RAD) { p.z = BOX - RAD; p.vz = -Math.abs(p.vz); }
        if (p.y < -BOX + RAD) { p.y = -BOX + RAD; p.vy = Math.abs(p.vy); } else if (p.y > top - RAD) { p.y = top - RAD; p.vy = -Math.abs(p.vy); }
      }
      // gas–gas collisions
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i];
        for (let j = i + 1; j < ps.length; j++) {
          const b = ps[j];
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, r2 = dx * dx + dy * dy + dz * dz;
          if (r2 >= d2 || r2 < 1e-9) continue;
          const ux = a.vx - b.vx, uy = a.vy - b.vy, uz = a.vz - b.vz;
          const vn = (ux * dx + uy * dy + uz * dz);
          if (vn <= 0) continue;                    // already moving apart
          const r = Math.sqrt(r2), nx = dx / r, ny = dy / r, nz = dz / r, w = vn / r;
          // elastic, equal masses: swap the components along the line of centres
          a.vx -= w * nx; a.vy -= w * ny; a.vz -= w * nz;
          b.vx += w * nx; b.vy += w * ny; b.vz += w * nz;
          const ov = 2 * RAD - r;
          a.x -= nx * ov / 2; a.y -= ny * ov / 2; a.z -= nz * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2; b.z += nz * ov / 2;
          const pair = (a.k === 0 && b.k === 1) || (a.k === 1 && b.k === 0);
          if (c.mode === 'gas' && pair) {
            const E = 0.25 * (ux * ux + uy * uy + uz * uz) * KJ;    // ½μv² with μ = ½
            this.hits.push(this.now);
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, mz = (a.z + b.z) / 2;
            if (E >= ea) {
              a.k = 2; b.k = 2; a.glow = b.glow = 1;
              this.wins.push(this.now);
              this.flashes.push({ x: mx, y: my, z: mz, age: 0, hit: true });
            } else this.flashes.push({ x: mx, y: my, z: mz, age: 0, hit: false });
          }
        }
      }
      // gas–solid collisions (the solid does not move)
      if (this.solid.length) {
        const gone = new Set<Part>();
        for (const p of ps) {
          for (const q of this.solid) {
            if (gone.has(q)) continue;
            const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z, r2 = dx * dx + dy * dy + dz * dz;
            if (r2 >= d2 || r2 < 1e-9) continue;
            const r = Math.sqrt(r2), nx = dx / r, ny = dy / r, nz = dz / r;
            const vn = p.vx * nx + p.vy * ny + p.vz * nz;
            if (vn >= 0) continue;
            const E = energyOf(p);
            p.vx -= 2 * vn * nx; p.vy -= 2 * vn * ny; p.vz -= 2 * vn * nz;
            p.x = q.x + nx * 2 * RAD; p.y = q.y + ny * 2 * RAD; p.z = q.z + nz * 2 * RAD;
            if (p.k !== 1) break;
            this.hits.push(this.now);
            if (E >= ea) {
              gone.add(q);
              p.k = 2; p.glow = 1; p.t = this.now;
              this.wins.push(this.now);
              this.flashes.push({ x: q.x, y: q.y, z: q.z, age: 0, hit: true });
            } else this.flashes.push({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, z: (p.z + q.z) / 2, age: 0, hit: false });
            break;
          }
        }
        if (gone.size) this.solid = this.solid.filter((q) => !gone.has(q));
      }
    }
    // excess acid: a product goes back to being acid after a while
    if (c.mode === 'solid') for (const p of ps) if (p.k === 2 && this.now - p.t > 1.6) p.k = 1;
    for (const p of ps) p.glow = Math.max(0, p.glow - dt * 1.5);
    for (const f of this.flashes) f.age += dt;
    this.flashes = this.flashes.filter((f) => f.age < (f.hit ? 0.7 : 0.25));
    const cut = this.now - 4;
    while (this.hits.length && this.hits[0] < cut) this.hits.shift();
    while (this.wins.length && this.wins[0] < cut) this.wins.shift();
    // reactants used up: start again
    const left = c.mode === 'gas' ? ps.filter((p) => p.k === 0).length / Math.max(1, this.start.A) : this.solid.length / Math.max(1, this.start.A);
    if (left < (c.mode === 'gas' ? 0.15 : 0.05)) { this.done += dt; if (this.done > 2.5) this.reset(); }
  }

  /** collisions (between reactants) and successful collisions per second, over the last few seconds */
  rates() {
    const span = Math.min(4, Math.max(0.5, this.now));
    return { hits: this.hits.length / span, wins: this.wins.length / span };
  }
  counts() {
    let a = 0, b = 0, p = 0;
    for (const q of this.parts) { if (q.k === 0) a++; else if (q.k === 1) b++; else p++; }
    return { A: this.cfg.mode === 'gas' ? a : this.solid.length, B: b, P: p };
  }
  energies() { return this.parts.map(energyOf); }
}
