/* The Build board's editing state: the circuit (saved to the browser), the selection, undo/redo, and every edit:
   add, move (attached wire ends follow), rotate, delete, draw wires, change a setting.

   Two helpful rules keep circuits tidy:
   - dropping a part onto a wire inserts it: the piece of wire between its terminals is cut out;
   - when a moved part leaves a wire at an odd angle, the wire is redrawn as an L (exact 45° wires stay straight).
   Parts turn in 45° steps; wires run along the grid or at exactly 45°. */

import { KINDS, terminals, same, onSeg, key, type CircuitData, type Kind, type Part, type Wire, type Pt, type Rot, type Props } from './parts';

export const BW = 20, BH = 12; // board size in grid units (points run 0…BW, 0…BH)

export type Sel = { t: 'part' | 'wire'; id: string } | null;

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const clampPt = ([x, y]: Pt): Pt => [Math.max(0, Math.min(BW, x)), Math.max(0, Math.min(BH, y))];

/** Ids and names for a new part or wire, given what is already on the board. */
export function nextId(c: CircuitData, prefix: 'p' | 'w') {
  let m = 0;
  for (const x of [...c.parts, ...c.wires]) { const n = Number(x.id.slice(1)); if (x.id[0] === prefix && n > m) m = n; }
  return prefix + (m + 1);
}
export function nextName(c: CircuitData, kind: Kind) {
  const pre = KINDS[kind].prefix, used = new Set(c.parts.map((p) => p.name));
  let i = 1; while (used.has(pre + i)) i++;
  return pre + i;
}

/** Remove zero-length and duplicate wires. */
export function tidy(c: CircuitData) {
  const seen = new Set<string>();
  c.wires = c.wires.filter((w) => {
    if (same(w.a, w.b)) return false;
    const k = [key(w.a), key(w.b)].sort().join('|');
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

/** Cut the piece of any wire that runs straight between this part's first two terminals (it would short the part). */
export function cutUnder(c: CircuitData, p: Part) {
  const [t0, t1] = terminals(p);
  const out: Wire[] = [];
  for (const w of c.wires) {
    if (!(onSeg(t0, w.a, w.b) && onSeg(t1, w.a, w.b))) { out.push(w); continue; }
    const da = (t: Pt) => Math.hypot(t[0] - w.a[0], t[1] - w.a[1]);
    const [near, far] = da(t0) < da(t1) ? [t0, t1] : [t1, t0];
    if (!same(w.a, near)) out.push({ id: w.id, a: w.a, b: [...near] as Pt });
    if (!same(far, w.b)) out.push({ id: nextId({ parts: c.parts, wires: [...c.wires, ...out] }, 'w'), a: [...far] as Pt, b: w.b });
  }
  c.wires = out;
}

export function wirePath(a: Pt, b: Pt, first: 'h' | 'v'): Pt[] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (!dx || !dy || Math.abs(dx) === Math.abs(dy)) return [a, b];
  return [a, first === 'h' ? [b[0], a[1]] : [a[0], b[1]], b];
}

export class Editor {
  sel = $state<Sel>(null);
  canUndo = $state(false);
  canRedo = $state(false);
  private past: string[] = [];
  private future: string[] = [];
  private lastEdit = '';
  private drag: { id: string; x: number; y: number; ends: { w: Wire; end: 'a' | 'b'; fixed: Pt }[]; moved: boolean } | null = null;

  constructor(public c: CircuitData) {}

  get part() { const s = this.sel; return s?.t === 'part' ? this.c.parts.find((p) => p.id === s.id) ?? null : null; }
  get wire() { const s = this.sel; return s?.t === 'wire' ? this.c.wires.find((w) => w.id === s.id) ?? null : null; }

  /* ---------- history ---------- */
  private save(tag = '') {
    if (tag && tag === this.lastEdit) return; // one undo step for a run of edits to the same setting
    this.lastEdit = tag;
    this.past.push(JSON.stringify(this.c));
    if (this.past.length > 100) this.past.shift();
    this.future = [];
    this.canUndo = true; this.canRedo = false;
  }
  private restore(s: string) {
    const d = JSON.parse(s) as CircuitData;
    this.c.parts = d.parts; this.c.wires = d.wires;
    if (this.sel && !(this.sel.t === 'part' ? this.c.parts : this.c.wires).some((x) => x.id === this.sel!.id)) this.sel = null;
    this.lastEdit = '';
  }
  undo() {
    const s = this.past.pop(); if (!s) return;
    this.future.push(JSON.stringify(this.c)); this.restore(s);
    this.canUndo = this.past.length > 0; this.canRedo = true;
  }
  redo() {
    const s = this.future.pop(); if (!s) return;
    this.past.push(JSON.stringify(this.c)); this.restore(s);
    this.canRedo = this.future.length > 0; this.canUndo = true;
  }

  /* ---------- parts ---------- */
  /** A free spot near the middle of the board for a new part. */
  private spot(): Pt {
    const taken = (x: number, y: number) =>
      this.c.parts.some((p) => Math.abs(p.x - x) < 4 && Math.abs(p.y - y) < 2) ||
      this.c.wires.some((w) => onSeg([x - 1, y], w.a, w.b) || onSeg([x + 1, y], w.a, w.b) || onSeg([x, y], w.a, w.b));
    const cx = Math.round(BW / 2), cy = Math.round(BH / 2);
    const cands: Pt[] = [];
    for (let y = 2; y <= BH - 2; y++) for (let x = 2; x <= BW - 2; x++) cands.push([x, y]);
    cands.sort((a, b) => Math.hypot(a[0] - cx, (a[1] - cy) * 1.6) - Math.hypot(b[0] - cx, (b[1] - cy) * 1.6));
    return cands.find(([x, y]) => !taken(x, y)) ?? [cx, cy];
  }

  add(kind: Kind, at?: Pt) {
    this.save();
    const [x, y] = at ? clampPt(at) : this.spot();
    const p: Part = { id: nextId(this.c, 'p'), kind, name: nextName(this.c, kind), x, y, rot: 0, p: clone(KINDS[kind].defaults) };
    this.c.parts.push(p);
    cutUnder(this.c, p); tidy(this.c);
    this.sel = { t: 'part', id: p.id };
    return p.id;
  }

  beginDrag(id: string) {
    const p = this.c.parts.find((q) => q.id === id); if (!p) return;
    this.save();
    const ts = terminals(p), ends: { w: Wire; end: 'a' | 'b'; fixed: Pt }[] = [];
    // wire ends on this part's terminals follow it, unless another part's terminal holds them there too
    const others = new Set(this.c.parts.filter((q) => q.id !== id).flatMap((q) => terminals(q).map(key)));
    for (const w of this.c.wires) for (const end of ['a', 'b'] as const) {
      if (ts.some((t) => same(t, w[end])) && !others.has(key(w[end]))) ends.push({ w, end, fixed: [...w[end === 'a' ? 'b' : 'a']] as Pt });
    }
    this.drag = { id, x: p.x, y: p.y, ends, moved: false };
  }
  dragTo(x: number, y: number) {
    const d = this.drag; if (!d) return;
    const p = this.c.parts.find((q) => q.id === d.id); if (!p) return;
    [x, y] = clampPt([x, y]);
    const dx = x - p.x, dy = y - p.y; if (!dx && !dy) return;
    p.x = x; p.y = y; d.moved = true;
    for (const e of d.ends) { const w = this.c.wires.find((q) => q.id === e.w.id); if (w) w[e.end] = [w[e.end][0] + dx, w[e.end][1] + dy]; }
  }
  endDrag(): boolean {
    const d = this.drag; this.drag = null;
    if (!d) return false;
    if (!d.moved) { this.past.pop(); this.canUndo = this.past.length > 0; return false; }
    const p = this.c.parts.find((q) => q.id === d.id);
    if (p) {
      // straighten diagonal wires into an L whose last leg runs along the part
      const along = !p.diag && p.rot % 2 === 0;
      for (const e of d.ends) {
        const w = this.c.wires.find((q) => q.id === e.w.id); if (!w) continue;
        const m = w[e.end], f = e.fixed;
        if (m[0] === f[0] || m[1] === f[1] || Math.abs(m[0] - f[0]) === Math.abs(m[1] - f[1])) continue;
        const corner: Pt = along ? [f[0], m[1]] : [m[0], f[1]];
        w.a = [...f] as Pt; w.b = corner;
        this.c.wires.push({ id: nextId(this.c, 'w'), a: corner, b: [...m] as Pt });
      }
      cutUnder(this.c, p);
    }
    tidy(this.c);
    return true;
  }
  get dragging() { return this.drag !== null; }

  /** Turn a part 45° clockwise. */
  rotate(id = this.sel?.t === 'part' ? this.sel.id : '') {
    const p = this.c.parts.find((q) => q.id === id); if (!p) return;
    this.save();
    if (!p.diag) p.diag = true;
    else { p.diag = false; p.rot = ((p.rot + 1) % 4) as Rot; }
    cutUnder(this.c, p); tidy(this.c);
  }

  setProp<K extends keyof Props>(id: string, k: K, v: Props[K]) {
    const p = this.c.parts.find((q) => q.id === id); if (!p || p.p[k] === v) return;
    this.save(id + ':' + k);
    p.p[k] = v;
  }
  toggle(id: string) {
    const p = this.c.parts.find((q) => q.id === id); if (!p || (p.kind !== 'switch' && p.kind !== 'switch2')) return;
    this.save(); p.p.on = !p.p.on;
  }

  /* ---------- wires ---------- */
  /** Draw from a to b: straight if they line up (along the grid or at exactly 45°), otherwise an L that leaves a
      along the given axis. */
  addWire(a: Pt, b: Pt, first: 'h' | 'v') {
    a = clampPt(a); b = clampPt(b);
    if (same(a, b)) return;
    this.save();
    const pts = wirePath(a, b, first);
    for (let i = 1; i < pts.length; i++) this.c.wires.push({ id: nextId(this.c, 'w'), a: [...pts[i - 1]] as Pt, b: [...pts[i]] as Pt });
    tidy(this.c);
    this.sel = null;
  }

  /* ---------- selection ---------- */
  select(s: Sel) { this.sel = s; this.lastEdit = ''; }
  remove() {
    const s = this.sel; if (!s) return;
    this.save();
    if (s.t === 'part') this.c.parts = this.c.parts.filter((p) => p.id !== s.id);
    else this.c.wires = this.c.wires.filter((w) => w.id !== s.id);
    this.sel = null;
  }

  clear() { if (!this.c.parts.length && !this.c.wires.length) return; this.save(); this.c.parts = []; this.c.wires = []; this.sel = null; }
  load(d: CircuitData) { this.save(); this.c.parts = clone(d.parts); this.c.wires = clone(d.wires); this.sel = null; }
}
