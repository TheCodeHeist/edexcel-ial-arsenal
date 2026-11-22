<script lang="ts">
  /* Waves Lab: every statement of spec section 2.3 (Waves and Particle Nature of Light, 33–63) as a tab with a hash
     route. #wave (the wave on a rope and a slinky), #ripple (superposition, interference, Huygens and diffraction in a
     ripple tank), #standing (stationary waves, Core Practicals 4 and 5), #light (refraction, TIR, polarisation,
     intensity), #grating (diffraction grating, Core Practical 6, electron diffraction), #echo (pulse–echo), #photon
     (photoelectric effect, line spectra) and #practice. Each tab owns its prefs and reports its own status numbers. */
  import { onMount, tick } from 'svelte';
  import { persisted } from '../../lib/persist.svelte';
  import { glint, fadeIn } from '../../lib/motion';
  import SimHeader from '../../components/ui/SimHeader.svelte';
  import StatusLine from '../../components/ui/StatusLine.svelte';
  import Bench, { BENCH, type BenchPrefs } from './Bench.svelte';
  import Ripple, { RIPPLE, type RipplePrefs } from './Ripple.svelte';
  import Standing, { STAND, type StandPrefs } from './Standing.svelte';
  import Light, { LIGHT, type LightPrefs } from './Light.svelte';
  import Grating, { GRATE, type GratePrefs } from './Grating.svelte';
  import Echo, { ECHO, type EchoPrefs } from './Echo.svelte';
  import Photon, { PHOTON, type PhotonPrefs } from './Photon.svelte';
  import Practice, { type PScore } from './Practice.svelte';
  import type { Topic } from './practice';

  type Mode = 'wave' | 'ripple' | 'standing' | 'light' | 'grating' | 'echo' | 'photon' | 'practice';
  type Stats = [string, string | number][];

  const bench = persisted<BenchPrefs>('waves-wave', BENCH);
  const ripple = persisted<RipplePrefs>('waves-ripple', RIPPLE);
  const stand = persisted<StandPrefs>('waves-standing', STAND);
  const light = persisted<LightPrefs>('waves-light', LIGHT);
  const grate = persisted<GratePrefs>('waves-grating', GRATE);
  const echo = persisted<EchoPrefs>('waves-echo', ECHO);
  const photon = persisted<PhotonPrefs>('waves-photon', PHOTON);
  const score = persisted<PScore>('waves-score', { right: 0, total: 0, streak: 0, best: 0 });
  const topic = persisted<{ t: Topic | 'all' }>('waves-topic', { t: 'all' });
  score.streak = 0;

  let mode = $state<Mode>('wave');
  const views: Record<Mode, HTMLElement | undefined> = $state({ wave: undefined, ripple: undefined, standing: undefined, light: undefined, grating: undefined, echo: undefined, photon: undefined, practice: undefined });
  const TABS = [
    ['wave', 'Waves', 'Waves'], ['ripple', 'Ripple tank', 'Ripple'], ['standing', 'Standing waves', 'Standing'], ['light', 'Light', 'Light'],
    ['grating', 'Diffraction', 'Diffract'], ['echo', 'Pulse–echo', 'Echo'], ['photon', 'Photons', 'Photons'], ['practice', 'Practice', 'Quiz'],
  ] as const;
  const INFO: Record<Mode, [string, string]> = {
    wave: ['Waves', 'Set the amplitude, frequency and speed; drag the view to turn it; move the two markers to compare their phase.'],
    ripple: ['Ripple tank', 'Place the sources or the barrier, then probe any point for its path and phase difference.'],
    standing: ['Standing waves', 'Tune the vibration generator until the string resonates, then change the tension, length or wire.'],
    light: ['Light', 'Refract a ray through a block and find where total internal reflection begins, polarise light, or see how intensity falls with distance.'],
    grating: ['Diffraction', 'Shine a laser through a grating and measure the orders, or fire electrons at graphite.'],
    echo: ['Pulse–echo', 'Send a pulse, time the echoes, and see what limits how much detail comes back.'],
    photon: ['Photons', 'Shine light on a metal and find the threshold; then light up an atom and read its spectrum.'],
    practice: ['Practice', 'Answer, then check the working.'],
  };
  let stats = $state<Record<Mode, Stats>>({ wave: [], ripple: [], standing: [], light: [], grating: [], echo: [], photon: [], practice: [] });
  const shown = $derived<Stats>(mode === 'practice' ? [['Correct', `${score.right}/${score.total}`], ['Streak', score.streak], ['Best', score.best]] : stats[mode]);

  function setMode(m: Mode) {
    const prev = mode;
    mode = m;
    if (prev !== m) tick().then(() => fadeIn(views[m]?.firstElementChild as HTMLElement));
  }
  const MODES = TABS.map((t) => t[0]) as readonly Mode[];
  function fromHash() {
    const h = location.hash.slice(1) as Mode;
    setMode(MODES.includes(h) ? h : 'wave');
  }
  fromHash();
  $effect(() => { const h = '#' + mode; if (location.hash !== h) history.replaceState(null, '', h); });

  onMount(() => {
    addEventListener('hashchange', fromHash);
    glint('.exbtn,.qpanel');
    return () => removeEventListener('hashchange', fromHash);
  });
</script>

<SimHeader title="Waves Lab" eyebrow="Edexcel IAL Physics · Unit 2 · Waves and the particle nature of light"
  back={{ href: '/physics/', label: 'Arsenal' }} tabs={TABS} value={mode} onselect={setMode} />
<StatusLine label={INFO[mode][0]} hint={INFO[mode][1]} stats={shown} />

<div bind:this={views.wave}><Bench prefs={bench} hidden={mode !== 'wave'} bind:stats={stats.wave} /></div>
<div bind:this={views.ripple}><Ripple prefs={ripple} hidden={mode !== 'ripple'} bind:stats={stats.ripple} /></div>
<div bind:this={views.standing}><Standing prefs={stand} hidden={mode !== 'standing'} bind:stats={stats.standing} /></div>
<div bind:this={views.light}><Light prefs={light} hidden={mode !== 'light'} bind:stats={stats.light} /></div>
<div bind:this={views.grating}><Grating prefs={grate} hidden={mode !== 'grating'} bind:stats={stats.grating} /></div>
<div bind:this={views.echo}><Echo prefs={echo} hidden={mode !== 'echo'} bind:stats={stats.echo} /></div>
<div bind:this={views.photon}><Photon prefs={photon} hidden={mode !== 'photon'} bind:stats={stats.photon} /></div>
<div bind:this={views.practice}><Practice {score} bind:topic={topic.t} hidden={mode !== 'practice'} /></div>
