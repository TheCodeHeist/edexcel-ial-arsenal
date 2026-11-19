/* One transmutation circle: three slots over a rotating sigil, plus the bench conditions (temperature, catalyst,
   UV, dry). Drop in a compound and a reagent, two compounds, or two compounds and a catalyst reagent, set the
   conditions, and React: the slots fuse into the centre, the circle flashes, particles burst in the family colour
   and the products (and by-products) pop in with the equation. A plain compound + reagent pair reacts by itself, as
   before. No reaction: the slots shake, a grey puff rises and a toast explains why, or says which condition is
   missing. Items are 'c:<compound id>' or 'r:<reagent id>'. */

import { RM, sleep } from '../../lib/util';
import { FAM, BENCH0, CATALYST_RG, mix, type Bench, type Reaction } from './data';

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
  slots = $state<(Item | null)[]>([null, null, null]);
  bench = $state<Bench>({ ...BENCH0 });
  busy = $state(false);
  result = $state<{ r: Reaction; extra: Extra; anim: boolean; spect: Item[] } | null>(null);
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
  get needs(): 'c' | 'r' | null { return this.showing || this.busy ? null : !this.slots.some((s) => s?.[0] === 'c') ? 'c' : this.count < 2 ? 'r' : null; }
  get count() { return this.slots.filter(Boolean).length; }
  /** two or more things in the flask and nothing running: the React button is live */
  get ready() { return !this.busy && !this.showing && this.count >= 2; }
  has(item: Item) { return !this.showing && this.slots.includes(item); }

  private hideResult() { this.result = null; this.fuse = false; this.fc = null; }
  clear() { if (this.busy) return; this.hideResult(); this.slots = [null, null, null]; this.toast = null; }
  resetBench() { this.bench = { ...BENCH0 }; }
  remove(i: number) { if (!this.busy) this.slots[i] = null; }

  add(item: Item, idx?: number) {
    if (this.busy) return;
    if (this.cfg.allow && !this.cfg.allow(item)) return;
    if (this.showing) { this.hideResult(); this.slots = [null, null, null]; }
    const s = this.slots;
    if (s.includes(item)) return;
    if (idx === undefined) {
      // compounds fill from the left, reagents from the second slot; when full, the last slot of that kind is swapped
      const order = item[0] === 'r' ? [1, 2, 0] : [0, 1, 2];
      idx = order.find((k) => !s[k]) ?? (item[0] === 'r' ? 2 : 0);
    }
    this.slots[idx] = item; this.pop = { i: idx, n: (this.pop?.n ?? 0) + 1 }; this.toast = null;
    clearTimeout(this.reactTimer);
    // one compound + one ordinary reagent reacts straight away; anything else waits for React (conditions, a catalyst…)
    const f = this.slots.filter(Boolean) as Item[];
    if (f.length === 2 && f.some((x) => x[0] === 'c') && f.some((x) => x[0] === 'r' && !CATALYST_RG[x.slice(2)]))
      this.reactTimer = setTimeout(() => this.react(), RM ? 60 : 420);
  }

  /** react the product further: put it back in the first slot */
  further(p = this.result?.r.p[0]) { if (!this.result || !p) return; this.hideResult(); this.slots = [null, null, null]; this.add('c:' + p, 0); }

  private say(title: string, html: string) {
    this.toast = { title, html };
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => (this.toast = null), html.length > 160 ? 11000 : 6500);
  }

  async react() {
    const items = this.slots.filter(Boolean) as Item[];
    if (this.busy || this.showing || items.length < 2) return;
    clearTimeout(this.reactTimer);
    this.toast = null;
    this.busy = true;
    const v = this.vessel;
    if (v) {
      const vr = v.getBoundingClientRect();
      if (vr.top < 0 || vr.bottom > innerHeight) { v.scrollIntoView({ block: vr.height > innerHeight ? 'start' : 'center', behavior: RM ? 'auto' : 'smooth' }); await sleep(380); }
    }
    const m = mix(items, this.bench);
    this.fc = m.ok ? FAM[m.r.fam][1] : 'var(--muted)';
    this.charging = true;
    if (!m.ok) {
      this.fizz = true; this.burst(cssColor('var(--muted)'), 26, true);
      await sleep(520); this.fizz = false; this.charging = false;
      this.say(m.title, m.html);
      this.busy = false; return;
    }
    const r = m.r;
    await sleep(480);
    this.fuse = true;
    await sleep(560);
    this.flash++;
    this.burst(cssColor(FAM[r.fam][1]), 90);
    const extra = this.cfg.onResult?.(r) || {};
    this.result = { r, extra, anim: true, spect: m.spect };
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
