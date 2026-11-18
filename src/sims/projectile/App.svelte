<script lang="ts">
  /* Projectile Lab. Three modes with hash routes: #launch (the sandbox), #predict (exam-style questions drawn to
     scale) and #target (land it on the flag by working out the angle or the speed). */
  import { onMount, tick } from 'svelte';
  import { persisted } from '../../lib/persist.svelte';
  import { glint, fadeIn } from '../../lib/motion';
  import SimHeader from '../../components/ui/SimHeader.svelte';
  import StatusLine from '../../components/ui/StatusLine.svelte';
  import LaunchView, { type LPrefs } from './Launch.svelte';
  import Predict, { type PScore } from './Predict.svelte';
  import TargetView, { type TScore } from './Target.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { Launch } from './physics';
  import type { Course, TMode } from './target';

  type Mode = 'launch' | 'predict' | 'target';

  const prefs = persisted<LPrefs>('projectile-prefs', { u: 20, deg: 40, h: 0, g: 9.81, k: 0, strobe: true, shadows: false, vectors: true, aim: true, speed: 1, graph: 'y' });
  const tprefs = persisted<{ mode: TMode; course: Course }>('projectile-target', { mode: 'angle', course: 'flat' });
  const saved = persisted<{ shots: Launch[] }>('projectile-shots', { shots: [] });
  const score = persisted<PScore>('projectile-score', { right: 0, total: 0, streak: 0, best: 0 });
  const tscore = persisted<TScore>('projectile-tscore', { hits: 0, first: 0, shots: 0, streak: 0, best: 0 });
  score.streak = 0; tscore.streak = 0; // streaks never carry over between visits

  let mode = $state<Mode>('launch');
  const views: Record<Mode, HTMLElement | undefined> = $state({ launch: undefined, predict: undefined, target: undefined });
  const TABS = [['launch', 'Launch'], ['predict', 'Predict'], ['target', 'Target']] as const;
  const INFO: Record<Mode, [string, string]> = {
    launch: ['Launch', 'Set the speed, angle and height, fire, and compare the shots.'],
    predict: ['Predict', 'Work out the answer from the set-up, then watch the flight.'],
    target: ['Target', 'Work out the angle or speed on paper, then land it on the flag.'],
  };
  const stats = $derived.by((): [string, string | number][] => {
    switch (mode) {
      case 'predict': return [['Correct', `${score.right}/${score.total}`], ['Streak', score.streak], ['Best', score.best]];
      case 'target': return [['Hits', tscore.hits], ['First-shot', tscore.first], ['Streak', tscore.streak], ['Best', tscore.best]];
      default: return [['Shots', saved.shots.length], ['g', `${prefs.g} N kg⁻¹`]];
    }
  });

  function setMode(m: Mode) {
    const prev = mode;
    mode = m;
    if (prev !== m) tick().then(() => fadeIn(views[m]?.firstElementChild as HTMLElement));
  }
  function fromHash() {
    const h = location.hash.slice(1);
    setMode(h === 'predict' || h === 'target' ? h : 'launch');
  }
  fromHash();
  $effect(() => { const h = '#' + mode; if (location.hash !== h) history.replaceState(null, '', h); });

  onMount(() => {
    addEventListener('hashchange', fromHash);
    glint('.exbtn,.qpanel,.shot button');
    return () => removeEventListener('hashchange', fromHash);
  });
</script>

<SimHeader title="Projectile Lab" eyebrow="Edexcel IAL Physics · Unit 1 · Mechanics"
  back={{ href: '/physics/', label: 'Arsenal' }} tabs={TABS} value={mode} onselect={setMode} />
<StatusLine label={INFO[mode][0]} hint={INFO[mode][1]} {stats} />
{#if mode === 'target'}
  <div class="scope">
    <Seg label="You choose" options={[['angle', 'Choose the angle', 'Angle'], ['speed', 'Choose the speed', 'Speed']]} bind:value={tprefs.mode} />
    <Seg label="Course" options={[['flat', 'Open ground', 'Open'], ['raised', 'Raised target', 'Raised'], ['wall', 'Over a wall', 'Wall']]} bind:value={tprefs.course} />
  </div>
{/if}

<div bind:this={views.launch}><LaunchView {prefs} bind:shots={saved.shots} hidden={mode !== 'launch'} /></div>
<div bind:this={views.predict}><Predict {score} hidden={mode !== 'predict'} /></div>
<div bind:this={views.target}><TargetView score={tscore} prefs={tprefs} hidden={mode !== 'target'} /></div>
