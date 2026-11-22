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

  onMount(() => {
    addEventListener('hashchange', fromHash);
    glint('.exbtn,.qpanel');
    return () => removeEventListener('hashchange', fromHash);
  });
</script>

<SimHeader title="Kinetics Lab" eyebrow="Edexcel IAL Chemistry · Units 2 and 4 · Kinetics and equilibria"
  back={{ href: '/chemistry/', label: 'Arsenal' }} tabs={TABS} value={mode} onselect={setMode} />
<StatusLine label={INFO[mode][0]} hint={INFO[mode][1]} stats={shown} />

<div bind:this={views.collide}><Collide prefs={collide} hidden={mode !== 'collide'} bind:stats={stats.collide} /></div>
<div bind:this={views.catalyst}><Catalyst prefs={catalyst} hidden={mode !== 'catalyst'} bind:stats={stats.catalyst} /></div>
<div bind:this={views.measure}><Measure prefs={measure} hidden={mode !== 'measure'} bind:stats={stats.measure} /></div>
<div bind:this={views.orders}><Orders prefs={orders} hidden={mode !== 'orders'} bind:stats={stats.orders} /></div>
<div bind:this={views.cp}><Practicals prefs={cp} hidden={mode !== 'cp'} bind:stats={stats.cp} /></div>
<div bind:this={views.mech}><Mechanism prefs={mech} hidden={mode !== 'mech'} bind:stats={stats.mech} /></div>
<div bind:this={views.equil}><Equil prefs={equil} hidden={mode !== 'equil'} bind:stats={stats.equil} /></div>
<div bind:this={views.k}><Constants prefs={kc} hidden={mode !== 'k'} bind:stats={stats.k} /></div>
<div bind:this={views.industry}><Industry prefs={industry} hidden={mode !== 'industry'} bind:stats={stats.industry} /></div>
<div bind:this={views.practice}><Practice {score} bind:topic={topic.t} hidden={mode !== 'practice'} /></div>
