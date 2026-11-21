/* Star Lab: constants, formulas and the named stars the course keeps returning to.

   Units follow the Edexcel data sheet: σ = 5.67 × 10⁻⁸ W m⁻² K⁻⁴, Wien's constant 2.898 × 10⁻³ m K, c = 3.00 × 10⁸ m s⁻¹.
   Exam questions give the Sun's figures themselves; we use L☉ = 3.83 × 10²⁶ W and R☉ = 6.96 × 10⁸ m.

   Each named star stores its surface temperature and radius (published values, rounded; sources differ by a few per
   cent, and more for distant supergiants). Its luminosity is worked out from L = σAT⁴, so every number on a star's
   card agrees with every other number on it, just as it would in an exam question. */

export const SIGMA = 5.67e-8;
export const WIEN = 2.898e-3;
export const C = 3.0e8;
export const G = 6.67e-11;
export const LSUN = 3.83e26;
export const RSUN = 6.96e8;
export const MSUN = 1.99e30;
export const TSUN = 5772;
export const AU = 1.5e11;
export const PC = 3.08e16;
export const LY = 9.46e15;
export const YEAR = 3.15e7;
export const MPC = PC * 1e6;

/** Luminosity in L☉ from radius in R☉ and temperature in K (L = σ4πR²T⁴, scaled to the Sun). */
export const lum = (R: number, T: number) => R * R * (T / TSUN) ** 4;
/** Radius in R☉ from luminosity in L☉ and temperature in K. */
export const radius = (L: number, T: number) => Math.sqrt(L) / (T / TSUN) ** 2;
/** Wien peak in m. */
export const peak = (T: number) => WIEN / T;
/** Black-body spectral intensity (Planck) at wavelength lam (m), arbitrary units, for the curves. */
export function planck(lam: number, T: number) {
  const h = 6.626e-34, k = 1.381e-23;
  const x = (h * C) / (lam * k * T);
  if (x > 700) return 0;
  return 1 / (lam ** 5 * (Math.exp(x) - 1));
}

/* ---------- the colour a black body looks ---------- */

/** sRGB (0–1) for a black body at T kelvin: Helland's fit to the CIE colour of Planck spectra. Good from 1000 K to 40 000 K. */
export function bbColor(T: number): [number, number, number] {
  const t = Math.max(1000, Math.min(40000, T)) / 100;
  let r: number, g: number, b: number;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
  else { r = 329.698727446 * (t - 60) ** -0.1332047592; g = 288.1221695283 * (t - 60) ** -0.0755148492; }
  if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v: number) => Math.max(0, Math.min(255, v)) / 255;
  return [c(r), c(g), c(b)];
}
export const bbCss = (T: number) => { const [r, g, b] = bbColor(T); return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`; };

/** Spectral class from surface temperature (the main-sequence boundaries). */
export function spectral(T: number): string {
  if (T >= 30000) return 'O';
  if (T >= 10000) return 'B';
  if (T >= 7500) return 'A';
  if (T >= 6000) return 'F';
  if (T >= 5200) return 'G';
  if (T >= 3700) return 'K';
  return 'M';
}
export const CLASSES: [string, number, number][] = [['O', 30000, 50000], ['B', 10000, 30000], ['A', 7500, 10000], ['F', 6000, 7500], ['G', 5200, 6000], ['K', 3700, 5200], ['M', 2400, 3700]];

/* ---------- number formatting: 3 significant figures, powers of ten written out ---------- */

const SUP: Record<string, string> = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export const sup = (n: number | string) => String(n).split('').map((c) => SUP[c] ?? c).join('');

/** 3.83 × 10²⁶ for big or small numbers, plain 3 s.f. otherwise. */
export function sci(x: number, sf = 3, lo = 1e-3, hi = 1e5): string {
  if (x === 0) return '0';
  if (!isFinite(x)) return '∞';
  const a = Math.abs(x);
  if (a >= lo && a < hi) return plain(x, sf);
  let e = Math.floor(Math.log10(a));
  let m = x / 10 ** e;
  if (Math.abs(Number(m.toPrecision(sf))) >= 10) { e++; m /= 10; }
  return `${Number(m.toPrecision(sf)).toFixed(sf - 1)} × 10${sup(e)}`;
}
/** Plain 3 s.f. with the zeros a student would keep (1.00, 25.0, 0.0256). */
export function plain(x: number, sf = 3): string {
  if (x === 0) return '0';
  const r = Number(x.toPrecision(sf));
  const d = Math.max(0, sf - 1 - Math.floor(Math.log10(Math.abs(r)) + 1e-9));
  return r.toFixed(Math.min(d, 8));
}
/** Short value for labels: no trailing zeros. */
export const short = (x: number, sf = 3) => {
  const a = Math.abs(x);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return sci(x, sf).replace(/\.?0+ ×/, ' ×');
  return String(Number(x.toPrecision(sf)));
};

/** Years in words: 4.6 billion, 12 million, 20 000. */
export function years(y: number): string {
  if (y >= 1e12) return `${short(y / 1e12, 2)} trillion years`;
  if (y >= 1e9) return `${short(y / 1e9, 2)} billion years`;
  if (y >= 1e6) return `${short(y / 1e6, 2)} million years`;
  if (y >= 1e4) return `${Math.round(y / 1e3)} 000 years`;
  if (y >= 10) return `${Math.round(y)} years`;
  if (y >= 1 / 12) return `${short(y * 12, 2)} months`;
  return `${short(y * 365, 2)} days`;
}

/* ---------- named stars ---------- */

export type Group = 'ms' | 'giant' | 'supergiant' | 'dwarf' | 'sun';

export interface Star {
  id: string;
  name: string;
  T: number;            // surface temperature / K
  R: number;            // radius / R☉
  M: number;            // mass / M☉
  d: number;            // distance / pc (0 for the Sun)
  type: string;         // spectral type as catalogued
  group: Group;
  where: string;        // constellation or companion
  note: string;         // why the course mentions it
  cepheid?: number;     // pulsation period / days
}

export const STARS: Star[] = [
  { id: 'sun', name: 'Sun', T: 5772, R: 1, M: 1, d: 0, type: 'G2 V', group: 'sun', where: 'our star',
    note: 'The reference for everything else: 1 L☉, 1 R☉, 1 M☉. About halfway through its 10-billion-year main sequence.' },
  { id: 'sirius-a', name: 'Sirius A', T: 9940, R: 1.71, M: 2.06, d: 2.64, type: 'A1 V', group: 'ms', where: 'Canis Major',
    note: 'The brightest star in the night sky: luminous and close. A main-sequence star about twice the Sun’s mass.' },
  { id: 'sirius-b', name: 'Sirius B', T: 25000, R: 0.0084, M: 1.02, d: 2.64, type: 'DA2', group: 'dwarf', where: 'companion of Sirius A',
    note: 'The classic white dwarf: hotter than Sirius A but about 1000 times less luminous, so it must be tiny, about the size of the Earth. Its orbit round Sirius A (50 years) shows it has about the Sun’s mass.' },
  { id: 'procyon-a', name: 'Procyon A', T: 6530, R: 2.05, M: 1.5, d: 3.51, type: 'F5 IV–V', group: 'ms', where: 'Canis Minor',
    note: 'A main-sequence star just starting to swell: it is beginning to leave the main sequence.' },
  { id: 'procyon-b', name: 'Procyon B', T: 7740, R: 0.012, M: 0.6, d: 3.51, type: 'DQZ', group: 'dwarf', where: 'companion of Procyon A',
    note: 'A cooler white dwarf. Same idea as Sirius B: hot, faint, so small.' },
  { id: '40-eri-b', name: '40 Eridani B', T: 16500, R: 0.0136, M: 0.57, d: 5.0, type: 'DA4', group: 'dwarf', where: 'Eridanus',
    note: 'The first white dwarf recognised (1910): white-hot yet faint, which made no sense for an ordinary star.' },
  { id: 'proxima', name: 'Proxima Centauri', T: 3042, R: 0.154, M: 0.122, d: 1.30, type: 'M5.5 V', group: 'ms', where: 'Centaurus',
    note: 'The nearest star to the Sun, with the largest parallax (0.768″). A red dwarf: too faint to see with the naked eye.' },
  { id: 'alpha-cen-a', name: 'Alpha Centauri A', T: 5790, R: 1.22, M: 1.1, d: 1.34, type: 'G2 V', group: 'ms', where: 'Centaurus',
    note: 'A near-twin of the Sun in the nearest star system.' },
  { id: 'barnard', name: 'Barnard’s Star', T: 3130, R: 0.187, M: 0.16, d: 1.83, type: 'M4 V', group: 'ms', where: 'Ophiuchus',
    note: 'A nearby red dwarf with the largest proper motion of any star. Red dwarfs live for trillions of years.' },
  { id: 'vega', name: 'Vega', T: 9600, R: 2.36, M: 2.1, d: 7.68, type: 'A0 V', group: 'ms', where: 'Lyra',
    note: 'An A-type main-sequence star once used as the zero point of the brightness scale.' },
  { id: 'spica', name: 'Spica', T: 25300, R: 7.47, M: 11.4, d: 77, type: 'B1 V', group: 'ms', where: 'Virgo',
    note: 'A hot, massive blue main-sequence star, and a spectroscopic binary: its lines split in two every 4 days. It will end as a supernova.' },
  { id: 'arcturus', name: 'Arcturus', T: 4290, R: 25.4, M: 1.08, d: 11.3, type: 'K1.5 III', group: 'giant', where: 'Boötes',
    note: 'A red giant with about the Sun’s mass: a preview of the Sun in around 5 billion years.' },
  { id: 'aldebaran', name: 'Aldebaran', T: 3900, R: 44, M: 1.16, d: 20, type: 'K5 III', group: 'giant', where: 'Taurus',
    note: 'An orange-red giant: cooler than the Sun, yet about 400 times as luminous because it is so large.' },
  { id: 'polaris', name: 'Polaris', T: 6000, R: 37.5, M: 5.4, d: 133, type: 'F7 Ib', group: 'supergiant', where: 'Ursa Minor', cepheid: 3.97,
    note: 'The Pole Star is a Cepheid variable: its brightness pulses every 3.97 days, which makes it a standard candle.' },
  { id: 'delta-cep', name: 'Delta Cephei', T: 5900, R: 44.5, M: 4.5, d: 273, type: 'F5 Ib', group: 'supergiant', where: 'Cepheus', cepheid: 5.37,
    note: 'The prototype Cepheid. Its period of 5.37 days tells you its luminosity, so its distance follows from its intensity.' },
  { id: 'betelgeuse', name: 'Betelgeuse', T: 3600, R: 764, M: 17, d: 168, type: 'M1–M2 Ia', group: 'supergiant', where: 'Orion',
    note: 'A red supergiant: if it replaced the Sun it would reach past the orbit of Mars. It will explode as a supernova, perhaps within 100 000 years.' },
  { id: 'antares', name: 'Antares', T: 3660, R: 680, M: 13, d: 170, type: 'M1.5 Iab', group: 'supergiant', where: 'Scorpius',
    note: 'Another red supergiant, the “rival of Mars” for its colour. A future supernova.' },
  { id: 'algol', name: 'Algol', T: 13000, R: 2.73, M: 3.17, d: 28, type: 'B8 V', group: 'ms', where: 'Perseus',
    note: 'The classic eclipsing binary: every 2.87 days its dimmer companion passes in front of it and it fades to a third of its brightness for a few hours.' },
  { id: 'hde226868', name: 'HDE 226868', T: 31000, R: 22, M: 41, d: 2220, type: 'O9.7 Iab', group: 'supergiant', where: 'Cygnus X-1',
    note: 'A blue supergiant orbiting an unseen 21 M☉ companion every 5.6 days. The companion is too massive to be a neutron star: Cygnus X-1, the first black hole discovered.' },
  { id: 'rigel', name: 'Rigel', T: 12100, R: 79, M: 21, d: 260, type: 'B8 Ia', group: 'supergiant', where: 'Orion',
    note: 'A blue supergiant at the top left of the HR diagram: hot and huge, about 100 000 times the Sun’s luminosity. For a star this massive the blue supergiant is its main-sequence stage; it will swell straight into a red supergiant, then explode as a supernova.' },
  { id: 'deneb', name: 'Deneb', T: 8525, R: 203, M: 19, d: 800, type: 'A2 Ia', group: 'supergiant', where: 'Cygnus',
    note: 'One of the most luminous stars visible to the naked eye; its distance is uncertain because its parallax is so small.' },
];

export const starById = (id: string) => STARS.find((s) => s.id === id);
export const lumOf = (s: { R: number; T: number }) => lum(s.R, s.T);

export const GROUP_NAME: Record<Group, string> = {
  sun: 'The Sun', ms: 'Main sequence', giant: 'Red giant', supergiant: 'Supergiant', dwarf: 'White dwarf',
};

/* ---------- standard candles ---------- */

/** Cepheid period–luminosity relation (classical Cepheids, mean luminosity): log L = 1.15 log P + 2.47, L in L☉, P in days. */
export const cepheidL = (P: number) => 10 ** (1.15 * Math.log10(P) + 2.47);
export const cepheidP = (L: number) => 10 ** ((Math.log10(L) - 2.47) / 1.15);
/** Peak luminosity of a type Ia supernova (all explode at about 1.4 M☉, so all peak at about this). */
export const SN_IA_L = 4.0e9; // L☉ (≈ 1.5 × 10³⁶ W)

/* ---------- spectral lines for redshift (laboratory wavelengths, nm) ---------- */

export const LINES: { name: string; nm: number; kind: 'H' | 'Ca' | 'Na' | 'Mg' }[] = [
  { name: 'Ca K', nm: 393.4, kind: 'Ca' },
  { name: 'Ca H', nm: 396.8, kind: 'Ca' },
  { name: 'Hδ', nm: 410.2, kind: 'H' },
  { name: 'Hγ', nm: 434.0, kind: 'H' },
  { name: 'Hβ', nm: 486.1, kind: 'H' },
  { name: 'Mg', nm: 517.3, kind: 'Mg' },
  { name: 'Na D', nm: 589.3, kind: 'Na' },
  { name: 'Hα', nm: 656.3, kind: 'H' },
];

/** The colour of visible light of wavelength nm (for drawing spectra). Outside 380–750 nm it fades to dark red/violet. */
export function nmColor(nm: number): string {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else r = 1;
  let f = 1;
  if (nm < 420) f = 0.3 + (0.7 * (nm - 380)) / 40;
  else if (nm > 700) f = 0.3 + (0.7 * (750 - nm)) / 50;
  f = Math.max(0.12, Math.min(1, f));
  const c = (v: number) => Math.round(255 * Math.max(0, Math.min(1, v)) ** 0.8 * f);
  return `rgb(${c(r)} ${c(g)} ${c(b)})`;
}

/** Read a number the way a student might type it: 3.2e6, 3.2 × 10^6, 3.2x10^6, 3.2*10^6, 3,200,000. NaN if unreadable. */
export function parseNum(s: string): number {
  const t = s.trim().replace(/,/g, '').replace(/\s+/g, '').replace(/[×xX*]10\^?/, 'e').replace(/[⁻]/g, '-')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => String('⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)));
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return NaN;
  return Number(t);
}
/** Within a fraction tol of the answer (5% by default: allows for 2–3 s.f. rounding on the way). */
export const close = (x: number, ans: number, tol = 0.05) => isFinite(x) && Math.abs(x - ans) <= Math.abs(ans) * tol;

/** Seeded random numbers (mulberry32), so a generated set of galaxies stays the same until you ask for a new one. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
