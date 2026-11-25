/* Atoms & Bonding Lab: Mass spectrometry, isotope peaks, molecular ion peaks & Ar calculations (Spec 2.3–2.5). */

export const PEAK_COLS = [0x60a5fa, 0xf87171, 0x4ade80, 0xfbbf24, 0xc084fc] as const;
export const PEAK_HEX = ['#60a5fa', '#f87171', '#4ade80', '#fbbf24', '#c084fc'] as const;

export interface Peak {
  mz: number;
  rel: number;   // relative abundance (percentage or relative height)
  label: string;
}

export interface SamplePreset {
  id: string;
  name: string;
  formula: string;
  diatomic?: boolean;
  isotopes: { mass: number; pct: number; label: string }[];
  peaks: Peak[];
  note: string;
  facts: string[];
}

export const SAMPLES: SamplePreset[] = [
  {
    id: 'mg', name: 'Magnesium', formula: 'Mg',
    isotopes: [
      { mass: 24, pct: 78.99, label: '²⁴Mg⁺' },
      { mass: 25, pct: 10.00, label: '²⁵Mg⁺' },
      { mass: 26, pct: 11.01, label: '²⁶Mg⁺' },
    ],
    peaks: [
      { mz: 24, rel: 78.99, label: '²⁴Mg⁺' },
      { mz: 25, rel: 10.00, label: '²⁵Mg⁺' },
      { mz: 26, rel: 11.01, label: '²⁶Mg⁺' },
    ],
    note: 'Three stable isotopes give three +1 peaks. Relative atomic mass Ar = (24×78.99 + 25×10.00 + 26×11.01) / 100 = 24.3.',
    facts: [
      'Ar is the weighted mean mass of an atom compared with 1/12th the mass of a carbon-12 atom.',
      'Lighter ²⁴Mg⁺ ions travel faster in a TOF drift tube (and deflect more in a magnetic field) than ²⁶Mg⁺.',
      'A tiny peak at m/z 12 can appear from ²⁴Mg²⁺ ions (half the m/z ratio).',
    ],
  },
  {
    id: 'cl2', name: 'Chlorine', formula: 'Cl2', diatomic: true,
    isotopes: [
      { mass: 35, pct: 75, label: '³⁵Cl⁺' },
      { mass: 37, pct: 25, label: '³⁷Cl⁺' },
    ],
    peaks: [
      { mz: 35, rel: 75, label: '³⁵Cl⁺' },
      { mz: 37, rel: 25, label: '³⁷Cl⁺' },
      { mz: 70, rel: 56.25, label: '³⁵Cl₂⁺' },
      { mz: 72, rel: 37.5, label: '³⁵Cl³⁷Cl⁺' },
      { mz: 74, rel: 6.25, label: '³⁷Cl₂⁺' },
    ],
    note: 'Atomic peaks at 35 and 37 (3:1 ratio), plus molecular ion Cl₂⁺ peaks at 70, 72 and 74 in a 9 : 6 : 1 ratio.',
    facts: [
      'P(³⁵Cl–³⁵Cl) = ¾ × ¾ = 9/16; P(³⁵Cl–³⁷Cl or ³⁷Cl–³⁵Cl) = 2 × ¾ × ¼ = 6/16; P(³⁷Cl–³⁷Cl) = ¼ × ¼ = 1/16.',
      'Ar(Cl) = (35 × 75 + 37 × 25) / 100 = 35.5.',
      'The 9 : 6 : 1 Cl₂⁺ triplet is one of the most tested questions in WCH11.',
    ],
  },
  {
    id: 'br2', name: 'Bromine', formula: 'Br2', diatomic: true,
    isotopes: [
      { mass: 79, pct: 50, label: '⁷⁹Br⁺' },
      { mass: 81, pct: 50, label: '⁸¹Br⁺' },
    ],
    peaks: [
      { mz: 79, rel: 50, label: '⁷⁹Br⁺' },
      { mz: 81, rel: 50, label: '⁸¹Br⁺' },
      { mz: 158, rel: 25, label: '⁷⁹Br₂⁺' },
      { mz: 160, rel: 50, label: '⁷⁹Br⁸¹Br⁺' },
      { mz: 162, rel: 25, label: '⁸¹Br₂⁺' },
    ],
    note: 'Two nearly equal isotopes (50% ⁷⁹Br, 50% ⁸¹Br) give a 1 : 1 atomic doublet and a 1 : 2 : 1 molecular triplet at 158, 160 and 162.',
    facts: [
      'Ar(Br) = (79 × 50 + 81 × 50) / 100 = 80.0.',
      'Two ways to make m/z 160: ⁷⁹Br–⁸¹Br and ⁸¹Br–⁷⁹Br, so the 160 peak is twice as tall as 158 and 162.',
    ],
  },
  {
    id: 'b', name: 'Boron', formula: 'B',
    isotopes: [
      { mass: 10, pct: 19.9, label: '¹⁰B⁺' },
      { mass: 11, pct: 80.1, label: '¹¹B⁺' },
    ],
    peaks: [
      { mz: 10, rel: 19.9, label: '¹⁰B⁺' },
      { mz: 11, rel: 80.1, label: '¹¹B⁺' },
    ],
    note: 'Two isotopes (¹⁰B and ¹¹B) give Ar = (10×19.9 + 11×80.1) / 100 = 10.8.',
    facts: [
      'Even though both isotope masses are whole numbers, Ar = 10.8 is not a whole number because it is a weighted average.',
    ],
  },
  {
    id: 'ne', name: 'Neon', formula: 'Ne',
    isotopes: [
      { mass: 20, pct: 90.48, label: '²⁰Ne⁺' },
      { mass: 21, pct: 0.27, label: '²¹Ne⁺' },
      { mass: 22, pct: 9.25, label: '²²Ne⁺' },
    ],
    peaks: [
      { mz: 20, rel: 90.48, label: '²⁰Ne⁺' },
      { mz: 21, rel: 0.27, label: '²¹Ne⁺' },
      { mz: 22, rel: 9.25, label: '²²Ne⁺' },
    ],
    note: 'Monatomic noble gas: three isotopes give Ar = 20.2.',
    facts: [
      'Noble gases are monatomic, so there are no diatomic molecular ion peaks.',
    ],
  },
];

export function calcAr(isotopes: { mass: number; pct: number }[]): number {
  const sumPct = isotopes.reduce((s, x) => s + x.pct, 0) || 1;
  return isotopes.reduce((s, x) => s + x.mass * x.pct, 0) / sumPct;
}
