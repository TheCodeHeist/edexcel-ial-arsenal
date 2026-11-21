/* Particle Lab: constants, number formatting and every particle the lab knows about.

   Constants are the ones on the Edexcel IAL data sheet (e = 1.60 × 10⁻¹⁹ C, c = 3.00 × 10⁸ m s⁻¹, mₑ = 9.11 × 10⁻³¹ kg,
   mₚ = 1.67 × 10⁻²⁷ kg, h = 6.63 × 10⁻³⁴ J s, k = 1/4πε₀ = 8.99 × 10⁹ N m² C⁻²), so worked answers match a mark scheme.
   Particle masses and lifetimes are the Particle Data Group's (2024), rounded; quark masses are only approximate
   because a quark can never be isolated and weighed.

   Every particle stores its quantum numbers for the particle itself; antiparticles are made from it by anti(), which
   flips the charge, baryon number, lepton numbers and strangeness and swaps each quark for its antiquark. `spec`
   marks what the specification names; everything else is there for completeness and labelled “beyond the spec”. */

export const E = 1.6e-19;
export const C = 3.0e8;
export const ME = 9.11e-31;
export const MP = 1.67e-27;
export const MN = 1.675e-27;
export const U = 1.66e-27;
export const H = 6.63e-34;
export const K = 8.99e9;
export const MEV = 1.6e-13;         // J
export const GEV = 1.6e-10;         // J
/** 1 MeV/c² in kg. */
export const MEVC2 = MEV / (C * C);

/* ---------- formatting (as on the exam paper: 3 s.f., powers of ten written out) ---------- */

const SUP: Record<string, string> = { '-': '⁻', '+': '⁺', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
export const sup = (n: number | string) => String(n).split('').map((c) => SUP[c] ?? c).join('');

export function plain(x: number, sf = 3): string {
  if (x === 0) return '0';
  const r = Number(x.toPrecision(sf));
  const d = Math.max(0, sf - 1 - Math.floor(Math.log10(Math.abs(r)) + 1e-9));
  return r.toFixed(Math.min(d, 8));
}
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
export const short = (x: number, sf = 3) => {
  const a = Math.abs(x);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return sci(x, sf).replace(/\.?0+ ×/, ' ×');
  return String(Number(x.toPrecision(sf)));
};
/** An energy in eV with the sensible prefix: 511 keV, 938 MeV, 6.80 TeV. */
export function eV(x: number, sf = 3): string {
  const a = Math.abs(x);
  const [d, u] = a >= 1e12 ? [1e12, 'TeV'] : a >= 1e9 ? [1e9, 'GeV'] : a >= 1e6 ? [1e6, 'MeV'] : a >= 1e3 ? [1e3, 'keV'] : [1, 'eV'];
  return `${plain(x / d, sf)} ${u}`;
}
/** A mass given in MeV/c², with the sensible prefix. */
export function massText(mev: number): string {
  if (mev === 0) return '0';
  if (mev < 1e-3) return '< 1 eV/c²';
  if (mev >= 1000) return `${short(mev / 1000, 4)} GeV/c²`;
  return `${short(mev, mev < 1 ? 3 : 4)} MeV/c²`;
}
/** A lifetime in words: stable, 880 s, 2.20 × 10⁻⁶ s. */
export function lifeText(s: number): string {
  if (!isFinite(s)) return 'stable';
  if (s >= 1) return `${short(s, 3)} s`;
  return `${sci(s)} s`;
}
/** A third as a fraction: 2 → ⅔, -1 → −⅓, 3 → 1. */
export function thirds(n: number): string {
  if (n === 0) return '0';
  const sign = n < 0 ? '−' : '+';
  const a = Math.abs(n);
  if (a % 3 === 0) return `${sign}${a / 3}`;
  const frac = a % 3 === 1 ? '⅓' : '⅔';
  const whole = Math.floor(a / 3);
  return `${sign}${whole || ''}${frac}`;
}
export const signed = (n: number) => (n === 0 ? '0' : n > 0 ? `+${n}` : `−${-n}`);

export function parseNum(s: string): number {
  const t = s.trim().replace(/,/g, '').replace(/\s+/g, '').replace(/[×xX*]10\^?/, 'e').replace(/[⁻−]/g, '-')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => String('⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)));
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return NaN;
  return Number(t);
}
export const close = (x: number, ans: number, tol = 0.05) => isFinite(x) && Math.abs(x - ans) <= Math.abs(ans) * tol;

/* ---------- the particles ---------- */

export type Family = 'quark' | 'lepton' | 'boson' | 'baryon' | 'meson';
export type Q = 'u' | 'd' | 's' | 'c' | 'b' | 't';
/** A quark or antiquark in a hadron: 'u', 'ū' written as '-u'. */
export type QSlot = Q | `-${Q}`;

export interface Particle {
  id: string;
  /** symbol: base letter(s), superscript, subscript; bar = drawn with a bar (an antiparticle) */
  sym: { b: string; sup?: string; sub?: string; bar?: boolean };
  name: string;
  family: Family;
  q3: number;          // charge in thirds of e (so quarks are whole numbers)
  b3: number;          // baryon number in thirds
  L: [number, number, number];   // lepton numbers Lₑ, L_μ, L_τ
  S: number;           // strangeness
  mass: number;        // MeV/c²
  life: number;        // mean lifetime / s (Infinity: stable)
  spin: string;        // ½, 0, 1, 3/2
  quarks?: QSlot[];    // hadrons
  mix?: string;        // a quark content that is a mixture (π⁰)
  gen?: 1 | 2 | 3;     // generation (quarks and leptons)
  force?: string;      // bosons: the force carried
  decays?: string[];   // main decays, as text
  found: string;       // when and how it was discovered
  facts: string[];
  spec: boolean;       // named in the specification (or needed for it)
  self?: boolean;      // its own antiparticle
  antiName?: string;   // the antiparticle's name if not just “anti-” + name
  antiSym?: Particle['sym'];
  antiFound?: string;
  anti?: boolean;      // this record is an antiparticle (made by anti())
}

const P = (p: Particle) => p;

export const QUARKS: Particle[] = [
  P({ id: 'u', sym: { b: 'u' }, name: 'up quark', family: 'quark', q3: 2, b3: 1, L: [0, 0, 0], S: 0, mass: 2.16, life: Infinity, spin: '½', gen: 1, spec: true,
    found: '1968, deep inelastic scattering at SLAC (proposed by Gell-Mann and Zweig, 1964)',
    facts: ['Charge +⅔e, baryon number +⅓.', 'Two up quarks and a down make a proton (uud).', 'Lightest quark: never found alone, only inside hadrons.'] }),
  P({ id: 'd', sym: { b: 'd' }, name: 'down quark', family: 'quark', q3: -1, b3: 1, L: [0, 0, 0], S: 0, mass: 4.70, life: Infinity, spin: '½', gen: 1, spec: true,
    found: '1968, deep inelastic scattering at SLAC',
    facts: ['Charge −⅓e, baryon number +⅓.', 'A neutron is udd: ⅔ − ⅓ − ⅓ = 0.', 'In β⁻ decay a down quark changes into an up quark: d → u + e⁻ + ν̄ₑ.'] }),
  P({ id: 'c', sym: { b: 'c' }, name: 'charm quark', family: 'quark', q3: 2, b3: 1, L: [0, 0, 0], S: 0, mass: 1273, life: Infinity, spin: '½', gen: 2, spec: false,
    found: '1974, the J/ψ meson (cc̄) at SLAC and Brookhaven, both at once',
    facts: ['Charge +⅔e: the second-generation copy of the up quark.', 'Its existence was predicted (1970) to fill the gap in the pattern before it was found.'] }),
  P({ id: 's', sym: { b: 's' }, name: 'strange quark', family: 'quark', q3: -1, b3: 1, L: [0, 0, 0], S: -1, mass: 93.5, life: Infinity, spin: '½', gen: 2, spec: true,
    found: '1947 (in kaons, from cosmic rays); named as a quark in 1964',
    facts: ['Charge −⅓e, strangeness −1.', 'Particles containing it (kaons, Λ, Σ, Ξ, Ω) were “strange” because they are made quickly in pairs but decay slowly.'] }),
  P({ id: 't', sym: { b: 't' }, name: 'top quark', family: 'quark', q3: 2, b3: 1, L: [0, 0, 0], S: 0, mass: 172570, life: 5e-25, spin: '½', gen: 3, spec: true,
    found: '1995, Tevatron at Fermilab (CDF and DØ), after a search of almost 20 years',
    facts: ['Predicted by the symmetry of the quark–lepton model: once the bottom quark was found, the third generation needed a partner with charge +⅔e.', 'By far the heaviest known fundamental particle, about as heavy as a gold atom.', 'Decays so fast it never forms a hadron.'] }),
  P({ id: 'b', sym: { b: 'b' }, name: 'bottom quark', family: 'quark', q3: -1, b3: 1, L: [0, 0, 0], S: 0, mass: 4183, life: Infinity, spin: '½', gen: 3, spec: false,
    found: '1977, the Υ meson (bb̄) at Fermilab',
    facts: ['Charge −⅓e: the third-generation copy of the down quark.', 'Its discovery made physicists sure a sixth quark (top) must exist.'] }),
];

export const LEPTONS: Particle[] = [
  P({ id: 'e', sym: { b: 'e', sup: '−' }, name: 'electron', family: 'lepton', q3: -3, b3: 0, L: [1, 0, 0], S: 0, mass: 0.51099895, life: Infinity, spin: '½', gen: 1, spec: true,
    antiName: 'positron', antiSym: { b: 'e', sup: '+' }, antiFound: '1932, Carl Anderson, cloud chamber photographs of cosmic rays (predicted by Dirac, 1928)',
    found: '1897, J. J. Thomson, deflecting cathode rays with electric and magnetic fields',
    facts: ['A fundamental particle: no smaller parts.', 'Rest mass 0.511 MeV/c² = 9.11 × 10⁻³¹ kg, charge −1.60 × 10⁻¹⁹ C.', 'Released from a hot metal by thermionic emission; the β⁻ particle is an electron.', 'Its antiparticle, the positron, has the same mass and charge +e.'] }),
  P({ id: 'nue', sym: { b: 'ν', sub: 'e' }, name: 'electron neutrino', antiName: 'electron antineutrino', family: 'lepton', q3: 0, b3: 0, L: [1, 0, 0], S: 0, mass: 0, life: Infinity, spin: '½', gen: 1, spec: true,
    found: '1956, Cowan and Reines, antineutrinos from the Savannah River nuclear reactor (predicted by Pauli, 1930, to save energy conservation in β decay)',
    facts: ['No charge and almost no mass (well under 1 eV/c²), so it hardly interacts: trillions pass through you every second.', 'Made in β decay: β⁻ gives an electron antineutrino, β⁺ an electron neutrino.', 'Leaves no track in any detector.'] }),
  P({ id: 'mu', sym: { b: 'μ', sup: '−' }, name: 'muon', family: 'lepton', q3: -3, b3: 0, L: [0, 1, 0], S: 0, mass: 105.6583755, life: 2.197e-6, spin: '½', gen: 2, spec: true,
    found: '1936, Anderson and Neddermeyer, cosmic-ray tracks in a cloud chamber',
    decays: ['μ⁻ → e⁻ + ν̄ₑ + ν_μ'],
    facts: ['A heavy electron: same charge, about 207 times the mass.', 'Made high in the atmosphere by cosmic rays. Living 2.2 μs, it should travel only about 660 m, yet many reach the ground 15 km below: time dilation stretches its lifetime in our frame.', 'Penetrating: it passes through metres of iron, which is how detectors pick it out.'] }),
  P({ id: 'numu', sym: { b: 'ν', sub: 'μ' }, name: 'muon neutrino', antiName: 'muon antineutrino', family: 'lepton', q3: 0, b3: 0, L: [0, 1, 0], S: 0, mass: 0, life: Infinity, spin: '½', gen: 2, spec: true,
    found: '1962, Lederman, Schwartz and Steinberger at Brookhaven: neutrinos from pion decay made muons, never electrons',
    facts: ['Comes with the muon: muon lepton number +1.', 'Made when pions decay: π⁺ → μ⁺ + ν_μ.'] }),
  P({ id: 'tau', sym: { b: 'τ', sup: '−' }, name: 'tau', family: 'lepton', q3: -3, b3: 0, L: [0, 0, 1], S: 0, mass: 1776.86, life: 2.903e-13, spin: '½', gen: 3, spec: true,
    found: '1975, Martin Perl at SLAC, in electron–positron collisions',
    decays: ['τ⁻ → μ⁻ + ν̄_μ + ν_τ', 'τ⁻ → e⁻ + ν̄ₑ + ν_τ', 'τ⁻ → π⁻ + ν_τ (and other hadrons)'],
    facts: ['The heaviest lepton, almost twice the mass of a proton, yet still fundamental.', 'Heavy enough to decay into hadrons as well as lighter leptons.'] }),
  P({ id: 'nutau', sym: { b: 'ν', sub: 'τ' }, name: 'tau neutrino', antiName: 'tau antineutrino', family: 'lepton', q3: 0, b3: 0, L: [0, 0, 1], S: 0, mass: 0, life: Infinity, spin: '½', gen: 3, spec: true,
    found: '2000, the DONUT experiment at Fermilab',
    facts: ['The last lepton to be seen directly.', 'Tau lepton number +1.'] }),
];

export const BOSONS: Particle[] = [
  P({ id: 'gamma', sym: { b: 'γ' }, name: 'photon', family: 'boson', q3: 0, b3: 0, L: [0, 0, 0], S: 0, mass: 0, life: Infinity, spin: '1', force: 'electromagnetic', self: true, spec: true,
    found: '1905, Einstein’s explanation of the photoelectric effect; confirmed by Compton scattering, 1923',
    facts: ['A quantum of electromagnetic radiation: E = hf.', 'No charge and no rest mass, so it leaves no track: a γ-ray shows up only when it makes charged particles (pair production).', 'Carries the electromagnetic force; its own antiparticle.', 'Annihilation of a particle and its antiparticle gives photons.'] }),
  P({ id: 'g', sym: { b: 'g' }, name: 'gluon', family: 'boson', q3: 0, b3: 0, L: [0, 0, 0], S: 0, mass: 0, life: Infinity, spin: '1', force: 'strong', self: true, spec: false,
    found: '1979, three-jet events at the PETRA collider, DESY',
    facts: ['Carries the strong force that holds quarks together in hadrons.', 'Never seen alone: like quarks, it is confined inside hadrons.'] }),
  P({ id: 'W', sym: { b: 'W', sup: '+' }, name: 'W boson', family: 'boson', q3: 3, b3: 0, L: [0, 0, 0], S: 0, mass: 80369, life: 3e-25, spin: '1', force: 'weak', spec: false,
    antiName: 'W⁻ boson', antiSym: { b: 'W', sup: '−' }, found: '1983, UA1 and UA2 at CERN’s SPS proton–antiproton collider',
    decays: ['W⁺ → e⁺ + νₑ', 'W⁺ → u + d̄'],
    facts: ['Carries the weak force: every β decay goes through a W.', 'In β⁻ decay: d → u + W⁻, then W⁻ → e⁻ + ν̄ₑ.', 'About 86 times the proton’s mass, which is why the weak force has such a short range.'] }),
  P({ id: 'Z', sym: { b: 'Z', sup: '0' }, name: 'Z boson', family: 'boson', q3: 0, b3: 0, L: [0, 0, 0], S: 0, mass: 91188, life: 2.6e-25, spin: '1', force: 'weak', self: true, spec: false,
    found: '1983, UA1 and UA2 at CERN',
    decays: ['Z⁰ → e⁺ + e⁻', 'Z⁰ → μ⁺ + μ⁻', 'Z⁰ → ν + ν̄'],
    facts: ['The neutral carrier of the weak force.', 'Lets neutrinos scatter without changing charge.'] }),
  P({ id: 'H', sym: { b: 'H', sup: '0' }, name: 'Higgs boson', family: 'boson', q3: 0, b3: 0, L: [0, 0, 0], S: 0, mass: 125200, life: 1.6e-22, spin: '0', force: 'gives mass', self: true, spec: false,
    found: '2012, ATLAS and CMS at CERN’s Large Hadron Collider (predicted 1964)',
    decays: ['H → γ + γ', 'H → b + b̄', 'H → Z + Z (→ four leptons)'],
    facts: ['A ripple in the Higgs field, which gives the W, Z, quarks and leptons their masses.', 'Needed collisions at 7–8 TeV: E = mc² sets how much energy is needed to make a heavy particle.'] }),
];

export const BARYONS: Particle[] = [
  P({ id: 'p', sym: { b: 'p' }, name: 'proton', family: 'baryon', quarks: ['u', 'u', 'd'], q3: 3, b3: 3, L: [0, 0, 0], S: 0, mass: 938.272, life: Infinity, spin: '½', spec: true,
    found: '1917–1919, Ernest Rutherford, knocking hydrogen nuclei out of nitrogen with α particles',
    antiFound: '1955, Chamberlain and Segrè at the Bevatron, Berkeley: built to have just enough energy to make them (p + p → p + p + p + p̄)',
    facts: ['uud: ⅔ + ⅔ − ⅓ = +1, baryon number ⅓ + ⅓ + ⅓ = 1.', 'The only stable baryon: all others decay, in the end, to a proton.', 'Rest mass 938 MeV/c² = 1.67 × 10⁻²⁷ kg: almost all of it is the energy of the quarks and gluons, not the quarks’ own masses.'] }),
  P({ id: 'n', sym: { b: 'n' }, name: 'neutron', family: 'baryon', quarks: ['u', 'd', 'd'], q3: 0, b3: 3, L: [0, 0, 0], S: 0, mass: 939.565, life: 878.4, spin: '½', spec: true,
    found: '1932, James Chadwick: radiation from beryllium hit by α particles knocked protons out of paraffin wax',
    decays: ['n → p + e⁻ + ν̄ₑ'],
    facts: ['udd: ⅔ − ⅓ − ⅓ = 0.', 'Stable inside most nuclei, but a free neutron decays (β⁻) with a mean life of about 15 minutes.', 'Slightly heavier than the proton, so it can decay into one: the 0.78 MeV difference is shared by the electron and antineutrino.'] }),
  P({ id: 'Delta++', sym: { b: 'Δ', sup: '++' }, name: 'delta plus-plus', antiName: 'anti-delta (Δ̄⁻⁻)', family: 'baryon', quarks: ['u', 'u', 'u'], q3: 6, b3: 3, L: [0, 0, 0], S: 0, mass: 1232, life: 5.6e-24, spin: '3/2', spec: false,
    found: '1952, Enrico Fermi’s group, as a peak in pion–proton scattering',
    decays: ['Δ⁺⁺ → p + π⁺'],
    facts: ['uuu: charge +2e, the only common baryon with a charge of +2.', 'Decays by the strong force in about 10⁻²³ s: too short to leave a track.'] }),
  P({ id: 'Lambda', sym: { b: 'Λ', sup: '0' }, name: 'lambda', family: 'baryon', quarks: ['u', 'd', 's'], q3: 0, b3: 3, L: [0, 0, 0], S: -1, mass: 1115.683, life: 2.617e-10, spin: '½', spec: false,
    found: '1950–51, cosmic rays: a neutral particle that left no track, then a V of two tracks',
    decays: ['Λ⁰ → p + π⁻ (64%)', 'Λ⁰ → n + π⁰ (36%)'],
    facts: ['uds: the lightest strange baryon.', 'Neutral, so invisible until it decays: in a bubble chamber it appears as a V pointing back to where it was made.', 'Made with a kaon in pairs (associated production): π⁻ + p → K⁰ + Λ⁰.'] }),
  P({ id: 'Sigma+', sym: { b: 'Σ', sup: '+' }, name: 'sigma plus', antiName: 'antisigma (Σ̄⁻, anti of Σ⁺)', family: 'baryon', quarks: ['u', 'u', 's'], q3: 3, b3: 3, L: [0, 0, 0], S: -1, mass: 1189.37, life: 8.018e-11, spin: '½', spec: false,
    found: '1953, cosmic rays in photographic emulsion',
    decays: ['Σ⁺ → p + π⁰', 'Σ⁺ → n + π⁺'],
    facts: ['uus: a proton with one u swapped for an s.'] }),
  P({ id: 'Sigma0', sym: { b: 'Σ', sup: '0' }, name: 'sigma zero', family: 'baryon', quarks: ['u', 'd', 's'], q3: 0, b3: 3, L: [0, 0, 0], S: -1, mass: 1192.642, life: 7.4e-20, spin: '½', spec: false,
    found: '1956, Brookhaven',
    decays: ['Σ⁰ → Λ⁰ + γ'],
    facts: ['Same quarks as the Λ⁰ (uds) in a higher-energy arrangement, so it decays to it electromagnetically, very fast.'] }),
  P({ id: 'Sigma-', sym: { b: 'Σ', sup: '−' }, name: 'sigma minus', antiName: 'antisigma (Σ̄⁺, anti of Σ⁻)', family: 'baryon', quarks: ['d', 'd', 's'], q3: -3, b3: 3, L: [0, 0, 0], S: -1, mass: 1197.449, life: 1.479e-10, spin: '½', spec: false,
    found: '1953, cosmic rays',
    decays: ['Σ⁻ → n + π⁻'],
    facts: ['dds. Not the antiparticle of Σ⁺: that is the anti-sigma, made of antiquarks.'] }),
  P({ id: 'Xi0', sym: { b: 'Ξ', sup: '0' }, name: 'xi zero', family: 'baryon', quarks: ['u', 's', 's'], q3: 0, b3: 3, L: [0, 0, 0], S: -2, mass: 1314.86, life: 2.9e-10, spin: '½', spec: false,
    found: '1959, Berkeley bubble chamber',
    decays: ['Ξ⁰ → Λ⁰ + π⁰'],
    facts: ['uss: strangeness −2. Called the “cascade” because it decays in steps, Ξ → Λ → p.'] }),
  P({ id: 'Xi-', sym: { b: 'Ξ', sup: '−' }, name: 'xi minus', antiName: 'anti-xi (Ξ̄⁺)', family: 'baryon', quarks: ['d', 's', 's'], q3: -3, b3: 3, L: [0, 0, 0], S: -2, mass: 1321.71, life: 1.639e-10, spin: '½', spec: false,
    found: '1952, cosmic rays (Manchester)',
    decays: ['Ξ⁻ → Λ⁰ + π⁻'],
    facts: ['dss: strangeness −2.'] }),
  P({ id: 'Omega-', sym: { b: 'Ω', sup: '−' }, name: 'omega minus', antiName: 'anti-omega (Ω̄⁺)', family: 'baryon', quarks: ['s', 's', 's'], q3: -3, b3: 3, L: [0, 0, 0], S: -3, mass: 1672.45, life: 8.21e-11, spin: '3/2', spec: false,
    found: '1964, the 80-inch bubble chamber at Brookhaven, exactly as Gell-Mann predicted in 1962',
    decays: ['Ω⁻ → Λ⁰ + K⁻', 'Ω⁻ → Ξ⁰ + π⁻'],
    facts: ['sss, strangeness −3.', 'Gell-Mann arranged the baryons in a symmetric pattern with one gap and predicted the charge, strangeness and mass of the particle to fill it: found two years later. The same reasoning later predicted the top quark.'] }),
  P({ id: 'Lambdac', sym: { b: 'Λ', sup: '+', sub: 'c' }, name: 'charmed lambda', family: 'baryon', quarks: ['u', 'd', 'c'], q3: 3, b3: 3, L: [0, 0, 0], S: 0, mass: 2286.46, life: 2.02e-13, spin: '½', spec: false,
    found: '1975–76, Brookhaven and Fermilab',
    decays: ['Λc⁺ → p + K⁻ + π⁺'],
    facts: ['udc: the lightest baryon with a charm quark.'] }),
];

export const MESONS: Particle[] = [
  P({ id: 'pi+', sym: { b: 'π', sup: '+' }, name: 'pion (positive)', family: 'meson', quarks: ['u', '-d'], q3: 3, b3: 0, L: [0, 0, 0], S: 0, mass: 139.570, life: 2.603e-8, spin: '0', spec: true,
    antiName: 'pion (negative)', antiSym: { b: 'π', sup: '−' },
    found: '1947, Cecil Powell’s group in Bristol, tracks in photographic emulsions carried up mountains (predicted by Yukawa, 1935)',
    decays: ['π⁺ → μ⁺ + ν_μ (99.99%)'],
    facts: ['ud̄: ⅔ + ⅓ = +1, baryon number ⅓ − ⅓ = 0.', 'π⁺ and π⁻ are each other’s antiparticles.', 'The lightest hadrons: the commonest particles made in high-energy collisions.'] }),
  P({ id: 'pi0', sym: { b: 'π', sup: '0' }, name: 'pion (neutral)', family: 'meson', quarks: ['u', '-u'], mix: 'uū or dd̄ (a mixture)', q3: 0, b3: 0, L: [0, 0, 0], S: 0, mass: 134.977, life: 8.43e-17, spin: '0', self: true, spec: true,
    found: '1950, Berkeley, from the pairs of γ-rays it decays into',
    decays: ['π⁰ → γ + γ (98.8%)'],
    facts: ['A mixture of uū and dd̄: its own antiparticle.', 'Decays electromagnetically into two photons in about 10⁻¹⁶ s.'] }),
  P({ id: 'K+', sym: { b: 'K', sup: '+' }, name: 'kaon (positive)', family: 'meson', quarks: ['u', '-s'], q3: 3, b3: 0, L: [0, 0, 0], S: 1, mass: 493.677, life: 1.238e-8, spin: '0', spec: false,
    antiName: 'kaon (negative)', antiSym: { b: 'K', sup: '−' },
    found: '1947, Rochester and Butler, “V particles” in cloud-chamber photographs of cosmic rays',
    decays: ['K⁺ → μ⁺ + ν_μ (64%)', 'K⁺ → π⁺ + π⁰ (21%)'],
    facts: ['us̄: strangeness +1 (the s̄ has +1).', 'K⁺ and K⁻ are each other’s antiparticles.'] }),
  P({ id: 'K0', sym: { b: 'K', sup: '0' }, name: 'kaon (neutral)', family: 'meson', quarks: ['d', '-s'], q3: 0, b3: 0, L: [0, 0, 0], S: 1, mass: 497.611, life: 8.95e-11, spin: '0', spec: false,
    found: '1947, cosmic rays',
    decays: ['K⁰ → π⁺ + π⁻ (the short-lived form)', 'K⁰ → π⁰ + π⁰'],
    facts: ['ds̄. Not its own antiparticle: the anti-K⁰ is d̄s.', 'Neutral, so it shows up in a bubble chamber as a V of a π⁺ and π⁻ track. (It is a mixture of a short-lived form, 9 × 10⁻¹¹ s, and a long-lived form, 5 × 10⁻⁸ s.)'] }),
  P({ id: 'D0', sym: { b: 'D', sup: '0' }, name: 'D meson', family: 'meson', quarks: ['c', '-u'], q3: 0, b3: 0, L: [0, 0, 0], S: 0, mass: 1864.84, life: 4.10e-13, spin: '0', spec: false,
    found: '1976, SLAC',
    decays: ['D⁰ → K⁻ + π⁺'],
    facts: ['cū: a charmed meson.'] }),
  P({ id: 'Jpsi', sym: { b: 'J/ψ' }, name: 'J/psi', family: 'meson', quarks: ['c', '-c'], q3: 0, b3: 0, L: [0, 0, 0], S: 0, mass: 3096.9, life: 7.1e-21, spin: '1', self: true, spec: false,
    found: '1974, found at the same time by Ting’s team at Brookhaven (who called it J) and Richter’s at SLAC (ψ)',
    decays: ['J/ψ → e⁺ + e⁻', 'J/ψ → μ⁺ + μ⁻', 'J/ψ → hadrons'],
    facts: ['cc̄: the discovery of the charm quark, and proof that quarks are real.'] }),
  P({ id: 'B+', sym: { b: 'B', sup: '+' }, name: 'B meson', family: 'meson', quarks: ['u', '-b'], q3: 3, b3: 0, L: [0, 0, 0], S: 0, mass: 5279.34, life: 1.638e-12, spin: '0', spec: false,
    antiName: 'B⁻ meson', antiSym: { b: 'B', sup: '−' },
    found: '1983, CLEO at Cornell',
    decays: ['B⁺ → J/ψ + K⁺', 'B⁺ → D̄⁰ + π⁺'],
    facts: ['ub̄: studied to understand why the universe has more matter than antimatter.'] }),
  P({ id: 'Upsilon', sym: { b: 'Υ' }, name: 'upsilon', family: 'meson', quarks: ['b', '-b'], q3: 0, b3: 0, L: [0, 0, 0], S: 0, mass: 9460.4, life: 1.22e-20, spin: '1', self: true, spec: false,
    found: '1977, Leon Lederman’s team at Fermilab',
    decays: ['Υ → μ⁺ + μ⁻', 'Υ → hadrons'],
    facts: ['bb̄: the discovery of the bottom quark.'] }),
];

export const ALL: Particle[] = [...QUARKS, ...LEPTONS, ...BOSONS, ...BARYONS, ...MESONS];

/* ---------- antiparticles ---------- */

const FLIP_SUP: Record<string, string> = { '+': '−', '−': '+', '++': '−−', '0': '0' };
const qbar = (q: QSlot): QSlot => (q.startsWith('-') ? (q.slice(1) as Q) : (`-${q}` as QSlot));

/** The antiparticle: opposite charge, baryon number, lepton numbers and strangeness; same mass and lifetime. */
export function anti(p: Particle): Particle {
  if (p.self) return p;
  const sym = p.antiSym ?? { ...p.sym, bar: !p.sym.bar, sup: p.sym.sup ? FLIP_SUP[p.sym.sup] ?? p.sym.sup : undefined };
  // charged mesons and leptons write the antiparticle with the opposite sign, not a bar
  if (!p.antiSym && (p.family === 'lepton' && p.q3 !== 0)) { sym.bar = false; }
  const name = p.antiName ?? (p.anti ? p.name.replace(/^anti-?/, '') : `anti${p.family === 'quark' ? '-' : ''}${p.name}`);
  return {
    ...p,
    id: p.anti ? p.id.replace(/^anti-/, '') : `anti-${p.id}`,
    sym, name,
    q3: -p.q3, b3: -p.b3, L: [-p.L[0], -p.L[1], -p.L[2]], S: -p.S,
    quarks: p.quarks?.map(qbar),
    decays: p.decays?.map(conjugateText),
    found: p.antiFound ?? p.found,
    anti: !p.anti,
    antiName: p.anti ? undefined : p.name, antiSym: p.anti ? undefined : p.sym,
  };
}
/** Swap particles for antiparticles in a decay written as text (for the antiparticle's card). */
function conjugateText(s: string): string {
  const swaps: [RegExp, string][] = [
    [/e⁻/g, 'E1'], [/e⁺/g, 'e⁻'], [/E1/g, 'e⁺'],
    [/μ⁻/g, 'M1'], [/μ⁺/g, 'μ⁻'], [/M1/g, 'μ⁺'],
    [/π⁻/g, 'P1'], [/π⁺/g, 'π⁻'], [/P1/g, 'π⁺'],
    [/K⁻/g, 'K1'], [/K⁺/g, 'K⁻'], [/K1/g, 'K⁺'],
    [/τ⁻/g, 'T1'], [/τ⁺/g, 'τ⁻'], [/T1/g, 'τ⁺'],
    [/W⁻/g, 'W1'], [/W⁺/g, 'W⁻'], [/W1/g, 'W⁺'],
    [/ν̄/g, 'N1'], [/ν(?!̄)/g, 'ν̄'], [/N1/g, 'ν'],
    [/Σ⁺/g, 'Σ̄⁻'], [/Σ⁻/g, 'Σ̄⁺'], [/Λc⁺/g, 'Λ̄c⁻'],
    [/\bp\b(?!̄)/g, 'p̄'], [/\bn\b(?!̄)/g, 'n̄'], [/Λ⁰/g, 'Λ̄⁰'], [/Ξ⁰/g, 'Ξ̄⁰'], [/Ξ⁻/g, 'Ξ̄⁺'], [/Ω⁻/g, 'Ω̄⁺'],
    [/K⁰/g, 'K̄⁰'], [/D̄⁰/g, 'D1'], [/D⁰/g, 'D̄⁰'], [/D1/g, 'D⁰'], [/B⁺/g, 'B⁻'],
  ];
  return swaps.reduce((t, [re, r]) => t.replace(re, r), s);
}

/** Every particle and antiparticle, by id ('anti-p' is the antiproton). */
export const BY_ID: Record<string, Particle> = {};
for (const p of ALL) { BY_ID[p.id] = p; const a = anti(p); BY_ID[a.id] = a; }
export const get = (id: string) => BY_ID[id];

/* ---------- symbols as plain text (for equations) ---------- */

const SUB: Record<string, string> = { e: 'ₑ', 'μ': '_μ', 'τ': '_τ', c: 'c' }; // no Unicode subscript μ or τ
export function symText(s: Particle['sym']): string {
  const base = s.bar ? [...s.b].map((ch, i) => (i === 0 ? ch + '̄' : ch)).join('') : s.b;
  const sub = s.sub ? (SUB[s.sub] ?? s.sub) : '';
  const sp = s.sup ? s.sup.replace(/\+/g, '⁺').replace(/[−-]/g, '⁻').replace(/0/g, '⁰') : '';
  return base + sub + sp;
}
export const symOf = (id: string) => symText(get(id).sym);

export const qText = (q: QSlot) => (q.startsWith('-') ? q.slice(1) + '̄' : q);
export const QCHARGE: Record<Q, number> = { u: 2, c: 2, t: 2, d: -1, s: -1, b: -1 };

/** Which hadron, if any, a set of quarks makes (the lightest one with that content). */
export function hadronFor(slots: QSlot[]): Particle | null {
  const key = (qs: QSlot[]) => [...qs].sort().join(',');
  const k = key(slots);
  for (const p of [...BARYONS, ...MESONS]) {
    for (const x of [p, anti(p)]) if (x.quarks && key(x.quarks) === k) return x;
  }
  if (k === key(['d', '-d'])) return BY_ID['pi0'];
  if (k === key(['s', '-s'])) return null;
  return null;
}

export const FAMILY_NAME: Record<Family, string> = { quark: 'Quark', lepton: 'Lepton', boson: 'Gauge boson', baryon: 'Baryon', meson: 'Meson' };
