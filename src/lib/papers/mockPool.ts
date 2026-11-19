/* Build-time only (it reads the whole registry): a unit's mock-paper pool. The browser gets it as JSON. */
import { papersForUnit, isPublished, seriesName, questionNote } from './registry';
import { isMcq, toMockQuestion, type MockPool } from './mock';
import type { Subject } from './types';

/** The commonest value: a unit's paper length and timing, ignoring the odd paper with none recorded. */
function mode(xs: number[]): number {
  const n = new Map<number, number>();
  for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

export function pool(subject: Subject, unit: string): MockPool {
  const papers = papersForUnit(subject, unit);
  const questions = papers.flatMap((p) => p.questions.filter(isPublished).map((q) =>
    toMockQuestion(p, q, `${p.unit} ${seriesName(p, true)}`, questionNote(p, q))));
  const marks = mode(papers.map((p) => p.totalMarks));
  const minutes = mode(papers.filter((p) => p.durationMin).map((p) => p.durationMin));
  const all = questions.reduce((n, q) => n + q.marks, 0);
  const mcq = questions.filter(isMcq).reduce((n, q) => n + q.marks, 0);
  return { unit, minutesPerMark: marks ? minutes / marks : 1.2, paperMarks: marks, mcqShare: all ? mcq / all : 0, questions };
}

