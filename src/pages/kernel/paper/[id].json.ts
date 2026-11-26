/* One paper for Kernel: each question's parts and, for checked questions, the images Kernel needs to see it
   (the same payload as an "Ask Kernel" button). Fetched only when Kernel opens a question by itself. */
import type { APIRoute } from 'astro';
import { PAPER_SUBJECTS } from '../../../data/paperSubjects';
import { papersFor, isPublished, seriesName } from '../../../lib/papers/registry';
import { questionContext } from '../../../lib/kernel/context';
import type { Paper } from '../../../lib/papers/types';

export function getStaticPaths() {
  return PAPER_SUBJECTS.flatMap((s) => papersFor(s.id).map((p) => ({ params: { id: p.id }, props: { p } })));
}

export const GET: APIRoute = ({ props }) => {
  const p = (props as { p: Paper }).p;
  const s = PAPER_SUBJECTS.find((x) => x.id === p.subject)!;
  const unitTitle = s.units.find((u) => u.code === p.unit)?.title;
  const body = {
    id: p.id, unit: p.unit, unitTitle, series: seriesName(p), totalMarks: p.totalMarks, durationMin: p.durationMin,
    questions: p.questions.map((q) => ({
      number: q.number, marks: q.marks, checked: isPublished(q),
      parts: q.parts.map((x) => ({ label: x.label, marks: x.marks, kind: x.kind, topics: x.topics })),
      context: isPublished(q) ? JSON.parse(questionContext(p, q, s.id, unitTitle)) : null,
    })),
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
};
