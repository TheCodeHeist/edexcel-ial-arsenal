<script lang="ts">
  /* Atoms & Bonding Lab: Edexcel IAL Chemistry Unit 1 (WCH11) + Intermolecular Forces (Topic 8).
     Tabs with hash routes: #shapes, #orbitals, #ie, #lattices, #imf, #massspec, #practice. */
  import { onMount, tick } from 'svelte';
  import { persisted } from '../../lib/persist.svelte';
  import { glint, fadeIn } from '../../lib/motion';
  import SimHeader from '../../components/ui/SimHeader.svelte';
  import StatusLine from '../../components/ui/StatusLine.svelte';
  import Shapes, { SHAPES, type ShapesPrefs } from './Shapes.svelte';
  import Orbitals, { ORBITALS, type OrbitalsPrefs } from './Orbitals.svelte';
  import Ionisation, { IE_PREFS, type IePrefs } from './Ionisation.svelte';
  import Lattices, { LATTICES_PREFS, type LatticesPrefs } from './Lattices.svelte';
  import Imf, { IMF_PREFS, type ImfPrefs } from './Imf.svelte';
  import MassSpec, { MASS_PREFS, type MassPrefs } from './MassSpec.svelte';
  import Practice, { type PScore } from './Practice.svelte';
  import type { Topic } from './practice';

  type Mode = 'shapes' | 'orbitals' | 'ie' | 'lattices' | 'imf' | 'massspec' | 'practice';
  type Stats = [string, string | number][];

  const shapes = persisted<ShapesPrefs>('atoms-shapes', SHAPES);
  const orbitals = persisted<OrbitalsPrefs>('atoms-orbitals', ORBITALS);
  const ie = persisted<IePrefs>('atoms-ie', IE_PREFS);
  const lattices = persisted<LatticesPrefs>('atoms-lattices', LATTICES_PREFS);
  const imf = persisted<ImfPrefs>('atoms-imf', IMF_PREFS);
  const mass = persisted<MassPrefs>('atoms-mass', MASS_PREFS);
  const score = persisted<PScore>('atoms-score', { right: 0, total: 0, streak: 0, best: 0 });
  const topic = persisted<{ t: Topic | 'all' }>('atoms-topic', { t: 'all' });
  score.streak = 0;

  let mode = $state<Mode>('shapes');
  const views: Record<Mode, HTMLElement | undefined> = $state({
    shapes: undefined, orbitals: undefined, ie: undefined, lattices: undefined, imf: undefined, massspec: undefined, practice: undefined,
  });

  const TABS = [
    ['shapes', 'Shapes & polarity', 'Shapes'],
    ['orbitals', 'Orbitals', 'Orbitals'],
    ['ie', 'Ionisation energy', 'IE'],
    ['lattices', 'Crystal lattices', 'Lattices'],
    ['imf', 'Intermolecular forces', 'IMFs'],
    ['massspec', 'Mass spec', 'Mass'],
    ['practice', 'Practice', 'Quiz'],
  ] as const;

  const INFO: Record<Mode, [string, string]> = {
    shapes: ['Shapes & polarity', 'Inspect spec molecules or build your own VSEPR shape; toggle lone pairs, bond angles and dipoles.'],
    orbitals: ['Orbitals & filling', 'Rotate 3D s, p and d probability clouds and fill electrons-in-boxes for Z = 1–36, including Cr, Cu and ions.'],
    ie: ['Ionisation energy', 'Explore the Be → B and N → O dips across Periods 2–3, or deduce a group from successive IE jumps.'],
    lattices: ['Crystal lattices', 'Rotate 3D giant ionic, covalent, metallic and molecular lattices; apply shear stress to test brittleness vs malleability.'],
    imf: ['Intermolecular forces', 'Compare London, permanent dipole and hydrogen bonding in 3D, and read the hydride boiling-point spikes.'],
    massspec: ['Mass spectrometer', 'Fire isotope pulses down a TOF drift tube or magnetic sector and calculate Ar from the spectrum.'],
    practice: ['Practice', 'Answer exam-style WCH11 questions, then check the working.'],
  };

  let stats = $state<Record<Mode, Stats>>({
    shapes: [], orbitals: [], ie: [], lattices: [], imf: [], massspec: [], practice: [],
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
    setMode(MODES.includes(h) ? h : 'shapes');
  }
  fromHash();
  $effect(() => { const h = '#' + mode; if (location.hash !== h) history.replaceState(null, '', h); });

  onMount(() => {
    addEventListener('hashchange', fromHash);
    glint('.panel,.qpanel');
    return () => removeEventListener('hashchange', fromHash);
  });
</script>

<SimHeader title="Atoms & Bonding Lab" eyebrow="Edexcel IAL Chemistry · Unit 1 (WCH11) · Structure, bonding & periodicity"
  back={{ href: '/chemistry/', label: 'Arsenal' }} tabs={TABS} value={mode} onselect={setMode} />
<StatusLine label={INFO[mode][0]} hint={INFO[mode][1]} stats={shown} />

<div bind:this={views.shapes}><Shapes prefs={shapes} hidden={mode !== 'shapes'} bind:stats={stats.shapes} /></div>
<div bind:this={views.orbitals}><Orbitals prefs={orbitals} hidden={mode !== 'orbitals'} bind:stats={stats.orbitals} /></div>
<div bind:this={views.ie}><Ionisation prefs={ie} hidden={mode !== 'ie'} bind:stats={stats.ie} /></div>
<div bind:this={views.lattices}><Lattices prefs={lattices} hidden={mode !== 'lattices'} bind:stats={stats.lattices} /></div>
<div bind:this={views.imf}><Imf prefs={imf} hidden={mode !== 'imf'} bind:stats={stats.imf} /></div>
<div bind:this={views.massspec}><MassSpec prefs={mass} hidden={mode !== 'massspec'} bind:stats={stats.massspec} /></div>
<div bind:this={views.practice}><Practice {score} bind:topic={topic.t} hidden={mode !== 'practice'} /></div>
