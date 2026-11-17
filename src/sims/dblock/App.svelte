<script lang="ts">
  /* d-Block Colour Bench. Four modes (Explore, Predict, Unknown ion, Colour atlas) with hash routes:
     #explore #predict #unknown #atlas, and #reactions / #flowchart for the atlas reaction views. */
  import { onMount, tick } from 'svelte';
  import { persisted } from '../../lib/persist.svelte';
  import { glint, fadeIn } from '../../lib/motion';
  import { RM } from '../../lib/util';
  import SimHeader from '../../components/ui/SimHeader.svelte';
  import StatusLine from '../../components/ui/StatusLine.svelte';
  import Bench from './Bench.svelte';
  import Atlas from './Atlas.svelte';
  import { Bench as BenchState, type Mode, type Score } from './bench.svelte';
  import { SP, T, SHELF, rxAmt, type Transition } from './data';

  const score = persisted<Score>('dblock-score', { pRight: 0, pTotal: 0, streak: 0, best: 0, uSolved: 0, uTotal: 0, aRight: 0, aTotal: 0 });
  score.streak = 0; // a streak never carries over between visits
  const bench = new BenchState(score);

  let sub = $state<'species' | 'reactions'>('species');
  let layout = $state<'cards' | 'flow'>('cards');
  let quiz = $state(false);
  let benchEl = $state<HTMLElement>(), atlasEl = $state<HTMLElement>();

  const TABS = [['explore', 'Explore'], ['predict', 'Predict'], ['unknown', 'Unknown ion', 'Unknown'], ['atlas', 'Colour atlas', 'Atlas']] as const;
  const INFO: Record<Mode, [string, string]> = {
    explore: ['Explore', 'Pick a stock solution, add reagents and watch the tube.'],
    predict: ['Predict', 'Choose what you will see before each reaction runs.'],
    unknown: ['Unknown ion', 'Test the mystery solution, then name the metal ion.'],
    atlas: ['Colour atlas', 'Every species and reaction on the specification.'],
  };

  const stats = $derived.by((): [string, string | number][] => {
    switch (bench.mode) {
      case 'predict': return [['Correct', `${score.pRight}/${score.pTotal}`], ['Streak', score.streak], ['Best', score.best]];
      case 'unknown': return [['Solved', `${score.uSolved}/${score.uTotal}`], ['Wrong guesses', bench.unkTries]];
      case 'atlas': return quiz ? [['Self-test', `${score.aRight}/${score.aTotal}`]] : [['Species', Object.keys(SP).length], ['Reactions', T.length]];
      default: return [['Notebook', bench.entries.length], ['Stock solutions', SHELF.length]];
    }
  });

  function setMode(m: Mode) {
    const prev = bench.mode;
    if (bench.busy && m !== prev) return;
    bench.cancelAsk();
    bench.mode = m;
    if ((prev === 'atlas') !== (m === 'atlas')) tick().then(() => fadeIn(m === 'atlas' ? atlasEl : benchEl));
    if (m === 'unknown' && (prev !== 'unknown' || !bench.unknown)) bench.newUnknown();
    else if (m !== 'atlas' && prev === 'unknown') bench.fresh(bench.start);
  }

  /* routing: the hash names the mode, or the atlas reaction view */
  const hashFor = () => (bench.mode === 'atlas' && sub === 'reactions' ? (layout === 'flow' ? 'flowchart' : 'reactions') : bench.mode);
  function fromHash() {
    const h = location.hash.slice(1);
    if (h === 'flowchart' || h === 'reactions') { sub = 'reactions'; layout = h === 'flowchart' ? 'flow' : 'cards'; setMode('atlas'); }
    else if (h === 'atlas') { sub = 'species'; setMode('atlas'); }
    else setMode((['explore', 'predict', 'unknown'] as const).find((m) => m === h) ?? 'explore');
  }
  fromHash(); // read the starting route before the effect below starts writing it
  $effect(() => { const h = '#' + hashFor(); if (location.hash !== h) history.replaceState(null, '', h); });

  function run(t: Transition) {
    if (bench.busy) return;
    setMode('explore');
    setTimeout(() => {
      bench.tube?.resize(); bench.fresh(t.f); bench.act(t.r, rxAmt(t));
      scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' });
    }, 60);
  }

  onMount(() => {
    if (bench.mode !== 'unknown') bench.fresh('Cu2');
    addEventListener('hashchange', fromHash);
    glint('.at,.rx,.reagent,.bottle,.flow,.tp-row');
    return () => removeEventListener('hashchange', fromHash);
  });
</script>

<SimHeader title="d-Block Colour Bench" eyebrow="Edexcel IAL Chemistry · Units 5 & 6 · Transition metals"
  back={{ href: '/chemistry/', label: 'Arsenal' }} tabs={TABS} value={bench.mode} onselect={setMode} />
<StatusLine label={INFO[bench.mode][0]} hint={INFO[bench.mode][1]} {stats} />

<div bind:this={benchEl}><Bench {bench} hidden={bench.mode === 'atlas'} /></div>
<div bind:this={atlasEl}><Atlas {score} bind:sub bind:layout bind:quiz onrun={run} hidden={bench.mode !== 'atlas'} /></div>
