<script lang="ts">
  /* Fields Lab: Edexcel IAL Physics Unit 4 (Electric & Magnetic Fields, EM Induction) + Unit 5 (Gravitational Fields).
     Tabs with hash routes: #electric, #magnetic, #lorentz, #induction, #gravity, #practice. */
  import { onMount, tick } from 'svelte';
  import { persisted } from '../../lib/persist.svelte';
  import { glint, fadeIn } from '../../lib/motion';
  import SimHeader from '../../components/ui/SimHeader.svelte';
  import StatusLine from '../../components/ui/StatusLine.svelte';
  import Electric, { ELECTRIC_PREFS, type ElectricPrefs } from './Electric.svelte';
  import Magnetic, { MAG_PREFS, type MagPrefs } from './Magnetic.svelte';
  import Lorentz, { LORENTZ_PREFS, type LorentzPrefs } from './Lorentz.svelte';
  import Induction, { IND_PREFS, type IndPrefs } from './Induction.svelte';
  import Gravity, { GRAVITY_PREFS, type GravityPrefs } from './Gravity.svelte';
  import Practice, { type PScore } from './Practice.svelte';
  import type { Topic } from './practice';
  import { provideFieldsTools } from './kernel';

  type Mode = 'electric' | 'magnetic' | 'lorentz' | 'induction' | 'gravity' | 'practice';
  type Stats = [string, string | number][];

  const elec = persisted<ElectricPrefs>('fields-electric', ELECTRIC_PREFS);
  const mag = persisted<MagPrefs>('fields-magnetic', MAG_PREFS);
  const lor = persisted<LorentzPrefs>('fields-lorentz', LORENTZ_PREFS);
  const ind = persisted<IndPrefs>('fields-induction', IND_PREFS);
  const grav = persisted<GravityPrefs>('fields-gravity', GRAVITY_PREFS);
  const score = persisted<PScore>('fields-score', { right: 0, total: 0, streak: 0, best: 0 });
  const topic = persisted<{ t: Topic | 'all' }>('fields-topic', { t: 'all' });
  score.streak = 0;

  let mode = $state<Mode>('electric');
  const views: Record<Mode, HTMLElement | undefined> = $state({
    electric: undefined, magnetic: undefined, lorentz: undefined, induction: undefined, gravity: undefined, practice: undefined,
  });
  let elecCmp = $state<Electric>(), magCmp = $state<Magnetic>(), lorCmp = $state<Lorentz>();
  let indCmp = $state<Induction>(), gravCmp = $state<Gravity>(), practiceCmp = $state<Practice>();

  const TABS = [
    ['electric', 'Electric fields', 'Electric'],
    ['magnetic', 'Magnetic & F=BIL', 'Magnetic'],
    ['lorentz', 'Charged particles', 'BQv'],
    ['induction', 'EM induction', 'Induction'],
    ['gravity', 'Gravity vs Electric', 'Gravity'],
    ['practice', 'Practice', 'Quiz'],
  ] as const;

  const INFO: Record<Mode, [string, string]> = {
    electric: ['Electric fields', 'Explore 3D radial fields, dipoles, neutral points, equipotentials and uniform parallel plates (E = V/d).'],
    magnetic: ['Magnetic fields', 'Test Fleming’s Left-Hand Rule with F = BIL sin θ, plus straight-wire and solenoid field lines in 3D.'],
    lorentz: ['Charged particles', 'Watch circular magnetic orbits (r = mv/BQ) and balance crossed E and B fields in a velocity selector (v = E/B).'],
    induction: ['EM induction', 'Drive a rotating AC generator or plunge a magnet through a coil; read flux linkage NΦ and induced e.m.f. ε live.'],
    gravity: ['Gravity vs Electric', 'Orbit a 3D gravitational potential well (−GM/r), test geostationary altitude, and compare gravity with electric fields.'],
    practice: ['Practice', 'Answer exam-style WPH14 / WPH15 fields questions, then check the working.'],
  };

  let stats = $state<Record<Mode, Stats>>({
    electric: [], magnetic: [], lorentz: [], induction: [], gravity: [], practice: [],
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
    setMode(MODES.includes(h) ? h : 'electric');
  }
  fromHash();
  $effect(() => { const h = '#' + mode; if (location.hash !== h) history.replaceState(null, '', h); });

  onMount(() => {
    addEventListener('hashchange', fromHash);
    glint('.panel,.qpanel');
    const unprovide = provideFieldsTools({
      getMode: () => mode, setMode, elec, mag, lor, ind, grav, score, topic,
      cmp: {
        elec: () => elecCmp, mag: () => magCmp, lor: () => lorCmp,
        ind: () => indCmp, grav: () => gravCmp, practice: () => practiceCmp,
      },
    });
    return () => { removeEventListener('hashchange', fromHash); unprovide(); };
  });
</script>

<SimHeader title="Fields Lab" eyebrow="Edexcel IAL Physics · Units 4 & 5 · Electric, magnetic & gravitational fields"
  back={{ href: '/physics/', label: 'Arsenal' }} tabs={TABS} value={mode} onselect={setMode} />
<StatusLine label={INFO[mode][0]} hint={INFO[mode][1]} stats={shown} />

<div bind:this={views.electric}><Electric bind:this={elecCmp} prefs={elec} hidden={mode !== 'electric'} bind:stats={stats.electric} /></div>
<div bind:this={views.magnetic}><Magnetic bind:this={magCmp} prefs={mag} hidden={mode !== 'magnetic'} bind:stats={stats.magnetic} /></div>
<div bind:this={views.lorentz}><Lorentz bind:this={lorCmp} prefs={lor} hidden={mode !== 'lorentz'} bind:stats={stats.lorentz} /></div>
<div bind:this={views.induction}><Induction bind:this={indCmp} prefs={ind} hidden={mode !== 'induction'} bind:stats={stats.induction} /></div>
<div bind:this={views.gravity}><Gravity bind:this={gravCmp} prefs={grav} hidden={mode !== 'gravity'} bind:stats={stats.gravity} /></div>
<div bind:this={views.practice}><Practice bind:this={practiceCmp} {score} bind:topic={topic.t} hidden={mode !== 'practice'} /></div>
