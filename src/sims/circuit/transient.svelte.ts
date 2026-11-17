/* Time for circuits with capacitors. A Clock holds the capacitor p.d.s and simulated time; tick() moves time on by
   one animation frame (scaled by speed, in substeps of at most 4 ms so curves stay smooth) and solves the circuit
   at the new instant for display. Paused, it still re-solves each frame so edits show at once.

   onStep(t, sol) runs after every substep: the I–V Lab's data logger uses it to take readings at exact times. */

import { solve, type Solution } from './solve';
import type { CircuitData } from './parts';

export const hasCaps = (c: CircuitData) => c.parts.some((p) => p.kind === 'capacitor');

export interface Sample { t: number; v: number; i: number }

export class Clock {
  t = $state(0);
  playing = $state(true);
  speed = $state(1);
  sol = $state.raw<Solution | null>(null);
  trace = $state.raw<Sample[]>([]);
  vc: Record<string, number> = {};
  private traceId = '';

  /** Advance by a real-time interval (seconds) and solve for display. watch: a part whose V and I to record. */
  tick(c: CircuitData, real: number, watch?: string | null, onStep?: (t: number, s: Solution) => void) {
    const span = this.playing ? Math.min(real, 0.1) * this.speed : 0;
    if (span > 0) {
      const n = Math.min(80, Math.max(1, Math.ceil(span / 0.004))), h = span / n;
      let t = this.t;
      for (let k = 0; k < n; k++) {
        const s = solve(c, { dt: h, vc: this.vc });
        this.vc = s.vc; t += h;
        onStep?.(t, s);
      }
      this.t = t;
    }
    const sol = solve(c, { dt: 1e-9, vc: this.vc });
    this.sol = sol;
    this.record(watch ?? null, sol, span > 0);
  }

  /** The scope keeps the last 10 seconds of real time (so 100 s of simulated time at ×10). */
  get window() { return 10 * this.speed; }

  private record(id: string | null, s: Solution, moved: boolean) {
    if (id !== this.traceId) { this.traceId = id ?? ''; this.trace = []; }
    if (!id || !moved || !s.parts[id]) return;
    const r = s.parts[id], from = this.t - this.window;
    const keep = this.trace.filter((x) => x.t >= from);
    const last = keep[keep.length - 1];
    if (last && this.t - last.t < this.window / 400) return;
    this.trace = [...keep, { t: this.t, v: r.v, i: r.i }];
  }

  reset() { this.vc = {}; this.t = 0; this.trace = []; }
}
