/* Practice: generated exam-style questions on Unit 4 nuclear and particle physics, four options each. Wrong options
   are the slips students make: forgetting to convert MeV to J, using the diameter, leaving out a square root, using
   the electron's mass for a proton, getting the sign of a charge or the direction of curvature backwards, forgetting
   the antineutrino. Constants as on the data sheet; every question carries its working. */

import { E, C, ME, MP, U, H, K, MEV, MEVC2, sci, plain, short, get, symOf, anti, thirds, qText, QCHARGE, hadronFor, type QSlot, type Q } from './data';
import { PRESETS, check, reactionText } from './rules';
import { pick, shuffle } from '../../lib/util';

export type Topic = 'accel' | 'detect' | 'nucleus' | 'quarks' | 'conserve' | 'energy';
export const TOPICS: [Topic | 'all', string, string?][] = [
  ['all', 'Everything', 'All'], ['accel', 'Accelerators', 'Accel'], ['detect', 'Detectors and r = p/BQ', 'Tracks'], ['nucleus', 'The nuclear atom', 'Atom'],
  ['quarks', 'Quarks and hadrons', 'Quarks'], ['conserve', 'Conservation laws', 'Laws'], ['energy', 'E = mc² and units', 'Energy'],
];
export const TOPIC_NAME: Record<Topic, string> = {
  accel: 'Particle accelerators', detect: 'Detectors and tracks', nucleus: 'The nuclear atom', quarks: 'Quarks, hadrons and leptons', conserve: 'Conservation laws', energy: 'Mass, energy and units',
};

export type Figure =
  | { kind: 'track'; sign: 1 | -1; B: 'in' | 'out'; spiral?: boolean }
  | { kind: 'quarks'; q: QSlot[] }
  | { kind: 'reaction'; lhs: string[]; rhs: string[] }
  | { kind: 'scatter' };
export interface Question { topic: Topic; prompt: string; options: string[]; answer: string; working: string[]; why: string; figure?: Figure }

const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const r2 = (x: number) => Number(x.toPrecision(2));

function opts(ans: number, slips: number[], unit: string, fmt: (x: number) => string = (x) => sci(x)) {
  const f = (x: number) => `${fmt(x)} ${unit}`.trim();
  const answer = f(ans);
  const out = new Set([answer]);
  for (const w of [...slips, ans * 10, ans / 10, ans * 2, ans / 2, ans * 4]) {
    if (out.size >= 4) break;
    if (isFinite(w) && w > 0 && Math.abs(w / ans - 1) > 0.04) out.add(f(w));
  }
  return { options: shuffle([...out]), answer };
}
function choice(answer: string, wrong: string[]) {
  const out = [answer, ...shuffle(wrong.filter((w) => w !== answer)).slice(0, 3)];
  return { options: shuffle(out), answer };
}

/* ---------- accelerators ---------- */
const ACCEL: (() => Question)[] = [
  () => { // electron gun
    const V = ri(15, 40) * 100;
    const v = Math.sqrt((2 * E * V) / ME);
    return { topic: 'accel', prompt: `Electrons leave a hot filament (thermionic emission) and are accelerated through a potential difference of ${V} V. What is their speed? (Ignore relativistic effects.)`,
      ...opts(v, [(2 * E * V) / ME, Math.sqrt((E * V) / ME), Math.sqrt((2 * E * V) / MP)], 'm s⁻¹'),
      working: ['Energy gained = eV = ½mv²', `v = √(2eV/m) = √(2 × 1.60 × 10⁻¹⁹ × ${V} ÷ 9.11 × 10⁻³¹)`, `v = ${sci(v)} m s⁻¹`],
      why: 'Work done on the charge by the field, eV, becomes kinetic energy. Common slips: forgetting the square root, or the 2.' };
  },
  () => { // linac energy
    const n = ri(8, 40), Vk = ri(2, 12) * 100;
    const MeV = (n * Vk * 1e3) / 1e6;
    return { topic: 'accel', prompt: `A linear accelerator has ${n} gaps between its drift tubes. A proton gains energy crossing each gap, where the peak p.d. is ${Vk} kV. What is its kinetic energy at the end, in MeV?`,
      ...opts(MeV, [MeV / n, MeV * 2, (MeV * MEV) / 1e6], 'MeV', (x) => short(x, 3)),
      working: ['Each gap: ΔEₖ = QV = e × V, i.e. V electronvolts per gap for a charge of e', `Eₖ = ${n} × ${Vk} keV = ${short(MeV * 1000, 4)} keV = ${short(MeV, 3)} MeV`],
      why: 'The particle is accelerated only in the gaps; inside the tubes there is no field. For an α particle (charge 2e) it would be twice as much.' };
  },
  () => { // linac tube length
    const f = ri(10, 40) * 1e6, MeV = ri(1, 9);
    const v = Math.sqrt((2 * MeV * MEV) / MP), Lt = v / (2 * f);
    return { topic: 'accel', prompt: `In a linac the alternating p.d. has frequency ${f / 1e6} MHz. A proton with kinetic energy ${MeV} MeV is in a drift tube. How long must the tube be?`,
      ...opts(Lt, [v / f, v * f, Math.sqrt((2 * MeV * 1e6) / MP) / (2 * f)], 'm', (x) => plain(x, 3)),
      working: [`v = √(2Eₖ/m) = √(2 × ${MeV} × 1.60 × 10⁻¹³ ÷ 1.67 × 10⁻²⁷) = ${sci(v)} m s⁻¹`, `It must spend half a period in the tube: t = 1/2f = ${sci(1 / (2 * f))} s`, `L = vt = ${plain(Lt, 3)} m`],
      why: 'The p.d. reverses while the particle is shielded inside the tube, so it is pushed again at the next gap. As it speeds up the tubes get longer.' };
  },
  () => { // cyclotron frequency
    const B = ri(5, 18) / 10;
    const f = (B * E) / (2 * Math.PI * MP);
    return { topic: 'accel', prompt: `A cyclotron accelerates protons in a magnetic field of ${B} T. What frequency must the alternating p.d. across the dees have?`,
      ...opts(f, [(B * E) / MP, (B * E) / (2 * Math.PI * ME), (2 * Math.PI * MP) / (B * E)], 'Hz'),
      working: ['Bqv = mv²/r gives r = mv/BQ, and the time for half a turn is πr/v = πm/BQ', 'So one full orbit takes T = 2πm/BQ, the same at every radius', `f = BQ/2πm = ${B} × 1.60 × 10⁻¹⁹ ÷ (2π × 1.67 × 10⁻²⁷) = ${sci(f)} Hz`],
      why: 'Because the period doesn’t depend on speed or radius, a fixed frequency keeps the p.d. in step as the protons spiral out (until they become relativistic).' };
  },
  () => { // cyclotron max KE
    const B = ri(8, 16) / 10, R = ri(30, 90) / 100;
    const KE = (B * E * R) ** 2 / (2 * MP), Mv = KE / MEV;
    return { topic: 'accel', prompt: `Protons leave a cyclotron of radius ${R} m with a field of ${B} T. What is their kinetic energy in MeV?`,
      ...opts(Mv, [((B * E * R) ** 2 / MP) / MEV, ((B * E * R * 2) ** 2 / (2 * MP)) / MEV, KE / E / 1e3], 'MeV', (x) => short(x, 3)),
      working: ['r = p/BQ, so at the edge p = BQR', `p = ${B} × 1.60 × 10⁻¹⁹ × ${R} = ${sci(B * E * R)} kg m s⁻¹`, `Eₖ = p²/2m = ${sci(KE)} J = ${short(Mv, 3)} MeV`],
      why: 'The biggest circle that fits in the dees fixes the largest momentum: p = BQR.' };
  },
  () => ({ topic: 'accel', prompt: 'Why do the drift tubes in a linac get longer along the accelerator?', ...choice('The time spent in each tube must be half a period, and the particle moves faster in each one', [
    'The tubes get longer to slow the particle down', 'Longer tubes have a larger potential difference', 'The field inside the tubes accelerates the particle more', 'The frequency of the p.d. increases along the linac']),
    working: ['Fixed frequency f → fixed time 1/2f inside each tube', 'Speed increases after every gap, so L = v/2f increases'], why: 'Inside a tube there is no electric field (it is a conductor at one potential), so the particle drifts at constant speed.' }),
  () => ({ topic: 'accel', prompt: 'In a cyclotron, what does the magnetic field do to the protons?', ...choice('Makes them move in semicircles inside the dees without changing their speed', [
    'Accelerates them across the gap between the dees', 'Increases their speed each half turn', 'Slows them down so they stay in step', 'Pushes them outwards towards the edge']),
    working: ['F = Bqv is always at right angles to the velocity', 'So it does no work: it changes direction, not speed'], why: 'The electric field across the gap does the accelerating; the magnetic field only bends the path into a circle (r = p/BQ).' }),
  () => { // why high energies: de Broglie
    const GeV = pick([1, 5, 10, 50]);
    const p = (GeV * 1e9 * E) / C, lam = H / p;
    return { topic: 'accel', prompt: `Why do physicists use electrons of about ${GeV} GeV to investigate the structure of the proton? (p ≈ E/c at this energy)`,
      ...choice(`Their de Broglie wavelength (about ${sci(lam, 2)} m) is smaller than a nucleon (about 10⁻¹⁵ m)`, [
        'High-energy electrons are attracted more strongly by the proton', 'Only high-energy electrons have a charge', 'High energy makes the proton larger so it is easier to hit', 'The electrons need to be fast to avoid being absorbed by the nucleus']),
      working: [`p ≈ E/c = ${GeV} × 10⁹ × 1.60 × 10⁻¹⁹ ÷ 3.00 × 10⁸ = ${sci(p)} kg m s⁻¹`, `λ = h/p = 6.63 × 10⁻³⁴ ÷ ${sci(p)} = ${sci(lam)} m`],
      why: 'To resolve detail the wavelength must be about as small as (or smaller than) the detail: λ = h/p, so higher momentum means finer detail. High energies also make new, heavier particles possible (ΔE = c²Δm).' };
  },
];

/* ---------- detectors ---------- */
const DETECT: (() => Question)[] = [
  () => { // r from momentum
    const B = ri(5, 20) / 10, pMeV = ri(50, 900);
    const p = (pMeV * MEV) / C, r = p / (B * E);
    return { topic: 'detect', prompt: `A charged pion (charge e) has momentum ${pMeV} MeV/c in a bubble chamber with a magnetic field of ${B} T. What is the radius of its track?`,
      ...opts(r, [(pMeV * MEV) / (B * E), p / B, (pMeV * 1e6 * E) / (B * E)], 'm', (x) => plain(x, 3)),
      working: [`p = ${pMeV} MeV/c = ${pMeV} × 1.60 × 10⁻¹³ ÷ 3.00 × 10⁸ = ${sci(p)} kg m s⁻¹`, `r = p/BQ = ${sci(p)} ÷ (${B} × 1.60 × 10⁻¹⁹) = ${plain(r, 3)} m`],
      why: 'MeV/c is a unit of momentum: convert the MeV to joules, then divide by c.' };
  },
  () => { // p from r
    const B = ri(10, 30) / 10, r = ri(5, 60) / 100;
    const p = B * E * r, pMeV = (p * C) / MEV;
    return { topic: 'detect', prompt: `A proton’s track in a ${B} T field has a radius of ${r * 100} cm. What is its momentum, in MeV/c?`,
      ...opts(pMeV, [(B * E * r * 100 * C) / MEV, p / MEV, (B * r * C) / 1e6], 'MeV/c', (x) => short(x, 3)),
      working: [`p = BQr = ${B} × 1.60 × 10⁻¹⁹ × ${r} = ${sci(p)} kg m s⁻¹`, `pc = ${sci(p * C)} J = ${short(pMeV, 3)} MeV, so p = ${short(pMeV, 3)} MeV/c`],
      why: 'Remember to put r in metres. A larger radius means a larger momentum.' };
  },
  () => {
    const B = pick(['in', 'out'] as const), sign = pick([1, -1] as const);
    // into the page: positive particles moving right curve upwards (anticlockwise)
    const acw = (sign === 1) === (B === 'in');
    return { topic: 'detect', prompt: `A particle enters from the left, moving right, in a magnetic field directed ${B === 'in' ? 'into' : 'out of'} the page. Its track curves ${acw ? 'upwards (anticlockwise)' : 'downwards (clockwise)'}, as in the figure. What is the sign of its charge?`,
      ...choice(sign === 1 ? 'Positive' : 'Negative', ['Positive', 'Negative', 'Neutral', 'It can’t be told without its speed']),
      working: ['Fleming’s left-hand rule: First finger = Field, seCond finger = Current (direction a positive charge moves), thuMb = Motion (force)', `For a positive charge moving right with B ${B === 'in' ? 'into' : 'out of'} the page the force is ${B === 'in' ? 'upwards' : 'downwards'}`, `This track bends ${acw ? 'up' : 'down'}: ${sign === 1 ? 'the same, so positive' : 'the opposite, so negative'}`],
      why: 'For a negative particle the “current” is opposite to its motion, so it curves the other way.', figure: { kind: 'track', sign, B } };
  },
  () => ({ topic: 'detect', prompt: 'An electron’s track in a bubble chamber is a spiral that gets tighter and tighter. Why?', ...choice('It loses kinetic energy ionising the liquid, so its momentum and so its radius (r = p/BQ) fall', [
    'The magnetic field gets stronger towards the centre', 'Its charge increases as it slows', 'The magnetic force does work on it, slowing it down', 'It gains mass as it ionises the liquid']),
    working: ['r = p/BQ: B and Q are constant', 'Each ionisation takes energy from the electron, so p falls and r falls'], why: 'The magnetic force is perpendicular to the motion and does no work; the energy goes into ionising the atoms along the path.', figure: { kind: 'track', sign: -1, B: 'in', spiral: true } }),
  () => ({ topic: 'detect', prompt: 'A neutral particle is produced in a bubble chamber. What does it leave?', ...choice('No track: it doesn’t ionise the liquid. It may appear later as a V when it decays into charged particles', [
    'A straight track, because the field can’t bend it', 'A thick track, because it is heavy', 'A track curving the opposite way to a positive particle', 'A faint track made of photons']),
    working: ['Tracks are lines of bubbles formed on ions', 'Only a charged particle ionises the atoms it passes'], why: 'A gap between a vertex and a V (like Λ⁰ → p + π⁻ or K⁰ → π⁺ + π⁻) is the sign of a neutral particle.' }),
  () => ({ topic: 'detect', prompt: 'In a cloud chamber, α tracks are short, thick and straight while β tracks are long, thin and wiggly. Why are the α tracks thick?', ...choice('α particles are strongly ionising: they make many ions per mm, so many droplets form', [
    'α particles are bigger, so the droplets are bigger', 'α particles move faster than β particles', 'α particles are deflected by every atom they meet', 'α particles carry more droplets with them']),
    working: ['Charge 2e and slow, so they interact strongly with every atom they pass', 'They lose their energy quickly: short range (a few cm in air)'], why: 'β particles (electrons) are light and weakly ionising, and are knocked about by collisions, so their tracks are thin and wiggly.' }),
  () => ({ topic: 'detect', prompt: 'A γ-ray photon in a bubble chamber produces an electron–positron pair. What do the tracks look like?', ...choice('Nothing before the vertex, then two tracks curling in opposite directions from the same point', [
    'A single track that splits into two parallel tracks', 'Two tracks curling the same way from one point', 'A straight track ending in a spiral', 'Two tracks that start at different points']),
    working: ['The photon is uncharged: no track', 'e⁻ and e⁺ have opposite charges, so the field bends them opposite ways'], why: 'Charge is conserved (0 → −1 + 1); pair production needs at least 1.02 MeV and a nucleus nearby.', figure: { kind: 'reaction', lhs: ['gamma'], rhs: ['e', 'anti-e'] } }),
];

/* ---------- the nuclear atom ---------- */
const NUCLEUS: (() => Question)[] = [
  () => ({ topic: 'nucleus', prompt: 'In α-particle scattering, most α particles pass straight through the gold foil. What does this show?', ...choice('Most of the atom is empty space', [
    'The nucleus is positively charged', 'The nucleus contains most of the mass', 'Gold atoms are very small', 'α particles have no charge']),
    working: [], why: 'Only a tiny fraction come close enough to the nucleus to be deflected much.', figure: { kind: 'scatter' } }),
  () => ({ topic: 'nucleus', prompt: 'A very small number of α particles are deflected through more than 90°. What does this show?', ...choice('The positive charge and most of the mass are concentrated in a tiny nucleus', [
    'The atom is mostly empty space', 'Electrons are spread through the atom', 'α particles are attracted to the nucleus', 'Gold atoms are arranged in a regular lattice']),
    working: [], why: 'Only a massive, concentrated positive charge could repel the α particles hard enough to turn them back. (Thomson’s “plum pudding” atom would only deflect them slightly.)', figure: { kind: 'scatter' } }),
  () => { // closest approach
    const MeV = pick([4, 5, 5.5, 6, 7.7]), Z = pick([79, 47, 78]);
    const d = (K * 2 * Z * E * E) / (MeV * MEV);
    const name = Z === 79 ? 'gold' : Z === 47 ? 'silver' : 'platinum';
    return { topic: 'nucleus', prompt: `An α particle with ${MeV} MeV of kinetic energy heads straight for a ${name} nucleus (Z = ${Z}). How close does it get before it stops and turns back?`,
      ...opts(d, [(K * Z * E * E) / (MeV * MEV), (K * 2 * Z * E) / (MeV * MEV), (K * 2 * Z * E * E) / (MeV * 1e6)], 'm'),
      working: ['At closest approach all the kinetic energy has become electric potential energy: Eₖ = kQq/d', `d = kQq/Eₖ = 8.99 × 10⁹ × (${Z} × 1.60 × 10⁻¹⁹)(2 × 1.60 × 10⁻¹⁹) ÷ (${MeV} × 1.60 × 10⁻¹³)`, `d = ${sci(d)} m`],
      why: 'This gives an upper limit for the radius of the nucleus: about 10⁻¹⁴ m, compared with 10⁻¹⁰ m for the atom.' };
  },
  () => {
    const n = pick([[197, 79, 'Au'], [238, 92, 'U'], [56, 26, 'Fe'], [14, 6, 'C'], [235, 92, 'U'], [210, 84, 'Po']] as const);
    return { topic: 'nucleus', prompt: `How many neutrons are in a nucleus of ${n[2]} with nucleon number ${n[0]} and proton number ${n[1]}?`,
      ...choice(String(n[0] - n[1]), [String(n[0]), String(n[1]), String(n[0] + n[1]), String(n[0] - n[1] + 1), String(Math.round(n[0] / 2))]),
      working: [`N = A − Z = ${n[0]} − ${n[1]} = ${n[0] - n[1]}`], why: 'Nucleon (mass) number A counts protons and neutrons; proton (atomic) number Z counts protons. Isotopes have the same Z but different A.' };
  },
];

/* ---------- quarks and hadrons ---------- */
const HADRONS: QSlot[][] = [['u', 'u', 'd'], ['u', 'd', 'd'], ['u', '-d'], ['d', '-u'], ['u', 'u', 's'], ['d', 's', 's'], ['s', 's', 's'], ['u', '-s'], ['-u', '-u', '-d'], ['u', 'u', 'u'], ['d', '-s']];
const qOf = (q: QSlot) => (q.startsWith('-') ? -QCHARGE[q.slice(1) as Q] : QCHARGE[q as Q]);
const QUARKS_Q: (() => Question)[] = [
  () => {
    const q = pick(HADRONS);
    const ch = q.reduce((a, x) => a + qOf(x), 0);
    const ans = ch === 0 ? '0' : `${thirds(ch)}e`;
    const wrongs = ['+1e', '−1e', '0', '+2e', '−2e', '+⅓e', '−⅔e'];
    const h = hadronFor(q);
    return { topic: 'quarks', prompt: `What is the charge of a particle made of ${q.map(qText).join('')}?`, ...choice(ans, wrongs),
      working: [q.map((x) => `${qText(x)}: ${thirds(qOf(x))}`).join(',  '), `Total: ${ans}${h ? ` (this is the ${h.name})` : ''}`],
      why: 'u, c, t: +⅔e; d, s, b: −⅓e; an antiquark has the opposite charge.', figure: { kind: 'quarks', q } };
  },
  () => {
    const q = pick(HADRONS);
    const ans = q.length === 2 ? 'Meson' : q[0].startsWith('-') ? 'Antibaryon' : 'Baryon';
    return { topic: 'quarks', prompt: `A hadron is made of ${q.map(qText).join('')}. What kind of particle is it?`, ...choice(ans, ['Baryon', 'Meson', 'Antibaryon', 'Lepton']),
      working: ['Baryon: three quarks (B = +1). Antibaryon: three antiquarks (B = −1). Meson: a quark and an antiquark (B = 0).'], why: 'Leptons are fundamental: they contain no quarks.', figure: { kind: 'quarks', q } };
  },
  () => {
    const p = pick(['p', 'n', 'pi+', 'K+', 'Sigma+', 'Omega-', 'mu', 'nue'].map(get));
    const a = anti(p);
    const wrong = [`${a.name}: charge ${thirds(p.q3)}`, 'It has the opposite mass', 'It has the same baryon number but opposite charge', 'It has a larger mass and the same charge'];
    const ans = `Same mass; charge ${p.q3 === 0 ? '0' : thirds(-p.q3) + 'e'}; baryon number ${thirds(-p.b3)}; lepton number ${-(p.L[0] + p.L[1] + p.L[2]) || 0}`;
    return { topic: 'quarks', prompt: `What are the properties of the antiparticle of the ${p.name} (${symOf(p.id)})?`, ...choice(ans, [
      `Same mass; charge ${p.q3 === 0 ? '0' : thirds(p.q3) + 'e'}; baryon number ${thirds(p.b3)}; lepton number ${p.L[0] + p.L[1] + p.L[2]}`, ...wrong.slice(1)]),
      working: [`${p.name}: charge ${p.q3 === 0 ? '0' : thirds(p.q3) + 'e'}, B = ${thirds(p.b3)}, L = ${p.L[0] + p.L[1] + p.L[2]}`, `Antiparticle (${symOf(a.id)}): every one reversed, mass the same`],
      why: 'Every particle has an antiparticle with the same mass and opposite charge, baryon number and lepton number.' };
  },
  () => ({ topic: 'quarks', prompt: 'Which of these is a fundamental particle?', ...choice(pick(['Electron', 'Muon', 'Neutrino', 'Up quark']), ['Proton', 'Neutron', 'Pion', 'Kaon', 'Lambda particle']),
    working: [], why: 'Leptons and quarks have no smaller parts. Hadrons (baryons and mesons) are made of quarks.' }),
  () => ({ topic: 'quarks', prompt: 'Why did physicists expect a sixth quark, the top quark, before it was found in 1995?', ...choice('The symmetry of the quark–lepton model: there were three generations of leptons, so the bottom quark needed a partner', [
    'It was seen in cosmic-ray tracks in 1977', 'The proton’s charge could not be explained without it', 'Every baryon must contain one top quark', 'It was needed to explain β decay']),
    working: [], why: 'Leptons come in three pairs (e, νₑ), (μ, ν_μ), (τ, ν_τ); quarks in (u, d), (c, s), and (t, b). Once b was found, t was predicted.' }),
  () => ({ topic: 'quarks', prompt: 'Which of these is a lepton?', ...choice(pick(['Muon', 'Neutrino', 'Positron', 'Tau']), ['Pion', 'Proton', 'Kaon', 'Photon', 'Neutron']),
    working: [], why: 'Leptons: e, μ, τ and their neutrinos (and antiparticles). They don’t feel the strong force.' }),
];

/* ---------- conservation ---------- */
const CONSERVE: (() => Question)[] = [
  () => {
    const p = pick(PRESETS.filter((x) => !x.nucleus));
    const c = check(p.lhs, p.rhs);
    const broken = c.rows.filter((r) => !r.ok && !r.soft).map((r) => r.name);
    const ans = c.possible ? 'It is possible' : broken.length ? `${broken[0]} is not conserved` : c.energy === 'forbidden' ? 'Energy: the products are heavier' : 'Momentum cannot be conserved';
    const wrong = ['It is possible', 'Charge is not conserved', 'Baryon number is not conserved', 'Lepton number is not conserved', 'Energy: the products are heavier'];
    return { topic: 'conserve', prompt: `Is this reaction possible${p.lhs.length === 1 && p.lhs[0] === 'p' ? ' for a free proton' : ''}? If not, which rule does it break?  ${reactionText(p.lhs, p.rhs)}`, ...choice(ans, wrong),
      working: c.rows.filter((r) => !r.soft && (r.key === 'Q' || r.key === 'B' || r.key === 'L')).map((r) => `${r.name}: ${r.unit === 'thirds' ? thirds(r.left) : r.left} → ${r.unit === 'thirds' ? thirds(r.right) : r.right} ${r.ok ? '✓' : '✗'}`)
        .concat([`Rest mass: ${short(c.mL, 4)} → ${short(c.mR, 4)} MeV/c²`]),
      why: p.note, figure: { kind: 'reaction', lhs: p.lhs, rhs: p.rhs } };
  },
  () => {
    const t = pick([
      { lhs: ['n'], rhs: ['p', 'e'], miss: 'anti-nue', q: 'β⁻ decay' },
      { lhs: ['pi+'], rhs: ['anti-mu'], miss: 'numu', q: 'π⁺ decay' },
      { lhs: ['mu'], rhs: ['e', 'anti-nue'], miss: 'numu', q: 'muon decay' },
      { lhs: ['p'], rhs: ['n', 'anti-e'], miss: 'nue', q: 'β⁺ decay' },
      { lhs: ['anti-pi+'], rhs: ['mu'], miss: 'anti-numu', q: 'π⁻ decay' },
    ]);
    const ans = symOf(t.miss);
    return { topic: 'conserve', prompt: `Complete the equation for ${t.q}: ${t.lhs.map(symOf).join(' + ')} → ${t.rhs.map(symOf).join(' + ')} + ?`,
      ...choice(ans, ['νₑ', 'ν̄ₑ', 'ν_μ', 'ν̄_μ', 'γ', 'e⁻'].filter((x) => x !== ans)),
      working: ['Charge balances already, so the missing particle is neutral', `Lepton number must balance: the missing particle is the ${get(t.miss).name}`],
      why: 'An antilepton balances a lepton; the family (e or μ) must match.' };
  },
  () => {
    const lhs = ['p', 'p'], rhs = ['p', 'p', 'p', 'anti-p'];
    return { topic: 'conserve', prompt: 'In p + p → p + p + p + p̄, why must an antiproton be made along with the extra proton?', ...choice('To conserve baryon number (and charge): 2 = 1 + 1 + 1 − 1', [
      'To conserve lepton number', 'Because protons always come in pairs', 'To conserve the mass of the protons', 'The antiproton carries away the kinetic energy']),
      working: ['B before: 1 + 1 = 2', 'B after: 1 + 1 + 1 − 1 = 2 ✓', 'Charge after: +1 +1 +1 −1 = +2 ✓'], why: 'Matter can only be created along with an equal amount of antimatter.', figure: { kind: 'reaction', lhs, rhs } };
  },
];

/* ---------- energy ---------- */
const ENERGY: (() => Question)[] = [
  () => { const m = pick([0.511, 105.7, 139.6, 938.3, 1116, 1672]); const kg = m * MEVC2;
    return { topic: 'energy', prompt: `A particle has a rest mass of ${m} MeV/c². What is this in kg?`, ...opts(kg, [m * MEV, (m * 1e6) / (C * C), m * MEV * C * C], 'kg'),
      working: [`E = ${m} × 1.60 × 10⁻¹³ = ${sci(m * MEV)} J`, `m = E/c² = ${sci(m * MEV)} ÷ (3.00 × 10⁸)² = ${sci(kg)} kg`], why: 'MeV/c² means: the energy in MeV, divided by c². Convert to joules first.' }; },
  () => { const which = pick([['e', 'an electron and a positron', 0.511], ['p', 'a proton and an antiproton', 938.3]] as const);
    const Ej = which[2] * MEV, f = Ej / H;
    return { topic: 'energy', prompt: `${which[1][0].toUpperCase() + which[1].slice(1)} at rest annihilate, producing two photons. What is the frequency of each photon?`,
      ...opts(f, [(2 * Ej) / H, Ej, (which[2] * E) / H], 'Hz'),
      working: [`Total rest energy = 2 × ${which[2]} MeV, shared by two photons: each has ${which[2]} MeV`, `E = ${which[2]} × 1.60 × 10⁻¹³ = ${sci(Ej)} J`, `f = E/h = ${sci(f)} Hz`],
      why: 'Two photons are needed so that momentum is conserved (zero before, so they go off in opposite directions).' }; },
  () => { const Emin = 2 * 0.511 * MEV, lam = (H * C) / Emin;
    return { topic: 'energy', prompt: 'What is the longest wavelength of a γ-ray photon that can produce an electron–positron pair?', ...opts(lam, [(H * C) / (0.511 * MEV), Emin / H, (H * C) / (2 * 0.511 * E)], 'm'),
      working: ['The photon must supply the rest energy of both: E ≥ 2 × 0.511 MeV = 1.022 MeV', `E = 1.022 × 1.60 × 10⁻¹³ = ${sci(Emin)} J`, `λ = hc/E = ${sci(lam)} m`], why: 'Longest wavelength ↔ lowest energy. Any extra energy becomes the kinetic energy of the pair.' }; },
  () => { const MeV = pick([0.78, 2.5, 17.6, 200]); const J = MeV * MEV;
    return { topic: 'energy', prompt: `Convert ${MeV} MeV into joules.`, ...opts(J, [MeV * E, MeV * 1e6, J * 1e3], 'J'),
      working: [`1 MeV = 10⁶ × 1.60 × 10⁻¹⁹ J = 1.60 × 10⁻¹³ J`, `${MeV} MeV = ${sci(J)} J`], why: '1 eV is the energy gained by one electron charge through 1 V.' }; },
  () => { const dm = ri(20, 400) / 100;  // MeV released in a decay
    const dk = dm * MEVC2;
    return { topic: 'energy', prompt: `In a decay the total rest mass falls by ${sci(dk, 3)} kg. How much energy is released, in MeV?`, ...opts(dm, [dm * 1e6, (dk * C) / MEV, (dk * C * C) / E], 'MeV', (x) => short(x, 3)),
      working: [`ΔE = c²Δm = (3.00 × 10⁸)² × ${sci(dk, 3)} = ${sci(dk * C * C)} J`, `÷ 1.60 × 10⁻¹³ = ${short(dm, 3)} MeV`], why: 'The released energy becomes kinetic energy of the products.' }; },
  () => { const u = r2(ri(1, 9) / 1000 + 0.001);
    const MeV = (u * U * C * C) / MEV;
    return { topic: 'energy', prompt: `A mass of ${u} u disappears in a nuclear reaction. How much energy is released, in MeV? (1 u = 1.66 × 10⁻²⁷ kg)`, ...opts(MeV, [u * U * C * C, (u * U * C) / MEV, (u * MP * C * C) / MEV * 1.5], 'MeV', (x) => short(x, 3)),
      working: [`Δm = ${u} × 1.66 × 10⁻²⁷ = ${sci(u * U)} kg`, `ΔE = c²Δm = ${sci(u * U * C * C)} J = ${short(MeV, 3)} MeV`], why: '1 u corresponds to about 931 MeV.' }; },
  () => ({ topic: 'energy', prompt: 'Muons made by cosmic rays 15 km up live only 2.2 μs, yet many reach the ground. Why?', ...choice('They travel so close to c that their lifetime, measured from the Earth, is much longer (time dilation)', [
    'They travel faster than light', 'The atmosphere slows down their decay', 'They are made just above the ground', 'Their lifetime is 2.2 μs only in a laboratory magnet']),
    working: ['At 0.995c in 2.2 μs: d = vt ≈ 660 m without relativity', 'Lifetime in the Earth’s frame ≈ 10 × longer: about 6.6 km on average, so a good fraction survive 15 km'],
    why: 'Relativistic increase of lifetime matters at speeds close to c: in particle accelerators and in cosmic rays.' }),
];

const BANK: Record<Topic, (() => Question)[]> = { accel: ACCEL, detect: DETECT, nucleus: NUCLEUS, quarks: QUARKS_Q, conserve: CONSERVE, energy: ENERGY };

export function newQuestion(topic: Topic | 'all'): Question {
  const t: Topic = topic === 'all' ? pick(Object.keys(BANK) as Topic[]) : topic;
  return pick(BANK[t])();
}
