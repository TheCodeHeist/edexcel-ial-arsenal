/* Star Lab: binary stars. Two stars orbit their common centre of mass; Newton's law of gravitation and circular
   motion give the period (Kepler's third law, P² = 4π²a³ / G(M₁ + M₂)), and from it everything we can observe:
   where each star is, how fast it moves towards or away from us (Doppler shift of its spectral lines), and how much
   light reaches us when one passes in front of the other (an eclipse).

   Geometry: the orbit lies in the x–z plane of the system; we (the Earth) look along the direction
   o = (0, cos i, sin i) from far away, so i = 90° is edge-on (eclipses) and i = 0° face-on (no Doppler shift).
   Orbits are drawn circular (Sirius's is really quite eccentric). Values are published ones, rounded. */

import { G, MSUN, AU, RSUN, YEAR, C, SIGMA } from './data';

export type BodyKind = 'star' | 'giant' | 'whitedwarf' | 'blackhole';
export interface Body { name: string; M: number; R: number; T: number; kind: BodyKind }
export type SysKind = 'visual' | 'eclipsing' | 'spectroscopic' | 'typeIa' | 'xray';

export interface Sys {
  id: string;
  name: string;
  kind: SysKind;
  label: string;         // short type label
  a: number;             // separation / AU
  inc: number;           // inclination / degrees (90 = edge-on)
  bodies: [Body, Body];
  d?: number;            // distance / pc
  what: string;
  facts: string[];
  stream?: boolean;      // gas flows from bodies[0] to bodies[1]
}

export const SYSTEMS: Sys[] = [
  {
    id: 'sirius', name: 'Sirius A and B', kind: 'visual', label: 'Visual binary', a: 19.8, inc: 44, d: 2.64,
    bodies: [{ name: 'Sirius A', M: 2.06, R: 1.71, T: 9940, kind: 'star' }, { name: 'Sirius B', M: 1.02, R: 0.0084, T: 25000, kind: 'whitedwarf' }],
    what: 'A visual binary: both stars can be seen orbiting each other through a telescope. Sirius B, a white dwarf, goes round Sirius A once every 50 years. Measuring the orbit gives the masses, and that is how we know a white dwarf has the Sun’s mass in an Earth-sized ball.',
    facts: [
      'Two stars orbit their common centre of mass; the heavier star moves in the smaller circle.',
      'Gravity provides the centripetal force: GM₁M₂/a² gives P² = 4π²a³ / G(M₁ + M₂).',
      'So measuring the period and separation of a binary gives the total mass: the main way star masses are measured.',
      'M₁r₁ = M₂r₂ about the centre of mass, so the sizes of the two orbits give the mass ratio.',
    ],
  },
  {
    id: 'algol', name: 'Algol', kind: 'eclipsing', label: 'Eclipsing binary', a: 0.062, inc: 81.4, d: 28,
    bodies: [{ name: 'Algol A', M: 3.17, R: 2.73, T: 13000, kind: 'star' }, { name: 'Algol B', M: 0.7, R: 3.48, T: 4500, kind: 'giant' }],
    what: 'An eclipsing binary: we see the orbit edge-on, so each star passes in front of the other. Every 2.87 days Algol dims sharply for a few hours: the “Demon Star”. The two stars are too close together to see separately; the light curve gives them away.',
    facts: [
      'Seen edge-on, the stars take turns to block each other’s light, so the total intensity dips periodically.',
      'The deeper dip happens when the hotter star is hidden: the same area of a hotter surface emits more (P ∝ T⁴).',
      'The time between dips is the orbital period; the shapes of the dips give the stars’ sizes.',
    ],
  },
  {
    id: 'spica', name: 'Spica', kind: 'spectroscopic', label: 'Spectroscopic binary', a: 0.13, inc: 66, d: 77,
    bodies: [{ name: 'Spica A', M: 11.4, R: 7.47, T: 25300, kind: 'star' }, { name: 'Spica B', M: 7.2, R: 3.74, T: 20900, kind: 'star' }],
    what: 'A spectroscopic binary: the stars are far too close to see apart, but their spectra give them away. As they orbit, one moves towards us while the other moves away, so each spectral line splits in two and the two parts swing back and forth (the Doppler effect) every 4 days.',
    facts: [
      'Doppler effect: a star moving away has its lines redshifted, one moving towards us blueshifted: Δλ/λ ≈ v/c.',
      'The lines split and merge once per orbit, giving the period.',
      'The speeds give the mass ratio (M₁/M₂ = v₂/v₁) and, with the period, the size of the orbit and so the masses.',
    ],
  },
  {
    id: 'ia', name: 'White dwarf and companion', kind: 'typeIa', label: 'Type Ia supernova', a: 0.04, inc: 70, stream: true,
    bodies: [{ name: 'Companion (subgiant)', M: 1.0, R: 3.0, T: 5200, kind: 'giant' }, { name: 'White dwarf', M: 1.2, R: 0.008, T: 30000, kind: 'whitedwarf' }],
    what: 'A white dwarf in a close binary pulls gas off its companion. The gas spirals in through an accretion disc and piles up on the white dwarf. When its mass reaches 1.4 M☉ (the Chandrasekhar limit) electron degeneracy pressure can no longer hold it up: carbon fusion runs away and it blows itself apart as a type Ia supernova.',
    facts: [
      'A type Ia supernova is a white dwarf in a binary that reaches 1.4 M☉ by taking mass from its companion.',
      'Every one explodes at the same mass, so every one has the same peak luminosity (about 10⁹–10¹⁰ L☉): a standard candle.',
      'They are bright enough to see across the universe: used to measure the distances to far galaxies (and to discover that the expansion is accelerating).',
      'Different from type II: a type II is the core collapse of a single massive star, and its luminosity varies.',
    ],
  },
  {
    id: 'cygx1', name: 'Cygnus X-1', kind: 'xray', label: 'X-ray binary', a: 0.244, inc: 27, d: 2220, stream: true,
    bodies: [{ name: 'HDE 226868 (blue supergiant)', M: 40.6, R: 22, T: 31000, kind: 'star' }, { name: 'Black hole', M: 21.2, R: 2.95 * 21.2 * 1e3 / RSUN, T: 0, kind: 'blackhole' }],
    what: 'A blue supergiant orbits something invisible every 5.6 days. Its orbit shows that the unseen companion has about 21 times the Sun’s mass, far above the 3 M☉ limit for a neutron star, so it must be a black hole. Gas pulled from the supergiant heats to millions of kelvin in an accretion disc and glows in X-rays.',
    facts: [
      'A black hole emits no light; we find it by its gravitational effect on a companion star.',
      'From the visible star’s orbit (period and Doppler speed), Newton’s laws give the unseen companion’s mass.',
      'Above about 3 M☉ no neutron star can exist, so the companion must be a black hole.',
      'Gas falling in heats up in an accretion disc and emits X-rays: Cygnus X-1 was the first black hole found this way.',
    ],
  },
];

/* ---------- the orbit ---------- */

export const total = (s: Sys) => s.bodies[0].M + s.bodies[1].M;
/** Period in years from Kepler's third law in solar units: P² = a³ / M. */
export const periodYears = (s: Sys) => Math.sqrt(s.a ** 3 / total(s));
export const periodSeconds = (s: Sys) => periodYears(s) * YEAR;
/** Distance of each star from the centre of mass / AU. */
export const radii = (s: Sys): [number, number] => [(s.a * s.bodies[1].M) / total(s), (s.a * s.bodies[0].M) / total(s)];
/** Orbital speed of each star / m s⁻¹. */
export const speeds = (s: Sys): [number, number] => radii(s).map((r) => (2 * Math.PI * r * AU) / periodSeconds(s)) as [number, number];

/** Positions (AU) of the two stars at orbital phase φ (0–1), in the system's own frame (orbit in the x–z plane). */
export function positions(s: Sys, phi: number): [[number, number, number], [number, number, number]] {
  const [r1, r2] = radii(s), th = 2 * Math.PI * phi;
  const c = Math.cos(th), sn = Math.sin(th);
  return [[-r1 * c, 0, -r1 * sn], [r2 * c, 0, r2 * sn]];
}
const rad = (d: number) => (d * Math.PI) / 180;

/** Radial velocity of each star (m s⁻¹, positive = moving away from us) at phase φ. */
export function radial(s: Sys, phi: number): [number, number] {
  const [v1, v2] = speeds(s), th = 2 * Math.PI * phi, si = Math.sin(rad(s.inc));
  // velocity of star 2 is v2 (−sin θ, 0, cos θ); towards us is along o = (0, cos i, sin i), so receding = −v·o
  return [v1 * Math.cos(th) * si, -v2 * Math.cos(th) * si];
}

/** Overlap area of two circles of radius a and b whose centres are d apart. */
function overlap(a: number, b: number, d: number) {
  if (d >= a + b) return 0;
  if (d <= Math.abs(a - b)) return Math.PI * Math.min(a, b) ** 2;
  const x = (d * d + a * a - b * b) / (2 * d * a), y = (d * d + b * b - a * a) / (2 * d * b);
  return a * a * Math.acos(Math.max(-1, Math.min(1, x))) + b * b * Math.acos(Math.max(-1, Math.min(1, y)))
    - 0.5 * Math.sqrt(Math.max(0, (-d + a + b) * (d + a - b) * (d - a + b) * (d + a + b)));
}

/** Light received at phase φ as a fraction of both stars' total (eclipses only; no limb darkening). */
export function brightness(s: Sys, phi: number): number {
  const [p1, p2] = positions(s, phi), i = rad(s.inc);
  const sky = (p: number[]) => [p[0], p[1] * Math.sin(i) - p[2] * Math.cos(i)];      // the plane of the sky
  const depth = (p: number[]) => p[1] * Math.cos(i) + p[2] * Math.sin(i);            // towards us
  const [a, b] = s.bodies;
  const ra = (a.R * RSUN) / AU, rb = (b.R * RSUN) / AU;
  const fa = a.kind === 'blackhole' ? 0 : a.T ** 4 * ra * ra, fb = b.kind === 'blackhole' ? 0 : b.T ** 4 * rb * rb; // ∝ πR²σT⁴
  const [x1, y1] = sky(p1), [x2, y2] = sky(p2);
  const ov = overlap(ra, rb, Math.hypot(x1 - x2, y1 - y2)) / Math.PI;
  // whichever is behind loses the overlapping area of its disc
  const lost = depth(p1) < depth(p2) ? ov * a.T ** 4 : ov * b.T ** 4;
  return (fa + fb - (a.kind === 'blackhole' || b.kind === 'blackhole' ? 0 : lost)) / (fa + fb);
}

/** Luminosity of a body in W (0 for a black hole). */
export const lumW = (b: Body) => (b.kind === 'blackhole' ? 0 : SIGMA * 4 * Math.PI * (b.R * RSUN) ** 2 * b.T ** 4);

/** Total mass from the period and separation: M = 4π²a³ / GP² (kg). */
export const massFromOrbit = (s: Sys) => (4 * Math.PI ** 2 * (s.a * AU) ** 3) / (G * periodSeconds(s) ** 2);

/** The wavelength of Hα from each star at phase φ / nm. */
export const HALPHA = 656.28;
export const shifted = (s: Sys, phi: number) => radial(s, phi).map((v) => HALPHA * (1 + v / C)) as [number, number];

/** Whether both stars can be drawn to scale with a separation of 6 units (else they are drawn bigger). */
export function toScale(s: Sys) {
  return s.bodies.every((b) => {
    const real = ((b.R * RSUN) / AU) * (6 / s.a);
    const min = b.kind === 'whitedwarf' ? 0.1 : b.kind === 'blackhole' ? 0.12 : 0.35;
    return real >= min * 0.98;
  });
}

export { MSUN, AU, YEAR, C };
