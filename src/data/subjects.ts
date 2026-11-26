/* The Edexcel IAL subjects covered so far and their units (2018 specifications).
   Each subject gets its own page at /<id>/ and a tab in the top bar. The sciences have six units each; Maths has
   fourteen (P1–P4, FP1–FP3, M1–M3, S1–S3, D1), so a unit is labelled by its badge rather than a number.
   Biology is not covered yet: it needs a maintainer who has taken it (see the note on the home page). */

export type SubjectId = 'chemistry' | 'physics' | 'maths';

export interface Unit {
  code: string;   // the Pearson paper code, e.g. WCH15
  badge: string;  // what the unit's circle shows: '4' for a science unit, 'P1' or 'FP2' for Maths
  title: string;
  practical?: boolean;
}

export interface Subject {
  id: SubjectId;
  name: string;
  short: string;   // tab label on phones
  hue: string;     // the design-system colour token this subject uses for its artwork
  blurb: string;
  units: Unit[];
}

export const SUBJECTS: Subject[] = [
  {
    id: 'chemistry', name: 'Chemistry', short: 'Chem', hue: '--ligand',
    blurb: 'Bonding, energetics, equilibria, transition metals and organic synthesis.',
    units: [
      { code: 'WCH11', badge: '1', title: 'Structure, Bonding and Introduction to Organic Chemistry' },
      { code: 'WCH12', badge: '2', title: 'Energetics, Group Chemistry, Halogenoalkanes and Alcohols' },
      { code: 'WCH13', badge: '3', title: 'Practical Skills in Chemistry I', practical: true },
      { code: 'WCH14', badge: '4', title: 'Rates, Equilibria and Further Organic Chemistry' },
      { code: 'WCH15', badge: '5', title: 'Transition Metals and Organic Nitrogen Chemistry' },
      { code: 'WCH16', badge: '6', title: 'Practical Skills in Chemistry II', practical: true },
    ],
  },
  {
    id: 'physics', name: 'Physics', short: 'Phys', hue: '--accent',
    blurb: 'Mechanics, waves and electricity, fields, particles and cosmology.',
    units: [
      { code: 'WPH11', badge: '1', title: 'Mechanics and Materials' },
      { code: 'WPH12', badge: '2', title: 'Waves and Electricity' },
      { code: 'WPH13', badge: '3', title: 'Practical Skills in Physics I', practical: true },
      { code: 'WPH14', badge: '4', title: 'Further Mechanics, Fields and Particles' },
      { code: 'WPH15', badge: '5', title: 'Thermodynamics, Radiation, Oscillations and Cosmology' },
      { code: 'WPH16', badge: '6', title: 'Practical Skills in Physics II', practical: true },
    ],
  },
  {
    id: 'maths', name: 'Mathematics', short: 'Maths', hue: '--cond',
    blurb: 'Pure, Further Pure, Mechanics, Statistics and Decision.',
    units: [
      { code: 'WMA11', badge: 'P1', title: 'Pure Mathematics 1' },
      { code: 'WMA12', badge: 'P2', title: 'Pure Mathematics 2' },
      { code: 'WMA13', badge: 'P3', title: 'Pure Mathematics 3' },
      { code: 'WMA14', badge: 'P4', title: 'Pure Mathematics 4' },
      { code: 'WFM01', badge: 'FP1', title: 'Further Pure Mathematics 1' },
      { code: 'WFM02', badge: 'FP2', title: 'Further Pure Mathematics 2' },
      { code: 'WFM03', badge: 'FP3', title: 'Further Pure Mathematics 3' },
      { code: 'WME01', badge: 'M1', title: 'Mechanics 1' },
      { code: 'WME02', badge: 'M2', title: 'Mechanics 2' },
      { code: 'WME03', badge: 'M3', title: 'Mechanics 3' },
      { code: 'WST01', badge: 'S1', title: 'Statistics 1' },
      { code: 'WST02', badge: 'S2', title: 'Statistics 2' },
      { code: 'WST03', badge: 'S3', title: 'Statistics 3' },
      { code: 'WDM11', badge: 'D1', title: 'Decision Mathematics 1' },
    ],
  },
];

export const subjectById = (id: string) => SUBJECTS.find((s) => s.id === id);
