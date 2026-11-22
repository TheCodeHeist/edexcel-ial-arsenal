/* Waves Lab, Waves tab: the wave itself. One progressive wave leaves a source at x = 0 and travels in +x along a
   rope (transverse), a slinky or a column of air (both longitudinal). The far end is an absorber, so nothing comes
   back (reflections are the Standing waves tab's business).

   Displacement s(x, t) of the particle whose rest position is x:
     continuous:  s = A sin 2πf(t − t₀ − x/v)   once the front has arrived (t − t₀ > x/v), else 0
     pulse:       one half-cycle hump of the same shape, lasting T/2, for each pulse sent
   For the rope s is sideways (y); for the slinky and the air it is along x. The excess pressure in a longitudinal
   wave is proportional to −∂s/∂x: where the particles on the left are pushed right and those on the right pushed
   left (s falling with x), they crowd together: a compression. */

export type Medium = 'rope' | 'slinky' | 'air';

export interface MediumSpec {
  name: string;
  kind: 'transverse' | 'longitudinal';
  L: number;                       // length shown / m
  A: [number, number, number];     // amplitude min, max, step / m
  f: [number, number, number];     // Hz
  v: [number, number, number];     // m s⁻¹
  slow: [number, number];          // log₁₀(time scale) range
  aUnit: 'cm' | 'μm';
  examples: string;
}

export const MEDIA: Record<Medium, MediumSpec> = {
  rope: { name: 'Rope', kind: 'transverse', L: 4, A: [0.02, 0.3, 0.01], f: [0.5, 4, 0.05], v: [1, 6, 0.1], slow: [-1.5, 0], aUnit: 'cm',
    examples: 'Waves on ropes and strings, ripples on water, every electromagnetic wave (light, radio, X-rays), seismic S waves.' },
  slinky: { name: 'Slinky', kind: 'longitudinal', L: 3, A: [0.01, 0.12, 0.005], f: [0.5, 3, 0.05], v: [0.5, 3, 0.05], slow: [-1.5, 0], aUnit: 'cm',
    examples: 'A slinky pushed and pulled along its length, sound in any medium, ultrasound, seismic P waves.' },
  air: { name: 'Sound in air', kind: 'longitudinal', L: 2, A: [1e-6, 5e-5, 1e-6], f: [100, 2000, 10], v: [320, 350, 1], slow: [-4, -2], aUnit: 'μm',
    examples: 'Sound: a loudspeaker cone pushes and pulls the air next to it; the compressions and rarefactions travel at about 340 m s⁻¹.' },
};

export interface MediumSet { A: number; f: number; v: number; slow: number }
export const SETS: Record<Medium, MediumSet> = {
  rope: { A: 0.15, f: 1.25, v: 2, slow: 0 },
  slinky: { A: 0.06, f: 1, v: 1.2, slow: 0 },
  air: { A: 1e-5, f: 440, v: 340, slow: -3 },
};

export interface WaveSpec { A: number; f: number; v: number; pulse: boolean; t0: number; pulses: number[] }

/** Displacement of the particle at rest position x, at time t. */
export function disp(x: number, t: number, w: WaveSpec): number {
  const T = 1 / w.f;
  if (!w.pulse) {
    const s = t - w.t0 - x / w.v;
    return s > 0 ? w.A * Math.sin(2 * Math.PI * w.f * s) : 0;
  }
  let y = 0;
  for (const tp of w.pulses) {
    const s = t - tp - x / w.v;
    if (s > 0 && s < T / 2) y += w.A * Math.sin(2 * Math.PI * w.f * s);
  }
  return y;
}

/** ∂s/∂x at x (analytic). */
export function grad(x: number, t: number, w: WaveSpec): number {
  const T = 1 / w.f, k = (2 * Math.PI * w.f) / w.v;
  if (!w.pulse) {
    const s = t - w.t0 - x / w.v;
    return s > 0 ? -w.A * k * Math.cos(2 * Math.PI * w.f * s) : 0;
  }
  let g = 0;
  for (const tp of w.pulses) {
    const s = t - tp - x / w.v;
    if (s > 0 && s < T / 2) g += -w.A * k * Math.cos(2 * Math.PI * w.f * s);
  }
  return g;
}

/** The largest amplitude a longitudinal wave can have before neighbouring coils/layers would pass through each
    other (|∂s/∂x| = Ak must stay below 1); we keep it under 0.7 so compressions stay readable. */
export const aLimit = (f: number, v: number) => (0.7 * v) / (2 * Math.PI * f);

/** Phase difference (radians, 0 ≤ φ < 2π) between two points Δx apart on a progressive wave. */
export function phaseOf(dx: number, lambda: number) {
  const p = ((2 * Math.PI * Math.abs(dx)) / lambda) % (2 * Math.PI);
  const q = p < 0 ? p + 2 * Math.PI : p;
  return q > 2 * Math.PI - 1e-6 ? 0 : q;
}

/** Phase in words: in phase / in antiphase / quarter cycle / otherwise null. tol in fractions of a cycle. */
export function phaseWords(phi: number, tol = 0.012) {
  const c = phi / (2 * Math.PI);
  const near = (a: number) => Math.abs(c - a) < tol;
  if (near(0) || near(1)) return 'in phase';
  if (near(0.5)) return 'in antiphase';
  if (near(0.25)) return 'a quarter of a cycle apart';
  if (near(0.75)) return 'three quarters of a cycle apart';
  return null;
}

/** π-fractions for phase: 0, π/4, π/2, …, else decimals. */
export function piText(phi: number) {
  const q = phi / Math.PI;
  for (const [n, d] of [[0, 1], [1, 4], [1, 3], [1, 2], [2, 3], [3, 4], [1, 1], [5, 4], [4, 3], [3, 2], [5, 3], [7, 4], [2, 1]] as const) {
    if (Math.abs(q - n / d) < 0.004) {
      if (n === 0) return '0';
      const top = n === 1 ? 'π' : `${n}π`;
      return d === 1 ? top : `${top}/${d}`;
    }
  }
  return `${q.toFixed(2)}π`;
}

/** Amplitude in the medium's unit, e.g. "15 cm", "10 μm". */
export function aText(A: number, unit: 'cm' | 'μm') {
  return unit === 'cm' ? `${+(A * 100).toFixed(1)} cm` : `${+(A * 1e6).toFixed(0)} μm`;
}

/** A length in m, cm or mm as fits. */
export function lenText(x: number) {
  const a = Math.abs(x);
  if (a >= 0.9995) return `${+x.toPrecision(3)} m`;
  if (a >= 0.009995) return `${+(x * 100).toPrecision(3)} cm`;
  return `${+(x * 1000).toPrecision(3)} mm`;
}
/** A time in s, ms or μs as fits. */
export function timeText(x: number) {
  const a = Math.abs(x);
  if (a >= 0.9995) return `${+x.toPrecision(3)} s`;
  if (a >= 0.9995e-3) return `${+(x * 1e3).toPrecision(3)} ms`;
  return `${+(x * 1e6).toPrecision(3)} μs`;
}
