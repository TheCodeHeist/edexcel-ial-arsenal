/* Engine-agnostic types, expression normalization, number parsing, and palette colours for Graph Lab.
   Zero GeoGebra runtime dependency here so another graphing backend (e.g. Desmos) can implement GraphEngine later. */

import { PALETTES, type PaletteId } from '../../data/palettes';

export type GraphMode = '2d' | '3d';
export type LineStyle = 'solid' | 'dashed' | 'dotted';

export interface GraphWindow {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  zmin?: number;
  zmax?: number;
}

export interface ExprItem {
  id: string;
  cmd: string;
  label?: string;
  color?: string;
  visible?: boolean;
  style?: LineStyle;
}

export interface SliderSpec {
  min: number;
  max: number;
  step: number;
}

export interface LiveObject {
  id: string;
  ggbLabels: string[];
  cmd: string;
  label?: string;
  type: string;
  valueString: string;
  latex?: string;
  color: string;
  visible: boolean;
  error?: string;
  numericValue?: number;
  slider?: SliderSpec;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface Extremum2D extends Point2D {
  kind: 'max' | 'min' | 'turning';
}

export interface FeatureReport {
  id: string;
  ggbLabel: string;
  cmd: string;
  type: string;
  roots: Point2D[];
  yIntercept: Point2D | null;
  extrema: Extremum2D[];
  asymptotes: string[];
  derivative?: string;
}

export interface IntersectionReport {
  a: string;
  b: string;
  points: Point2D[];
}

export interface GraphAnalysis {
  mode: GraphMode;
  window: GraphWindow;
  objects: LiveObject[];
  features: FeatureReport[];
  intersections: IntersectionReport[];
}

export interface PointCheckResult {
  point: Point2D;
  kind: 'point' | 'root' | 'stationary';
  pass: boolean;
  actualY?: number;
  derivative?: number;
  error?: number;
  message: string;
}

export interface EquationTestOptions {
  points?: Point2D[];
  roots?: number[];
  stationary?: Point2D[];
  tolerance?: number;
}

export interface EquationTestReport {
  expression: string;
  passed: number;
  total: number;
  allPassed: boolean;
  results: PointCheckResult[];
  parseError?: string;
}

export interface MountOptions {
  mode: GraphMode;
  width: number;
  height: number;
  showNativeTools?: boolean;
  showAxes?: boolean;
  showGrid?: boolean;
  window?: GraphWindow;
}

export interface GraphEngine {
  readonly kind: 'geogebra' | 'desmos';
  readonly mode: GraphMode;
  readonly ready: boolean;
  mount(container: HTMLElement, opts: MountOptions): Promise<void>;
  setExpressions(items: ExprItem[]): Promise<LiveObject[]>;
  getExpressions(): LiveObject[];
  setNumericValue(ggbLabel: string, value: number, commit?: boolean): void;
  setVisible(id: string, visible: boolean): void;
  setColor(id: string, hex: string): void;
  setWindow(win: GraphWindow): void;
  getWindow(): GraphWindow;
  setAxesAndGrid(axes: boolean, grid: boolean): void;
  setNativeTools(show: boolean): void;
  clear(): void;
  analyze(): GraphAnalysis;
  testEquation(exprOrLabel: string, opts: EquationTestOptions): EquationTestReport;
  snapshot(scale?: number): string | null;
  resize(width: number, height: number): void;
  onChange(fn: (objects: LiveObject[], external: boolean) => void): () => void;
  destroy(): void;
}

export const DEFAULT_WINDOW_2D: GraphWindow = { xmin: -8, xmax: 8, ymin: -5, ymax: 5 };
export const DEFAULT_WINDOW_3D: GraphWindow = { xmin: -6, xmax: 6, ymin: -6, ymax: 6, zmin: -5, zmax: 5 };

/** Normalize Edexcel/LaTeX-flavoured math input into clean GeoGebra command syntax. */
export function normalizeGGBCommand(raw: string): string {
  let s = raw.trim();
  if (!s) return '';
  // Strip outer $...$ or $$...$$ if pasted from LaTeX
  if (s.startsWith('$$') && s.endsWith('$$') && s.length > 4) s = s.slice(2, -2).trim();
  else if (s.startsWith('$') && s.endsWith('$') && s.length > 2) s = s.slice(1, -1).trim();

  s = s
    .replace(/[−–—]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\u212f/g, 'e')
    .replace(/π/g, 'pi')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4');

  // Edexcel IAL function names → GeoGebra equivalents
  s = s
    .replace(/\bcosec\b/gi, 'csc')
    .replace(/\barcsin\b/gi, 'asin')
    .replace(/\barccos\b/gi, 'acos')
    .replace(/\barctan\b/gi, 'atan')
    .replace(/\barsinh\b/gi, 'asinh')
    .replace(/\barcosh\b/gi, 'acosh')
    .replace(/\bartanh\b/gi, 'atanh');

  return s.trim();
}

/** Tiny safe recursive-descent evaluator for simple numeric tokens like "-pi/4", "1/2", "sqrt(2)", "2*pi". */
export function evalSimpleNumber(token: string): number | null {
  const s = normalizeGGBCommand(token).replace(/\s+/g, '');
  if (!s) return null;

  let pos = 0;
  const peek = () => s[pos] ?? '';
  const eat = (ch: string) => {
    if (s[pos] === ch) { pos++; return true; }
    return false;
  };

  const parseExpr = (): number | null => {
    let v = parseTerm();
    if (v === null) return null;
    while (peek() === '+' || peek() === '-') {
      const op = s[pos++];
      const rhs = parseTerm();
      if (rhs === null) return null;
      v = op === '+' ? v + rhs : v - rhs;
    }
    return v;
  };

  const parseTerm = (): number | null => {
    let v = parseFactor();
    if (v === null) return null;
    while (true) {
      if (peek() === '*' || peek() === '/') {
        const op = s[pos++];
        const rhs = parseFactor();
        if (rhs === null) return null;
        if (op === '/') {
          if (rhs === 0) return null;
          v /= rhs;
        } else {
          v *= rhs;
        }
      } else if (peek() === '(' || /[a-z]/i.test(peek())) {
        // Implicit multiplication, e.g. 2pi or 2sqrt(3)
        const rhs = parseFactor();
        if (rhs === null) return null;
        v *= rhs;
      } else {
        break;
      }
    }
    return v;
  };

  const parseFactor = (): number | null => {
    if (eat('+')) return parseFactor();
    if (eat('-')) {
      const v = parseFactor();
      return v === null ? null : -v;
    }
    let base = parseAtom();
    if (base === null) return null;
    if (eat('^')) {
      const exp = parseFactor();
      if (exp === null) return null;
      base = Math.pow(base, exp);
    }
    return Number.isFinite(base) ? base : null;
  };

  const parseAtom = (): number | null => {
    if (eat('(')) {
      const v = parseExpr();
      if (v === null || !eat(')')) return null;
      return v;
    }
    const numMatch = /^\d+(?:\.\d+)?(?:e[+-]?\d+)?/i.exec(s.slice(pos));
    if (numMatch) {
      pos += numMatch[0].length;
      const n = Number(numMatch[0]);
      return Number.isFinite(n) ? n : null;
    }
    const idMatch = /^[a-z]+/i.exec(s.slice(pos));
    if (idMatch) {
      const name = idMatch[0].toLowerCase();
      pos += idMatch[0].length;
      if (name === 'pi') return Math.PI;
      if (name === 'e') return Math.E;
      if (!eat('(')) return null;
      const arg = parseExpr();
      if (arg === null || !eat(')')) return null;
      if (name === 'sqrt') return arg >= 0 ? Math.sqrt(arg) : null;
      if (name === 'sin') return Math.sin(arg);
      if (name === 'cos') return Math.cos(arg);
      if (name === 'tan') return Math.tan(arg);
      if (name === 'ln') return arg > 0 ? Math.log(arg) : null;
      if (name === 'abs') return Math.abs(arg);
      return null;
    }
    return null;
  };

  const out = parseExpr();
  if (out === null || pos !== s.length || !Number.isFinite(out)) return null;
  return out;
}

/** Parse "(2, 0), (0, -4)" or newline-separated "2, 0" coordinate pairs into Point2D[]. */
export function parsePointsInput(raw: string): Point2D[] {
  const s = raw.trim();
  if (!s) return [];
  const out: Point2D[] = [];

  // Prefer explicit parenthesized pairs if present: (x, y)
  const parenPairs = [...s.matchAll(/\(([^()]+)\)/g)];
  if (parenPairs.length) {
    for (const m of parenPairs) {
      const parts = m[1].split(',');
      if (parts.length !== 2) throw new Error(`Invalid coordinate "(${m[1]})". Expected (x, y).`);
      const x = evalSimpleNumber(parts[0]);
      const y = evalSimpleNumber(parts[1]);
      if (x === null || y === null) throw new Error(`Could not read numbers in "(${m[1]})".`);
      out.push({ x, y });
    }
    return out;
  }

  // Otherwise support one "x, y" pair per line or semicolon
  for (const line of s.split(/[\n;]+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(',');
    if (parts.length !== 2) throw new Error(`Invalid coordinate "${trimmed}". Use (x, y) format.`);
    const x = evalSimpleNumber(parts[0]);
    const y = evalSimpleNumber(parts[1]);
    if (x === null || y === null) throw new Error(`Could not read numbers in "${trimmed}".`);
    out.push({ x, y });
  }
  return out;
}

/** Parse comma- or space-separated numeric tokens such as "-1, 2, pi/2". */
export function parseNumbersInput(raw: string): number[] {
  const s = raw.trim();
  if (!s) return [];
  const tokens = s.split(/[\s,;]+/).filter(Boolean);
  const out: number[] = [];
  for (const tok of tokens) {
    const v = evalSimpleNumber(tok);
    if (v === null) throw new Error(`Could not read number "${tok}".`);
    out.push(v);
  }
  return out;
}

/** Clean decimal formatter: normalizes -0 to 0, keeps exact integers clean, trims trailing zeros. */
export function fmtNum(n: number, dp = 3): string {
  if (!Number.isFinite(n)) return '—';
  const clean = Math.abs(n) < 1e-9 ? 0 : n;
  if (Math.abs(clean - Math.round(clean)) < 1e-8) return String(Math.round(clean));
  return Number(clean.toFixed(dp)).toString();
}

/** Always returns high-contrast strokes from the light variant so curves stay sharp on GeoGebra's white paper canvas. */
export function paletteColors(palette: PaletteId): string[] {
  const v = (PALETTES[palette] ?? PALETTES.catppuccin).light;
  return [v.accent, v.redox, v.acidbase, v.amph, v.ligand, v.cond, v.b1, v.b3];
}
