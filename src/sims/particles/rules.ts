/* Particle Lab: checking a particle reaction. Charge, baryon number and lepton number (each family separately as
   well as in total) must balance; so must energy and momentum. A decay can only give products lighter than the
   parent (the difference becomes kinetic energy); a collision can make heavier products only from the kinetic energy
   brought in. Strangeness is conserved by the strong and electromagnetic interactions but can change by one in a weak
   one (beyond the specification, shown for completeness).

   The presets are the reactions exam questions use, plus some that break exactly one rule. */

import { get, symOf, MEV, H, C, type Particle } from './data';

export interface Preset { nucleus?: boolean; id: string; group: 'decay' | 'collision' | 'forbidden'; name: string; lhs: string[]; rhs: string[]; note: string; quark?: string; force?: 'strong' | 'electromagnetic' | 'weak' }

export const PRESETS: Preset[] = [
  { id: 'beta-', group: 'decay', name: 'β⁻ decay', lhs: ['n'], rhs: ['p', 'e', 'anti-nue'], force: 'weak', quark: 'udd → uud: a down quark becomes an up quark, d → u + e⁻ + ν̄ₑ (through a W⁻)',
    note: 'A neutron-rich nucleus loses a neutron and gains a proton. The antineutrino is needed to conserve lepton number (and energy: the electrons come out with a spread of energies).' },
  { id: 'beta+', nucleus: true, group: 'decay', name: 'β⁺ decay (in a nucleus)', lhs: ['p'], rhs: ['n', 'anti-e', 'nue'], force: 'weak', quark: 'uud → udd: an up quark becomes a down quark, u → d + e⁺ + νₑ (through a W⁺)',
    note: 'Charge, baryon and lepton numbers all balance, but a free proton is lighter than a neutron, so it can’t do this on its own: it happens only inside a proton-rich nucleus, which supplies the energy.' },
  { id: 'pi+', group: 'decay', name: 'Pion decay', lhs: ['pi+'], rhs: ['anti-mu', 'numu'], force: 'weak', quark: 'ud̄ annihilate into a W⁺',
    note: 'How muons are made in the upper atmosphere and in accelerators. The muon antiparticle (lepton number −1) is balanced by a muon neutrino (+1).' },
  { id: 'mu', group: 'decay', name: 'Muon decay', lhs: ['mu'], rhs: ['e', 'anti-nue', 'numu'], force: 'weak',
    note: 'Both families must balance: the muon number is carried on by the ν_μ, and the electron’s +1 is cancelled by the ν̄ₑ.' },
  { id: 'pi0', group: 'decay', name: 'Neutral pion decay', lhs: ['pi0'], rhs: ['gamma', 'gamma'], force: 'electromagnetic',
    note: 'The π⁰’s whole rest energy (135 MeV) becomes two photons going in opposite directions (momentum: one photon alone can’t carry zero momentum).' },
  { id: 'lambda', group: 'decay', name: 'Lambda decay', lhs: ['Lambda'], rhs: ['p', 'anti-pi+'], force: 'weak', quark: 'uds → uud + dū: the strange quark becomes an up quark',
    note: 'The V seen in bubble chambers. Strangeness changes from −1 to 0, which only the weak interaction allows: that is why the Λ lives as long as 10⁻¹⁰ s.' },
  { id: 'k+', group: 'decay', name: 'Kaon decay', lhs: ['K+'], rhs: ['pi+', 'pi0'], force: 'weak',
    note: 'A meson decaying into lighter mesons. Strangeness goes from +1 to 0: a weak decay.' },
  { id: 'annih', group: 'collision', name: 'Electron–positron annihilation', lhs: ['e', 'anti-e'], rhs: ['gamma', 'gamma'], force: 'electromagnetic',
    note: 'Particle and antiparticle meet and all their mass becomes energy. At rest, two photons of 0.511 MeV each go off back to back. This is the source of the γ-rays used in PET scanners.' },
  { id: 'pair', group: 'collision', name: 'Pair production', lhs: ['gamma'], rhs: ['e', 'anti-e'], force: 'electromagnetic',
    note: 'A photon of at least 1.02 MeV turns into an electron and a positron. It needs a nucleus nearby to take some momentum: a photon on its own can’t do it in empty space.' },
  { id: 'pp-pi0', group: 'collision', name: 'Making a pion', lhs: ['p', 'p'], rhs: ['p', 'p', 'pi0'], force: 'strong',
    note: 'The kinetic energy of the collision becomes the mass of a new particle: ΔE = c²Δm. The two protons survive.' },
  { id: 'pbar', group: 'collision', name: 'Making an antiproton', lhs: ['p', 'p'], rhs: ['p', 'p', 'p', 'anti-p'], force: 'strong',
    note: 'Baryon number forces antimatter to be made in pairs: a proton and an antiproton. The Bevatron at Berkeley was built with just enough energy for this (1955).' },
  { id: 'assoc', group: 'collision', name: 'Associated production', lhs: ['anti-pi+', 'p'], rhs: ['K0', 'Lambda'], force: 'strong',
    note: 'Strange particles are made in pairs by the strong interaction: strangeness −1 (Λ) and +1 (K⁰) add to 0, as before. Each then decays slowly, by the weak interaction.' },
  { id: 'omega', group: 'collision', name: 'Discovery of the Ω⁻', lhs: ['anti-K+', 'p'], rhs: ['Omega-', 'K+', 'K0'], force: 'strong',
    note: 'The 1964 Brookhaven bubble-chamber event that found the Ω⁻ Gell-Mann had predicted: strangeness −1 before, −3 + 1 + 1 = −1 after.' },
  { id: 'nu', group: 'collision', name: 'Detecting an antineutrino', lhs: ['anti-nue', 'p'], rhs: ['n', 'anti-e'], force: 'weak',
    note: 'Inverse β decay: how Cowan and Reines first detected (anti)neutrinos from a nuclear reactor in 1956.' },
  { id: 'x-n', group: 'forbidden', name: 'β⁻ decay without the antineutrino', lhs: ['n'], rhs: ['p', 'e'],
    note: 'Charge and baryon number balance, but lepton number goes from 0 to +1. The missing antineutrino was Pauli’s 1930 prediction.' },
  { id: 'x-p', group: 'forbidden', name: 'Free proton β⁺ decay', lhs: ['p'], rhs: ['n', 'anti-e', 'nue'],
    note: 'Every quantum number balances, but energy does not: the products are heavier than the proton. A free proton is stable.' },
  { id: 'x-pdecay', group: 'forbidden', name: 'Proton decay', lhs: ['p'], rhs: ['anti-e', 'pi0'],
    note: 'Charge, lepton number… but baryon number goes from 1 to 0. Never seen: the proton lives at least 10³⁴ years.' },
  { id: 'x-mueg', group: 'forbidden', name: 'Muon → electron + photon', lhs: ['mu'], rhs: ['e', 'gamma'],
    note: 'Total lepton number is fine (1 → 1), but the muon number and electron number each change. Never observed: each lepton family is conserved separately.' },
  { id: 'x-pp', group: 'forbidden', name: 'Two protons make three', lhs: ['p', 'p'], rhs: ['p', 'p', 'n'],
    note: 'Baryon number 2 → 3. Extra baryons can only be made with matching antibaryons.' },
  { id: 'x-pi', group: 'forbidden', name: 'Pion to muon + wrong neutrino', lhs: ['pi+'], rhs: ['anti-mu', 'anti-numu'],
    note: 'μ⁺ has L_μ = −1 and ν̄_μ also −1: lepton number 0 → −2. It must be a neutrino, not an antineutrino.' },
  { id: 'x-lam', group: 'forbidden', name: 'Lambda → proton + kaon', lhs: ['Lambda'], rhs: ['p', 'anti-K+'],
    note: 'The quantum numbers balance, but p + K⁻ (1432 MeV/c²) is heavier than the Λ (1116 MeV/c²): not enough energy.' },
  { id: 'x-1g', group: 'forbidden', name: 'Annihilation into one photon', lhs: ['e', 'anti-e'], rhs: ['gamma'],
    note: 'Charge, baryon and lepton numbers balance, but momentum can’t: at rest the pair has zero momentum, and a single photon always carries momentum.' },
];

export interface Row { key: string; name: string; left: number; right: number; ok: boolean; unit: 'thirds' | 'int'; beyond?: boolean; soft?: boolean }
export interface Check {
  rows: Row[];
  mL: number; mR: number;     // total rest mass, MeV/c²
  energy: 'ok' | 'needs-ke' | 'photon' | 'nucleus' | 'forbidden';
  momentum: 'ok' | 'needs-nucleus' | 'forbidden';
  quantumOk: boolean;
  possible: boolean;
  why: string[];
  force: 'strong' | 'electromagnetic' | 'weak' | null;
}

const sum = (ps: Particle[], f: (p: Particle) => number) => ps.reduce((a, p) => a + f(p), 0);

/** nucleus: the reaction happens inside a nucleus, which can supply energy (β⁺ decay). */
export function check(lhsIds: string[], rhsIds: string[], nucleus = false): Check {
  const L = lhsIds.map(get), R = rhsIds.map(get);
  const row = (key: string, name: string, f: (p: Particle) => number, unit: Row['unit'] = 'int', extra: Partial<Row> = {}): Row => {
    const left = sum(L, f), right = sum(R, f);
    return { key, name, left, right, ok: left === right, unit, ...extra };
  };
  const rows: Row[] = [
    row('Q', 'Charge', (p) => p.q3, 'thirds'),
    row('B', 'Baryon number', (p) => p.b3, 'thirds'),
    row('L', 'Lepton number', (p) => p.L[0] + p.L[1] + p.L[2]),
    row('Le', 'Electron number Lₑ', (p) => p.L[0]),
    row('Lmu', 'Muon number L_μ', (p) => p.L[1]),
    row('Ltau', 'Tau number L_τ', (p) => p.L[2]),
    row('S', 'Strangeness', (p) => p.S, 'int', { beyond: true, soft: true }),
  ];
  const mL = sum(L, (p) => p.mass), mR = sum(R, (p) => p.mass);
  const why: string[] = [];
  const quantumOk = rows.filter((r) => !r.soft).every((r) => r.ok);
  for (const r of rows) if (!r.ok && !r.soft) why.push(`${r.name} is not conserved.`);

  let energy: Check['energy'] = 'ok';
  if (L.length === 1 && L[0].mass === 0 && mR > 0) energy = 'photon';   // a photon has energy but no rest mass
  else if (L.length === 1 && nucleus && mR > mL + 1e-9) energy = 'nucleus';
  else if (L.length === 1) {
    if (mR > mL + 1e-9) { energy = 'forbidden'; why.push(`The products have more rest mass (${round(mR)} MeV/c²) than the decaying particle (${round(mL)} MeV/c²): a particle can only decay into lighter ones.`); }
  } else if (mR > mL + 1e-9) energy = 'needs-ke';

  let momentum: Check['momentum'] = 'ok';
  if (L.length === 1 && R.length === 1) { momentum = 'forbidden'; why.push('One particle can’t turn into one other particle: energy and momentum can’t both be conserved.'); }
  else if (L.length === 1 && L[0].id === 'gamma' && R.length >= 2) momentum = 'needs-nucleus';
  else if (L.length === 0 || R.length === 0) momentum = 'forbidden';
  else if (L.length >= 2 && R.length === 1 && R[0].mass === 0) { momentum = 'forbidden'; why.push('Two particles can’t annihilate into a single photon: seen from their centre of mass they have zero momentum, and one photon always carries some.'); }

  // which interaction (beyond the spec): neutrinos or a change of strangeness → weak; photons → electromagnetic; else strong
  const all = [...L, ...R];
  const dS = Math.abs(rows[6].left - rows[6].right);
  let force: Check['force'] = null;
  if (all.some((p) => p.family === 'lepton' && p.q3 === 0) || dS === 1 || (all.some((p) => p.family === 'lepton') && all.some((p) => p.family === 'baryon' || p.family === 'meson'))) force = 'weak';
  else if (dS > 1) force = null;
  else if (all.some((p) => p.id === 'gamma' || p.family === 'lepton')) force = 'electromagnetic';
  else force = 'strong';
  if (dS > 1) why.push('Strangeness changes by more than 1: no interaction allows that.');

  const possible = quantumOk && energy !== 'forbidden' && momentum !== 'forbidden' && dS <= 1;
  return { rows, mL, mR, energy, momentum, quantumOk, possible, why, force };
}

const round = (x: number) => Number(x.toPrecision(4));

/** The reaction as text: n → p + e⁻ + ν̄ₑ */
export const reactionText = (lhs: string[], rhs: string[]) => `${lhs.map(symOf).join(' + ')} → ${rhs.map(symOf).join(' + ')}`;

/** Energy released (positive) or needed (negative), MeV. */
export const qValue = (c: Check) => c.mL - c.mR;
export const photon = (mev: number) => { const E = mev * MEV; return { E, f: E / H, lam: (H * C) / E }; };

/** The particles offered in the reaction builder. */
export const PALETTE: string[] = [
  'p', 'anti-p', 'n', 'anti-n', 'e', 'anti-e', 'nue', 'anti-nue', 'mu', 'anti-mu', 'numu', 'anti-numu', 'tau', 'anti-tau', 'nutau', 'anti-nutau',
  'pi+', 'anti-pi+', 'pi0', 'K+', 'anti-K+', 'K0', 'anti-K0', 'Lambda', 'anti-Lambda', 'Sigma+', 'Sigma-', 'Xi-', 'Omega-', 'gamma',
];
