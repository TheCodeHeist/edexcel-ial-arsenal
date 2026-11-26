<script lang="ts">
  /* Decision Lab: Edexcel IAL Mathematics D1 (WDM11). Every algorithm in the spec, stepped through the way the mark
     scheme wants it written, with "Quiz me" to predict each step. Tabs with hash routes:
     #sort #bins #trees #dijkstra #routes #cpa #lp #practice. */
  import { onMount, tick } from 'svelte';
  import { persisted } from '../../lib/persist.svelte';
  import { glint, fadeIn } from '../../lib/motion';
  import { RM } from '../../lib/util';
  import SimHeader from '../../components/ui/SimHeader.svelte';
  import StatusLine from '../../components/ui/StatusLine.svelte';
  import Sorting, { SORT_PREFS, type SortPrefs } from './Sorting.svelte';
  import Bins, { BIN_PREFS, type BinPrefs } from './Bins.svelte';
  import Trees, { TREE_PREFS, type TreePrefs } from './Trees.svelte';
  import Dijkstra, { DIJ_PREFS, type DijPrefs } from './Dijkstra.svelte';
  import Routes, { ROUTE_PREFS, type RoutePrefs } from './Routes.svelte';
  import Critical, { CPA_PREFS, type CpaPrefs } from './Critical.svelte';
  import Linear, { LP_PREFS, type LpPrefs } from './Linear.svelte';
  import Practice, { type PScore } from './Practice.svelte';
  import { TOPICS, type Topic } from './practice';
  import { provideKernelTools } from '../../lib/kernel/live';
  import type { Graph } from './graph';
  import type { Project } from './cpa';
  import { optimum, range, objective, type LP } from './lp';
  import {
    matchDecisionMode, parseNumberList, buildCustomGraph, buildCustomProject, parseConstraint,
    formatSort, formatBins, formatTrees, formatDijkstra, formatInspection, formatTSP, formatCPA, formatLP,
    GRAPH_PRESETS, CPA_PROJECTS, LP_PRESETS, type DecisionMode,
  } from './kernel';

  type Mode = 'sort' | 'bins' | 'trees' | 'dijkstra' | 'routes' | 'cpa' | 'lp' | 'practice';
  type Stats = [string, string | number][];

  const sortP = persisted<SortPrefs>('decision-sort', SORT_PREFS);
  const binP = persisted<BinPrefs>('decision-bins', BIN_PREFS);
  const treeP = persisted<TreePrefs>('decision-trees', TREE_PREFS);
  const dijP = persisted<DijPrefs>('decision-dijkstra', DIJ_PREFS);
  const routeP = persisted<RoutePrefs>('decision-routes', ROUTE_PREFS);
  const cpaP = persisted<CpaPrefs>('decision-cpa', CPA_PREFS);
  const lpP = persisted<LpPrefs>('decision-lp', LP_PREFS);
  const score = persisted<PScore>('decision-score', { right: 0, total: 0, streak: 0, best: 0 });
  const topic = persisted<{ t: Topic | 'all' }>('decision-topic', { t: 'all' });
  score.streak = 0;

  // "Quiz me" answers in the steppers count towards the same score as Practice
  function onscore(ok: boolean) {
    score.total++;
    if (ok) { score.right++; score.streak++; score.best = Math.max(score.best, score.streak); } else score.streak = 0;
  }

  let mode = $state<Mode>('sort');
  const views: Record<Mode, HTMLElement | undefined> = $state({ sort: undefined, bins: undefined, trees: undefined, dijkstra: undefined, routes: undefined, cpa: undefined, lp: undefined, practice: undefined });
  let sortRef = $state<Sorting>(), binRef = $state<Bins>(), treeRef = $state<Trees>();
  let dijRef = $state<Dijkstra>(), routeRef = $state<Routes>(), cpaRef = $state<Critical>();
  let customGraph = $state<Graph | null>(null);
  let customProject = $state<Project | null>(null);

  const TABS = [
    ['sort', 'Sort & search', 'Sort'],
    ['bins', 'Bin packing', 'Bins'],
    ['trees', 'Spanning trees', 'MST'],
    ['dijkstra', 'Dijkstra', 'Path'],
    ['routes', 'Routes', 'Routes'],
    ['cpa', 'Critical path', 'CPA'],
    ['lp', 'Linear programming', 'LP'],
    ['practice', 'Practice', 'Quiz'],
  ] as const;

  const INFO: Record<Mode, [string, string]> = {
    sort: ['Sorting & searching', 'Bubble sort pass by pass, quick sort with middle-item pivots, and binary search. Turn on Quiz me to predict each pass.'],
    bins: ['Bin packing', 'First-fit, first-fit decreasing and full-bin, against the lower bound.'],
    trees: ['Minimum spanning trees', 'Kruskal, Prim on the network, and Prim on the distance matrix.'],
    dijkstra: ['Dijkstra', 'Fill in the boxes: order of labelling, final value and every working value, then trace the route back.'],
    routes: ['Route inspection & TSP', 'Pair the odd vertices for the Chinese postman; bound the travelling salesman tour from above and below.'],
    cpa: ['Critical path analysis', 'Forward and backward passes, floats, the critical path, cascade chart and a lower bound on workers.'],
    lp: ['Linear programming', 'Draw R, then find the optimum with the objective line or the vertex method; whole-number solutions too.'],
    practice: ['Practice', 'Exam-style D1 questions on fresh data, with full working.'],
  };

  let stats = $state<Record<Mode, Stats>>({ sort: [], bins: [], trees: [], dijkstra: [], routes: [], cpa: [], lp: [], practice: [] });
  const shown = $derived<Stats>(mode === 'practice' ? [['Correct', `${score.right}/${score.total}`], ['Streak', score.streak], ['Best', score.best]] : stats[mode]);

  function setMode(m: Mode) {
    const prev = mode;
    mode = m;
    if (prev !== m) tick().then(() => fadeIn(views[m]?.firstElementChild as HTMLElement));
  }
  const MODES = TABS.map((t) => t[0]) as readonly Mode[];
  function fromHash() { const h = location.hash.slice(1) as Mode; setMode(MODES.includes(h) ? h : 'sort'); }
  fromHash();
  $effect(() => { const h = '#' + mode; if (location.hash !== h) history.replaceState(null, '', h); });

  /* ---------- Kernel live tools ---------- */
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  async function openMode(m: DecisionMode) {
    setMode(m);
    await tick();
  }
  type Stepper = { getStep(): { i: number; total: number; stops?: number[] }; setStep(idx: number): void };
  /** Step visually through an algorithm run on screen (fast enough not to stall, skipped under reduced motion). */
  async function animateStepper(ref: Stepper | undefined, action: 'run' | 'start' | 'step') {
    if (!ref) return;
    await tick();
    const { total, stops } = ref.getStep();
    if (action === 'start') { ref.setStep(0); await tick(); return; }
    if (action === 'step') {
      const { i } = ref.getStep();
      const next = stops ? (stops.find((s) => s > i) ?? total - 1) : Math.min(total - 1, i + 1);
      ref.setStep(next);
      await tick();
      return;
    }
    const frames = stops
      ? stops.filter((s) => s > 0)
      : Array.from({ length: Math.max(0, total - 1) }, (_, k) => k + 1);
    if (RM || frames.length <= 1) { ref.setStep(total - 1); await tick(); return; }
    const delay = Math.min(160, Math.max(35, Math.round(1100 / frames.length)));
    for (const f of frames) {
      ref.setStep(f);
      await wait(delay);
    }
    ref.setStep(total - 1);
    await tick();
  }
  function activeStepper(): Stepper | undefined {
    if (mode === 'sort') return sortRef;
    if (mode === 'bins') return binRef;
    if (mode === 'trees') return treeRef;
    if (mode === 'dijkstra') return dijRef;
    if (mode === 'routes' && routeP.mode === 'inspect') return routeRef;
    if (mode === 'cpa') return cpaRef;
    return undefined;
  }
  function currentState(): string {
    const head = `Tab: ${INFO[mode][0]} (#${mode}).`;
    switch (mode) {
      case 'sort': return head + '\n' + formatSort(sortP.algo, sortP.order, sortP.list, sortP.target, sortRef?.getStep().i ?? 0);
      case 'bins': return head + '\n' + formatBins(binP.method, binP.items, binP.cap, binRef?.getStep().i ?? 0);
      case 'trees': {
        const info = treeRef?.getGraph();
        if (!info) return head;
        return head + '\n' + formatTrees(treeP.algo, info.g, info.start, treeRef?.getStep().i ?? 0);
      }
      case 'dijkstra': {
        const info = dijRef?.getGraph();
        if (!info) return head;
        return head + '\n' + formatDijkstra(info.g, info.from, info.to, dijRef?.getStep().i ?? 0);
      }
      case 'routes': {
        const info = routeRef?.getGraph();
        if (!info) return head;
        return head + '\n' + (routeP.mode === 'inspect' ? formatInspection(info.g, routeP.open, routeRef?.getStep().i ?? 0) : formatTSP(info.g, info.nnFrom, info.delV));
      }
      case 'cpa': {
        const info = cpaRef?.getProject();
        if (!info) return head;
        return head + '\n' + formatCPA(info.p, cpaP.view, cpaP.t, cpaRef?.getStep().i ?? 0);
      }
      case 'lp': return head + '\n' + formatLP(lpP.lp, lpP.k);
      default: return `${head}\nPractice topic: ${topic.t}. Score: ${score.right}/${score.total}, streak ${score.streak} (best ${score.best}).`;
    }
  }

  const KERNEL_ABOUT = 'Decision Lab (Edexcel IAL Mathematics D1, WDM11) is open, covering sorting & binary search, bin packing, Kruskal/Prim MSTs, Dijkstra’s shortest path, route inspection & TSP, critical path analysis (CPA), linear programming, and practice. '
    + 'Use decision_ tools to load the student’s own numbers, weighted graphs, activity tables or linear programs, run or step any algorithm on screen, and get full mark-scheme working.';

  const kernelTools = () => provideKernelTools('decision', KERNEL_ABOUT, [
    {
      name: 'decision_state',
      description: 'Read what is currently on screen in Decision Lab: active tab, algorithm, data, step progress and current working.',
      parameters: { type: 'object', properties: {} },
      run: () => currentState() + '\nAvailable tabs: sort, bins, trees, dijkstra, routes, cpa, lp, practice.',
    },
    {
      name: 'decision_mode',
      description: 'Switch Decision Lab to a tab (sort, bins, trees, dijkstra, routes, cpa, lp, practice).',
      parameters: { type: 'object', properties: {
        tab: { type: 'string', description: 'Tab name: sort, bins, trees, dijkstra, routes, cpa, lp, or practice.' },
        topic: { type: 'string', description: 'Only for practice: filter topic (all, sort, bins, mst, dijkstra, routes, cpa, lp).' },
      }, required: ['tab'] },
      run: async (a) => {
        const m = matchDecisionMode(String(a.tab ?? ''));
        if (m === 'practice' && a.topic !== undefined) {
          const valid = TOPICS.map((x) => x[0]) as string[];
          const tp = String(a.topic).toLowerCase();
          if (!valid.includes(tp)) throw new Error(`topic must be one of: ${valid.join(', ')}.`);
          topic.t = tp as Topic | 'all';
        }
        await openMode(m);
        return currentState();
      },
    },
    {
      name: 'decision_step',
      description: 'Step the currently open algorithm stepper forward, backward, to the start, to the end, or to a specific 1-based step number, or toggle Quiz me.',
      parameters: { type: 'object', properties: {
        action: { type: 'string', enum: ['next', 'pass', 'prev', 'start', 'end', 'goto'], description: 'Where to move the stepper.' },
        step: { type: 'integer', description: '1-based step index when action is "goto".' },
        quiz: { type: 'boolean', description: 'Optional: turn "Quiz me" on or off for this tab.' },
      }, required: ['action'] },
      run: async (a) => {
        const ref = activeStepper();
        if (!ref) throw new Error(`Tab "${mode}" does not have a stepper. Switch to sort, bins, trees, dijkstra, routes (inspection), or cpa first.`);
        if (a.quiz !== undefined) {
          const q = Boolean(a.quiz);
          if (mode === 'sort') sortP.quiz = q;
          else if (mode === 'bins') binP.quiz = q;
          else if (mode === 'trees') treeP.quiz = q;
          else if (mode === 'dijkstra') dijP.quiz = q;
          else if (mode === 'routes') routeP.quiz = q;
          else if (mode === 'cpa') cpaP.quiz = q;
        }
        const { i, total, stops } = ref.getStep();
        const act = String(a.action);
        if (act === 'start') ref.setStep(0);
        else if (act === 'end') ref.setStep(total - 1);
        else if (act === 'next') ref.setStep(i + 1);
        else if (act === 'pass') ref.setStep(stops ? (stops.find((s) => s > i) ?? total - 1) : i + 1);
        else if (act === 'prev') ref.setStep(stops ? ([...stops].reverse().find((s) => s < i) ?? 0) : i - 1);
        else if (act === 'goto') {
          const n = Number(a.step);
          if (!Number.isInteger(n) || n < 1 || n > total) throw new Error(`step must be an integer between 1 and ${total}.`);
          ref.setStep(n - 1);
        } else throw new Error('action must be next, pass, prev, start, end, or goto.');
        await tick();
        return currentState();
      },
    },
    {
      name: 'decision_sort',
      description: 'Run or step Bubble Sort, Quick Sort (Edexcel middle-right pivot), or Binary Search (⌈(first+last)/2⌉) on screen with the student’s own numbers or the current list. Returns every pass/comparison for the mark scheme.',
      parameters: { type: 'object', properties: {
        algorithm: { type: 'string', enum: ['bubble', 'quick', 'binary'], description: '"bubble", "quick", or "binary".' },
        order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order for bubble/quick: "asc" (default) or "desc".' },
        items: { description: 'List of 2–14 numbers (array of numbers or space/comma-separated string like "5 2 9 1 7").' },
        target: { type: 'number', description: 'Number to search for (binary search only).' },
        action: { type: 'string', enum: ['run', 'start', 'step'], description: '"run" (animate to completion, default), "start" (load at step 1), or "step" (advance one pass/step).' },
      } },
      run: async (a) => {
        await openMode('sort');
        if (a.algorithm !== undefined) {
          const al = String(a.algorithm).toLowerCase();
          if (al !== 'bubble' && al !== 'quick' && al !== 'binary') throw new Error('algorithm must be "bubble", "quick", or "binary".');
          sortP.algo = al;
        }
        if (a.order !== undefined) {
          const o = String(a.order).toLowerCase();
          if (o !== 'asc' && o !== 'desc') throw new Error('order must be "asc" or "desc".');
          sortP.order = o;
        }
        if (a.items !== undefined) sortP.list = parseNumberList(a.items, 2, 14, 'items');
        if (a.target !== undefined) {
          const t = Number(a.target);
          if (!Number.isFinite(t)) throw new Error('target must be a finite number.');
          sortP.target = t;
        }
        const act = (a.action ?? 'run') as 'run' | 'start' | 'step';
        if (!['run', 'start', 'step'].includes(act)) throw new Error('action must be "run", "start", or "step".');
        await animateStepper(sortRef, act);
        return formatSort(sortP.algo, sortP.order, sortP.list, sortP.target, sortRef?.getStep().i ?? 0);
      },
    },
    {
      name: 'decision_bins',
      description: 'Run or step First-Fit (ff), First-Fit Decreasing (ffd), or Full-Bin (full) bin packing on screen with custom bin capacity and item sizes. Returns each bin, total bins, lower bound and optimality.',
      parameters: { type: 'object', properties: {
        method: { type: 'string', enum: ['ff', 'ffd', 'full'], description: '"ff" (first-fit), "ffd" (first-fit decreasing), or "full" (full-bin).' },
        capacity: { type: 'number', description: 'Positive bin capacity (e.g. 10, 20).' },
        items: { description: '1–16 positive item sizes (array of numbers or string like "4 7 3 6 2"), each ≤ capacity.' },
        action: { type: 'string', enum: ['run', 'start', 'step'], description: '"run" (animate to completion, default), "start", or "step".' },
      } },
      run: async (a) => {
        await openMode('bins');
        if (a.method !== undefined) {
          const m = String(a.method).toLowerCase();
          if (m !== 'ff' && m !== 'ffd' && m !== 'full') throw new Error('method must be "ff", "ffd", or "full".');
          binP.method = m;
        }
        const cap = a.capacity !== undefined ? Number(a.capacity) : binP.cap;
        if (!Number.isFinite(cap) || cap <= 0) throw new Error('capacity must be a positive number.');
        if (a.items !== undefined) {
          const list = parseNumberList(a.items, 1, 16, 'items');
          if (list.some((x) => x <= 0)) throw new Error('Every item size must be positive.');
          const tooBig = list.filter((x) => x > cap);
          if (tooBig.length) throw new Error(`Item(s) ${tooBig.join(', ')} exceed bin capacity ${cap}.`);
          binP.cap = cap;
          binP.items = list;
        } else if (a.capacity !== undefined) {
          binP.cap = cap;
          if (binP.items.some((x) => x > cap)) binP.items = binP.items.filter((x) => x <= cap);
        }
        const act = (a.action ?? 'run') as 'run' | 'start' | 'step';
        if (!['run', 'start', 'step'].includes(act)) throw new Error('action must be "run", "start", or "step".');
        await animateStepper(binRef, act);
        return formatBins(binP.method, binP.items, binP.cap, binRef?.getStep().i ?? 0);
      },
    },
    {
      name: 'decision_graph',
      description: 'Run or step a D1 graph algorithm on screen — Dijkstra’s shortest path, Kruskal MST, Prim MST (network or matrix), Route Inspection (Chinese postman), or Travelling Salesman bounds — using a preset/random network OR the student’s own weighted edges. Returns full mark-scheme working (order of labelling, working values, route, arcs, pairings, bounds).',
      parameters: { type: 'object', properties: {
        algorithm: { type: 'string', enum: ['dijkstra', 'kruskal', 'prim', 'prim_matrix', 'inspection', 'tsp'], description: 'Graph algorithm to run.' },
        network: { type: 'string', enum: ['town', 'park', 'ring', 'random'], description: 'Optional built-in preset or random network (ignored when edges are given).' },
        edges: { description: 'Optional custom weighted undirected graph: array of { from, to, weight } objects, array of strings like ["A-B 5", "B-C 3"], or a comma-separated string "A-B 5, B-C 3, A-C 9".' },
        from: { type: 'string', description: 'Start vertex (Dijkstra, Prim, or TSP nearest-neighbour).' },
        to: { type: 'string', description: 'Destination vertex (Dijkstra only).' },
        open: { type: 'boolean', description: 'Route inspection only: allow starting and finishing at two different odd vertices.' },
        delete_vertex: { type: 'string', description: 'TSP only: vertex to delete for the residual MST lower bound.' },
        action: { type: 'string', enum: ['run', 'start', 'step'], description: '"run" (animate to completion, default), "start", or "step".' },
      }, required: ['algorithm'] },
      run: async (a) => {
        const algo = String(a.algorithm ?? '').toLowerCase();
        if (!['dijkstra', 'kruskal', 'prim', 'prim_matrix', 'inspection', 'tsp'].includes(algo)) {
          throw new Error('algorithm must be one of: dijkstra, kruskal, prim, prim_matrix, inspection, tsp.');
        }
        const act = (a.action ?? 'run') as 'run' | 'start' | 'step';
        if (!['run', 'start', 'step'].includes(act)) throw new Error('action must be "run", "start", or "step".');

        let netName: string | undefined;
        let newSeed: number | undefined;
        if (a.edges !== undefined) {
          customGraph = buildCustomGraph(a.edges, a.from ? String(a.from) : undefined);
          netName = 'custom';
        } else if (a.network !== undefined) {
          const n = String(a.network).toLowerCase();
          if (n !== 'random' && !(n in GRAPH_PRESETS)) throw new Error(`network must be one of: ${Object.keys(GRAPH_PRESETS).join(', ')}, random.`);
          netName = n;
          if (n === 'random') newSeed = (Math.random() * 1e9) | 0;
        }

        const normV = (v: unknown) => { const s = String(v ?? '').trim(); return s.length <= 2 ? s.toUpperCase() : s; };

        if (algo === 'dijkstra') {
          await openMode('dijkstra');
          if (netName) dijP.net = netName;
          if (newSeed !== undefined) dijP.seed = newSeed;
          await tick();
          const info0 = dijRef?.getGraph();
          const ids = info0?.g.v.map((v) => v.id) ?? [];
          if (a.from !== undefined) {
            const f = normV(a.from);
            if (!ids.includes(f)) throw new Error(`Start vertex "${a.from}" not in graph. Vertices: ${ids.join(', ')}.`);
            dijP.from = f;
          }
          if (a.to !== undefined) {
            const t = normV(a.to);
            if (!ids.includes(t)) throw new Error(`Destination vertex "${a.to}" not in graph. Vertices: ${ids.join(', ')}.`);
            if (t === dijP.from) throw new Error('Destination vertex must differ from start vertex.');
            dijP.to = t;
          } else if (ids.length && (!ids.includes(dijP.to) || dijP.to === dijP.from)) {
            dijP.to = ids.findLast((x) => x !== dijP.from) ?? ids[0];
          }
          await animateStepper(dijRef, act);
          const info = dijRef!.getGraph();
          return formatDijkstra(info.g, info.from, info.to, dijRef!.getStep().i);
        }

        if (algo === 'kruskal' || algo === 'prim' || algo === 'prim_matrix') {
          await openMode('trees');
          treeP.algo = algo === 'prim_matrix' ? 'matrix' : algo;
          if (netName) treeP.net = netName;
          if (newSeed !== undefined) treeP.seed = newSeed;
          await tick();
          const ids = treeRef?.getGraph().g.v.map((v) => v.id) ?? [];
          if (a.from !== undefined) {
            const f = normV(a.from);
            if (!ids.includes(f)) throw new Error(`Start vertex "${a.from}" not in graph. Vertices: ${ids.join(', ')}.`);
            treeP.start = f;
          }
          await animateStepper(treeRef, act);
          const info = treeRef!.getGraph();
          return formatTrees(treeP.algo, info.g, info.start, treeRef!.getStep().i);
        }

        // routes: inspection or tsp
        await openMode('routes');
        routeP.mode = algo === 'tsp' ? 'tsp' : 'inspect';
        if (netName) routeP.net = netName;
        if (newSeed !== undefined) routeP.seed = newSeed;
        if (algo === 'inspection' && a.open !== undefined) routeP.open = Boolean(a.open);
        await tick();
        const info0 = routeRef!.getGraph();
        const ids = info0.g.v.map((v) => v.id);
        if (algo === 'inspection') {
          const oddCount = info0.g.v.filter((v) => info0.g.e.filter((e) => e.a === v.id || e.b === v.id).length % 2 === 1).length;
          if (oddCount > 6) throw new Error(`Graph has ${oddCount} odd vertices; D1 route inspection works with 0, 2, or 4 odd vertices (max 6 supported).`);
          await animateStepper(routeRef, act);
          const info = routeRef!.getGraph();
          return formatInspection(info.g, routeP.open, routeRef!.getStep().i);
        }
        // TSP
        if (a.from !== undefined) {
          const f = normV(a.from);
          if (!ids.includes(f)) throw new Error(`Start vertex "${a.from}" not in graph. Vertices: ${ids.join(', ')}.`);
          routeP.nnStart = f;
        }
        if (a.delete_vertex !== undefined) {
          const dv = normV(a.delete_vertex);
          if (!ids.includes(dv)) throw new Error(`Deleted vertex "${a.delete_vertex}" not in graph. Vertices: ${ids.join(', ')}.`);
          routeP.del = dv;
        }
        await tick();
        const info = routeRef!.getGraph();
        return formatTSP(info.g, info.nnFrom, info.delV);
      },
    },
    {
      name: 'decision_cpa',
      description: 'Run or step Critical Path Analysis (forward/backward pass, floats, critical path, cascade/Gantt chart, workers lower bound) on a built-in project OR the student’s own activity table (precedence table or activity-on-arc list).',
      parameters: { type: 'object', properties: {
        project: { description: 'Built-in project: 0/"kitchen" (Kitchen refit), 1/"school" (School fair), or 2/"app" (App launch). Ignored when activities are given.' },
        activities: { type: 'array', items: { type: 'object' }, description: 'Custom activity network: array of { id, duration, depends_on } (precedence table, e.g. depends_on: ["A","B"] or []) OR { id, from, to, duration, dummy? } (activity-on-arc).' },
        name: { type: 'string', description: 'Optional title for a custom project.' },
        view: { type: 'string', enum: ['network', 'gantt', 'table'], description: 'View to show: "network" (default), "gantt" (cascade chart), or "table".' },
        time: { type: 'number', description: 'Time t on the cascade chart to inspect which activities must be happening (e.g. 8.5).' },
        action: { type: 'string', enum: ['run', 'start', 'step'], description: '"run" (animate forward & backward pass, default), "start", or "step".' },
      } },
      run: async (a) => {
        await openMode('cpa');
        if (a.activities !== undefined) {
          customProject = buildCustomProject(a.activities, a.name ? String(a.name) : 'Custom project');
          cpaP.project = -1;
        } else if (a.project !== undefined) {
          const raw = String(a.project).toLowerCase().trim();
          const n = Number(a.project);
          if (Number.isInteger(n) && n >= 0 && n < CPA_PROJECTS.length) cpaP.project = n;
          else {
            const idx = CPA_PROJECTS.findIndex((p) => p.name.toLowerCase().includes(raw));
            if (idx < 0) throw new Error(`Unknown project "${a.project}". Built-in: ${CPA_PROJECTS.map((p, k) => `${k}: ${p.name}`).join(', ')}.`);
            cpaP.project = idx;
          }
        }
        if (a.view !== undefined) {
          const v = String(a.view).toLowerCase();
          if (v !== 'network' && v !== 'gantt' && v !== 'table') throw new Error('view must be "network", "gantt", or "table".');
          cpaP.view = v;
        }
        await tick();
        const info = cpaRef!.getProject();
        if (a.time !== undefined) {
          const tv = Number(a.time);
          if (!Number.isFinite(tv) || tv <= 0 || tv >= info.T) throw new Error(`time must be strictly between 0 and completion time ${info.T}.`);
          cpaP.t = tv;
        } else if (cpaP.t >= info.T || cpaP.t <= 0) {
          cpaP.t = Math.max(0.5, Math.min(info.T - 0.5, Math.floor(info.T / 2) + 0.5));
        }
        const act = (a.action ?? 'run') as 'run' | 'start' | 'step';
        if (!['run', 'start', 'step'].includes(act)) throw new Error('action must be "run", "start", or "step".');
        await animateStepper(cpaRef, act);
        return formatCPA(info.p, cpaP.view, cpaP.t, cpaRef!.getStep().i);
      },
    },
    {
      name: 'decision_lp',
      description: 'Open Linear Programming, load a preset or custom 2-variable LP (objective, up to 5 constraints, integer flag), slide the objective line to the optimum on screen, and return the vertex table, continuous optimum and integer optimum.',
      parameters: { type: 'object', properties: {
        preset: { type: 'string', description: 'Built-in problem: "bakery", "diet", or "furniture".' },
        sense: { type: 'string', enum: ['max', 'min'], description: '"max" (maximise) or "min" (minimise).' },
        objective: { type: 'object', properties: { p: { type: 'number' }, q: { type: 'number' } }, description: 'Objective px + qy.' },
        constraints: { type: 'array', description: '1–5 constraints, each { a, b, op: "<=" | ">=", c } or string like "x + 2y <= 16".' },
        integer: { type: 'boolean', description: 'Require whole-number (integer) solutions.' },
        x_label: { type: 'string', description: 'Label for x-axis.' },
        y_label: { type: 'string', description: 'Label for y-axis.' },
        name: { type: 'string', description: 'Title for a custom LP.' },
        shade: { type: 'string', enum: ['unwanted', 'feasible'], description: 'Shade unwanted regions (Edexcel convention) or shade R.' },
        move_to_optimum: { type: 'boolean', description: 'Slide the objective line to the optimal vertex (default true).' },
      } },
      run: async (a) => {
        await openMode('lp');
        if (a.preset !== undefined) {
          const q = String(a.preset).toLowerCase().trim();
          const hit = LP_PRESETS.find((x) => x.name.toLowerCase().includes(q));
          if (!hit) throw new Error(`Unknown LP preset "${a.preset}". Valid: ${LP_PRESETS.map((x) => x.name).join(', ')}.`);
          lpP.lp = structuredClone(hit);
        }
        const custom = a.sense !== undefined || a.objective !== undefined || a.constraints !== undefined || a.name !== undefined;
        if (custom) {
          const cur: LP = structuredClone($state.snapshot(lpP.lp));
          if (a.name !== undefined) cur.name = String(a.name); else if (a.preset === undefined) cur.name = 'Custom LP';
          if (a.x_label !== undefined) cur.x = String(a.x_label);
          if (a.y_label !== undefined) cur.y = String(a.y_label);
          if (a.sense !== undefined) {
            const s = String(a.sense).toLowerCase();
            if (s !== 'max' && s !== 'min') throw new Error('sense must be "max" or "min".');
            cur.obj.sense = s;
          }
          if (a.objective !== undefined) {
            const o = a.objective as Record<string, unknown>;
            const p = Number(o.p), q = Number(o.q);
            if (!Number.isFinite(p) || !Number.isFinite(q) || (p === 0 && q === 0)) throw new Error('objective needs finite numbers p and q (not both 0).');
            cur.obj.p = p; cur.obj.q = q;
          }
          if (a.constraints !== undefined) {
            if (!Array.isArray(a.constraints) || a.constraints.length < 1 || a.constraints.length > 5) {
              throw new Error('constraints must be an array of 1 to 5 constraints.');
            }
            cur.cons = a.constraints.map(parseConstraint);
          }
          if (a.integer !== undefined) cur.integer = Boolean(a.integer);
          cur.story = `Custom linear programming problem (${cur.obj.sense === 'max' ? 'maximise' : 'minimise'} ${cur.obj.p}x + ${cur.obj.q}y).`;
          lpP.lp = cur;
        } else if (a.integer !== undefined) {
          lpP.lp.integer = Boolean(a.integer);
        }
        if (a.shade !== undefined) {
          const sh = String(a.shade).toLowerCase();
          if (sh !== 'unwanted' && sh !== 'feasible') throw new Error('shade must be "unwanted" or "feasible".');
          lpP.shade = sh;
        }
        await tick();
        if (a.move_to_optimum !== false) {
          const rg = range(lpP.lp), opt = optimum(lpP.lp), kmax = objective(lpP.lp, [rg.xmax, rg.ymax]);
          if (opt && kmax > 0) {
            const targetK = Math.max(0, Math.min(1, opt.value / kmax));
            if (RM) { lpP.k = targetK; }
            else {
              const startK = lpP.lp.obj.sense === 'max' ? 0.1 : 0.9;
              for (let s = 0; s <= 10; s++) {
                lpP.k = startK + ((targetK - startK) * s) / 10;
                await wait(35);
              }
            }
          }
        }
        await tick();
        return formatLP(lpP.lp, lpP.k);
      },
    },
  ]);

  onMount(() => {
    addEventListener('hashchange', fromHash);
    glint('.panel,.qpanel');
    const unprovide = kernelTools();
    return () => { removeEventListener('hashchange', fromHash); unprovide(); };
  });
</script>

<SimHeader title="Decision Lab" eyebrow="Edexcel IAL Mathematics · D1 (WDM11) · Algorithms, networks, critical paths and LP"
  back={{ href: '/maths/', label: 'Arsenal' }} tabs={TABS} value={mode} onselect={setMode} />
<StatusLine label={INFO[mode][0]} hint={INFO[mode][1]} stats={shown} />

<div bind:this={views.sort}><Sorting bind:this={sortRef} prefs={sortP} hidden={mode !== 'sort'} bind:stats={stats.sort} {onscore} /></div>
<div bind:this={views.bins}><Bins bind:this={binRef} prefs={binP} hidden={mode !== 'bins'} bind:stats={stats.bins} {onscore} /></div>
<div bind:this={views.trees}><Trees bind:this={treeRef} prefs={treeP} hidden={mode !== 'trees'} bind:stats={stats.trees} {onscore} {customGraph} /></div>
<div bind:this={views.dijkstra}><Dijkstra bind:this={dijRef} prefs={dijP} hidden={mode !== 'dijkstra'} bind:stats={stats.dijkstra} {onscore} {customGraph} /></div>
<div bind:this={views.routes}><Routes bind:this={routeRef} prefs={routeP} hidden={mode !== 'routes'} bind:stats={stats.routes} {onscore} {customGraph} /></div>
<div bind:this={views.cpa}><Critical bind:this={cpaRef} prefs={cpaP} hidden={mode !== 'cpa'} bind:stats={stats.cpa} {onscore} {customProject} /></div>
<div bind:this={views.lp}><Linear prefs={lpP} hidden={mode !== 'lp'} bind:stats={stats.lp} /></div>
<div bind:this={views.practice}><Practice {score} bind:topic={topic.t} hidden={mode !== 'practice'} /></div>
