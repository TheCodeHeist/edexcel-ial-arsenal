/* Builds the data-kernel payload for "Ask Kernel" buttons on past-paper pages (runs at build time). */
import type { Paper, Part, Question } from '../papers/types';
import type { KContext } from './store.svelte';
import { cropUrl } from '../papers/crops';
import { paperSlug, seriesName } from '../papers/registry';

const uniq = (a: string[]) => [...new Set(a)];

/** A whole question: stem, each part's lead-in and text; then every part's mark scheme and the examiners' notes. */
export function questionContext(p: Paper, q: Question, subjectId: string, unitTitle?: string): string {
  const mcq = q.parts.filter((x) => x.kind === 'mcq' && x.answer).map((x) => `${x.label}: ${x.answer}`).join(', ');
  const ctx: KContext = {
    id: `${p.id}_q${q.number}`,
    title: `${p.unit} ${seriesName(p, true)} · Q${q.number}`,
    subtitle: unitTitle,
    href: `/papers/${subjectId}/${paperSlug(p)}/#q${q.number}`,
    marks: q.marks,
    qp: uniq([...q.stem, ...q.parts.flatMap((x) => [...(x.intro ?? []), ...x.qp])].map(cropUrl)),
    ms: uniq([...q.parts.flatMap((x) => x.ms), ...(q.msNotes ?? [])].map(cropUrl)),
    ...(mcq ? { answer: mcq } : {}),
  };
  return JSON.stringify(ctx);
}

/** One part, as on a topic page: what it needs to be read (stem, lead-in), the part, and its mark scheme. */
export function partContext(p: Paper, q: Question, part: Part, subjectId: string, unitTitle?: string): string {
  const ctx: KContext = {
    id: `${p.id}_${part.label}`,
    title: `${p.unit} ${seriesName(p, true)} · ${part.label}`,
    subtitle: unitTitle,
    href: `/papers/${subjectId}/${paperSlug(p)}/#q${q.number}`,
    marks: part.marks,
    qp: uniq([...q.stem, ...(part.intro ?? []), ...part.qp].map(cropUrl)),
    ms: uniq([...part.ms, ...(q.msNotes ?? [])].map(cropUrl)),
    ...(part.kind === 'mcq' && part.answer ? { answer: `${part.label}: ${part.answer}` } : {}),
  };
  return JSON.stringify(ctx);
}
