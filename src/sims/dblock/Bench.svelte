<script lang="ts">
  /* The bench view: stock shelf (or the unknown-ion panel) | test tube on the white tile + reagent rack | notebook. */
  import { onMount } from 'svelte';
  import { chem, ox, supN } from '../../lib/chem';
  import { rgba } from '../../lib/util';
  import { SP, SHELF, RG, RACK, AMT, TY, METAL, liqOf, laOf, dOf, dNote, type ReagentId, type Amount } from './data';
  import { Tube } from './tube';
  import type { Bench } from './bench.svelte';
  import Swatch from './Swatch.svelte';

  let { bench, hidden: offscreen = false }: { bench: Bench; hidden?: boolean } = $props();

  let canvas: HTMLCanvasElement, tile: HTMLElement, log: HTMLElement;
  onMount(() => {
    const tube = new Tube(canvas, tile);
    bench.tube = tube;
    tube.fresh(bench.cur);
    const ro = new ResizeObserver(() => tube.resize()); ro.observe(tile);
    return () => { ro.disconnect(); tube.destroy(); bench.tube = null; };
  });

  const H = $derived(bench.hidden);
  const S = $derived(SP[bench.cur]);
  const d = $derived(dOf(S));
  const rgLabel = (r: ReagentId, amt: Amount) => `${chem(RG[r].f)}${AMT[amt] ? ` <em>${AMT[amt]}</em>` : ''}`;
  const stockName = (sp: string) => SHELF.find((s) => s[0] === sp)?.[2] || SP[sp].n;
  const newestFirst = $derived(bench.entries.map((e, i) => ({ e, i })).reverse());
  // the newest entry slides in; scroll the log back to the top when it grows
  let seen = 0;
  $effect(() => { const n = bench.entries.length; if (n > seen && log) log.scrollTop = 0; seen = n; });
</script>

<main class="layout" hidden={offscreen}>
  <section class="panel shelf" aria-label="Stock solutions">
    <div class="ph"><h2>{bench.mode === 'unknown' ? 'Identify the unknown' : 'Stock solutions'}</h2></div>
    {#if bench.mode !== 'unknown'}
      <div class="shelf-list">
        {#each SHELF as [id, ion, nm] (id)}
          {@const B = SP[id]}
          <button type="button" class="bottle" aria-pressed={id === bench.start} onclick={() => bench.pickStock(id)}>
            <span class="flask" style:--c={rgba(liqOf(B), Math.max(laOf(B), 0.3))}></span>
            <span><span class="ion">{@html chem(ion)}</span><span class="nm">{nm}</span></span>
          </button>
        {/each}
      </div>
    {:else}
      <div class="unk">
        <div>
          {#if bench.revealed && bench.unknown}
            <p>Correct: <b>{@html chem(SP[bench.unknown].f)}</b> after {bench.unkTries} wrong {bench.unkTries === 1 ? 'guess' : 'guesses'}. Equations and reaction types are now shown in the notebook.</p>
          {:else}
            <p>Test the mystery solution with the reagents, then name the metal ion. Use “Fresh sample” to start a new test on the same unknown.</p>
          {/if}
          <div class="acts">
            <button class="btn" type="button" disabled={bench.busy} onclick={() => bench.unknown && bench.fresh(bench.unknown)}>Fresh sample</button>
            <button class="btn primary" type="button" disabled={bench.busy} onclick={() => bench.newUnknown()}>New unknown</button>
          </div>
        </div>
        <div>
          <p style="margin-bottom:6px"><b>It contains…</b></p>
          <div class="idgrid">
            {#each SHELF as [id, ion] (id)}
              <button type="button" disabled={bench.revealed || bench.wrongIds.includes(id)}
                class:right={bench.revealed && id === bench.unknown} class:wrong={bench.wrongIds.includes(id)}
                onclick={() => bench.guess(id)}>{@html chem(ion)}</button>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </section>

  <section class="panel stage" aria-label="Test tube">
    <div class="stage-head">
      <div class="label-chip"><small>Tube</small><span>{#if H}Unknown sample{:else}{@html chem(S.f)}{/if}</span></div>
      <div class="stage-tools">
        <button class="btn" type="button" disabled={!bench.canUndo} onclick={() => bench.undo()}>Undo</button>
        <button class="btn" type="button" disabled={bench.busy}
          onclick={() => bench.fresh(bench.mode === 'unknown' && bench.unknown ? bench.unknown : bench.start)}>Fresh tube</button>
      </div>
    </div>
    <div class="tile" bind:this={tile}>
      <canvas bind:this={canvas} aria-hidden="true"></canvas>
      <p class="sr-only" aria-live="polite">Test tube: {S.look}</p>
      <div class="status"><span class:on={!!bench.status}>{bench.status}</span></div>
      <div class="tile-note">Viewed against a white tile, as in the lab</div>
      {#if bench.ask}
        {@const a = bench.ask}
        <div class="ask">
          <h4>Predict</h4>
          <p>You add {@html chem(RG[a.r].f)}{AMT[a.amt] ? ' ' + AMT[a.amt] : ''} to {@html chem(SP[a.from].f)}. What do you see at the end?</p>
          <div class="opts">
            {#each a.options as o (o)}
              <button type="button" disabled={!!a.picked} class:right={!!a.picked && o === a.final} class:wrong={a.picked === o && o !== a.final}
                onclick={() => bench.answer(o)}>{o}</button>
            {/each}
          </div>
          <div style="margin-top:8px;text-align:right"><button class="btn" type="button" disabled={!!a.picked} onclick={() => bench.cancelAsk()}>Cancel</button></div>
        </div>
      {/if}
    </div>
    <div class="rack">
      {#each RACK as g (g.g)}
        <div class="rg"><h3>{g.g}</h3>
          <div class="items">
            {#each g.items as it (it.r + it.amt)}
              {@const rg = RG[it.r]}
              <button type="button" class="reagent" title={rg.n} disabled={bench.busy || !!bench.ask} onclick={() => bench.act(it.r, it.amt)}>
                <span class="rf"><span class="dot" style:--rc={rg.c}></span><span>{@html chem(rg.f)}</span></span><span class="rs">{it.s}</span>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </section>

  <section class="panel nb" aria-label="Lab notebook">
    <div class="ph"><h2>In the tube</h2></div>
    {#key bench.cur + H + bench.entries.length}
      <div class="spcard swap">
        {#if H}
          <div class="sp-f">Unknown</div>
          <p class="sp-n">Formula, oxidation state and equations stay hidden until you identify the ion.</p>
          <p class="look"><Swatch {S} />{S.look}</p>
        {:else}
          <div class="sp-f">{@html chem(S.f)}</div>
          <p class="sp-n">{S.n}</p>
          <p class="look"><Swatch {S} />{S.look}</p>
          <div class="chips"><span class="chip">{METAL[S.m]} {ox(S.ox)}</span><span class="chip">[Ar]{d ? ' 3d' + supN(d) : ''}</span><span class="chip">{S.geo || 'octahedral · 6'}</span></div>
          <div class="dline">
            <span class="orbs" aria-label="3d orbital diagram with {d} electrons">{#each [0, 1, 2, 3, 4] as i}<span class="orb">{d > i ? '↑' : ''}{d > i + 5 ? '↓' : ''}</span>{/each}</span>
            <span class="chip">3d{supN(d)}</span>
          </div>
          <p class="dnote">{dNote(S)}</p>
        {/if}
      </div>
    {/key}
    <div class="ph"><h2>Lab notebook</h2><span class="score">{bench.entries.length ? `${bench.entries.length} ${bench.entries.length === 1 ? 'entry' : 'entries'}` : ''}</span></div>
    <ol class="log" bind:this={log}>
      {#each newestFirst as { e, i } (i + ':' + e.kind + e.sp)}
        {@const ES = SP[e.sp]}
        <li class="entry" class:fresh={i === bench.entries.length - 1}>
          <div class="e-head">
            <span class="e-n">{String(i + 1).padStart(2, '0')}</span>
            {#if e.kind === 'start'}
              <span class="e-r">{H ? 'Took the unknown solution' : `Took ${stockName(e.sp)} solution`}</span>
            {:else if e.kind === 'none'}
              <span class="e-r">+ {@html rgLabel(e.r, e.amt)}</span><span class="badge none">No reaction</span>
            {:else}
              {#if e.of > 1 && e.step > 0}<span class="e-r"><em>…then</em></span>{:else}<span class="e-r">+ {@html rgLabel(e.r, e.amt)}</span>{/if}
              {#if !H}<span class="badge {TY[e.t.ty].cls}">{TY[e.t.ty].l}</span>{/if}
            {/if}
          </div>
          {#if e.kind === 'start'}
            <p class="e-look"><Swatch S={ES} />{ES.look}</p>
          {:else if e.kind === 'none'}
            <p class="why">{e.msg}</p>
          {:else}
            <p class="e-look"><Swatch S={ES} /><b>{ES.look}</b></p>
            {#if !H}<div class="eq">{@html chem(e.t.eq)}</div><p class="why">{e.t.why}</p>{/if}
          {/if}
        </li>
      {/each}
    </ol>
  </section>
</main>
