/* The subjects the past-paper section covers. It is one tool across subjects, so it has its own list: Maths has
   past papers here although it has no tools, and its units aren't a 1–6 run. */
import { SUBJECTS } from './subjects';
import type { Subject as PaperSubjectId } from '../lib/papers/types';

export interface PaperUnit {
  code: string;      // Pearson paper code, e.g. WPH14, WMA11
  badge: string;     // what the unit's circle shows: '4', 'P1'
  title: string;
  practical?: boolean;
}

export interface PaperSubject {
  id: PaperSubjectId;
  name: string;
  hue: string;
  blurb: string;
  tools: boolean;    // has a subject page of tools at /<id>/
  units: PaperUnit[];
}

const science = (id: 'physics' | 'chemistry'): PaperSubject => {
  const s = SUBJECTS.find((x) => x.id === id)!;
  return { id, name: s.name, hue: s.hue, blurb: s.blurb, tools: true,
           units: s.units.map((u) => ({ code: u.code, badge: String(u.n), title: u.title, practical: u.practical })) };
};

export const PAPER_SUBJECTS: PaperSubject[] = [
  science('physics'),
  science('chemistry'),
  {
    id: 'maths', name: 'Mathematics', hue: '--cond', tools: false,
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
      { code: 'WDM01', badge: 'D1', title: 'Decision Mathematics 1 (before 2019)' },
      { code: 'WMA01', badge: 'C12', title: 'Core Mathematics 12 (before 2019)' },
      { code: 'WMA02', badge: 'C34', title: 'Core Mathematics 34 (before 2019)' },
    ],
  },
];

export const paperSubject = (id: string) => PAPER_SUBJECTS.find((s) => s.id === id);
