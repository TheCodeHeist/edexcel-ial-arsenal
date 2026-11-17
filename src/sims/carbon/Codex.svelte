<script lang="ts">
  /* Codex: every reaction (cards or route maps), every test and every technique, with self-test. */
  import { tick } from 'svelte';
  import { chem, esc } from '../../lib/chem';
  import { molSVG } from '../../lib/molecule';
  import { enter, fadeIn } from '../../lib/motion';
  import SubTabs from '../../components/ui/SubTabs.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import FilterRow from '../../components/ui/FilterRow.svelte';
  import SearchInput from '../../components/ui/SearchInput.svelte';
  import Flowchart, { type FlowEdge } from '../../components/ui/Flowchart.svelte';
  import { CP, RG, RX, FAM, UNIT, CLASSN, TESTS, TECH, PREPS, FLOWS, type Fam, type Level, type Flow } from './data';
  import { APP } from './art';
  import { useCarbon, type CxSub } from './app.svelte';
  import RxCard from './RxCard.svelte';
  import TestCard from './TestCard.svelte';
  import ProcCard from './ProcCard.svelte';

  let { hidden = false }: { hidden?: boolean } = $props();
  const app = useCarbon();
  const cx = $derived(app.cx);

  let fFam = $state<'all' | Fam>('all'), fUnit = $state<'all' | Level>('all'), q = $state('');
  let grid = $state<HTMLElement>(), flows = $state<HTMLElement>(), tgrid = $state<HTMLElement>(), prepEl = $state<HTMLElement>();
  let rxEl = $state<HTMLElement>(), testsEl = $state<HTMLElement>(), cardsEl = $state<HTMLElement>(), flowEl = $state<HTMLElement>();

  const list = $derived.by(() => {
    const s = q.trim().toLowerCase();
    return RX.filter((r) => (fFam === 'all' || r.fam === fFam) && (fUnit === 'all' || r.unit === fUnit) &&
      (!s || [CP[r.a].n, CP[r.b] ? CP[r.b].n : RG[r.b].f + ' ' + RG[r.b].n, ...r.p.map((p) => CP[p].n), r.mech, CLASSN[CP[r.a].cls]].join(' ').toLowerCase().includes(s)));
  });
  const famOpts = [['all', 'All types', ''] as const, ...(Object.keys(FAM) as Fam[]).map((k) => [k, FAM[k][0], 't-' + k] as const)];
  const unitOpts = [['all', 'All'], ['AS', UNIT.AS], ['A2', UNIT.A2]] as const;
  const FMTS = [['skeletal', 'Skeletal', 'Skel.'], ['displayed', 'Displayed', 'Disp.'], ['structural', 'Structural', 'Struct.']] as const;

  const INTRO: Record<CxSub, [string, string]> = {
    reactions: ['Every reaction in the lab — filter by type or level, or switch to the flowchart route maps.', 'Self-test: tap a card to predict the product. Use the flowchart to drill the reagents on each arrow.'],
    tests: ['The chemical tests for identifying organic functional groups.', 'Self-test: tap a test to say what it is positive for.'],
    preparation: ['How organic products are made, separated and purified.', 'Self-test: rebuild each procedure by tapping its steps in the right order.'],
  };

  async function stagger() {
    await tick();
    if (cx.sub === 'reactions') { if (cx.layout === 'cards') enter(grid, '.rxc'); else enter(flows, '.flow', '--i', 4); }
    else if (cx.sub === 'tests') enter(tgrid, '.tcx');
    else enter(prepEl, '.tech,.proc');
  }
  // a sub-view or layout switch crossfades and restaggers its cards
  $effect(() => { void cx.sub; void cx.layout; if (!hidden) { fadeIn(cx.sub === 'reactions' ? (cx.layout === 'cards' ? cardsEl : flowEl) : cx.sub === 'tests' ? testsEl : prepEl); stagger(); } });

  /* route maps */
  const SIZE = { w: 182, h: 62, cs: 238, rs: 132, pad: 34 }, NARROW = { w: 160, h: 62, cs: 200, rs: 128, pad: 34 };
  const ARO = { w: 196, h: 74, cs: 250, rs: 140, pad: 34 }, ARO_NARROW = { w: 196, h: 74, cs: 232, rs: 136, pad: 34 };
  const flowNodes = (F: Flow) => Object.fromEntries(Object.entries(F.nodes).map(([k, n]) => [k, [n[0], n[1]] as const]));
  const flowEdges = (F: Flow): FlowEdge[] => F.edges.map(([from, to, l1, l2, fam]) => ({ from, to, color: FAM[fam][1], title: FAM[fam][0], label: `<span class="lt">${chem(l1)}</span>`, sub: l2 ? chem(l2) : undefined }));
  let shownLabels = $state<Record<string, boolean>>({});
  $effect(() => { void cx.epoch; shownLabels = {}; });
</script>

<main class:quiz2={cx.quiz} {hidden}>
  <SubTabs label="Codex section" options={[['reactions', 'Reactions', RX.length], ['tests', 'Tests', TESTS.length], ['preparation', 'Preparation', TECH.length + PREPS.length]]} bind:value={app.cx.sub} />
  <div class="cx-head">
    <p>{INTRO[cx.sub][cx.quiz ? 1 : 0]}</p>
    <div class="qscore">
      {#if cx.quiz}<button class="btn" type="button" onclick={() => app.resetCxScore()}>Reset score</button>{/if}
      <button class="btn primary" type="button" aria-pressed={cx.quiz} onclick={() => { app.toggleQuiz(); stagger(); }}>Self-test: {cx.quiz ? 'on' : 'off'}</button>
    </div>
  </div>

  {#key cx.epoch}
    <div hidden={cx.sub !== 'reactions'} bind:this={rxEl}>
      <div class="filters">
        <FilterRow label="Type" options={famOpts} bind:value={fFam} onchange={stagger} />
        <FilterRow label="Level" options={unitOpts} bind:value={fUnit} onchange={stagger} />
        <div class="frow"><b>Find</b><SearchInput size="sm" cls="cx-search" bind:value={q} placeholder="Compound, reagent or mechanism" label="Search reactions" oninput={stagger} /></div>
      </div>
      <div class="rxbar">
        <p class="rcount">{list.length} of {RX.length} reactions</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <Seg label="Formula style" cls="fmtseg" options={FMTS} bind:value={app.prefs.fmt} />
          <Seg label="Layout" options={[['cards', 'Cards'], ['flow', 'Flowchart']]} bind:value={app.cx.layout} />
        </div>
      </div>
      <div hidden={cx.layout !== 'cards'} bind:this={cardsEl}>
        <div class="rxgrid2" bind:this={grid}>{#each list as r, i (r.id)}<RxCard {r} {i} />{:else}<p class="empty">No reactions match those filters.</p>{/each}</div>
      </div>
      <div hidden={cx.layout !== 'flow'} bind:this={flowEl}>
        <div class="legend">
          <span><i style="--lc:var(--redox)"></i>Redox</span><span><i style="--lc:var(--ligand)"></i>Substitution</span><span><i style="--lc:var(--accent)"></i>Addition</span>
          <span><i style="--lc:var(--amph)"></i>Elimination</span><span><i style="--lc:var(--cond)"></i>Condensation / hydrolysis</span>
        </div>
        <div class="flows" bind:this={flows}>
          {#each FLOWS as F (F.id)}
            {@const aro = F.id === 'aromatic'}
            <Flowchart title={F.title} tip={esc(F.blurb)} nodes={flowNodes(F)} edges={flowEdges(F)} shape="straight" cls={aro ? 'aro' : ''}
              size={aro ? ARO : SIZE} narrowSize={aro ? ARO_NARROW : NARROW}
              labelClass={(i) => (shownLabels[F.id + i] ? 'show' : '')}
              onlabel={cx.quiz ? (i) => (shownLabels[F.id + i] = !shownLabels[F.id + i]) : undefined}>
              {#snippet box(k)}
                {@const n = F.nodes[k]}
                {@const cid = n[4]}
                <span class="fsw2">{@html cid ? molSVG(CP[cid].smi, 'skeletal').svg : chem(n[3] ?? '')}</span>
                <span><span class="ff">{cid ? CP[cid].n : n[2]}</span>{#if cid}<span class="fl">{CLASSN[CP[cid].cls]}</span>{/if}</span>
              {/snippet}
            </Flowchart>
          {/each}
        </div>
      </div>
    </div>

    <div hidden={cx.sub !== 'tests'} bind:this={testsEl}>
      <div class="tgrid" bind:this={tgrid}>{#each TESTS as t, i (t.id)}<TestCard {t} {i} />{/each}</div>
    </div>

    <div hidden={cx.sub !== 'preparation'} bind:this={prepEl}>
      <h3 class="prep-sec">Techniques</h3>
      <div class="techgrid">
        {#each TECH as t, i (t.id)}
          <article class="tech" class:has-app={!!t.app} style:--i={i}>
            {#if t.app}<div class="app">{@html APP[t.app]}</div>{/if}
            <div><h4>{t.n}</h4><p>{t.what}</p><p class="w">{t.why}</p><ul>{#each t.tips as x}<li>{x}</li>{/each}</ul></div>
          </article>
        {/each}
      </div>
      <h3 class="prep-sec">Procedures{cx.quiz ? ' — put the steps in order' : ''}</h3>
      <div class="procs">{#each PREPS as p, i (p.id)}<ProcCard {p} {i} />{/each}</div>
    </div>
  {/key}
</main>
