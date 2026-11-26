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
  import { provideKernelTools } from '../../lib/kernel/live';
  import {
    clamp, num, matchMolecule, matchElementOrIon, validateCharge, matchOrbital, matchFirstIE, matchSuccIE,
    matchLattice, matchImf, matchTrend, matchSample, matchTopic,
    moleculeList, orbitalList, succList, latticeList, imfList, sampleList, topicList,
    describeShapes, describeOrbitals, describeIE, describeLattice, describeImf, describeMassSpec,
  } from './kernel';

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
  let ieRef = $state<ReturnType<typeof Ionisation>>();
  let massRef = $state<ReturnType<typeof MassSpec>>();
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

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  async function showMode(m: Mode) {
    if (mode !== m) { setMode(m); await tick(); await wait(40); }
  }

  const KERNEL_ABOUT = 'The Atoms & Bonding Lab is open: 3D VSEPR Shapes & Polarity, 3D Quantum Orbitals & Electron Configurations (Z = 1–36 and ions), Ionisation Energy trends & successive IE jumps, 3D Crystal Lattices with shear stress, 3D Intermolecular Forces & boiling-point trends, 3D Mass Spectrometer, and Practice. '
    + 'Its atoms_ tools switch tabs, inspect any molecule, orbital, element/ion, IE graph, lattice, IMF or mass spectrum on screen and return the live values; atoms_state reports what is shown now.';

  const kernelTools = () => provideKernelTools('atoms', KERNEL_ABOUT, [
    {
      name: 'atoms_state',
      description: 'Read the current Atoms & Bonding Lab state: active tab, selections, parameters with ranges/units, on-screen results, and lists of all selectable molecules, orbitals, lattices, IMFs, mass-spec samples and practice topics.',
      parameters: { type: 'object', properties: {} },
      run: () => {
        const cur = mode === 'shapes' ? describeShapes(shapes)
          : mode === 'orbitals' ? describeOrbitals(orbitals)
          : mode === 'ie' ? describeIE(ie, ieRef?.getMysteryInfo())
          : mode === 'lattices' ? describeLattice(lattices)
          : mode === 'imf' ? describeImf(imf)
          : mode === 'massspec' ? describeMassSpec(mass)
          : `Practice: topic = ${topic.t}, score = ${score.right}/${score.total}, streak = ${score.streak}, best = ${score.best}.`;
        return [
          `Mode: ${mode} (${INFO[mode][0]} — ${INFO[mode][1]})`,
          cur,
          'Available options:',
          moleculeList(), orbitalList(), 'Elements for orbitals: H (Z=1) to Kr (Z=36), charges −2 to +3.',
          '1st IE elements: H (Z=1) to Ca (Z=20). ' + succList(),
          latticeList(), imfList(), sampleList(), topicList(),
        ].join('\n');
      },
    },
    {
      name: 'atoms_mode',
      description: 'Switch the Atoms & Bonding Lab tab (shapes, orbitals, ie, lattices, imf, massspec, practice) and optionally pick a practice topic.',
      parameters: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['shapes', 'orbitals', 'ie', 'lattices', 'imf', 'massspec', 'practice'] },
          practice_topic: { type: 'string', description: 'Only for practice: all, shapes, orbitals, ie, lattices, imf, or massspec.' },
        },
        required: ['mode'],
      },
      run: async (a) => {
        const m = String(a.mode ?? '').toLowerCase() as Mode;
        if (!MODES.includes(m)) throw new Error(`mode must be one of: ${MODES.join(', ')}.`);
        if (m === 'practice' && a.practice_topic !== undefined) topic.t = matchTopic(String(a.practice_topic));
        await showMode(m);
        return `Now showing ${INFO[m][0]}: ${INFO[m][1]}` + (m === 'practice' ? ` (topic: ${topic.t}).` : '');
      },
    },
    {
      name: 'atoms_shape',
      description: 'Show a 3D molecular shape on the Shapes & Polarity tab: pick a spec molecule (e.g. SF6, NH3, H2O, NH4+, CO2, BF3, CH4, CHCl3, SO2, C2H4, PCl5, BeCl2, XeF4) OR use the VSEPR pair builder with bp and lp, and toggle lone pairs, bond angles or dipole arrows.',
      parameters: {
        type: 'object',
        properties: {
          molecule: { type: 'string', description: 'Preset molecule by formula or name (e.g. "SF6", "ammonia", "NH4+", "ethene").' },
          bp: { type: 'number', description: 'Pair builder: bonding pairs (2–6; total bp + lp kept in 2–6).' },
          lp: { type: 'number', description: 'Pair builder: lone pairs (0–3; total bp + lp kept in 2–6).' },
          show_lp: { type: 'boolean', description: 'Show lone-pair lobes.' },
          show_angles: { type: 'boolean', description: 'Show bond-angle arcs.' },
          show_dipoles: { type: 'boolean', description: 'Show bond dipole arrows (δ+ → δ−).' },
        },
      },
      run: async (a) => {
        await showMode('shapes');
        if (a.molecule !== undefined) {
          const m = matchMolecule(String(a.molecule));
          shapes.mode = 'preset'; shapes.preset = m.id;
        } else if (a.bp !== undefined || a.lp !== undefined) {
          shapes.mode = 'build';
          if (a.bp !== undefined) {
            shapes.bp = clamp(Math.round(num(a.bp, 'bp')), 2, 6);
            if (shapes.bp + shapes.lp > 6) shapes.lp = Math.max(0, 6 - shapes.bp);
            if (shapes.bp + shapes.lp < 2) shapes.lp = Math.max(0, 2 - shapes.bp);
          }
          if (a.lp !== undefined) {
            shapes.lp = clamp(Math.round(num(a.lp, 'lp')), 0, 3);
            if (shapes.bp + shapes.lp > 6) shapes.bp = Math.max(1, 6 - shapes.lp);
            if (shapes.bp + shapes.lp < 2) shapes.bp = Math.max(2 - shapes.lp, 1);
          }
        }
        if (typeof a.show_lp === 'boolean') shapes.showLP = a.show_lp;
        if (typeof a.show_angles === 'boolean') shapes.showAngles = a.show_angles;
        if (typeof a.show_dipoles === 'boolean') shapes.showDipoles = a.show_dipoles;
        return describeShapes(shapes);
      },
    },
    {
      name: 'atoms_orbitals',
      description: 'Show an element or ion’s electron configuration and electrons-in-boxes (Z = 1–36, including Cr, Cu and d-block ions) and/or a 3D quantum orbital cloud (1s, 2s, 2px, 2py, 2pz, 3dxy, 3dx2y2, 3dz2).',
      parameters: {
        type: 'object',
        properties: {
          element: { type: 'string', description: 'Element or ion by name, symbol, Z, or formula with charge (e.g. "iron", "Fe", "Fe2+", "Fe³⁺", "Cr", "Cu2+", "26").' },
          charge: { type: 'number', description: 'Ionic charge (−2 to +3). Overrides any charge written in element.' },
          orbital: { type: 'string', description: '3D orbital cloud: 1s, 2s, 2px, 2py, 2pz, 3dxy, 3dx2y2, or 3dz2.' },
          shorthand: { type: 'boolean', description: 'Toggle noble-gas shorthand notation.' },
          show_axes: { type: 'boolean', description: 'Show x, y, z axes in the 3D view.' },
        },
      },
      run: async (a) => {
        await showMode('orbitals');
        let targetEl = matchElementOrIon(String(orbitals.z)).el;
        if (a.element !== undefined) {
          const parsed = matchElementOrIon(String(a.element));
          targetEl = parsed.el;
          orbitals.z = targetEl.z;
          orbitals.charge = parsed.parsedCharge !== undefined ? validateCharge(targetEl, parsed.parsedCharge) : 0;
        }
        if (a.charge !== undefined) {
          orbitals.charge = validateCharge(targetEl, num(a.charge, 'charge'));
        }
        if (a.orbital !== undefined) orbitals.orbital = matchOrbital(String(a.orbital)).id;
        if (typeof a.shorthand === 'boolean') orbitals.shorthand = a.shorthand;
        if (typeof a.show_axes === 'boolean') orbitals.showAxes = a.show_axes;
        return describeOrbitals(orbitals);
      },
    },
    {
      name: 'atoms_ie',
      description: 'Show the Ionisation Energy tab: 1st IE periodic trends (H–Ca, Be→B / N→O / Mg→Al / P→S dips, optional covalent radius overlay) or successive IE log plots (and mystery group-deduction challenge).',
      parameters: {
        type: 'object',
        properties: {
          view: { type: 'string', enum: ['first', 'succ'], description: '"first" for 1st IE trends across H–Ca, "succ" for successive IE log plot.' },
          element: { type: 'string', description: 'Element symbol, name or Z (H–Ca for first; Na, Mg, Al, Si, P, S, Cl, C, O for succ).' },
          show_radius: { type: 'boolean', description: 'Overlay covalent radius on the 1st IE graph.' },
          mystery: { type: 'boolean', description: 'Start or exit the successive-IE mystery challenge.' },
        },
      },
      run: async (a) => {
        await showMode('ie');
        const wantView = a.view ? String(a.view).toLowerCase() : (a.mystery !== undefined ? 'succ' : ie.mode);
        if (wantView !== 'first' && wantView !== 'succ') throw new Error('view must be "first" or "succ".');
        ie.mode = wantView;
        if (wantView === 'first') {
          if (a.element !== undefined) ie.selectedZ = matchFirstIE(String(a.element)).z;
          if (typeof a.show_radius === 'boolean') ie.showRadius = a.show_radius;
        } else {
          if (a.mystery === true) {
            ieRef?.startMystery();
          } else {
            if (a.mystery === false) ie.mystery = false;
            if (a.element !== undefined) { ie.mystery = false; ie.succSym = matchSuccIE(String(a.element)).sym; }
          }
        }
        await tick();
        return describeIE(ie, ieRef?.getMysteryInfo());
      },
    },
    {
      name: 'atoms_lattice',
      description: 'Show a 3D crystal lattice (NaCl, diamond, graphite, graphene, copper, iodine or ice), apply shear stress (0–1) to demonstrate brittleness vs malleability, or toggle delocalised electrons.',
      parameters: {
        type: 'object',
        properties: {
          lattice: { type: 'string', description: 'nacl, diamond, graphite, graphene, copper, iodine, or ice (names and formulae work).' },
          shear: { type: 'number', description: 'Shear stress 0–1 (or 0–100%). Applies to nacl, copper, graphite, iodine.' },
          show_electrons: { type: 'boolean', description: 'Show delocalised electrons (copper, graphite, graphene).' },
        },
      },
      run: async (a) => {
        await showMode('lattices');
        if (a.lattice !== undefined) {
          const l = matchLattice(String(a.lattice));
          lattices.id = l.id;
          if (a.shear === undefined) lattices.shear = 0;
        }
        if (a.shear !== undefined) {
          const canShear = lattices.id === 'nacl' || lattices.id === 'copper' || lattices.id === 'graphite' || lattices.id === 'iodine';
          let s = num(a.shear, 'shear');
          if (s > 1 && s <= 100) s /= 100;
          lattices.shear = canShear ? Number(clamp(s, 0, 1, 0.02).toFixed(2)) : 0;
        }
        if (typeof a.show_electrons === 'boolean') lattices.showElectrons = a.show_electrons;
        return describeLattice(lattices);
      },
    },
    {
      name: 'atoms_imf',
      description: 'Show the 3D Intermolecular Forces tab: choose London dispersion, permanent dipole–dipole or hydrogen bonding, adjust London electron-cloud size (1–3), and switch the boiling-point trend graph (Group 4–7 hydrides vs C5H12 alkane branching).',
      parameters: {
        type: 'object',
        properties: {
          force: { type: 'string', description: 'london, dipole, or hbond (names like "hydrogen bonding" or "dispersion" work).' },
          electrons: { type: 'number', description: 'London cloud size: 1 = small (F2/CH4), 2 = medium (Cl2), 3 = large (I2).' },
          trend: { type: 'string', enum: ['hydrides', 'alkanes'], description: 'Boiling-point trend graph: hydrides (Groups 4–7) or alkanes (pentane branching).' },
        },
      },
      run: async (a) => {
        await showMode('imf');
        if (a.force !== undefined) imf.kind = matchImf(String(a.force));
        if (a.electrons !== undefined) imf.electrons = clamp(Math.round(num(a.electrons, 'electrons')), 1, 3);
        if (a.trend !== undefined) imf.trend = matchTrend(String(a.trend));
        return describeImf(imf);
      },
    },
    {
      name: 'atoms_massspec',
      description: 'Show the 3D Mass Spectrometer and spectrum: choose a sample (Mg, Cl2, Br2, B, Ne) or a custom two-isotope mix, pick TOF or magnetic deflection, and fire an ion pulse on screen.',
      parameters: {
        type: 'object',
        properties: {
          sample: { type: 'string', description: 'mg, cl2 (chlorine), br2 (bromine), b (boron), ne (neon), or custom.' },
          analyser: { type: 'string', enum: ['tof', 'mag'], description: '"tof" (time-of-flight drift tube) or "mag" (magnetic sector).' },
          m1: { type: 'number', description: 'Custom isotope 1 mass (10–100).' },
          p1: { type: 'number', description: 'Custom isotope 1 abundance % (5–95; isotope 2 is 100 − p1).' },
          m2: { type: 'number', description: 'Custom isotope 2 mass (10–100).' },
          fire: { type: 'boolean', description: 'Fire an animated ion pulse on screen (default true).' },
        },
      },
      run: async (a) => {
        await showMode('massspec');
        if (a.sample !== undefined) {
          const s = matchSample(String(a.sample));
          if (s === 'custom') mass.custom = true;
          else { mass.custom = false; mass.sample = s.id; }
        }
        if (a.analyser !== undefined) {
          const m = String(a.analyser).toLowerCase();
          if (m !== 'tof' && m !== 'mag') throw new Error('analyser must be "tof" or "mag".');
          mass.mode = m;
        }
        if (a.m1 !== undefined) { mass.m1 = clamp(Math.round(num(a.m1, 'm1')), 10, 100); mass.custom = true; }
        if (a.p1 !== undefined) { mass.p1 = clamp(Math.round(num(a.p1, 'p1')), 5, 95); mass.custom = true; }
        if (a.m2 !== undefined) { mass.m2 = clamp(Math.round(num(a.m2, 'm2')), 10, 100); mass.custom = true; }
        await tick();
        if (a.fire !== false) massRef?.firePulse();
        return describeMassSpec(mass);
      },
    },
  ]);

  onMount(() => {
    addEventListener('hashchange', fromHash);
    glint('.panel,.qpanel');
    const unprovide = kernelTools();
    return () => { removeEventListener('hashchange', fromHash); unprovide(); };
  });
</script>

<SimHeader title="Atoms & Bonding Lab" eyebrow="Edexcel IAL Chemistry · Unit 1 (WCH11) · Structure, bonding & periodicity"
  back={{ href: '/chemistry/', label: 'Arsenal' }} tabs={TABS} value={mode} onselect={setMode} />
<StatusLine label={INFO[mode][0]} hint={INFO[mode][1]} stats={shown} />

<div bind:this={views.shapes}><Shapes prefs={shapes} hidden={mode !== 'shapes'} bind:stats={stats.shapes} /></div>
<div bind:this={views.orbitals}><Orbitals prefs={orbitals} hidden={mode !== 'orbitals'} bind:stats={stats.orbitals} /></div>
<div bind:this={views.ie}><Ionisation bind:this={ieRef} prefs={ie} hidden={mode !== 'ie'} bind:stats={stats.ie} /></div>
<div bind:this={views.lattices}><Lattices prefs={lattices} hidden={mode !== 'lattices'} bind:stats={stats.lattices} /></div>
<div bind:this={views.imf}><Imf prefs={imf} hidden={mode !== 'imf'} bind:stats={stats.imf} /></div>
<div bind:this={views.massspec}><MassSpec bind:this={massRef} prefs={mass} hidden={mode !== 'massspec'} bind:stats={stats.massspec} /></div>
<div bind:this={views.practice}><Practice {score} bind:topic={topic.t} hidden={mode !== 'practice'} /></div>
