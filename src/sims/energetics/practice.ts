/* Energetics Lab: Generated exam-style practice questions across WCH12 (Topic 6) & WCH14 (Topic 12). */

import { C_WATER, signed } from './consts';
import { BOND_REACTIONS, sumBonds } from './bonds';
import { plain } from '../../lib/chem';

function signed3sf(v: number): string {
  const r = Number(Math.abs(v).toPrecision(3));
  if (r === 0) return '0';
  return (v >= 0 ? '+' : '−') + r.toPrecision(3);
}

export type Topic = 'calorimetry' | 'hess' | 'bonds' | 'bornhaber' | 'entropy';

export const TOPICS: [Topic | 'all', string][] = [
  ['all', 'All topics'],
  ['calorimetry', 'Calorimetry & q = mcΔT'],
  ['hess', 'Hess’s law'],
  ['bonds', 'Bond enthalpies'],
  ['bornhaber', 'Born–Haber & lattice'],
  ['entropy', 'Entropy & ΔG'],
];

export const TOPIC_NAME: Record<Topic, string> = {
  calorimetry: 'Calorimetry (Topic 6)',
  hess: 'Hess’s law cycles (CP 2)',
  bonds: 'Mean bond enthalpies',
  bornhaber: 'Born–Haber & lattice energy',
  entropy: 'Entropy & Gibbs free energy',
};

export const SPEC: Record<Topic | 'all', string> = {
  all: 'Topics 6 & 12',
  calorimetry: '6.4–6.7',
  hess: '6.8–6.9',
  bonds: '6.10–6.12',
  bornhaber: '12.1–12.7',
  entropy: '12.8–12.14',
};

export type Figure =
  | { kind: 'cooling'; exo: boolean }
  | { kind: 'hess'; dir: 'up' | 'down'; dh1: number; dh2: number }
  | { kind: 'dg'; dh: number; ds: number };

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

function qCal(): Question {
  if (Math.random() < 0.65) {
    const m = pick([50, 100]);
    const dT = pick([6.5, 8.0, 10.5, 12.0, 15.0]);
    const mol = pick([0.025, 0.05]);
    const qJ = m * C_WATER * dT;
    const dh = -(qJ / 1000) / mol;
    const ans = `${signed3sf(dh)} kJ mol⁻¹`;
    const w1 = `${signed3sf(Math.abs(dh))} kJ mol⁻¹`;
    const w2 = `${signed3sf(dh / 2)} kJ mol⁻¹`;
    const w3 = `${signed3sf(-(qJ / 1000))} kJ mol⁻¹`;
    const mStr = m === 50 ? '50.0' : '100';
    const dTStr = dT < 10 ? dT.toFixed(2) : dT.toFixed(1);
    const molStr = mol === 0.025 ? '0.0250' : '0.0500';
    return {
      topic: 'calorimetry',
      prompt: `Mixing ${molStr} mol of limiting reagent in ${mStr} g of water raises the temperature by ${dTStr} °C. Calculate ΔH to 3 s.f. (c = 4.18 J g⁻¹ K⁻¹).`,
      options: shuffle([ans, w1, w2, w3]),
      answer: ans,
      working: [
        `q = mcΔT = ${mStr} × 4.18 × ${dTStr} = ${qJ.toFixed(0)} J = ${(qJ / 1000).toPrecision(3)} kJ`,
        `Temperature rose → exothermic (negative ΔH).`,
        `ΔH = −${(qJ / 1000).toPrecision(3)} / ${molStr} = ${ans}`,
      ],
      why: 'Always convert J to kJ (÷ 1000), divide by moles of limiting reagent, match 3 s.f. to the data, and include the minus sign for an exothermic rise.',
      figure: { kind: 'cooling', exo: true },
    };
  }
  return {
    topic: 'calorimetry',
    prompt: 'In a polystyrene cup calorimetry experiment, why do we extrapolate the cooling curve back to the time of mixing (t = 4 min)?',
    options: shuffle([
      'To compensate for heat lost to the surroundings while the reaction is taking place',
      'To find the activation energy of the reaction',
      'Because the thermometer reads 4 °C too low at room temperature',
      'To convert joules into kilojoules per mole',
    ]),
    answer: 'To compensate for heat lost to the surroundings while the reaction is taking place',
    working: ['Reactions are not instantaneous; heat escapes as soon as T rises above room temperature.'],
    why: 'Extrapolating the linear cooling tail back to t = 4 min estimates the temperature rise that would have occurred with zero heat loss.',
    figure: { kind: 'cooling', exo: true },
  };
}

function qHess(): Question {
  const isForm = Math.random() < 0.5;
  const dh1 = pick([-1207, -890, -394, -635]);
  const dh2 = pick([-1029, -1367, -572, -286]);
  const ansVal = isForm ? -dh1 + dh2 : dh1 - dh2;
  const ans = `${signed(ansVal, 0)} kJ mol⁻¹`;
  const wrong1 = `${signed(-ansVal, 0)} kJ mol⁻¹`;
  const wrong2 = `${signed(dh1 + dh2, 0)} kJ mol⁻¹`;
  const wrong3 = `${signed(ansVal + 120, 0)} kJ mol⁻¹`;
  const opts = Array.from(new Set([ans, wrong1, wrong2, wrong3]));
  while (opts.length < 4) opts.push(`${signed(ansVal - 95, 0)} kJ mol⁻¹`);

  return {
    topic: 'hess',
    prompt: isForm
      ? `In a Hess cycle using enthalpies of formation (arrows UP from elements), ΣΔfH(reactants) = ${signed(dh1, 0)} kJ mol⁻¹ and ΣΔfH(products) = ${signed(dh2, 0)} kJ mol⁻¹. Find ΔrH.`
      : `In a Hess cycle using enthalpies of combustion (arrows DOWN to oxides), ΣΔcH(reactants) = ${signed(dh1, 0)} kJ mol⁻¹ and ΣΔcH(products) = ${signed(dh2, 0)} kJ mol⁻¹. Find ΔrH.`,
    options: shuffle(opts.slice(0, 4)),
    answer: ans,
    working: isForm
      ? ['ΔrH = ΣΔfH(products) − ΣΔfH(reactants)', `ΔrH = (${signed(dh2, 0)}) − (${signed(dh1, 0)}) = ${ans}`]
      : ['ΔrH = ΣΔcH(reactants) − ΣΔcH(products)', `ΔrH = (${signed(dh1, 0)}) − (${signed(dh2, 0)}) = ${ans}`],
    why: isForm
      ? 'Formation arrows point UP from elements, so going reactants → elements reverses ΔH₁.'
      : 'Combustion arrows point DOWN to CO₂ + H₂O, so going oxides → products reverses ΔH₂.',
    figure: { kind: 'hess', dir: isForm ? 'up' : 'down', dh1, dh2 },
  };
}

function qBonds(): Question {
  const rxn = pick(BOND_REACTIONS);
  const broken = sumBonds(rxn.broken);
  const made = sumBonds(rxn.made);
  const dh = broken - made;
  const ans = `${dh >= 0 ? '+' : '−'}${Math.abs(dh)} kJ mol⁻¹`;
  return {
    topic: 'bonds',
    prompt: `For ${plain(rxn.eq)}, Σ(bonds broken) = +${broken} kJ mol⁻¹ and Σ(bonds made) = ${made} kJ mol⁻¹. Calculate ΔH using mean bond enthalpies.`,
    options: shuffle([
      ans,
      `+${Math.abs(dh)} kJ mol⁻¹`,
      `−${broken + made} kJ mol⁻¹`,
      `+${broken + made} kJ mol⁻¹`,
    ]),
    answer: ans,
    working: [
      'ΔH = Σ(bonds broken) − Σ(bonds made)',
      `ΔH = ${broken} − ${made} = ${ans}`,
    ],
    why: 'Bond breaking absorbs energy (+) and bond making releases energy (−).',
  };
}

function qBornHaber(): Question {
  const bank: Omit<Question, 'topic'>[] = [
    {
      prompt: 'Why is the second electron affinity of oxygen (+798 kJ mol⁻¹) endothermic, whereas the first (−141 kJ mol⁻¹) is exothermic?',
      options: shuffle([
        'Energy is needed to overcome electrostatic repulsion between the incoming electron and the negatively charged O⁻ ion',
        'Oxygen has a full outer shell after gaining one electron',
        'The O=O double bond must be broken during the second electron affinity',
        'The nuclear charge of oxygen decreases when O⁻ forms',
      ]),
      answer: 'Energy is needed to overcome electrostatic repulsion between the incoming electron and the negatively charged O⁻ ion',
      working: ['O⁻(g) + e⁻ → O²⁻(g)  (like charges repel → endothermic).'],
      why: 'Every second electron affinity is endothermic because you are forcing an electron onto an already negative ion.',
    },
    {
      prompt: 'The experimental lattice energy of AgCl (−905 kJ mol⁻¹) is more exothermic than the theoretical ionic value (−833 kJ mol⁻¹). What does this show?',
      options: shuffle([
        'Ag⁺ polarises the Cl⁻ ion, giving significant covalent character and extra bond strength',
        'AgCl is a simple molecular compound with London forces',
        'AgCl is 100% ionic with perfectly spherical ions',
        'The chloride ion is too small to be polarised',
      ]),
      answer: 'Ag⁺ polarises the Cl⁻ ion, giving significant covalent character and extra bond strength',
      working: ['Difference = 72 kJ mol⁻¹ → distortion of Cl⁻ electron cloud by Ag⁺.'],
      why: 'A gap between experimental and theoretical ΔlattH⊖ is the classic Edexcel proof of covalent character via polarisation.',
    },
    {
      prompt: 'Which ionic compound has the MOST exothermic lattice energy?',
      options: shuffle(['MgO', 'NaCl', 'KBr', 'NaF']),
      answer: 'MgO',
      working: ['Lattice energy is more exothermic for higher ionic charges (+2/−2 vs +1/−1) and smaller ionic radii.'],
      why: 'Mg²⁺ and O²⁻ are both small, doubly charged ions → ΔlattH⊖(MgO) ≈ −3845 kJ mol⁻¹.',
    },
  ];
  return { topic: 'bornhaber', ...pick(bank) };
}

function qEntropy(): Question {
  if (Math.random() < 0.55) {
    const dh = pick([178, 120, 210]);
    const ds = pick([160, 150, 200]);
    const tMin = Math.round((dh * 1000) / ds);
    const ans = `${tMin} K`;
    return {
      topic: 'entropy',
      prompt: `A reaction has ΔH = +${dh} kJ mol⁻¹ and ΔS = +${ds} J K⁻¹ mol⁻¹. Above what minimum temperature does it become feasible (ΔG ≤ 0)?`,
      options: shuffle([ans, `${Math.round(dh / ds)} K`, `${tMin + 273} K`, `${Math.round(tMin / 2)} K`]),
      answer: ans,
      working: [
        'At feasibility threshold, ΔG = 0 → T = ΔH / ΔS',
        `Convert ΔH to J: ${dh} × 1000 = ${dh * 1000} J mol⁻¹`,
        `T = ${dh * 1000} / ${ds} = ${tMin} K`,
      ],
      why: 'The #1 exam trap in ΔG = ΔH − TΔS is forgetting to convert ΔH (kJ) and ΔS (J) into the same energy units!',
      figure: { kind: 'dg', dh, ds },
    };
  }
  return {
    topic: 'entropy',
    prompt: 'A reaction has ΔH < 0 and ΔSsystem < 0. When is it thermodynamically feasible?',
    options: shuffle([
      'Only at low temperatures, where |ΔH| > |TΔS|',
      'Only at high temperatures, where |TΔS| > |ΔH|',
      'At all temperatures',
      'Never feasible at any temperature',
    ]),
    answer: 'Only at low temperatures, where |ΔH| > |TΔS|',
    working: ['ΔG = ΔH − TΔS. Since ΔS < 0, −TΔS is positive and grows with T.'],
    why: 'At low T the exothermic ΔH dominates so ΔG < 0; above T = ΔH/ΔS, ΔG turns positive.',
    figure: { kind: 'dg', dh: -92, ds: -199 },
  };
}

export function newQuestion(t: Topic | 'all'): Question {
  const chosen: Topic = t === 'all' ? pick(['calorimetry', 'hess', 'bonds', 'bornhaber', 'entropy']) : t;
  if (chosen === 'calorimetry') return qCal();
  if (chosen === 'hess') return qHess();
  if (chosen === 'bonds') return qBonds();
  if (chosen === 'bornhaber') return qBornHaber();
  return qEntropy();
}
