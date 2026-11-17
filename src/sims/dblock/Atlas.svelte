<script lang="ts">
  /* The colour atlas: every species (by metal) and every reaction (cards or flowcharts), with self-test. */
  import { tick } from 'svelte';
  import { chem, ox } from '../../lib/chem';
  import { enter, fadeIn } from '../../lib/motion';
  import SubTabs from '../../components/ui/SubTabs.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import FilterRow from '../../components/ui/FilterRow.svelte';
  import Flowchart, { type FlowEdge } from '../../components/ui/Flowchart.svelte';
  import SpeciesCard from './SpeciesCard.svelte';
  import ReactionCard from './ReactionCard.svelte';
  import MiniTube from './MiniTube.svelte';
  import { SP, T, TY, METAL, METALS, FL, rxReagent, rxNote, type MetalId, type Family, type Transition } from './data';
  import type { Score } from './bench.svelte';

  let { score, sub = $bindable(), layout = $bindable(), quiz = $bindable(), onrun, hidden = false }: {
    score: Score; sub: 'species' | 'reactions'; layout: 'cards' | 'flow'; quiz: boolean; onrun: (t: Transition) => void; hidden?: boolean;
  } = $props();

  let fM = $state<'all' | MetalId>('all');
  let fT = $state<'all' | Family>('all');
  let epoch = $state(0);            // bumps to clear every card's self-test state
  let grid = $state<HTMLElement>(), flows = $state<HTMLElement>();
  let speciesEl = $state<HTMLElement>(), rxEl = $state<HTMLElement>(), cardsEl = $state<HTMLElement>(), flowEl = $state<HTMLElement>();

  const bySpecies = METALS.map((m) => [m, Object.keys(SP).filter((id) => SP[id].m === m)] as const);
  const list = $derived(T.map((t, i) => ({ t, i }))
    .sort((a, b) => METALS.indexOf(SP[a.t.f].m) - METALS.indexOf(SP[b.t.f].m) || a.i - b.i)
    .filter(({ t }) => (fM === 'all' || SP[t.f].m === fM) && (fT === 'all' || TY[t.ty].cls === fT)));

  const metalOpts = [['all', 'All', '', 'All metals'] as const, ...METALS.map((m) => [m, m, '', METAL[m]] as const)];
  const typeOpts = [['all', 'All types', ''], ['acidbase', 'Acid–base', 't-acidbase'], ['amph', 'Amphoteric', 't-amph'], ['ligand', 'Ligand exchange', 't-ligand'], ['redox', 'Redox', 't-redox']] as const;

  async function filtered() { await tick(); enter(layout === 'cards' ? grid : flows, layout === 'cards' ? '.rx' : '.flow', '--i', layout === 'cards' ? 14 : 4); }
  function score1(ok: boolean) { score.aTotal++; if (ok) score.aRight++; }
  function toggleQuiz() { quiz = !quiz; epoch++; }
  function resetScore() { score.aRight = 0; score.aTotal = 0; epoch++; }

  // crossfade when the sub-view or layout switches
  $effect(() => { void sub; fadeIn(sub === 'species' ? speciesEl : rxEl); });
  $effect(() => { void layout; fadeIn(layout === 'cards' ? cardsEl : flowEl); });

  /* flowchart for one metal: arrows grouped by from → to, labelled with every reagent that makes that change */
  function flowEdges(m: MetalId): FlowEdge[] {
    const L = FL[m], groups = new Map<string, Transition[]>();
    for (const t of T) if (SP[t.f].m === m && L.pos[t.f] && L.pos[t.t]) { const k = t.f + '>' + t.t; groups.set(k, [...(groups.get(k) ?? []), t]); }
    return [...groups.entries()].map(([k, g]) => {
      const [from, to] = k.split('>'); const cls = TY[g[0].ty].cls;
      const notes = [...new Set(g.map(rxNote).filter(Boolean))];
      return { from, to, color: `var(--${cls})`, title: TY[g[0].ty].l, dim: !(fT === 'all' || g.some((t) => TY[t.ty].cls === fT)),
        label: [...new Set(g.map(rxReagent))].map(chem).join(' / '), sub: notes.length ? notes.join(' · ') : undefined };
    });
  }
  const FLOW_SIZE = { w: 178, h: 66, cs: 318, rs: 156, pad: 30 }, FLOW_NARROW = { w: 160, h: 64, cs: 250, rs: 150, pad: 22 };
  let shown = $state<Record<string, boolean>>({});
  $effect(() => { void epoch; void quiz; shown = {}; });

  const intro = $derived(sub === 'species'
    ? 'Every coloured species on the specification, as it looks in a test tube. Switch on self-test to hide the colours, then tap a card and pick the right colour from four options.'
    : layout === 'flow'
      ? 'Each metal as a map: boxes are species, arrows are reagents, coloured by reaction type. Look for the shape of each map. Filtering by type fades the other arrows. With self-test on, the colours are hidden: tap a box to reveal it.'
      : 'Every reaction on the bench, side by side: starting solution, reagent, result. Filter by metal or reaction type. With self-test on, the product is hidden: tap a card and choose what you would see.');
</script>

<main class:quiz {hidden}>
  <SubTabs label="Atlas view" options={[['species', 'Species', Object.keys(SP).length], ['reactions', 'Reactions', T.length]]} bind:value={sub} />
  <div class="atlas-head">
    <p>{intro}</p>
    <div class="qscore">
      {#if quiz && score.aTotal}<button class="btn" type="button" onclick={resetScore}>Reset score</button>{/if}
      <button class="btn primary" type="button" aria-pressed={quiz} onclick={toggleQuiz}>Self-test: {quiz ? 'on' : 'off'}</button>
    </div>
  </div>

  {#key epoch}
    <div hidden={sub !== 'species'} bind:this={speciesEl}>
      {#each bySpecies as [m, ids] (m)}
        <section class="metal"><h3>{METAL[m]} <span>{m}</span></h3>
          <div class="agrid">{#each ids as id (id)}<SpeciesCard {id} {quiz} onscore={score1} />{/each}</div>
        </section>
      {/each}
    </div>

    <div hidden={sub !== 'reactions'} bind:this={rxEl}>
      <div class="filters">
        <FilterRow label="Metal" options={metalOpts} bind:value={fM} onchange={filtered} />
        <FilterRow label="Type" options={typeOpts} bind:value={fT} onchange={filtered} />
      </div>
      <div class="rxbar">
        <p class="rcount">{list.length} of {T.length} reactions</p>
        <Seg label="Layout" options={[['cards', 'Cards'], ['flow', 'Flowchart']]} bind:value={layout} />
      </div>
      <div hidden={layout !== 'cards'} bind:this={cardsEl}>
        <div class="rxgrid" bind:this={grid}>
          {#each list as { t, i } (i)}<ReactionCard {t} {quiz} onscore={score1} {onrun} />{:else}<p class="empty">No reactions match these filters.</p>{/each}
        </div>
      </div>
      <div hidden={layout !== 'flow'} bind:this={flowEl}>
        <div class="legend">
          <span><i style="--lc:var(--acidbase)"></i>Acid–base</span><span><i style="--lc:var(--amph)"></i>Amphoteric</span>
          <span><i style="--lc:var(--ligand)"></i>Ligand exchange</span><span><i style="--lc:var(--redox)"></i>Redox</span>
          <span>Pill on each box = oxidation state</span>
        </div>
        <div class="flows" bind:this={flows}>
          {#each METALS.filter((m) => fM === 'all' || fM === m) as m (m)}
            <Flowchart title={METAL[m]} tip={FL[m].tip} nodes={FL[m].pos} edges={flowEdges(m)} size={FLOW_SIZE} narrowSize={FLOW_NARROW}
              boxClass={(id) => (shown[id] ? 'show' : '')} boxLabel={(id) => SP[id].n} onbox={(id) => { if (quiz) shown[id] = !shown[id]; }}>
              {#snippet box(id)}
                {@const S = SP[id]}
                <span class="fsw"><MiniTube {S} /><span class="q">?</span></span>
                <span style="min-width:0"><span class="ff">{@html chem(S.f).replace(/\)(<sub>\d<\/sub>)?(?=[([])/g, (x) => x + '<wbr>')}</span><span class="fl">{S.look}</span></span>
                <span class="fo">{ox(S.ox)}</span>
              {/snippet}
            </Flowchart>
          {/each}
        </div>
      </div>
    </div>
  {/key}
</main>
