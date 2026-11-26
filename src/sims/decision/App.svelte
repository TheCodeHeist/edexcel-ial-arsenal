<script lang="ts">
  /* Decision Lab: Edexcel IAL Mathematics D1 (WDM11). Every algorithm in the spec, stepped through the way the mark
     scheme wants it written, with "Quiz me" to predict each step. Tabs with hash routes:
     #sort #bins #trees #dijkstra #routes #cpa #lp #practice. */
  import { onMount, tick } from 'svelte';
  import { persisted } from '../../lib/persist.svelte';
  import { glint, fadeIn } from '../../lib/motion';
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
  import type { Topic } from './practice';

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

  onMount(() => {
    addEventListener('hashchange', fromHash);
    glint('.panel,.qpanel');
    return () => removeEventListener('hashchange', fromHash);
  });
</script>

<SimHeader title="Decision Lab" eyebrow="Edexcel IAL Mathematics · D1 (WDM11) · Algorithms, networks, critical paths and LP"
  back={{ href: '/maths/', label: 'Arsenal' }} tabs={TABS} value={mode} onselect={setMode} />
<StatusLine label={INFO[mode][0]} hint={INFO[mode][1]} stats={shown} />

<div bind:this={views.sort}><Sorting prefs={sortP} hidden={mode !== 'sort'} bind:stats={stats.sort} {onscore} /></div>
<div bind:this={views.bins}><Bins prefs={binP} hidden={mode !== 'bins'} bind:stats={stats.bins} {onscore} /></div>
<div bind:this={views.trees}><Trees prefs={treeP} hidden={mode !== 'trees'} bind:stats={stats.trees} {onscore} /></div>
<div bind:this={views.dijkstra}><Dijkstra prefs={dijP} hidden={mode !== 'dijkstra'} bind:stats={stats.dijkstra} {onscore} /></div>
<div bind:this={views.routes}><Routes prefs={routeP} hidden={mode !== 'routes'} bind:stats={stats.routes} {onscore} /></div>
<div bind:this={views.cpa}><Critical prefs={cpaP} hidden={mode !== 'cpa'} bind:stats={stats.cpa} {onscore} /></div>
<div bind:this={views.lp}><Linear prefs={lpP} hidden={mode !== 'lp'} bind:stats={stats.lp} /></div>
<div bind:this={views.practice}><Practice {score} bind:topic={topic.t} hidden={mode !== 'practice'} /></div>
