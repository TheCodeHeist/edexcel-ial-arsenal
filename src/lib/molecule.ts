/* Molecule engine: SMILES → 2D layout → inline SVG, from the Carbon Alchemy design (design book §9).
   Three styles: skeletal, displayed (every atom, right-angle grid) and structural (text, handled by the caller).
   Heteroatoms get colour classes (.e-O, .e-N, .e-X, .e-Mg, .e-Na) styled in sim.css; with hl:true the
   functional-group atoms glow in --hc. Extended SMILES: '*' marks a polymer end; '{NO2|O2N}' is a drawn group label
   (left|right reading). Results are cached. Pure string output: safe on the server. */

export type MolFormat = 'skeletal' | 'displayed';
interface Atom { el: string; h: number; ch: number; ar?: boolean; br?: boolean; lab?: string; labR?: string; comp: number }
interface Bond { a: number; b: number; o: number; ar: boolean; close?: boolean }
interface GAtom { el: string; x: number; y: number; h: number; ch: number; ar?: boolean; lab?: string; labR?: string; ring: number; isH?: boolean; show?: boolean; hdir?: 'r' | 'l' | 'u' | 'd'; rev?: boolean }

const VAL: Record<string, number> = { C: 4, N: 3, O: 2, F: 1, Cl: 1, Br: 1, I: 1, S: 2, P: 3 };
const D2R = Math.PI / 180;
function parseSmiles(s: string) {
  const atoms: Atom[] = [], bonds: Bond[] = [], ringOpen: Record<string, { at: number; o: number }> = {}, stack: number[] = [];
  let prev = -1, bo = 1, comp = 0, i = 0;
  const add = (a: Omit<Atom, 'comp' | 'h'> & { h?: number }) => {
    atoms.push({ h: 0, ...a, comp }); const idx = atoms.length - 1;
    if (prev >= 0) bonds.push({ a: prev, b: idx, o: bo, ar: !!(atoms[prev].ar && a.ar && bo === 1) });
    bo = 1; prev = idx;
  };
  while (i < s.length) {
    const c = s[i];
    if (c === '(') { stack.push(prev); i++; continue; }
    if (c === ')') { prev = stack.pop()!; i++; continue; }
    if (c === '=') { bo = 2; i++; continue; }
    if (c === '#') { bo = 3; i++; continue; }
    if (c === '.') { prev = -1; comp++; i++; continue; }
    if (c >= '0' && c <= '9') {
      if (ringOpen[c]) { const r = ringOpen[c], o = bo > 1 ? bo : r.o; bonds.push({ a: r.at, b: prev, o, ar: !!(atoms[prev].ar && atoms[r.at].ar && o === 1), close: true }); delete ringOpen[c]; }
      else ringOpen[c] = { at: prev, o: bo };
      bo = 1; i++; continue;
    }
    if (c === '[') {
      const j = s.indexOf(']', i), t = s.slice(i + 1, j); i = j + 1;
      const m = t.match(/^([A-Z][a-z]?)(H(\d?))?([+-])?$/)!;
      add({ el: m[1], h: m[2] ? (m[3] ? +m[3] : 1) : 0, ch: m[4] === '+' ? 1 : m[4] === '-' ? -1 : 0, br: true }); continue;
    }
    if (c === '{') { const j = s.indexOf('}', i), t = s.slice(i + 1, j).split('|'); i = j + 1; add({ el: 'G', lab: t[0], labR: t[1] || t[0], h: 0, ch: 0, br: true }); continue; }
    if (c === '*') { i++; add({ el: '*', h: 0, ch: 0, br: true }); continue; }
    const two = s.slice(i, i + 2);
    if (two === 'Cl' || two === 'Br') { i += 2; add({ el: two, ch: 0 }); continue; }
    if ('cno'.includes(c)) { i++; add({ el: c.toUpperCase(), ar: true, ch: 0 }); continue; }
    i++; add({ el: c, ch: 0 });
  }
  const adj: { j: number; k: number }[][] = atoms.map(() => []);
  bonds.forEach((b, k) => { adj[b.a].push({ j: b.b, k }); adj[b.b].push({ j: b.a, k }); });
  atoms.forEach((a, n) => {
    if (a.br) return;
    const sum = adj[n].reduce((t, x) => t + (bonds[x.k].ar ? 1.5 : bonds[x.k].o), 0);
    a.h = Math.max(0, Math.round((VAL[a.el] || 0) - sum));
  });
  return { atoms, bonds, adj };
}

function hPlaces(angs: number[], k: number): number[] {
  if (!angs.length) return [0, 90, 180, 270].slice(0, k);
  const gaps = angs.map((a, i) => ({ s: a, g: (i + 1 < angs.length ? angs[i + 1] : angs[0] + 360) - a, c: 0 }));
  for (let t = 0; t < k; t++) { let best = gaps[0]; for (const g of gaps) if (g.g / (g.c + 1) > best.g / (best.c + 1) + 1e-6) best = g; best.c++; }
  const out: number[] = []; gaps.forEach(g => { for (let j = 1; j <= g.c; j++) out.push(g.s + g.g * j / (g.c + 1)); });
  return out;
}

function molGeom(smi: string, mode: MolFormat) {
  const { atoms, bonds, adj } = parseSmiles(smi);
  const N = atoms.length;
  const poly = atoms.some(a => a.el === '*'), straight = poly || mode === 'displayed';
  const RS = mode === 'displayed' ? 1.4 : 1;
  const dir = (a: number): [number, number] => [Math.cos(a * D2R), Math.sin(a * D2R)];
  // rings
  const rings: number[][] = [], ringOf: number[] = new Array(N).fill(-1), ringC: [number, number, number][] = [];
  bonds.forEach(b => {
    if (!b.close) return;
    const prev: number[] = new Array(N).fill(-1); prev[b.a] = b.a; const q = [b.a];
    while (q.length) { const x = q.shift()!; if (x === b.b) break; for (const { j, k } of adj[x]) { if (bonds[k].close) continue; if (prev[j] < 0) { prev[j] = x; q.push(j); } } }
    const path: number[] = []; let x = b.b; while (x !== b.a) { path.push(x); x = prev[x]; } path.push(b.a); path.reverse();
    rings.push(path); path.forEach(i => { if (ringOf[i] < 0) ringOf[i] = rings.length - 1; });
  });
  const pos: [number, number][] = new Array(N), done = new Set<number>();
  function place(i: number, x: number, y: number, h: number, s: number) {
    pos[i] = [x, y];
    const r = ringOf[i];
    if (r >= 0 && !done.has(r)) { placeRing(r, i, h); return; }
    branch(i, h, s);
  }
  function branch(i: number, h: number, s: number) {
    const kids = adj[i].filter(n => !pos[n.j]); const n = kids.length;
    if (!n) return;
    const lin = adj[i].some(x => bonds[x.k].o === 3);
    let hs: number[], ss: number[];
    if (lin) { hs = kids.map(() => h); ss = kids.map(() => s); }
    else if (straight) { hs = n === 1 ? [h] : n === 2 ? [h + (poly ? -90 : 90), h] : [h + 90, h - 90, h]; ss = kids.map(() => s); }
    else if (n === 1) { hs = [h + 60 * s]; ss = [-s]; }
    else if (n === 2) { hs = [h - 60 * s, h + 60 * s]; ss = [s, -s]; }
    else { hs = [h + 90, h - 90, h]; ss = [s, -s, -s]; }
    kids.forEach((c, x) => { const f = straight && !lin && x < n - 1 ? 1.25 : 1; const [dx, dy] = dir(hs[x]); place(c.j, pos[i][0] + dx * f, pos[i][1] + dy * f, hs[x], ss[x]); });
  }
  function placeRing(r: number, e: number, h: number) {
    done.add(r);
    const ring = rings[r], n = ring.length, R = (ring.every(i => atoms[i].ar) ? Math.min(RS, 1.15) : RS) / (2 * Math.sin(Math.PI / n));
    const k0 = ring.indexOf(e), ord = ring.slice(k0).concat(ring.slice(0, k0));
    const [dx, dy] = dir(h), cx = pos[e][0] + dx * R, cy = pos[e][1] + dy * R, a0 = h + 180;
    ord.forEach((at, k) => { if (k) { const [ux, uy] = dir(a0 + k * 360 / n); pos[at] = [cx + ux * R, cy + uy * R]; } });
    ringC[r] = [cx, cy, R];
    ord.forEach(at => {
      const out = Math.atan2(pos[at][1] - cy, pos[at][0] - cx) / D2R;
      const kids = adj[at].filter(x => !pos[x.j]);
      kids.forEach((c, x) => { const hh = kids.length === 1 ? out : out + (x ? 35 : -35); const [ux, uy] = dir(hh); place(c.j, pos[at][0] + ux, pos[at][1] + uy, hh, -1); });
    });
  }
  // components laid out left → right
  let cursor = 0;
  const comps = [...new Set(atoms.map(a => a.comp))];
  comps.forEach(cp => {
    const root = atoms.findIndex(a => a.comp === cp);
    const tri = adj[root].some(x => bonds[x.k].o === 3);
    place(root, 0, 0, straight || tri ? 0 : -30, 1);
    const ids = atoms.map((a, i) => i).filter(i => atoms[i].comp === cp);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    ids.forEach(i => { x0 = Math.min(x0, pos[i][0]); x1 = Math.max(x1, pos[i][0]); y0 = Math.min(y0, pos[i][1]); y1 = Math.max(y1, pos[i][1]); });
    const sx = cursor - x0, sy = -(y0 + y1) / 2;
    ids.forEach(i => { pos[i][0] += sx; pos[i][1] += sy; });
    rings.forEach((rg, r) => { if (atoms[rg[0]].comp === cp && ringC[r]) { ringC[r][0] += sx; ringC[r][1] += sy; } });
    const ra = ids.reduce((m, i) => pos[i][0] > pos[m][0] ? i : m, ids[0]);
    const lab = atoms[ra].el !== 'C' && (atoms[ra].h > 0 || atoms[ra].ch) ? .75 : 0;
    cursor += (x1 - x0) + 1.15 + lab;
  });
  const A: GAtom[] = atoms.map((a, i) => ({ el: a.el, x: pos[i][0], y: pos[i][1], h: a.h, ch: a.ch, ar: a.ar, lab: a.lab, labR: a.labR, ring: ringOf[i] }));
  const B: { a: number; b: number; o: number; ar?: boolean }[] = bonds.map(b => ({ a: b.a, b: b.b, o: b.o, ar: b.ar }));
  const nb = (i: number) => B.filter(b => b.a === i || b.b === i).map(b => (b.a === i ? b.b : b.a));
  if (mode === 'displayed') {
    const n0 = A.length;
    for (let i = 0; i < n0; i++) {
      const a = A[i]; if (a.ar || !a.h || a.el === '*') continue;
      const angs = nb(i).map(j => Math.atan2(A[j].y - a.y, A[j].x - a.x) / D2R).sort((p, q) => p - q);
      hPlaces(angs, a.h).forEach(an => { const [ux, uy] = dir(an); A.push({ el: 'H', x: a.x + ux * .78, y: a.y + uy * .78, h: 0, ch: 0, isH: true, ring: -1 }); B.push({ a: i, b: A.length - 1, o: 1 }); });
      a.h = 0;
    }
  }
  A.forEach((a, i) => {
    const deg = nb(i).length;
    if (a.el === '*') a.show = false;
    else if (mode === 'displayed') a.show = !a.ar;
    else a.show = a.el !== 'C' || a.ch !== 0 || deg === 0;
    // which way the label's H (or group) should read
    const angs = nb(i).map(j => Math.atan2(A[j].y - a.y, A[j].x - a.x) / D2R);
    const score = (d: number) => Math.min(360, ...angs.map(t => { const v = Math.abs(((t - d) % 360 + 540) % 360 - 180); return v; }));
    const opts: [number, 'r' | 'l' | 'u' | 'd', number][] = [[0, 'r', 95], [180, 'l', 90], [90, 'u', 0], [270, 'd', 0]];
    let best: 'r' | 'l' | 'u' | 'd' = 'r', bv = -1; opts.forEach(([d, k, bias]) => { const v = (angs.length ? score(d) : 180) + bias; if (v > bv) { bv = v; best = k; } });
    a.hdir = best;
    a.rev = angs.length > 0 && angs.every(t => Math.cos(t * D2R) > 0.2);
  });
  const hl = A.map((a, i) => a.show !== false && !a.isH && a.el !== 'C' && a.el !== '*' && a.el !== 'H' && a.el !== 'Na' || (a.el === 'C' && !a.ar && B.some(b => (b.a === i || b.b === i) && b.o > 1)));
  return { A, B, rings, ringC, hl, straight: poly };
}

let MOL_UID = 0;
const MOL_CACHE = new Map<string, { svg: string; w: number; h: number }>();
function subSpans(str: string, fs: number) {
  // digits → subscripts, keeping the baseline steady
  let out = '', down = false;
  for (const ch of str) {
    if (/\d/.test(ch)) { if (!down) { out += `<tspan dy="${fs * .3}" font-size="${fs * .72}">`; down = true; } out += ch; }
    else { if (down) { out += `</tspan><tspan dy="${-fs * .3}">`; down = false; out += ch + '</tspan>'; } else out += ch; }
  }
  if (down) out += '</tspan>';
  return out;
}
const ELC = (el: string) => el === 'O' ? 'e-O' : (el === 'N' || el === 'G') ? 'e-N' : (el === 'Cl' || el === 'Br' || el === 'I') ? 'e-X' : el === 'Mg' ? 'e-Mg' : el === 'Na' ? 'e-Na' : '';

export function molSVG(smi: string, mode: MolFormat = 'skeletal', o: { hl?: boolean; scale?: number } = {}) {
  const key = smi + '|' + mode + '|' + (o.hl ? 1 : 0) + '|' + (o.scale || 1);
  const hit = MOL_CACHE.get(key); if (hit) return hit;
  const g = molGeom(smi, mode);
  const S = (mode === 'displayed' ? 31 : 29) * (o.scale || 1), fs = 13.5 * (o.scale || 1), cw = fs * .66;
  const P = (a: GAtom): [number, number] => [a.x * S, -a.y * S];
  let lines = '', labels = '', extra = '', glow = '';
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const grow = (x: number, y: number, rx = 0, ry = 0) => { x0 = Math.min(x0, x - rx); x1 = Math.max(x1, x + rx); y0 = Math.min(y0, y - ry); y1 = Math.max(y1, y + ry); };
  const cutOf = (a: GAtom) => !a.show ? 0 : a.isH ? fs * .42 : (a.el === 'G' ? fs * .5 : (a.el.length > 1 ? fs * .62 : fs * .5));
  const L = (ax: number, ay: number, bx: number, by: number, cls = '') => `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}"${cls ? ` class="${cls}"` : ''}/>`;
  const ringSet = g.rings.map(r => new Set(r));
  const uid = 'mg' + (++MOL_UID);
  g.B.forEach(b => {
    const A1 = g.A[b.a], A2 = g.A[b.b];
    const [ax, ay] = P(A1), [bx, by] = P(A2);
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const c1 = cutOf(A1), c2 = cutOf(A2);
    const sx = ax + ux * c1, sy = ay + uy * c1, ex = bx - ux * c2, ey = by - uy * c2;
    const nx = -uy, ny = ux;
    if (A2.el === '*' || A1.el === '*') {
      // polymer: bond runs through a bracket
      lines += L(sx, sy, ex, ey);
      const real = A1.el === '*' ? [bx, by] : [ax, ay], dum = A1.el === '*' ? [ax, ay] : [bx, by];
      const mx = real[0] + (dum[0] - real[0]) * .55, my = real[1] + (dum[1] - real[1]) * .55;
      const tx = (real[0] - dum[0]) / len, ty = (real[1] - dum[1]) / len, h = S * .62;
      extra += `<path class="brk" d="M${(mx + nx * h + tx * 5).toFixed(1)} ${(my + ny * h + ty * 5).toFixed(1)} L${(mx + nx * h).toFixed(1)} ${(my + ny * h).toFixed(1)} L${(mx - nx * h).toFixed(1)} ${(my - ny * h).toFixed(1)} L${(mx - nx * h + tx * 5).toFixed(1)} ${(my - ny * h + ty * 5).toFixed(1)}"/>`;
      grow(mx, my, h, h);
      if (dum[0] > real[0]) { extra += `<text class="pn" x="${(mx + 4).toFixed(1)}" y="${(my + h + fs * .55).toFixed(1)}" font-size="${fs * .85}">n</text>`; grow(mx + 12, my + h + fs); }
      return;
    }
    const inRing = g.rings.findIndex((r, ri) => ringSet[ri].has(b.a) && ringSet[ri].has(b.b));
    if (b.o === 1 || b.ar) lines += L(sx, sy, ex, ey);
    else if (b.o === 2) {
      if (inRing >= 0 && !A1.show && !A2.show) {
        const [cx, cy] = g.ringC[inRing]; const CX = cx * S, CY = -cy * S;
        const mx = (sx + ex) / 2, my = (sy + ey) / 2; const sgn = ((CX - mx) * nx + (CY - my) * ny) > 0 ? 1 : -1;
        const o = 4.6 * sgn, sh = len * .14;
        lines += L(sx, sy, ex, ey) + L(sx + nx * o + ux * sh, sy + ny * o + uy * sh, ex + nx * o - ux * sh, ey + ny * o - uy * sh);
      } else {
        const o = 2.5; lines += L(sx + nx * o, sy + ny * o, ex + nx * o, ey + ny * o) + L(sx - nx * o, sy - ny * o, ex - nx * o, ey - ny * o);
      }
    } else if (b.o === 3) {
      const o = 3.4; lines += L(sx, sy, ex, ey) + L(sx + nx * o, sy + ny * o, ex + nx * o, ey + ny * o) + L(sx - nx * o, sy - ny * o, ex - nx * o, ey - ny * o);
    }
  });
  g.rings.forEach((r, ri) => {
    if (!r.every(i => g.A[i].ar)) return;
    const [cx, cy, R] = g.ringC[ri];
    extra += `<circle class="arc" cx="${(cx * S).toFixed(1)}" cy="${(-cy * S).toFixed(1)}" r="${(R * S * .6).toFixed(1)}"/>`;
  });
  g.A.forEach((a, i) => {
    const [X, Y] = P(a);
    grow(X, Y, 2, 2);
    if (o.hl && g.hl[i]) glow += `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="${(S * .72).toFixed(1)}" fill="url(#${uid})"/>`;
    if (!a.show) return;
    const cls = ELC(a.el), f = a.isH ? fs * .92 : fs;
    let w: number;
    if (a.el === 'G') {
      const t = (a.rev ? a.labR : a.lab)!; w = t.replace(/\d/g, '').length * cw + (t.match(/\d/g) || []).length * cw * .7;
      const tx = a.rev ? X + cw / 2 : X - cw / 2;
      labels += `<text class="${cls}" x="${tx.toFixed(1)}" y="${Y.toFixed(1)}" text-anchor="${a.rev ? 'end' : 'start'}">${subSpans(t, f)}</text>`;
      grow(a.rev ? X - w : X + w, Y, cw, f * .7); grow(X, Y, cw, f * .7);
      return;
    }
    const t = a.el; w = t.length * cw * (a.isH ? .92 : 1);
    labels += `<text class="${cls}${a.isH ? ' hh' : ''}" x="${X.toFixed(1)}" y="${Y.toFixed(1)}" text-anchor="middle" font-size="${f}">${t}</text>`;
    grow(X, Y, w / 2 + 1, f * .62);
    let hw = 0;
    if (a.h > 0) {
      const hs = `H${a.h > 1 ? `<tspan dy="${fs * .3}" font-size="${fs * .72}">${a.h}</tspan>` : ''}`;
      hw = cw + (a.h > 1 ? cw * .7 : 0);
      if (a.hdir === 'r') { labels += `<text class="${cls}" x="${(X + w / 2).toFixed(1)}" y="${Y.toFixed(1)}" text-anchor="start">${hs}</text>`; grow(X + w / 2 + hw, Y, 1, fs * .7); }
      else if (a.hdir === 'l') { labels += `<text class="${cls}" x="${(X - w / 2 - hw).toFixed(1)}" y="${Y.toFixed(1)}" text-anchor="start">${hs}</text>`; grow(X - w / 2 - hw, Y, 1, fs * .7); }
      else { const yy = a.hdir === 'u' ? Y - fs * 1.05 : Y + fs * 1.05; labels += `<text class="${cls}" x="${(X - cw / 2).toFixed(1)}" y="${yy.toFixed(1)}" text-anchor="start">${hs}</text>`; grow(X, yy, hw, fs * .7); }
    }
    if (a.ch) {
      const cx = X + w / 2 + (a.hdir === 'r' ? hw : 0) + 1.5, cy = Y - fs * .5;
      labels += `<text class="${cls} chg" x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-size="${fs * .8}">${a.ch > 0 ? '+' : '−'}</text>`;
      grow(cx + cw, cy, 1, fs * .5);
    }
  });
  const pad = 6 * (o.scale || 1);
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const W = x1 - x0, H = y1 - y0;
  const defs = o.hl ? `<defs><radialGradient id="${uid}"><stop offset="0" style="stop-color:var(--hc,var(--accent));stop-opacity:.55"/><stop offset=".55" style="stop-color:var(--hc,var(--accent));stop-opacity:.22"/><stop offset="1" style="stop-color:var(--hc,var(--accent));stop-opacity:0"/></radialGradient></defs>` : '';
  const svg = `<svg class="molsvg" viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${W.toFixed(1)} ${H.toFixed(1)}" width="${W.toFixed(0)}" height="${H.toFixed(0)}" role="img">${defs}<g class="glow">${glow}</g><g class="bd">${lines}${extra}</g><g class="lb" font-size="${fs}">${labels}</g></svg>`;
  const res = { svg, w: W, h: H };
  MOL_CACHE.set(key, res);
  return res;
}

export function molFormula(smi: string): string {
  const { atoms } = parseSmiles(smi);
  const comps: Record<number, { n: Record<string, number>; ch: number }> = {};
  atoms.forEach(a => {
    if (a.el === '*') return;
    const c = comps[a.comp] || (comps[a.comp] = { n: {}, ch: 0 });
    if (a.el === 'G') { c.n.N = (c.n.N || 0) + 1; c.n.O = (c.n.O || 0) + 2; }
    else c.n[a.el] = (c.n[a.el] || 0) + 1;
    c.n.H = (c.n.H || 0) + (a.h || 0);
    c.ch += a.ch || 0;
  });
  const poly = atoms.some(a => a.el === '*');
  const out = Object.values(comps).map(c => {
    const ks = Object.keys(c.n).filter(k => c.n[k]);
    const order = (ks.includes('C') ? ['C', 'H', ...ks.filter(k => k !== 'C' && k !== 'H').sort()] : ks.sort());
    let s = order.map(k => k + (c.n[k] > 1 ? c.n[k] : '')).join('');
    if (c.ch) s += '^' + (Math.abs(c.ch) > 1 ? Math.abs(c.ch) : '') + (c.ch > 0 ? '+' : '-');
    return s;
  });
  return poly ? `(${out[0]})n` : out.join(' ');
}

