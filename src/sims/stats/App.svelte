<script lang="ts">
  /* Stats Lab: Edexcel IAL Mathematics Statistics 1–3 (WST01, WST02, WST03).
     Hash-routed tabs: #dist #tests #corr #data #prob #clt #practice. */
  import { onMount, tick } from 'svelte';
  import { persisted } from '../../lib/persist.svelte';
  import { glint, fadeIn } from '../../lib/motion';
  import { getAI } from '../../lib/ai';
  import { kernel, newChat, openKernel, refreshAccount, send } from '../../lib/kernel/store.svelte';
  import SimHeader from '../../components/ui/SimHeader.svelte';
  import StatusLine from '../../components/ui/StatusLine.svelte';
  import Distributions, { DIST_PREFS, type DistPrefs } from './Distributions.svelte';
  import HypothesisTests, { TEST_PREFS, type TestPrefs } from './HypothesisTests.svelte';
  import Correlation, { CORR_PREFS, type CorrPrefs } from './Correlation.svelte';
  import BoxPlots, { BOX_PREFS, type BoxPrefs } from './BoxPlots.svelte';
  import Probability, { PROB_PREFS, type ProbPrefs } from './Probability.svelte';
  import CltSampler, { CLT_PREFS, type CltPrefs } from './CltSampler.svelte';
  import Practice, { type PScore } from './Practice.svelte';
  import { type Topic } from './practice';
  import {
    provideStatsTools, formatDist, formatTest, formatCorr, formatBox, formatProb, formatClt,
    type StatsMode,
  } from './kernel';

  type Stats = [string, string | number][];

  const distP = persisted<DistPrefs>('stats-dist', DIST_PREFS);
  const testP = persisted<TestPrefs>('stats-tests', TEST_PREFS);
  const corrP = persisted<CorrPrefs>('stats-corr', CORR_PREFS);
  const boxP = persisted<BoxPrefs>('stats-data', BOX_PREFS);
  const probP = persisted<ProbPrefs>('stats-prob', PROB_PREFS);
  const cltP = persisted<CltPrefs>('stats-clt', CLT_PREFS);
  const score = persisted<PScore>('stats-score', { right: 0, total: 0, streak: 0, best: 0 });
  const topic = persisted<{ t: Topic | 'all' }>('stats-topic', { t: 'all' });
  score.streak = 0;

  let mode = $state<StatsMode>('dist');
  let aiNotice = $state('');
  let cltRef = $state<CltSampler>();
  const views: Record<StatsMode, HTMLElement | undefined> = $state({
    dist: undefined, tests: undefined, corr: undefined, data: undefined, prob: undefined, clt: undefined, practice: undefined,
  });

  const TABS = [
    ['dist', 'Distributions', 'Dist'],
    ['tests', 'Hypothesis tests', 'Tests'],
    ['corr', 'Correlation', 'Corr'],
    ['data', 'Box plots', 'Data'],
    ['prob', 'Probability', 'Prob'],
    ['clt', 'CLT & sampling', 'CLT'],
    ['practice', 'Practice', 'Quiz'],
  ] as const;

  const INFO: Record<StatsMode, [string, string]> = {
    dist: ['Distributions & S2 approximations', 'Normal, Binomial, Poisson and Uniform shading, Z standardisation and ±0.5 continuity corrections.'],
    tests: ['Hypothesis testing (S2 & S3)', 'Critical regions, actual significance levels, Normal mean Z-tests and χ² goodness-of-fit / contingency tables.'],
    corr: ['Correlation & regression', 'Drag points live to watch S_xx, S_xy, PMCC r, Spearman rₛ, regression line and coding update.'],
    data: ['Box plots, outliers & coding', 'Edexcel discrete quartiles, IQR / ±2σ outlier fences, skewness and linear coding comparisons.'],
    prob: ['Venn diagrams & Bayes trees', 'Click regions on 2-set or 3-set Venns, or trace conditional paths through probability trees.'],
    clt: ['Central Limit Theorem & CIs', 'Draw repeated samples from non-Normal populations and watch X̄ converge to N(μ, σ²/n).'],
    practice: ['Practice (S1–S3)', 'Freshly generated exam-style questions with Pearson table working and topic links.'],
  };

  let stats = $state<Record<StatsMode, Stats>>({
    dist: [], tests: [], corr: [], data: [], prob: [], clt: [], practice: [],
  });
  const shown = $derived<Stats>(
    mode === 'practice'
      ? [['Correct', `${score.right}/${score.total}`], ['Streak', score.streak], ['Best', score.best]]
      : stats[mode],
  );

  function setMode(m: StatsMode) {
    const prev = mode;
    mode = m;
    if (prev !== m) tick().then(() => fadeIn(views[m]?.firstElementChild as HTMLElement));
  }

  const MODES = TABS.map((t) => t[0]) as readonly StatsMode[];
  function fromHash() {
    const h = location.hash.slice(1) as StatsMode;
    setMode(MODES.includes(h) ? h : 'dist');
  }
  fromHash();
  $effect(() => {
    const h = '#' + mode;
    if (location.hash !== h) history.replaceState(null, '', h);
  });

  function currentStateText(): string {
    const head = `Tab: ${INFO[mode][0]} (#${mode}).`;
    switch (mode) {
      case 'dist': return head + '\n' + formatDist(distP);
      case 'tests': return head + '\n' + formatTest(testP);
      case 'corr': return head + '\n' + formatCorr(corrP);
      case 'data': return head + '\n' + formatBox(boxP);
      case 'prob': return head + '\n' + formatProb(probP);
      case 'clt': {
        const s = stats.clt;
        const count = Number(s.find((x) => x[0] === 'Samples')?.[1] ?? 0);
        const mean = Number(s.find((x) => x[0] === 'Mean(X̄)')?.[1] ?? 0);
        return head + '\n' + formatClt(cltP, { count, mean, sd: 0 });
      }
      default:
        return `${head}\nPractice topic: ${topic.t}. Score: ${score.right}/${score.total}, streak ${score.streak}.`;
    }
  }

  async function askKernelExplain() {
    aiNotice = '';
    const ai = getAI();
    let ready = ai.provider === 'gemini' ? !!ai.geminiKey : false;
    if (ai.provider !== 'gemini') {
      if (kernel.user === undefined) await refreshAccount();
      ready = kernel.user !== null && kernel.user !== undefined;
    }
    openKernel('chat');
    if (!ready) {
      aiNotice = 'Sign in to Puter (or add your Gemini key) in Kernel first to ask for an explanation.';
      return;
    }
    newChat();
    send('Read the current Stats Lab state with stats_state and explain the statistical method, key formula-book steps, and common Edexcel mark-scheme pitfalls.');
  }

  const registerTools = () => provideStatsTools({
    getState: currentStateText,
    openTab: async (m, tp) => {
      if (m === 'practice' && tp) topic.t = tp;
      setMode(m);
      await tick();
    },
    dist: distP,
    test: testP,
    corr: corrP,
    box: boxP,
    prob: probP,
    clt: cltP,
    drawClt: async (count, reset) => {
      await tick();
      if (reset) cltRef?.resetAndSeed(count);
      else cltRef?.drawMany(count);
      await tick();
    },
  });

  onMount(() => {
    addEventListener('hashchange', fromHash);
    glint('.panel,.qpanel');
    const unprovide = registerTools();
    return () => {
      removeEventListener('hashchange', fromHash);
      unprovide();
    };
  });
</script>

<SimHeader
  title="Stats Lab"
  eyebrow="Edexcel IAL Mathematics · S1–S3 (WST01–WST03) · Distributions, tests, correlation, probability & CLT"
  back={{ href: '/maths/', label: 'Arsenal' }}
  tabs={TABS}
  value={mode}
  onselect={setMode}
/>
<StatusLine label={INFO[mode][0]} hint={INFO[mode][1]} stats={shown} />

<div class="st-ai-bar">
  <span class="st-ai-note">{aiNotice}</span>
  <button type="button" class="btn sm st-ai-btn" onclick={askKernelExplain} title="Ask Kernel to explain the current calculation">
    <svg class="st-twinkle" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.1 5.9L20 10l-5.9 2.1L12 18l-2.1-5.9L4 10l5.9-2.1L12 2z" />
      <path d="M19 15l1 2.5L22.5 18.5 20 19.5 19 22l-1-2.5-2.5-1 2.5-1L19 15z" opacity=".8" />
    </svg>
    Explain with Kernel
  </button>
</div>

<div bind:this={views.dist}><Distributions prefs={distP} hidden={mode !== 'dist'} bind:stats={stats.dist} /></div>
<div bind:this={views.tests}><HypothesisTests prefs={testP} hidden={mode !== 'tests'} bind:stats={stats.tests} /></div>
<div bind:this={views.corr}><Correlation prefs={corrP} hidden={mode !== 'corr'} bind:stats={stats.corr} /></div>
<div bind:this={views.data}><BoxPlots prefs={boxP} hidden={mode !== 'data'} bind:stats={stats.data} /></div>
<div bind:this={views.prob}><Probability prefs={probP} hidden={mode !== 'prob'} bind:stats={stats.prob} /></div>
<div bind:this={views.clt}><CltSampler bind:this={cltRef} prefs={cltP} hidden={mode !== 'clt'} bind:stats={stats.clt} /></div>
<div bind:this={views.practice}><Practice {score} bind:topic={topic.t} hidden={mode !== 'practice'} /></div>
