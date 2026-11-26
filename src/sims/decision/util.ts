/* Shared pieces for the Decision Lab: a seeded random source, and the "predict the next step" question every
   algorithm stepper can attach to a step. */

export interface Ask { q: string; options: string[]; answer: string }

/** One frame of an algorithm run: the state to draw, what happened in words, and optionally a question that asks
    the student to predict this step before it is shown. */
export interface Step<S> { s: S; say: string; ask?: Ask }

export function rng(seed = (Math.random() * 2 ** 32) >>> 0) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)],
    shuffle: <T>(xs: T[]) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; },
  };
}
export type Rng = ReturnType<typeof rng>;

/** The answer plus up to three distinct distractors, shuffled. */
export function ask(q: string, answer: string, wrong: string[], r: Rng = rng()): Ask {
  const opts = [answer];
  for (const w of wrong) if (w && !opts.includes(w) && opts.length < 4) opts.push(w);
  return { q, answer, options: r.shuffle(opts) };
}

export const LETTERS = 'ABCDEFGHIJKLMNOP';
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
