/* Fields Lab: Generated WPH14 / WPH15 exam-style practice questions across all 5 topics. */

import { sci } from './consts';

export type Topic = 'electric' | 'magnetic' | 'lorentz' | 'induction' | 'gravity';

export const TOPICS: [Topic | 'all', string][] = [
  ['all', 'All topics'],
  ['electric', 'Electric fields'],
  ['magnetic', 'Magnetic fields & F = BIL'],
  ['lorentz', 'Charged particles (BQv)'],
  ['induction', 'EM induction'],
  ['gravity', 'Gravitational fields'],
];

export const TOPIC_NAME: Record<Topic, string> = {
  electric: 'Electric fields & equipotentials',
  magnetic: 'Magnetic fields & motor effect',
  lorentz: 'Charged particles & velocity selector',
  induction: 'Faraday’s & Lenz’s laws',
  gravity: 'Gravitational vs electric fields',
};

export const SPEC: Record<Topic | 'all', string> = {
  all: 'WPH14 / 15',
  electric: '4.4 · 92–99',
  magnetic: '4.4 · 105, 107',
  lorentz: '4.4 · 106',
  induction: '4.4 · 105, 108–110',
  gravity: '5.6 · 154–160',
};

export type Figure =
  | { kind: 'plates'; v: number; d: number }
  | { kind: 'orbit'; rText: string }
  | { kind: 'flux' }
  | { kind: 'invsq' };

export interface Question {
  topic: Topic;
  prompt: string;
  options: string[];
  answer: string;
  working: string[];
  why: string;
  figure?: Figure;
}

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function qElectric(): Question {
  if (Math.random() < 0.55) {
    const V = pick([600, 1200, 2400, 3000]);
    const dCm = pick([2, 4, 5, 6]);
    const E = V / (dCm / 100);
    const ans = `${(E / 1000).toFixed(0)} kV m⁻¹`;
    return {
      topic: 'electric',
      prompt: `Two parallel plates separated by ${dCm} cm have a potential difference of ${V} V across them. What is the uniform electric field strength E between the plates?`,
      options: shuffle([ans, `${(E / 100).toFixed(0)} kV m⁻¹`, `${(V / dCm).toFixed(0)} V m⁻¹`, `${(E / 2000).toFixed(0)} kV m⁻¹`]),
      answer: ans,
      working: [
        `Convert d to metres: ${dCm} cm = ${(dCm / 100).toFixed(2)} m`,
        `E = V / d = ${V} / ${(dCm / 100).toFixed(2)} = ${E.toFixed(0)} V m⁻¹ = ${ans}`,
      ],
      why: 'In a uniform electric field between parallel plates, E = V / d.',
      figure: { kind: 'plates', v: V, d: dCm },
    };
  }
  return {
    topic: 'electric',
    prompt: 'At the exact midpoint between two equal positive point charges (+Q and +Q), what are the electric field strength E and electric potential V?',
    options: shuffle([
      'E = 0, but V is positive and non-zero',
      'Both E = 0 and V = 0',
      'V = 0, but E is non-zero',
      'Both E and V are negative',
    ]),
    answer: 'E = 0, but V is positive and non-zero',
    working: ['E is a vector: equal and opposite fields cancel → E = 0.', 'V is a scalar: V = kQ/r + kQ/r = 2kQ/r > 0.'],
    why: 'Never confuse vector cancellation (E = 0) with scalar potential addition (V > 0).',
    figure: { kind: 'invsq' },
  };
}

function qMagnetic(): Question {
  const B = pick([0.2, 0.4, 0.5, 0.8]);
  const I = pick([2.0, 3.0, 5.0]);
  const L = pick([0.25, 0.5]);
  const deg = pick([30, 90]);
  const sinVal = deg === 30 ? 0.5 : 1;
  const F = B * I * L * sinVal;
  const fmtF = (v: number) => `${v.toPrecision(2)} N`;
  const ans = fmtF(F);
  const wrongs = [fmtF(B * I * L), fmtF(F / 2), fmtF(B * I / L), fmtF(F * 2)].filter((w, i, a) => w !== ans && a.indexOf(w) === i);
  return {
    topic: 'magnetic',
    prompt: `A straight wire of length ${L.toFixed(2)} m carrying ${I.toFixed(1)} A sits at ${deg}° to a uniform magnetic field of flux density ${B.toFixed(1)} T. Calculate the magnetic force on the wire.`,
    options: shuffle([ans, ...wrongs.slice(0, 3)]),
    answer: ans,
    working: [
      `F = B I L sin θ`,
      `F = ${B.toFixed(1)} × ${I.toFixed(1)} × ${L.toFixed(2)} × sin(${deg}°) = ${ans}`,
    ],
    why: 'Only the component of current perpendicular to the magnetic field experiences a force (sin 30° = 0.5, sin 90° = 1).',
  };
}

function qLorentz(): Question {
  if (Math.random() < 0.5) {
    return {
      topic: 'lorentz',
      prompt: 'A charged particle enters a uniform magnetic field at 90° and follows a circular path. Why does its kinetic energy remain constant?',
      options: shuffle([
        'The magnetic force is always perpendicular to the velocity, so it does zero work on the particle',
        'The magnetic force is zero once the particle enters the circle',
        'The electric field cancels the magnetic force',
        'The particle loses mass as it curves',
      ]),
      answer: 'The magnetic force is always perpendicular to the velocity, so it does zero work on the particle',
      working: ['Work done W = F d cos(90°) = 0 → no change in kinetic energy or speed.'],
      why: 'F = BQv acts as a pure centripetal force, changing direction without changing speed.',
      figure: { kind: 'orbit', rText: 'r = mv / BQ' },
    };
  }
  const E = pick([2000, 4000, 6000]);
  const B = pick([0.02, 0.04, 0.05]);
  const v = E / B;
  const ans = `${sci(v, 2)} m s⁻¹`;
  const wrongs = [`${sci(v / 2, 2)} m s⁻¹`, `${sci(v * 2, 2)} m s⁻¹`, `${sci(E * B, 2)} m s⁻¹`].filter((w, i, a) => w !== ans && a.indexOf(w) === i);
  return {
    topic: 'lorentz',
    prompt: `In a crossed-field velocity selector, E = ${E} V m⁻¹ and B = ${B} T. What speed passes straight through undeflected?`,
    options: shuffle([ans, ...wrongs.slice(0, 3)]),
    answer: ans,
    working: ['Undeflected when FE = FB → EQ = BQv → v = E / B', `v = ${E} / ${B} = ${ans}`],
    why: 'Both charge Q and mass m cancel in v = E / B — every particle with that speed goes straight through!',
  };
}

function qInduction(): Question {
  const bank: Omit<Question, 'topic'>[] = [
    {
      prompt: 'A flat coil rotates at steady frequency f in a uniform magnetic field. At what coil orientation is the induced e.m.f. MAXIMUM?',
      options: shuffle([
        'When the plane of the coil is parallel to the magnetic field (flux linkage = 0, rate of cutting flux is maximum)',
        'When the plane of the coil is perpendicular to the magnetic field (flux linkage is maximum)',
        'Only when the coil stops rotating',
        'The e.m.f. is constant at all angles',
      ]),
      answer: 'When the plane of the coil is parallel to the magnetic field (flux linkage = 0, rate of cutting flux is maximum)',
      working: ['NΦ = BAN cos(ωt) → ε = −d(NΦ)/dt = BANω sin(ωt).', 'sin(ωt) is maximum when cos(ωt) = 0 (coil parallel to B).'],
      why: 'Induced e.m.f. depends on the RATE of change of flux linkage, not the flux linkage itself!',
      figure: { kind: 'flux' },
    },
    {
      prompt: 'Why does pushing a bar magnet’s North pole into a closed coil require mechanical work (Lenz’s law)?',
      options: shuffle([
        'The induced current creates a North pole at the near end of the coil that repels the incoming magnet, conserving energy',
        'The coil becomes positively charged and repels the magnet electrostatically',
        'Gravity pulls the magnet backwards',
        'The induced current creates a South pole that accelerates the magnet faster',
      ]),
      answer: 'The induced current creates a North pole at the near end of the coil that repels the incoming magnet, conserving energy',
      working: ['Work done pushing against the opposing magnetic force transfers mechanical energy into electrical energy.'],
      why: 'If the induced pole attracted the magnet, it would accelerate forever and violate conservation of energy.',
    },
  ];
  return { topic: 'induction', ...pick(bank) };
}

function qGravity(): Question {
  if (Math.random() < 0.5) {
    return {
      topic: 'gravity',
      prompt: 'A satellite orbits Earth at distance 2R from Earth’s centre (where R is Earth’s radius). How does the gravitational field strength g compare with surface g₀?',
      options: shuffle(['g₀ / 4', 'g₀ / 2', 'g₀ / 8', '2 g₀']),
      answer: 'g₀ / 4',
      working: ['g = GM / r² ∝ 1 / r²', 'Doubling r multiplies g by 1 / 2² = 1/4.'],
      why: 'Gravitational field strength follows an inverse-square law with distance from the planet’s centre.',
      figure: { kind: 'invsq' },
    };
  }
  return {
    topic: 'gravity',
    prompt: 'Why is gravitational potential Vg = −GM / r always negative?',
    options: shuffle([
      'Zero potential is defined at infinity, and gravity is always attractive so energy is released as a mass moves closer',
      'Masses can be negative in deep space',
      'Gravitational force is repulsive at short range',
      'G is a negative constant',
    ]),
    answer: 'Zero potential is defined at infinity, and gravity is always attractive so energy is released as a mass moves closer',
    working: ['Work must be done AGAINST gravity to move a mass from r to infinity (where Vg = 0), so Vg(r) < 0.'],
    why: 'A planet sits at the bottom of a negative gravitational potential well.',
    figure: { kind: 'invsq' },
  };
}

export function newQuestion(t: Topic | 'all'): Question {
  const chosen: Topic = t === 'all' ? pick(['electric', 'magnetic', 'lorentz', 'induction', 'gravity']) : t;
  if (chosen === 'electric') return qElectric();
  if (chosen === 'magnetic') return qMagnetic();
  if (chosen === 'lorentz') return qLorentz();
  if (chosen === 'induction') return qInduction();
  return qGravity();
}
