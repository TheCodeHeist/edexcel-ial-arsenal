/* Waves Lab, Photons tab: the numbers behind the photoelectric effect, atomic energy levels and the EM spectrum.

   Work functions are the usual textbook values (they vary by ±0.1–0.2 eV with the surface and the source). Energy
   levels are real: hydrogen from −13.6/n² eV; sodium and mercury from the NIST atomic spectra tables, measured from
   the ionisation level (0 eV), rounded to 0.01 eV. Every line wavelength is worked out from the levels with the
   data-sheet h, c and e, so the figures shown agree with an exam calculation (to 3 s.f.), not to the last 0.1 nm. */

import { C, H, E, ME } from './consts';

export interface Metal { id: string; name: string; sym: string; phi: number; note?: string }
export const METALS: Metal[] = [
  { id: 'cs', name: 'Caesium', sym: 'Cs', phi: 2.1, note: 'used in photocells: visible light frees electrons' },
  { id: 'k', name: 'Potassium', sym: 'K', phi: 2.3 },
  { id: 'na', name: 'Sodium', sym: 'Na', phi: 2.28 },
  { id: 'ca', name: 'Calcium', sym: 'Ca', phi: 2.87 },
  { id: 'mg', name: 'Magnesium', sym: 'Mg', phi: 3.68 },
  { id: 'zn', name: 'Zinc', sym: 'Zn', phi: 4.3, note: 'the classic electroscope demonstration: only ultraviolet works' },
  { id: 'cu', name: 'Copper', sym: 'Cu', phi: 4.7 },
  { id: 'pt', name: 'Platinum', sym: 'Pt', phi: 5.65 },
];
export const metal = (id: string) => METALS.find((m) => m.id === id) ?? METALS[0];

/** Photon energy in J for a wavelength in nm. */
export const photonJ = (nm: number) => (H * C) / (nm * 1e-9);
export const photonEV = (nm: number) => photonJ(nm) / E;
export const freq = (nm: number) => C / (nm * 1e-9);
/** Threshold frequency (Hz) and wavelength (nm) for a work function in eV. */
export const f0 = (phi: number) => (phi * E) / H;
export const nm0 = (phi: number) => ((H * C) / (phi * E)) * 1e9;
/** Maximum kinetic energy in eV (negative: no emission). */
export const ekMax = (nm: number, phi: number) => photonEV(nm) - phi;
export const vMax = (ekEV: number) => (ekEV > 0 ? Math.sqrt((2 * ekEV * E) / ME) : 0);

/** Fraction of photoelectrons that still reach the collector against a stopping p.d. V (a simple model of the spread of
    kinetic energies below the maximum: most electrons come from below the surface and lose some energy on the way). */
export const reachFrac = (ekEV: number, V: number) => (ekEV <= 0 ? 0 : V <= 0 ? 1 : V >= ekEV ? 0 : (1 - V / ekEV) ** 2);
/** Quantum efficiency assumed: 1 photon in 100 frees an electron. */
export const QE = 0.01;

/** Sample one electron's kinetic energy (eV) with the distribution used by reachFrac: P(K > x) = (1 − x/K_max)². */
export const sampleKE = (ekEV: number) => ekEV * (1 - Math.sqrt(Math.random()));

/* ---------- the electromagnetic spectrum ---------- */
export interface Band { name: string; lo: number; hi: number; use: string }   // wavelengths in m
export const BANDS: Band[] = [
  { name: 'γ rays', lo: 1e-14, hi: 1e-11, use: 'from nuclei; radiotherapy, sterilising' },
  { name: 'X-rays', lo: 1e-11, hi: 1e-8, use: 'from fast electrons hitting metal; imaging bones' },
  { name: 'Ultraviolet', lo: 1e-8, hi: 4e-7, use: 'from the Sun and mercury lamps; frees electrons from zinc' },
  { name: 'Visible', lo: 4e-7, hi: 7e-7, use: 'what our eyes detect: violet (400 nm) to red (700 nm)' },
  { name: 'Infrared', lo: 7e-7, hi: 1e-3, use: 'from anything warm; remote controls, thermal imaging' },
  { name: 'Microwaves', lo: 1e-3, hi: 0.1, use: 'radar, mobile phones, ovens' },
  { name: 'Radio', lo: 0.1, hi: 1e4, use: 'broadcasting; photon energy far too small to free an electron' },
];
export const bandOf = (m: number) => BANDS.find((b) => m >= b.lo && m < b.hi) ?? (m < 1e-14 ? BANDS[0] : BANDS[BANDS.length - 1]);

/* ---------- atoms ---------- */
export interface Level { e: number; name: string }   // energy / eV
export interface Atom { id: string; name: string; levels: Level[]; lines?: [number, number][]; glow: string; note: string }

const hyd: Level[] = [1, 2, 3, 4, 5, 6].map((n) => ({ e: -13.6 / (n * n), name: `n = ${n}` }));
export const ATOMS: Atom[] = [
  { id: 'h', name: 'Hydrogen', levels: hyd, glow: '#ff6a9a',
    note: 'One electron, so its levels follow a simple rule: E = −13.6 eV / n². Every pair of levels gives a line.' },
  { id: 'na', name: 'Sodium', glow: '#ffb020',
    levels: [
      { e: -5.14, name: '3s (ground)' }, { e: -3.04, name: '3p' }, { e: -1.95, name: '4s' }, { e: -1.52, name: '3d' },
      { e: -1.39, name: '4p' }, { e: -1.02, name: '5s' }, { e: -0.85, name: '4d' },
    ],
    lines: [[1, 0], [2, 1], [3, 1], [4, 0], [5, 1], [6, 1], [4, 2], [4, 3]],
    note: 'Street lamps glow yellow-orange: almost all the visible light is one line, 3p → 3s at 589 nm (really a close pair, 589.0 and 589.6 nm).' },
  { id: 'hg', name: 'Mercury', glow: '#9fb6ff',
    levels: [
      { e: -10.44, name: '6¹S₀ (ground)' }, { e: -5.77, name: '6³P₀' }, { e: -5.55, name: '6³P₁' }, { e: -4.98, name: '6³P₂' },
      { e: -3.74, name: '6¹P₁' }, { e: -2.71, name: '7³S₁' }, { e: -2.52, name: '7¹S₀' },
    ],
    lines: [[2, 0], [4, 0], [5, 1], [5, 2], [5, 3], [6, 4], [6, 2]],
    note: 'Most of a mercury lamp’s energy comes out as ultraviolet at 254 nm, which is why it is used for germicidal lamps and (with a phosphor coating) for fluorescent tubes.' },
];
export const atom = (id: string) => ATOMS.find((a) => a.id === id) ?? ATOMS[0];

/** Wavelength in nm of a transition between two levels (eV). */
export const lineNm = (a: number, b: number) => ((H * C) / (Math.abs(a - b) * E)) * 1e9;

export interface Line { hi: number; lo: number; nm: number; ev: number; strong: boolean }
/** The lines an atom shows: hydrogen every pair; other atoms the observed transitions (selection rules decide). */
export function linesOf(a: Atom): Line[] {
  const out: Line[] = [];
  const L = a.levels;
  if (a.lines) for (const [hi, lo] of a.lines) out.push({ hi, lo, ev: L[hi].e - L[lo].e, nm: lineNm(L[hi].e, L[lo].e), strong: true });
  else for (let hi = 1; hi < L.length; hi++) for (let lo = 0; lo < hi; lo++) out.push({ hi, lo, ev: L[hi].e - L[lo].e, nm: lineNm(L[hi].e, L[lo].e), strong: true });
  return out;
}
export const isObserved = (a: Atom, hi: number, lo: number) => !a.lines || a.lines.some(([x, y]) => (x === hi && y === lo) || (x === lo && y === hi));
export const VIS = [380, 750] as const;
export const visible = (nm: number) => nm >= VIS[0] && nm <= VIS[1];

/** Hydrogen series name for a lower level n (beyond the spec). */
export const seriesOf = (lo: number) => ['Lyman (ultraviolet)', 'Balmer (visible and near UV)', 'Paschen (infrared)', 'Brackett (infrared)', 'Pfund (infrared)'][lo] ?? '';

/* ---------- the two models ---------- */
export const MODELS: { q: string; wave: string; photon: string; seen: string; win: 'photon' | 'wave' | 'both' }[] = [
  { q: 'Is there a threshold frequency?', wave: 'No: any frequency should work if the light is bright enough or shines long enough.', photon: 'Yes: one photon gives all its energy hf to one electron, so hf must be at least φ.', seen: 'Yes. Below f₀ nothing is emitted, however bright the light.', win: 'photon' },
  { q: 'Does brighter light give faster electrons?', wave: 'Yes: a bigger amplitude delivers energy faster, so electrons should leave with more energy.', photon: 'No: brighter means more photons per second, each with the same hf.', seen: 'No. Intensity changes the number of electrons (the current), not Eₖ(max).', win: 'photon' },
  { q: 'Does higher frequency give faster electrons?', wave: 'No reason it should: energy depends on amplitude, not frequency.', photon: 'Yes: Eₖ(max) = hf − φ rises linearly with f.', seen: 'Yes, linearly, with gradient h for every metal.', win: 'photon' },
  { q: 'Is there a delay with dim light?', wave: 'Yes: energy spread over the whole wavefront would take seconds or more to build up in one electron.', photon: 'No: a single photon is absorbed at once.', seen: 'No measurable delay (less than 10⁻⁹ s), even in very dim light.', win: 'photon' },
  { q: 'Interference and diffraction?', wave: 'Explained: waves superpose.', photon: 'Not explained by particles alone.', seen: 'Light diffracts and interferes (Young’s slits, gratings).', win: 'wave' },
];

export const HISTORY: { y: string; who: string; what: string; model: 'wave' | 'particle' | 'both' }[] = [
  { y: '1690', who: 'Huygens', what: 'Light is a wave; every point on a wavefront is a source of wavelets. Explains refraction.', model: 'wave' },
  { y: '1704', who: 'Newton', what: 'Opticks: light is a stream of “corpuscles”, which explains straight-line travel and reflection.', model: 'particle' },
  { y: '1801', who: 'Young', what: 'The double-slit experiment: light interferes, so it must be a wave.', model: 'wave' },
  { y: '1850', who: 'Foucault', what: 'Light travels more slowly in water than in air, as the wave model predicts (Newton’s needed it faster).', model: 'wave' },
  { y: '1865', who: 'Maxwell', what: 'Light is an electromagnetic wave travelling at c = 3.00 × 10⁸ m s⁻¹.', model: 'wave' },
  { y: '1887', who: 'Hertz', what: 'Makes radio waves, confirming Maxwell; also notices ultraviolet light helps sparks jump: the photoelectric effect.', model: 'wave' },
  { y: '1900', who: 'Planck', what: 'Explains black-body radiation by assuming energy comes in quanta, E = hf.', model: 'both' },
  { y: '1905', who: 'Einstein', what: 'Light itself is quantised: photons. hf = φ + ½mv²(max) explains the photoelectric effect.', model: 'particle' },
  { y: '1913', who: 'Bohr', what: 'Electrons in atoms have discrete energy levels; line spectra come from transitions, hf = E₁ − E₂.', model: 'both' },
  { y: '1916', who: 'Millikan', what: 'Measures Eₖ(max) against f: a straight line with gradient h. Einstein confirmed (Nobel 1921).', model: 'particle' },
  { y: '1924', who: 'de Broglie', what: 'If waves can be particles, particles can be waves: λ = h/p.', model: 'both' },
  { y: '1927', who: 'Davisson, Germer, G. P. Thomson', what: 'Electrons diffract from crystals: wave–particle duality for matter too.', model: 'both' },
];
