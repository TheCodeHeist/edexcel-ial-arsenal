/* The Edexcel IAL sciences covered so far and their six units each (2018 specifications).
   Each subject gets its own page at /<id>/ and a tab in the top bar.
   Biology is not covered yet: it needs a maintainer who has taken it (see the note on the home page). */

export type SubjectId = 'chemistry' | 'physics';

export interface Unit {
  code: string;   // the Pearson paper code, e.g. WCH15
  n: number;      // unit number, 1–6
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
      { code: 'WCH11', n: 1, title: 'Structure, Bonding and Introduction to Organic Chemistry' },
      { code: 'WCH12', n: 2, title: 'Energetics, Group Chemistry, Halogenoalkanes and Alcohols' },
      { code: 'WCH13', n: 3, title: 'Practical Skills in Chemistry I', practical: true },
      { code: 'WCH14', n: 4, title: 'Rates, Equilibria and Further Organic Chemistry' },
      { code: 'WCH15', n: 5, title: 'Transition Metals and Organic Nitrogen Chemistry' },
      { code: 'WCH16', n: 6, title: 'Practical Skills in Chemistry II', practical: true },
    ],
  },
  {
    id: 'physics', name: 'Physics', short: 'Phys', hue: '--accent',
    blurb: 'Mechanics, waves and electricity, fields, particles and cosmology.',
    units: [
      { code: 'WPH11', n: 1, title: 'Mechanics and Materials' },
      { code: 'WPH12', n: 2, title: 'Waves and Electricity' },
      { code: 'WPH13', n: 3, title: 'Practical Skills in Physics I', practical: true },
      { code: 'WPH14', n: 4, title: 'Further Mechanics, Fields and Particles' },
      { code: 'WPH15', n: 5, title: 'Thermodynamics, Radiation, Oscillations and Cosmology' },
      { code: 'WPH16', n: 6, title: 'Practical Skills in Physics II', practical: true },
    ],
  },
];

export const subjectById = (id: string) => SUBJECTS.find((s) => s.id === id);
