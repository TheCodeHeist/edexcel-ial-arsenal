/* Practice: generated questions in the style of Unit 5 astrophysics, four options each. The wrong options are the
   slips students actually make: forgetting the 4π, squaring instead of using the fourth power, forgetting the square
   root, leaving nm or km s⁻¹ unconverted, using the diameter for the radius, inverting a ratio. Constants as on the
   data sheet; each question carries its working. */

import { STARS, lumOf, sci, plain, short, SIGMA, WIEN, LSUN, RSUN, PC, LY, AU, C, MPC, YEAR, G, MSUN, type Star } from './data';
import { pick, shuffle } from '../../lib/util';

export type Topic = 'bb' | 'dist' | 'cosmo' | 'life' | 'binary';
export const TOPICS: [Topic | 'all', string, string?][] = [
  ['all', 'Everything', 'All'], ['bb', 'Black bodies', 'Black'], ['dist', 'Distances', 'Dist.'], ['cosmo', 'Redshift and Hubble', 'Hubble'], ['life', 'HR and life cycle', 'Life'], ['binary', 'Binaries', 'Pairs'],
];

export interface Question { topic: Topic; prompt: string; options: string[]; answer: string; working: string[]; why: string; figure?: Figure }
export type Figure = { kind: 'star'; T: number; name: string } | { kind: 'spectrum'; z: number } | { kind: 'hr'; mark?: string };

const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const r3 = (x: number) => Number(x.toPrecision(3));
const r2 = (x: number) => Number(x.toPrecision(2));

/** Four distinct options: the answer and the slips, formatted with a unit. */
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

const starsWith = (f: (s: Star) => boolean) => STARS.filter((s) => s.id !== 'sun' && f(s));

/* ---------- black bodies ---------- */

function wienT(): Question {
  const s = pick(starsWith(() => true));
  const lam = r3((WIEN / s.T) * 1e9);           // nm
  const T = WIEN / (lam * 1e-9);
  return {
    topic: 'bb', figure: { kind: 'star', T: s.T, name: s.name },
    prompt: `The radiation from ${s.name} has its peak intensity at a wavelength of ${lam} nm. Calculate the surface temperature of ${s.name}.`,
    ...opts(T, [T * 1e3, T / 1e3, (lam * 1e-9) / WIEN * 1e10], 'K', (x) => sci(x, 3, 1e-3, 1e6)),
    working: [`λmax T = 2.898 × 10⁻³ m K`, `T = 2.898 × 10⁻³ ÷ (${lam} × 10⁻⁹) = ${sci(T, 3, 1e-3, 1e6)} K`],
    why: 'Convert nm to m first (× 10⁻⁹). Hotter stars peak at shorter wavelengths.',
  };
}

function wienL(): Question {
  const T = r2(ri(25, 400) * 100);
  const lam = WIEN / T;
  return {
    topic: 'bb',
    figure: { kind: 'star', T, name: 'the star' },
    prompt: `A star has a surface temperature of ${short(T)} K. Calculate the wavelength at which it emits most strongly.`,
    ...opts(lam, [lam * 1e3, T / WIEN * 1e-12, lam * 2.898], 'm'),
    working: [`λmax = 2.898 × 10⁻³ ÷ T = 2.898 × 10⁻³ ÷ ${short(T)} = ${sci(lam)} m (${plain(lam * 1e9)} nm)`],
    why: lam * 1e9 < 400 ? 'Its peak is in the ultraviolet: such a star looks blue-white.' : lam * 1e9 > 700 ? 'Its peak is in the infrared: such a star looks red.' : 'Its peak is in the visible range.',
  };
}

function stefanL(): Question {
  const s = pick(starsWith(() => true));
  const r = s.R * RSUN, L = SIGMA * 4 * Math.PI * r * r * s.T ** 4;
  return {
    topic: 'bb', figure: { kind: 'star', T: s.T, name: s.name },
    prompt: `${s.name} has a radius of ${sci(r)} m and a surface temperature of ${sci(s.T, 3, 1e-3, 1e6)} K. Calculate its luminosity.`,
    ...opts(L, [L / (4 * Math.PI), L * 4, SIGMA * 4 * Math.PI * r * r * s.T ** 2, L / r], 'W'),
    working: [`L = σAT⁴ = σ × 4πr² × T⁴`, `L = 5.67 × 10⁻⁸ × 4π × (${sci(r)})² × (${sci(s.T, 3, 1e-3, 1e6)})⁴ = ${sci(L)} W`],
    why: 'A is the surface area of a sphere, 4πr². Watch the fourth power: doubling T multiplies L by 16.',
  };
}

function stefanR(): Question {
  const s = pick(starsWith(() => true));
  const L = r3(lumOf(s) * LSUN), r = Math.sqrt(L / (4 * Math.PI * SIGMA * s.T ** 4));
  return {
    topic: 'bb', figure: { kind: 'star', T: s.T, name: s.name },
    prompt: `${s.name} has a luminosity of ${sci(L)} W and a surface temperature of ${sci(s.T, 3, 1e-3, 1e6)} K. Calculate its radius.`,
    ...opts(r, [r * r, r * Math.sqrt(4 * Math.PI), r * 2, r / Math.sqrt(4 * Math.PI)], 'm'),
    working: [`L = σ4πr²T⁴  ⇒  r = √(L ÷ 4πσT⁴)`, `r = √(${sci(L)} ÷ (4π × 5.67 × 10⁻⁸ × (${sci(s.T, 3, 1e-3, 1e6)})⁴)) = ${sci(r)} m`, `That is ${sci(r / RSUN)} times the Sun’s radius.`],
    why: s.group === 'dwarf' ? 'Tiny, about the size of the Earth: a white dwarf.' : s.group === 'supergiant' || s.group === 'giant' ? 'Huge: luminous despite its temperature because of its enormous surface area.' : 'A main-sequence star.',
  };
}

function ratio(): Question {
  const pairs: [string, string][] = [['sirius-b', 'sirius-a'], ['procyon-b', 'procyon-a'], ['betelgeuse', 'rigel'], ['aldebaran', 'vega'], ['40-eri-b', 'sun'], ['arcturus', 'sun']];
  const [a, b] = pick(pairs).map((id) => STARS.find((s) => s.id === id)!);
  const La = lumOf(a), Lb = lumOf(b), q = Math.sqrt(La / Lb) * (b.T / a.T) ** 2;
  const Lr = r3(La / Lb);
  return {
    topic: 'bb',
    prompt: `${a.name} has a surface temperature of ${short(a.T)} K and ${b.name} ${short(b.T)} K. The luminosity of ${a.name} is ${sci(Lr)} times that of ${b.name}. Calculate radius of ${a.name} ÷ radius of ${b.name}.`,
    ...opts(q, [1 / q, Math.sqrt(Lr) * (b.T / a.T) ** 4, Lr * (b.T / a.T) ** 2, Math.sqrt(Lr) * (a.T / b.T) ** 2], '', (x) => sci(x)),
    working: [`L ∝ r²T⁴  ⇒  r ∝ √L ÷ T²`, `rA/rB = √(LA/LB) × (TB/TA)² = √(${sci(Lr)}) × (${short(b.T)} ÷ ${short(a.T)})² = ${sci(q)}`],
    why: a.T > b.T && La < Lb ? `${a.name} is hotter yet fainter, so it must be far smaller.` : `${a.name} is cooler yet brighter, so it must be far larger.`,
  };
}

/* ---------- distances ---------- */

function inverse(): Question {
  const s = pick(starsWith((x) => x.d > 0 && x.d < 300));
  const L = r3(lumOf(s) * LSUN), dly = r3((s.d * PC) / LY), d = dly * LY, I = L / (4 * Math.PI * d * d);
  return {
    topic: 'dist', figure: { kind: 'star', T: s.T, name: s.name },
    prompt: `${s.name} has a luminosity of ${sci(L)} W and is ${short(dly)} light-years away. Calculate the intensity of its radiation at the Earth. (1 light-year = 9.46 × 10¹⁵ m)`,
    ...opts(I, [L / (4 * Math.PI * d), L / (d * d), L / (4 * Math.PI * dly * dly), I * 4 * Math.PI], 'W m⁻²'),
    working: [`d = ${short(dly)} × 9.46 × 10¹⁵ = ${sci(d)} m`, `I = L ÷ 4πd² = ${sci(L)} ÷ (4π × (${sci(d)})²) = ${sci(I)} W m⁻²`],
    why: 'The power spreads over a sphere of area 4πd², so intensity falls as 1/d².',
  };
}

function candle(): Question {
  const cep = Math.random() < 0.6;
  const L = cep ? r2(10 ** (2.8 + Math.random() * 1.6)) * LSUN : 1.5e36;
  const dpc = cep ? r2(10 ** (3.5 + Math.random() * 3)) : r2(10 ** (7.5 + Math.random() * 1.5));
  const d = dpc * PC, I = r3(L / (4 * Math.PI * d * d)), dd = Math.sqrt(L / (4 * Math.PI * I));
  return {
    topic: 'dist',
    prompt: cep
      ? `The period of a Cepheid variable in a distant galaxy shows that its mean luminosity is ${sci(L)} W. The mean intensity of its radiation at the Earth is ${sci(I)} W m⁻². Calculate the distance to the galaxy.`
      : `A type Ia supernova in a distant galaxy has a peak luminosity of ${sci(L)} W. Its peak intensity at the Earth is ${sci(I)} W m⁻². Calculate the distance to the galaxy.`,
    ...opts(dd, [dd * dd, L / (4 * Math.PI * I), Math.sqrt(L / I), dd / PC], 'm'),
    working: [`I = L ÷ 4πd²  ⇒  d = √(L ÷ 4πI)`, `d = √(${sci(L)} ÷ (4π × ${sci(I)})) = ${sci(dd)} m`, `= ${sci(dd / PC)} pc`],
    why: cep ? 'A Cepheid is a standard candle: its period tells you its luminosity.' : 'Type Ia supernovae all explode at the same mass, so they all have the same peak luminosity.',
  };
}

function parallax(): Question {
  const s = pick(starsWith((x) => x.d > 0 && x.d < 30));
  const p = r3(1 / s.d), pr = (p / 3600) * (Math.PI / 180), d = AU / Math.tan(pr);
  return {
    topic: 'dist', figure: { kind: 'star', T: s.T, name: s.name },
    prompt: `The parallax angle of ${s.name} is ${p} arcseconds. Calculate its distance in metres. (1 AU = 1.50 × 10¹¹ m)`,
    ...opts(d, [AU / Math.tan((p * Math.PI) / 180), AU / p, (2 * AU) / Math.tan(pr), d / 3600], 'm'),
    working: [`p = ${p} ÷ 3600 = ${sci(p / 3600)}°`, `d = 1 AU ÷ tan p = 1.50 × 10¹¹ ÷ tan(${sci(p / 3600)}°) = ${sci(d)} m`, `(or d = 1/p = ${short(1 / p)} pc = ${sci(PC / p)} m)`],
    why: 'One arcsecond is 1/3600 of a degree. The baseline is the radius of the Earth’s orbit, 1 AU.',
  };
}

/* ---------- redshift and Hubble ---------- */

function redshift(): Question {
  const z = r2(0.005 + Math.random() * 0.12), lab = pick([656.3, 486.1, 434.0]), obs = r3(lab * (1 + z) * 10) / 10;
  const zz = (obs - lab) / lab, v = zz * C;
  return {
    topic: 'cosmo', figure: { kind: 'spectrum', z: zz },
    prompt: `A hydrogen line with a laboratory wavelength of ${lab} nm is observed at ${obs} nm in the spectrum of a galaxy. Calculate the speed at which the galaxy is moving away from us.`,
    ...opts(v, [zz, (obs / lab) * C, ((obs - lab) / obs) * C * 1.08, v / 1e3], 'm s⁻¹'),
    working: [`z = Δλ/λ = (${obs} − ${lab}) ÷ ${lab} = ${sci(zz)}`, `v = cz = 3.00 × 10⁸ × ${sci(zz)} = ${sci(v)} m s⁻¹`],
    why: 'The line is shifted to a longer wavelength (redshift), so the galaxy is moving away. z = v/c works when v is much less than c.',
  };
}

function hubbleD(): Question {
  const H0 = pick([68, 70, 71, 72, 73]), v = ri(20, 300) * 100, d = v / H0;
  return {
    topic: 'cosmo',
    prompt: `A galaxy is moving away from us at ${short(v)} km s⁻¹. Taking the Hubble constant as ${H0} km s⁻¹ Mpc⁻¹, calculate its distance in metres.`,
    ...opts(d * MPC, [d, v * H0 * MPC, (d * MPC) / 1e3, d * PC], 'm'),
    working: [`d = v ÷ H₀ = ${short(v)} ÷ ${H0} = ${sci(d)} Mpc`, `d = ${sci(d)} × 3.08 × 10²² m = ${sci(d * MPC)} m`],
    why: 'Keep the units matched: km s⁻¹ ÷ km s⁻¹ Mpc⁻¹ gives Mpc.',
  };
}

function age(): Question {
  const H0 = pick([2.1e-18, 2.2e-18, 2.3e-18, 2.4e-18]), t = 1 / H0 / YEAR;
  return {
    topic: 'cosmo',
    prompt: `The Hubble constant is ${sci(H0)} s⁻¹. Estimate the age of the universe in years.`,
    ...opts(t, [1 / H0, H0 * YEAR * 1e35, t / 2, t * 2.5], 'years'),
    working: [`t ≈ 1/H₀ = 1 ÷ ${sci(H0)} = ${sci(1 / H0)} s`, `÷ 3.15 × 10⁷ s per year = ${sci(t)} years`],
    why: 'If galaxies have always moved apart at the same speed, then time = distance ÷ speed = d ÷ (H₀d) = 1/H₀ for all of them.',
  };
}

/* ---------- HR diagram and life cycle ---------- */

const CONCEPTS: Omit<Question, 'topic'>[] = [
  { prompt: 'What stops a main-sequence star from collapsing under gravity?', answer: 'Radiation and gas pressure from fusion in the core', options: ['Radiation and gas pressure from fusion in the core', 'Electron degeneracy pressure', 'Neutron degeneracy pressure', 'Its spin'], working: [], why: 'On the main sequence the hot core’s pressure balances gravity. Degeneracy pressure holds up white dwarfs and neutron stars, which have no fusion.', figure: { kind: 'hr' } },
  { prompt: 'Which star has the shortest main-sequence lifetime?', answer: 'A 20 M☉ star', options: ['A 20 M☉ star', 'A 1 M☉ star', 'A 0.2 M☉ star', 'They all last the same time'], working: ['Lifetime ∝ M/L and L ∝ M^3.5, so lifetime ∝ M^−2.5.'], why: 'Massive stars have more fuel but burn it far faster.' },
  { prompt: 'What will the Sun become at the end of its life?', answer: 'A white dwarf', options: ['A white dwarf', 'A neutron star', 'A black hole', 'A red supergiant that explodes'], working: [], why: 'Its core will be well under 1.4 M☉: red giant, planetary nebula, white dwarf.' },
  { prompt: 'Sirius B is hotter than Sirius A but far less luminous. What does this tell us about Sirius B?', answer: 'It is much smaller', options: ['It is much smaller', 'It is much further away', 'It is much less massive', 'It is younger'], working: ['L = σ4πr²T⁴: a higher T with a lower L means a much smaller r.'], why: 'Both are the same distance away (a binary pair). Sirius B is a white dwarf, about the size of the Earth.' },
  { prompt: 'Where on an HR diagram are red giants found?', answer: 'Top right', options: ['Top right', 'Bottom left', 'Top left', 'Bottom right'], working: [], why: 'Cool (right) but very luminous (top) because they are so large.', figure: { kind: 'hr', mark: 'giant' } },
  { prompt: 'Where on an HR diagram are white dwarfs found?', answer: 'Bottom left', options: ['Bottom left', 'Top right', 'Top left', 'Bottom right'], working: [], why: 'Hot (left) but very faint (bottom) because they are so small.', figure: { kind: 'hr', mark: 'dwarf' } },
  { prompt: 'What happens to a star of 15 M☉ after it has become a red supergiant?', answer: 'It explodes as a supernova and leaves a neutron star', options: ['It explodes as a supernova and leaves a neutron star', 'It sheds a planetary nebula and leaves a white dwarf', 'It collapses quietly into a black dwarf', 'It returns to the main sequence'], working: [], why: 'Once its core is iron, fusion stops releasing energy; the core collapses and the star explodes. A core between 1.4 and about 3 M☉ becomes a neutron star.' },
  { prompt: 'Why does a star leave the main sequence?', answer: 'Its core runs out of hydrogen', options: ['Its core runs out of hydrogen', 'Its surface runs out of hydrogen', 'It loses most of its mass', 'Its core cools down'], working: [], why: 'Without hydrogen fusion the core contracts and heats; hydrogen fuses in a shell around it and the outer layers swell.' },
  { prompt: 'What makes a type Ia supernova a standard candle?', answer: 'Each one is a white dwarf exploding at about 1.4 M☉, so each has the same peak luminosity', options: ['Each one is a white dwarf exploding at about 1.4 M☉, so each has the same peak luminosity', 'They are all the same distance away', 'They all have the same temperature', 'Their brightness pulses with a regular period'], working: [], why: 'Known luminosity + measured intensity gives the distance: d = √(L/4πI).' },
  { prompt: 'Why can trigonometric parallax not be used for distant galaxies?', answer: 'The parallax angle is too small to measure', options: ['The parallax angle is too small to measure', 'Galaxies move too fast', 'Galaxies are not bright enough to see', 'The Earth’s orbit is not circular'], working: ['p (arcsec) = 1/d (pc): a galaxy a million pc away has p = 10⁻⁶″.'], why: 'Even Gaia only measures parallaxes down to about 10 microarcseconds.' },
  { prompt: 'What does a redshift in a galaxy’s spectrum show?', answer: 'The galaxy is moving away from us', options: ['The galaxy is moving away from us', 'The galaxy is moving towards us', 'The galaxy is very hot', 'The galaxy contains a lot of hydrogen'], working: [], why: 'Wavelengths are stretched when the source recedes (Doppler effect).' },
  { prompt: 'Stars in the outer parts of spiral galaxies orbit faster than the visible mass predicts. What does this suggest?', answer: 'There is mass we cannot see: dark matter', options: ['There is mass we cannot see: dark matter', 'Gravity is weaker far from the centre', 'The galaxies are expanding', 'The stars are younger at the edge'], working: ['v = √(GM/r): a flat curve needs M to keep growing with r.'], why: 'The extra mass affects the age and fate of the universe, which is why its amount matters.' },
  { prompt: 'Why is the Hubble constant hard to measure accurately?', answer: 'The distances to far galaxies are uncertain', options: ['The distances to far galaxies are uncertain', 'Redshift cannot be measured accurately', 'Galaxies do not move in straight lines', 'The speed of light is uncertain'], working: [], why: 'Wavelengths are measured very precisely; distances rest on the whole ladder of methods, each with its own uncertainty.' },
  { prompt: 'Which order of stages does a 15 M☉ star go through after the main sequence?', answer: 'Red giant → red supergiant → supernova → neutron star', options: ['Red giant → red supergiant → supernova → neutron star', 'Red giant → planetary nebula → white dwarf', 'Red supergiant → planetary nebula → neutron star', 'Supernova → red supergiant → black hole'], working: [], why: 'Massive stars also swell into red giants first, then red supergiants as heavier elements fuse; the iron core collapses (type II supernova) leaving a neutron star (core 1.4–3 M☉).' },
  { prompt: 'Where are blue supergiants such as Rigel found on an HR diagram?', answer: 'Top left', options: ['Top left', 'Top right', 'Bottom left', 'Middle of the main sequence'], working: [], why: 'Very hot (left) and extremely luminous (top): both their temperature and their radius are large.', figure: { kind: 'hr' } },
  { prompt: 'Why does a brown dwarf never become a main-sequence star?', answer: 'Its core never gets hot enough for hydrogen fusion', options: ['Its core never gets hot enough for hydrogen fusion', 'It runs out of hydrogen too quickly', 'Its gravity is too strong', 'It is made of helium, not hydrogen'], working: [], why: 'Below about 0.08 M☉ contraction cannot heat the core to the 10⁷ K needed for nuclei to overcome their electrostatic repulsion.' },
  { prompt: 'What is a Cepheid variable?', answer: 'A giant or supergiant whose luminosity varies with a regular period as its outer layers expand and contract', options: ['A giant or supergiant whose luminosity varies with a regular period as its outer layers expand and contract', 'A pair of stars that eclipse each other', 'A white dwarf that flares when it gains mass', 'A rapidly spinning neutron star'], working: [], why: 'Its period tells you its average luminosity (the period–luminosity relationship), so it is a standard candle. An eclipsing binary also varies, but not because either star changes.' },
  { prompt: 'Two Cepheids in the same galaxy have periods of 5 days and 30 days. Which is more luminous?', answer: 'The 30-day Cepheid', options: ['The 30-day Cepheid', 'The 5-day Cepheid', 'They are equally luminous', 'It depends on their distance'], working: [], why: 'Period–luminosity relationship: the longer the period, the greater the luminosity. (Being in the same galaxy, they are the same distance away, so the 30-day one also looks brighter.)' },
  { prompt: 'On an HR diagram, where are Cepheid variables found?', answer: 'In the instability strip, between the main sequence and the red giants', options: ['In the instability strip, between the main sequence and the red giants', 'At the bottom left with the white dwarfs', 'At the bottom right with the red dwarfs', 'At the top of the main sequence'], working: [], why: 'Giants and supergiants pulsate while they cross the instability strip, at about 5000–7500 K.', figure: { kind: 'hr' } },
  { prompt: 'What is the difference between a type Ia and a type II supernova?', answer: 'Type Ia is a white dwarf in a binary reaching 1.4 M☉; type II is the core collapse of a massive star', options: ['Type Ia is a white dwarf in a binary reaching 1.4 M☉; type II is the core collapse of a massive star', 'Type Ia is a massive star; type II is a white dwarf', 'Type II is always brighter than type Ia', 'Type Ia leaves a neutron star; type II leaves a white dwarf'], working: [], why: 'Type Ia all explode at the same mass, so they have the same peak luminosity and are standard candles; type II vary.' },
  { prompt: 'In a supergiant, what is the last element made by fusion in the core?', answer: 'Iron', options: ['Iron', 'Carbon', 'Helium', 'Uranium'], working: [], why: 'Fusing iron takes in energy rather than releasing it, so the core can no longer support itself and collapses.' },
];

function concept(): Question {
  const c = pick(CONCEPTS);
  return { ...c, topic: 'life', options: shuffle([...c.options]) };
}

/* ---------- binaries ---------- */

function binaryMass(): Question {
  const sys = pick([
    { name: 'Sirius A and Sirius B', a: 19.8, P: 50.1, unitP: 'years' },
    { name: 'Alpha Centauri A and B', a: 23.4, P: 79.9, unitP: 'years' },
    { name: 'Procyon A and Procyon B', a: 15.1, P: 40.8, unitP: 'years' },
  ]);
  const a = sys.a * AU, P = sys.P * YEAR, M = (4 * Math.PI ** 2 * a ** 3) / (G * P * P);
  return {
    topic: 'binary',
    prompt: `${sys.name} orbit their common centre of mass with a period of ${sys.P} ${sys.unitP}. Their separation is ${sys.a} AU. Calculate the total mass of the pair. (1 AU = 1.50 × 10¹¹ m, 1 year = 3.15 × 10⁷ s)`,
    ...opts(M, [(4 * Math.PI ** 2 * a * a) / (G * P * P), (4 * Math.PI ** 2 * a ** 3) / (G * P), (4 * Math.PI ** 2 * sys.a ** 3) / (G * P * P), M * YEAR], 'kg'),
    working: [
      'Gravity provides the centripetal force: GM₁M₂/a² = M₁ω²r₁ = M₂ω²r₂, and r₁ + r₂ = a, so ω²a³ = G(M₁ + M₂)',
      `M = 4π²a³ ÷ GP² = 4π² × (${sci(a)})³ ÷ (6.67 × 10⁻¹¹ × (${sci(P)})²) = ${sci(M)} kg`,
      `= ${plain(M / MSUN)} M☉`,
    ],
    why: 'This is how star masses are measured: from the orbits of binary stars.',
  };
}

function binaryDoppler(): Question {
  const dl = r2(0.12 + Math.random() * 0.4), v = (dl / 656.3) * C;
  return {
    topic: 'binary', figure: { kind: 'spectrum', z: dl / 656.3 },
    prompt: `In the spectrum of a spectroscopic binary, the Hα line (656.3 nm) of one star is shifted by up to ${dl} nm either side of its usual wavelength, once per orbit. Calculate the star’s orbital speed along our line of sight.`,
    ...opts(v, [v / 1e3, (dl / 656.3) * 3e5 * 1e6, (2 * dl / 656.3) * C, (dl / (656.3 + dl)) * C * 1.1], 'm s⁻¹'),
    working: [`Δλ/λ = v/c`, `v = cΔλ/λ = 3.00 × 10⁸ × ${dl} ÷ 656.3 = ${sci(v)} m s⁻¹`],
    why: 'Moving towards us the line is blueshifted, moving away it is redshifted; the swing repeats every orbit.',
  };
}

const BIN_CONCEPTS: Omit<Question, 'topic'>[] = [
  { prompt: 'The light curve of an eclipsing binary has two dips of different depths. When does the deeper dip happen?', answer: 'When the hotter star is hidden behind the cooler one', options: ['When the hotter star is hidden behind the cooler one', 'When the cooler star is hidden behind the hotter one', 'When the stars are furthest apart', 'When the larger star is moving towards us'], working: ['Intensity from each square metre ∝ T⁴.'], why: 'The same area of the hotter surface is blocked in each eclipse, but the hotter surface gives out more power per square metre.' },
  { prompt: 'How do astronomers know Cygnus X-1 contains a black hole?', answer: 'The visible star’s orbit shows its unseen companion has about 21 M☉, too much for a neutron star', options: ['The visible star’s orbit shows its unseen companion has about 21 M☉, too much for a neutron star', 'They can see the event horizon in photographs', 'The black hole emits visible light', 'The visible star is a red giant'], working: [], why: 'Above about 3 M☉ nothing can stop the collapse. X-rays come from gas heated in the accretion disc.' },
  { prompt: 'Why is a type Ia supernova used as a standard candle?', answer: 'Each one is a white dwarf reaching 1.4 M☉, so all have the same peak luminosity', options: ['Each one is a white dwarf reaching 1.4 M☉, so all have the same peak luminosity', 'They all occur at the same distance', 'They pulsate with a regular period', 'They all leave the same black hole'], working: [], why: 'Known L, measured I: d = √(L/4πI).' },
  { prompt: 'Two stars in a binary have masses 2M and M. How do the radii of their orbits about the centre of mass compare?', answer: 'The heavier star’s orbit is half the radius of the lighter star’s', options: ['The heavier star’s orbit is half the radius of the lighter star’s', 'The heavier star’s orbit is twice the radius', 'Both orbits have the same radius', 'The heavier star does not move'], working: ['About the centre of mass: M₁r₁ = M₂r₂, so 2M × r₁ = M × r₂.'], why: 'They share the same period, so the heavier star also moves at half the speed.' },
  { prompt: 'A binary is seen exactly face-on (we look down on the orbit). What will we observe?', answer: 'No Doppler shift and no eclipses', options: ['No Doppler shift and no eclipses', 'The largest Doppler shift', 'Eclipses every half orbit', 'The lines split into two every orbit'], working: [], why: 'The stars move across the sky, never towards or away from us, and never in front of each other.' },
];

function binConcept(): Question { const c = pick(BIN_CONCEPTS); return { ...c, topic: 'binary', options: shuffle([...c.options]) }; }

const GEN: Record<Topic, (() => Question)[]> = {
  bb: [wienT, wienL, stefanL, stefanR, ratio],
  dist: [inverse, candle, parallax],
  cosmo: [redshift, hubbleD, age],
  life: [concept],
  binary: [binaryMass, binaryDoppler, binConcept, binConcept],
};

export function newQuestion(t: Topic | 'all'): Question {
  if (t === 'all') {
    const topic = pick(['bb', 'bb', 'dist', 'dist', 'cosmo', 'life', 'life', 'binary'] as Topic[]);
    return pick(GEN[topic])();
  }
  return pick(GEN[t])();
}
