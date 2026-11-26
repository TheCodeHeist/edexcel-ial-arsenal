/* Curated Edexcel IAL Mathematics presets for Graph Lab (P1–P4 and FP1–FP3).
   Every expression uses clean GeoGebra syntax so clicking any preset plots an exam-ready demonstration immediately. */

import type { GraphMode, GraphWindow, LineStyle } from './engine';

export type MathsUnitBadge = 'P1' | 'P2' | 'P3' | 'P4' | 'FP1' | 'FP2' | 'FP3';

export interface PresetExpr {
  cmd: string;
  label?: string;
  style?: LineStyle;
}

export interface GraphPreset {
  id: string;
  unit: MathsUnitBadge;
  code: string;
  title: string;
  mode: GraphMode;
  note: string;
  window: GraphWindow;
  expressions: PresetExpr[];
}

export const GRAPH_UNITS: readonly MathsUnitBadge[] = ['P1', 'P2', 'P3', 'P4', 'FP1', 'FP2', 'FP3'];

export const GRAPH_PRESETS: GraphPreset[] = [
  /* ---------- P1 (WMA11) ---------- */
  {
    id: 'p1-cubic',
    unit: 'P1',
    code: 'WMA11',
    title: 'Cubic sketching & roots',
    mode: '2d',
    note: 'Factorised cubic f(x) = (x + 2)(x − 1)(x − 3): roots at −2, 1, 3 and y-intercept at (0, 6).',
    window: { xmin: -4, xmax: 5, ymin: -10, ymax: 10 },
    expressions: [{ cmd: 'f(x) = (x + 2)(x - 1)(x - 3)' }],
  },
  {
    id: 'p1-quadratic',
    unit: 'P1',
    code: 'WMA11',
    title: 'Quadratic & discriminant',
    mode: '2d',
    note: 'Drag a, b, c to watch b² − 4ac move the parabola across the x-axis.',
    window: { xmin: -6, xmax: 6, ymin: -6, ymax: 8 },
    expressions: [
      { cmd: 'a = 1' },
      { cmd: 'b = -2' },
      { cmd: 'c = -3' },
      { cmd: 'f(x) = a*x^2 + b*x + c' },
    ],
  },
  {
    id: 'p1-transforms',
    unit: 'P1',
    code: 'WMA11',
    title: 'Graph transformations',
    mode: '2d',
    note: 'Compare y = f(x) with y = a f(b(x + c)) + d: stretches and translations controlled by sliders.',
    window: { xmin: -6, xmax: 6, ymin: -5, ymax: 7 },
    expressions: [
      { cmd: 'f(x) = x^2 - 2x' },
      { cmd: 'a = 1' },
      { cmd: 'b = 1' },
      { cmd: 'c = 0' },
      { cmd: 'd = 0' },
      { cmd: 'g(x) = a*f(b*(x + c)) + d' },
    ],
  },
  {
    id: 'p1-reciprocal',
    unit: 'P1',
    code: 'WMA11',
    title: 'Reciprocal & asymptotes',
    mode: '2d',
    note: 'Hyperbola y = 2/(x − 1) + 1 with its vertical asymptote x = 1 and horizontal asymptote y = 1.',
    window: { xmin: -6, xmax: 8, ymin: -5, ymax: 7 },
    expressions: [
      { cmd: 'f(x) = 2/(x - 1) + 1' },
      { cmd: 'x = 1', style: 'dashed' },
      { cmd: 'y = 1', style: 'dashed' },
    ],
  },

  /* ---------- P2 (WMA12) ---------- */
  {
    id: 'p2-circle',
    unit: 'P2',
    code: 'WMA12',
    title: 'Circle & tangent',
    mode: '2d',
    note: 'Circle centre (2, −1), radius 5, with the tangent drawn at P(5, 3).',
    window: { xmin: -6, xmax: 10, ymin: -7, ymax: 6 },
    expressions: [
      { cmd: 'c1: (x - 2)^2 + (y + 1)^2 = 25' },
      { cmd: 'P = (5, 3)' },
      { cmd: 'Tangent(P, c1)' },
    ],
  },
  {
    id: 'p2-exp-log',
    unit: 'P2',
    code: 'WMA12',
    title: 'eˣ and ln x reflection',
    mode: '2d',
    note: 'Inverse functions y = eˣ and y = ln x reflected across the line y = x.',
    window: { xmin: -5, xmax: 7, ymin: -4, ymax: 6 },
    expressions: [
      { cmd: 'f(x) = e^x' },
      { cmd: 'g(x) = ln(x)' },
      { cmd: 'y = x', style: 'dashed' },
    ],
  },
  {
    id: 'p2-trig',
    unit: 'P2',
    code: 'WMA12',
    title: 'Solving sin 2x = 0.5',
    mode: '2d',
    note: 'Wave y = sin(2x) intersecting y = 0.5 across 0 ≤ x ≤ 2π.',
    window: { xmin: -3.5, xmax: 6.6, ymin: -1.6, ymax: 1.6 },
    expressions: [
      { cmd: 'f(x) = sin(2x)' },
      { cmd: 'g(x) = 0.5' },
    ],
  },
  {
    id: 'p2-integral',
    unit: 'P2',
    code: 'WMA12',
    title: 'Definite integral area',
    mode: '2d',
    note: 'Area under y = x² + 1 between x = 0 and x = 3 shaded exactly.',
    window: { xmin: -2, xmax: 5, ymin: -1, ymax: 12 },
    expressions: [
      { cmd: 'f(x) = x^2 + 1' },
      { cmd: 'Integral(f, 0, 3)' },
    ],
  },

  /* ---------- P3 (WMA13) ---------- */
  {
    id: 'p3-modulus',
    unit: 'P3',
    code: 'WMA13',
    title: 'Modulus equations',
    mode: '2d',
    note: 'Solving |2x − 3| = x + 1 by locating the two intersections of the V-graph and the line.',
    window: { xmin: -3, xmax: 7, ymin: -1, ymax: 8 },
    expressions: [
      { cmd: 'f(x) = |2x - 3|' },
      { cmd: 'g(x) = x + 1' },
    ],
  },
  {
    id: 'p3-recip-trig',
    unit: 'P3',
    code: 'WMA13',
    title: 'sec x and cosec x',
    mode: '2d',
    note: 'Reciprocal trig functions sec(x) and csc(x) with their periodic vertical asymptotes.',
    window: { xmin: -6.5, xmax: 6.5, ymin: -5, ymax: 5 },
    expressions: [
      { cmd: 'f(x) = sec(x)' },
      { cmd: 'g(x) = csc(x)' },
    ],
  },
  {
    id: 'p3-stationary',
    unit: 'P3',
    code: 'WMA13',
    title: 'Product rule & stationary point',
    mode: '2d',
    note: 'y = x e⁻ˣ and its derivative y′ = (1 − x)e⁻ˣ showing the maximum where y′ = 0.',
    window: { xmin: -2, xmax: 6, ymin: -1.5, ymax: 1.5 },
    expressions: [
      { cmd: 'f(x) = x * e^(-x)' },
      { cmd: "g(x) = f'(x)", style: 'dashed' },
    ],
  },

  /* ---------- P4 (WMA14) ---------- */
  {
    id: 'p4-parametric',
    unit: 'P4',
    code: 'WMA14',
    title: 'Parametric curve (t², 2t)',
    mode: '2d',
    note: 'Parametric parabola traced for −3 ≤ t ≤ 3 with a movable parameter point P(p², 2p).',
    window: { xmin: -2, xmax: 11, ymin: -7, ymax: 7 },
    expressions: [
      { cmd: 'Curve(t^2, 2t, t, -3, 3)' },
      { cmd: 'p = 1.5' },
      { cmd: 'P = (p^2, 2p)' },
    ],
  },
  {
    id: 'p4-implicit',
    unit: 'P4',
    code: 'WMA14',
    title: 'Implicit ellipse x² + xy + y² = 7',
    mode: '2d',
    note: 'Tilted implicit curve typical of P4 implicit differentiation questions.',
    window: { xmin: -5, xmax: 5, ymin: -4, ymax: 4 },
    expressions: [{ cmd: 'x^2 + x*y + y^2 = 7' }],
  },
  {
    id: 'p4-area',
    unit: 'P4',
    code: 'WMA14',
    title: 'Area between two curves',
    mode: '2d',
    note: 'Region enclosed between y = 4 − x² and y = x + 2 from x = −2 to x = 1.',
    window: { xmin: -4, xmax: 4, ymin: -2, ymax: 6 },
    expressions: [
      { cmd: 'f(x) = 4 - x^2' },
      { cmd: 'g(x) = x + 2' },
      { cmd: 'IntegralBetween(f, g, -2, 1)' },
    ],
  },
  {
    id: 'p4-vectors-3d',
    unit: 'P4',
    code: 'WMA14',
    title: 'Intersecting 3D vector lines',
    mode: '3d',
    note: 'Two 3D vector lines r = a + λb meeting at a point in space.',
    window: { xmin: -5, xmax: 7, ymin: -5, ymax: 7, zmin: -4, zmax: 6 },
    expressions: [
      { cmd: 'A = (1, 2, 0)' },
      { cmd: 'L1 = Line(A, Vector((2, -1, 1)))' },
      { cmd: 'B = (3, 1, 1)' },
      { cmd: 'L2 = Line(B, Vector((1, 2, -1)))' },
      { cmd: 'Intersect(L1, L2)' },
    ],
  },

  /* ---------- FP1 (WFM01) ---------- */
  {
    id: 'fp1-parabola',
    unit: 'FP1',
    code: 'WFM01',
    title: 'Parabola y² = 4ax, focus & directrix',
    mode: '2d',
    note: 'Adjust focal parameter a to move focus (a, 0) and directrix x = −a.',
    window: { xmin: -6, xmax: 10, ymin: -8, ymax: 8 },
    expressions: [
      { cmd: 'a = 2' },
      { cmd: 'y^2 = 4*a*x' },
      { cmd: 'F = (a, 0)' },
      { cmd: 'x = -a', style: 'dashed' },
    ],
  },
  {
    id: 'fp1-hyperbola',
    unit: 'FP1',
    code: 'WFM01',
    title: 'Rectangular hyperbola xy = c²',
    mode: '2d',
    note: 'Rectangular hyperbola xy = c² with slider c controlling the branches.',
    window: { xmin: -7, xmax: 7, ymin: -7, ymax: 7 },
    expressions: [
      { cmd: 'c = 2' },
      { cmd: 'x*y = c^2' },
    ],
  },

  /* ---------- FP2 (WFM02) ---------- */
  {
    id: 'fp2-polar',
    unit: 'FP2',
    code: 'WFM02',
    title: 'Polar cardioid r = a(1 + cos θ)',
    mode: '2d',
    note: 'Cardioid plotted via parametric conversion (r cos t, r sin t) for 0 ≤ t ≤ 2π.',
    window: { xmin: -2, xmax: 5, ymin: -3.5, ymax: 3.5 },
    expressions: [
      { cmd: 'a = 2' },
      { cmd: 'Curve(a*(1 + cos(t))*cos(t), a*(1 + cos(t))*sin(t), t, 0, 2*pi)' },
    ],
  },
  {
    id: 'fp2-oblique',
    unit: 'FP2',
    code: 'WFM02',
    title: 'Rational curve & oblique asymptote',
    mode: '2d',
    note: 'y = (x² + 1)/(x − 1) = x + 1 + 2/(x − 1) with asymptotes x = 1 and y = x + 1.',
    window: { xmin: -7, xmax: 9, ymin: -8, ymax: 10 },
    expressions: [
      { cmd: 'f(x) = (x^2 + 1)/(x - 1)' },
      { cmd: 'x = 1', style: 'dashed' },
      { cmd: 'y = x + 1', style: 'dashed' },
    ],
  },

  /* ---------- FP3 (WFM03) ---------- */
  {
    id: 'fp3-hyperbolic',
    unit: 'FP3',
    code: 'WFM03',
    title: 'cosh x, sinh x and tanh x',
    mode: '2d',
    note: 'Hyperbolic functions together: cosh(x) ≥ 1, odd sinh(x), and bounded tanh(x) ∈ (−1, 1).',
    window: { xmin: -4, xmax: 4, ymin: -4, ymax: 5 },
    expressions: [
      { cmd: 'f(x) = cosh(x)' },
      { cmd: 'g(x) = sinh(x)' },
      { cmd: 'h(x) = tanh(x)' },
    ],
  },
  {
    id: 'fp3-planes-3d',
    unit: 'FP3',
    code: 'WFM03',
    title: 'Intersecting planes & line',
    mode: '3d',
    note: 'Two planes in 3D space and their line of intersection.',
    window: { xmin: -6, xmax: 6, ymin: -6, ymax: 6, zmin: -5, zmax: 5 },
    expressions: [
      { cmd: 'p1: 2x - y + z = 4' },
      { cmd: 'p2: x + y - z = 1' },
      { cmd: 'IntersectPath(p1, p2)' },
    ],
  },
  {
    id: 'fp3-surface-3d',
    unit: 'FP3',
    code: 'WFM03',
    title: '3D saddle & paraboloid',
    mode: '3d',
    note: 'Hyperbolic paraboloid f(x, y) = x² − y² alongside elliptic paraboloid g(x, y) = 4 − x² − y².',
    window: { xmin: -4, xmax: 4, ymin: -4, ymax: 4, zmin: -5, zmax: 6 },
    expressions: [
      { cmd: 'f(x, y) = x^2 - y^2' },
      { cmd: 'g(x, y) = 4 - x^2 - y^2' },
    ],
  },
];

export function matchPreset(query: string): GraphPreset | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return GRAPH_PRESETS.find((p) => p.id.toLowerCase() === q)
    ?? GRAPH_PRESETS.find((p) => p.title.toLowerCase().includes(q) || p.unit.toLowerCase() === q || p.code.toLowerCase() === q);
}
