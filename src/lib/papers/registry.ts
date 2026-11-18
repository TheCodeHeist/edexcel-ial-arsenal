/* The past-paper registry, read at build time: every registry/<subject>/papers/*.json the pipeline wrote, and each
   subject's topic list. Pages built from it are fully static; the question images come from the data repo
   (see crops.ts). */
import type { Paper, Question, Subject, TopicList, TopicPoint } from './types';

const PAPER_FILES = import.meta.glob<Paper>('/registry/*/papers/*.json', { eager: true, import: 'default' });
const TOPIC_FILES = import.meta.glob<TopicList>('/registry/*/topics.json', { eager: true, import: 'default' });

const MONTHS: Record<string, string> = { '01': 'January', '06': 'June', '10': 'October' };
const SHORT_MONTHS: Record<string, string> = { '01': 'Jan', '06': 'Jun', '10': 'Oct' };

/** Every paper of a subject, oldest first; a series' A paper right after its main one. */
export function papersFor(subject: Subject): Paper[] {
  return Object.values(PAPER_FILES)
    .filter((p) => p.subject === subject)
    .sort((a, b) => a.series.localeCompare(b.series) || a.unit.localeCompare(b.unit)
      || (a.variant ?? '').localeCompare(b.variant ?? ''));
}

export function papersForUnit(subject: Subject, unit: string): Paper[] {
  return papersFor(subject).filter((p) => p.unit === unit);
}

/** A question is shown once its crops have been checked, by a person or by the AI reader with no risk found. */
export function isPublished(q: Question): boolean {
  return q.check === 'human' || q.check === 'machine';
}

/** 'June 2026', 'June 2026 (A)' */
export function seriesName(p: Paper, short = false): string {
  const [year, month] = p.series.split('-');
  const name = `${(short ? SHORT_MONTHS : MONTHS)[month] ?? month} ${year}`;
  return p.variant ? `${name} (${p.variant})` : name;
}

/** URL slug of a paper page: lower-case id, e.g. wph14_2026_06_a */
export function paperSlug(p: Paper): string {
  return p.id.toLowerCase();
}

/** Tag id → topic point, for chips. */
export function topicIndex(subject: Subject): Map<string, TopicPoint> {
  const list = Object.values(TOPIC_FILES).find((t) => t.subject === subject);
  const out = new Map<string, TopicPoint>();
  for (const u of list?.units ?? []) for (const g of u.groups) for (const p of g.points) out.set(p.id, p);
  return out;
}

/** Source PDF links can carry raw spaces (PaperLords file names); make them valid URLs. */
export function safeUrl(url: string): string {
  return encodeURI(decodeURI(url));
}

/** The subject's topic list (units → groups → points), or undefined if it has none yet. */
export function topicList(subject: Subject): TopicList | undefined {
  return Object.values(TOPIC_FILES).find((t) => t.subject === subject);
}

/** One tagged part, with what's needed to show it on its own: its paper, its question, and the part. */
export interface TaggedPart {
  paper: Paper;
  question: Question;
  part: Question['parts'][number];
  /** the part's position in its question (its lead-in is shown only when it differs from the part before) */
  index: number;
}

/** Every published part tagged with each topic id, newest paper first. */
export function partsByTopic(subject: Subject): Map<string, TaggedPart[]> {
  const out = new Map<string, TaggedPart[]>();
  for (const paper of [...papersFor(subject)].reverse()) {
    for (const question of paper.questions) {
      if (!isPublished(question)) continue;
      question.parts.forEach((part, index) => {
        for (const t of part.topics) {
          if (!out.has(t)) out.set(t, []);
          out.get(t)!.push({ paper, question, part, index });
        }
      });
    }
  }
  return out;
}
