/* The subjects the past-paper section covers. It is one tool across subjects, so it has its own list: Maths papers
   include the pre-2019 units (C12, C34, the old D1), which aren't on the subject page's unit map. */
import { SUBJECTS, type SubjectId } from './subjects';
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

const LEGACY: Partial<Record<SubjectId, PaperUnit[]>> = {
  maths: [
    { code: 'WDM01', badge: 'D1', title: 'Decision Mathematics 1 (before 2019)' },
    { code: 'WMA01', badge: 'C12', title: 'Core Mathematics 12 (before 2019)' },
    { code: 'WMA02', badge: 'C34', title: 'Core Mathematics 34 (before 2019)' },
  ],
};

const fromSubject = (id: SubjectId): PaperSubject => {
  const s = SUBJECTS.find((x) => x.id === id)!;
  return { id, name: s.name, hue: s.hue, blurb: s.blurb, tools: true,
           units: [...s.units.map((u) => ({ code: u.code, badge: u.badge, title: u.title, practical: u.practical })), ...(LEGACY[id] ?? [])] };
};

export const PAPER_SUBJECTS: PaperSubject[] = [fromSubject('physics'), fromSubject('chemistry'), fromSubject('maths')];

export const paperSubject = (id: string) => PAPER_SUBJECTS.find((s) => s.id === id);
