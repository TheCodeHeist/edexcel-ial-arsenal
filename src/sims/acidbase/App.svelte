<script lang="ts">
  /* Acid–Base Lab: Edexcel IAL Chemistry Unit 4 (Topic 14: Acid–Base Equilibria) + Unit 3/6 titration skills.
     Tabs with hash routes: #strength, #titration, #burette, #buffers, #salts, #practice. */
  import { onMount, tick } from 'svelte';
  import { persisted } from '../../lib/persist.svelte';
  import { glint, fadeIn } from '../../lib/motion';
  import SimHeader from '../../components/ui/SimHeader.svelte';
  import StatusLine from '../../components/ui/StatusLine.svelte';
  import Strength, { STRENGTH_PREFS, type StrengthPrefs } from './Strength.svelte';
  import Titration, { TITRATION_PREFS, type TitrationPrefs } from './Titration.svelte';
  import Burette, { BURETTE_PREFS, type BurettePrefs } from './Burette.svelte';
  import Buffers, { BUFFERS_PREFS, type BuffersPrefs } from './Buffers.svelte';
  import Salts, { SALTS_PREFS, type SaltsPrefs } from './Salts.svelte';
  import Practice, { type PScore } from './Practice.svelte';
  import type { Topic } from './practice';

  type Mode = 'strength' | 'titration' | 'burette' | 'buffers' | 'salts' | 'practice';
  type Stats = [string, string | number][];

  const strength = persisted<StrengthPrefs>('acidbase-strength', STRENGTH_PREFS);
  const titration = persisted<TitrationPrefs>('acidbase-titration', TITRATION_PREFS);
  const burette = persisted<BurettePrefs>('acidbase-burette', BURETTE_PREFS);
  const buffers = persisted<BuffersPrefs>('acidbase-buffers', BUFFERS_PREFS);
  const salts = persisted<SaltsPrefs>('acidbase-salts', SALTS_PREFS);
  const score = persisted<PScore>('acidbase-score', { right: 0, total: 0, streak: 0, best: 0 });
  const topic = persisted<{ t: Topic | 'all' }>('acidbase-topic', { t: 'all' });
  score.streak = 0;

  let mode = $state<Mode>('strength');
  const views: Record<Mode, HTMLElement | undefined> = $state({
    strength: undefined, titration: undefined, burette: undefined, buffers: undefined, salts: undefined, practice: undefined,
  });

  const TABS = [
    ['strength', 'Strong & weak', 'Ka / Kw'],
    ['titration', 'Titration curves', 'Curves'],
    ['burette', 'Burette bench', 'Burette'],
    ['buffers', 'Buffers & blood', 'Buffers'],
    ['salts', 'Pairs & salts', 'Salts'],
    ['practice', 'Practice', 'Quiz'],
  ] as const;

  const INFO: Record<Mode, [string, string]> = {
    strength: ['Strong & weak acids', 'Compare 100% vs partial dissociation in 3D, calculate pH with Ka, and heat pure water to see Kw change.'],
    titration: ['Titration curves', 'Inspect all 4 acid–base curves, read pH = pKa at half-neutralisation, and test indicator suitability.'],
    burette: ['Burette bench', 'Titrate an unknown acid dropwise on a white tile, spot the faint end-point, and record concordant titres.'],
    buffers: ['Buffers & blood', 'Spike an ethanoate or blood buffer with H⁺ or OH⁻ and compare its tiny ΔpH against pure water.'],
    salts: ['Pairs & salts', 'Identify Brønsted–Lowry conjugate acid–base pairs and see why some salt solutions are acidic or alkaline.'],
    practice: ['Practice', 'Answer exam-style WCH14 & WCH13 acid–base questions, then check the working.'],
  };

  let stats = $state<Record<Mode, Stats>>({
    strength: [], titration: [], burette: [], buffers: [], salts: [], practice: [],
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
    setMode(MODES.includes(h) ? h : 'strength');
  }
  fromHash();
  $effect(() => { const h = '#' + mode; if (location.hash !== h) history.replaceState(null, '', h); });

  onMount(() => {
    addEventListener('hashchange', fromHash);
    glint('.panel,.qpanel');
    return () => removeEventListener('hashchange', fromHash);
  });
</script>

<SimHeader title="Acid–Base Lab" eyebrow="Edexcel IAL Chemistry · Units 3 & 4 · Acid–base equilibria & titrations"
  back={{ href: '/chemistry/', label: 'Arsenal' }} tabs={TABS} value={mode} onselect={setMode} />
<StatusLine label={INFO[mode][0]} hint={INFO[mode][1]} stats={shown} />

<div bind:this={views.strength}><Strength prefs={strength} hidden={mode !== 'strength'} bind:stats={stats.strength} /></div>
<div bind:this={views.titration}><Titration prefs={titration} hidden={mode !== 'titration'} bind:stats={stats.titration} /></div>
<div bind:this={views.burette}><Burette prefs={burette} hidden={mode !== 'burette'} bind:stats={stats.burette} /></div>
<div bind:this={views.buffers}><Buffers prefs={buffers} hidden={mode !== 'buffers'} bind:stats={stats.buffers} /></div>
<div bind:this={views.salts}><Salts prefs={salts} hidden={mode !== 'salts'} bind:stats={stats.salts} /></div>
<div bind:this={views.practice}><Practice {score} bind:topic={topic.t} hidden={mode !== 'practice'} /></div>
