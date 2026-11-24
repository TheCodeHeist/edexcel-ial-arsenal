/* Atoms & Bonding Lab: Generated exam-style practice questions across WCH11 (+ Topic 8 IMF). */

import { MOLECULES } from './shapes';
import { FIRST_IE, SUCCESSIVE_IE, firstJump } from './ie';
import { SAMPLES, calcAr } from './massspec';

export type Topic = 'shapes' | 'orbitals' | 'ie' | 'lattices' | 'imf' | 'massspec';

export const TOPICS: [Topic | 'all', string][] = [
  ['all', 'All topics'],
  ['shapes', 'Shapes & polarity'],
  ['orbitals', 'Orbitals & config'],
  ['ie', 'Ionisation energy'],
  ['lattices', 'Crystal lattices'],
  ['imf', 'Intermolecular forces'],
  ['massspec', 'Mass spectrometry'],
];

export const TOPIC_NAME: Record<Topic, string> = {
  shapes: 'Shapes & polarity',
  orbitals: 'Orbitals & electron configuration',
  ie: 'Ionisation energy',
  lattices: 'Crystal lattices & bonding',
  imf: 'Intermolecular forces',
  massspec: 'Mass spectrometry & Ar',
};

export const SPEC: Record<Topic | 'all', string> = {
  all: 'WCH11',
  shapes: '3.13–3.24',
  orbitals: '2.9–2.14',
  ie: '2.6–2.18',
  lattices: '3.1–3.21',
  imf: '3.25–3.29',
  massspec: '2.3–2.5',
};

export type Figure =
  | { kind: 'vsepr'; bp: number; lp: number; formula: string }
  | { kind: 'ie_jump'; vals: number[]; jumpAfter: number }
  | { kind: 'spectrum'; peaks: { mz: number; rel: number }[] }
  | { kind: 'hydrides' };

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

function qShapes(): Question {
  const specMols = MOLECULES.filter((m) => !m.beyond);
  const m = pick(specMols);
  if (Math.random() < 0.55) {
    const ans = `${m.shape}, ${m.angle}`;
    const pool = Array.from(new Set(specMols.map((x) => `${x.shape}, ${x.angle}`))).filter((x) => x !== ans);
    return {
      topic: 'shapes',
      prompt: `What are the shape and bond angle of a ${m.name.toLowerCase()} (${m.formula}) molecule?`,
      options: shuffle([ans, ...shuffle(pool).slice(0, 3)]),
      answer: ans,
      working: [
        `Central atom: ${m.central} with ${m.bp} bonding region${m.bp > 1 ? 's' : ''} and ${m.lp} lone pair${m.lp === 1 ? '' : 's'}.`,
        `Total regions of electron density = ${m.bp + m.lp}.`,
        `Shape: ${m.shape} (${m.angle}).`,
      ],
      why: m.facts[0],
      figure: { kind: 'vsepr', bp: m.bp, lp: m.lp, formula: m.formula },
    };
  }
  const ans = m.polar ? 'Polar' : 'Non-polar';
  return {
    topic: 'shapes',
    prompt: `A ${m.name.toLowerCase()} (${m.formula}) molecule has shape "${m.shape}". Is the molecule polar or non-polar, and why?`,
    options: shuffle([
      m.polar ? 'Polar — its bond dipoles do not cancel by symmetry' : 'Non-polar — its equal bond dipoles cancel by symmetry',
      m.polar ? 'Non-polar — all bonds are identical so dipoles cancel' : 'Polar — its bonds are polar, so the whole molecule must be polar',
      'Non-polar — it contains no electronegativity difference',
      'Ionic — electrons are completely transferred',
    ]),
    answer: m.polar ? 'Polar — its bond dipoles do not cancel by symmetry' : 'Non-polar — its equal bond dipoles cancel by symmetry',
    working: [`Shape: ${m.shape} (${m.angle})`, `Result: ${ans} molecule.`],
    why: m.polarWhy,
    figure: { kind: 'vsepr', bp: m.bp, lp: m.lp, formula: m.formula },
  };
}

function qOrbitals(): Question {
  const bank: Omit<Question, 'topic'>[] = [
    {
      prompt: 'Which is the correct ground-state electron configuration of a chromium atom, Cr (Z = 24)?',
      options: shuffle(['[Ar] 3d⁵ 4s¹', '[Ar] 3d⁴ 4s²', '[Ar] 3d⁶', '[Ar] 3d⁴ 4s¹ 4p¹']),
      answer: '[Ar] 3d⁵ 4s¹',
      working: ['Ar has 18 electrons; 6 remain.', 'Cr is an exception: a half-filled 3d⁵ sub-shell with 4s¹ is more stable than 3d⁴ 4s².'],
      why: 'Both Cr ([Ar] 3d⁵ 4s¹) and Cu ([Ar] 3d¹⁰ 4s¹) promote one 4s electron into 3d.',
    },
    {
      prompt: 'Which is the correct electron configuration of a copper atom, Cu (Z = 29)?',
      options: shuffle(['[Ar] 3d¹⁰ 4s¹', '[Ar] 3d⁹ 4s²', '[Ar] 3d¹⁰ 4s²', '[Ar] 3d⁸ 4s² 4p¹']),
      answer: '[Ar] 3d¹⁰ 4s¹',
      working: ['Ar has 18 electrons; 11 remain.', 'Cu promotes one 4s electron to complete the 3d¹⁰ sub-shell.'],
      why: 'A full 3d¹⁰ sub-shell with 4s¹ has lower energy than 3d⁹ 4s².',
    },
    {
      prompt: 'What is the electron configuration of an iron(II) ion, Fe²⁺ (Z = 26)?',
      options: shuffle(['[Ar] 3d⁶', '[Ar] 3d⁴ 4s²', '[Ar] 3d⁵ 4s¹', '[Ar] 3d⁸']),
      answer: '[Ar] 3d⁶',
      working: ['Neutral Fe: [Ar] 3d⁶ 4s².', 'Remove 2 electrons from 4s first → [Ar] 3d⁶.'],
      why: '4s fills before 3d, and 4s always empties before 3d when forming positive ions.',
    },
    {
      prompt: 'What is the electron configuration of a copper(II) ion, Cu²⁺ (Z = 29)?',
      options: shuffle(['[Ar] 3d⁹', '[Ar] 3d⁸ 4s¹', '[Ar] 3d¹⁰', '[Ar] 3d⁷ 4s²']),
      answer: '[Ar] 3d⁹',
      working: ['Neutral Cu: [Ar] 3d¹⁰ 4s¹.', 'Remove 1 electron from 4s and 1 from 3d → [Ar] 3d⁹.'],
      why: 'The single 4s electron is removed first, followed by one 3d electron.',
    },
    {
      prompt: 'How many orbitals and maximum electrons are in the 3d sub-shell?',
      options: shuffle(['5 orbitals, 10 electrons', '3 orbitals, 6 electrons', '7 orbitals, 14 electrons', '5 orbitals, 5 electrons']),
      answer: '5 orbitals, 10 electrons',
      working: ['s = 1 orbital (2 e⁻), p = 3 orbitals (6 e⁻), d = 5 orbitals (10 e⁻).'],
      why: 'Each orbital holds up to 2 electrons with opposite spins (Pauli exclusion principle).',
    },
  ];
  return { topic: 'orbitals', ...pick(bank) };
}

function qIE(): Question {
  if (Math.random() < 0.5) {
    const entry = pick(SUCCESSIVE_IE.slice(0, 7));
    const j = firstJump(entry.values);
    const ans = `Group ${entry.group}`;
    const others = [1, 2, 3, 4, 5, 6, 7].filter((g) => g !== entry.group);
    return {
      topic: 'ie',
      prompt: `The graph shows log₁₀ of the successive ionisation energies of a Period 3 element. Which group is it in?`,
      options: shuffle([ans, ...shuffle(others).slice(0, 3).map((g) => `Group ${g}`)]),
      answer: ans,
      working: [
        `Largest jump is between IE${j.after} (${entry.values[j.after - 1]}) and IE${j.after + 1} (${entry.values[j.after]} kJ mol⁻¹).`,
        `Therefore ${j.after} electrons are in the outer shell → Group ${entry.group} (${entry.name}).`,
      ],
      why: 'A big jump indicates that the next electron is removed from an inner shell closer to the nucleus with less shielding.',
      figure: { kind: 'ie_jump', vals: entry.values.slice(0, Math.min(8, entry.values.length)), jumpAfter: j.after },
    };
  }
  const dips = [
    {
      prompt: 'Why is the first ionisation energy of boron (801 kJ mol⁻¹) lower than that of beryllium (900 kJ mol⁻¹)?',
      ans: 'Boron’s outer electron is in a higher-energy 2p sub-shell, further from the nucleus and shielded by 2s²',
      wrong: [
        'Boron has a lower nuclear charge than beryllium',
        'Boron has two paired electrons in the same 2p orbital causing spin-pair repulsion',
        'Boron has an extra complete inner shell of electrons',
      ],
      why: 'Be is 1s² 2s² while B is 1s² 2s² 2p¹. The 2p electron is higher in energy and shielded by 2s².',
    },
    {
      prompt: 'Why is the first ionisation energy of oxygen (1314 kJ mol⁻¹) lower than that of nitrogen (1402 kJ mol⁻¹)?',
      ans: 'Oxygen has a pair of electrons in one 2p orbital, and spin-pair repulsion makes one easier to remove',
      wrong: [
        'Oxygen’s outer electron enters a new 3s shell',
        'Oxygen has fewer protons in its nucleus than nitrogen',
        'Oxygen has a larger atomic radius than nitrogen',
      ],
      why: 'N is 2p³ (all unpaired) whereas O is 2p⁴ (one orbital paired → repulsion lowers the energy required).',
    },
  ];
  const d = pick(dips);
  return {
    topic: 'ie',
    prompt: d.prompt,
    options: shuffle([d.ans, ...d.wrong]),
    answer: d.ans,
    working: [FIRST_IE[4].config + ' vs ' + FIRST_IE[3].config, FIRST_IE[7].config + ' vs ' + FIRST_IE[6].config],
    why: d.why,
  };
}

function qLattices(): Question {
  const bank: Omit<Question, 'topic'>[] = [
    {
      prompt: 'Why is solid sodium chloride brittle when a sharp force is applied?',
      options: shuffle([
        'Shifting a layer brings like-charged ions together, causing strong electrostatic repulsion that splits the lattice',
        'Its weak intermolecular London forces break easily',
        'The covalent bonds between Na and Cl snap',
        'Delocalised electrons leave the crystal under pressure',
      ]),
      answer: 'Shifting a layer brings like-charged ions together, causing strong electrostatic repulsion that splits the lattice',
      working: ['Na⁺ and Cl⁻ alternate in a 6:6 giant ionic lattice.', 'Displacing a plane aligns Na⁺–Na⁺ and Cl⁻–Cl⁻ → repulsion → fracture.'],
      why: 'Unlike metals (where delocalised electrons glue shifted layers), ionic crystals shatter on shear.',
    },
    {
      prompt: 'Why does graphite conduct electricity while diamond does not?',
      options: shuffle([
        'Each carbon in graphite bonds to 3 others, leaving 1 delocalised electron per carbon free to move along the layers',
        'Graphite is a giant ionic lattice with mobile ions',
        'Diamond has weaker covalent bonds than graphite',
        'Graphite has metallic bonds between its carbon atoms',
      ]),
      answer: 'Each carbon in graphite bonds to 3 others, leaving 1 delocalised electron per carbon free to move along the layers',
      working: ['Diamond: 4 covalent bonds per C → 0 free electrons.', 'Graphite: 3 covalent bonds per C → 1 delocalised electron per C.'],
      why: 'Delocalised π electrons carry charge parallel to the hexagonal layers of graphite.',
    },
    {
      prompt: 'Why is ice less dense than liquid water?',
      options: shuffle([
        'Hydrogen bonds hold H₂O molecules in an open hexagonal lattice with more empty space than liquid water',
        'Covalent O–H bonds lengthen when water freezes',
        'Ice loses its London dispersion forces below 0 °C',
        'Water molecules dissociate into H⁺ and OH⁻ ions when frozen',
      ]),
      answer: 'Hydrogen bonds hold H₂O molecules in an open hexagonal lattice with more empty space than liquid water',
      working: ['Each H₂O forms 4 H-bonds in a tetrahedral cage.', 'Same mass in a larger volume → lower density.'],
      why: 'This open hydrogen-bonded structure is why ice floats on liquid water.',
    },
    {
      prompt: 'Why does solid iodine have a much lower melting point (114 °C) than diamond (3550 °C)?',
      options: shuffle([
        'Melting iodine only overcomes weak London forces between I₂ molecules, whereas melting diamond breaks strong covalent bonds',
        'The I–I covalent bond is much weaker than London forces',
        'Iodine is a metallic lattice with weak attraction to electrons',
        'Iodine atoms have fewer electrons than carbon atoms',
      ]),
      answer: 'Melting iodine only overcomes weak London forces between I₂ molecules, whereas melting diamond breaks strong covalent bonds',
      working: ['I₂: simple molecular lattice.', 'Diamond: giant covalent lattice.'],
      why: 'Never say covalent bonds break when a simple molecular solid melts — only intermolecular forces are overcome.',
    },
  ];
  return { topic: 'lattices', ...pick(bank) };
}

function qImf(): Question {
  const bank: Omit<Question, 'topic'>[] = [
    {
      prompt: 'Look at the Group 4–7 hydride boiling points. Why does H₂O (100 °C) boil much higher than H₂S (−60 °C)?',
      options: shuffle([
        'H₂O forms strong hydrogen bonds between molecules, whereas H₂S only has London and weaker dipole–dipole forces',
        'H₂O has more electrons than H₂S so its London forces are stronger',
        'The O–H covalent bond is broken when water boils',
        'H₂O is a giant covalent lattice',
      ]),
      answer: 'H₂O forms strong hydrogen bonds between molecules, whereas H₂S only has London and weaker dipole–dipole forces',
      working: ['O is very electronegative (3.44) with lone pairs; S is not electronegative enough for H-bonding.'],
      why: 'Hydrogen bonding only occurs when H is covalently bonded to N, O or F.',
      figure: { kind: 'hydrides' },
    },
    {
      prompt: 'Why does H₂O (100 °C) have a higher boiling point than HF (20 °C), even though F is more electronegative than O?',
      options: shuffle([
        'Each H₂O molecule can form an average of 2 hydrogen bonds (2 lone pairs, 2 δ+ H), whereas HF forms only 1',
        'HF cannot form hydrogen bonds',
        'H₂O has a larger Mr and more electrons than HF',
        'HF is a non-polar molecule',
      ]),
      answer: 'Each H₂O molecule can form an average of 2 hydrogen bonds (2 lone pairs, 2 δ+ H), whereas HF forms only 1',
      working: ['H₂O: 2 Hδ+ + 2 lone pairs → up to 4 H-bonds around each molecule (avg 2 per molecule).', 'HF: only 1 Hδ+ → avg 1 H-bond per molecule.'],
      why: 'More hydrogen bonds per molecule require more energy to separate liquid water into steam.',
      figure: { kind: 'hydrides' },
    },
    {
      prompt: 'Pentane (b.p. 36 °C) and 2,2-dimethylpropane (b.p. 10 °C) are isomers with the same Mr. Why does pentane boil higher?',
      options: shuffle([
        'Straight-chain pentane has a larger surface area of contact between molecules, giving stronger London forces',
        'Pentane is polar whereas 2,2-dimethylpropane is non-polar',
        'Pentane has stronger C–C covalent bonds',
        'Pentane forms hydrogen bonds between its CH₂ groups',
      ]),
      answer: 'Straight-chain pentane has a larger surface area of contact between molecules, giving stronger London forces',
      working: ['Same formula C₅H₁₂ → same number of electrons.', 'Less branching → molecules pack closer → stronger London forces.'],
      why: 'Both isomers are non-polar alkanes with only London dispersion forces.',
    },
  ];
  return { topic: 'imf', ...pick(bank) };
}

function qMassSpec(): Question {
  if (Math.random() < 0.5) {
    // Generated Ar calculation
    const m1 = pick([10, 20, 35, 63, 79]);
    const m2 = m1 + (m1 === 10 ? 1 : 2);
    const p1 = pick([20, 25, 30, 60, 70, 75, 80]);
    const p2 = 100 - p1;
    const ar = (m1 * p1 + m2 * p2) / 100;
    const ans = ar.toFixed(1);
    const wrongs = [
      ((m1 + m2) / 2).toFixed(1),
      ((m1 * p2 + m2 * p1) / 100).toFixed(1),
      (ar + 0.6).toFixed(1),
    ].filter((w, i, a) => w !== ans && a.indexOf(w) === i);
    while (wrongs.length < 3) wrongs.push((ar - 0.5 * (wrongs.length + 1)).toFixed(1));
    return {
      topic: 'massspec',
      prompt: `An element has two isotopes: mass ${m1} (${p1}%) and mass ${m2} (${p2}%). Calculate its relative atomic mass Aᵣ to 1 decimal place.`,
      options: shuffle([ans, ...wrongs.slice(0, 3)]),
      answer: ans,
      working: [
        `Aᵣ = (${m1} × ${p1} + ${m2} × ${p2}) / 100`,
        `Aᵣ = (${m1 * p1} + ${m2 * p2}) / 100 = ${ar.toFixed(2)} → ${ans}`,
      ],
      why: 'Relative atomic mass is the weighted mean of the isotopic masses.',
      figure: { kind: 'spectrum', peaks: [{ mz: m1, rel: p1 }, { mz: m2, rel: p2 }] },
    };
  }
  const cl = SAMPLES[1]; // Cl2
  const br = SAMPLES[2]; // Br2
  const isCl = Math.random() < 0.6;
  const s = isCl ? cl : br;
  const ans = isCl ? '9 : 6 : 1 at m/z 70, 72, 74' : '1 : 2 : 1 at m/z 158, 160, 162';
  return {
    topic: 'massspec',
    prompt: isCl
      ? 'Chlorine has isotopes ³⁵Cl (75%) and ³⁷Cl (25%). What is the ratio and m/z of the molecular ion Cl₂⁺ peaks?'
      : 'Bromine has isotopes ⁷⁹Br (50%) and ⁸¹Br (50%). What is the ratio and m/z of the molecular ion Br₂⁺ peaks?',
    options: shuffle([
      ans,
      isCl ? '3 : 1 at m/z 70, 74' : '1 : 1 at m/z 158, 162',
      isCl ? '1 : 2 : 1 at m/z 70, 72, 74' : '9 : 6 : 1 at m/z 158, 160, 162',
      isCl ? '9 : 3 : 1 at m/z 70, 72, 74' : '1 : 1 : 1 at m/z 158, 160, 162',
    ]),
    answer: ans,
    working: isCl
      ? ['P(35,35) = ¾ × ¾ = 9/16', 'P(35,37 or 37,35) = 2 × ¾ × ¼ = 6/16', 'P(37,37) = ¼ × ¼ = 1/16 → 9 : 6 : 1']
      : ['P(79,79) = ½ × ½ = ¼', 'P(79,81 or 81,79) = 2 × ½ × ½ = ½', 'P(81,81) = ½ × ½ = ¼ → 1 : 2 : 1'],
    why: `Aᵣ(${s.formula}) = ${calcAr(s.isotopes).toFixed(1)}; the middle molecular peak can form in two ways (AB or BA).`,
    figure: { kind: 'spectrum', peaks: s.peaks.map((p) => ({ mz: p.mz, rel: p.rel })) },
  };
}

export function newQuestion(t: Topic | 'all'): Question {
  const chosen: Topic = t === 'all' ? pick(['shapes', 'orbitals', 'ie', 'lattices', 'imf', 'massspec']) : t;
  if (chosen === 'shapes') return qShapes();
  if (chosen === 'orbitals') return qOrbitals();
  if (chosen === 'ie') return qIE();
  if (chosen === 'lattices') return qLattices();
  if (chosen === 'imf') return qImf();
  return qMassSpec();
}
