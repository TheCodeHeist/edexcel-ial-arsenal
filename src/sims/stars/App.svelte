<script lang="ts">
  /* Star Lab. Five modes with hash routes: #life (a star's life in 3D), #hr (the HR diagram of named stars), #binary,
     the distance views #parallax, #candles, #hubble and #fate (sub-tabs of Distance), and #practice. */
  import { onMount, tick } from 'svelte';
  import { persisted } from '../../lib/persist.svelte';
  import { glint, fadeIn } from '../../lib/motion';
  import SimHeader from '../../components/ui/SimHeader.svelte';
  import StatusLine from '../../components/ui/StatusLine.svelte';
  import SubTabs from '../../components/ui/SubTabs.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import Life, { type LifePrefs } from './Life.svelte';
  import HRView, { type HRPrefs } from './HRView.svelte';
  import Parallax, { type PxPrefs } from './Parallax.svelte';
  import Candles, { type CandlePrefs } from './Candles.svelte';
  import Hubble, { type HubblePrefs } from './Hubble.svelte';
  import Fate, { type FatePrefs } from './Fate.svelte';
  import Practice, { type PScore } from './Practice.svelte';
  import Binary, { type BinPrefs } from './Binary.svelte';
  import { SYSTEMS, periodYears } from './binary';
  import { TOPICS, type Topic } from './practice';
  import { track, at } from './evolve';
  import { short, STARS } from './data';

  type Mode = 'life' | 'hr' | 'binary' | 'distance' | 'practice';
  type Sub = 'parallax' | 'candles' | 'hubble' | 'fate';

  const life = persisted<LifePrefs>('stars-life', { M: 1, x: 0.3, speed: 1, spin: true });
  const hr = persisted<HRPrefs>('stars-hr', { sel: 'sirius-b', vs: 'sirius-a', regions: true, radii: true, tracks: false, labels: true, norm: false });
  const px = persisted<PxPrefs>('stars-parallax', { star: 'proxima', d: 10, month: 0 });
  const cand = persisted<CandlePrefs>('stars-candles', { kind: 'cepheid', seed: 1, solved: 0 });
  const hub = persisted<HubblePrefs>('stars-hubble', { seed: 1, sel: 0, done: [] });
  const fate = persisted<FatePrefs>('stars-fate', { omega: 1, lambda: false, H0: 70, halo: 0 });
  const bin = persisted<BinPrefs>('stars-binary', { sys: 'sirius', earth: false, speed: 1 });
  const score = persisted<PScore>('stars-score', { right: 0, total: 0, streak: 0, best: 0 });
  const topic = persisted<{ t: Topic | 'all' }>('stars-topic', { t: 'all' });
  score.streak = 0;

  let mode = $state<Mode>('life');
  let sub = $state<Sub>('parallax');
  const views: Record<Mode, HTMLElement | undefined> = $state({ life: undefined, hr: undefined, binary: undefined, distance: undefined, practice: undefined });
  const TABS = [['life', 'Life cycle', 'Life'], ['hr', 'HR diagram', 'HR'], ['binary', 'Binaries', 'Pairs'], ['distance', 'Distances', 'Dist.'], ['practice', 'Practice', 'Quiz']] as const;
  const SUBS = [['parallax', 'Parallax'], ['candles', 'Standard candles'], ['hubble', 'Redshift and Hubble'], ['fate', 'Fate and dark matter']] as const;
  const INFO: Record<Mode | Sub, [string, string]> = {
    life: ['Life cycle', 'Pick a mass, then play or scrub through its life. Drag the view to turn it.'],
    hr: ['HR diagram', 'Pick a star on the diagram to see its numbers and compare it with another.'],
    binary: ['Binaries', 'Pick a system; watch the orbit, the light curve and the Doppler-shifted lines together.'],
    distance: ['Distances', ''],
    parallax: ['Parallax', 'Move the Earth round its orbit and watch the nearby star shift.'],
    candles: ['Standard candles', 'Read the light curve, find the luminosity, then work out the distance.'],
    hubble: ['Redshift and Hubble', 'Measure each galaxy’s redshift, plot v against d, find H₀ and the age.'],
    fate: ['Fate and dark matter', 'Change the density and see how the universe ends; fit a galaxy’s rotation.'],
    practice: ['Practice', 'Answer, then check the working.'],
  };
  const key = $derived<Mode | Sub>(mode === 'distance' ? sub : mode);

  const stats = $derived.by((): [string, string | number][] => {
    switch (key) {
      case 'life': { const n = at(track(life.M), life.x); return [['Mass', `${short(life.M, 2)} M☉`], ['Stage', n.stage.name]]; }
      case 'hr': return [['Stars', STARS.length]];
      case 'binary': { const sy = SYSTEMS.find((x) => x.id === bin.sys) ?? SYSTEMS[0]; const P = periodYears(sy); return [['Period', P < 1 ? `${short(P * 365.25, 3)} d` : `${short(P, 3)} yr`]]; }
      case 'parallax': return [];
      case 'candles': return [['Solved', cand.solved]];
      case 'hubble': return [['Plotted', `${hub.done.length}/8`]];
      case 'fate': return [['H₀', fate.H0]];
      default: return [['Correct', `${score.right}/${score.total}`], ['Streak', score.streak], ['Best', score.best]];
    }
  });

  function setMode(m: Mode) {
    const prev = mode;
    mode = m;
    if (prev !== m) tick().then(() => fadeIn(views[m]?.firstElementChild as HTMLElement));
  }
  function fromHash() {
    const h = location.hash.slice(1);
    if (h === 'parallax' || h === 'candles' || h === 'hubble' || h === 'fate') { sub = h; setMode('distance'); }
    else if (h === 'distance') setMode('distance');
    else setMode(h === 'hr' || h === 'practice' || h === 'binary' ? h : 'life');
  }
  fromHash();
  $effect(() => { const h = '#' + key; if (location.hash !== h) history.replaceState(null, '', h); });

  onMount(() => {
    addEventListener('hashchange', fromHash);
    glint('.exbtn,.qpanel,.card');
    return () => removeEventListener('hashchange', fromHash);
  });
</script>

<SimHeader title="Star Lab" eyebrow="Edexcel IAL Physics · Unit 5 · Astrophysics and cosmology"
  back={{ href: '/physics/', label: 'Arsenal' }} tabs={TABS} value={mode} onselect={setMode} />
<StatusLine label={INFO[key][0]} hint={INFO[key][1]} {stats} />
{#if mode === 'distance'}
  <div class="subbar"><SubTabs label="Distance method" options={SUBS} bind:value={sub} /></div>
{:else if mode === 'practice'}
  <div class="scope"><Seg label="Topic" options={TOPICS} bind:value={topic.t} /></div>
{/if}

<div bind:this={views.life}><Life prefs={life} hidden={mode !== 'life'} /></div>
<div bind:this={views.hr}><HRView prefs={hr} hidden={mode !== 'hr'} /></div>
<div bind:this={views.binary}><Binary prefs={bin} hidden={mode !== 'binary'} /></div>
<div bind:this={views.distance}>
  <div>
    <Parallax prefs={px} hidden={mode !== 'distance' || sub !== 'parallax'} />
    <Candles prefs={cand} hidden={mode !== 'distance' || sub !== 'candles'} />
    <Hubble prefs={hub} hidden={mode !== 'distance' || sub !== 'hubble'} />
    <Fate prefs={fate} hidden={mode !== 'distance' || sub !== 'fate'} />
  </div>
</div>
<div bind:this={views.practice}><Practice {score} topic={topic.t} hidden={mode !== 'practice'} /></div>
