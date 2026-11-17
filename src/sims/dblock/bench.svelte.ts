/* The bench: what is in the tube, the notebook, undo history, the predict prompt and the unknown-ion game.
   Reactive state (Svelte runes) plus the action sequences that drive the canvas tube. The views only read this
   and call its methods. */

import { sleep, pick } from '../../lib/util';
import { SP, RG, SHELF, plan, noChange, predictOptions, type ReagentId, type Amount, type Transition } from './data';
import type { Tube } from './tube';

export type Mode = 'explore' | 'predict' | 'unknown' | 'atlas';

export type Entry =
  | { kind: 'start'; sp: string }
  | { kind: 'none'; r: ReagentId; amt: Amount; sp: string; msg: string }
  | { kind: 'step'; r: ReagentId; amt: Amount; sp: string; t: Transition; step: number; of: number };

export interface Score { pRight: number; pTotal: number; streak: number; best: number; uSolved: number; uTotal: number; aRight: number; aTotal: number }

interface Ask { r: ReagentId; amt: Amount; from: string; final: string; options: string[]; picked: string | null; resolve: (ok: boolean | null) => void }

export class Bench {
  mode = $state<Mode>('explore');
  start = $state('Cu2');          // the stock solution picked on the shelf
  cur = $state('Cu2');            // what is in the tube now
  entries = $state<Entry[]>([]);
  busy = $state(false);
  status = $state('');
  ask = $state<Ask | null>(null);
  unknown = $state<string | null>(null);
  revealed = $state(false);
  unkTries = $state(0);
  wrongIds = $state<string[]>([]);

  tube: Tube | null = null;
  private hist: { sp: string; level: number; zinc: boolean; n: number }[] = [];

  constructor(public score: Score) {}

  /** In unknown mode the formula, equations and types stay hidden until the ion is named. */
  get hidden() { return this.mode === 'unknown' && !this.revealed; }
  get canUndo() { return !this.busy && this.hist.length > 0; }

  private log(e: Entry) { this.entries.push(e); }

  fresh(sp: string, silent = false) {
    this.cur = sp; this.tube?.fresh(sp);
    this.hist = []; this.entries = [];
    if (!silent) this.log({ kind: 'start', sp });
  }

  pickStock(id: string) { if (this.busy) return; this.start = id; this.fresh(id); }

  undo() {
    if (!this.canUndo) return;
    const h = this.hist.pop()!; this.cur = h.sp;
    if (this.tube) { this.tube.levelT = this.tube.level = h.level; if (!h.zinc) this.tube.clearZinc(); this.tube.instant(h.sp); }
    this.entries = this.entries.slice(0, h.n);
  }

  /* ---------- predict ---------- */
  private predict(r: ReagentId, amt: Amount, steps: Transition[]): Promise<boolean | null> {
    const final = steps.length ? SP[steps[steps.length - 1].t].look : 'No visible change';
    return new Promise((resolve) => {
      this.ask = { r, amt, from: this.cur, final, options: predictOptions(this.cur, final), picked: null, resolve };
    });
  }
  answer(opt: string) {
    const a = this.ask; if (!a || a.picked) return;
    a.picked = opt;
    const ok = opt === a.final, s = this.score;
    s.pTotal++; if (ok) { s.pRight++; s.streak++; s.best = Math.max(s.best, s.streak); } else s.streak = 0;
    setTimeout(() => { this.ask = null; a.resolve(ok); }, ok ? 700 : 1600);
  }
  cancelAsk() { const a = this.ask; if (!a) return; this.ask = null; a.resolve(null); }

  /* ---------- adding a reagent ---------- */
  async act(r: ReagentId, amt: Amount) {
    if (this.busy || this.ask) return;
    const steps = plan(this.cur, r, amt);
    if (this.mode === 'predict' && (await this.predict(r, amt, steps)) === null) return;
    const tube = this.tube!;
    this.busy = true;
    this.hist.push({ sp: this.cur, level: tube.levelT, zinc: tube.zinc.length > 0, n: this.entries.length });
    const rg = RG[r];

    if (r === 'air') { this.status = 'Shaking and leaving to stand…'; tube.shake = 1; await sleep(700); }
    else if (r === 'zn') { this.status = 'Adding zinc granules…'; tube.addZinc(); tube.fizz = 60; await sleep(700); }

    if (!steps.length) {
      if (r !== 'air' && r !== 'zn') { await tube.drip(amt === 'xs' ? 8 : 3, rg.c, r === 'kmno4' ? rg.c : null, 0.8); tube.raise(amt === 'xs' ? 0.1 : 0.035); }
      if (r === 'water') { tube.tint(null, Math.max(0.12, tube.la * 0.82)); tube.raise(0.06); }
      if (r === 'kmno4') tube.tint('#8a3a9a', Math.max(tube.laT, 0.55));
      this.log({ kind: 'none', r, amt, sp: this.cur, msg: noChange(this.cur, r) });
      this.status = ''; this.busy = false; return;
    }

    for (let i = 0; i < steps.length; i++) {
      const t = steps[i], S = SP[t.t];
      if (r === 'zn') { if (i > 0) { this.status = 'Waiting…'; await sleep(1700); } tube.fizz = 120; this.status = ''; }
      else if (r !== 'air') {
        const plumeCol = r === 'kmno4' ? rg.c : S.ppt || S.liq || rg.c;
        await tube.drip(amt === 'xs' ? (i === 0 ? 4 : 6) : 3, rg.c, plumeCol, S.ppt ? 0.7 : 0.55);
        tube.raise(amt === 'xs' ? 0.05 : 0.035);
        if (i > 0) await sleep(250);
      }
      tube.apply(t); this.cur = t.t;
      this.log({ kind: 'step', r, amt, sp: t.t, t, step: i, of: steps.length });
      if (i < steps.length - 1 && r !== 'zn') await sleep(1400);
    }
    await sleep(500);
    this.status = ''; this.busy = false;
  }

  /* ---------- unknown ion ---------- */
  newUnknown() {
    if (this.busy) return;
    this.unknown = pick(SHELF.map((s) => s[0]).filter((s) => s !== this.unknown));
    this.revealed = false; this.unkTries = 0; this.wrongIds = [];
    this.score.uTotal++;
    this.fresh(this.unknown);
  }
  guess(id: string) {
    if (this.revealed || this.wrongIds.includes(id)) return;
    if (id === this.unknown) { this.revealed = true; this.score.uSolved++; }
    else { this.unkTries++; this.wrongIds.push(id); }
  }
}
