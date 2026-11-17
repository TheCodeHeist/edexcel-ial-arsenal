/* One transmutation circle: two slots over a rotating sigil. Drop a compound and a reagent (or two compounds) in and
   they react: the slots fuse into the centre, the circle flashes, particles burst in the family colour and the
   product pops in with its equation. No reaction: the slots shake, a grey puff rises and a toast explains why.
   Items are 'c:<compound id>' or 'r:<reagent id>'. */

import { RM, sleep } from '../../lib/util';
import { FAM, findRx, whyNot, type Reaction } from './data';

export type Item = string;
export interface Win { stars: number; msg: string }
export interface Extra { isNew?: boolean; win?: Win }
export interface CircleConfig {
  title: string; sub: string; cap: string;
  allow?: (item: Item) => boolean;
  onResult?: (r: Reaction) => Extra | void;
  onNext?: () => void;
}

/** a computed colour for a CSS colour expression like 'var(--redox)' (the canvas can't read variables) */
function cssColor(v: string) {
  const m = /var\((--[\w-]+)/.exec(v);
  return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#888' : v;
}

export class Circle {
  slots = $state<(Item | null)[]>([null, null]);
  busy = $state(false);
  result = $state<{ r: Reaction; extra: Extra; anim: boolean } | null>(null);
  toast = $state<{ title: string; html: string } | null>(null);
  charging = $state(false);
  fuse = $state(false);
  fizz = $state(false);
  flash = $state(0);          // bumps to replay the flash
  pop = $state<{ i: number; n: number } | null>(null);
  fc = $state<string | null>(null);

  vessel: HTMLElement | null = null;
  fx: HTMLCanvasElement | null = null;
  private raf = 0;
  private reactTimer: ReturnType<typeof setTimeout> | undefined;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(public cfg: CircleConfig) {}

  get showing() { return !!this.result; }
  /** the drawer pulses the pane holding what the circle needs next */
  get needs(): 'c' | 'r' | null { return this.showing || this.busy ? null : !this.slots[0] ? 'c' : !this.slots[1] ? 'r' : null; }
  has(item: Item) { return !this.showing && this.slots.includes(item); }

  private hideResult() { this.result = null; this.fuse = false; this.fc = null; }
  clear() { if (this.busy) return; this.hideResult(); this.slots = [null, null]; this.toast = null; }
  remove(i: number) { if (!this.busy) this.slots[i] = null; }

  add(item: Item, idx?: number) {
    if (this.busy) return;
    if (this.cfg.allow && !this.cfg.allow(item)) return;
    if (this.showing) { this.hideResult(); this.slots = [null, null]; }
    const s = this.slots;
    if (idx === undefined) {
      if (item[0] === 'r') idx = !s[1] ? 1 : !s[0] ? 0 : 1;
      else idx = !s[0] ? 0 : !s[1] ? 1 : 0;
      if (item[0] === 'r' && s[1] && s[1][0] === 'c' && !s[0]) idx = 0;
    }
    this.slots[idx] = item; this.pop = { i: idx, n: (this.pop?.n ?? 0) + 1 }; this.toast = null;
    if (this.slots[0] && this.slots[1]) { clearTimeout(this.reactTimer); this.reactTimer = setTimeout(() => this.react(), RM ? 60 : 420); }
  }

  /** react the product further: put it back in the first slot */
  further() { if (!this.result) return; const p = this.result.r.p[0]; this.hideResult(); this.slots = [null, null]; this.add('c:' + p, 0); }

  private say(title: string, html: string) {
    this.toast = { title, html };
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => (this.toast = null), 6500);
  }

  async react() {
    const [s0, s1] = this.slots;
    if (this.busy || !s0 || !s1) return;
    this.busy = true;
    const v = this.vessel;
    if (v) {
      const vr = v.getBoundingClientRect();
      if (vr.top < 0 || vr.bottom > innerHeight) { v.scrollIntoView({ block: vr.height > innerHeight ? 'start' : 'center', behavior: RM ? 'auto' : 'smooth' }); await sleep(380); }
    }
    const [k0, i0] = s0.split(':') as ['c' | 'r', string], [k1, i1] = s1.split(':') as ['c' | 'r', string];
    let r: Reaction | null = null, msg = '';
    if (k0 === 'r' && k1 === 'r') msg = 'Two reagents and nothing for them to work on — add a compound.';
    else { r = findRx(i0, i1); if (!r) msg = whyNot(i0, k0, i1, k1); }
    this.fc = r ? FAM[r.fam][1] : 'var(--muted)';
    this.charging = true;
    if (!r) {
      this.fizz = true; this.burst(cssColor('var(--muted)'), 26, true);
      await sleep(520); this.fizz = false; this.charging = false;
      this.say('No reaction', msg);
      this.busy = false; return;
    }
    await sleep(480);
    this.fuse = true;
    await sleep(560);
    this.flash++;
    this.burst(cssColor(FAM[r.fam][1]), 90);
    const extra = this.cfg.onResult?.(r) || {};
    this.result = { r, extra, anim: true };
    this.fuse = false;
    setTimeout(() => (this.charging = false), 500);
    this.busy = false;
  }

  /** particles from the centre of the circle (a grey puff when nothing happens) */
  private burst(color: string, n = 70, puff = false) {
    const cv = this.fx, v = this.vessel;
    if (RM || !cv || !v) return;
    const r = v.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    const ctx = cv.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = r.width / 2, cy = Math.min(r.height / 2, 230);
    const parts = Array.from({ length: n }, () => {
      const a = Math.random() * Math.PI * 2, sp = puff ? 0.4 + Math.random() * 1.4 : 1.5 + Math.random() * 6.5;
      return { x: cx + Math.cos(a) * (puff ? 30 : 6), y: cy + Math.sin(a) * (puff ? 18 : 6), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (puff ? 0.6 : 0),
        life: 0, max: 40 + Math.random() * 50, s: puff ? 5 + Math.random() * 9 : 1.2 + Math.random() * 3.4, w: Math.random() < 0.25 };
    });
    cancelAnimationFrame(this.raf);
    const step = () => {
      ctx.clearRect(0, 0, r.width, r.height);
      let alive = 0;
      for (const p of parts) {
        if (p.life > p.max) continue; alive++;
        p.life++; p.x += p.vx; p.y += p.vy; p.vx *= 0.955; p.vy = p.vy * 0.955 + (puff ? -0.02 : 0.03);
        const t = 1 - p.life / p.max;
        ctx.globalAlpha = puff ? t * 0.35 : t;
        ctx.fillStyle = p.w && !puff ? '#ffffff' : color;
        ctx.beginPath(); ctx.arc(p.x, p.y, puff ? p.s * (1.6 - t * 0.6) : p.s * (0.5 + t * 0.5), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (alive) this.raf = requestAnimationFrame(step); else ctx.clearRect(0, 0, r.width, r.height);
    };
    this.raf = requestAnimationFrame(step);
  }
}
