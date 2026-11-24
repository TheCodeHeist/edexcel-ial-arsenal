/* The test tube on the white tile, drawn on a canvas: liquid colour easing between states, drops from a dropper with
   coloured plumes where they land, a precipitate that falls and settles, zinc granules that fizz, a shake.
   An imperative animation loop; the bench (bench.svelte.ts) drives it through the methods below. */

import { RM, hex2rgb, rgba } from '../../lib/util';
import { getMinFrameMs } from '../../lib/perf';
import { SP, liqOf, laOf, type Species, type Transition } from './data';

type RGB = [number, number, number];
interface Particle { dx: number; h: number; rh: number; v: number; r: number; a: number; rest: boolean; dis: boolean }
interface Drop { dx: number; y: number; v: number; col: string; plume: string | null; pa: number; done: () => void; dead?: boolean }
interface Plume { dx: number; y: number; r: number; a: number; col: string }
interface Bubble { dx: number; h: number; r: number; ph: number }
interface Zinc { dx: number; h: number; pts: [number, number][]; fall: number }

export class Tube {
  liq: RGB = [228, 238, 242]; liqT: RGB = [228, 238, 242]; la = 0.22; laT = 0.22;
  ppt: RGB = [255, 255, 255]; pptT: RGB = [255, 255, 255];
  level = 0.42; levelT = 0.42;
  parts: Particle[] = []; drops: Drop[] = []; plumes: Plume[] = []; bubbles: Bubble[] = []; zinc: Zinc[] = [];
  fizz = 0; shake = 0; dropper = 0; dropperT = 0; dropCol = '#e6f0f3'; ripple = 0;

  private ctx: CanvasRenderingContext2D;
  private G = { w: 0, h: 0, cx: 0, R: 44, top: 120, bot: 0, cy: 0, ri: 0, floor: 0, usable: 0 };
  private last = performance.now();
  private raf = 0;
  private dead = false;

  constructor(private cv: HTMLCanvasElement, private tile: HTMLElement) {
    this.ctx = cv.getContext('2d')!;
    this.resize();
    document.addEventListener('visibilitychange', this.onVis);
    this.kick();
  }
  private onVis = () => { if (!document.hidden) this.kick(); };
  private kick() {
    if (this.dead || this.raf || document.hidden) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }
  private loop = (now: number) => {
    this.raf = 0;
    if (this.dead || document.hidden) return;
    const minMs = getMinFrameMs();
    if (minMs > 0 && now - this.last < minMs) { this.raf = requestAnimationFrame(this.loop); return; }
    this.frame(now);
    this.raf = requestAnimationFrame(this.loop);
  };
  destroy() {
    this.dead = true;
    document.removeEventListener('visibilitychange', this.onVis);
    cancelAnimationFrame(this.raf);
  }

  resize() {
    const G = this.G, w = Math.min(this.tile.clientWidth - 2, 340);
    if (w <= 0) return;
    const h = Math.max(430, Math.min(500, this.tile.clientHeight || 470));
    const dpr = window.devicePixelRatio || 1;
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px'; this.cv.width = w * dpr; this.cv.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    G.w = w; G.h = h; G.cx = w / 2; G.R = 44; G.top = 120; G.bot = h - 46;
    G.cy = G.bot - G.R; G.ri = G.R - 3.5; G.floor = G.cy + G.ri; G.usable = G.floor - (G.top + 14);
  }

  private halfW(y: number) { const G = this.G; return y <= G.cy ? G.ri : Math.sqrt(Math.max(0, G.ri * G.ri - (y - G.cy) * (y - G.cy))); }
  private levelY() { return this.G.floor - this.level * this.G.usable; }
  private path(r: number) {
    const c = this.ctx, G = this.G;
    c.beginPath(); c.moveTo(G.cx - r, G.top); c.lineTo(G.cx - r, G.cy);
    c.arc(G.cx, G.cy, r, Math.PI, 0, true); c.lineTo(G.cx + r, G.top);
  }

  private spawnPPT(n: number, near: boolean) {
    const G = this.G, surf = this.level * G.usable, layer = 22;
    for (let i = 0; i < n; i++) {
      const h0 = near ? surf * (0.72 + Math.random() * 0.26) : surf * Math.random();
      const rh = 1.5 + Math.pow(Math.random(), 1.7) * layer;
      const hw = this.halfW(G.floor - rh) - 2.5;
      const p: Particle = { dx: (Math.random() * 2 - 1) * hw * 0.9, h: h0, rh, v: (0.35 + Math.random() * 0.55) * (G.usable / 320), r: 1.1 + Math.random() * 1.7, a: 0, rest: false, dis: false };
      if (RM) { p.h = rh; p.rest = true; p.a = 1; }
      this.parts.push(p);
    }
  }
  private settleAll() { this.parts.forEach((p) => { p.h = p.rh; p.rest = true; p.a = 1; }); }

  /** Jump straight to a species, no animation (fresh tube, undo). */
  instant(sp: string) {
    const S = SP[sp];
    this.liq = hex2rgb(liqOf(S)); this.liqT = [...this.liq]; this.la = this.laT = laOf(S);
    this.parts = []; this.plumes = []; this.drops = [];
    if (S.ppt) { this.ppt = hex2rgb(S.ppt); this.pptT = [...this.ppt]; this.spawnPPT(200, false); this.settleAll(); }
  }
  /** Reset to a fresh tube of a species at the starting level. */
  fresh(sp: string) { this.levelT = this.level = 0.42; this.zinc = []; this.bubbles = []; this.instant(sp); }

  private setTargets(S: Species, viaHex?: string) {
    this.liqT = hex2rgb(viaHex || liqOf(S)); this.laT = viaHex ? 0.74 : laOf(S);
    if (viaHex) setTimeout(() => { this.liqT = hex2rgb(liqOf(S)); this.laT = laOf(S); }, RM ? 50 : 1100);
    if (S.ppt) this.pptT = hex2rgb(S.ppt);
  }
  /** Animate one transition: a precipitate forms, changes colour or dissolves; the solution eases to its new colour. */
  apply(t: Transition) {
    const F = SP[t.f], S = SP[t.t];
    if (S.ppt && !F.ppt) { this.ppt = hex2rgb(S.ppt); this.pptT = [...this.ppt]; this.spawnPPT(200, true); }
    else if (S.ppt && F.ppt) this.pptT = hex2rgb(S.ppt);
    else if (!S.ppt && F.ppt) this.parts.forEach((p) => (p.dis = true));
    this.setTargets(S, t.via);
  }
  /** Tint the liquid without changing species (manganate(VII) that stays purple, dilution). */
  tint(hex: string | null, la: number) { if (hex) this.liqT = hex2rgb(hex); this.laT = la; }
  raise(by: number) { this.levelT = Math.min(0.82, this.levelT + by); }

  addZinc() {
    if (this.zinc.length) return;
    for (let i = 0; i < 4; i++) {
      const pts: [number, number][] = []; const rr = 5 + Math.random() * 3; const k = 7;
      for (let j = 0; j < k; j++) { const a = (j / k) * Math.PI * 2; const q = rr * (0.7 + Math.random() * 0.45); pts.push([Math.cos(a) * q, Math.sin(a) * q * 0.75]); }
      this.zinc.push({ dx: (i - 1.5) * 13 + (Math.random() * 4 - 2), h: 5 + Math.random() * 4, pts, fall: RM ? 0 : this.G.usable * this.level + 30 });
    }
  }
  clearZinc() { this.zinc = []; this.bubbles = []; }

  /** n drops from the dropper; resolves when the last one lands. */
  drip(n: number, col: string, plumeCol: string | null, plumeA: number): Promise<void> {
    this.dropCol = col; this.dropperT = 1;
    return new Promise((res) => {
      let left = n; if (!n) { res(); return; }
      for (let i = 0; i < n; i++) setTimeout(() => {
        this.drops.push({ dx: (Math.random() * 2 - 1) * 1.5, y: this.G.top + 18, v: 0, col, plume: plumeCol, pa: plumeA,
          done: () => { if (--left === 0) { setTimeout(() => (this.dropperT = 0), 250); res(); } } });
      }, RM ? 0 : i * 150);
    });
  }

  private frame(now: number) {
    const G = this.G; if (!G.w) { this.resize(); this.last = now; return; }
    const dt = Math.min(3, (now - this.last) / 16.67); this.last = now;
    const k = RM ? 1 : 1 - Math.pow(0.955, dt);
    for (let i = 0; i < 3; i++) { this.liq[i] += (this.liqT[i] - this.liq[i]) * k; this.ppt[i] += (this.pptT[i] - this.ppt[i]) * k * 0.8; }
    this.la += (this.laT - this.la) * k; this.level += (this.levelT - this.level) * (RM ? 1 : 0.06 * dt);
    this.dropper += (this.dropperT - this.dropper) * (RM ? 1 : 0.15 * dt);
    this.shake *= Math.pow(0.92, dt); this.ripple *= Math.pow(0.9, dt);
    const ly = this.levelY();
    for (const p of this.parts) {
      if (!p.rest) { p.h -= p.v * dt; p.dx += (Math.random() - 0.5) * 0.35 * dt; if (p.h <= p.rh) { p.h = p.rh; p.rest = true; } }
      const hw = this.halfW(G.floor - p.h) - p.r - 1; if (p.dx > hw) p.dx = hw; if (p.dx < -hw) p.dx = -hw;
      if (p.dis) p.a -= 0.018 * dt; else if (p.a < 1) p.a = Math.min(1, p.a + 0.06 * dt);
    }
    this.parts = this.parts.filter((p) => p.a > 0 || !p.dis);
    for (const d of this.drops) {
      d.v += 0.42 * dt; d.y += d.v * dt;
      if (d.y >= ly) { d.dead = true; this.ripple = 1; if (d.plume) this.plumes.push({ dx: d.dx, y: ly + 6, r: 3, a: d.pa, col: d.plume }); d.done(); }
    }
    this.drops = this.drops.filter((d) => !d.dead);
    for (const p of this.plumes) { p.r += 0.8 * dt; p.y += 0.35 * dt; p.a -= 0.012 * dt; }
    this.plumes = this.plumes.filter((p) => p.a > 0);
    for (const z of this.zinc) if (z.fall > 0) z.fall = Math.max(0, z.fall - 7 * dt);
    if (this.zinc.length && !RM) {
      const rate = this.fizz > 0 ? 0.55 : 0.08; this.fizz = Math.max(0, this.fizz - dt);
      if (Math.random() < rate * dt) { const z = this.zinc[Math.floor(Math.random() * this.zinc.length)]; if (!z.fall) this.bubbles.push({ dx: z.dx + (Math.random() * 6 - 3), h: z.h + 4, r: 1.2 + Math.random() * 2, ph: Math.random() * 6 }); }
    }
    for (const b of this.bubbles) { b.h += (1.1 + b.r * 0.35) * dt; b.ph += 0.15 * dt; }
    this.bubbles = this.bubbles.filter((b) => b.h < this.level * G.usable - 2);
    this.draw(ly);
  }

  private draw(ly: number) {
    const c = this.ctx, G = this.G; c.clearRect(0, 0, G.w, G.h);
    const sx = Math.sin(performance.now() / 38) * this.shake * 6;
    c.save(); c.translate(sx, 0);
    // shadow and glass body
    c.fillStyle = 'rgba(30,45,55,.10)'; c.beginPath(); c.ellipse(G.cx, G.bot + 16, G.R * 1.15, 6, 0, 0, Math.PI * 2); c.fill();
    this.path(G.R); c.closePath(); c.fillStyle = 'rgba(255,255,255,.35)'; c.fill();
    // liquid
    c.save(); this.path(G.ri); c.closePath(); c.clip();
    const [r, g, b] = this.liq.map(Math.round);
    const wob = Math.sin(performance.now() / 90) * this.ripple * 2.2;
    const gr = c.createLinearGradient(0, ly, 0, G.floor);
    gr.addColorStop(0, `rgba(${Math.round(r + (255 - r) * 0.18)},${Math.round(g + (255 - g) * 0.18)},${Math.round(b + (255 - b) * 0.18)},${this.la * 0.9})`);
    gr.addColorStop(1, `rgba(${r},${g},${b},${Math.min(1, this.la * 1.08)})`);
    c.fillStyle = gr; c.beginPath(); c.moveTo(G.cx - G.R, ly + wob); c.lineTo(G.cx + G.R, ly - wob); c.lineTo(G.cx + G.R, G.bot + 4); c.lineTo(G.cx - G.R, G.bot + 4); c.closePath(); c.fill();
    // plumes: local colour where drops land
    for (const p of this.plumes) {
      const rg = c.createRadialGradient(G.cx + p.dx, p.y, 0, G.cx + p.dx, p.y, p.r);
      rg.addColorStop(0, rgba(p.col, Math.max(0, p.a))); rg.addColorStop(1, rgba(p.col, 0));
      c.fillStyle = rg; c.fillRect(G.cx - G.R, ly, G.R * 2, G.floor - ly + 4);
    }
    // precipitate: suspended cloud + settled heap + grains
    const pc = this.ppt.map(Math.round).join(',');
    let susp = 0, heap = 0;
    for (const p of this.parts) { if (p.rest) heap += p.a; else susp += p.a; }
    if (susp > 0) { c.fillStyle = `rgba(${pc},${Math.min(0.62, susp / 240)})`; c.fillRect(G.cx - G.R, ly, G.R * 2, G.floor - ly + 4); }
    if (heap > 0) {
      const hh = Math.min(30, heap * 0.105), hy = G.floor - hh;
      const hg = c.createLinearGradient(0, hy - 6, 0, G.floor);
      hg.addColorStop(0, `rgba(${pc},0)`); hg.addColorStop(0.35, `rgba(${pc},.85)`); hg.addColorStop(1, `rgba(${pc},.97)`);
      c.fillStyle = hg; c.fillRect(G.cx - G.R, hy - 6, G.R * 2, hh + 10);
    }
    for (const p of this.parts) { c.fillStyle = `rgba(${pc},${p.a * 0.95})`; c.beginPath(); c.arc(G.cx + p.dx, G.floor - p.h, p.r, 0, Math.PI * 2); c.fill(); }
    // zinc and its bubbles
    for (const z of this.zinc) {
      const zx = G.cx + z.dx, zy = G.floor - z.h - z.fall;
      c.beginPath(); z.pts.forEach(([x, y], i) => (i ? c.lineTo(zx + x, zy + y) : c.moveTo(zx + x, zy + y))); c.closePath();
      c.fillStyle = '#9aa4a9'; c.fill(); c.strokeStyle = '#69757b'; c.lineWidth = 1; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.arc(zx - 2, zy - 2, 1.6, 0, Math.PI * 2); c.fill();
    }
    for (const bb of this.bubbles) {
      const bx = G.cx + bb.dx + Math.sin(bb.ph) * 1.5, by = G.floor - bb.h;
      c.beginPath(); c.arc(bx, by, bb.r, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.3)'; c.fill();
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 0.8; c.stroke();
    }
    c.restore();
    // meniscus
    c.save(); this.path(G.ri); c.closePath(); c.clip();
    c.fillStyle = `rgba(${Math.round(r * 0.8)},${Math.round(g * 0.8)},${Math.round(b * 0.8)},${Math.min(0.9, this.la * 0.9 + 0.08)})`;
    c.beginPath(); c.ellipse(G.cx, ly, G.ri, 3.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(G.cx, ly - 0.8, G.ri - 3, 2, 0, Math.PI, 0); c.fill();
    c.restore();
    // glass outline, highlights, rim, clamp band
    this.path(G.R); c.strokeStyle = 'rgba(40,58,68,.55)'; c.lineWidth = 1.6; c.stroke();
    this.path(G.ri); c.strokeStyle = 'rgba(40,58,68,.18)'; c.lineWidth = 1; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 3.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(G.cx - G.R + 8, G.top + 18); c.lineTo(G.cx - G.R + 8, G.cy + 4); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(G.cx + G.R - 7, G.top + 30); c.lineTo(G.cx + G.R - 7, G.cy - 30); c.stroke();
    c.strokeStyle = 'rgba(40,58,68,.55)'; c.lineWidth = 1.6;
    c.beginPath(); c.ellipse(G.cx, G.top, G.R + 2.5, 4.5, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(70,82,90,.55)'; c.fillRect(G.cx - G.R - 4, G.top + 40, G.R * 2 + 8, 7);
    c.restore();
    // dropper and drops
    if (this.dropper > 0.02) {
      c.save(); c.globalAlpha = this.dropper;
      const x = G.cx, tip = G.top + 18;
      c.fillStyle = '#2e3337'; c.beginPath(); c.roundRect(x - 10, G.top - 104, 20, 40, 9); c.fill();
      c.fillStyle = 'rgba(235,242,245,.85)'; c.strokeStyle = 'rgba(40,58,68,.6)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x - 5, G.top - 66); c.lineTo(x + 5, G.top - 66); c.lineTo(x + 2.2, tip); c.lineTo(x - 2.2, tip); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = rgba(this.dropCol, 0.85); c.beginPath(); c.moveTo(x - 3.6, G.top - 30); c.lineTo(x + 3.6, G.top - 30); c.lineTo(x + 1.6, tip - 1); c.lineTo(x - 1.6, tip - 1); c.closePath(); c.fill();
      c.restore();
    }
    for (const d of this.drops) {
      c.fillStyle = rgba(d.col, 0.95); c.strokeStyle = 'rgba(40,58,68,.45)'; c.lineWidth = 0.8;
      c.beginPath(); c.arc(G.cx + d.dx, d.y, 3, 0, Math.PI * 2); c.fill(); c.stroke();
    }
  }
}
