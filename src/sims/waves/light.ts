/* Waves Lab, Light tab: the physics. A 2D ray tracer for the optics bench (lengths in cm, seen from above), the
   materials, and the numbers the polarisation and intensity views need.

   Tracing. Every block is a body made of straight edges and circular arcs. A ray is followed to the nearest edge;
   the refractive index on each side is found by sampling just either side of the hit, so a ray passing from glass to
   cladding to air needs no special cases. At each interface Snell's law n₁ sin θ₁ = n₂ sin θ₂ gives the transmitted
   ray, unless sin θ₂ would exceed 1: then the ray is totally internally reflected. A partial reflection always
   leaves the interface too, with the share of the light given by the Fresnel equations for unpolarised light (beyond
   the spec; the spec only asks that waves are both transmitted and reflected at an interface). The brightest branch
   is the "main" path, whose interfaces are listed for the readings. */

export type V2 = [number, number];
type Prim = { k: 'seg'; a: V2; b: V2 } | { k: 'arc'; c: V2; r: number; a0: number; a1: number };

export interface Material { id: string; name: string; n: number; B: number }   // B: Cauchy dispersion / μm²
export const MATERIALS: Material[] = [
  { id: 'water', name: 'Water', n: 1.33, B: 0.0031 },
  { id: 'perspex', name: 'Perspex', n: 1.5, B: 0.0045 },
  { id: 'glass', name: 'Glass', n: 1.52, B: 0.0042 },
  { id: 'diamond', name: 'Diamond', n: 2.42, B: 0.023 },
  { id: 'custom', name: 'Custom', n: 1.6, B: 0.005 },
];
export const OUTERS = [['air', 'Air', 1.0], ['water', 'Water', 1.33]] as const;

export type Shape = 'rect' | 'semi' | 'prism' | 'fibre' | 'tank';
export const SHAPES: [Shape, string, string][] = [
  ['rect', 'Rectangular block', 'Block'], ['semi', 'Semicircular block', 'Semi'], ['prism', 'Triangular prism', 'Prism'],
  ['fibre', 'Optical fibre', 'Fibre'], ['tank', 'Lamp in a water tank', 'Tank'],
];
/** Largest useful ray angle for each shape (degrees). */
export const MAX_ANGLE: Record<Shape, number> = { rect: 85, semi: 85, prism: 85, fibre: 80, tank: 85 };

/** n at wavelength nm, from n at 589 nm (sodium D) and a Cauchy term. */
export const nAt = (n589: number, B: number, nm: number) => n589 + B * (1 / (nm / 1000) ** 2 - 1 / 0.589 ** 2);

export interface Body { id: string; prims: Prim[]; inside: (p: V2) => boolean; n: (nm: number) => number; name: string }
export interface Setup { shape: Shape; n: number; B: number; nOut: number; nClad: number; angle: number }
export interface Seg { a: V2; b: V2; I: number; nm: number; n: number; main: boolean }
export interface Hit { p: V2; nrm: V2; i: number; t: number | null; n1: number; n2: number; R: number; tir: boolean; m1: string; m2: string }
export interface Trace { segs: Seg[]; hits: Hit[]; ray: { p: V2; d: V2 }; bodies: Body[] }

export const BOX: [number, number, number, number] = [-15, -10, 15, 10];   // x0 y0 x1 y1
const rad = (d: number) => (d * Math.PI) / 180;
export const deg = (r: number) => (r * 180) / Math.PI;

/* ---------- the bodies ---------- */
const poly = (pts: V2[]): Prim[] => pts.map((a, i) => ({ k: 'seg', a, b: pts[(i + 1) % pts.length] }));
function inPoly(pts: V2[], p: V2) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
export const RECT: V2[] = [[-4.5, -2.5], [4.5, -2.5], [4.5, 2.5], [-4.5, 2.5]];
export const SEMI_R = 4.5;
const PS = 8;   // prism side
export const PRISM: V2[] = [[-PS / 2, -2.6], [PS / 2, -2.6], [0, -2.6 + (PS * Math.sqrt(3)) / 2]];
export const CORE = { x0: -11, x1: 15.5, h: 0.7 };
export const CLAD = 1.25;
export const TANK = { x0: -11, x1: 11, y0: -7, y1: 1.5 };
export const LAMP: V2 = [-4, -6];

export function bodies(s: Setup): Body[] {
  const nf = (nm: number) => nAt(s.n, s.B, nm);
  switch (s.shape) {
    case 'rect': return [{ id: 'block', name: 'block', prims: poly(RECT), inside: (p) => inPoly(RECT, p), n: nf }];
    case 'semi': return [{
      id: 'block', name: 'block',
      prims: [{ k: 'seg', a: [-SEMI_R, 0], b: [SEMI_R, 0] }, { k: 'arc', c: [0, 0], r: SEMI_R, a0: Math.PI, a1: 2 * Math.PI }],
      inside: (p) => p[1] <= 0 && p[0] * p[0] + p[1] * p[1] <= SEMI_R * SEMI_R, n: nf,
    }];
    case 'prism': return [{ id: 'block', name: 'prism', prims: poly(PRISM), inside: (p) => inPoly(PRISM, p), n: nf }];
    case 'fibre': {
      const core: V2[] = [[CORE.x0, -CORE.h], [CORE.x1, -CORE.h], [CORE.x1, CORE.h], [CORE.x0, CORE.h]];
      const clad: V2[] = [[CORE.x0, -CLAD], [CORE.x1, -CLAD], [CORE.x1, CLAD], [CORE.x0, CLAD]];
      return [
        { id: 'core', name: 'core', prims: poly(core), inside: (p) => inPoly(core, p), n: nf },
        { id: 'clad', name: 'cladding', prims: poly(clad), inside: (p) => inPoly(clad, p), n: (nm) => nAt(s.nClad, s.B, nm) },
      ];
    }
    case 'tank': {
      const w: V2[] = [[TANK.x0, TANK.y0], [TANK.x1, TANK.y0], [TANK.x1, TANK.y1], [TANK.x0, TANK.y1]];
      return [{ id: 'block', name: 'water', prims: poly(w), inside: (p) => inPoly(w, p), n: nf }];
    }
  }
}

/** Where the ray starts and which way it goes, for this shape at this angle (degrees). */
export function source(s: Setup): { p: V2; d: V2; aim: V2 } {
  const a = rad(s.angle);
  switch (s.shape) {
    case 'rect': { const aim: V2 = [-1.2, 2.5], d: V2 = [Math.sin(a), -Math.cos(a)]; return { p: [aim[0] - d[0] * 9, aim[1] - d[1] * 9], d, aim }; }
    case 'semi': { const d: V2 = [Math.sin(a), Math.cos(a)]; return { p: [-d[0] * 11.5, -d[1] * 11.5], d, aim: [0, 0] }; }
    case 'prism': {
      const [A, , C] = PRISM, mid: V2 = [(A[0] + C[0]) / 2, (A[1] + C[1]) / 2];
      const into: V2 = [Math.cos(rad(-30)), Math.sin(rad(-30))];     // along the inward normal of the left face
      const d: V2 = [into[0] * Math.cos(a) - into[1] * Math.sin(a), into[0] * Math.sin(a) + into[1] * Math.cos(a)];
      return { p: [mid[0] - d[0] * 7.5, mid[1] - d[1] * 7.5], d, aim: mid };
    }
    case 'fibre': { const d: V2 = [Math.cos(a), Math.sin(a)], aim: V2 = [CORE.x0, 0]; return { p: [aim[0] - d[0] * 3.6, aim[1] - d[1] * 3.6], d, aim }; }
    case 'tank': { const d: V2 = [Math.sin(a), Math.cos(a)]; return { p: LAMP, d, aim: [LAMP[0] + d[0] * ((TANK.y1 - LAMP[1]) / d[1] || 0), TANK.y1] }; }
  }
}

/* ---------- intersections ---------- */
const EPS = 1e-6;
function hitPrim(pr: Prim, o: V2, d: V2): number {
  if (pr.k === 'seg') {
    const ex = pr.b[0] - pr.a[0], ey = pr.b[1] - pr.a[1];
    const den = d[0] * ey - d[1] * ex;
    if (Math.abs(den) < 1e-12) return Infinity;
    const wx = pr.a[0] - o[0], wy = pr.a[1] - o[1];
    const t = (wx * ey - wy * ex) / den, u = (wx * d[1] - wy * d[0]) / den;
    return t > EPS && u >= -1e-9 && u <= 1 + 1e-9 ? t : Infinity;
  }
  const fx = o[0] - pr.c[0], fy = o[1] - pr.c[1];
  const b = fx * d[0] + fy * d[1], c = fx * fx + fy * fy - pr.r * pr.r, disc = b * b - c;
  if (disc < 0) return Infinity;
  let best = Infinity;
  for (const t of [-b - Math.sqrt(disc), -b + Math.sqrt(disc)]) {
    if (t <= EPS || t >= best) continue;
    let ang = Math.atan2(fy + t * d[1], fx + t * d[0]);
    if (ang < pr.a0 - 1e-9) ang += 2 * Math.PI;
    if (ang >= pr.a0 - 1e-9 && ang <= pr.a1 + 1e-9) best = t;
  }
  return best;
}
function normalOf(pr: Prim, p: V2): V2 {
  if (pr.k === 'seg') { const ex = pr.b[0] - pr.a[0], ey = pr.b[1] - pr.a[1], L = Math.hypot(ex, ey); return [-ey / L, ex / L]; }
  const x = p[0] - pr.c[0], y = p[1] - pr.c[1], L = Math.hypot(x, y); return [x / L, y / L];
}
function boxExit(o: V2, d: V2) {
  const [x0, y0, x1, y1] = BOX;
  let t = Infinity;
  if (d[0] > 0) t = Math.min(t, (x1 - o[0]) / d[0]); else if (d[0] < 0) t = Math.min(t, (x0 - o[0]) / d[0]);
  if (d[1] > 0) t = Math.min(t, (y1 - o[1]) / d[1]); else if (d[1] < 0) t = Math.min(t, (y0 - o[1]) / d[1]);
  return Math.max(0, t);
}

/** Fresnel reflectance for unpolarised light. */
export function fresnel(n1: number, n2: number, cosi: number, cost: number) {
  const rs = (n1 * cosi - n2 * cost) / (n1 * cosi + n2 * cost);
  const rp = (n2 * cosi - n1 * cost) / (n2 * cosi + n1 * cost);
  return (rs * rs + rp * rp) / 2;
}

/** Trace one wavelength. */
export function trace(s: Setup, nm = 589): Trace {
  const bs = bodies(s);
  const src = source(s);
  const nOf = (p: V2) => { for (const b of bs) if (b.inside(p)) return b.n(nm); return s.nOut; };
  const nameOf = (p: V2) => { for (const b of bs) if (b.inside(p)) return b.name; return s.nOut > 1.01 ? 'water' : 'air'; };
  const segs: Seg[] = [], hits: Hit[] = [];
  type Ray = { o: V2; d: V2; I: number; depth: number; main: boolean };
  const stack: Ray[] = [{ o: src.p, d: src.d, I: 1, depth: 0, main: true }];
  let guard = 0;
  while (stack.length && guard++ < 260) {
    const r = stack.pop()!;
    let tBest = Infinity, pBest: Prim | null = null;
    for (const b of bs) for (const pr of b.prims) { const t = hitPrim(pr, r.o, r.d); if (t < tBest) { tBest = t; pBest = pr; } }
    const tb = boxExit(r.o, r.d);
    const nHere = nOf([r.o[0] + r.d[0] * 1e-4, r.o[1] + r.d[1] * 1e-4]);
    if (!pBest || tBest > tb) {
      segs.push({ a: r.o, b: [r.o[0] + r.d[0] * tb, r.o[1] + r.d[1] * tb], I: r.I, nm, n: nHere, main: r.main });
      continue;
    }
    const p: V2 = [r.o[0] + r.d[0] * tBest, r.o[1] + r.d[1] * tBest];
    segs.push({ a: r.o, b: p, I: r.I, nm, n: nHere, main: r.main });
    let nrm = normalOf(pBest, p);
    if (nrm[0] * r.d[0] + nrm[1] * r.d[1] > 0) nrm = [-nrm[0], -nrm[1]];       // points back into the incoming side
    const n1 = nOf([p[0] + nrm[0] * 1e-4, p[1] + nrm[1] * 1e-4]), n2 = nOf([p[0] - nrm[0] * 1e-4, p[1] - nrm[1] * 1e-4]);
    const cosi = Math.min(1, -(nrm[0] * r.d[0] + nrm[1] * r.d[1]));
    if (Math.abs(n1 - n2) < 1e-9) { stack.push({ ...r, o: p }); continue; }
    const eta = n1 / n2, k = 1 - eta * eta * (1 - cosi * cosi);
    const refl: V2 = [r.d[0] + 2 * cosi * nrm[0], r.d[1] + 2 * cosi * nrm[1]];
    const tir = k < 0;
    let R = 1, tdir: V2 | null = null, cost = 0;
    if (!tir) {
      cost = Math.sqrt(k);
      tdir = [eta * r.d[0] + (eta * cosi - cost) * nrm[0], eta * r.d[1] + (eta * cosi - cost) * nrm[1]];
      R = fresnel(n1, n2, cosi, cost);
    }
    if (r.main) hits.push({
      p, nrm, i: deg(Math.acos(cosi)), t: tir ? null : deg(Math.acos(cost)), n1, n2, R, tir,
      m1: nameOf([p[0] + nrm[0] * 1e-4, p[1] + nrm[1] * 1e-4]), m2: nameOf([p[0] - nrm[0] * 1e-4, p[1] - nrm[1] * 1e-4]),
    });
    if (r.depth > 60) continue;
    const mainT = !tir && 1 - R >= R;
    if (tdir && r.I * (1 - R) > 0.004) stack.push({ o: p, d: tdir, I: r.I * (1 - R), depth: r.depth + 1, main: r.main && mainT });
    if (r.I * R > 0.012) stack.push({ o: p, d: refl, I: r.I * R, depth: r.depth + 1, main: r.main && !mainT });
  }
  return { segs, hits, ray: { p: src.p, d: src.d }, bodies: bs };
}

/** Critical angle (degrees) going from n1 into n2, or null if there is none (n1 ≤ n2). */
export const critical = (n1: number, n2: number) => (n1 > n2 ? deg(Math.asin(n2 / n1)) : null);

/** The interface where total internal reflection is decided for this shape: the one the question is about. */
export function keyInterface(s: Setup): { from: number; to: number; theta: number | null; fromName: string; toName: string } {
  const outName = s.nOut > 1.01 ? 'water' : 'air';
  const mat = 'the block';
  switch (s.shape) {
    case 'semi': return { from: s.n, to: s.nOut, theta: s.angle, fromName: mat, toName: outName };
    case 'tank': return { from: s.n, to: s.nOut, theta: s.angle, fromName: 'water', toName: outName };
    case 'fibre': {
      const r = deg(Math.asin(Math.min(1, (s.nOut * Math.sin(rad(s.angle))) / s.n)));
      return { from: s.n, to: s.nClad, theta: 90 - r, fromName: 'core', toName: 'cladding' };
    }
    case 'rect': {
      const r = deg(Math.asin(Math.min(1, (s.nOut * Math.sin(rad(s.angle))) / s.n)));
      return { from: s.n, to: s.nOut, theta: r, fromName: mat, toName: outName };
    }
    case 'prism': {
      const r1 = deg(Math.asin(Math.min(1, (s.nOut * Math.sin(rad(s.angle))) / s.n)));
      return { from: s.n, to: s.nOut, theta: 60 - r1, fromName: mat, toName: outName };
    }
  }
}

/* ---------- polarisation and intensity ---------- */
/** Malus's law share of the light through an analyser at Δ degrees to the polariser. */
export const malus = (d: number) => Math.cos(rad(d)) ** 2;
/** Intensity (W m⁻²) at r metres from a point source of power P watts, radiating equally in all directions. */
export const pointI = (P: number, r: number) => P / (4 * Math.PI * r * r);
