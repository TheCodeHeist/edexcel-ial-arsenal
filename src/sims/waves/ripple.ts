/* Waves Lab, Ripple tank: the physics. Everything is in centimetres on the tank floor: x across (−20 … 20), z away
   from the back wall (0 … 30). The water's height is a superposition of circular waves, each written

       h = a(r) cos(ωt − kr − ψ),   a(r) = amp / √r

   (in two dimensions a circular wave's energy spreads round a circle 2πr long, so its amplitude falls as 1/√r).

   Two sources: two dippers on one bar, the second leading the first by a phase φ (0 for a normal ripple tank).
   Gap and obstacle: a straight dipper at z = 1 cm makes plane waves; beyond the barrier the water is worked out with
   Huygens' principle, made quantitative by Kirchhoff: every point of the open part of the barrier line is a source
   of secondary wavelets, in step with the incident wave there. In two dimensions

       h(P) = √(k/2π) Σ ds · cos(ωt − k(z_b − z₀) − kr + π/4) / √r · (1 + cos θ)/2

   which is exact enough to show the spreading, the minima and the shadow, and joins smoothly onto the incident
   wave straight through a wide gap. Reflections from the barrier and the tank walls are left out (real tanks have
   sloping "beaches" round the edge to soak them up). */

export type RMode = 'two' | 'gap' | 'obstacle';
export const TANK = { x: 20, z: 30 };   // half-width, depth / cm
export const ZS = 4;                    // two-source dippers / cm
export const ZB = 11;                   // barrier line / cm
export const Z0 = 1;                    // straight dipper / cm
export const V = 0.3;                   // wave speed in the shallow water / m s⁻¹
export const MAXSRC = 128;

export interface Src { x: number; z: number; amp: number; psi: number }
export interface Setup { mode: RMode; lambda: number; d: number; phi: number; gap: number; obs: number }

/** The sources (cm) for a set-up. */
export function sources(s: Setup): { list: Src[]; rmin: number; obl: boolean } {
  const k = (2 * Math.PI) / s.lambda;
  if (s.mode === 'two') {
    const amp = Math.sqrt(s.lambda);    // amplitude 1 one wavelength from a source
    return { list: [{ x: -s.d / 2, z: ZS, amp, psi: 0 }, { x: s.d / 2, z: ZS, amp, psi: -s.phi }], rmin: 0.4 * s.lambda, obl: false };
  }
  const psi = k * (ZB - Z0) - Math.PI / 4;
  const segs: [number, number][] = s.mode === 'gap' ? [[-s.gap / 2, s.gap / 2]] : [[-TANK.x, -s.obs / 2], [s.obs / 2, TANK.x]];
  const total = segs.reduce((a, [p, q]) => a + (q - p), 0);
  const ds0 = Math.max(s.lambda / 6, total / MAXSRC);
  const list: Src[] = [];
  const c = Math.sqrt(k / (2 * Math.PI));
  for (const [p, q] of segs) {
    const n = Math.max(2, Math.ceil((q - p) / ds0));
    const ds = (q - p) / n;
    for (let i = 0; i < n && list.length < MAXSRC; i++) {
      const x = p + (i + 0.5) * ds;
      // soften the far ends of the obstacle's line so the tank's side walls don't diffract
      const edge = s.mode === 'obstacle' ? Math.min(1, (TANK.x - Math.abs(x)) / 4) : 1;
      list.push({ x, z: ZB, amp: c * ds * edge, psi });
    }
  }
  return { list, rmin: ds0 * 0.5, obl: true };
}

/** Complex amplitude of the water's motion at (x, z): h = C cos ωt + S sin ωt, amplitude √(C² + S²).
    Also the incoherent sum √Σa² (what you'd see if the sources' phases wandered at random). */
export function ampAt(x: number, z: number, s: Setup, src = sources(s)) {
  const k = (2 * Math.PI) / s.lambda;
  if (s.mode !== 'two' && z < ZB) {
    if (z < Z0) return { amp: 0, inc: 0, C: 0, S: 0 };
    const th = k * (z - Z0);
    return { amp: 1, inc: 1, C: Math.cos(th), S: Math.sin(th) };
  }
  let C = 0, S = 0, I = 0;
  for (const p of src.list) {
    const dx = x - p.x, dz = z - p.z, r = Math.max(src.rmin, Math.hypot(dx, dz));
    let a = p.amp / Math.sqrt(r);
    if (src.obl) a *= (1 + dz / r) / 2;
    const th = k * r + p.psi;
    C += a * Math.cos(th); S += a * Math.sin(th); I += a * a;
  }
  return { amp: Math.hypot(C, S), inc: Math.sqrt(I), C, S };
}

/** A hyperbola of points with r₁ − r₂ = D (S1 at −d/2, S2 at +d/2, both at z = ZS), clipped to the tank. */
export function hyperbola(D: number, d: number): [number, number][] {
  const c = d / 2, a = Math.abs(D) / 2;
  if (a >= c) return [];
  const out: [number, number][] = [];
  if (a < 1e-6) {
    for (let z = 0; z <= TANK.z; z += 0.5) out.push([0, z]);
    return out;
  }
  const b = Math.sqrt(c * c - a * a);
  const U = Math.asinh((TANK.z - ZS + 1) / b), U0 = Math.asinh((ZS + 1) / b);
  for (let i = 0; i <= 120; i++) {
    const u = -U0 + ((U + U0) * i) / 120;
    // r₁ − r₂ = D > 0: nearer S2, the right-hand branch
    const x = Math.sign(D) * a * Math.cosh(u), z = ZS + b * Math.sinh(u);
    if (Math.abs(x) <= TANK.x && z >= 0 && z <= TANK.z) out.push([x, z]);
  }
  return out;
}

/** Path differences r₁ − r₂ of the antinodal (maxima) and nodal (minima) lines, for source 2 leading by φ:
    the waves meet in step where k(r₁ − r₂) + φ = 2πn. */
export function lineSet(lambda: number, d: number, phi: number) {
  const shift = (phi / (2 * Math.PI)) * lambda;
  const max: number[] = [], min: number[] = [];
  for (let n = -40; n <= 40; n++) {
    const D = n * lambda - shift;
    if (Math.abs(D) < d) max.push(D);
    const E = (n + 0.5) * lambda - shift;
    if (Math.abs(E) < d) min.push(E);
  }
  return { max, min };
}

/** Path difference in wavelengths as words: "2λ", "3λ/2", "0.37λ". */
export function lamText(D: number, lambda: number) {
  const q = D / lambda, h = Math.round(q * 2);
  if (Math.abs(q * 2 - h) < 0.02) {
    if (h === 0) return '0';
    const s = h < 0 ? '−' : '';
    const a = Math.abs(h);
    return a % 2 === 0 ? `${s}${a / 2 === 1 ? '' : a / 2}λ` : `${s}${a === 1 ? '' : a}λ/2`;
  }
  return `${q.toFixed(2)}λ`;
}
