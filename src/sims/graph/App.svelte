<script lang="ts">
  /* Graph Lab: Edexcel IAL Mathematics 2D & 3D graphing calculator powered by GeoGebra through GraphEngine,
     with inline sliders, P1–FP3 presets, lazy exact feature inspection, exact equation testing, live KaTeX preview,
     and Kernel AI tools. Hash routes: #2d, #3d. */
  import { onMount, tick } from 'svelte';
  import { persisted } from '../../lib/persist.svelte';
  import { glint } from '../../lib/motion';
  import { getTheme, initTheme, onTheme } from '../../lib/theme';
  import type { PaletteId } from '../../data/palettes';
  import { getAI } from '../../lib/ai';
  import { kernel, newChat, openKernel, refreshAccount, send } from '../../lib/kernel/store.svelte';
  import SimHeader from '../../components/ui/SimHeader.svelte';
  import StatusLine from '../../components/ui/StatusLine.svelte';
  import SubTabs from '../../components/ui/SubTabs.svelte';
  import {
    DEFAULT_WINDOW_2D,
    DEFAULT_WINDOW_3D,
    fmtNum,
    paletteColors,
    parseNumbersInput,
    parsePointsInput,
    type EquationTestReport,
    type ExprItem,
    type GraphAnalysis,
    type GraphMode,
    type GraphWindow,
    type LiveObject,
  } from './engine';
  import { GeoGebraEngine, preloadGeoGebra } from './geogebra';
  import { GRAPH_PRESETS, GRAPH_UNITS, matchPreset, type MathsUnitBadge } from './presets';
  import { provideGraphTools, type PlotExprArg } from './kernel';
  import { loadKatex, renderMathPreview } from './mathPreview';
  import FunctionsGuide from './FunctionsGuide.svelte';

  type SideTab = 'equations' | 'presets' | 'inspect' | 'test';
  type EngineStatus = 'loading' | 'ready' | 'error';

  const DEFAULT_2D = GRAPH_PRESETS.find((p) => p.id === 'p1-cubic')!;
  const DEFAULT_3D = GRAPH_PRESETS.find((p) => p.id === 'fp3-planes-3d')!;

  const uid = () => 'ex_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

  function presetToItems(p: typeof DEFAULT_2D, colors: string[]): ExprItem[] {
    return p.expressions.map((e, i) => ({
      id: uid(),
      cmd: e.cmd,
      ...(e.label ? { label: e.label } : {}),
      ...(e.style ? { style: e.style } : {}),
      color: colors[i % colors.length],
      visible: true,
    }));
  }

  const initColors = paletteColors('catppuccin');

  const store2d = persisted<{ items: ExprItem[]; window: GraphWindow }>('graph-exprs-2d', {
    items: presetToItems(DEFAULT_2D, initColors),
    window: { ...DEFAULT_2D.window },
  });
  const store3d = persisted<{ items: ExprItem[]; window: GraphWindow }>('graph-exprs-3d', {
    items: presetToItems(DEFAULT_3D, initColors),
    window: { ...DEFAULT_3D.window },
  });
  const score = persisted<{ right: number; total: number; streak: number; best: number }>('graph-score', {
    right: 0,
    total: 0,
    streak: 0,
    best: 0,
  });
  score.streak = 0;

  let mode = $state<GraphMode>('2d');
  let sideTab = $state<SideTab>('equations');
  let unitFilter = $state<'all' | MathsUnitBadge>('all');
  let activePresetId = $state<string | null>(null);

  let engineStatus = $state<EngineStatus>('loading');
  let engineError = $state('');
  let showGrid = $state(true);
  let showNativeTools = $state(false);
  let liveObjects = $state<LiveObject[]>([]);
  let analysis = $state<GraphAnalysis | null>(null);
  let analysisStale = $state(true);
  let analyzing = $state(false);
  let currentWindow = $state<GraphWindow>({ ...DEFAULT_2D.window });
  let notice = $state('');
  let katexReady = $state(false);

  // Equations tab inputs & live preview state
  let newCmd = $state('');
  let addInputEl = $state<HTMLInputElement>();
  let editingId = $state<string | null>(null);
  let editingVal = $state('');
  let sliderDraft = $state<Record<string, number>>({});
  let guideOpen = $state(false);

  // Test tab inputs
  let testExpr = $state('f(x) = (x + 2)(x - 1)(x - 3)');
  let testPointsRaw = $state('(0, 6)');
  let testRootsRaw = $state('-2, 1, 3');
  let testStatRaw = $state('');
  let plotCheckedPoints = $state(true);
  let testReport = $state<EquationTestReport | null>(null);
  let testInputError = $state('');

  // DOM refs
  let stageEl = $state<HTMLElement>();
  let photoInputEl = $state<HTMLInputElement>();

  const engine = new GeoGebraEngine();
  let currentPalette = $state<PaletteId>('catppuccin');
  let mountSeq = 0;
  let activeMount: Promise<void> | null = null;
  let analysisTimer: number | null = null;
  let resizeTimer: number | null = null;
  let sliderRaf: number | null = null;
  let pendingSlider: { lbl: string; val: number } | null = null;

  if (typeof window !== 'undefined') preloadGeoGebra();

  const TABS = [
    ['2d', '2D Grapher', '2D'],
    ['3d', '3D Grapher', '3D'],
  ] as const;

  const SIDE_TABS = [
    ['equations', 'Equations'],
    ['presets', 'Presets'],
    ['inspect', 'Inspect'],
    ['test', 'Test'],
  ] as const;

  const SYMBOLS = ['^2', '^3', 'sqrt(', 'pi', 'sin(', 'cos(', 'ln(', 'e^x', '|x|', '<=', '>='] as const;

  const INFO: Record<GraphMode, [string, string]> = {
    '2d': ['2D Grapher', 'Plot Edexcel P1–P4 and FP1–FP3 curves, inspect exact roots & turning points, or upload a graph photo for Kernel to plot.'],
    '3d': ['3D Grapher', 'Visualise P4 vectors and FP3 planes & surfaces in 3D space. Drag to orbit, scroll to zoom.'],
  };

  function activeStore() {
    return mode === '3d' ? store3d : store2d;
  }

  const visibleCount = $derived(activeStore().items.length);
  const liveById = $derived(new Map(liveObjects.map((o) => [o.id, o])));
  const stats = $derived<[string, string | number][]>([
    ['Plotted', visibleCount],
    ['Mode', mode.toUpperCase()],
    ['Engine', engineStatus === 'ready' ? 'GeoGebra' : engineStatus === 'loading' ? 'Loading…' : 'Offline'],
  ]);

  const activePresetTitle = $derived.by(() => {
    if (!activePresetId) return mode === '3d' ? '3D Canvas' : '2D Canvas';
    const p = GRAPH_PRESETS.find((x) => x.id === activePresetId);
    return p ? `${p.unit} · ${p.title}` : '2D Canvas';
  });

  const filteredPresets = $derived(
    GRAPH_PRESETS.filter((p) => unitFilter === 'all' || p.unit === unitFilter),
  );

  const windowReadout = $derived.by(() => {
    const w = currentWindow;
    const base = `x ∈ [${fmtNum(w.xmin, 2)}, ${fmtNum(w.xmax, 2)}], y ∈ [${fmtNum(w.ymin, 2)}, ${fmtNum(w.ymax, 2)}]`;
    return mode === '3d' && w.zmin !== undefined && w.zmax !== undefined
      ? `${base}, z ∈ [${fmtNum(w.zmin, 2)}, ${fmtNum(w.zmax, 2)}]`
      : base;
  });

  const addPreviewHtml = $derived(katexReady && newCmd.trim() ? renderMathPreview(newCmd) : '');
  const editPreviewHtml = $derived(katexReady && editingId && editingVal.trim() ? renderMathPreview(editingVal) : '');
  const testPreviewHtml = $derived(katexReady && testExpr.trim() ? renderMathPreview(testExpr) : '');

  function fromHash() {
    const h = location.hash.slice(1).toLowerCase();
    const target: GraphMode = h === '3d' ? '3d' : '2d';
    if (target !== mode) setMode(target);
  }
  fromHash();
  $effect(() => {
    const h = '#' + mode;
    if (location.hash !== h) history.replaceState(null, '', h);
  });

  $effect(() => {
    if (sideTab === 'inspect' && analysisStale && engineStatus === 'ready' && engine.ready && !analyzing) {
      const t = window.setTimeout(() => {
        if (sideTab === 'inspect' && analysisStale && engine.ready) refreshAnalysis();
      }, 0);
      return () => window.clearTimeout(t);
    }
  });

  async function mountMode(target: GraphMode): Promise<void> {
    if (!stageEl) return;
    const seq = ++mountSeq;
    mode = target;
    currentWindow = { ...(target === '3d' ? store3d : store2d).window };
    engineStatus = 'loading';
    engineError = '';

    const run = (async () => {
      const st = target === '3d' ? store3d : store2d;
      const w = stageEl!.clientWidth || 720;
      const h = stageEl!.clientHeight || 520;
      try {
        await engine.mount(stageEl!, {
          mode: target,
          width: w,
          height: h,
          showNativeTools,
          showAxes: true,
          showGrid,
          window: st.window,
        });
        if (seq !== mountSeq) return;
        engineStatus = 'ready';
        await syncExpressions();
      } catch (e) {
        if (seq !== mountSeq) return;
        engineStatus = 'error';
        engineError = e instanceof Error ? e.message : 'Could not load GeoGebra.';
      }
    })();

    activeMount = run;
    await run;
  }

  async function ensureReady(): Promise<void> {
    if (engineStatus === 'ready' && engine.ready) return;
    if (activeMount) await activeMount;
    if (!engine.ready) {
      await mountMode(mode);
    }
    if (!engine.ready) {
      throw new Error(engineError || 'GeoGebra could not initialise.');
    }
  }

  async function setMode(next: GraphMode): Promise<void> {
    if (next === mode && engine.ready && engine.mode === next) return;
    mode = next;
    sliderDraft = {};
    editingId = null;
    await tick();
    await mountMode(next);
  }

  function refreshAnalysis(): GraphAnalysis {
    analyzing = true;
    try {
      const a = engine.analyze();
      analysis = a;
      currentWindow = { ...a.window };
      analysisStale = false;
      return a;
    } finally {
      analyzing = false;
    }
  }

  async function syncExpressions(opts?: { analyze?: boolean }): Promise<GraphAnalysis> {
    const st = activeStore();
    currentWindow = { ...st.window };
    engine.setWindow(st.window);
    const objs = await engine.setExpressions(st.items);
    liveObjects = objs;
    analysisStale = true;
    if (opts?.analyze || sideTab === 'inspect') {
      return refreshAnalysis();
    }
    return { mode, window: currentWindow, objects: objs, features: [], intersections: [] };
  }

  function scheduleAnalysis() {
    if (sideTab !== 'inspect') return;
    if (analysisTimer !== null) window.clearTimeout(analysisTimer);
    analysisTimer = window.setTimeout(() => {
      analysisTimer = null;
      if (!engine.ready || sideTab !== 'inspect') return;
      refreshAnalysis();
    }, 260);
  }

  function nextColor(index: number): string {
    const cols = paletteColors(currentPalette);
    return cols[index % cols.length];
  }

  async function addExpression() {
    const cmd = newCmd.trim();
    if (!cmd) return;
    const st = activeStore();
    st.items = [
      ...st.items,
      { id: uid(), cmd, color: nextColor(st.items.length), visible: true },
    ];
    newCmd = '';
    activePresetId = null;
    await syncExpressions();
  }

  function insertSymbol(sym: string) {
    if (!addInputEl) {
      newCmd += sym;
      return;
    }
    const start = addInputEl.selectionStart ?? newCmd.length;
    const end = addInputEl.selectionEnd ?? newCmd.length;
    newCmd = newCmd.slice(0, start) + sym + newCmd.slice(end);
    tick().then(() => {
      if (!addInputEl) return;
      addInputEl.focus();
      const pos = start + sym.length;
      addInputEl.setSelectionRange(pos, pos);
    });
  }

  async function commitEdit(id: string, nextVal: string) {
    if (editingId === id) {
      editingId = null;
      editingVal = '';
    }
    const trimmed = nextVal.trim();
    const st = activeStore();
    const idx = st.items.findIndex((x) => x.id === id);
    if (idx < 0) return;
    if (!trimmed) {
      await removeItem(id);
      return;
    }
    if (st.items[idx].cmd === trimmed) return;
    st.items[idx].cmd = trimmed;
    activePresetId = null;
    await syncExpressions();
  }

  function cycleColor(id: string) {
    const cols = paletteColors(currentPalette);
    const st = activeStore();
    const item = st.items.find((x) => x.id === id);
    if (!item) return;
    const idx = cols.findIndex((c) => c.toLowerCase() === (item.color ?? '').toLowerCase());
    const next = cols[(idx + 1) % cols.length];
    item.color = next;
    engine.setColor(id, next);
  }

  function toggleVisible(id: string) {
    const st = activeStore();
    const item = st.items.find((x) => x.id === id);
    if (!item) return;
    item.visible = item.visible === false;
    engine.setVisible(id, item.visible !== false);
    analysisStale = true;
    scheduleAnalysis();
  }

  async function removeItem(id: string) {
    const st = activeStore();
    st.items = st.items.filter((x) => x.id !== id);
    if (editingId === id) {
      editingId = null;
      editingVal = '';
    }
    activePresetId = null;
    await syncExpressions();
  }

  function onSliderInput(obj: LiveObject, val: number) {
    const lbl = obj.ggbLabels[0];
    if (!lbl || !Number.isFinite(val)) return;
    sliderDraft[obj.id] = val;
    pendingSlider = { lbl, val };
    if (sliderRaf === null) {
      sliderRaf = requestAnimationFrame(() => {
        sliderRaf = null;
        if (!pendingSlider) return;
        const p = pendingSlider;
        pendingSlider = null;
        engine.setNumericValue(p.lbl, p.val, false);
      });
    }
  }

  function onSliderCommit(obj: LiveObject, val: number) {
    const lbl = obj.ggbLabels[0];
    if (!lbl || !Number.isFinite(val)) return;
    if (sliderRaf !== null) {
      cancelAnimationFrame(sliderRaf);
      sliderRaf = null;
    }
    pendingSlider = null;
    engine.setNumericValue(lbl, val, true);
    const st = activeStore();
    const item = st.items.find((x) => x.id === obj.id);
    if (item) {
      item.cmd = `${lbl} = ${fmtNum(val, 4)}`;
    }
    delete sliderDraft[obj.id];
    analysisStale = true;
    scheduleAnalysis();
  }

  function toggleGrid() {
    showGrid = !showGrid;
    engine.setAxesAndGrid(true, showGrid);
  }

  function toggleNativeTools() {
    showNativeTools = !showNativeTools;
    engine.setNativeTools(showNativeTools);
  }

  function applyWindow(win: Partial<GraphWindow>) {
    const st = activeStore();
    const cur = engine.ready ? engine.getWindow() : st.window;
    const merged: GraphWindow = { ...cur, ...win };
    if (merged.xmin >= merged.xmax || merged.ymin >= merged.ymax) return st.window;
    st.window = merged;
    currentWindow = { ...merged };
    engine.setWindow(merged);
    analysisStale = true;
    if (engine.ready && sideTab === 'inspect') refreshAnalysis();
    return merged;
  }

  function resetView() {
    const base = mode === '3d' ? { ...DEFAULT_WINDOW_3D } : { ...DEFAULT_WINDOW_2D };
    applyWindow(base);
  }

  function clearCanvas() {
    const st = activeStore();
    st.items = [];
    sliderDraft = {};
    editingId = null;
    activePresetId = null;
    engine.clear();
    liveObjects = [];
    analysisStale = true;
    if (sideTab === 'inspect') refreshAnalysis();
    else analysis = null;
  }

  function exportPng() {
    const url = engine.snapshot(2);
    if (!url) {
      notice = 'Could not export PNG while GeoGebra is loading.';
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `graph-lab-${mode}.png`;
    a.click();
  }

  async function loadPresetById(id: string) {
    const p = GRAPH_PRESETS.find((x) => x.id === id);
    if (!p) return;
    const cols = paletteColors(currentPalette);
    const st = p.mode === '3d' ? store3d : store2d;
    st.items = presetToItems(p, cols);
    st.window = { ...p.window };
    sliderDraft = {};
    editingId = null;
    activePresetId = p.id;
    if (p.mode !== mode) {
      await setMode(p.mode);
    } else {
      await ensureReady();
      await syncExpressions();
    }
  }

  async function plotKeyPoints() {
    if (!analysis || !analysis.features.length) return;
    const st = activeStore();
    const cols = paletteColors(currentPalette);
    const additions: ExprItem[] = [];
    let k = st.items.length;

    const existingCmds = new Set(st.items.map((x) => x.cmd.replace(/\s+/g, '')));
    const addPt = (x: number, y: number, label: string) => {
      const cmd = `(${fmtNum(x, 4)}, ${fmtNum(y, 4)})`;
      if (existingCmds.has(cmd.replace(/\s+/g, ''))) return;
      existingCmds.add(cmd.replace(/\s+/g, ''));
      additions.push({ id: uid(), cmd, label, color: cols[k++ % cols.length], visible: true });
    };

    for (const f of analysis.features) {
      if (f.yIntercept) addPt(f.yIntercept.x, f.yIntercept.y, `${f.ggbLabel} y-int`);
      for (const r of f.roots) addPt(r.x, r.y, `root (${fmtNum(r.x, 2)}, 0)`);
      for (const e of f.extrema) addPt(e.x, e.y, `${e.kind} (${fmtNum(e.x, 2)}, ${fmtNum(e.y, 2)})`);
    }
    for (const it of analysis.intersections) {
      for (const p of it.points) addPt(p.x, p.y, `${it.a}∩${it.b}`);
    }

    if (!additions.length) {
      notice = 'Key points are already plotted.';
      return;
    }
    st.items = [...st.items, ...additions];
    await syncExpressions();
  }

  function insertFromGuide(cmd: string) {
    sideTab = 'equations';
    newCmd = cmd;
    tick().then(() => {
      if (!addInputEl) return;
      addInputEl.focus();
      addInputEl.setSelectionRange(cmd.length, cmd.length);
    });
  }

  async function plotFromGuide(cmds: string[], targetMode: GraphMode) {
    const cols = paletteColors(currentPalette);
    const st = targetMode === '3d' ? store3d : store2d;
    const baseLen = st.items.length;
    const added: ExprItem[] = cmds.map((cmd, idx) => ({
      id: uid(),
      cmd,
      color: cols[(baseLen + idx) % cols.length],
      visible: true,
    }));
    st.items = [...st.items, ...added];
    activePresetId = null;
    sideTab = 'equations';
    if (targetMode !== mode) {
      await setMode(targetMode);
    } else {
      await ensureReady();
      await syncExpressions();
    }
  }

  async function runEquationTest() {
    testInputError = '';
    try {
      const points = parsePointsInput(testPointsRaw);
      const roots = parseNumbersInput(testRootsRaw);
      const stationary = parsePointsInput(testStatRaw);
      await ensureReady();
      const rep = engine.testEquation(testExpr, { points, roots, stationary });
      testReport = rep;
      if (rep.parseError) {
        testInputError = rep.parseError;
        return;
      }

      score.total++;
      if (rep.allPassed) {
        score.right++;
        score.streak++;
        score.best = Math.max(score.best, score.streak);
      } else {
        score.streak = 0;
      }

      if (plotCheckedPoints && mode === '2d') {
        const cols = paletteColors(currentPalette);
        const st = store2d;
        const passColor = cols[2] ?? '#40a02b';
        const failColor = cols[1] ?? '#d20f39';
        const kept = st.items.filter((x) => !x.label?.startsWith('Check:'));
        const nextItems = [...kept];
        if (!kept.some((x) => x.cmd.trim() === testExpr.trim()) && !liveObjects.some((o) => o.ggbLabels.includes(testExpr.trim()))) {
          nextItems.push({ id: uid(), cmd: testExpr.trim(), color: cols[0], visible: true });
        }
        for (const r of rep.results) {
          nextItems.push({
            id: uid(),
            cmd: `(${fmtNum(r.point.x, 4)}, ${fmtNum(r.point.y, 4)})`,
            label: `Check: ${r.pass ? '✓' : '✗'} (${fmtNum(r.point.x, 2)}, ${fmtNum(r.point.y, 2)})`,
            color: r.pass ? passColor : failColor,
            visible: true,
          });
        }
        st.items = nextItems;
        await syncExpressions();
      }
    } catch (e) {
      testInputError = e instanceof Error ? e.message : 'Invalid target values.';
    }
  }

  /* ---------- Kernel AI actions ---------- */

  async function isKernelReady(): Promise<boolean> {
    const ai = getAI();
    if (ai.provider === 'gemini') return !!ai.geminiKey;
    if (kernel.user === undefined) await refreshAccount();
    return kernel.user !== null && kernel.user !== undefined;
  }

  const PHOTO_PROMPT = [
    'Look at the graph or sketch in this photo and plot it in Graph Lab using graph_plot_expressions (with replace: true and an appropriate window).',
    'Read the exact roots, y-intercept, turning points, asymptotes or intersections returned by GeoGebra, compare them against the photo, and if anything disagrees call graph_plot_expressions once more to fix it.',
    'Then state the final equation(s) and key features clearly.',
  ].join(' ');

  async function onPickPhoto(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!f) return;
    notice = '';
    const ready = await isKernelReady();
    openKernel('chat');
    if (!ready) {
      notice = 'Sign in to Puter (or add your Gemini key) in Kernel, then pick your photo again.';
      return;
    }
    newChat();
    send(PHOTO_PROMPT, f);
  }

  async function askKernelExplain() {
    notice = '';
    const ready = await isKernelReady();
    openKernel('chat');
    if (!ready) {
      notice = 'Sign in to Puter (or add your Gemini key) in Kernel first to ask for an explanation.';
      return;
    }
    newChat();
    send('Read what is plotted on Graph Lab with graph_read and explain the curves, roots, turning points, asymptotes or intersections for Edexcel IAL Maths.');
  }

  async function askKernelHintForTest() {
    if (!testReport) return;
    notice = '';
    const ready = await isKernelReady();
    openKernel('chat');
    if (!ready) {
      notice = 'Sign in to Puter (or add your Gemini key) in Kernel first.';
      return;
    }
    const failures = testReport.results.filter((r) => !r.pass).map((r) => r.message).join(' ');
    newChat();
    send(`I am testing my equation "${testExpr}" in Graph Lab. GeoGebra reported: ${failures} Give me a hint on how to adjust my equation without giving the full answer straight away.`);
  }

  /* ---------- Host object for Kernel live tools ---------- */
  const kernelTools = () => provideGraphTools({
    getMode: () => mode,
    setMode,
    ensureReady,
    plotExpressions: async (exprs: PlotExprArg[], opts) => {
      const targetMode = opts?.mode ?? mode;
      if (targetMode !== mode) await setMode(targetMode);
      else await ensureReady();

      const st = targetMode === '3d' ? store3d : store2d;
      const cols = paletteColors(currentPalette);
      const base = opts?.replace ? [] : [...st.items];
      let cIdx = base.length;
      const added: ExprItem[] = exprs.map((e) => ({
        id: uid(),
        cmd: e.cmd,
        ...(e.label ? { label: e.label } : {}),
        ...(e.style ? { style: e.style } : {}),
        color: e.color ?? cols[cIdx++ % cols.length],
        visible: true,
      }));
      st.items = [...base, ...added];
      if (opts?.window) {
        st.window = { ...st.window, ...opts.window };
      }
      sliderDraft = {};
      editingId = null;
      activePresetId = null;
      const a = await syncExpressions({ analyze: opts?.analyze !== false });
      sideTab = 'equations';
      return a;
    },
    readAnalysis: async (includeAnalysis) => {
      await ensureReady();
      if (!includeAnalysis) {
        const w = engine.getWindow();
        currentWindow = { ...w };
        return {
          mode,
          window: w,
          objects: engine.getExpressions(),
          features: [],
          intersections: [],
        };
      }
      return refreshAnalysis();
    },
    clear: () => clearCanvas(),
    setWindow: (win) => applyWindow(win),
    testEquation: async (opts) => {
      await ensureReady();
      const rep = engine.testEquation(opts.expression, {
        points: opts.points,
        roots: opts.roots,
        stationary: opts.stationary,
        tolerance: opts.tolerance,
      });
      if (opts.plot && !rep.parseError) {
        const st = activeStore();
        const cols = paletteColors(currentPalette);
        if (!st.items.some((x) => x.cmd.trim() === opts.expression.trim()) && !liveObjects.some((o) => o.ggbLabels.includes(opts.expression.trim()))) {
          st.items = [...st.items, { id: uid(), cmd: opts.expression.trim(), color: cols[st.items.length % cols.length], visible: true }];
          await syncExpressions();
        }
      }
      testExpr = opts.expression;
      testReport = rep;
      return rep;
    },
    loadPreset: async (query) => {
      const hit = matchPreset(query);
      if (!hit) {
        throw new Error(`No preset matches "${query}". Available: ${GRAPH_PRESETS.map((p) => `${p.id} (${p.unit}: ${p.title})`).join(', ')}.`);
      }
      await loadPresetById(hit.id);
      const a = refreshAnalysis();
      return { preset: hit, analysis: a };
    },
  });

  onMount(() => {
    initTheme();
    currentPalette = getTheme().palette;
    loadKatex().then(() => { katexReady = true; }).catch(() => {});

    addEventListener('hashchange', fromHash);
    glint('.gl-two .side');

    const offEngine = engine.onChange((objs, external) => {
      liveObjects = objs;
      analysisStale = true;
      if (external) {
        const st = activeStore();
        const prevById = new Map(st.items.map((x) => [x.id, x]));
        const nextDrafts = { ...sliderDraft };
        for (const o of objs) {
          if (o.type !== 'numeric' || !o.slider || o.id in nextDrafts) delete nextDrafts[o.id];
        }
        sliderDraft = nextDrafts;
        st.items = objs.map((o) => {
          const prev = prevById.get(o.id);
          return {
            id: o.id,
            cmd: o.cmd,
            ...(o.label ? { label: o.label } : {}),
            ...(prev?.style ? { style: prev.style } : {}),
            color: o.color,
            visible: o.visible,
          };
        });
        if (editingId && !objs.some((o) => o.id === editingId)) {
          editingId = null;
          editingVal = '';
        }
      }
      scheduleAnalysis();
    });

    const offTheme = onTheme((t) => {
      if (t.palette === currentPalette) return;
      const oldCols = paletteColors(currentPalette);
      const newCols = paletteColors(t.palette);
      currentPalette = t.palette;

      const remap = (items: ExprItem[]) => items.map((it, idx) => {
        const oldIdx = oldCols.findIndex((c) => c.toLowerCase() === (it.color ?? '').toLowerCase());
        const nextHex = oldIdx >= 0 ? newCols[oldIdx % newCols.length] : newCols[idx % newCols.length];
        return { ...it, color: nextHex };
      });
      store2d.items = remap(store2d.items);
      store3d.items = remap(store3d.items);
      if (engine.ready) syncExpressions();
    });

    let ro: ResizeObserver | null = null;
    if (stageEl && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver((entries) => {
        const r = entries[0]?.contentRect;
        if (!r || r.width < 100 || r.height < 100) return;
        if (resizeTimer !== null) window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
          resizeTimer = null;
          engine.resize(r.width, r.height);
        }, 160);
      });
      ro.observe(stageEl);
    }

    const unprovide = kernelTools();
    mountMode(mode);

    return () => {
      removeEventListener('hashchange', fromHash);
      if (analysisTimer !== null) window.clearTimeout(analysisTimer);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      if (sliderRaf !== null) cancelAnimationFrame(sliderRaf);
      ro?.disconnect();
      offEngine();
      offTheme();
      unprovide();
      engine.destroy();
    };
  });
</script>

{#snippet twinkle()}
  <svg class="gl-twinkle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" />
  </svg>
{/snippet}

<SimHeader
  title="Graph Lab"
  eyebrow="Edexcel IAL Mathematics · P1–P4 & FP1–FP3 · 2D & 3D graphing with Kernel AI"
  back={{ href: '/maths/', label: 'Arsenal' }}
  tabs={TABS}
  value={mode}
  onselect={(m) => setMode(m)}
/>
<StatusLine label={INFO[mode][0]} hint={INFO[mode][1]} {stats} />

<div class="layout gl-two">
  <section class="panel stage" aria-label="Graph canvas">
    <div class="stage-head">
      <div class="label-chip">
        {activePresetTitle}
        <small>{mode === '3d' ? '3D space' : 'Cartesian 2D'}</small>
      </div>
      <div class="stage-tools">
        <button type="button" class="btn sm primary" title="Plot a graph from a photo using Kernel AI" onclick={() => photoInputEl?.click()}>{@render twinkle()}Plot from photo</button>
        <input bind:this={photoInputEl} type="file" accept="image/*" hidden onchange={onPickPhoto} />
        <button type="button" class="btn sm" title="Explain this graph using Kernel AI" onclick={askKernelExplain}>{@render twinkle()}Explain</button>
        <button type="button" class="btn sm" class:active={showGrid} aria-pressed={showGrid} onclick={toggleGrid}>Grid</button>
        <button type="button" class="btn sm" class:active={showNativeTools} aria-pressed={showNativeTools} onclick={toggleNativeTools}>GGB tools</button>
        <button type="button" class="btn sm" onclick={resetView}>Reset view</button>
        <button type="button" class="btn sm" onclick={exportPng}>PNG</button>
        <button type="button" class="btn sm" onclick={clearCanvas}>Clear</button>
      </div>
    </div>

    <div class="gl-stage-wrap">
      <div class="gl-ggb" bind:this={stageEl}></div>
      {#if engineStatus === 'loading'}
        <div class="gl-overlay" role="status" aria-live="polite">
          <span class="gl-spin" aria-hidden="true"></span>
          <b>Loading GeoGebra {mode.toUpperCase()}…</b>
          <p>Fetching the interactive calculator engine. First load needs an internet connection.</p>
        </div>
      {:else if engineStatus === 'error'}
        <div class="gl-overlay" role="alert">
          <b>GeoGebra couldn’t load</b>
          <p>{engineError || 'Check your connection or content blocker and try again.'}</p>
          <button type="button" class="btn primary" onclick={() => mountMode(mode)}>Retry</button>
        </div>
      {/if}
    </div>

    {#if notice}
      <div class="gl-notice" role="status">
        <span>{notice}</span>
        <button type="button" aria-label="Dismiss notice" onclick={() => (notice = '')}>×</button>
      </div>
    {/if}

    <div class="gl-foot">
      <span class="gl-win">{windowReadout}</span>
      <div class="gl-qwin">
        {#if mode === '2d'}
          <button type="button" class="btn sm" onclick={() => applyWindow({ xmin: -5, xmax: 5, ymin: -5, ymax: 5 })}>±5</button>
          <button type="button" class="btn sm" onclick={() => applyWindow({ xmin: -10, xmax: 10, ymin: -10, ymax: 10 })}>±10</button>
          <button type="button" class="btn sm" onclick={() => applyWindow({ xmin: -6.5, xmax: 6.5, ymin: -3, ymax: 3 })}>±2π</button>
        {:else}
          <button type="button" class="btn sm" onclick={() => applyWindow({ xmin: -6, xmax: 6, ymin: -6, ymax: 6, zmin: -5, zmax: 5 })}>±6</button>
          <button type="button" class="btn sm" onclick={() => applyWindow({ xmin: -10, xmax: 10, ymin: -10, ymax: 10, zmin: -8, zmax: 8 })}>±10</button>
        {/if}
      </div>
      <span class="gl-attrib">Powered by <a href="https://www.geogebra.org" target="_blank" rel="noopener noreferrer">GeoGebra</a></span>
    </div>
  </section>

  <aside class="panel side" aria-label="Graph controls">
    <div class="ph">
      <h2>Graph Controls</h2>
      <div class="gl-ph-right">
        <span class="score">{mode.toUpperCase()} · {visibleCount} item{visibleCount === 1 ? '' : 's'}</span>
        <button type="button" class="btn sm" onclick={() => (guideOpen = true)}>Functions</button>
      </div>
    </div>

    <div class="gl-side-tabs">
      <SubTabs label="Control tabs" options={SIDE_TABS} bind:value={sideTab} />
    </div>

    {#if sideTab === 'equations'}
      <div class="gl-body">
        <form class="gl-add" onsubmit={(e) => { e.preventDefault(); addExpression(); }}>
          <input
            bind:this={addInputEl}
            class="gl-inp"
            type="text"
            bind:value={newCmd}
            placeholder={mode === '3d' ? 'e.g. z = x^2 - y^2 or Plane(...)' : 'e.g. f(x) = x^2 - 4, (x-1)^2+y^2=9'}
            aria-label="New equation or GeoGebra command"
          />
          <button type="submit" class="btn primary sm" disabled={!newCmd.trim()}>Plot</button>
        </form>

        {#if addPreviewHtml}
          <div class="gl-preview" aria-live="polite">
            <span class="gl-preview-lbl">Preview</span>
            <span class="gl-preview-math">{@html addPreviewHtml}</span>
          </div>
        {/if}

        <div class="gl-syms" aria-label="Quick math symbols">
          {#each SYMBOLS as sym (sym)}
            <button type="button" class="gl-sym" onclick={() => insertSymbol(sym)}>{sym}</button>
          {/each}
          <button type="button" class="gl-sym more" onclick={() => (guideOpen = true)}>All functions…</button>
        </div>

        {#if activeStore().items.length}
          <ul class="gl-exprs">
            {#each activeStore().items as item, idx (item.id)}
              {@const live = liveById.get(item.id)}
              <li class="gl-expr" class:hidden={item.visible === false} class:has-err={!!live?.error}>
                <div class="gl-expr-top">
                  <button
                    type="button"
                    class="gl-swatch"
                    class:off={item.visible === false}
                    style:background={item.color ?? nextColor(idx)}
                    aria-label="Cycle curve colour"
                    title="Cycle colour"
                    onclick={() => cycleColor(item.id)}
                  ></button>
                  <input
                    class="gl-inp sm"
                    type="text"
                    value={item.cmd}
                    aria-label={`Edit expression ${idx + 1}`}
                    onfocus={(e) => { editingId = item.id; editingVal = e.currentTarget.value; }}
                    oninput={(e) => { editingId = item.id; editingVal = e.currentTarget.value; }}
                    onkeydown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitEdit(item.id, e.currentTarget.value);
                      }
                    }}
                    onblur={(e) => commitEdit(item.id, e.currentTarget.value)}
                  />
                  <button
                    type="button"
                    class="gl-icon-btn"
                    aria-label={item.visible === false ? 'Show expression' : 'Hide expression'}
                    title={item.visible === false ? 'Show' : 'Hide'}
                    onclick={() => toggleVisible(item.id)}
                  >
                    {item.visible === false ? '○' : '●'}
                  </button>
                  <button
                    type="button"
                    class="gl-icon-btn del"
                    aria-label="Delete expression"
                    title="Delete"
                    onclick={() => removeItem(item.id)}
                  >×</button>
                </div>

                {#if editingId === item.id && editPreviewHtml}
                  <div class="gl-preview" aria-live="polite">
                    <span class="gl-preview-lbl">Preview</span>
                    <span class="gl-preview-math">{@html editPreviewHtml}</span>
                  </div>
                {/if}

                {#if live?.error}
                  <div class="gl-expr-err">{live.error}</div>
                {:else if live && live.type === 'numeric' && live.slider && live.ggbLabels[0]}
                  {@const lbl = live.ggbLabels[0]}
                  {@const v = sliderDraft[item.id] ?? live.numericValue ?? 0}
                  <div class="gl-slider-row">
                    <input
                      class="slider"
                      type="range"
                      min={live.slider.min}
                      max={live.slider.max}
                      step={live.slider.step}
                      value={v}
                      aria-label={`Slider ${lbl}`}
                      oninput={(e) => onSliderInput(live, Number(e.currentTarget.value))}
                      onchange={(e) => onSliderCommit(live, Number(e.currentTarget.value))}
                    />
                    <b>{lbl} = {fmtNum(v, 2)}</b>
                  </div>
                {:else if live?.valueString}
                  <div class="gl-expr-meta">
                    <span class="gl-expr-val">{live.valueString}</span>
                    <span>{live.type}</span>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {:else}
          <p class="muted">No expressions yet. Type an equation above, choose a preset, or upload a photo for Kernel to plot.</p>
        {/if}
      </div>

    {:else if sideTab === 'presets'}
      <div class="gl-body">
        <div class="gl-ufilter" role="group" aria-label="Filter presets by unit">
          <button type="button" class="fchip" aria-pressed={unitFilter === 'all'} onclick={() => (unitFilter = 'all')}>All</button>
          {#each GRAPH_UNITS as u (u)}
            <button type="button" class="fchip" aria-pressed={unitFilter === u} onclick={() => (unitFilter = u)}>{u}</button>
          {/each}
        </div>

        <div class="gl-presets">
          {#each filteredPresets as p (p.id)}
            <button
              type="button"
              class="gl-preset"
              class:active={activePresetId === p.id}
              onclick={() => loadPresetById(p.id)}
            >
              <div class="gl-preset-top">
                <span class="gl-ubadge">{p.unit}</span>
                {#if p.mode === '3d'}<span class="gl-3dbadge">3D</span>{/if}
                <b>{p.title}</b>
              </div>
              <small>{p.note}</small>
            </button>
          {/each}
        </div>
      </div>

    {:else if sideTab === 'inspect'}
      <div class="gl-body">
        <div class="gl-insp-head">
          <span class="muted">{analyzing ? 'Analysing with GeoGebra…' : 'Computed directly by GeoGebra'}</span>
          <div class="gl-qwin">
            {#if mode === '2d' && analysis?.features.length}
              <button type="button" class="btn sm" onclick={plotKeyPoints}>Plot key points</button>
            {/if}
            <button type="button" class="btn sm" onclick={() => engine.ready && refreshAnalysis()}>Refresh</button>
          </div>
        </div>

        {#if mode === '3d'}
          <p class="muted">Root, turning-point and asymptote extraction runs on 2D functions. Current 3D objects:</p>
          {#if liveObjects.length}
            {#each liveObjects as obj (obj.id)}
              <div class="gl-fcard">
                <h3>{obj.ggbLabels[0] ?? 'Object'} · {obj.type}</h3>
                <dl class="gl-frows">
                  <dt>Input</dt><dd>{obj.cmd}</dd>
                  <dt>Value</dt><dd>{obj.valueString || '—'}</dd>
                </dl>
              </div>
            {/each}
          {:else}
            <p class="muted">Nothing plotted in 3D yet.</p>
          {/if}
        {:else if analysis && analysis.features.length}
          {#each analysis.features as feat (feat.id)}
            <div class="gl-fcard">
              <h3>{feat.ggbLabel} · {feat.cmd}</h3>
              <dl class="gl-frows">
                {#if feat.derivative}
                  <dt>Derivative</dt><dd>{feat.derivative}</dd>
                {/if}
                <dt>y-intercept</dt>
                <dd>{feat.yIntercept ? `(0, ${fmtNum(feat.yIntercept.y, 4)})` : 'None'}</dd>
                <dt>Roots</dt>
                <dd>{feat.roots.length ? feat.roots.map((r) => `(${fmtNum(r.x, 3)}, 0)`).join(', ') : 'None in view'}</dd>
                <dt>Turning pts</dt>
                <dd>{feat.extrema.length ? feat.extrema.map((e) => `${e.kind} (${fmtNum(e.x, 3)}, ${fmtNum(e.y, 3)})`).join(', ') : 'None in view'}</dd>
                {#if feat.asymptotes.length}
                  <dt>Asymptotes</dt><dd>{feat.asymptotes.join(', ')}</dd>
                {/if}
              </dl>
            </div>
          {/each}

          {#if analysis.intersections.length}
            <div class="gl-fcard">
              <h3>Intersections</h3>
              <dl class="gl-frows">
                {#each analysis.intersections as it (`${it.a}-${it.b}`)}
                  <dt>{it.a} ∩ {it.b}</dt>
                  <dd>{it.points.map((p) => `(${fmtNum(p.x, 3)}, ${fmtNum(p.y, 3)})`).join(', ')}</dd>
                {/each}
              </dl>
            </div>
          {/if}
        {:else}
          <p class="muted">Plot an explicit 2D function like <code>f(x) = x^3 - 3x</code> to inspect exact derivatives, roots, turning points and asymptotes.</p>
        {/if}
      </div>

    {:else}
      <div class="gl-body">
        <p class="muted">Check your equation against exact coordinates, roots, or stationary points from an exam question. GeoGebra evaluates the match exactly.</p>

        <div class="gl-field">
          <label for="gl-test-expr">Your equation or plotted label</label>
          <input
            id="gl-test-expr"
            class="gl-inp"
            type="text"
            bind:value={testExpr}
            placeholder="e.g. y = (x - 2)^2 - 1 or x^2 + y^2 = 25"
          />
          {#if testPreviewHtml}
            <div class="gl-preview" aria-live="polite">
              <span class="gl-preview-lbl">Preview</span>
              <span class="gl-preview-math">{@html testPreviewHtml}</span>
            </div>
          {/if}
          {#if mode === '2d' && liveObjects.some((o) => !o.error && o.ggbLabels[0] && o.type !== 'numeric')}
            <div class="gl-picks">
              {#each liveObjects.filter((o) => !o.error && o.ggbLabels[0] && o.type !== 'numeric') as o (o.id)}
                <button type="button" class="gl-sym" onclick={() => (testExpr = o.cmd)}>Use {o.ggbLabels[0]}</button>
              {/each}
            </div>
          {/if}
        </div>

        <div class="gl-field">
          <label for="gl-test-pts">Points it must pass through</label>
          <input
            id="gl-test-pts"
            class="gl-inp sm"
            type="text"
            bind:value={testPointsRaw}
            placeholder="e.g. (0, 6), (2, -4)"
          />
        </div>

        <div class="gl-field">
          <label for="gl-test-roots">Roots (x-intercepts)</label>
          <input
            id="gl-test-roots"
            class="gl-inp sm"
            type="text"
            bind:value={testRootsRaw}
            placeholder="e.g. -2, 1, 3"
          />
        </div>

        <div class="gl-field">
          <label for="gl-test-stat">Stationary points (f(x)=y and f′(x)=0)</label>
          <input
            id="gl-test-stat"
            class="gl-inp sm"
            type="text"
            bind:value={testStatRaw}
            placeholder="e.g. (1, -2)"
          />
        </div>

        <label class="gl-check">
          <input type="checkbox" bind:checked={plotCheckedPoints} />
          Plot target points on graph
        </label>

        <div class="gl-insp-head">
          <button type="button" class="btn primary" onclick={runEquationTest}>Check equation</button>
          <span class="score">Checks: <b>{score.right}/{score.total}</b></span>
        </div>

        {#if testInputError}
          <p class="gl-expr-err" role="alert">{testInputError}</p>
        {/if}

        {#if testReport && !testReport.parseError}
          <div class="gl-results">
            <div class="gl-rsum" class:ok={testReport.allPassed} class:no={!testReport.allPassed}>
              {testReport.allPassed ? 'All checks passed' : `${testReport.passed}/${testReport.total} passed`}
            </div>
            {#each testReport.results as r, i (i)}
              <div class="gl-rbox" class:ok={r.pass} class:no={!r.pass}>{r.message}</div>
            {/each}
            {#if !testReport.allPassed}
              <button type="button" class="btn sm" title="Ask Kernel AI for a hint" onclick={askKernelHintForTest}>{@render twinkle()}Ask Kernel for a hint</button>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </aside>
</div>

<FunctionsGuide bind:open={guideOpen} oninsert={insertFromGuide} onplot={plotFromGuide} />
