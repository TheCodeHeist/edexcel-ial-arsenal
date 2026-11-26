<script lang="ts">
  /* Kinetics Lab: every kinetics and equilibria statement of IAL Chemistry, Topics 9 (Unit 2), 11 and 13 (Unit 4), as
     tabs with hash routes. #collide (collision theory, Maxwell–Boltzmann), #catalyst (profiles, heterogeneous
     catalysis, industry), #measure (rate from 1/t and tangents, choosing a technique), #orders (rate equations,
     orders, half-life, initial rates), #cp (Core Practicals 9a, 9b and 10), #mech (rate-determining steps, SN1/SN2),
     #equil (dynamic equilibrium, Le Chatelier), #k (Kc and Kp), #industry (compromise, K and temperature,
     ΔStotal = R ln K) and #practice. Each tab owns its prefs and reports its own status numbers. */
  import { onMount, tick } from 'svelte';
  import { persisted } from '../../lib/persist.svelte';
  import { glint, fadeIn } from '../../lib/motion';
  import SimHeader from '../../components/ui/SimHeader.svelte';
  import StatusLine from '../../components/ui/StatusLine.svelte';
  import Collide, { COLLIDE, type CollidePrefs } from './Collide.svelte';
  import Catalyst, { CATALYST, type CatalystPrefs } from './Catalyst.svelte';
  import Measure, { MEASURE, type MeasurePrefs } from './Measure.svelte';
  import Orders, { ORDERS, type OrdersPrefs } from './Orders.svelte';
  import Practicals, { CP, type CPPrefs } from './Practicals.svelte';
  import Mechanism, { MECH, type MechPrefs } from './Mechanism.svelte';
  import Equil, { EQUIL, type EquilPrefs } from './Equil.svelte';
  import Constants, { KCALC, type KPrefs } from './Constants.svelte';
  import Industry, { INDUSTRY, type IndustryPrefs } from './Industry.svelte';
  import Practice, { type PScore } from './Practice.svelte';
  import type { Topic } from './practice';
  import { provideKernelTools } from '../../lib/kernel/live';
  import { sci, plain } from './consts';
  import { SURFACES } from './catalyst';
  import { RX as MEASURE_RX } from './measure';
  import { RXNS as K_RXNS } from './constants';
  import { PROCS } from './industry';
  import {
    norm, clamp, num, matchSurf, matchProfile, matchMeasureRx, matchMethod, matchSize, matchOrd,
    matchPractical, matchExample, matchEquilSys, matchKRxn, matchProc, matchTopic,
    measureList, mechExList, equilList, kRxnList, procList, topicList,
    describeCollide, describeCatalyst, describeIndustry, describeEqSysList,
  } from './kernel';

  type Mode = 'collide' | 'catalyst' | 'measure' | 'orders' | 'cp' | 'mech' | 'equil' | 'k' | 'industry' | 'practice';
  type Stats = [string, string | number][];

  const collide = persisted<CollidePrefs>('kinetics-collide', COLLIDE);
  const catalyst = persisted<CatalystPrefs>('kinetics-catalyst', CATALYST);
  const measure = persisted<MeasurePrefs>('kinetics-measure', MEASURE);
  const orders = persisted<OrdersPrefs>('kinetics-orders', ORDERS);
  const cp = persisted<CPPrefs>('kinetics-cp', CP);
  const mech = persisted<MechPrefs>('kinetics-mech', MECH);
  const equil = persisted<EquilPrefs>('kinetics-equil', EQUIL);
  const kc = persisted<KPrefs>('kinetics-k', KCALC);
  const industry = persisted<IndustryPrefs>('kinetics-industry', INDUSTRY);
  const score = persisted<PScore>('kinetics-score', { right: 0, total: 0, streak: 0, best: 0 });
  const topic = persisted<{ t: Topic | 'all' }>('kinetics-topic', { t: 'all' });
  score.streak = 0;

  let mode = $state<Mode>('collide');
  let collideRef = $state<ReturnType<typeof Collide>>();
  let catalystRef = $state<ReturnType<typeof Catalyst>>();
  let measureRef = $state<ReturnType<typeof Measure>>();
  let ordersRef = $state<ReturnType<typeof Orders>>();
  let cpRef = $state<ReturnType<typeof Practicals>>();
  let mechRef = $state<ReturnType<typeof Mechanism>>();
  let equilRef = $state<ReturnType<typeof Equil>>();
  let kRef = $state<ReturnType<typeof Constants>>();
  const views: Record<Mode, HTMLElement | undefined> = $state({ collide: undefined, catalyst: undefined, measure: undefined, orders: undefined, cp: undefined, mech: undefined, equil: undefined, k: undefined, industry: undefined, practice: undefined });
  const TABS = [
    ['collide', 'Collisions', 'Collide'], ['catalyst', 'Catalysts', 'Catalyst'], ['measure', 'Measuring rates', 'Rates'], ['orders', 'Rate equations', 'Orders'],
    ['cp', 'Core practicals', 'CPs'], ['mech', 'Mechanisms', 'Mech'], ['equil', 'Equilibrium', 'Equil'], ['k', 'Kc and Kp', 'K'],
    ['industry', 'Industry', 'Industry'], ['practice', 'Practice', 'Quiz'],
  ] as const;
  const INFO: Record<Mode, [string, string]> = {
    collide: ['Collisions', 'Heat it, crowd it, squeeze it or grind it up; watch which collisions have the activation energy.'],
    catalyst: ['Catalysts', 'Compare the routes with and without a catalyst, and watch molecules react on a metal surface.'],
    measure: ['Measuring rates', 'Run a reaction, follow it, and find its rate from 1/time or from a tangent.'],
    orders: ['Rate equations', 'Set the orders and the rate constant; read the graphs, the half-lives and an initial-rates table.'],
    cp: ['Core practicals', 'Core Practicals 9a, 9b and 10, step by step, with your own results.'],
    mech: ['Mechanisms', 'Link the rate equation to the slow step, and watch SN1 and SN2 happen.'],
    equil: ['Equilibrium', 'Change the temperature, pressure or concentration and watch the system respond.'],
    k: ['Kc and Kp', 'Write the expression, fill in the table and find K with its units.'],
    industry: ['Industry', 'Choose the conditions: yield against rate against cost; and how K changes with temperature.'],
    practice: ['Practice', 'Answer, then check the working.'],
  };
  let stats = $state<Record<Mode, Stats>>({ collide: [], catalyst: [], measure: [], orders: [], cp: [], mech: [], equil: [], k: [], industry: [], practice: [] });
  const shown = $derived<Stats>(mode === 'practice' ? [['Correct', `${score.right}/${score.total}`], ['Streak', score.streak], ['Best', score.best]] : stats[mode]);

  function setMode(m: Mode) {
    const prev = mode;
    mode = m;
    if (prev !== m) tick().then(() => fadeIn(views[m]?.firstElementChild as HTMLElement));
  }
  const MODES = TABS.map((t) => t[0]) as readonly Mode[];
  function fromHash() {
    const h = location.hash.slice(1) as Mode;
    setMode(MODES.includes(h) ? h : 'collide');
  }
  fromHash();
  $effect(() => { const h = '#' + mode; if (location.hash !== h) history.replaceState(null, '', h); });

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  async function showMode(m: Mode) {
    if (mode !== m) { setMode(m); await tick(); await wait(40); }
  }

  function formatMeasure(): string {
    const s = measureRef?.getState();
    if (!s) return 'Measuring rates tab not mounted.';
    const lines = [
      `Measuring rates: ${s.rx.name} (${s.rx.eq}) via ${s.method}.`,
      `Clock: t = ${Math.floor(s.t)} / ${s.tEnd} s (${Math.round(s.ext * 100)}% reacted), temp = ${measure.temp} °C (15–55 °C), speed = ×${measure.speed}.`,
    ];
    if (s.isCross) {
      lines.push(`Disappearing cross: v(thiosulfate) = ${measure.vThio} cm³ (10–50 cm³), cross gone at ${s.crossT === null ? 'never (too dilute)' : s.t >= s.crossT ? `${Math.round(s.crossT)} s (1/t = ${sci(1 / Math.round(s.crossT))} s⁻¹)` : 'not yet'}.`);
      if (s.rows.length) lines.push('Results table: ' + s.rows.map((r) => `${r.v} cm³ @ ${r.T}°C → ${r.t} s`).join('; ') + '.');
    } else {
      lines.push(`Reading: ${s.yLabel} = ${s.reading}${s.yUnit ? ' ' + s.yUnit : ''}${s.massShown ? ` (balance ${s.massShown} g)` : ''}.`);
      lines.push(`True initial rate = ${sci(Math.abs(s.rate0), 3)} ${s.uRate}; rate now = ${sci(Math.abs(s.rateNow), 3)} ${s.uRate}.`);
      if (s.tan) lines.push(`Tangent at t = ${plain(s.tan.x, 3)} s: gradient = ${sci(s.tan.g, 3)} ${s.uRate} (true = ${sci(s.tan.trueG, 3)} ${s.uRate}).`);
    }
    lines.push(s.note);
    return lines.join('\n');
  }

  function formatOrders(): string {
    const s = ordersRef?.getState();
    if (!s) return 'Rate equations tab not mounted.';
    return [
      `Rate equations: ${s.eq} (overall order ${s.order}, k = ${sci(s.k)} ${s.units}; k range 0.001–1).`,
      `Initial concentrations: [A]₀ = ${plain(orders.A0, 2)}, [B]₀ = ${plain(orders.B0, 2)} mol dm⁻³ (0.1–1), B in excess = ${orders.excess ? 'yes' : 'no'}.`,
      `Initial rate = ${sci(s.r0, 3)} mol dm⁻³ s⁻¹${orders.excess ? `, pseudo-k′ = ${sci(s.kp, 3)}` : ''}.`,
      `Successive half-lives: ${s.halves.length ? s.halves.map((h) => `${plain(h, 3)} s`).join(', ') : 'none reached'}. ${s.pattern}`,
      `Initial-rates problem on screen: ${s.prob.eq} (4 experiments; experiment 4 rate to predict).`,
    ].join('\n');
  }

  function formatPractical(): string {
    const s = cpRef?.getState();
    if (!s) return 'Core practicals tab not mounted.';
    if (s.view === 'cp9a') {
      const a = s.cp9a;
      return [
        `CP9a (iodination of propanone, followed by ${a.follow}): c(propanone) = ${a.cProp} M (0.5–2), c(HCl) = ${a.cAcid} M (0.5–2) → in flask [CH₃COCH₃] = ${plain(a.P, 3)} M, [H⁺] = ${plain(a.Hp, 3)} M, [I₂]₀ = ${plain(a.I0, 2)} M.`,
        `Time: ${a.tMin} min; ${a.follow === 'titrate' ? `samples (${a.samples.length}): ${a.samples.map((x) => `${x.min}m=${x.titre.toFixed(2)} cm³`).join(', ') || 'none'}` : `${a.readsCount} absorbance readings`}.`,
        a.fit ? `Line fit: gradient = ${plain(a.fit.m, 3)} /min, r² = ${plain(a.fit.r2, 3)} (straight line → zero order in I₂).` : 'Run the reaction to collect points.',
        a.runs.length ? `Saved runs (${a.runs.length}): ${a.runs.map((r) => `[P]=${plain(r.P, 2)}, [H+]=${plain(r.Hp, 2)} → rate ${sci(r.rate, 3)}`).join('; ')}.${a.ordP !== null ? ` Order in propanone ≈ ${plain(a.ordP, 2)}.` : ''}${a.ordH !== null ? ` Order in H⁺ ≈ ${plain(a.ordH, 2)}.` : ''}` : '',
      ].filter(Boolean).join('\n');
    }
    if (s.view === 'cp9b') {
      const b = s.cp9b;
      return [
        `CP9b (iodine clock): varying ${b.vary} (vol = ${b.vol} cm³ of 2, 4, 6, 8, 10 cm³).`,
        b.lastT !== null ? `Last run time: ${b.lastT.toFixed(1)} s.` : 'No clock run completed yet.',
        b.rows.length ? `Recorded runs: ${b.rows.map((r) => `${r.v} cm³ (${sci(r.c, 2)} M) → mean ${r.mean.toFixed(1)} s (1/t = ${sci(1 / r.mean, 3)} s⁻¹)`).join('; ')}.` : '',
        b.order !== null ? `Derived order in ${b.vary === 'KI' ? 'I⁻' : 'H₂O₂'} = ${plain(b.order, 2)}.` : '',
      ].filter(Boolean).join('\n');
    }
    const c = s.cp10;
    return [
      `CP10 (activation energy, Arrhenius iodine clock): bath = ${c.T} °C (20–60 °C, step 5).`,
      c.lastT !== null ? `Last run time: ${c.lastT.toFixed(1)} s.` : 'No temperature runs recorded yet.',
      c.hot.length ? `Runs: ${c.hot.map((h) => `${h.set}°C (mix ${h.T.toFixed(1)}°C) → ${h.t.toFixed(1)} s`).join('; ')}.` : '',
      c.Ea !== null ? `Arrhenius plot Ea = ${plain(c.Ea, 3)} kJ mol⁻¹ (two-point estimate: ${c.twoEa !== null ? plain(c.twoEa, 3) : '–'} kJ mol⁻¹).` : '',
    ].filter(Boolean).join('\n');
  }

  function formatMech(): string {
    const s = mechRef?.getState();
    if (!s) return 'Mechanisms tab not mounted.';
    return [
      `Mechanisms: 3D ${mech.sn.toUpperCase()}${mech.sn === 'sn1' ? ` (OH⁻ attack from ${mech.side})` : ''} at ${Math.round(s.p * 100)}% progress — ${s.stage[0]}: ${s.stage[1]}`,
      `Iodination of propanone curly arrows: step ${mech.step + 1}/4 (${s.iodTitle}, ${s.iodSpeed}) — ${s.iodSay}`,
      `Rate-equation exercise: ${s.ex} (${s.exOverall}; ${s.exRate}), mode = ${mech.exMode}.`,
    ].join('\n');
  }

  function formatEquil(): string {
    const s = equilRef?.getState();
    if (!s) return 'Equilibrium tab not mounted.';
    if (s.isGas) {
      return [
        `Dynamic equilibrium: ${s.name} — ${s.eq} (${s.status}).`,
        `Conditions: T = ${plain(s.T, 3)} K (set ${s.Tset} K, range ${s.Tmin}–${s.Tmax} K), V = ${s.Vcm} cm³ (40–100 cm³), P = ${plain(s.P, 3)} atm, catalyst = ${s.cat ? 'on' : 'off'}.`,
        `Concentrations: ${s.species.map((x) => `[${x.f}] = ${sci(x.conc)} M`).join(', ')}.`,
        `Rates: forward = ${sci(s.rf)}, backward = ${sci(s.rb)} mol dm⁻³ s⁻¹. Kc = ${sci(s.K)} (${s.units}), Qc = ${sci(s.Q)}.`,
        ...(s.msg ? [`Latest disturbance — ${s.msg.h}: ${s.msg.lines.join(' ')}`] : []),
      ].join('\n');
    }
    return [
      `Dynamic equilibrium (U-tube): ${s.eq} (${s.status}).`,
      `T = ${plain(s.T, 3)} K (set ${s.Tset} K, range 273–360 K), Cl₂ flowing = ${s.flow ? 'yes' : 'no'}.`,
      `ICl(l) = ${plain(s.liq * 100, 2)}%, ICl₃(s) = ${plain(s.sol * 100, 2)}%, p(Cl₂) = ${plain(s.gasP, 2)} atm, equilibrium p* = ${sci(s.ps)} atm (Kp = ${sci(1 / s.ps)} atm⁻¹).`,
      ...(s.msg ? [`Latest disturbance — ${s.msg.h}: ${s.msg.lines.join(' ')}`] : []),
    ].join('\n');
  }

  function formatK(): string {
    const s = kRef?.getState();
    if (!s) return 'Kc and Kp tab not mounted.';
    return [
      `Kc & Kp: ${s.name} (${s.eqn}) at ${s.T} K — calculating ${s.mode} (available: ${[s.kcOk ? 'Kc' : '', s.kpOk ? 'Kp' : ''].filter(Boolean).join(', ')}).`,
      `Expression: ${s.expr}; units: ${s.units}.`,
      `Setup: ${s.mode === 'Kc' ? `V = ${s.V} dm³` : `total P = ${s.P} atm`}, measured at equilibrium: ${s.meas} = ${sci(s.neq)} mol, 3D progress = ${Math.round(s.prog * 100)}%.`,
      `ICE table: ${s.rows.map((r) => `${r.f}(${r.st}): n0=${sci(r.n0)}, neq=${sci(r.neq)}${r.inK ? `, ${s.mode === 'Kc' ? 'c' : 'p'}=${sci(r.val)}` : ' (not in K)'}`).join('; ')}.`,
      s.bad ? 'Warning: equilibrium amounts are negative (impossible data — check measured amount).' : `Calculated ${s.mode} = ${sci(s.K)} (${s.units}); data-book ${s.mode} = ${sci(s.lit)}. ${s.extentText}`,
    ].join('\n');
  }

  const KERNEL_ABOUT = 'The Kinetics Lab is open: Collisions & Maxwell–Boltzmann, Catalysts (3D surface, profiles, M–B, Co²⁺ demo), Measuring rates, Rate equations & half-lives, Core Practicals 9a/9b/10, Mechanisms (3D SN1/SN2 & iodination), Dynamic Equilibrium (N₂O₄/NO₂, H₂+I₂/HI, ICl/ICl₃), Kc & Kp ICE tables (including Haber, esterification, CaCO₃), Industrial Equilibria (Haber, Contact, Methanol — T/P/yield/rate/cost/ΔStotal), and Practice. '
    + 'Its kinetics_ tools drive every tab on screen with live animations and return exact readings; kinetics_state reports what is shown now.';

  const kernelTools = () => provideKernelTools('kinetics', KERNEL_ABOUT, [
    {
      name: 'kinetics_state',
      description: 'Read the current Kinetics Lab state: active tab, selections, parameters with ranges/units, live readouts on screen, and available reactions/processes/practicals across all tabs.',
      parameters: { type: 'object', properties: {} },
      run: () => {
        const cur = mode === 'collide' ? describeCollide(collide, collideRef?.getLive())
          : mode === 'catalyst' ? describeCatalyst(catalyst, catalystRef?.getState())
          : mode === 'measure' ? formatMeasure()
          : mode === 'orders' ? formatOrders()
          : mode === 'cp' ? formatPractical()
          : mode === 'mech' ? formatMech()
          : mode === 'equil' ? formatEquil()
          : mode === 'k' ? formatK()
          : mode === 'industry' ? describeIndustry(industry)
          : `Practice: topic = ${topic.t}, score = ${score.right}/${score.total}, streak = ${score.streak}, best = ${score.best}.`;
        return [
          `Mode: ${mode} (${INFO[mode][0]} — ${INFO[mode][1]})`,
          cur,
          'Available options:',
          'Catalyst surfaces: ethene (C2H4 + H2 on Ni), haber (N2 + 3H2 on Fe).',
          measureList(),
          'Core practicals: cp9a (iodination of propanone), cp9b (iodine clock), cp10 (Arrhenius Ea).',
          mechExList(),
          'Dynamic equilibrium systems: ' + describeEqSysList(),
          kRxnList(),
          procList(),
          topicList(),
        ].join('\n');
      },
    },
    {
      name: 'kinetics_mode',
      description: 'Switch the Kinetics Lab tab (collide, catalyst, measure, orders, cp, mech, equil, k, industry, practice) and optionally pick a practice topic.',
      parameters: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['collide', 'catalyst', 'measure', 'orders', 'cp', 'mech', 'equil', 'k', 'industry', 'practice'] },
          practice_topic: { type: 'string', description: 'Only for practice: all, collide, catalyst, measure, orders, mech, arrhenius, equil, k, or industry.' },
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
      name: 'kinetics_collide',
      description: 'Drive the Collisions & Maxwell–Boltzmann tab: set temperature T (200–700 K), optional 2nd comparison temperature T2, gas vs solid surface-area mode, particle count (concentration), piston volume (pressure), lump vs powder, or add/remove a catalyst.',
      parameters: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['gas', 'solid'], description: '"gas" (A + B gases) or "solid" (solid in acid, surface area).' },
          T: { type: 'number', description: 'Temperature in K (200–700, step 10).' },
          T2: { type: 'number', description: 'Second comparison temperature on the M–B curve in K (200–700, or 0 to hide).' },
          particles: { type: 'number', description: 'Number of particles / concentration (40–240, step 20).' },
          volume_pct: { type: 'number', description: 'Gas piston volume in % (35–100, step 5; lower volume = higher pressure).' },
          solid: { type: 'string', enum: ['lump', 'powder'], description: 'In solid mode: one lump or powder (27 grains).' },
          catalyst: { type: 'boolean', description: 'Add or remove catalyst (lowers Ea from 12 to 7 kJ mol⁻¹ on the M–B curve).' },
          show_hist: { type: 'boolean', description: 'Overlay box particle energy histogram on the M–B curve.' },
          magnify_tail: { type: 'boolean', description: 'Magnify the high-energy tail ×10.' },
          restart: { type: 'boolean', description: 'Restart the particle box from fresh reactants.' },
        },
      },
      run: async (a) => {
        await showMode('collide');
        if (a.mode !== undefined) {
          const m = String(a.mode).toLowerCase();
          if (m !== 'gas' && m !== 'solid') throw new Error('mode must be "gas" or "solid".');
          collide.mode = m;
        }
        if (a.T !== undefined) collide.T = clamp(num(a.T, 'T'), 200, 700, 10);
        if (a.T2 !== undefined) {
          const v = num(a.T2, 'T2');
          collide.T2 = v <= 0 ? 0 : clamp(v, 200, 700, 10);
        }
        if (a.particles !== undefined) collide.n = clamp(num(a.particles, 'particles'), 40, 240, 20);
        if (a.volume_pct !== undefined) {
          let v = num(a.volume_pct, 'volume_pct');
          if (v > 1) v /= 100;
          collide.vol = Number(clamp(v, 0.35, 1, 0.05).toFixed(2));
        }
        if (a.solid !== undefined) {
          const s = String(a.solid).toLowerCase();
          if (s !== 'lump' && s !== 'powder') throw new Error('solid must be "lump" or "powder".');
          collide.mode = 'solid'; collide.lump = s === 'lump';
        }
        if (typeof a.catalyst === 'boolean') collide.cat = a.catalyst;
        if (typeof a.show_hist === 'boolean') collide.hist = a.show_hist;
        if (typeof a.magnify_tail === 'boolean') collide.mag = a.magnify_tail;
        if (a.restart) collideRef?.restart();
        await tick(); await wait(450);
        return describeCollide(collide, collideRef?.getLive());
      },
    },
    {
      name: 'kinetics_catalyst',
      description: 'Drive the Catalysts tab: choose the 3D heterogeneous surface (ethene + H2 on Ni, or Haber N2 + 3H2 on Fe) and its stage, toggle exothermic/endothermic reaction profiles with/without catalyst, adjust M–B temperature T, or run the homogeneous Co²⁺/tartrate colour-change demo.',
      parameters: {
        type: 'object',
        properties: {
          surface: { type: 'string', description: 'ethene (Ni) or haber (Fe).' },
          stage: { type: 'string', description: '1-based surface stage number (1–5 for ethene, 1–6 for haber) or "play".' },
          profile: { type: 'string', enum: ['exo', 'endo'], description: 'Reaction profile: exo (exothermic) or endo (endothermic).' },
          show_uncat: { type: 'boolean', description: 'Show uncatalysed route on reaction profile.' },
          show_cat: { type: 'boolean', description: 'Show catalysed route (with intermediate) on reaction profile.' },
          T: { type: 'number', description: 'Temperature in K (200–700, step 10) for the catalyst M–B curve.' },
          cobalt_demo: { type: 'string', description: '"run" to animate the Co²⁺ → green Co³⁺ → pink Co²⁺ demo, or step number 1–4.' },
        },
      },
      run: async (a) => {
        await showMode('catalyst');
        if (a.surface !== undefined) { catalyst.surf = matchSurf(String(a.surface)); catalystRef?.setStage(0); }
        if (a.stage !== undefined) {
          const s = String(a.stage).toLowerCase();
          if (s === 'play') catalystRef?.setStage('play');
          else {
            const max = SURFACES[catalyst.surf].stages.length;
            const idx = clamp(Math.round(num(a.stage, 'stage')) - 1, 0, max - 1);
            catalystRef?.setStage(idx);
          }
        }
        if (a.profile !== undefined) catalyst.kind = matchProfile(String(a.profile));
        if (typeof a.show_uncat === 'boolean') catalyst.uncat = a.show_uncat;
        if (typeof a.show_cat === 'boolean') catalyst.cat = a.show_cat;
        if (a.T !== undefined) catalyst.T = clamp(num(a.T, 'T'), 200, 700, 10);
        if (a.cobalt_demo !== undefined) {
          const d = String(a.cobalt_demo).toLowerCase();
          if (d === 'run') await catalystRef?.runCoDemo();
          else catalystRef?.setCoStep(clamp(Math.round(num(a.cobalt_demo, 'cobalt_demo')) - 1, 0, 3));
        }
        await tick();
        return describeCatalyst(catalyst, catalystRef?.getState());
      },
    },
    {
      name: 'kinetics_measure',
      description: 'Drive the Measuring Rates bench: pick a reaction (marble + HCl, H2O2 + MnO2, Mg + HCl, thiosulfate cross, or iodine + propanone), set its method & variables, run it on screen with animation, and optionally place the true tangent at any time t.',
      parameters: {
        type: 'object',
        properties: {
          reaction: { type: 'string', description: 'marble, h2o2, mg, thio, or iodine (names and formulae work).' },
          method: { type: 'string', description: 'syringe, mass, cross, or colour (must be valid for the reaction).' },
          conc: { type: 'number', description: '[HCl] or [H2O2] in mol dm⁻³ (0.1–0.4 for marble/h2o2; 0.5–2.0 for mg).' },
          temp: { type: 'number', description: 'Water bath temperature in °C (15–55, step 5).' },
          size: { type: 'string', enum: ['large', 'small', 'powder'], description: 'Marble chip size.' },
          cat_mass: { type: 'number', description: 'MnO2 catalyst mass in g (0.1–0.5, step 0.05) for h2o2.' },
          mg_mass: { type: 'number', description: 'Mg ribbon mass in g (0.02–0.1, step 0.01) for mg.' },
          v_thio: { type: 'number', description: 'Thiosulfate volume in cm³ (10–50, step 5) for thio.' },
          i2: { type: 'number', description: '[I2]0 in mol dm⁻³ (0.002–0.005) for iodine.' },
          propanone: { type: 'number', description: '[propanone] in mol dm⁻³ (0.5–2.0) for iodine.' },
          acid: { type: 'number', description: '[H+] in mol dm⁻³ (0.25–1.0) for iodine.' },
          action: { type: 'string', enum: ['run', 'finish', 'reset', 'clear_table'], description: '"run" animates the reaction to completion; "finish" jumps straight to the end; "reset" zeroes the clock.' },
          tangent_at: { type: 'number', description: 'Place the true tangent at this time in seconds (e.g. 0 for initial rate).' },
          plot_by: { type: 'string', enum: ['conc', 'temp'], description: 'For thiosulfate: plot 1/t against concentration or temperature.' },
        },
      },
      run: async (a) => {
        await showMode('measure');
        let rxi = MEASURE_RX.find((r) => r.id === measure.rx) ?? MEASURE_RX[0];
        if (a.reaction !== undefined) {
          rxi = matchMeasureRx(String(a.reaction));
          measure.rx = rxi.id;
          if (!rxi.methods.includes(measure.method)) measure.method = rxi.methods[0];
          // keep conc inside the new reaction's valid slider range
          if (rxi.id === 'mg' && measure.conc < 0.5) measure.conc = 1.0;
          if ((rxi.id === 'marble' || rxi.id === 'h2o2') && measure.conc > 0.4) measure.conc = 0.4;
        }
        if (a.method !== undefined) measure.method = matchMethod(String(a.method), rxi.methods);
        if (a.conc !== undefined) {
          const [lo, hi, st] = measure.rx === 'mg' ? [0.5, 2, 0.25] : [0.1, 0.4, 0.05];
          measure.conc = Number(clamp(num(a.conc, 'conc'), lo, hi, st).toFixed(2));
        }
        if (a.temp !== undefined) measure.temp = clamp(num(a.temp, 'temp'), 15, 55, 5);
        if (a.size !== undefined) measure.size = matchSize(String(a.size));
        if (a.cat_mass !== undefined) measure.cat = Number(clamp(num(a.cat_mass, 'cat_mass'), 0.1, 0.5, 0.05).toFixed(2));
        if (a.mg_mass !== undefined) measure.mg = Number(clamp(num(a.mg_mass, 'mg_mass'), 0.02, 0.1, 0.01).toFixed(2));
        if (a.v_thio !== undefined) measure.vThio = clamp(num(a.v_thio, 'v_thio'), 10, 50, 5);
        if (a.i2 !== undefined) measure.i2 = Number(clamp(num(a.i2, 'i2'), 0.002, 0.005, 0.0005).toFixed(4));
        if (a.propanone !== undefined) measure.prop = Number(clamp(num(a.propanone, 'propanone'), 0.5, 2, 0.25).toFixed(2));
        if (a.acid !== undefined) measure.acid = Number(clamp(num(a.acid, 'acid'), 0.25, 1, 0.25).toFixed(2));
        if (a.plot_by === 'conc' || a.plot_by === 'temp') measure.plotBy = a.plot_by;
        await tick();
        if (a.action === 'clear_table') measureRef?.clearTable();
        else if (a.action === 'reset') measureRef?.resetRun();
        else if (a.action === 'finish') await measureRef?.runToEnd(false);
        else if (a.action === 'run' || a.tangent_at !== undefined) await measureRef?.runToEnd(a.action === 'run');
        if (a.tangent_at !== undefined) measureRef?.showTrueTangent(num(a.tangent_at, 'tangent_at'));
        await tick();
        return formatMeasure();
      },
    },
    {
      name: 'kinetics_orders',
      description: 'Drive the Rate Equations tab: set orders m (in A) and n (in B) to 0, 1 or 2, rate constant k (0.001–1), starting concentrations [A]₀ and [B]₀, excess-B toggle, animate the run, or generate a new initial-rates table.',
      parameters: {
        type: 'object',
        properties: {
          m: { type: 'number', description: 'Order with respect to A: 0, 1, or 2.' },
          n: { type: 'number', description: 'Order with respect to B: 0, 1, or 2.' },
          k: { type: 'number', description: 'Rate constant k (0.001 to 1).' },
          A0: { type: 'number', description: 'Starting [A] in mol dm⁻³ (0.1–1, step 0.05).' },
          B0: { type: 'number', description: 'Starting [B] in mol dm⁻³ (0.1–1, step 0.05).' },
          excess_B: { type: 'boolean', description: 'Keep B in large excess so [B] stays constant (pseudo-order in A).' },
          action: { type: 'string', enum: ['run', 'new_problem'], description: '"run" animates the 3D rate surface; "new_problem" loads a fresh initial-rates table.' },
        },
      },
      run: async (a) => {
        await showMode('orders');
        if (a.m !== undefined) orders.m = matchOrd(a.m, 'm');
        if (a.n !== undefined) orders.n = matchOrd(a.n, 'n');
        if (a.k !== undefined) orders.lk = Number(clamp(Math.log10(Math.max(1e-4, num(a.k, 'k'))), -3, 0, 0.05).toFixed(2));
        if (a.A0 !== undefined) orders.A0 = Number(clamp(num(a.A0, 'A0'), 0.1, 1, 0.05).toFixed(2));
        if (a.B0 !== undefined) orders.B0 = Number(clamp(num(a.B0, 'B0'), 0.1, 1, 0.05).toFixed(2));
        if (typeof a.excess_B === 'boolean') orders.excess = a.excess_B;
        await tick();
        if (a.action === 'new_problem') ordersRef?.newInitialRates();
        else if (a.action === 'run') await ordersRef?.playRun(true);
        return formatOrders();
      },
    },
    {
      name: 'kinetics_practical',
      description: 'Drive Core Practicals 9a (iodination of propanone by titration/colorimeter), 9b (iodine clock varying KI or H2O2), and 10 (iodine clock at 20–60 °C for Arrhenius Ea). Runs the practical on screen and records data into the results table and graph.',
      parameters: {
        type: 'object',
        properties: {
          practical: { type: 'string', description: 'cp9a, cp9b, or cp10.' },
          follow: { type: 'string', enum: ['titrate', 'color'], description: 'CP9a only: titration or colorimeter.' },
          c_propanone: { type: 'number', description: 'CP9a: propanone stock in mol dm⁻³ (0.5–2.0, step 0.5).' },
          c_acid: { type: 'number', description: 'CP9a: HCl stock in mol dm⁻³ (0.5–2.0, step 0.5).' },
          vary: { type: 'string', enum: ['KI', 'H2O2'], description: 'CP9b: which stock to vary.' },
          vol: { type: 'number', description: 'CP9b: volume of varied stock in cm³ (2, 4, 6, 8, or 10).' },
          temp_c: { type: 'number', description: 'CP10: water bath temperature in °C (20–60, step 5).' },
          action: { type: 'string', enum: ['run', 'reset'], description: '"run" executes and records one run; "reset" clears the table.' },
        },
      },
      run: async (a) => {
        await showMode('cp');
        if (a.practical !== undefined) cp.view = matchPractical(String(a.practical));
        if (a.follow === 'titrate' || a.follow === 'color') cp.follow = a.follow;
        if (a.c_propanone !== undefined) cp.cProp = Number(clamp(num(a.c_propanone, 'c_propanone'), 0.5, 2, 0.5).toFixed(1));
        if (a.c_acid !== undefined) cp.cAcid = Number(clamp(num(a.c_acid, 'c_acid'), 0.5, 2, 0.5).toFixed(1));
        if (a.vary !== undefined) {
          const v = norm(String(a.vary));
          if (v === 'ki' || v === 'i-') cp.vary = 'KI';
          else if (v === 'h2o2' || v.includes('peroxide')) cp.vary = 'H2O2';
          else throw new Error('vary must be "KI" or "H2O2".');
        }
        if (a.vol !== undefined) cp.vol = clamp(num(a.vol, 'vol'), 2, 10, 2);
        if (a.temp_c !== undefined) cp.T = clamp(num(a.temp_c, 'temp_c'), 20, 60, 5);
        await tick();
        if (a.action === 'reset') cpRef?.resetPractical();
        else if (a.action === 'run') await cpRef?.runPractical();
        await tick();
        return formatPractical();
      },
    },
    {
      name: 'kinetics_mechanism',
      description: 'Drive the Mechanisms tab: play or scrub 3D SN2 (primary) or SN1 (tertiary, front/back attack), step through the 4 curly-arrow steps of propanone iodination, or load a rate-equation ↔ slow-step example.',
      parameters: {
        type: 'object',
        properties: {
          sn: { type: 'string', enum: ['sn2', 'sn1'], description: '3D substitution mechanism: sn2 or sn1.' },
          attack_side: { type: 'string', enum: ['back', 'front'], description: 'SN1 only: face OH⁻ attacks.' },
          progress: { type: 'string', description: '"play" to animate 0→1, or a number 0–1 (e.g. 0.5 for transition state / carbocation).' },
          iodination_step: { type: 'number', description: 'Propanone iodination curly-arrow step (1–4; step 2 is the slow RDS).' },
          example: { type: 'string', description: 'Rate-equation ↔ mechanism example: no2co, no2f2, h2o2, propanone, sn1, sn2, or no.' },
          example_mode: { type: 'string', enum: ['pick', 'write'], description: '"pick" (rate equation → mechanism) or "write" (mechanism → rate equation).' },
        },
      },
      run: async (a) => {
        await showMode('mech');
        if (a.sn !== undefined) {
          const s = String(a.sn).toLowerCase();
          if (s !== 'sn1' && s !== 'sn2') throw new Error('sn must be "sn1" or "sn2".');
          mech.sn = s;
        }
        if (a.attack_side !== undefined) {
          const s = String(a.attack_side).toLowerCase();
          if (s !== 'back' && s !== 'front') throw new Error('attack_side must be "back" or "front".');
          mech.side = s;
        }
        if (a.iodination_step !== undefined) mech.step = clamp(Math.round(num(a.iodination_step, 'iodination_step')) - 1, 0, 3);
        if (a.example !== undefined) mech.ex = matchExample(String(a.example)).id;
        if (a.example_mode === 'pick' || a.example_mode === 'write') mech.exMode = a.example_mode;
        await tick();
        if (a.progress !== undefined) {
          if (String(a.progress).toLowerCase() === 'play') mechRef?.playSn();
          else {
            let v = num(a.progress, 'progress');
            if (v > 1 && v <= 100) v /= 100;
            mechRef?.setProgress(v);
          }
        }
        await tick();
        return formatMech();
      },
    },
    {
      name: 'kinetics_equil',
      description: 'Drive the live 3D Dynamic Equilibrium & Le Chatelier tab (N₂O₄ ⇌ 2NO₂, H₂ + I₂ ⇌ 2HI, or ICl + Cl₂ ⇌ ICl₃ U-tube). Disturbs T, volume/pressure, concentration, catalyst, or Cl₂ flow on screen and waits for the system to settle. (For Haber N₂ + 3H₂ ⇌ 2NH₃, Contact, or Methanol, use kinetics_industry or kinetics_k.)',
      parameters: {
        type: 'object',
        properties: {
          system: { type: 'string', description: 'no2 (N2O4 ⇌ 2NO2), hi (H2 + I2 ⇌ 2HI), or icl (ICl + Cl2 ⇌ ICl3).' },
          T: { type: 'number', description: 'Water-bath temperature in K (no2: 260–380 K; hi: 600–800 K; icl: 273–360 K).' },
          delta_T: { type: 'number', description: 'Relative temperature change in K (e.g. +30 or -30).' },
          volume_cm3: { type: 'number', description: 'Gas syringe volume in cm³ (40–100; smaller volume = higher pressure).' },
          pressure: { type: 'string', enum: ['increase', 'decrease'], description: 'Shortcut: "increase" halves volume (push plunger in), "decrease" doubles volume (pull plunger out).' },
          add_species: { type: 'boolean', description: 'Inject more NO2 (for no2) or H2 (for hi).' },
          catalyst: { type: 'boolean', description: 'Add or remove a catalyst (speeds forward and backward equally; K and position unchanged).' },
          chlorine: { type: 'string', enum: ['flow', 'stop', 'vent'], description: 'ICl U-tube only: pass in Cl2, stop Cl2, or turn tube upside down to vent Cl2.' },
          reset: { type: 'boolean', description: 'Reset the system to its starting equilibrium.' },
        },
      },
      run: async (a) => {
        await showMode('equil');
        if (a.system !== undefined) {
          equil.sys = matchEquilSys(String(a.system));
          await tick();
        }
        await equilRef?.disturb({
          T: a.T !== undefined ? num(a.T, 'T') : undefined,
          deltaT: a.delta_T !== undefined ? num(a.delta_T, 'delta_T') : undefined,
          V: a.volume_cm3 !== undefined ? num(a.volume_cm3, 'volume_cm3') : undefined,
          pressure: a.pressure === 'increase' || a.pressure === 'decrease' ? a.pressure : undefined,
          add: a.add_species === true,
          cat: typeof a.catalyst === 'boolean' ? a.catalyst : undefined,
          chlorine: a.chlorine === 'flow' || a.chlorine === 'stop' || a.chlorine === 'vent' ? a.chlorine : undefined,
          reset: a.reset === true,
        });
        return formatEquil();
      },
    },
    {
      name: 'kinetics_k',
      description: 'Drive the Kc & Kp ICE-table tab: load any of the 7 equilibria (Haber N2 + 3H2 ⇌ 2NH3, HI, N2O4, esterification, Fe²⁺ + Ag⁺, CaCO3, NH4Cl), choose Kc or Kp, adjust volume V, total pressure P, initial moles, measured equilibrium moles, or 3D progress.',
      parameters: {
        type: 'object',
        properties: {
          reaction: { type: 'string', description: 'haber, hi, no2, ester, fe, caco3, or nh4cl (names/formulae work).' },
          constant: { type: 'string', enum: ['Kc', 'Kp'], description: 'Kc or Kp (Kp only for gas-containing equilibria).' },
          V: { type: 'number', description: 'Mixture volume in dm³ (> 0, for Kc).' },
          P: { type: 'number', description: 'Total equilibrium pressure in atm (> 0, for Kp).' },
          initial_moles: { type: 'array', items: { type: 'number' }, description: 'Initial moles for each species in equation order.' },
          measured_species: { type: 'string', description: 'Species formula or 0-based index measured at equilibrium.' },
          measured_moles: { type: 'number', description: 'Equilibrium moles of the measured species.' },
          progress: { type: 'number', description: '3D view progress from start (0) to equilibrium (1).' },
          reset: { type: 'boolean', description: 'Reset the ICE table to the data-book preset.' },
        },
      },
      run: async (a) => {
        await showMode('k');
        let targetRx = K_RXNS.find((r) => r.id === kc.rx) ?? K_RXNS[0];
        const wantMode = a.constant === 'Kc' || a.constant === 'Kp' ? a.constant : undefined;
        if (a.reaction !== undefined) {
          targetRx = matchKRxn(String(a.reaction));
          if (wantMode === 'Kp' && !targetRx.kp) throw new Error(`${targetRx.name} has no gases, so only Kc applies.`);
          kRef?.selectPreset(targetRx.id, wantMode);
        } else if (wantMode) {
          if (wantMode === 'Kp' && !targetRx.kp) throw new Error(`${targetRx.name} has no gases, so only Kc applies.`);
          kRef?.selectPreset(targetRx.id, wantMode);
        } else if (a.reset) {
          kRef?.resetData();
        }
        await tick();
        if (a.V !== undefined) kc.V = Math.max(0.001, num(a.V, 'V'));
        if (a.P !== undefined) kc.P = Math.max(0.001, num(a.P, 'P'));
        if (Array.isArray(a.initial_moles)) {
          if (a.initial_moles.length !== targetRx.sp.length) {
            throw new Error(`initial_moles for ${targetRx.name} needs ${targetRx.sp.length} values (${targetRx.sp.map((s) => s.f).join(', ')}).`);
          }
          kc.n0 = a.initial_moles.map((x, i) => Math.max(0, num(x, `initial_moles[${i}]`)));
        }
        if (a.measured_species !== undefined) {
          const raw = String(a.measured_species);
          const idx = /^\d+$/.test(raw.trim())
            ? clamp(Number(raw), 0, targetRx.sp.length - 1)
            : targetRx.sp.findIndex((s) => norm(s.f) === norm(raw));
          if (idx < 0) throw new Error(`No species in ${targetRx.name} matches "${raw}". Species: ${targetRx.sp.map((s) => s.f).join(', ')}.`);
          kc.meas = idx;
        }
        if (a.measured_moles !== undefined) kc.neq = Math.max(0, num(a.measured_moles, 'measured_moles'));
        if (a.progress !== undefined) {
          let p = num(a.progress, 'progress');
          if (p > 1 && p <= 100) p /= 100;
          kc.prog = Number(clamp(p, 0, 1, 0.01).toFixed(2));
        }
        await tick();
        return formatK();
      },
    },
    {
      name: 'kinetics_industry',
      description: 'Drive the Industrial Equilibria tab: Haber process (N₂ + 3H₂ ⇌ 2NH₃), Contact process (2SO₂ + O₂ ⇌ 2SO₃), or Methanol synthesis (CO + 2H₂ ⇌ CH₃OH). Set temperature (°C) and pressure (atm), or increase/decrease them, to see the 3D yield landscape, Kp, rate, cost and ΔStotal = R ln K.',
      parameters: {
        type: 'object',
        properties: {
          process: { type: 'string', description: 'haber (N2 + 3H2 ⇌ 2NH3), contact (2SO2 + O2 ⇌ 2SO3), or methanol (CO + 2H2 ⇌ CH3OH).' },
          T: { type: 'number', description: 'Temperature in °C (Haber 300–650, Contact 350–750, Methanol 150–450).' },
          P: { type: 'number', description: 'Pressure in atm (Haber 1–400, Contact 1–10, Methanol 1–150).' },
          pressure: { type: 'string', enum: ['increase', 'decrease'], description: 'Shortcut to noticeably raise or lower the pressure.' },
          temperature: { type: 'string', enum: ['increase', 'decrease'], description: 'Shortcut to noticeably raise or lower the temperature.' },
          use_real: { type: 'boolean', description: 'Jump to the real industrial compromise conditions.' },
          measure: { type: 'string', enum: ['frac', 'conv'], description: 'Surface height: mole % product ("frac") or % converted ("conv").' },
          colour: { type: 'string', enum: ['yield', 'rate', 'cost'], description: 'Colour the 3D surface by yield, rate, or cost.' },
        },
      },
      run: async (a) => {
        await showMode('industry');
        let proc = PROCS.find((x) => x.id === industry.proc) ?? PROCS[0];
        if (a.process !== undefined) {
          proc = matchProc(String(a.process));
          industry.proc = proc.id;
          industry.T = proc.real.T;
          industry.P = proc.real.P;
          industry.measure = proc.id === 'contact' ? 'conv' : 'frac';
        }
        if (a.use_real) { industry.T = proc.real.T; industry.P = proc.real.P; }
        if (a.T !== undefined) industry.T = clamp(num(a.T, 'T'), proc.Tr[0], proc.Tr[1], 5);
        else if (a.temperature === 'increase') industry.T = clamp(industry.T + 100, proc.Tr[0], proc.Tr[1], 5);
        else if (a.temperature === 'decrease') industry.T = clamp(industry.T - 100, proc.Tr[0], proc.Tr[1], 5);
        const pStep = proc.Pr[1] <= 20 ? 0.5 : 1;
        const pJump = proc.id === 'haber' ? 150 : proc.id === 'contact' ? 4 : 50;
        if (a.P !== undefined) industry.P = clamp(num(a.P, 'P'), proc.Pr[0], proc.Pr[1], pStep);
        else if (a.pressure === 'increase') industry.P = clamp(industry.P + pJump, proc.Pr[0], proc.Pr[1], pStep);
        else if (a.pressure === 'decrease') industry.P = clamp(industry.P - pJump, proc.Pr[0], proc.Pr[1], pStep);
        if (a.measure === 'frac' || a.measure === 'conv') industry.measure = a.measure;
        if (a.colour === 'yield' || a.colour === 'rate' || a.colour === 'cost') industry.colour = a.colour;
        await tick();
        return describeIndustry(industry);
      },
    },
  ]);

  onMount(() => {
    addEventListener('hashchange', fromHash);
    glint('.exbtn,.qpanel');
    const unprovide = kernelTools();
    return () => { removeEventListener('hashchange', fromHash); unprovide(); };
  });
</script>

<SimHeader title="Kinetics Lab" eyebrow="Edexcel IAL Chemistry · Units 2 and 4 · Kinetics and equilibria"
  back={{ href: '/chemistry/', label: 'Arsenal' }} tabs={TABS} value={mode} onselect={setMode} />
<StatusLine label={INFO[mode][0]} hint={INFO[mode][1]} stats={shown} />

<div bind:this={views.collide}><Collide bind:this={collideRef} prefs={collide} hidden={mode !== 'collide'} bind:stats={stats.collide} /></div>
<div bind:this={views.catalyst}><Catalyst bind:this={catalystRef} prefs={catalyst} hidden={mode !== 'catalyst'} bind:stats={stats.catalyst} /></div>
<div bind:this={views.measure}><Measure bind:this={measureRef} prefs={measure} hidden={mode !== 'measure'} bind:stats={stats.measure} /></div>
<div bind:this={views.orders}><Orders bind:this={ordersRef} prefs={orders} hidden={mode !== 'orders'} bind:stats={stats.orders} /></div>
<div bind:this={views.cp}><Practicals bind:this={cpRef} prefs={cp} hidden={mode !== 'cp'} bind:stats={stats.cp} /></div>
<div bind:this={views.mech}><Mechanism bind:this={mechRef} prefs={mech} hidden={mode !== 'mech'} bind:stats={stats.mech} /></div>
<div bind:this={views.equil}><Equil bind:this={equilRef} prefs={equil} hidden={mode !== 'equil'} bind:stats={stats.equil} /></div>
<div bind:this={views.k}><Constants bind:this={kRef} prefs={kc} hidden={mode !== 'k'} bind:stats={stats.k} /></div>
<div bind:this={views.industry}><Industry prefs={industry} hidden={mode !== 'industry'} bind:stats={stats.industry} /></div>
<div bind:this={views.practice}><Practice {score} bind:topic={topic.t} hidden={mode !== 'practice'} /></div>
