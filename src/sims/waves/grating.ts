/* Waves Lab, Diffraction tab: the physics of the diffraction grating (nλ = d sin θ), of N slits compared, and of
   electron diffraction through graphite (λ = h/p). Data-sheet constants; Newtonian momentum, as the course uses. */
import { H, E, ME } from './consts';

export type LaserId = 'red' | 'green' | 'blue' | 'custom' | 'white';
export const LASERS: [LaserId, string, number][] = [['red', 'Red 650 nm', 650], ['green', 'Green 532 nm', 532], ['blue', 'Violet 405 nm', 405], ['custom', 'Any λ', 600], ['white', 'White light', 0]];
export const LPMS = [80, 100, 300, 600];

/** Slit width as a share of the spacing: sets how the orders fade (the single-slit envelope). */
const A_OVER_D = 0.37;
const sinc2 = (x: number) => (Math.abs(x) < 1e-9 ? 1 : (Math.sin(x) / x) ** 2);

export interface Order { n: number; sin: number; theta: number; I: number }
/** Every order a grating of lpm lines per mm gives at wavelength nm: nλ = d sin θ, so n ≤ d/λ. */
export function orders(nm: number, lpm: number): Order[] {
  const d = 1e-3 / lpm, lam = nm * 1e-9;
  const nmax = Math.floor(d / lam - 1e-12);
  const out: Order[] = [];
  for (let n = -nmax; n <= nmax; n++) {
    const s = (n * lam) / d;
    out.push({ n, sin: s, theta: Math.asin(s), I: sinc2(Math.PI * A_OVER_D * n) });
  }
  return out;
}
export const spacing = (lpm: number) => 1e-3 / lpm;
export const nMax = (nm: number, lpm: number) => Math.floor(spacing(lpm) / (nm * 1e-9) - 1e-12);

/** Intensity through N slits at path difference x wavelengths between neighbours, normalised to 1 at the maxima. */
export function nSlit(N: number, x: number) {
  const ph = Math.PI * x;
  const s = Math.sin(ph);
  const a = Math.abs(s) < 1e-9 ? N : Math.sin(N * ph) / s;
  return (a * a) / (N * N);
}

/* ---------- electrons ---------- */
export const GRAPHITE = [2.13e-10, 1.23e-10];       // the two plane spacings that give the two rings / m
export const TUBE_L = 0.13;                        // graphite to screen / m
export function electron(kV: number) {
  const V = kV * 1000;
  const Ek = E * V;
  const p = Math.sqrt(2 * ME * Ek);
  const v = p / ME;
  const lam = H / p;
  const rings = GRAPHITE.map((d) => {
    const s = lam / (2 * d);                          // Bragg: 2d sin θ = λ (first order); deflected by 2θ
    const th = Math.asin(Math.min(1, s));
    return { d, theta: th, r: TUBE_L * Math.tan(2 * th) };
  });
  return { V, Ek, p, v, lam, rings };
}

export interface Body { id: string; name: string; m: number }
export const BODIES: Body[] = [
  { id: 'e', name: 'Electron', m: ME },
  { id: 'p', name: 'Proton', m: 1.67e-27 },
  { id: 'n', name: 'Neutron', m: 1.675e-27 },
  { id: 'a', name: 'α particle', m: 6.64e-27 },
  { id: 'ball', name: 'Tennis ball (58 g)', m: 0.058 },
];
