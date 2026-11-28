/* Acid–Base Lab: Generated WCH14 & WCH13 exam-style MCQ bank across all 5 topics. */

export type Topic = 'strength' | 'titration' | 'burette' | 'buffers' | 'salts';

export const TOPICS: [Topic | 'all', string][] = [
  ['all', 'All topics'],
  ['strength', 'Strong/weak, Ka & Kw'],
  ['titration', 'Titration curves & indicators'],
  ['burette', 'Concordant titres & CPs'],
  ['buffers', 'Buffers & blood pH'],
  ['salts', 'Conjugate pairs & salts'],
];

export const TOPIC_NAME: Record<Topic, string> = {
  strength: 'Strong vs weak acids, Ka & Kw',
  titration: 'Titration curves & indicator choice',
  burette: 'Burette skills & concordant titres',
  buffers: 'Buffer solutions & Henderson–Hasselbalch',
  salts: 'Brønsted–Lowry pairs & salt hydrolysis',
};

export const SPEC: Record<Topic | 'all', string> = {
  all: 'WCH14 / 13',
  strength: '14.1–14.8',
  titration: '14.9–14.11',
  burette: 'CP 2 & 11',
  buffers: '14.12–14.14',
  salts: '14.1–14.2',
};

export type Figure =
  | { kind: 'curve'; kindId: 'wa_sb' | 'sa_wb' | 'wa_wb' }
  | { kind: 'buffer'; ha: number; a: number };

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

function qStrength(): Question {
  if (Math.random() < 0.5) {
    const c = pick([0.05, 0.10, 0.20, 0.50]);
    const ka = 1.74e-5;
    const h = Math.sqrt(ka * c);
    const pH = -Math.log10(h);
    const ans = pH.toFixed(2);
    return {
      topic: 'strength',
      prompt: `Calculate the pH of ${c.toFixed(2)} mol dm⁻³ ethanoic acid (Ka = 1.74 × 10⁻⁵ mol dm⁻³) to 2 d.p.`,
      options: shuffle([ans, (-Math.log10(c)).toFixed(2), (pH + 1.0).toFixed(2), (pH - 0.85).toFixed(2)]),
      answer: ans,
      working: [
        `[H⁺] = √(Ka × c) = √(1.74 × 10⁻⁵ × ${c.toFixed(2)}) = ${h.toExponential(2)} mol dm⁻³`,
        `pH = −log₁₀(${h.toExponential(2)}) = ${ans}`,
      ],
      why: 'For a weak acid, use the approximation [H⁺] = √(Ka × [HA]).',
    };
  }
  return {
    topic: 'strength',
    prompt: 'At 50 °C, pure water has Kw = 5.48 × 10⁻¹⁴ mol² dm⁻⁶ and pH = 6.63. Is pure water at 50 °C acidic, neutral, or alkaline?',
    options: shuffle([
      'Neutral — [H⁺] still equals [OH⁻] even though pH < 7',
      'Acidic — any solution with pH below 7 is acidic',
      'Alkaline — heating drives off H⁺ ions',
      'Acidic — Kw decreases with temperature',
    ]),
    answer: 'Neutral — [H⁺] still equals [OH⁻] even though pH < 7',
    working: ['H₂O ⇌ H⁺ + OH⁻ is endothermic → higher T shifts right → [H⁺] = [OH⁻] = √Kw = 2.34 × 10⁻⁷ mol dm⁻³.'],
    why: 'Neutrality is defined by [H⁺] = [OH⁻], not pH = 7.',
  };
}

function qTitration(): Question {
  const bank: Omit<Question, 'topic'>[] = [
    {
      prompt: 'When titrating weak acid CH₃COOH with strong base NaOH, which indicator is suitable and why?',
      options: shuffle([
        'Phenolphthalein (8.2–10.0), because its colour-change range lies completely within the steep vertical section (~7–11)',
        'Methyl orange (3.1–4.4), because all acid titrations use methyl orange',
        'Neither indicator works for a weak acid + strong base',
        'Phenolphthalein, because the equivalence point is below pH 7',
      ]),
      answer: 'Phenolphthalein (8.2–10.0), because its colour-change range lies completely within the steep vertical section (~7–11)',
      working: ['Weak acid + strong base has an alkaline equivalence point (~8.7) and steep jump from pH 7 to 11.'],
      why: 'An indicator is suitable only if its pH range falls completely inside the sharp vertical rise of the titration curve.',
      figure: { kind: 'curve', kindId: 'wa_sb' },
    },
    {
      prompt: 'In a titration of 25.0 cm³ weak acid HA with NaOH, equivalence occurs at 24.0 cm³. At 12.0 cm³ NaOH added, the pH is 4.76. What is the pKa of HA?',
      options: shuffle(['4.76', '2.38', '9.52', '7.00']),
      answer: '4.76',
      working: ['12.0 cm³ is the half-equivalence point, where [HA] = [A⁻].', 'Ka = [H⁺][A⁻]/[HA] = [H⁺] ⇒ pKa = pH = 4.76.'],
      why: 'At half-neutralisation of a weak acid by a strong base, pH = pKa directly!',
      figure: { kind: 'curve', kindId: 'wa_sb' },
    },
    {
      prompt: 'Why is NO colour indicator suitable for titrating a weak acid with a weak base (CH₃COOH + NH₃)?',
      options: shuffle([
        'There is no sharp vertical section at the equivalence point, so indicators change colour gradually over several cm³',
        'The equivalence point is at pH 14',
        'Indicators react chemically with ammonia',
        'Weak acids and weak bases do not react at all',
      ]),
      answer: 'There is no sharp vertical section at the equivalence point, so indicators change colour gradually over several cm³',
      working: ['Use a calibrated pH meter instead of a visual indicator.'],
      why: 'Without a steep pH jump, no indicator can give a sharp single-drop end-point.',
      figure: { kind: 'curve', kindId: 'wa_wb' },
    },
  ];
  return { topic: 'titration', ...pick(bank) };
}

function qBurette(): Question {
  const t1 = 24.60, t2 = 24.15, t3 = 24.25, t4 = 24.20;
  const mean = ((t2 + t3 + t4) / 3).toFixed(2);
  return {
    topic: 'burette',
    prompt: `A student records four titres: Rough = ${t1.toFixed(2)} cm³, Run 1 = ${t2.toFixed(2)} cm³, Run 2 = ${t3.toFixed(2)} cm³, Run 3 = ${t4.toFixed(2)} cm³. What is the mean concordant titre?`,
    options: shuffle([`${mean} cm³`, `${((t1 + t2 + t3 + t4) / 4).toFixed(2)} cm³`, `${t1.toFixed(2)} cm³`, `${(t2 + t3).toFixed(2)} cm³`]),
    answer: `${mean} cm³`,
    working: [
      'Concordant titres are within 0.10–0.20 cm³ of each other: exclude the rough titre (24.60 cm³).',
      `Mean = (${t2.toFixed(2)} + ${t3.toFixed(2)} + ${t4.toFixed(2)}) / 3 = ${mean} cm³`,
    ],
    why: 'Never include the rough (trial) titre or non-concordant outliers when calculating the mean titre.',
  };
}

function qBuffers(): Question {
  if (Math.random() < 0.55) {
    const pKa = 4.76;
    const ha = pick([0.20, 0.40, 0.50]);
    const a = pick([0.40, 0.50, 0.80]);
    const pH = pKa + Math.log10(a / ha);
    const ans = pH.toFixed(2);
    return {
      topic: 'buffers',
      prompt: `A buffer contains ${ha.toFixed(2)} mol dm⁻³ CH₃COOH (pKa = 4.76) and ${a.toFixed(2)} mol dm⁻³ CH₃COONa. Calculate its pH to 2 d.p.`,
      options: shuffle([ans, (pKa - Math.log10(a / ha) + (a === ha ? 0.45 : 0)).toFixed(2), (pH + 1.0).toFixed(2), (pH - 1.0).toFixed(2)]),
      answer: ans,
      working: [
        'pH = pKa + log₁₀([A⁻] / [HA])',
        `pH = 4.76 + log₁₀(${a.toFixed(2)} / ${ha.toFixed(2)}) = ${ans}`,
      ],
      why: 'When [A⁻] = [HA], pH = pKa; more A⁻ makes the buffer slightly higher pH, more HA makes it lower.',
      figure: { kind: 'buffer', ha, a },
    };
  }
  return {
    topic: 'buffers',
    prompt: 'When a small amount of H⁺ (acid) is added to an ethanoic acid / sodium ethanoate buffer, how does the buffer resist a drop in pH?',
    options: shuffle([
      'The large reservoir of CH₃COO⁻ reacts with the added H⁺ to form CH₃COOH, so [H⁺] barely changes',
      'CH₃COOH reacts with H⁺ to form H₂O',
      'The Na⁺ ions neutralise the H⁺ ions',
      'Ka increases to absorb the extra H⁺',
    ]),
    answer: 'The large reservoir of CH₃COO⁻ reacts with the added H⁺ to form CH₃COOH, so [H⁺] barely changes',
    working: ['CH₃COO⁻(aq) + H⁺(aq) → CH₃COOH(aq) (equilibrium shifts left).'],
    why: 'A buffer works because it has large reservoirs of both the weak acid HA and its conjugate base A⁻.',
    figure: { kind: 'buffer', ha: 0.5, a: 0.5 },
  };
}

function qSalts(): Question {
  return {
    topic: 'salts',
    prompt: 'In the nitrating mixture H₂SO₄ + HNO₃ ⇌ HSO₄⁻ + H₂NO₃⁺, what role does HNO₃ play?',
    options: shuffle([
      'A Brønsted–Lowry base, because it accepts a proton (H⁺) from the stronger acid H₂SO₄',
      'A Brønsted–Lowry acid, because it donates a proton to H₂SO₄',
      'A catalyst that is unchanged',
      'A neutral salt',
    ]),
    answer: 'A Brønsted–Lowry base, because it accepts a proton (H⁺) from the stronger acid H₂SO₄',
    working: ['H₂SO₄ → HSO₄⁻ + H⁺ (acid); HNO₃ + H⁺ → H₂NO₃⁺ (base).'],
    why: 'Even a strong acid like HNO₃ acts as a Brønsted–Lowry base when mixed with an even stronger acid (H₂SO₄).',
  };
}

export function newQuestion(t: Topic | 'all'): Question {
  const chosen: Topic = t === 'all' ? pick(['strength', 'titration', 'burette', 'buffers', 'salts']) : t;
  if (chosen === 'strength') return qStrength();
  if (chosen === 'titration') return qTitration();
  if (chosen === 'burette') return qBurette();
  if (chosen === 'buffers') return qBuffers();
  return qSalts();
}
