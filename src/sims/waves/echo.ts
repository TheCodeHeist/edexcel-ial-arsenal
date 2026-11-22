/* Waves Lab · Pulse–echo (spec 55, 56). A transducer sends a short pulse into layered material. At every boundary
   some of the wave is reflected and the rest transmitted (spec 55); each echo's arrival time gives the depth of the
   boundary, d = vt/2 (the pulse goes there and back). How much detail comes back is limited by the pulse's duration
   (two reflectors closer than about half a pulse length give echoes that overlap) and by the wavelength (nothing much
   smaller than λ reflects a clear echo, and a shorter λ needs a higher frequency, which is absorbed more) (spec 56).

   The reflected fraction uses acoustic impedance Z = ρv: amplitude r = (Z₂ − Z₁)/(Z₂ + Z₁). That formula is beyond the
   spec; it is used here only so that the echoes have the right relative sizes. Only first echoes are modelled (no
   echoes of echoes). */

export interface Layer { name: string; top: number; bot: number; v: number; Z: number; col: [number, number, number] }
export interface Scenario {
  id: 'body' | 'sea';
  name: string; probe: string;
  dUnit: string; dScale: number;          // display unit for depth (cm or m) and metres per unit
  tUnit: string; tScale: number;          // display unit for time (μs or ms) and seconds per unit
  fUnit: string; fScale: number; fMin: number; fMax: number; fStep: number;
  gMin: number; gMax: number; gStep: number; gUnit: string; gScale: number;
  vAssumed: number;                       // the speed the machine assumes to turn time into depth
  layers: Layer[];
  pair: { depth: number; r: number; name: string; layer: number };
  atten: number;                          // one-way attenuation, dB per metre per (fScale) unit of frequency
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'body', name: 'Medical ultrasound', probe: 'ultrasound probe',
    dUnit: 'cm', dScale: 0.01, tUnit: 'μs', tScale: 1e-6,
    fUnit: 'MHz', fScale: 1e6, fMin: 1, fMax: 15, fStep: 0.5,
    gMin: 0.2, gMax: 5, gStep: 0.1, gUnit: 'mm', gScale: 1e-3,
    vAssumed: 1540,
    layers: [
      { name: 'fat', top: 0, bot: 0.015, v: 1450, Z: 1.38e6, col: [0.95, 0.82, 0.42] },
      { name: 'muscle', top: 0.015, bot: 0.04, v: 1580, Z: 1.7e6, col: [0.85, 0.32, 0.36] },
      { name: 'liver', top: 0.04, bot: 0.085, v: 1550, Z: 1.65e6, col: [0.62, 0.28, 0.3] },
      { name: 'bone', top: 0.085, bot: 0.1, v: 4080, Z: 7.8e6, col: [0.9, 0.9, 0.84] },
    ],
    pair: { depth: 0.062, r: 0.18, name: 'two small calcifications', layer: 2 },
    atten: 50,       // 0.5 dB per cm per MHz
  },
  {
    id: 'sea', name: 'Sonar (echo sounder)', probe: 'ship’s transducer',
    dUnit: 'm', dScale: 1, tUnit: 'ms', tScale: 1e-3,
    fUnit: 'kHz', fScale: 1e3, fMin: 10, fMax: 200, fStep: 5,
    gMin: 0.02, gMax: 1, gStep: 0.01, gUnit: 'm', gScale: 1,
    vAssumed: 1500,
    layers: [
      { name: 'sea water', top: 0, bot: 60, v: 1500, Z: 1.54e6, col: [0.16, 0.4, 0.75] },
      { name: 'sediment', top: 60, bot: 64, v: 1700, Z: 3.1e6, col: [0.62, 0.5, 0.3] },
      { name: 'rock', top: 64, bot: 70, v: 3500, Z: 8.0e6, col: [0.45, 0.43, 0.42] },
    ],
    pair: { depth: 25, r: 0.25, name: 'two fish', layer: 0 },
    atten: 0.0012,   // dB per m per kHz (rises with f; small at sonar frequencies)
  },
];

export interface Echo { depth: number; t: number; A: number; what: string; pair?: boolean }

/** One-way travel time (s) from the surface down to depth z. */
export function timeTo(sc: Scenario, z: number) {
  let t = 0;
  for (const L of sc.layers) {
    if (z <= L.top) break;
    t += (Math.min(z, L.bot) - L.top) / L.v;
  }
  return t;
}
/** Depth (m) reached after a one-way time t (s). */
export function depthAt(sc: Scenario, t: number) {
  let left = t;
  for (const L of sc.layers) {
    const dt = (L.bot - L.top) / L.v;
    if (left <= dt) return L.top + left * L.v;
    left -= dt;
  }
  return sc.layers[sc.layers.length - 1].bot;
}
export const layerAt = (sc: Scenario, z: number) => sc.layers.find((L) => z >= L.top && z < L.bot) ?? sc.layers[sc.layers.length - 1];

/** Every reflecting boundary: the layer interfaces and the two small reflectors, top to bottom, with amplitude r. */
export function boundaries(sc: Scenario, gap: number) {
  const items: { depth: number; r: number; what: string; pair?: boolean }[] = [];
  for (let i = 0; i + 1 < sc.layers.length; i++) {
    const a = sc.layers[i], b = sc.layers[i + 1];
    items.push({ depth: a.bot, r: (b.Z - a.Z) / (b.Z + a.Z), what: `${a.name} → ${b.name}` });
  }
  items.push({ depth: sc.pair.depth, r: sc.pair.r, what: `${sc.pair.name}: first`, pair: true });
  items.push({ depth: sc.pair.depth + gap, r: sc.pair.r, what: `${sc.pair.name}: second`, pair: true });
  return items.sort((x, y) => x.depth - y.depth);
}
const attenOf = (sc: Scenario, f: number, path: number) => 10 ** (-(sc.atten * (f / sc.fScale) * path) / 20);

/** Every first echo, in order of arrival, with its amplitude relative to the pulse sent. */
export function echoes(sc: Scenario, f: number, gap: number): Echo[] {
  const out: Echo[] = [];
  let through = 1;                                   // what survives the boundaries above, there and back
  for (const it of boundaries(sc, gap)) {
    out.push({ depth: it.depth, t: 2 * timeTo(sc, it.depth), A: it.r * through * attenOf(sc, f, 2 * it.depth), what: it.what, pair: it.pair });
    through *= 1 - it.r * it.r;
  }
  return out;
}
/** Relative strength of the transmitted pulse when it reaches depth z (for drawing it fade). */
export function downAmp(sc: Scenario, f: number, gap: number, z: number) {
  let a = attenOf(sc, f, z);
  for (const b of boundaries(sc, gap)) if (b.depth < z) a *= Math.sqrt(1 - b.r * b.r);
  return a;
}

/** The pulse's envelope (rises and falls over about its duration τ). */
export const env = (u: number, tau: number) => Math.exp(-((u / (0.42 * tau)) ** 2));

/** Received signal: envelope (complex sum, so overlapping echoes interfere) and the raw r.f. trace. */
export function received(list: Echo[], f: number, tau: number, t: number, bang = true) {
  let re = 0, im = 0;
  for (const e of list) {
    const g = e.A * env(t - e.t, tau);
    if (Math.abs(g) < 1e-12) continue;
    const ph = -2 * Math.PI * f * e.t;
    re += g * Math.cos(ph); im += g * Math.sin(ph);
  }
  let rf = 0;
  for (const e of list) rf += e.A * env(t - e.t, tau) * Math.sin(2 * Math.PI * f * (t - e.t));
  if (bang) { const g = env(t - tau * 0.6, tau * 1.4); re += g; rf += g * Math.sin(2 * Math.PI * f * t); }
  return { E: Math.hypot(re, im), rf };
}

/** Are the pair's two echoes resolved? The envelope must dip to under half the smaller peak between them. */
export function resolved(list: Echo[], f: number, tau: number) {
  const pr = list.filter((e) => e.pair);
  if (pr.length < 2) return { ok: true, dip: 0 };
  const only = pr;
  const t0 = pr[0].t, t1 = pr[1].t;
  if (t1 - t0 < 1e-15) return { ok: false, dip: 1 };
  const a0 = received(only, f, tau, t0, false).E, a1 = received(only, f, tau, t1, false).E;
  let mn = Infinity;
  for (let i = 1; i < 60; i++) mn = Math.min(mn, received(only, f, tau, t0 + ((t1 - t0) * i) / 60, false).E);
  const dip = mn / Math.min(a0, a1);
  return { ok: dip < 0.5, dip };
}

export const dB = (x: number) => 20 * Math.log10(Math.max(Math.abs(x), 1e-9));
