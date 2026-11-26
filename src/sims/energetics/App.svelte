<script lang="ts">
  /* Energetics Lab: Edexcel IAL Chemistry Unit 2 (Topic 6, CP 2) and Unit 4 (Topic 12: Born–Haber, Entropy & ΔG).
     Tabs with hash routes: #calorimetry, #hess, #bonds, #bornhaber, #entropy, #practice. */
  import { onMount, tick } from 'svelte';
  import { persisted } from '../../lib/persist.svelte';
  import { glint, fadeIn } from '../../lib/motion';
  import SimHeader from '../../components/ui/SimHeader.svelte';
  import StatusLine from '../../components/ui/StatusLine.svelte';
  import Calorimetry, { CAL_PREFS, type CalPrefs } from './Calorimetry.svelte';
  import Hess, { HESS_PREFS, type HessPrefs } from './Hess.svelte';
  import Bonds, { BONDS_PREFS, type BondsPrefs } from './Bonds.svelte';
  import BornHaber, { BH_PREFS, type BHPrefs } from './BornHaber.svelte';
  import Entropy, { ENTROPY_PREFS, type EntropyPrefs } from './Entropy.svelte';
  import Practice, { type PScore } from './Practice.svelte';
  import type { Topic } from './practice';
  import { provideKernelTools } from '../../lib/kernel/live';
  import { RM } from '../../lib/util';
  import {
    clamp, num, matchCal, matchHess, matchBond, matchBH, matchBHStep, matchEntropy, matchPhase, matchTopic,
    calList, hessList, bondList, bhList, entropyList, topicList,
    describeCal, describeHess, describeBonds, describeBH, describeEntropy,
  } from './kernel';

  type Mode = 'calorimetry' | 'hess' | 'bonds' | 'bornhaber' | 'entropy' | 'practice';
  type Stats = [string, string | number][];

  const cal = persisted<CalPrefs>('energetics-cal', CAL_PREFS);
  const hess = persisted<HessPrefs>('energetics-hess', HESS_PREFS);
  const bonds = persisted<BondsPrefs>('energetics-bonds', BONDS_PREFS);
  const bh = persisted<BHPrefs>('energetics-bh', BH_PREFS);
  const ent = persisted<EntropyPrefs>('energetics-ent', ENTROPY_PREFS);
  const score = persisted<PScore>('energetics-score', { right: 0, total: 0, streak: 0, best: 0 });
  const topic = persisted<{ t: Topic | 'all' }>('energetics-topic', { t: 'all' });
  score.streak = 0;

  let mode = $state<Mode>('calorimetry');
  let calRef = $state<ReturnType<typeof Calorimetry>>();
  const views: Record<Mode, HTMLElement | undefined> = $state({
    calorimetry: undefined, hess: undefined, bonds: undefined, bornhaber: undefined, entropy: undefined, practice: undefined,
  });

  const TABS = [
    ['calorimetry', 'Calorimetry', 'Heat'],
    ['hess', 'Hess’s law', 'Hess'],
    ['bonds', 'Bond enthalpies', 'Bonds'],
    ['bornhaber', 'Born–Haber', 'Lattice'],
    ['entropy', 'Entropy & ΔG', 'Entropy'],
    ['practice', 'Practice', 'Quiz'],
  ] as const;

  const INFO: Record<Mode, [string, string]> = {
    calorimetry: ['Calorimetry', 'Run solution and combustion calorimetry in 3D, adjust heat loss, and extrapolate the cooling curve back to t = 4 min.'],
    hess: ['Hess’s law', 'Follow formation, combustion and Core Practical 2 cycles; see which arrows reverse sign along the indirect route.'],
    bonds: ['Bond enthalpies', 'Scrub from reactants through gaseous atoms to products and compare mean bond enthalpy estimates with ΔrH⊖.'],
    bornhaber: ['Born–Haber & lattice', 'Climb the 3D Born–Haber staircase, inspect covalent character via polarisation, and compute ΔsolH.'],
    entropy: ['Entropy & ΔG', 'Explore solid/liquid/gas disorder in 3D and slide temperature T across the ΔG = ΔH − TΔS feasibility threshold.'],
    practice: ['Practice', 'Answer exam-style Topics 6 & 12 questions, then check the working.'],
  };

  let stats = $state<Record<Mode, Stats>>({
    calorimetry: [], hess: [], bonds: [], bornhaber: [], entropy: [], practice: [],
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
    setMode(MODES.includes(h) ? h : 'calorimetry');
  }
  fromHash();
  $effect(() => { const h = '#' + mode; if (location.hash !== h) history.replaceState(null, '', h); });

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  async function showMode(m: Mode) {
    if (mode !== m) { setMode(m); await tick(); await wait(40); }
  }

  const KERNEL_ABOUT = 'The Energetics Lab is open: Calorimetry (3D polystyrene cup & spirit burner with cooling-curve extrapolation), Hess’s law cycles, Mean bond enthalpies, 3D Born–Haber cycles & lattice energy, Entropy & ΔG, and Practice. '
    + 'Its energetics_ tools switch tabs, run calorimetry experiments, build Born–Haber cycles, set up Hess/bond/entropy scenarios on screen and read back all calculated values; energetics_state reports what is currently shown.';

  const kernelTools = () => provideKernelTools('energetics', KERNEL_ABOUT, [
    {
      name: 'energetics_state',
      description: 'Read the current Energetics Lab state: active tab, selected reaction/compound/preset, parameters with ranges and units, on-screen calculated results, and lists of all available options.',
      parameters: { type: 'object', properties: {} },
      run: () => {
        const cur = mode === 'calorimetry' ? describeCal(cal)
          : mode === 'hess' ? describeHess(hess)
          : mode === 'bonds' ? describeBonds(bonds)
          : mode === 'bornhaber' ? describeBH(bh)
          : mode === 'entropy' ? describeEntropy(ent)
          : `Practice: topic = ${topic.t}, score = ${score.right}/${score.total}, streak = ${score.streak}, best = ${score.best}.`;
        return [
          `Mode: ${mode} (${INFO[mode][0]} — ${INFO[mode][1]})`,
          cur,
          'Available options:',
          calList(), hessList(), bondList(), bhList(), entropyList(), topicList(),
        ].join('\n');
      },
    },
    {
      name: 'energetics_mode',
      description: 'Switch the Energetics Lab tab (calorimetry, hess, bonds, bornhaber, entropy, practice) and optionally pick a practice topic.',
      parameters: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['calorimetry', 'hess', 'bonds', 'bornhaber', 'entropy', 'practice'] },
          practice_topic: { type: 'string', description: 'Only for practice: all, calorimetry, hess, bonds, bornhaber, or entropy.' },
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
      name: 'energetics_calorimetry',
      description: 'Run a calorimetry experiment on screen (switches to Calorimetry, sets reaction and variables, replays the 3D mixing/heating animation and waits for it to finish). For HCl + NaOH neutralisation, mass is the total combined solution mass (e.g. 50 cm³ + 50 cm³ = 100 g) and mol is moles of limiting reagent (e.g. 0.050 mol for 50 cm³ of 1.0 M).',
      parameters: {
        type: 'object',
        properties: {
          reaction: { type: 'string', description: 'zn_cuso4 (Zn + CuSO4), hcl_naoh (HCl + NaOH), nh4no3 (NH4NO3 dissolving), ethanol, or propanol.' },
          mass: { type: 'number', description: 'Mass of water / total solution in g (25–150, step 5).' },
          mol: { type: 'number', description: 'Moles of limiting reagent in mol (0.005–0.12, step 0.005).' },
          loss: { type: 'number', description: 'Heat loss to surroundings: 0–1 (or 0–100%).' },
          lid: { type: 'boolean', description: 'Cup mode only: insulating lid on/off.' },
          animate: { type: 'boolean', description: 'Replay the mixing/heating animation (default true).' },
        },
      },
      run: async (a) => {
        await showMode('calorimetry');
        if (a.reaction !== undefined) {
          const r = matchCal(String(a.reaction));
          cal.rxn = r.id; cal.mass = r.defaultMass; cal.mol = r.defaultMol;
        }
        if (a.mass !== undefined) cal.mass = clamp(num(a.mass, 'mass'), 25, 150, 5);
        if (a.mol !== undefined) cal.mol = Number(clamp(num(a.mol, 'mol'), 0.005, 0.12, 0.005).toFixed(3));
        if (a.loss !== undefined) {
          let l = num(a.loss, 'loss');
          if (l > 1 && l <= 100) l /= 100;
          cal.loss = Number(clamp(l, 0, 1, 0.05).toFixed(2));
        }
        if (typeof a.lid === 'boolean') cal.lid = a.lid;
        await tick();
        if (a.animate !== false) await calRef?.runAnimation();
        return describeCal(cal);
      },
    },
    {
      name: 'energetics_hess',
      description: 'Show a Hess’s law triangle on screen (formation, combustion or Core Practical 2), toggle direct vs indirect route highlight, and optionally edit custom ΔH₁ / ΔH₂ values.',
      parameters: {
        type: 'object',
        properties: {
          cycle: { type: 'string', description: 'form_caco3 (CaCO3 decomposition via ΔfH), comb_etoh (formation of ethanol via ΔcH), cp5_khco3 (CP 2 KHCO3), or cp5_cuso4 (CuSO4 hydration).' },
          route: { type: 'string', enum: ['direct', 'indirect'], description: 'Route highlight on the diagram.' },
          dh1: { type: 'number', description: 'Custom left-leg ΔH₁ in kJ mol⁻¹ (−2000 to +500).' },
          dh2: { type: 'number', description: 'Custom right-leg ΔH₂ in kJ mol⁻¹ (−2000 to +500).' },
          custom: { type: 'boolean', description: 'Set false to restore the data-book values.' },
        },
      },
      run: async (a) => {
        await showMode('hess');
        if (a.cycle !== undefined) {
          const c = matchHess(String(a.cycle));
          hess.cycle = c.id; hess.dh1 = c.dh1; hess.dh2 = c.dh2; hess.custom = false;
        }
        if (a.route !== undefined) {
          const r = String(a.route).toLowerCase();
          if (r !== 'direct' && r !== 'indirect') throw new Error('route must be "direct" or "indirect".');
          hess.route = r;
        }
        if (a.dh1 !== undefined) { hess.dh1 = clamp(num(a.dh1, 'dh1'), -2000, 500, 10); hess.custom = true; }
        if (a.dh2 !== undefined) { hess.dh2 = clamp(num(a.dh2, 'dh2'), -2000, 500, 10); hess.custom = true; }
        if (a.custom === false) hess.custom = false;
        return describeHess(hess);
      },
    },
    {
      name: 'energetics_bonds',
      description: 'Show a reaction on the 3D Bond Enthalpies tab and scrub between reactants (0), gaseous atoms (0.5) and products (1).',
      parameters: {
        type: 'object',
        properties: {
          reaction: { type: 'string', description: 'ch4_comb (methane combustion), h2_cl2 (H2 + Cl2), c2h4_h2 (ethene hydrogenation), or haber (Haber process).' },
          progress: { type: 'number', description: 'Reaction progress 0 (reactants) to 1 (products); 0.5 = gaseous atoms.' },
          stage: { type: 'string', enum: ['reactants', 'atoms', 'products'], description: 'Shortcut for progress 0, 0.5, or 1.' },
        },
      },
      run: async (a) => {
        await showMode('bonds');
        if (a.reaction !== undefined) bonds.rxn = matchBond(String(a.reaction)).id;
        if (a.stage !== undefined) {
          const map: Record<string, number> = { reactants: 0, atoms: 0.5, products: 1 };
          const v = map[String(a.stage).toLowerCase()];
          if (v === undefined) throw new Error('stage must be reactants, atoms, or products.');
          bonds.progress = v;
        } else if (a.progress !== undefined) {
          let v = num(a.progress, 'progress');
          if (v > 1 && v <= 100) v /= 100;
          bonds.progress = Number(clamp(v, 0, 1, 0.02).toFixed(2));
        }
        return describeBonds(bonds);
      },
    },
    {
      name: 'energetics_bornhaber',
      description: 'Build or inspect a 3D Born–Haber cycle staircase for an ionic compound (NaCl, MgCl₂, MgO or AgCl). By default climbs the cycle step by step on screen; pass step to highlight a single step.',
      parameters: {
        type: 'object',
        properties: {
          compound: { type: 'string', description: 'Formula or name: NaCl, MgCl2, MgO, or AgCl.' },
          step: { type: 'string', description: 'Optional step index (0-based), id (atM, ie1, ie2, atX, ea1, ea2, le), name, or "build" to animate climbing every step.' },
          animate: { type: 'boolean', description: 'When building the cycle, animate stepping through each level on screen (default true).' },
        },
      },
      run: async (a) => {
        await showMode('bornhaber');
        const c = a.compound !== undefined ? matchBH(String(a.compound)) : matchBH(bh.id);
        const changed = bh.id !== c.id;
        bh.id = c.id;
        const doBuild = a.step === 'build' || (a.step === undefined && changed);
        if (doBuild) {
          if (a.animate !== false && !RM) {
            for (let i = 0; i < c.steps.length; i++) {
              bh.step = i;
              await tick();
              if (i < c.steps.length - 1) await wait(320);
            }
          } else {
            bh.step = c.steps.length - 1;
          }
        } else if (a.step !== undefined) {
          bh.step = matchBHStep(c, a.step);
        }
        return describeBH(bh);
      },
    },
    {
      name: 'energetics_entropy',
      description: 'Set up the Entropy & ΔG tab: choose a preset reaction (or custom ΔH and ΔS), slide temperature T (100–1500 K), and pick the 3D disorder phase box.',
      parameters: {
        type: 'object',
        properties: {
          preset: { type: 'string', description: 'caco3 (high-T only), haber (low-T), h2o2 (always feasible), or photosyn (never feasible).' },
          T: { type: 'number', description: 'Temperature in K (100–1500, step 10).' },
          phase: { type: 'string', enum: ['solid', 'liquid', 'gas', 'decomp'], description: '3D particle disorder phase.' },
          dh: { type: 'number', description: 'Custom ΔH in kJ mol⁻¹ (−1000 to +3000); enables custom mode.' },
          ds: { type: 'number', description: 'Custom ΔSsystem in J K⁻¹ mol⁻¹ (−300 to +300); enables custom mode.' },
        },
      },
      run: async (a) => {
        await showMode('entropy');
        if (a.preset !== undefined) {
          const p = matchEntropy(String(a.preset));
          ent.preset = p.id; ent.phase = p.phase; ent.dh = p.dh; ent.ds = p.ds; ent.custom = false;
        }
        if (a.T !== undefined) ent.T = clamp(num(a.T, 'T'), 100, 1500, 10);
        if (a.phase !== undefined) ent.phase = matchPhase(String(a.phase));
        if (a.dh !== undefined) { ent.dh = clamp(num(a.dh, 'dh'), -1000, 3000, 1); ent.custom = true; }
        if (a.ds !== undefined) { ent.ds = clamp(num(a.ds, 'ds'), -300, 300, 1); ent.custom = true; }
        return describeEntropy(ent);
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

<SimHeader title="Energetics Lab" eyebrow="Edexcel IAL Chemistry · Units 2 & 4 · Energetics, Born–Haber & entropy"
  back={{ href: '/chemistry/', label: 'Arsenal' }} tabs={TABS} value={mode} onselect={setMode} />
<StatusLine label={INFO[mode][0]} hint={INFO[mode][1]} stats={shown} />

<div bind:this={views.calorimetry}><Calorimetry bind:this={calRef} prefs={cal} hidden={mode !== 'calorimetry'} bind:stats={stats.calorimetry} /></div>
<div bind:this={views.hess}><Hess prefs={hess} hidden={mode !== 'hess'} bind:stats={stats.hess} /></div>
<div bind:this={views.bonds}><Bonds prefs={bonds} hidden={mode !== 'bonds'} bind:stats={stats.bonds} /></div>
<div bind:this={views.bornhaber}><BornHaber prefs={bh} hidden={mode !== 'bornhaber'} bind:stats={stats.bornhaber} /></div>
<div bind:this={views.entropy}><Entropy prefs={ent} hidden={mode !== 'entropy'} bind:stats={stats.entropy} /></div>
<div bind:this={views.practice}><Practice {score} bind:topic={topic.t} hidden={mode !== 'practice'} /></div>
