/* Kernel live tools for Graph Lab: plots 2D/3D GeoGebra expressions, reads exact roots/extrema/intersections,
   tests student equations against exact coordinates, and drives presets and view windows. */

import { provideKernelTools } from '../../lib/kernel/live';
import {
  fmtNum,
  parseNumbersInput,
  parsePointsInput,
  type EquationTestReport,
  type GraphAnalysis,
  type GraphMode,
  type GraphWindow,
  type LineStyle,
  type Point2D,
} from './engine';
import { GRAPH_PRESETS, type GraphPreset } from './presets';

export interface PlotExprArg {
  cmd: string;
  label?: string;
  color?: string;
  style?: LineStyle;
}

export interface GraphHost {
  getMode(): GraphMode;
  setMode(m: GraphMode): Promise<void>;
  ensureReady(): Promise<void>;
  plotExpressions(
    exprs: PlotExprArg[],
    opts?: { replace?: boolean; mode?: GraphMode; window?: Partial<GraphWindow>; analyze?: boolean },
  ): Promise<GraphAnalysis>;
  readAnalysis(includeAnalysis: boolean): Promise<GraphAnalysis>;
  clear(): void;
  setWindow(win: Partial<GraphWindow>): GraphWindow;
  testEquation(opts: {
    expression: string;
    points?: Point2D[];
    roots?: number[];
    stationary?: Point2D[];
    tolerance?: number;
    plot?: boolean;
  }): Promise<EquationTestReport>;
  loadPreset(query: string): Promise<{ preset: GraphPreset; analysis: GraphAnalysis }>;
}

const ABOUT = [
  'Graph Lab: an embedded GeoGebra 2D & 3D graphing calculator for Edexcel IAL Mathematics (P1–P4, FP1–FP3).',
  'GeoGebra syntax rules: use csc(x) (never cosec), asin/acos/atan, ln(x), e^x, pi, |x| or abs(x), Curve(x(t), y(t), t, a, b), Integral(f, a, b), Line(A, Vector(...)), Plane(...), and f(x, y) = ... in 3D.',
  'PHOTO-TO-GRAPH WORKFLOW: when the student uploads a photo of a curve, sketch or question, call graph_plot_expressions with replace: true and an appropriate window, then READ the exact GeoGebra-computed roots, y-intercept, turning points, asymptotes and intersections returned in the tool output. Compare those numbers against the photo; if any root, intercept, sign, or exponent disagrees, call graph_plot_expressions once more with the corrected equation(s) before replying.',
  'EQUATION TESTING: when checking a student\'s guessed equation against points, roots or turning points, ALWAYS call graph_test_equation so GeoGebra verifies the maths exactly rather than estimating.',
].join(' ');

export function formatAnalysis(a: GraphAnalysis): string {
  const lines: string[] = [];
  const winBits = [
    `x ∈ [${fmtNum(a.window.xmin)}, ${fmtNum(a.window.xmax)}]`,
    `y ∈ [${fmtNum(a.window.ymin)}, ${fmtNum(a.window.ymax)}]`,
    ...(a.mode === '3d' && a.window.zmin !== undefined && a.window.zmax !== undefined
      ? [`z ∈ [${fmtNum(a.window.zmin)}, ${fmtNum(a.window.zmax)}]`]
      : []),
  ];
  lines.push(`Mode: ${a.mode.toUpperCase()} | Window: ${winBits.join(', ')}`);

  if (!a.objects.length) {
    lines.push('Canvas is empty.');
    return lines.join('\n');
  }

  lines.push('Objects:');
  for (const o of a.objects) {
    const lbl = o.ggbLabels.join(', ') || '?';
    const vis = o.visible ? '' : ' [hidden]';
    if (o.error) {
      lines.push(`- ${o.cmd}: ERROR — ${o.error}`);
    } else {
      lines.push(`- [${lbl}] (${o.type}${vis}) ${o.cmd} → ${o.valueString}`);
    }
  }

  if (a.features.length) {
    lines.push('Exact 2D features:');
    for (const f of a.features) {
      const bits: string[] = [];
      if (f.derivative) bits.push(`derivative: ${f.derivative}`);
      bits.push(`y-intercept: ${f.yIntercept ? `(${fmtNum(f.yIntercept.x)}, ${fmtNum(f.yIntercept.y)})` : 'none'}`);
      bits.push(`roots: ${f.roots.length ? f.roots.map((p) => `(${fmtNum(p.x)}, ${fmtNum(p.y)})`).join(', ') : 'none in view'}`);
      if (f.extrema.length) {
        bits.push(`turning points: ${f.extrema.map((e) => `${e.kind} (${fmtNum(e.x)}, ${fmtNum(e.y)})`).join(', ')}`);
      }
      if (f.asymptotes.length) {
        bits.push(`asymptotes: ${f.asymptotes.join(', ')}`);
      }
      lines.push(`- ${f.ggbLabel}: ${bits.join(' | ')}`);
    }
  }

  if (a.intersections.length) {
    lines.push('Intersections:');
    for (const it of a.intersections) {
      lines.push(`- ${it.a} ∩ ${it.b}: ${it.points.map((p) => `(${fmtNum(p.x)}, ${fmtNum(p.y)})`).join(', ')}`);
    }
  }

  return lines.join('\n');
}

export function formatTestReport(r: EquationTestReport): string {
  if (r.parseError) return `Could not check "${r.expression}": ${r.parseError}`;
  const head = `${r.allPassed ? 'ALL PASSED' : 'MISMATCH'} (${r.passed}/${r.total}) for ${r.expression}:`;
  return [head, ...r.results.map((x) => `- [${x.pass ? 'PASS' : 'FAIL'}] ${x.message}`)].join('\n');
}

function parsePointArray(raw: unknown): Point2D[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'string') return parsePointsInput(raw);
  if (!Array.isArray(raw)) throw new Error('Expected an array of { x, y } points.');
  return raw.map((item) => {
    if (Array.isArray(item) && item.length >= 2) {
      const x = Number(item[0]), y = Number(item[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Point coordinates must be finite numbers.');
      return { x, y };
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const x = Number(o.x), y = Number(o.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Each point needs finite numbers x and y.');
      return { x, y };
    }
    throw new Error('Each point must be { x, y }.');
  });
}

function parseNumberArray(raw: unknown): number[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'string') return parseNumbersInput(raw);
  if (!Array.isArray(raw)) throw new Error('Expected an array of numbers.');
  return raw.map((v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`Expected a finite number, got ${JSON.stringify(v)}.`);
    return n;
  });
}

export function provideGraphTools(host: GraphHost): () => void {
  return provideKernelTools('graph', ABOUT, [
    {
      name: 'graph_plot_expressions',
      description: 'Plot one or more 2D or 3D GeoGebra expressions on Graph Lab (optionally replacing existing expressions and setting the window), and return the live object values and exact 2D features (roots, y-intercept, extrema, asymptotes, intersections).',
      parameters: {
        type: 'object',
        properties: {
          expressions: {
            type: 'array',
            description: 'Expressions to plot: strings like "f(x) = x^2 - 4" or objects { cmd, label?, color?, style?: "solid"|"dashed"|"dotted" }.',
            items: {
              anyOf: [
                { type: 'string' },
                {
                  type: 'object',
                  properties: {
                    cmd: { type: 'string' },
                    label: { type: 'string' },
                    color: { type: 'string' },
                    style: { type: 'string', enum: ['solid', 'dashed', 'dotted'] },
                  },
                  required: ['cmd'],
                },
              ],
            },
          },
          replace: { type: 'boolean', description: 'Replace existing expressions (default false; pass true when plotting a new graph from a photo or question).' },
          mode: { type: 'string', enum: ['2d', '3d'], description: 'Switch between 2D and 3D grapher if needed.' },
          window: {
            type: 'object',
            description: 'Optional view bounds { xmin, xmax, ymin, ymax, zmin?, zmax? }.',
            properties: {
              xmin: { type: 'number' },
              xmax: { type: 'number' },
              ymin: { type: 'number' },
              ymax: { type: 'number' },
              zmin: { type: 'number' },
              zmax: { type: 'number' },
            },
          },
          analyze: { type: 'boolean', description: 'Compute exact 2D roots, extrema, asymptotes and intersections (default true).' },
        },
        required: ['expressions'],
      },
      run: async (a) => {
        if (!Array.isArray(a.expressions) || !a.expressions.length) {
          throw new Error('Provide at least one expression in expressions.');
        }
        const exprs: PlotExprArg[] = a.expressions.map((item) => {
          if (typeof item === 'string') return { cmd: item };
          if (item && typeof item === 'object' && typeof (item as { cmd?: unknown }).cmd === 'string') {
            const o = item as Record<string, unknown>;
            const style = o.style === 'dashed' || o.style === 'dotted' || o.style === 'solid' ? o.style : undefined;
            return {
              cmd: String(o.cmd),
              ...(typeof o.label === 'string' && o.label.trim() ? { label: o.label.trim() } : {}),
              ...(typeof o.color === 'string' && /^#[0-9a-f]{6}$/i.test(o.color.trim()) ? { color: o.color.trim() } : {}),
              ...(style ? { style } : {}),
            };
          }
          throw new Error('Each item in expressions must be a command string or { cmd, label?, color?, style? }.');
        });
        const mode = a.mode === '2d' || a.mode === '3d' ? a.mode : undefined;
        const win = a.window && typeof a.window === 'object' ? (a.window as Partial<GraphWindow>) : undefined;
        const analysis = await host.plotExpressions(exprs, {
          replace: a.replace === true,
          mode,
          window: win,
          analyze: a.analyze !== false,
        });
        return formatAnalysis(analysis);
      },
    },
    {
      name: 'graph_read',
      description: 'Read what is currently plotted on Graph Lab: mode, window bounds, all expressions with their evaluated values, and (in 2D) exact roots, y-intercepts, turning points, asymptotes, derivatives and intersections.',
      parameters: {
        type: 'object',
        properties: {
          include_analysis: { type: 'boolean', description: 'Compute exact 2D features and intersections (default true).' },
        },
      },
      run: async (a) => {
        const analysis = await host.readAnalysis(a.include_analysis !== false);
        return formatAnalysis(analysis);
      },
    },
    {
      name: 'graph_clear',
      description: 'Clear all expressions from the active graph view.',
      parameters: { type: 'object', properties: {} },
      run: async () => {
        await host.ensureReady();
        host.clear();
        return `Cleared the ${host.getMode().toUpperCase()} graph.`;
      },
    },
    {
      name: 'graph_set_window',
      description: 'Set the coordinate axis bounds (xmin, xmax, ymin, ymax, and zmin/zmax in 3D).',
      parameters: {
        type: 'object',
        properties: {
          xmin: { type: 'number' },
          xmax: { type: 'number' },
          ymin: { type: 'number' },
          ymax: { type: 'number' },
          zmin: { type: 'number' },
          zmax: { type: 'number' },
        },
      },
      run: async (a) => {
        await host.ensureReady();
        const win = host.setWindow({
          ...(a.xmin !== undefined ? { xmin: Number(a.xmin) } : {}),
          ...(a.xmax !== undefined ? { xmax: Number(a.xmax) } : {}),
          ...(a.ymin !== undefined ? { ymin: Number(a.ymin) } : {}),
          ...(a.ymax !== undefined ? { ymax: Number(a.ymax) } : {}),
          ...(a.zmin !== undefined ? { zmin: Number(a.zmin) } : {}),
          ...(a.zmax !== undefined ? { zmax: Number(a.zmax) } : {}),
        });
        return `Window set to x ∈ [${fmtNum(win.xmin)}, ${fmtNum(win.xmax)}], y ∈ [${fmtNum(win.ymin)}, ${fmtNum(win.ymax)}]${
          win.zmin !== undefined && win.zmax !== undefined ? `, z ∈ [${fmtNum(win.zmin)}, ${fmtNum(win.zmax)}]` : ''
        }.`;
      },
    },
    {
      name: 'graph_set_mode',
      description: 'Switch Graph Lab between the 2D Grapher and the 3D Grapher.',
      parameters: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['2d', '3d'] },
        },
        required: ['mode'],
      },
      run: async (a) => {
        const m = String(a.mode).toLowerCase();
        if (m !== '2d' && m !== '3d') throw new Error('mode must be "2d" or "3d".');
        await host.setMode(m);
        return `Switched to the ${m.toUpperCase()} Grapher.`;
      },
    },
    {
      name: 'graph_test_equation',
      description: 'Test a student\'s equation (or an existing GeoGebra label) exactly against required points, roots, or stationary points, returning exact pass/fail differences.',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'Equation such as "y = (x-2)^2 - 1" or "x^2 + y^2 = 25", or an existing label like "f".' },
          points: {
            type: 'array',
            description: 'Points { x, y } the curve must pass through.',
            items: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
          },
          roots: {
            type: 'array',
            description: 'x-coordinates where y must equal 0.',
            items: { type: 'number' },
          },
          stationary_points: {
            type: 'array',
            description: 'Turning/stationary points { x, y } where both f(x)=y and f\'(x)=0 must hold.',
            items: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
          },
          tolerance: { type: 'number', description: 'Numeric tolerance (default 0.001).' },
          plot: { type: 'boolean', description: 'Plot the equation if it is not already on the graph.' },
        },
        required: ['expression'],
      },
      run: async (a) => {
        const expression = String(a.expression ?? '').trim();
        if (!expression) throw new Error('Provide an expression or label to test.');
        const points = parsePointArray(a.points);
        const roots = parseNumberArray(a.roots);
        const stationary = parsePointArray(a.stationary_points);
        const tolerance = a.tolerance !== undefined ? Number(a.tolerance) : undefined;
        if (tolerance !== undefined && (!Number.isFinite(tolerance) || tolerance <= 0)) {
          throw new Error('tolerance must be a positive number.');
        }
        const report = await host.testEquation({
          expression,
          points,
          roots,
          stationary,
          tolerance,
          plot: a.plot === true,
        });
        return formatTestReport(report);
      },
    },
    {
      name: 'graph_load_preset',
      description: `Load a built-in Edexcel IAL Maths preset (switches 2D/3D automatically). Presets: ${GRAPH_PRESETS.map((p) => `${p.id} (${p.unit}: ${p.title})`).join(', ')}.`,
      parameters: {
        type: 'object',
        properties: {
          preset: { type: 'string', description: 'Preset id, unit badge (e.g. "P4", "FP3"), or topic phrase (e.g. "cardioid", "planes").' },
        },
        required: ['preset'],
      },
      run: async (a) => {
        const q = String(a.preset ?? '').trim();
        if (!q) throw new Error('Specify which preset to load.');
        const { preset, analysis } = await host.loadPreset(q);
        return `Loaded preset ${preset.unit} (${preset.code}) · ${preset.title}.\n${preset.note}\n${formatAnalysis(analysis)}`;
      },
    },
  ]);
}
