<script lang="ts">
  /* Synthesis: make the target from the starting materials, one reaction at a time. Par is the shortest route. */
  import { chem, esc } from '../../lib/chem';
  import Seg from '../../components/ui/Seg.svelte';
  import { CP, RG, RX, CLASSN, FAM, needText, type Reaction } from './data';
  import { useCarbon } from './app.svelte';
  import Mol from './Mol.svelte';
  import CircleView from './CircleView.svelte';
  import SynItems from './SynItems.svelte';

  let { hidden = false }: { hidden?: boolean } = $props();
  const app = useCarbon();
  const S = $derived(app.syn);
  const T = $derived(S.target ? CP[S.target] : null);
  const DIFFS = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']] as const;
  const withWhat = (r: Reaction) => (RG[r.b] ? chem(RG[r.b].f) : esc(CP[r.b].n) + (r.need ? ` (${needText(r.need)})` : ''));
  const hint = $derived.by(() => {
    if (S.hintRx === null) return '';
    const n = RX[S.hintRx], what = RG[n.b] ? `<b>${chem(RG[n.b].f)}</b> (${chem(RG[n.b].n)})` : `<b>${esc(CP[n.b].n)}</b>${n.need ? ` with ${needText(n.need)}` : ''}`;
    return S.hintFull ? `Next, try ${what} on <b>${esc(CP[n.a].n)}</b>.` : `Next, try ${what}.`;
  });
  let tcard = $state<HTMLElement>();
  $effect(() => { if (S.wonPulse && tcard) { tcard.classList.remove('won'); void tcard.offsetWidth; tcard.classList.add('won'); } });
</script>

{#snippet step(r: Reaction)}
  <b>{CP[r.a].n}</b> <span class="rr">+ {@html withWhat(r)}</span> → <b>{r.p.map((p) => CP[p].n).join(' + ')}</b>{#if r.by.length} <span class="rr">+ {@html r.by.map(chem).join(' + ')}</span>{/if}<br /><span class="rr">{r.mech} · {@html chem(r.cond)}</span>
{/snippet}

<main class="bay3" {hidden}>
  <section class="panel b-left" aria-label="Challenge">
    <div class="ph"><h2>The brief</h2><div class="ph-r"><small>par {S.par} step{S.par > 1 ? 's' : ''}</small></div></div>
    <div class="brief">
      {#if T}
        <div class="tcard" bind:this={tcard}>
          <div class="k">Target</div><div class="tm"><Mol id={T.id} scale={1.1} /></div>
          <div class="tn">{T.n}</div><div class="tc">{CLASSN[T.cls]} · {@html chem(T.st)}</div>
        </div>
      {/if}
      <div class="syn-ctl">
        <Seg label="Difficulty" options={DIFFS} value={app.prefs.diff} onchange={(d) => app.setDiff(d)} />
        <button class="btn" type="button" disabled={S.won || S.given} onclick={() => app.hint()}>Hint</button>
        <button class="btn" type="button" disabled={S.won || S.given} onclick={() => app.giveUp()}>Show route</button>
        <button class="btn primary" type="button" onclick={() => app.skipSyn()}>New target</button>
      </div>
      {#if !app.docked}<SynItems />{/if}
    </div>
  </section>
  <section class="panel stage2" aria-label="Transmutation circle"><CircleView circle={app.synCircle} /></section>
  <section class="panel nb nb2" aria-label="Your route">
    <div class="ph"><h2>Your route</h2><span class="score">{S.steps.length ? `${S.steps.length} step${S.steps.length > 1 ? 's' : ''}` : ''}</span></div>
    {#if hint && !S.given}<p class="hintbox" style="margin:0 14px 10px">{@html hint}</p>{/if}
    <ol class="route">
      {#each S.steps as r, i (i)}
        <li class:fresh={i === S.steps.length - 1} class:hit={r.p.includes(S.target)} style:--tc={FAM[r.fam][1]}><span class="n">{i + 1}</span><span class="rt">{@render step(r)}</span></li>
      {:else}
        <p class="empty2">Plan backwards from the target: what functional group does it have, and what could make it? Each reaction you run is added here.</p>
      {/each}
    </ol>
    {#if S.given || S.won}
      <div class="ph"><h2>A shortest route</h2></div>
      <ol class="sol">{#each S.sol as r (r.id)}<li>{@render step(r)}</li>{/each}</ol>
    {/if}
  </section>
</main>
