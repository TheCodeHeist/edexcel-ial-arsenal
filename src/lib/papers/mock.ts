/* Mock papers: whole past-paper questions, picked to a mark total, a topic list and Pearson's mix.

   The site ships each unit's checked questions as a small JSON pool (/papers/<subject>/mock/<unit>.json, built
   from the registry); the page picks from it in the browser. Picking is seeded, so a mock is its link: the
   same options and seed give the same questions (as long as the registry hasn't changed). */
import type { Paper, PartKind, Question } from './types';

/** A crop as the mock needs it: data-repo path and pixel size. */
export interface MockCrop { src: string; w: number; h: number }

export interface MockPart {
  label: string;
  marks: number;
  kind: PartKind;
  topics: string[];
  answer?: string;          // MCQ key
  intro?: MockCrop[];
  qp: MockCrop[];
  ms: MockCrop[];
}

export interface MockQuestion {
  paper: string;            // 'WPH14_2023_06'
  slug: string;             // its paper page, 'wph14_2023_06'
  source: string;           // 'WPH14 Jun 2023'
  number: number;
  marks: number;
  stem: MockCrop[];
  parts: MockPart[];
  note?: string;            // a note for students (registry/<subject>/notes.json)
  msNotes?: MockCrop[];     // Maths: the mark scheme's notes for examiners
}

export interface MockPool {
  unit: string;
  /** Pearson's minutes per mark for this unit (e.g. 90 min / 80 marks), for the timer. */
  minutesPerMark: number;
  /** a full paper's marks and the share of them that are multiple choice, for a paper-like mix */
  paperMarks: number;
  mcqShare: number;
  questions: MockQuestion[];
}

export interface MockOptions {
  unit: string;
  marks: number;
  topics: string[];         // empty: any topic
  mcq: boolean;             // include multiple-choice questions
  seed: string;
}

const crop = (c: { src: string; w: number; h: number }): MockCrop => ({ src: c.src, w: c.w, h: c.h });

export function isMcq(q: { parts: { kind: PartKind }[] }): boolean {
  return q.parts.every((p) => p.kind === 'mcq');
}

/** One question of the registry in the pool's shape. */
export function toMockQuestion(p: Paper, q: Question, source: string, note?: string): MockQuestion {
  return {
    paper: p.id, slug: p.id.toLowerCase(), source, number: q.number, marks: q.marks,
    stem: q.stem.map(crop),
    parts: q.parts.map((x) => ({
      label: x.label, marks: x.marks, kind: x.kind, topics: x.topics,
      ...(x.kind === 'mcq' && x.answer ? { answer: x.answer } : {}),
      ...(x.intro?.length ? { intro: x.intro.map(crop) } : {}),
      qp: x.qp.map(crop), ms: x.ms.map(crop),
    })),
    ...(note ? { note } : {}),
    ...(q.msNotes?.length ? { msNotes: q.msNotes.map(crop) } : {}),
  };
}

/* ---- seeded randomness ---- */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** mulberry32: small, fast, good enough to shuffle questions. */
export function rng(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newSeed(): string {
  return Math.random().toString(36).slice(2, 8);
}

function shuffle<T>(xs: T[], r: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---- picking ---- */

const key = (q: MockQuestion) => `${q.paper}#${q.number}`;

/** Fill `target` marks from `cands` (already shuffled), preferring questions that bring topics not yet covered
    and spreading them over papers (at most `perPaper` from one paper). */
function fill(cands: MockQuestion[], target: number, r: () => number, chosen: MockQuestion[], wanted?: Set<string>) {
  const used = new Set(chosen.map(key));
  const covered = new Set(chosen.flatMap((q) => q.parts.flatMap((p) => p.topics)));
  const fromPaper = new Map<string, number>();
  for (const q of chosen) fromPaper.set(q.paper, (fromPaper.get(q.paper) ?? 0) + 1);
  const picked: MockQuestion[] = [];
  let left = target;
  const perPaper = 2;
  while (left > 0) {
    let best: MockQuestion | undefined, bestScore = -1, seen = 0;
    for (const q of cands) {
      if (used.has(key(q)) || q.marks > left || (fromPaper.get(q.paper) ?? 0) >= perPaper) continue;
      const topics = q.parts.flatMap((p) => p.topics);
      const fresh = new Set(topics.filter((t) => !covered.has(t) && (!wanted || wanted.has(t)))).size;
      const score = fresh + r() * 0.8;
      if (score > bestScore) { best = q; bestScore = score; }
      if (++seen >= 12) break;          // look a little ahead in the shuffle, not through the whole pool
    }
    if (!best) break;
    picked.push(best);
    used.add(key(best));
    fromPaper.set(best.paper, (fromPaper.get(best.paper) ?? 0) + 1);
    for (const p of best.parts) for (const t of p.topics) covered.add(t);
    left -= best.marks;
  }
  // Short of the target: swap one picked question for an unused one exactly `left` marks bigger.
  if (left > 0) {
    outer: for (let i = picked.length - 1; i >= 0; i--) {
      for (const c of cands) {
        if (!used.has(key(c)) && c.marks === picked[i].marks + left) {
          used.delete(key(picked[i]));
          picked[i] = c;
          used.add(key(c));
          left = 0;
          break outer;
        }
      }
    }
  }
  return picked;
}

/** The mock's questions: multiple choice first (as on Pearson's papers), then the rest from fewest marks up. */
export function pick(pool: MockPool, o: MockOptions): MockQuestion[] {
  const r = rng(`${o.seed}|${o.unit}|${o.marks}|${o.topics.join(',')}|${o.mcq ? 1 : 0}`);
  const wanted = o.topics.length ? new Set(o.topics) : undefined;
  let cands = pool.questions;
  if (wanted) cands = cands.filter((q) => q.parts.some((p) => p.topics.some((t) => wanted.has(t))));
  if (!o.mcq) cands = cands.filter((q) => !isMcq(q));
  const mcqs = shuffle(cands.filter(isMcq), r);
  const rest = shuffle(cands.filter((q) => !isMcq(q)), r);
  // A paper-like share of multiple choice (10 of 80 marks); with a topic filter, whatever fits.
  const mcqTarget = !o.mcq || !mcqs.length ? 0
    : wanted ? Math.min(Math.round(o.marks * 0.25), mcqs.reduce((n, q) => n + q.marks, 0))
    : Math.round(o.marks * pool.mcqShare);
  const a = fill(mcqs, mcqTarget, r, [], wanted);
  const got = a.reduce((n, q) => n + q.marks, 0);
  const b = fill(rest, o.marks - got, r, a, wanted);
  const short = o.marks - got - b.reduce((n, q) => n + q.marks, 0);
  const c = short > 0 ? fill(mcqs.filter((q) => !a.includes(q)), short, r, [...a, ...b], wanted) : [];
  return [...[...a, ...c], ...b.sort((x, y) => x.marks - y.marks)];
}

/* ---- the link ---- */

export function toQuery(o: MockOptions): string {
  const q = new URLSearchParams({ unit: o.unit, marks: String(o.marks), seed: o.seed });
  if (o.topics.length) q.set('topics', o.topics.join(','));
  if (!o.mcq) q.set('mcq', '0');
  return q.toString();
}

export function fromQuery(s: string): Partial<MockOptions> {
  const q = new URLSearchParams(s);
  const out: Partial<MockOptions> = {};
  if (q.get('unit')) out.unit = q.get('unit')!;
  const m = Number(q.get('marks'));
  if (m > 0 && m <= 200) out.marks = Math.round(m);
  if (q.get('seed')) out.seed = q.get('seed')!.slice(0, 16);
  if (q.get('topics')) out.topics = q.get('topics')!.split(',').filter(Boolean).slice(0, 100);
  if (q.get('mcq') === '0') out.mcq = false;
  return out;
}
