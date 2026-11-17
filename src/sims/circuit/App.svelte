<script lang="ts">
  /* Circuit Builder. Three modes with hash routes: #build, #predict, and the I–V Lab as #iv or #emf. */
  import { onMount, tick } from 'svelte';
  import { persisted } from '../../lib/persist.svelte';
  import { glint, fadeIn } from '../../lib/motion';
  import SimHeader from '../../components/ui/SimHeader.svelte';
  import StatusLine from '../../components/ui/StatusLine.svelte';
  import Build from './Build.svelte';
  import Predict, { type PScore } from './Predict.svelte';
  import Lab from './Lab.svelte';
  import type { Flow } from './Board.svelte';
  import { Editor } from './editor.svelte';
  import { EXAMPLES } from './examples';
  import { solve } from './solve';
  import type { CircuitData } from './parts';

  type Mode = 'build' | 'predict' | 'lab';

  const board = persisted<CircuitData & { example: string }>('circuit-board', { ...EXAMPLES[0].data(), example: EXAMPLES[0].id });
  const prefs = persisted<{ flow: Flow; values: boolean; zoom: number; zoomPhone: number }>('circuit-prefs', { flow: 'conv', values: true, zoom: 1, zoomPhone: 2 });
  const score = persisted<PScore & { cells: number }>('circuit-score', { right: 0, total: 0, streak: 0, best: 0, cells: 0 });
  score.streak = 0; // a streak never carries over between visits

  const ed = new Editor(board);
  const sol = $derived(solve(board));

  let mode = $state<Mode>('build');
  let sub = $state<'iv' | 'emf'>('iv');
  const views: Record<Mode, HTMLElement | undefined> = $state({ build: undefined, predict: undefined, lab: undefined });

  const TABS = [['build', 'Build'], ['predict', 'Predict'], ['lab', 'I–V Lab', 'Lab']] as const;
  const INFO: Record<Mode, [string, string]> = {
    build: ['Build', 'Add parts, drag between terminals to wire them, and watch the meters.'],
    predict: ['Predict', 'Work out the hidden meter reading, then check it on the live circuit.'],
    lab: ['I–V Lab', 'Take readings, plot the graph and explain its shape.'],
  };

  const meters = $derived(board.parts.filter((p) => p.kind === 'ammeter' || p.kind === 'voltmeter').length);
  const stats = $derived.by((): [string, string | number][] => {
    switch (mode) {
      case 'predict': return [['Correct', `${score.right}/${score.total}`], ['Streak', score.streak], ['Best', score.best]];
      case 'lab': return sub === 'emf' ? [['Cells measured', score.cells]] : [['Parts to test', 6]];
      default: return [['Parts', board.parts.length], ['Wires', board.wires.length], ['Meters', meters]];
    }
  });

  function setMode(m: Mode) {
    const prev = mode;
    mode = m;
    if (prev !== m) tick().then(() => fadeIn(views[m]?.firstElementChild as HTMLElement));
  }

  /* routing */
  function fromHash() {
    const h = location.hash.slice(1);
    if (h === 'iv' || h === 'emf') { sub = h; setMode('lab'); }
    else setMode(h === 'predict' ? 'predict' : 'build');
  }
  fromHash(); // read the starting route before the effect below starts writing it
  $effect(() => { const h = '#' + (mode === 'lab' ? sub : mode); if (location.hash !== h) history.replaceState(null, '', h); });

  onMount(() => {
    addEventListener('hashchange', fromHash);
    glint('.pbtn,.exbtn,.tp-row,.qpanel');
    return () => removeEventListener('hashchange', fromHash);
  });
</script>

<SimHeader title="Circuit Builder" eyebrow="Edexcel IAL Physics · Units 2 & 3 · Electric circuits"
  back={{ href: '/physics/', label: 'Arsenal' }} tabs={TABS} value={mode} onselect={setMode} />
<StatusLine label={INFO[mode][0]} hint={INFO[mode][1]} {stats} />

<div bind:this={views.build}><Build {ed} {sol} {prefs} bind:example={board.example} hidden={mode !== 'build'} /></div>
<div bind:this={views.predict}><Predict {score} flow={prefs.flow} hidden={mode !== 'predict'} /></div>
<div bind:this={views.lab}><Lab bind:sub flow={prefs.flow} hidden={mode !== 'lab'} onfit={() => score.cells++} /></div>
