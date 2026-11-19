<script lang="ts">
  /* Lab: discover reactions by combining compounds and reagents in the circle. */
  import { chem, esc } from '../../lib/chem';
  import { molFormula } from '../../lib/molecule';
  import CopyButton from '../../components/ui/CopyButton.svelte';
  import { CP, RG, RX, CLASSN, FAM, LABSET, rxPlain } from './data';
  import { useCarbon } from './app.svelte';
  import Mol from './Mol.svelte';
  import Inventory from './Inventory.svelte';
  import CircleView from './CircleView.svelte';
  import MiniRx from './MiniRx.svelte';

  let { hidden = false }: { hidden?: boolean } = $props();
  const app = useCarbon();
  const P = $derived(app.lastProduct ? CP[app.lastProduct] : null);
  const madeBy = $derived(app.lastProduct ? RX.filter((r) => r.p.includes(app.lastProduct!) && LABSET.has(r.a)).slice(0, 4) : []);
  const uses = $derived(app.lastProduct ? RX.filter((r) => r.a === app.lastProduct || r.b === app.lastProduct).length : 0);
  const n = $derived(app.labLog.length);
</script>

<main class="bay3" {hidden}>
  <section class="panel b-left" aria-label="Compounds" hidden={app.docked}>
    <div class="ph"><h2>Compounds</h2><div class="ph-r"><small>{app.labFound}/{LABSET.size}</small></div></div>
    {#if !app.docked}<Inventory />{/if}
  </section>
  <section class="panel stage2" aria-label="Transmutation circle"><CircleView circle={app.lab} /></section>
  <section class="panel nb nb2" aria-label="Lab notebook">
    <div class="ph"><h2>Last product</h2></div>
    {#if P}
      {#key P.id}
        <div class="pcard swap">
          <div class="pc-mol"><Mol id={P.id} scale={1.3} /></div>
          <p class="pc-n">{P.n}</p><span class="chip">{CLASSN[P.cls]}</span>
          <dl><dt>Structural</dt><dd>{@html chem(P.st)}</dd><dt>Molecular</dt><dd>{@html chem(molFormula(P.smi))}</dd></dl>
          <p class="pc-routes"><b>Made by:</b> {@html madeBy.map((r) => `${RG[r.b] ? chem(RG[r.b].f) : esc(CP[r.b].n)} on ${esc(CP[r.a].n)}`).join(' · ') || '—'}<br /><b>Reacts on:</b> {uses} known reaction{uses === 1 ? '' : 's'}</p>
        </div>
      {/key}
    {:else}
      <p class="empty2">Nothing made yet. Your newest product appears here with its formulae.</p>
    {/if}
    <div class="ph"><h2>Lab notebook</h2><span class="score">{n ? `${n} run${n > 1 ? 's' : ''}` : ''}</span></div>
    <ol class="log">
      {#each app.labLog as e, i (e.key)}
        {@const r = RX[e.rx]}
        <li class="entry" class:fresh={i === 0}>
          <div class="e-head"><span class="e-n">#{n - i}</span><span class="e-r">{CP[r.a].n}{CP[r.b] ? ' + ' + CP[r.b].n : ''} → {r.p.map((p) => CP[p].n).join(' + ')}</span><span class="badge f-{r.fam}">{FAM[r.fam][0]}</span><CopyButton text={() => rxPlain(r)} label="Copy reaction as text" /></div>
          <MiniRx {r} />
          <div class="eq">{@html r.eq.map(chem).join('<br>')}</div>
          <p class="why"><b>{r.mech}</b> · {@html chem(r.cond)}{#if r.by.length}{' · by-product' + (r.by.length > 1 ? 's' : '') + ': '}{@html r.by.map(chem).join(', ')}{/if}</p>
        </li>
      {:else}
        <p class="empty2">Every reaction you run is written up here: equation, type and conditions.</p>
      {/each}
    </ol>
  </section>
</main>
