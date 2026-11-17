/* Time for circuits that change: capacitors, a.c. supplies, or anything watched on the oscilloscope. A Clock holds
   the capacitor p.d.s and simulated time; tick() moves time on by one animation frame (scaled by speed, in
   substeps of at most 4 ms, or 1/40 of an a.c. period, so curves stay smooth) and solves the circuit at the new
   instant for display. Paused or held, it does not tick at all: the app solves once per edit with still().

   It also records, over the last `window` seconds of simulated time:
     every meter's signed reading (ammeter: current from its + terminal; voltmeter: p.d. of + relative to −), the
     oscilloscope's channels;
     the p.d. and current of one watched part, for the inspector's trace.
   onStep(t, sol) runs after every substep: the capacitor practical's data logger uses it. */

import { solve, type Solution } from './solve';
import type { CircuitData } from './parts';

export const hasCaps = (c: CircuitData) => c.parts.some((p) => p.kind === 'capacitor');
export const hasAC = (c: CircuitData) => c.parts.some((p) => p.kind === 'ac');

/** Below these the solver's answer is rounding noise (its ideal meters and wires are not exactly ideal): record 0. */
const NOISE_V = 1e-6, NOISE_I = 1e-7;
const qv = (v: number) => (Math.abs(v) < NOISE_V ? 0 : v), qi = (i: number) => (Math.abs(i) < NOISE_I ? 0 : i);

export interface Sample { t: number; m: Record<string, number>; w?: { id: string; v: number; i: number } }

export class Clock {
  t = $state(0);
  playing = $state(true);
  speed = $state(1);
  window = $state(10);     // seconds of simulated time the traces keep (the oscilloscope's timebase)
  sol = $state.raw<Solution | null>(null);
  trace = $state.raw<Sample[]>([]);
  vc: Record<string, number> = {};
  private buf: Sample[] = [];

  /** Advance by a real-time interval (seconds) and solve for display. watch: a part whose V and I to record. */
  tick(c: CircuitData, real: number, watch?: string | null, onStep?: (t: number, s: Solution) => void) {
    const span = this.playing ? Math.min(real, 0.1) * this.speed : 0;
    const meters = c.parts.filter((p) => p.kind === 'ammeter' || p.kind === 'voltmeter').map((p) => [p.id, p.kind === 'ammeter'] as const);
    if (span > 0) {
      // a frame gets at most ~8 ms of solving: a heavy circuit slows simulated time rather than the page
      const budget = performance.now() + 8;
      const fmax = Math.max(0, ...c.parts.filter((p) => p.kind === 'ac').map((p) => p.p.freq ?? 1));
      const hmax = fmax ? Math.min(0.004, 1 / (40 * fmax)) : 0.004;
      const n = Math.min(160, Math.max(1, Math.ceil(span / hmax))), h = span / n;
      let t = this.t;
      for (let k = 0; k < n; k++) {
        if (k > 0 && performance.now() > budget) break;
        t += h;
        const s = solve(c, { dt: h, vc: this.vc, t, lite: true });
        this.vc = s.vc;
        onStep?.(t, s);
        this.record(t, s, meters, watch ?? null);
      }
      this.t = t;
      const from = this.t - this.window;
      let cut = 0; while (cut < this.buf.length && this.buf[cut].t < from) cut++;
      if (cut) this.buf = this.buf.slice(cut);
      this.trace = this.buf.slice();
    }
    this.sol = this.still(c);
  }

  /** The circuit at this instant, without moving time on (paused, or held while the board is being edited). */
  still(c: CircuitData) { return solve(c, { dt: 1e-9, vc: this.vc, t: this.t }); }

  private record(t: number, s: Solution, meters: readonly (readonly [string, boolean])[], watch: string | null) {
    const last = this.buf[this.buf.length - 1];
    if (last && t - last.t < this.window / 1000) return;
    const m: Record<string, number> = {};
    for (const [id, amm] of meters) { const r = s.parts[id]; if (r) m[id] = amm ? qi(r.i) : qv(r.v); }
    const r = watch ? s.parts[watch] : undefined;
    this.buf.push({ t, m, w: r && watch ? { id: watch, v: qv(r.v), i: qi(r.i) } : undefined });
  }

  reset() { this.vc = {}; this.t = 0; this.buf = []; this.trace = []; }
}
