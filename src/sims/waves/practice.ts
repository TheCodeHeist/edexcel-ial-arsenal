/* Practice: generated exam-style questions on Unit 2 waves and the particle nature of light (spec 33–63), four
   options each. Wrong options are the slips students make: forgetting to halve an echo time, using a diameter as a
   radius, leaving lines per mm unconverted, mixing degrees and radians, eV and J, forgetting the 4π or the square
   root. Constants as on the data sheet; every question carries its working. */

import { C, H, E, ME, G, sci, plain, short } from './consts';
import { pick, shuffle } from '../../lib/util';

export type Topic = 'waves' | 'superpose' | 'standing' | 'light' | 'diffract' | 'echo' | 'photon';
export const TOPICS: [Topic | 'all', string, string?][] = [
  ['all', 'Everything', 'All'], ['waves', 'Wave basics', 'Basics'], ['superpose', 'Superposition and phase', 'Phase'], ['standing', 'Standing waves', 'Standing'],
  ['light', 'Refraction and polarisation', 'Light'], ['diffract', 'Diffraction and de Broglie', 'Diffract'], ['echo', 'Pulse–echo', 'Echo'], ['photon', 'Photons and spectra', 'Photons'],
];
export const TOPIC_NAME: Record<Topic, string> = {
  waves: 'Wave basics', superpose: 'Superposition and phase', standing: 'Standing waves', light: 'Refraction, TIR and polarisation', diffract: 'Diffraction and de Broglie', echo: 'Pulse–echo', photon: 'Photons and line spectra',
};

export type Figure =
  | { kind: 'wave'; axis: 'x' | 't'; cycles: number; end: string; amp: string }
  | { kind: 'standing'; loops: number; len: string }
  | { kind: 'ray'; i: number; r: number | null; top: string; bottom: string }
  | { kind: 'levels'; levels: number[]; from: number; to: number }
  | { kind: 'grating'; order: number }
  | { kind: 'scope'; divs: number; tb: string }
  | { kind: 'echo'; t1: number; t2: number; unit: string };
export interface Question { topic: Topic; prompt: string; options: string[]; answer: string; working: string[]; why: string; figure?: Figure }

const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

function opts(ans: number, slips: number[], unit: string, fmt: (x: number) => string = (x) => sci(x)) {
  const f = (x: number) => `${fmt(x)} ${unit}`.trim();
  const answer = f(ans);
  const out = new Set([answer]);
  for (const w of [...slips, ans * 10, ans / 10, ans * 2, ans / 2, ans * 4, ans * 3]) {
    if (out.size >= 4) break;
    if (isFinite(w) && w > 0 && Math.abs(w / ans - 1) > 0.04 && !out.has(f(w))) out.add(f(w));
  }
  return { options: shuffle([...out]), answer };
}
function choice(answer: string, wrong: string[]) {
  const out = [answer, ...shuffle(wrong.filter((w) => w !== answer)).slice(0, 3)];
  return { options: shuffle(out), answer };
}
const p3 = (x: number) => plain(x, 3);
const nmText = (m: number) => `${short(m * 1e9)} nm`;
/** A signed number with a true minus sign. */
const neg = (x: number | string) => String(x).replace('-', '−');

/* ---------- wave basics: 33–38 ---------- */
const WAVES: (() => Question)[] = [
  () => { const f = pick([256, 320, 440, 512, 680, 850]), lam = ri(40, 140) / 100, v = f * lam;
    return { topic: 'waves', prompt: `A sound wave of frequency ${f} Hz has a wavelength of ${lam} m. What is its speed?`, ...opts(v, [f / lam, lam / f], 'm s⁻¹', p3),
      working: ['v = fλ', `v = ${f} × ${lam} = ${p3(v)} m s⁻¹`], why: 'One wavelength passes a point in each cycle, and there are f cycles every second.' }; },
  () => { const nm = ri(40, 70) * 10, f = C / (nm * 1e-9);
    return { topic: 'waves', prompt: `Light of wavelength ${nm} nm travels through a vacuum. What is its frequency?`, ...opts(f, [C * nm * 1e-9, C / nm, (nm * 1e-9) / C], 'Hz'),
      working: ['f = c/λ', `f = 3.00 × 10⁸ ÷ ${sci(nm * 1e-9)} = ${sci(f)} Hz`], why: 'Convert nm to m first: 1 nm = 10⁻⁹ m.' }; },
  () => { const cyc = pick([1.5, 2, 2.5, 3]), len = ri(3, 12) * 10, lam = len / cyc / 100, f = ri(2, 9) * 5, v = f * lam;
    return { topic: 'waves', prompt: `The graph shows the displacement of a rope against distance at one instant. The wave has frequency ${f} Hz. What is its speed?`,
      ...opts(v, [f * (len / 100), f * lam * 2, f * lam / 2], 'm s⁻¹', p3),
      working: [`${cyc} wavelengths fit in ${len} cm, so λ = ${len} ÷ ${cyc} = ${p3(lam * 100)} cm = ${p3(lam)} m`, `v = fλ = ${f} × ${p3(lam)} = ${p3(v)} m s⁻¹`],
      why: 'On a displacement–distance graph, one wavelength is one full cycle (crest to crest), not the whole length of the graph.',
      figure: { kind: 'wave', axis: 'x', cycles: cyc, end: `${len} cm`, amp: '' } }; },
  () => { const cyc = pick([2, 2.5, 3, 4]), ms = pick([4, 5, 6, 8, 10, 12]), T = ms / cyc / 1000, f = 1 / T;
    return { topic: 'waves', prompt: 'The graph shows how the displacement of one particle in a wave varies with time. What is the frequency of the wave?',
      ...opts(f, [1 / (ms / 1000), T, f * 2], 'Hz', p3),
      working: [`${cyc} cycles take ${ms} ms, so T = ${ms} ÷ ${cyc} = ${p3(T * 1000)} ms`, `f = 1/T = 1 ÷ ${sci(T)} s = ${p3(f)} Hz`],
      why: 'A displacement–time graph gives the period T (one full cycle), not the wavelength.', figure: { kind: 'wave', axis: 't', cycles: cyc, end: `${ms} ms`, amp: '' } }; },
  () => ({ topic: 'waves', prompt: 'Which statement describes a longitudinal wave?', ...choice('The particles oscillate parallel to the direction in which the wave transfers energy', [
    'The particles oscillate at right angles to the direction in which the wave transfers energy', 'The particles move along with the wave, carrying energy with them',
    'It can be plane polarised', 'It can travel through a vacuum']),
    working: ['Sound is the usual example: layers of air move back and forth along the direction the sound travels', 'This makes compressions (high pressure) and rarefactions (low pressure)'],
    why: 'In any wave the particles only oscillate about fixed positions; energy is transferred, matter is not.' }),
  () => ({ topic: 'waves', prompt: 'In a sound wave in air, what is the distance between the centre of a compression and the centre of the next rarefaction?', ...choice('Half a wavelength', ['One wavelength', 'A quarter of a wavelength', 'Two wavelengths', 'The amplitude']),
    working: ['Compression to compression = λ', 'Compression to the next rarefaction = λ/2'], why: 'Compressions are the pressure maxima and rarefactions the pressure minima: like crests and troughs on a pressure–distance graph.' }),
  () => ({ topic: 'waves', prompt: 'Which of these is a transverse wave?', ...choice(pick(['Light', 'A ripple on water', 'A wave on a guitar string', 'A microwave']), ['Sound in air', 'Ultrasound in the body', 'A compression wave along a slinky', 'A primary (P) seismic wave']),
    working: ['Transverse: oscillations at right angles to the energy transfer (all EM waves, waves on strings and water surfaces)', 'Longitudinal: oscillations along the energy transfer (sound, ultrasound, P waves)'], why: 'Only transverse waves can be plane polarised.' }),
  () => { const tb = pick([0.1, 0.2, 0.5, 1]), divs = pick([2, 2.5, 4, 5]), T = (tb * divs) / 1000, f = 1 / T;
    const moved = Number(((340 / f) * 2).toPrecision(2)), lamM = moved / 2, v = f * lamM;
    return { topic: 'waves', prompt: `Core Practical 4. A loudspeaker and a microphone are connected to a two-beam oscilloscope (time base ${tb} ms div⁻¹; one cycle of the trace spans ${divs} divisions). The microphone is moved away from the speaker; the two traces come back into phase twice in a distance of ${moved} m. What is the speed of sound?`,
      ...opts(v, [f * moved, (1000 / tb) * lamM, f * lamM / 2], 'm s⁻¹', p3),
      working: [`T = ${divs} div × ${tb} ms div⁻¹ = ${p3(T * 1000)} ms, so f = 1/T = ${p3(f)} Hz`, `Back in phase twice in ${moved} m: 2λ = ${moved} m, λ = ${p3(lamM)} m`, `v = fλ = ${p3(f)} × ${p3(lamM)} = ${p3(v)} m s⁻¹`],
      why: 'Each time the traces return to being in phase, the microphone has moved one more wavelength. Measuring over several wavelengths reduces the percentage uncertainty.',
      figure: { kind: 'scope', divs, tb: `${tb} ms div⁻¹` } }; },
  () => ({ topic: 'waves', prompt: 'What is the amplitude of a wave?', ...choice('The maximum displacement of a particle from its equilibrium position', ['The distance from a crest to a trough', 'The distance between two adjacent crests', 'The number of oscillations per second', 'The maximum speed of a particle']),
    working: ['Crest to trough is 2 × amplitude', 'Crest to crest is one wavelength'], why: 'Amplitude is measured from the equilibrium (undisturbed) position.' }),
];

/* ---------- superposition and phase: 39–40 ---------- */
const SUPER: (() => Question)[] = [
  () => { const lam = ri(4, 16) * 5, frac = pick([0.25, 0.5, 0.75, 1 / 3, 1.25, 1.5]), dx = Number((lam * frac).toPrecision(3)), phi = (2 * Math.PI * dx) / lam;
    return { topic: 'superpose', prompt: `Two points on a progressive wave of wavelength ${lam} cm are ${dx} cm apart along the direction of travel. What is the phase difference between them?`,
      ...opts(phi, [(360 * dx) / lam, (Math.PI * dx) / lam, dx / lam], 'rad', p3),
      working: ['phase difference = 2π × (path difference / λ)', `φ = 2π × ${dx} ÷ ${lam} = ${p3(phi)} rad (= ${p3(deg(phi))}°)`], why: 'One whole wavelength is a phase difference of 2π rad (360°).' }; },
  () => { const lam = ri(2, 6) / 100, n = ri(1, 4), half = Math.random() < 0.5, s1 = ri(30, 90) / 100, s2 = s1 + (n + (half ? 0.5 : 0)) * lam;
    const ans = half ? 'Minimum (destructive interference)' : 'Maximum (constructive interference)';
    return { topic: 'superpose', prompt: `Two coherent sources S₁ and S₂ emit waves in phase, of wavelength ${short(lam * 100)} cm. A point P is ${short(s1 * 100, 4)} cm from S₁ and ${short(s2 * 100, 4)} cm from S₂. What is observed at P?`,
      ...choice(ans, [half ? 'Maximum (constructive interference)' : 'Minimum (destructive interference)', 'Neither: an intermediate amplitude', 'Nothing can be said: the sources are coherent']),
      working: [`Path difference = ${short(s2 * 100, 4)} − ${short(s1 * 100, 4)} = ${short((s2 - s1) * 100, 4)} cm = ${n + (half ? 0.5 : 0)}λ`, half ? 'An odd number of half wavelengths: the waves arrive in antiphase' : 'A whole number of wavelengths: the waves arrive in phase'],
      why: 'In phase sources: nλ path difference gives a maximum, (n + ½)λ gives a minimum.' }; },
  () => ({ topic: 'superpose', prompt: 'Two sources are coherent. What does this mean?', ...choice('They have the same frequency and a constant phase difference', ['They have the same amplitude', 'They are in phase at all times and have the same amplitude', 'They have the same speed', 'They are both plane polarised']),
    working: ['Coherence is needed for a stable (unchanging) interference pattern', 'They need not be in phase: any constant phase difference will do'], why: 'Two separate lamps are not coherent: their phase relationship changes randomly many times a second.' }),
  () => ({ topic: 'superpose', prompt: 'What does the principle of superposition state?', ...choice('Where waves meet, the resultant displacement is the vector sum of the individual displacements', ['Where waves meet, they always cancel', 'Where waves meet, the resultant amplitude is the sum of the amplitudes', 'Waves bend round obstacles', 'Waves of the same frequency travel at the same speed']),
    working: ['Displacements add (with signs) at each instant', 'The waves then carry on unchanged after passing through each other'], why: 'Interference is superposition of coherent waves, giving a fixed pattern of maxima and minima.' }),
  () => { const p = pick([['π rad', '180°', 'antiphase: crests meet troughs'], ['2π rad', '360°', 'back in phase'], ['π/2 rad', '90°', 'a quarter-cycle apart']] as const);
    const lam = ['π rad', 'π/2 rad', '2π rad'];
    const frac = p[0] === 'π rad' ? 'half a wavelength' : p[0] === '2π rad' ? 'one wavelength' : 'a quarter of a wavelength';
    return { topic: 'superpose', prompt: `Two waves from in-phase sources meet with a path difference of ${frac}. What is their phase difference?`, ...choice(p[0], [...lam.filter((x) => x !== p[0]), '4π rad']),
      working: [`φ = 2π × (Δx/λ)`, `${frac} → ${p[0]} (${p[1]}): ${p[2]}`], why: 'Phase difference in radians = 2π × path difference in wavelengths.' }; },
  () => { const phiDeg = pick([45, 60, 90, 120, 135, 270]), lam = ri(2, 9) * 10, dx = (phiDeg / 360) * lam;
    return { topic: 'superpose', prompt: `Two points on a wave of wavelength ${lam} cm oscillate ${phiDeg}° out of phase (and less than one wavelength apart). How far apart are they?`, ...opts(dx, [(phiDeg / 180) * lam, (rad(phiDeg) / Math.PI) * lam * 2, lam / phiDeg], 'cm', p3),
      working: ['Δx = (φ / 360°) × λ', `Δx = (${phiDeg} ÷ 360) × ${lam} = ${p3(dx)} cm`], why: '360° (2π rad) of phase corresponds to one wavelength of distance.' }; },
  () => ({ topic: 'superpose', prompt: 'Why is it hard to see interference between light from two separate lamps?', ...choice('The light from the two lamps is not coherent, so the pattern changes too quickly to see', [
    'Light waves cannot superpose', 'The two lamps have different speeds of light', 'Light from lamps is longitudinal', 'Interference only happens with sound']),
    working: ['Each lamp emits light in short random bursts', 'The phase difference between the lamps changes randomly, so maxima and minima move around about 10⁸ times a second'], why: 'Use one source split into two (two slits, or a laser) to get coherent waves.' }),
];

/* ---------- standing waves: 41–43 ---------- */
const STANDING: (() => Question)[] = [
  () => { const d = ri(8, 40), f = pick([50, 100, 120, 200, 256]), lam = (2 * d) / 100, v = f * lam;
    return { topic: 'standing', prompt: `A standing wave forms on a string driven at ${f} Hz. Adjacent nodes are ${d} cm apart. What is the speed of the waves on the string?`, ...opts(v, [f * (d / 100), f * (d / 100) * 4, f * d], 'm s⁻¹', p3),
      working: ['Adjacent nodes are half a wavelength apart: λ = 2 × ' + d + ' cm = ' + p3(lam) + ' m', `v = fλ = ${f} × ${p3(lam)} = ${p3(v)} m s⁻¹`], why: 'Node to node is λ/2; node to the next antinode is λ/4.', figure: { kind: 'standing', loops: 4, len: '' } }; },
  () => { const T = ri(20, 120) / 2, mu = ri(2, 40) / 10000, v = Math.sqrt(T / mu);
    return { topic: 'standing', prompt: `A string is under a tension of ${T} N and has a mass per unit length of ${sci(mu, 2)} kg m⁻¹. What is the speed of a transverse wave on it?`, ...opts(v, [T / mu, Math.sqrt(mu / T), Math.sqrt(T * mu)], 'm s⁻¹', p3),
      working: ['v = √(T/μ)', `v = √(${T} ÷ ${sci(mu, 2)}) = ${p3(v)} m s⁻¹`], why: 'Tighter strings carry waves faster; heavier strings carry them slower.' }; },
  () => { const l = ri(40, 120) / 100, m = ri(2, 10) / 10, mu = ri(5, 30) / 10000, T = m * G, v = Math.sqrt(T / mu), f = v / (2 * l);
    return { topic: 'standing', prompt: `Core Practical 5. A wire of mass per unit length ${sci(mu, 2)} kg m⁻¹ runs over a pulley to a hanging mass of ${m} kg. The vibrating length is ${l} m. What is the frequency of the fundamental (first harmonic)?`,
      ...opts(f, [v / l, Math.sqrt(m / mu) / (2 * l), v / (4 * l)], 'Hz', p3),
      working: [`T = mg = ${m} × 9.81 = ${p3(T)} N`, `v = √(T/μ) = √(${p3(T)} ÷ ${sci(mu, 2)}) = ${p3(v)} m s⁻¹`, `Fundamental: one loop, λ = 2l = ${p3(2 * l)} m`, `f = v/λ = ${p3(f)} Hz`],
      why: 'The tension is the weight of the hanging mass, not the mass itself.', figure: { kind: 'standing', loops: 1, len: `${l} m` } }; },
  () => { const n = ri(2, 5), l = ri(60, 150) / 100, lam = (2 * l) / n;
    return { topic: 'standing', prompt: `A string fixed at both ends, ${l} m long, vibrates in the pattern shown (${n} loops). What is the wavelength?`, ...opts(lam, [l / n, (4 * l) / n, l * n], 'm', p3),
      working: [`Each loop is λ/2, so ${n} × λ/2 = ${l} m`, `λ = 2 × ${l} ÷ ${n} = ${p3(lam)} m`], why: 'Count loops (antinodes), not nodes: the ends are nodes too.', figure: { kind: 'standing', loops: n, len: `${l} m` } }; },
  () => { const k = pick([['tension is increased by a factor of 4', 'doubles', 'f ∝ √T'], ['length is doubled', 'halves', 'f ∝ 1/l'], ['mass per unit length is increased by a factor of 4', 'halves', 'f ∝ 1/√μ'], ['tension is doubled', 'increases by a factor of √2', 'f ∝ √T']] as const);
    return { topic: 'standing', prompt: `For the fundamental mode of a stretched string, f = (1/2l)√(T/μ). What happens to the frequency if the ${k[0]} (everything else kept the same)?`,
      ...choice(`It ${k[1]}`, ['It doubles', 'It halves', 'It increases by a factor of 4', 'It increases by a factor of √2', 'It stays the same'].filter((x) => x !== `It ${k[1]}`)),
      working: [k[2], `So the frequency ${k[1]}`], why: 'This is what Core Practical 5 investigates: plot f against √T, 1/l or 1/√μ for a straight line through the origin.' }; },
  () => ({ topic: 'standing', prompt: 'How does the motion of two points on either side of a node compare, on a standing wave?', ...choice('They oscillate in antiphase (180° out of phase)', ['They oscillate in phase', 'They are 90° out of phase', 'They do not move', 'Their phase difference depends on how far apart they are']),
    working: ['Between two adjacent nodes, every point is in phase (different amplitudes)', 'Crossing a node flips the phase by π'], why: 'On a progressive wave phase changes steadily with distance; on a standing wave it jumps by π at each node.' }),
  () => ({ topic: 'standing', prompt: 'Which statement about a standing (stationary) wave is correct?', ...choice('It is formed by two waves of the same frequency travelling in opposite directions, and it transfers no energy', [
    'It is formed by two waves travelling in the same direction', 'All points oscillate with the same amplitude', 'The nodes move along the string at the wave speed', 'It can only form on strings, not in air columns']),
    working: ['A wave reflected from a fixed end superposes with the incoming wave', 'Nodes: always zero displacement (destructive); antinodes: maximum amplitude'], why: 'A progressive wave has the same amplitude everywhere and transfers energy; a standing wave has nodes and antinodes and transfers none.' }),
  () => { const d = ri(15, 60) / 10, rho = pick([7800, 8900, 8500]), dm = d / 10000 / 10, mu = rho * Math.PI * (dm / 2) ** 2;
    return { topic: 'standing', prompt: `A wire has diameter ${p3(d / 10)} mm and is made of metal of density ${rho} kg m⁻³. What is its mass per unit length μ?`, ...opts(mu, [rho * Math.PI * dm * dm, rho * dm, rho * Math.PI * (dm / 2) ** 2 * 1e6], 'kg m⁻¹'),
      working: ['μ = mass / length = ρ × cross-sectional area', `A = π(d/2)² = π × (${sci(dm / 2, 3)})² = ${sci(Math.PI * (dm / 2) ** 2)} m²`, `μ = ${rho} × ${sci(Math.PI * (dm / 2) ** 2)} = ${sci(mu)} kg m⁻¹`],
      why: 'Measure the diameter with a micrometer in several places; remember to halve it for the radius and convert mm to m.' }; },
];

/* ---------- light: 44–49, 55 ---------- */
const LIGHT: (() => Question)[] = [
  () => { const P = pick([40, 60, 100, 150, 500]), r = ri(10, 50) / 10, I = P / (4 * Math.PI * r * r);
    return { topic: 'light', prompt: `A ${P} W lamp radiates equally in all directions. What is the intensity ${r} m from it?`, ...opts(I, [P / (Math.PI * r * r), P / (4 * Math.PI * r), P / (r * r)], 'W m⁻²', p3),
      working: ['I = P/A, with the power spread over a sphere: A = 4πr²', `I = ${P} ÷ (4π × ${r}²) = ${p3(I)} W m⁻²`], why: 'This is the inverse-square law: double the distance, a quarter of the intensity.' }; },
  () => { const P = ri(1, 5), d = ri(10, 40) / 10, A = Math.PI * (d / 2000) ** 2, I = P / 1000 / A;
    return { topic: 'light', prompt: `A ${P} mW laser makes a circular spot ${d} mm in diameter. What is the intensity of the spot?`, ...opts(I, [P / 1000 / (Math.PI * (d / 1000) ** 2), P / (Math.PI * (d / 2000) ** 2), P / 1000 / (4 * Math.PI * (d / 2000) ** 2)], 'W m⁻²'),
      working: [`r = ${d} ÷ 2 = ${d / 2} mm = ${sci(d / 2000)} m; A = πr² = ${sci(A)} m²`, `I = P/A = ${sci(P / 1000)} ÷ ${sci(A)} = ${sci(I)} W m⁻²`], why: 'Halve the diameter for the radius, and convert mW to W and mm to m.' }; },
  () => { const n = pick([1.33, 1.46, 1.5, 1.52, 1.65, 2.42]), v = C / n;
    return { topic: 'light', prompt: `The refractive index of a material is ${n}. What is the speed of light in it?`, ...opts(v, [C * n, n / C], 'm s⁻¹'),
      working: ['n = c/v → v = c/n', `v = 3.00 × 10⁸ ÷ ${n} = ${sci(v)} m s⁻¹`], why: 'Light is slower in denser optical media, so n > 1.' }; },
  () => { const n = pick([1.33, 1.45, 1.5, 1.52]), i = ri(20, 70), r = deg(Math.asin(Math.sin(rad(i)) / n));
    return { topic: 'light', prompt: `A ray in air strikes a block of refractive index ${n} at an angle of incidence of ${i}°. What is the angle of refraction?`, ...opts(r, [i / n, deg(Math.asin(Math.min(1, Math.sin(rad(i)) * n * 0.6))), 90 - r], '°', p3),
      working: ['n₁ sin θ₁ = n₂ sin θ₂', `1.00 × sin ${i}° = ${n} × sin θ₂`, `sin θ₂ = ${p3(Math.sin(rad(i)) / n)} → θ₂ = ${p3(r)}°`], why: 'Angles are measured from the normal. Dividing the angle by n is a common slip: it is the sines that are in the ratio.',
      figure: { kind: 'ray', i, r, top: 'air', bottom: `n = ${n}` } }; },
  () => { const n1 = 1.33, n2 = pick([1.5, 1.52, 1.6]), i = ri(20, 60), r = deg(Math.asin((n1 * Math.sin(rad(i))) / n2));
    return { topic: 'light', prompt: `Light passes from water (n = ${n1}) into glass (n = ${n2}). The angle of incidence in the water is ${i}°. What is the angle of refraction in the glass?`, ...opts(r, [deg(Math.asin(Math.sin(rad(i)) / n2)), deg(Math.asin(Math.min(0.99, (n2 * Math.sin(rad(i))) / n1 * 0.8))), i * n1 / n2], '°', p3),
      working: ['n₁ sin θ₁ = n₂ sin θ₂', `${n1} × sin ${i}° = ${n2} × sin θ₂`, `θ₂ = ${p3(r)}°`], why: 'Into a medium of higher refractive index the ray bends towards the normal.', figure: { kind: 'ray', i, r, top: `water, n = ${n1}`, bottom: `glass, n = ${n2}` } }; },
  () => { const n = pick([1.33, 1.45, 1.5, 1.6, 2.42]), Cc = deg(Math.asin(1 / n));
    return { topic: 'light', prompt: `What is the critical angle for light going from a material of refractive index ${n} into air?`, ...opts(Cc, [deg(Math.acos(1 / n)), deg(Math.atan(1 / n)), 90 / n], '°', p3),
      working: ['sin C = 1/n', `sin C = 1 ÷ ${n} = ${p3(1 / n)} → C = ${p3(Cc)}°`], why: 'At the critical angle the refracted ray grazes the surface (θ = 90° in air).' }; },
  () => { const n = pick([1.45, 1.5, 1.52]), Cc = deg(Math.asin(1 / n)), th = Math.random() < 0.5 ? Math.round(Cc + ri(3, 15)) : Math.round(Cc - ri(3, 15)), tir = th > Cc;
    return { topic: 'light', prompt: `A ray inside glass (n = ${n}) meets the glass–air surface at ${th}° to the normal. What happens?`,
      ...choice(tir ? 'Total internal reflection: all of the light is reflected back into the glass' : 'Most of the light refracts out into the air, bending away from the normal; some is reflected', [
        tir ? 'Most of the light refracts out into the air, bending away from the normal; some is reflected' : 'Total internal reflection: all of the light is reflected back into the glass',
        'The light refracts along the surface (at 90°)', 'The light passes straight through without bending']),
      working: [`C = sin⁻¹(1/${n}) = ${p3(Cc)}°`, tir ? `${th}° > C, so total internal reflection` : `${th}° < C, so it refracts out (partial reflection too)`],
      why: 'TIR needs both: going from higher n to lower n, and an angle of incidence greater than C.', figure: { kind: 'ray', i: th, r: tir ? null : deg(Math.asin(Math.min(1, n * Math.sin(rad(th))))), top: `glass, n = ${n}`, bottom: 'air' } }; },
  () => { const n1 = pick([1.48, 1.5, 1.52]), n2 = pick([1.4, 1.42, 1.44]), Cc = deg(Math.asin(n2 / n1));
    return { topic: 'light', prompt: `An optical fibre has a core of refractive index ${n1} and cladding of refractive index ${n2}. What is the critical angle at the core–cladding boundary?`, ...opts(Cc, [deg(Math.asin(1 / n1)), deg(Math.asin(Math.min(0.99, n1 / n2 - 0.1))), deg(Math.asin(1 / n2))], '°', p3),
      working: ['sin C = n₂/n₁ (from n₁ sin C = n₂ sin 90°)', `sin C = ${n2} ÷ ${n1} = ${p3(n2 / n1)} → C = ${p3(Cc)}°`], why: 'The cladding has a lower refractive index than the core so that TIR can happen; it also protects the core surface.' }; },
  () => ({ topic: 'light', prompt: 'Light passes through two polarising filters. The second is rotated until no light gets through. By how much was it rotated from the position of maximum transmission?', ...choice('90°', ['180°', '45°', '360°', '30°']),
    working: ['The first filter lets through only oscillations in one plane (plane polarised light)', 'The second blocks that plane completely when its transmission axis is at 90° to the first'], why: 'At 180° the filters line up again and light gets through.' }),
  () => ({ topic: 'light', prompt: 'Why can sound waves in air not be polarised?', ...choice('They are longitudinal: the oscillations are already along the direction of travel', ['They are too slow', 'Their wavelength is too long', 'Air is not transparent to them', 'They are not electromagnetic, and only EM waves have a plane']),
    working: ['Plane polarisation restricts the oscillations to one plane containing the direction of travel', 'Only transverse waves have oscillations that can be restricted like this'], why: 'Polarisation is evidence that light is a transverse wave.' }),
  () => ({ topic: 'light', prompt: 'What is plane polarised light?', ...choice('Light in which the oscillations (of the electric field) are in one plane only, containing the direction of travel', [
    'Light of a single wavelength', 'Light whose waves are all in phase', 'Light that has been reflected from a plane mirror', 'Light travelling in one direction only']),
    working: ['Unpolarised light: oscillations in all planes perpendicular to the direction of travel', 'Polarised: one plane only. Uses: polaroid sunglasses cut glare (reflected light is partly polarised); stress analysis of plastics; LCD screens'],
    why: 'Single wavelength is “monochromatic”; constant phase relationship is “coherent”.' }),
  () => ({ topic: 'light', prompt: 'To find the refractive index of a glass block, a student measures angles of incidence i and refraction r for several rays. Which graph gives n as its gradient?', ...choice('sin i (y-axis) against sin r (x-axis)', ['i against r', 'sin r against sin i', 'r against i', 'sin i against r']),
    working: ['sin i = n sin r for a ray entering from air', 'So sin i against sin r is a straight line through the origin with gradient n'], why: 'Use a ray box and protractor; mark the rays, draw normals, repeat for several angles and use a line of best fit.' }),
  () => ({ topic: 'light', prompt: 'A ray of light meets the boundary between air and glass. Which describes what happens?', ...choice('Some light is reflected and some is transmitted (refracted)', ['All of it is transmitted', 'All of it is reflected', 'It is all absorbed at the surface', 'It is reflected only if it is polarised']),
    working: ['At any boundary between media, waves are partly reflected and partly transmitted', 'The bigger the difference in refractive index (or density for sound), the more is reflected'], why: 'This is why a window reflects a faint image, and why ultrasound needs coupling gel.' }),
];

/* ---------- diffraction and de Broglie: 50–54 ---------- */
const DIFFRACT: (() => Question)[] = [
  () => { const N = pick([100, 300, 500, 600]), n = ri(1, 2), nm = ri(45, 68) * 10, d = 1e-3 / N, th = deg(Math.asin((n * nm * 1e-9) / d));
    if (!isFinite(th)) return DIFFRACT[1]();
    const lam = nm * 1e-9;
    return { topic: 'diffract', prompt: `Core Practical 6. Laser light passes through a grating with ${N} lines per mm. The order n = ${n} maximum is at ${p3(th)}° to the straight-through direction. What is the wavelength?`,
      ...opts(lam, [((1 / N) * Math.sin(rad(th))) / n, d * Math.sin(rad(th)), (d * Math.cos(rad(th))) / n, (d * Math.tan(rad(th))) / n], 'm'),
      working: [`d = 1/${N} mm = ${sci(d)} m`, 'nλ = d sin θ', `λ = ${sci(d)} × sin ${p3(th)}° ÷ ${n} = ${sci(lam)} m (${short(nm)} nm)`],
      why: 'Convert lines per mm into the slit spacing d in metres first.', figure: { kind: 'grating', order: n } }; },
  () => { const N = pick([300, 500, 600]), nm = ri(45, 68) * 10, d = 1e-3 / N, th = deg(Math.asin((nm * 1e-9) / d)), th2 = deg(Math.asin(Math.min(1, (2 * nm * 1e-9) / d)));
    return { topic: 'diffract', prompt: `Light of wavelength ${nm} nm falls normally on a grating with ${N} lines per mm. At what angle is the first-order maximum?`, ...opts(th, [th2 < 90 ? th2 : th * 3, deg(Math.acos((nm * 1e-9) / d)), th / 2], '°', p3),
      working: [`d = 1/${N} mm = ${sci(d)} m`, `sin θ = λ/d = ${sci(nm * 1e-9)} ÷ ${sci(d)} = ${p3((nm * 1e-9) / d)}`, `θ = ${p3(th)}°`], why: 'Use n = 1 for the first order; the central (zero-order) maximum is at 0°.', figure: { kind: 'grating', order: 1 } }; },
  () => { const N = pick([300, 400, 500, 600, 800]), nm = ri(40, 70) * 10, d = 1e-3 / N, nmax = Math.floor(d / (nm * 1e-9));
    const tot = 2 * nmax + 1;
    return { topic: 'diffract', prompt: `Light of wavelength ${nm} nm falls normally on a grating with ${N} lines per mm. How many maxima can be seen in total (counting both sides and the centre)?`,
      ...choice(String(tot), [...new Set([String(nmax), String(tot + 2), String(tot - 2), String(2 * nmax), String(tot + 4)])].filter((x) => +x > 0 && x !== String(tot))),
      working: [`d = ${sci(d)} m`, `Largest order: sin θ ≤ 1 → n ≤ d/λ = ${p3(d / (nm * 1e-9))}, so n(max) = ${nmax}`, `Total = 2 × ${nmax} + 1 (the centre) = ${tot}`], why: 'Round d/λ down: an order at exactly 90° would travel along the grating and not be seen.' }; },
  () => { const D = ri(10, 25) / 10, xcm = ri(15, 60), x = xcm / 100, N = pick([300, 600]), d = 1e-3 / N, th = Math.atan(x / D), lam = d * Math.sin(th);
    return { topic: 'diffract', prompt: `A grating with ${N} lines per mm is ${D} m from a screen. The first-order maxima are ${xcm} cm either side of the central maximum. What is the wavelength?`,
      ...opts(lam, [d * Math.sin(Math.atan((2 * x) / D)), d * Math.sin(Math.atan(x / (2 * D))), d * x], 'm'),
      working: [`tan θ = ${x} ÷ ${D} → θ = ${p3(deg(th))}°`, `d = ${sci(d)} m`, `λ = d sin θ = ${sci(lam)} m (${nmText(lam)})`], why: 'Measure from the centre to the first order on one side (or halve the distance between the two first orders). A large D reduces the percentage uncertainty.' }; },
  () => { const v = ri(10, 90) / 10 * 1e6, lam = H / (ME * v);
    return { topic: 'diffract', prompt: `What is the de Broglie wavelength of an electron travelling at ${sci(v, 2)} m s⁻¹?`, ...opts(lam, [ME * v / H * 1e-20, H / v, H * ME * v * 1e40], 'm'),
      working: ['λ = h/p = h/(mv)', `λ = 6.63 × 10⁻³⁴ ÷ (9.11 × 10⁻³¹ × ${sci(v, 2)}) = ${sci(lam)} m`], why: 'This is about the spacing of atoms in a crystal (10⁻¹⁰ m), which is why crystals diffract electrons.' }; },
  () => { const V = pick([500, 1000, 2000, 3000, 4000, 5000]), p = Math.sqrt(2 * ME * E * V), lam = H / p;
    return { topic: 'diffract', prompt: `Electrons are accelerated from rest through ${V} V in an electron diffraction tube. What is their de Broglie wavelength?`, ...opts(lam, [H / (2 * ME * E * V), H / Math.sqrt(ME * E * V), H / (ME * Math.sqrt((2 * E * V) / ME) * 2)], 'm'),
      working: [`Eₖ = eV = 1.60 × 10⁻¹⁹ × ${V} = ${sci(E * V)} J`, `p = √(2mEₖ) = √(2 × 9.11 × 10⁻³¹ × ${sci(E * V)}) = ${sci(p)} kg m s⁻¹`, `λ = h/p = ${sci(lam)} m`], why: 'Raise V and the electrons are faster, λ is shorter and the diffraction rings get smaller.' }; },
  () => ({ topic: 'diffract', prompt: 'A beam of electrons passes through a thin film of graphite and makes rings on a fluorescent screen. What does this show?', ...choice('Electrons behave as waves: they are diffracted by the regular rows of atoms', ['Electrons are particles with charge', 'Graphite emits light when hit', 'Electrons are deflected by the graphite nuclei like α particles', 'Electrons have mass']),
    working: ['Rings are a diffraction pattern: only waves diffract', 'The atomic spacing (about 10⁻¹⁰ m) is similar to the electrons’ de Broglie wavelength, so diffraction is significant'], why: 'Increasing the accelerating voltage shrinks the rings, exactly as λ = h/p predicts.' }),
  () => ({ topic: 'diffract', prompt: 'Water waves pass through a gap in a barrier. When is the diffraction (spreading) greatest?', ...choice('When the gap width is about the same as the wavelength', ['When the gap is much wider than the wavelength', 'When the wave speed is greatest', 'When the amplitude is greatest', 'When the gap is much narrower than the wavelength, so more energy gets through']),
    working: ['Huygens: every point on a wavefront acts as a source of secondary wavelets', 'A gap comparable to λ lets through only a few wavelets: the new wavefront is nearly circular'], why: 'Diffraction changes direction but not wavelength, frequency or speed.' }),
  () => { const v = ri(2, 8) * 1e6, lamE = H / (ME * v), mp = 1.67e-27, vp = H / (mp * lamE);
    return { topic: 'diffract', prompt: `An electron moves at ${sci(v, 2)} m s⁻¹. At what speed would a proton (m = 1.67 × 10⁻²⁷ kg) have the same de Broglie wavelength?`, ...opts(vp, [v * (mp / ME), v, Math.sqrt(ME / mp) * v], 'm s⁻¹'),
      working: ['Same λ = h/p means the same momentum', `m_p v_p = m_e v_e → v_p = ${sci(v, 2)} × 9.11 × 10⁻³¹ ÷ 1.67 × 10⁻²⁷ = ${sci(vp)} m s⁻¹`], why: 'The proton is about 1840 times heavier, so it needs to be 1840 times slower.' }; },
];

/* ---------- pulse–echo: 55–56 ---------- */
const ECHO: (() => Question)[] = [
  () => { const t = ri(20, 160) / 1e6, v = 1540, d = (v * t) / 2;
    return { topic: 'echo', prompt: `An ultrasound pulse travels through soft tissue at 1540 m s⁻¹. The echo from a boundary returns ${short(t * 1e6)} μs after the pulse is sent. How deep is the boundary?`, ...opts(d, [v * t, v * t / 4, t / v], 'm', (x) => sci(x)),
      working: ['The pulse goes to the boundary and back: distance travelled = 2d', `d = vt/2 = 1540 × ${sci(t)} ÷ 2 = ${sci(d)} m`], why: 'Forgetting to halve is the commonest slip.', figure: { kind: 'echo', t1: t * 1e6, t2: 0, unit: 'μs' } }; },
  () => { const t = ri(10, 90) / 10, v = 1500, d = (v * t) / 2;
    return { topic: 'echo', prompt: `A ship’s sonar pulse returns from the sea bed ${t} s after it is sent. Sound travels at 1500 m s⁻¹ in sea water. How deep is the water?`, ...opts(d, [v * t, v / t, (v * t) / 4], 'm', p3),
      working: [`d = vt/2 = 1500 × ${t} ÷ 2 = ${p3(d)} m`], why: 'The time is for the round trip.' }; },
  () => { const d1 = ri(20, 50) / 1000, d2 = d1 + ri(5, 30) / 1000, v = 1540, t1 = (2 * d1) / v, t2 = (2 * d2) / v, th = d2 - d1;
    return { topic: 'echo', prompt: `An A-scan shows two echoes, from the front and back of an organ, at ${p3(t1 * 1e6)} μs and ${p3(t2 * 1e6)} μs (speed 1540 m s⁻¹). How thick is the organ?`, ...opts(th, [v * (t2 - t1), d2, (v * (t2 - t1)) / 4], 'm', (x) => sci(x)),
      working: [`Δt = ${p3((t2 - t1) * 1e6)} μs`, `thickness = vΔt/2 = 1540 × ${sci(t2 - t1)} ÷ 2 = ${sci(th)} m`], why: 'The extra time is the round trip through the organ’s thickness.', figure: { kind: 'echo', t1: t1 * 1e6, t2: t2 * 1e6, unit: 'μs' } }; },
  () => { const tau = ri(1, 8) / 1e6, v = 1540, dmin = (v * tau) / 2;
    return { topic: 'echo', prompt: `An ultrasound scanner sends pulses lasting ${short(tau * 1e6)} μs into tissue (1540 m s⁻¹). Two boundaries closer together than a certain distance give echoes that overlap. What is that distance?`, ...opts(dmin, [v * tau, (v * tau) / 4, v / tau], 'm', (x) => sci(x)),
      working: [`Pulse length in the tissue = vτ = ${sci(v * tau)} m`, `The second echo travels 2Δd further; the echoes separate only if 2Δd > vτ`, `Δd(min) = vτ/2 = ${sci(dmin)} m`], why: 'Shorter pulses give finer depth detail (better resolution).' }; },
  () => { const f = pick([2, 3.5, 5, 7.5, 10]) * 1e6, lam = 1540 / f;
    return { topic: 'echo', prompt: `Ultrasound of frequency ${short(f / 1e6)} MHz is used in tissue (1540 m s⁻¹). Roughly what is the smallest detail it can show?`, ...opts(lam, [f / 1540, 1540 / (f / 1e6), lam * 100], 'm', (x) => sci(x)),
      working: ['Detail smaller than about one wavelength cannot be resolved', `λ = v/f = 1540 ÷ ${sci(f)} = ${sci(lam)} m`], why: 'Higher frequency → shorter wavelength → finer detail, but it is absorbed more, so it cannot reach as deep.' }; },
  () => ({ topic: 'echo', prompt: 'Why is a gel spread between an ultrasound probe and the skin?', ...choice('Without it, almost all the ultrasound would be reflected at the air–skin boundary', ['It cools the probe', 'It speeds the ultrasound up', 'It polarises the ultrasound', 'It absorbs the reflected pulses so they do not interfere']),
    working: ['Waves are partly reflected and partly transmitted at a boundary', 'Air and skin are very different media, so nearly all the energy would reflect; the gel removes the air gap'], why: 'The echo pulses you want come from boundaries inside the body, which are much weaker.' }),
  () => ({ topic: 'echo', prompt: 'How does a pulse–echo scanner find the position of a boundary?', ...choice('It times the echo and uses distance = speed × time ÷ 2, with the known wave speed', ['It measures the frequency change of the echo', 'It measures the amplitude of the echo only', 'It measures the wavelength of the echo', 'It counts the number of echoes']),
    working: ['The same probe sends the pulse and then listens for echoes', 'The pulse must end before its echo returns, which limits how close a boundary can be seen'], why: 'The echo’s strength tells you how different the two media are, not where the boundary is.' }),
];

/* ---------- photons and spectra: 57–63 ---------- */
const PHOTON: (() => Question)[] = [
  () => { const nm = ri(30, 75) * 10, Ej = (H * C) / (nm * 1e-9);
    return { topic: 'photon', prompt: `What is the energy of a photon of light of wavelength ${nm} nm?`, ...opts(Ej, [H * nm * 1e-9 / C * 1e17, (H * C) / nm, Ej / E], 'J'),
      working: ['E = hf = hc/λ', `E = 6.63 × 10⁻³⁴ × 3.00 × 10⁸ ÷ ${sci(nm * 1e-9)} = ${sci(Ej)} J`], why: 'In electronvolts that is ' + p3(Ej / E) + ' eV.' }; },
  () => { const ev = ri(15, 60) / 10, J = ev * E;
    return { topic: 'photon', prompt: `Convert ${ev} eV to joules.`, ...opts(J, [ev / E, ev * 1e-19, J * 1e3], 'J'),
      working: ['1 eV = 1.60 × 10⁻¹⁹ J', `${ev} eV = ${ev} × 1.60 × 10⁻¹⁹ = ${sci(J)} J`], why: 'The electronvolt is the energy one electron gains moving through 1 V: W = QV.' }; },
  () => { const phi = pick([2.1, 2.28, 2.3, 2.9]), nm = ri(25, 45) * 10, ek = (H * C) / (nm * 1e-9) - phi * E;
    if (ek <= 0) return PHOTON[0]();
    return { topic: 'photon', prompt: `Light of wavelength ${nm} nm falls on a metal with work function ${phi} eV. What is the maximum kinetic energy of the photoelectrons?`,
      ...opts(ek, [(H * C) / (nm * 1e-9) + phi * E, (H * C) / (nm * 1e-9), ek / E], 'J'),
      working: [`hf = hc/λ = ${sci((H * C) / (nm * 1e-9))} J`, `φ = ${phi} × 1.60 × 10⁻¹⁹ = ${sci(phi * E)} J`, `Eₖ(max) = hf − φ = ${sci(ek)} J (${p3(ek / E)} eV)`], why: 'Put both energies in the same unit before subtracting.' }; },
  () => { const phi = pick([2.1, 2.3, 3.7, 4.3, 4.7]), f0 = (phi * E) / H;
    return { topic: 'photon', prompt: `A metal has a work function of ${phi} eV. What is its threshold frequency?`, ...opts(f0, [phi / H, (phi * E) / (H * C) * 1e8, H / (phi * E) * 1e30], 'Hz'),
      working: ['At threshold, hf₀ = φ', `f₀ = φ/h = ${phi} × 1.60 × 10⁻¹⁹ ÷ 6.63 × 10⁻³⁴ = ${sci(f0)} Hz`], why: `Threshold wavelength λ₀ = c/f₀ = ${nmText(C / f0)}; any longer wavelength frees no electrons.` }; },
  () => { const Vs = ri(5, 25) / 10, ek = Vs * E, v = Math.sqrt((2 * ek) / ME);
    return { topic: 'photon', prompt: `The stopping potential for photoelectrons from a metal is ${Vs} V. What is the maximum speed of the photoelectrons?`, ...opts(v, [(2 * ek) / ME, Math.sqrt(ek / ME), Math.sqrt((2 * Vs) / ME) * 1e-10], 'm s⁻¹'),
      working: ['eVₛ = Eₖ(max) = ½mv²(max)', `Eₖ = 1.60 × 10⁻¹⁹ × ${Vs} = ${sci(ek)} J`, `v = √(2Eₖ/m) = ${sci(v)} m s⁻¹`], why: 'The stopping p.d. turns back even the fastest electrons, so it measures Eₖ(max).' }; },
  () => { const nm = ri(20, 40) * 10, Vs = ri(5, 20) / 10, phi = (H * C) / (nm * 1e-9) / E - Vs;
    if (phi <= 0.5) return PHOTON[1]();
    return { topic: 'photon', prompt: `Ultraviolet light of wavelength ${nm} nm falls on a metal. The stopping potential is ${Vs} V. What is the work function of the metal, in eV?`, ...opts(phi, [(H * C) / (nm * 1e-9) / E + Vs, (H * C) / (nm * 1e-9) / E, phi * E * 1e19], 'eV', p3),
      working: [`hf = hc/λ = ${sci((H * C) / (nm * 1e-9))} J = ${p3((H * C) / (nm * 1e-9) / E)} eV`, `Eₖ(max) = eVₛ = ${Vs} eV`, `φ = hf − Eₖ(max) = ${p3(phi)} eV`], why: 'Working in eV is quickest here: a stopping potential of V volts means Eₖ(max) = V eV.' }; },
  () => ({ topic: 'photon', prompt: 'The intensity of the light falling on a photocell is doubled, keeping the frequency the same (above threshold). What happens?', ...choice('Twice as many photoelectrons are emitted per second; their maximum kinetic energy is unchanged', [
    'The maximum kinetic energy of the photoelectrons doubles', 'The work function halves', 'The threshold frequency halves', 'No change: intensity has no effect']),
    working: ['Doubling the intensity doubles the number of photons per second', 'Each photon still has energy hf, and frees at most one electron'], why: 'The wave model wrongly predicts more energetic electrons in brighter light.' }),
  () => ({ topic: 'photon', prompt: 'Which observation of the photoelectric effect can the wave model of light NOT explain?', ...choice(pick(['Below a threshold frequency no electrons are emitted, however intense the light', 'Electrons are emitted with no delay, even in very dim light', 'The maximum kinetic energy of the electrons does not depend on the intensity']), [
    'More intense light gives a larger photocurrent', 'Light is diffracted by a narrow slit', 'Light can be polarised', 'Light refracts at a boundary']),
    working: ['Wave model: energy arrives continuously, spread over the wavefront, and depends on amplitude', 'Photon model: energy arrives in packets hf, each absorbed by one electron at once'], why: 'The photoelectric effect is evidence for the particle (photon) nature of light; diffraction and interference are evidence for its wave nature.' }),
  () => { const lv = [-13.6, -3.4, -1.51, -0.85, -0.54], hi = ri(1, 4), lo = ri(0, hi - 1), dE = (lv[hi] - lv[lo]) * E, lam = (H * C) / dE;
    return { topic: 'photon', prompt: `The diagram shows some energy levels of hydrogen. What is the wavelength of the photon emitted when an electron drops from ${neg(lv[hi])} eV to ${neg(lv[lo])} eV?`,
      ...opts(lam, [(H * C) / ((-lv[hi]) * E), (H * C) / ((lv[hi] - lv[lo]) * 1e-19), (H * C) / (-lv[lo] * E)], 'm'),
      working: [`ΔE = ${neg(lv[hi])} − (${neg(lv[lo])}) = ${p3(lv[hi] - lv[lo])} eV = ${sci(dE)} J`, `λ = hc/ΔE = 6.63 × 10⁻³⁴ × 3.00 × 10⁸ ÷ ${sci(dE)} = ${sci(lam)} m`],
      why: 'Use the difference between the two levels, not either level on its own.', figure: { kind: 'levels', levels: lv, from: hi, to: lo } }; },
  () => { const lv = [-13.6, -3.4, -1.51, -0.85], gap = pick([10.2, 12.09, 12.75]), off = pick([0, 0, 0.5, 0.6]), ev = Number((gap + off).toPrecision(4)), abs = off === 0;
    return { topic: 'photon', prompt: `Hydrogen atoms in their ground state (−13.6 eV) are hit by photons of energy ${ev} eV. What happens?`,
      ...choice(abs ? `The photons are absorbed, exciting atoms to the ${neg(p3(-13.6 + ev))} eV level` : 'The photons pass through: their energy does not match any transition, so they are not absorbed', [
        abs ? 'The photons pass through: their energy does not match any transition, so they are not absorbed' : `The photons are absorbed, exciting atoms to the ${neg(p3(-13.6 + gap))} eV level`,
        'The atoms are ionised', 'The photons are absorbed and the extra energy is kept by the photons']),
      working: [`Possible jumps from −13.6 eV: ${lv.slice(1).map((l) => p3(l + 13.6)).join(', ')} eV (13.6 eV ionises)`, abs ? `${ev} eV matches exactly` : `${ev} eV matches none of these and is less than 13.6 eV`],
      why: 'A photon is absorbed whole or not at all. An electron colliding with the atom is different: it can give up just part of its kinetic energy.', figure: { kind: 'levels', levels: lv, from: 0, to: abs ? lv.findIndex((l) => Math.abs(l + 13.6 - gap) < 0.05) : 0 } }; },
  () => { const P = pick([1, 5, 60, 100]) / (Math.random() < 0.5 ? 1000 : 1), nm = pick([450, 532, 633, 650]), N = (P * nm * 1e-9) / (H * C);
    return { topic: 'photon', prompt: `A ${P < 1 ? short(P * 1000) + ' mW' : P + ' W'} source emits light of wavelength ${nm} nm. How many photons does it emit per second?`, ...opts(N, [P / (H * C), (P * H * C) / (nm * 1e-9) * 1e50, N / 1000], 's⁻¹'),
      working: [`Energy of one photon: hc/λ = ${sci((H * C) / (nm * 1e-9))} J`, `N = P ÷ (hc/λ) = ${sci(P)} ÷ ${sci((H * C) / (nm * 1e-9))} = ${sci(N)} s⁻¹`], why: 'Power is energy per second; each photon carries hc/λ.' }; },
  () => ({ topic: 'photon', prompt: 'A graph of maximum kinetic energy of photoelectrons (y) against frequency of light (x) is a straight line. What is its gradient?', ...choice('The Planck constant, h', ['The work function, φ', 'The threshold frequency, f₀', 'The charge of the electron, e', 'h/e']),
    working: ['Eₖ(max) = hf − φ is in the form y = mx + c', 'Gradient = h; y-intercept = −φ; x-intercept = f₀'], why: 'Different metals give parallel lines (same h) with different intercepts.' }),
  () => ({ topic: 'photon', prompt: 'Why does a gas at low pressure emit a line spectrum rather than a continuous spectrum?', ...choice('Its electrons can only occupy discrete energy levels, so only certain photon energies (frequencies) are emitted', [
    'The gas absorbs all the other wavelengths', 'The atoms are too far apart to emit light', 'Each atom emits one colour only', 'The electrons orbit at fixed speeds']),
    working: ['Photon energy = difference between two levels: hf = E₁ − E₂', 'Only a limited set of differences → a limited set of frequencies → lines'], why: 'Each element has its own set of levels, so its own line pattern: a fingerprint used to identify elements, even in stars.' }),
];

const BANK: Record<Topic, (() => Question)[]> = { waves: WAVES, superpose: SUPER, standing: STANDING, light: LIGHT, diffract: DIFFRACT, echo: ECHO, photon: PHOTON };

export function newQuestion(topic: Topic | 'all'): Question {
  const t: Topic = topic === 'all' ? pick(Object.keys(BANK) as Topic[]) : topic;
  return pick(BANK[t])();
}
