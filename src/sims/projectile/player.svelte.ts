/* The flight clock: plays a flight from t = 0 to its landing at a chosen speed, one animation frame at a time.
   Under reduced motion it jumps straight to the end. */
import { RM } from '../../lib/util';

export class Player {
  t = $state(0);
  playing = $state(false);
  T = $state(0);
  speed = 1;
  onend: (() => void) | null = null;
  #raf = 0;
  #last = 0;

  play(T: number, from = 0) {
    this.T = T;
    this.t = from;
    cancelAnimationFrame(this.#raf);
    if (RM || T <= 0) { this.t = T; this.playing = false; this.onend?.(); return; }
    this.playing = true;
    this.#last = performance.now();
    this.#raf = requestAnimationFrame(this.#step);
  }
  #step = (now: number) => {
    const dt = Math.min(0.05, (now - this.#last) / 1000);
    this.#last = now;
    this.t = Math.min(this.T, this.t + dt * this.speed);
    if (this.t >= this.T) { this.playing = false; this.onend?.(); return; }
    this.#raf = requestAnimationFrame(this.#step);
  };
  pause() { cancelAnimationFrame(this.#raf); this.playing = false; }
  resume() { if (this.t >= this.T) this.play(this.T); else this.play(this.T, this.t); }
  seek(t: number) { this.pause(); this.t = Math.max(0, Math.min(this.T, t)); }
  /** Show a flight already finished (no animation). */
  done(T: number) { this.pause(); this.T = T; this.t = T; }
  reset() { this.pause(); this.t = 0; this.T = 0; }
}
