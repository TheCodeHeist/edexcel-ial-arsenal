<script lang="ts">
  /* Energetics Lab: Edexcel IAL Chemistry Unit 2 (Topic 6, CP 2) and Unit 4 (Topic 12: Born–Haber, Entropy & ΔG).
     Tabs with hash routes: #calorimetry, #hess, #bonds, #bornhaber, #entropy, #practice. */
  import { onMount, tick } from 'svelte';
  import { persisted } from '../../lib/persist.svelte';
  import { glint, fadeIn } from '../../lib/motion';
  import SimHeader from '../../components/ui/SimHeader.svelte';
  import StatusLine from '../../components/ui/StatusLine.svelte';
  import Calorimetry, { CAL_PREFS, type CalPrefs } from './Calorimetry.svelte';
  import Hess, { HESS_PREFS, type HessPrefs } from './Hess.svelte';
  import Bonds, { BONDS_PREFS, type BondsPrefs } from './Bonds.svelte';
  import BornHaber, { BH_PREFS, type BHPrefs } from './BornHaber.svelte';
  import Entropy, { ENTROPY_PREFS, type EntropyPrefs } from './Entropy.svelte';
  import Practice, { type PScore } from './Practice.svelte';
  import type { Topic } from './practice';

  type Mode = 'calorimetry' | 'hess' | 'bonds' | 'bornhaber' | 'entropy' | 'practice';
  type Stats = [string, string | number][];

  const cal = persisted<CalPrefs>('energetics-cal', CAL_PREFS);
  const hess = persisted<HessPrefs>('energetics-hess', HESS_PREFS);
  const bonds = persisted<BondsPrefs>('energetics-bonds', BONDS_PREFS);
  const bh = persisted<BHPrefs>('energetics-bh', BH_PREFS);
  const ent = persisted<EntropyPrefs>('energetics-ent', ENTROPY_PREFS);
  const score = persisted<PScore>('energetics-score', { right: 0, total: 0, streak: 0, best: 0 });
  const topic = persisted<{ t: Topic | 'all' }>('energetics-topic', { t: 'all' });
  score.streak = 0;

  let mode = $state<Mode>('calorimetry');
  const views: Record<Mode, HTMLElement | undefined> = $state({
    calorimetry: undefined, hess: undefined, bonds: undefined, bornhaber: undefined, entropy: undefined, practice: undefined,
  });

  const TABS = [
    ['calorimetry', 'Calorimetry', 'Heat'],
    ['hess', 'Hess’s law', 'Hess'],
    ['bonds', 'Bond enthalpies', 'Bonds'],
    ['bornhaber', 'Born–Haber', 'Lattice'],
    ['entropy', 'Entropy & ΔG', 'Entropy'],
    ['practice', 'Practice', 'Quiz'],
  ] as const;

  const INFO: Record<Mode, [string, string]> = {
    calorimetry: ['Calorimetry', 'Run solution and combustion calorimetry in 3D, adjust heat loss, and extrapolate the cooling curve back to t = 4 min.'],
    hess: ['Hess’s law', 'Follow formation, combustion and Core Practical 2 cycles; see which arrows reverse sign along the indirect route.'],
    bonds: ['Bond enthalpies', 'Scrub from reactants through gaseous atoms to products and compare mean bond enthalpy estimates with ΔrH⊖.'],
    bornhaber: ['Born–Haber & lattice', 'Climb the 3D Born–Haber staircase, inspect covalent character via polarisation, and compute ΔsolH.'],
    entropy: ['Entropy & ΔG', 'Explore solid/liquid/gas disorder in 3D and slide temperature T across the ΔG = ΔH − TΔS feasibility threshold.'],
    practice: ['Practice', 'Answer exam-style Topics 6 & 12 questions, then check the working.'],
  };

  let stats = $state<Record<Mode, Stats>>({
    calorimetry: [], hess: [], bonds: [], bornhaber: [], entropy: [], practice: [],
  });

  const shown = $derived<Stats>(
    mode === 'practice'
      ? [['Correct', `${score.right}/${score.total}`], ['Streak', score.streak], ['Best', score.best]]
      : stats[mode]
  );

  function setMode(m: Mode) {
    const prev = mode;
    mode = m;
    if (prev !== m) tick().then(() => fadeIn(views[m]?.firstElementChild as HTMLElement));
  }

  const MODES = TABS.map((t) => t[0]) as readonly Mode[];
  function fromHash() {
    const h = location.hash.slice(1) as Mode;
    setMode(MODES.includes(h) ? h : 'calorimetry');
  }
  fromHash();
  $effect(() => { const h = '#' + mode; if (location.hash !== h) history.replaceState(null, '', h); });

  onMount(() => {
    addEventListener('hashchange', fromHash);
    glint('.panel,.qpanel');
    return () => removeEventListener('hashchange', fromHash);
  });
</script>

<SimHeader title="Energetics Lab" eyebrow="Edexcel IAL Chemistry · Units 2 & 4 · Energetics, Born–Haber & entropy"
  back={{ href: '/chemistry/', label: 'Arsenal' }} tabs={TABS} value={mode} onselect={setMode} />
<StatusLine label={INFO[mode][0]} hint={INFO[mode][1]} stats={shown} />

<div bind:this={views.calorimetry}><Calorimetry prefs={cal} hidden={mode !== 'calorimetry'} bind:stats={stats.calorimetry} /></div>
<div bind:this={views.hess}><Hess prefs={hess} hidden={mode !== 'hess'} bind:stats={stats.hess} /></div>
<div bind:this={views.bonds}><Bonds prefs={bonds} hidden={mode !== 'bonds'} bind:stats={stats.bonds} /></div>
<div bind:this={views.bornhaber}><BornHaber prefs={bh} hidden={mode !== 'bornhaber'} bind:stats={stats.bornhaber} /></div>
<div bind:this={views.entropy}><Entropy prefs={ent} hidden={mode !== 'entropy'} bind:stats={stats.entropy} /></div>
<div bind:this={views.practice}><Practice {score} bind:topic={topic.t} hidden={mode !== 'practice'} /></div>
