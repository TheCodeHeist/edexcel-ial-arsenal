/* Carbon Alchemy app state: preferences, progress and scores (saved to the browser), the two circles, and the
   state of each mode. Created once by App.svelte and shared with every view through context. */

import { getContext, setContext } from 'svelte';
import { persisted } from '../../lib/persist.svelte';
import { shuffle, pick } from '../../lib/util';
import { CP, RX, STARTERS, LABSET, LABRX, UNKNOWNS, TESTS, PREPS, genChallenge, nextStep, makeOpts, sampleCode, testResult,
  type Reaction, type Difficulty } from './data';
import { Circle, type Win } from './circle.svelte';

export type Tab = 'lab' | 'synthesis' | 'identify' | 'codex';
export type Fmt = 'skeletal' | 'displayed' | 'structural';
export type CxSub = 'reactions' | 'tests' | 'preparation';

export class Carbon {
  prefs = persisted('carbon-prefs', { fmt: 'skeletal' as Fmt, free: false, diff: 'medium' as Difficulty });
  progress = persisted('carbon-progress', { found: [...STARTERS] as string[], foundRx: [] as number[] });
  score = persisted('carbon-score', { synSolved: 0, synStreak: 0, synBest: 0, idSolved: 0, idTotal: 0, cxRight: 0, cxTotal: 0 });

  tab = $state<Tab>('lab');
  docked = $state(false);           // phones on Lab / Synthesis: items live in the bottom drawer

  /* ---------- lab ---------- */
  labLog = $state<{ rx: number; key: number }[]>([]);
  lastProduct = $state<string | null>(null);
  freshIds = $state<string[]>([]);
  private logKey = 0;

  lab = new Circle({
    title: 'Transmutation circle', sub: 'Compound + reagent → product', cap: 'Drag a compound and a reagent into the circle · or tap them',
    onResult: (r) => {
      const found = new Set(this.progress.found);
      const nw = r.p.filter((p) => !found.has(p));
      this.progress.found = [...found, ...nw];
      if (!this.progress.foundRx.includes(r.id)) this.progress.foundRx = [...this.progress.foundRx, r.id];
      this.freshIds = nw; this.lastProduct = r.p[0];
      this.labLog = [{ rx: r.id, key: ++this.logKey }, ...this.labLog].slice(0, 40);
      return { isNew: nw.length > 0 };
    },
  });

  get labFound() { return this.progress.found.filter((id) => LABSET.has(id)).length; }
  get labRxFound() { return this.progress.foundRx.length; }
  resetLab() {
    this.progress.found = [...STARTERS]; this.progress.foundRx = [];
    this.labLog = []; this.lastProduct = null; this.freshIds = [];
    this.lab.clear();
  }

  /* ---------- synthesis ---------- */
  syn = $state({ start: [] as string[], target: '' as string, sol: [] as Reaction[], par: 0, made: [] as string[], steps: [] as Reaction[],
    given: false, won: false, hint: 0, hinted: false, hintRx: null as number | null, hintFull: false, wonPulse: 0 });

  synCircle = new Circle({
    title: 'Transmutation circle', sub: 'Use only what is on your bench', cap: 'Drag a starting material and a reagent into the circle',
    allow: (item) => item[0] === 'r' || this.syn.start.includes(item.slice(2)) || this.syn.made.includes(item.slice(2)),
    onResult: (r) => {
      const S = this.syn, sc = this.score;
      r.p.forEach((p) => { if (!S.start.includes(p) && !S.made.includes(p)) S.made.push(p); });
      S.steps.push(r);
      let win: Win | null = null;
      if (r.p.includes(S.target) && !S.won) {
        S.won = true;
        if (!S.given) {
          let stars = S.steps.length <= S.par ? 3 : S.steps.length <= S.par + 2 ? 2 : 1; if (S.hinted) stars = Math.max(1, stars - 1);
          sc.synSolved++; sc.synStreak++; sc.synBest = Math.max(sc.synBest, sc.synStreak);
          win = { stars, msg: `${S.steps.length} step${S.steps.length > 1 ? 's' : ''} · par ${S.par}${S.hinted ? ' · with hints' : ''}` };
        } else win = { stars: 0, msg: 'Made it — after seeing the route. Try a fresh target to keep your streak.' };
        S.wonPulse++;
      }
      return win ? { win } : {};
    },
    onNext: () => this.newSyn(),
  });

  newSyn() {
    const g = genChallenge(this.prefs.diff, this.syn.target || null);
    Object.assign(this.syn, { start: g.start, target: g.target, sol: g.sol, par: g.sol.length, made: [], steps: [], given: false, won: false, hint: 0, hinted: false, hintRx: null, hintFull: false });
    this.synCircle.clear();
  }
  /** a new target before finishing breaks the streak */
  skipSyn() { if (!this.syn.won && !this.syn.given && this.syn.steps.length) this.score.synStreak = 0; this.newSyn(); }
  setDiff(d: Difficulty) { this.prefs.diff = d; this.newSyn(); }
  hint() {
    const S = this.syn, n = nextStep([...S.start, ...S.made], S.target); if (!n) return;
    S.hint++; S.hinted = true;
    S.hintRx = n.id; S.hintFull = S.hint >= 2;
    if (S.hint >= 2) S.hint = 0;
  }
  giveUp() { this.syn.given = true; this.syn.hintRx = null; this.score.synStreak = 0; }

  /* ---------- identify ---------- */
  id = $state({ cid: '', code: '', done: [] as string[], tries: 0, solved: false, opts: [] as string[], wrong: [] as string[],
    log: [] as { t: string; obs: string; pos: boolean; info: string; key: number }[], rerun: { t: '', n: 0 } });

  newUnknown() {
    let c: string; do { c = pick(UNKNOWNS); } while (c === this.id.cid && UNKNOWNS.length > 1);
    Object.assign(this.id, { cid: c, code: sampleCode(), done: [], tries: 0, solved: false, opts: makeOpts(c), wrong: [], log: [], rerun: { t: '', n: 0 } });
  }
  skipUnknown() { if (!this.id.solved && this.id.done.length) this.score.idTotal++; this.newUnknown(); }
  runTest(tid: string) {
    const I = this.id;
    if (I.done.includes(tid)) { I.rerun = { t: tid, n: I.rerun.n + 1 }; return; }
    I.done.push(tid);
    const res = testResult(I.cid, tid), T = TESTS.find((t) => t.id === tid)!;
    I.log.unshift({ t: T.n, obs: res.obs, pos: res.pos, info: 'Positive for: ' + T.pos + '.', key: ++this.logKey });
  }
  guess(cid: string) {
    const I = this.id; if (I.solved || I.wrong.includes(cid)) return;
    if (cid === I.cid) { I.solved = true; this.score.idSolved++; this.score.idTotal++; }
    else { I.tries++; I.wrong.push(cid); }
  }

  /* ---------- codex ---------- */
  cx = $state({ sub: 'reactions' as CxSub, layout: 'cards' as 'cards' | 'flow', quiz: false, epoch: 0 });
  prep = $state<Record<string, { done: number; pool: number[]; miss: number }>>({});
  toggleQuiz() {
    this.cx.quiz = !this.cx.quiz; this.cx.epoch++;
    // every procedure starts again with its steps shuffled
    this.prep = this.cx.quiz ? Object.fromEntries(PREPS.map((p) => [p.id, { done: 0, pool: shuffle(p.steps.map((_, k) => k)), miss: 0 }])) : {};
  }
  resetCxScore() { this.score.cxRight = 0; this.score.cxTotal = 0; }
  pickStep(id: string, k: number): boolean {
    const st = this.prep[id];
    this.score.cxTotal++;
    if (k === st.done) { st.done++; this.score.cxRight++; return true; }
    st.miss++; return false;
  }

  /* ---------- shared ---------- */
  /** the circle that tapped or dragged items go into, if the current mode has one */
  get active(): Circle | null { return this.tab === 'lab' ? this.lab : this.tab === 'synthesis' ? this.synCircle : null; }
  inSlot(item: string) { return !!this.active?.has(item); }

  stats(): [string, string | number][] {
    const s = this.score;
    switch (this.tab) {
      case 'lab': return [['Discovered', `${this.labFound}/${LABSET.size}`], ['Reactions', `${this.labRxFound}/${LABRX.length}`]];
      case 'synthesis': return [['Solved', s.synSolved], ['Streak', s.synStreak], ['Best', s.synBest]];
      case 'identify': return [['Solved', `${s.idSolved}/${s.idTotal}`], ['Wrong guesses', this.id.tries]];
      default: return this.cx.quiz ? [['Self-test', `${s.cxRight}/${s.cxTotal}`]] : [['Reactions', RX.length], ['Tests', TESTS.length], ['Compounds', Object.keys(CP).length]];
    }
  }
}

const KEY = Symbol('carbon');
export const provide = (c: Carbon) => setContext(KEY, c);
export const useCarbon = () => getContext<Carbon>(KEY);
