<script lang="ts">
  /* Particle Lab. Six modes with hash routes: #accel (electron gun, linac, cyclotron, synchrotron in 3D), #detect
     (cloud and bubble chambers, a collider detector), #nucleus (α-particle scattering), #table (every particle),
     #reactions (conservation laws, E = mc²), #matter (annihilation and pair production) and #practice. Each tab owns its prefs type and defaults and reports its
     own status-line numbers through `stats`. */
  import { onMount, tick } from 'svelte';
  import { persisted } from '../../lib/persist.svelte';
  import { glint, fadeIn } from '../../lib/motion';
  import SimHeader from '../../components/ui/SimHeader.svelte';
  import StatusLine from '../../components/ui/StatusLine.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import Accelerators, { ACCEL, type AccelPrefs } from './Accelerators.svelte';
  import Detectors, { DET, type DetPrefs } from './Detectors.svelte';
  import Scatter, { SCAT, type ScatPrefs } from './Scatter.svelte';
  import Zoo, { ZOO, type ZooPrefs } from './Zoo.svelte';
  import Rules, { RULES, type RulePrefs } from './Rules.svelte';
  import Matter, { MATTER, type MatterPrefs } from './Matter.svelte';
  import Practice, { type PScore } from './Practice.svelte';
  import { TOPICS, type Topic } from './practice';

  type Mode = 'accel' | 'detect' | 'nucleus' | 'table' | 'reactions' | 'matter' | 'practice';
  type Stats = [string, string | number][];

  const accel = persisted<AccelPrefs>('particles-accel', ACCEL);
  const det = persisted<DetPrefs>('particles-detect', DET);
  const scat = persisted<ScatPrefs>('particles-nucleus', SCAT);
  const zoo = persisted<ZooPrefs>('particles-table', ZOO);
  const rules = persisted<RulePrefs>('particles-reactions', RULES);
  const matter = persisted<MatterPrefs>('particles-matter', MATTER);
  const score = persisted<PScore>('particles-score', { right: 0, total: 0, streak: 0, best: 0 });
  const topic = persisted<{ t: Topic | 'all' }>('particles-topic', { t: 'all' });
  score.streak = 0;

  let mode = $state<Mode>('accel');
  const views: Record<Mode, HTMLElement | undefined> = $state({ accel: undefined, detect: undefined, nucleus: undefined, table: undefined, reactions: undefined, matter: undefined, practice: undefined });
  const TABS = [['accel', 'Accelerators', 'Accel'], ['detect', 'Detectors', 'Detect'], ['nucleus', 'Nucleus', 'Atom'], ['table', 'Particle table', 'Table'], ['reactions', 'Reactions', 'React'], ['matter', 'Annihilation', 'Pairs'], ['practice', 'Practice', 'Quiz']] as const;
  const INFO: Record<Mode, [string, string]> = {
    accel: ['Accelerators', 'Pick a machine, set the p.d. and the field, and watch the particles gain energy. Drag the view to turn it.'],
    detect: ['Detectors', 'Watch tracks form, then click one to identify it and measure its radius.'],
    nucleus: ['Nucleus', 'Fire α particles at gold foil and count where they go.'],
    table: ['Particle table', 'Pick any particle for its properties; flip to its antiparticle; build hadrons from quarks.'],
    reactions: ['Reactions', 'Check a reaction against the conservation laws, then work out the energy.'],
    matter: ['Annihilation', 'Annihilate a particle with its antiparticle, or turn a γ-ray into a pair, and follow the energy.'],
    practice: ['Practice', 'Answer, then check the working.'],
  };
  let stats = $state<Record<Mode, Stats>>({ accel: [], detect: [], nucleus: [], table: [], reactions: [], matter: [], practice: [] });
  const shown = $derived<Stats>(mode === 'practice' ? [['Correct', `${score.right}/${score.total}`], ['Streak', score.streak], ['Best', score.best]] : stats[mode]);

  function setMode(m: Mode) {
    const prev = mode;
    mode = m;
    if (prev !== m) tick().then(() => fadeIn(views[m]?.firstElementChild as HTMLElement));
  }
  const MODES = TABS.map((t) => t[0]) as readonly Mode[];
  function fromHash() {
    const h = location.hash.slice(1) as Mode;
    setMode(MODES.includes(h) ? h : 'accel');
  }
  fromHash();
  $effect(() => { const h = '#' + mode; if (location.hash !== h) history.replaceState(null, '', h); });

  onMount(() => {
    addEventListener('hashchange', fromHash);
    glint('.exbtn,.qpanel,.pcell');
    return () => removeEventListener('hashchange', fromHash);
  });
</script>

<SimHeader title="Particle Lab" eyebrow="Edexcel IAL Physics · Unit 4 · Nuclear and particle physics"
  back={{ href: '/physics/', label: 'Arsenal' }} tabs={TABS} value={mode} onselect={setMode} />
<StatusLine label={INFO[mode][0]} hint={INFO[mode][1]} stats={shown} />
{#if mode === 'practice'}
  <div class="scope"><Seg label="Topic" options={TOPICS} bind:value={topic.t} /></div>
{/if}

<div bind:this={views.accel}><Accelerators prefs={accel} hidden={mode !== 'accel'} bind:stats={stats.accel} /></div>
<div bind:this={views.detect}><Detectors prefs={det} hidden={mode !== 'detect'} bind:stats={stats.detect} /></div>
<div bind:this={views.nucleus}><Scatter prefs={scat} hidden={mode !== 'nucleus'} bind:stats={stats.nucleus} /></div>
<div bind:this={views.table}><Zoo prefs={zoo} hidden={mode !== 'table'} bind:stats={stats.table} /></div>
<div bind:this={views.reactions}><Rules prefs={rules} hidden={mode !== 'reactions'} bind:stats={stats.reactions} /></div>
<div bind:this={views.matter}><Matter prefs={matter} hidden={mode !== 'matter'} bind:stats={stats.matter} /></div>
<div bind:this={views.practice}><Practice {score} topic={topic.t} hidden={mode !== 'practice'} /></div>
