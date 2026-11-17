<script lang="ts">
  /* The transmutation circle panel: header with the formula switch, the vessel (sigil, slots, result, toast,
     particles) and, unless the phone drawer holds it, the reagent rack. */
  import { chem, esc } from '../../lib/chem';
  import Seg from '../../components/ui/Seg.svelte';
  import CopyButton from '../../components/ui/CopyButton.svelte';
  import { CP, RG, CLASSN, FAM, UNIT, rxPlain, type Reaction } from './data';
  import { SIGIL } from './art';
  import { useCarbon } from './app.svelte';
  import type { Circle } from './circle.svelte';
  import Mol from './Mol.svelte';
  import ReagentRack from './ReagentRack.svelte';

  let { circle }: { circle: Circle } = $props();
  const app = useCarbon();
  const FMTS = [['skeletal', 'Skeletal', 'Skel.'], ['displayed', 'Displayed', 'Disp.'], ['structural', 'Structural', 'Struct.']] as const;

  let vessel: HTMLElement, fx: HTMLCanvasElement, flash: HTMLElement;
  $effect(() => { circle.vessel = vessel; circle.fx = fx; return () => { circle.vessel = null; circle.fx = null; }; });
  // replay the flash and the slot pop when their counters change
  $effect(() => { if (circle.flash && flash) { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); } });
  let slotEls: HTMLElement[] = [];
  $effect(() => { const p = circle.pop; if (p) { const el = slotEls[p.i]; if (el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); } } });

  const from = (r: Reaction) => CP[r.b]
    ? `<b>${esc(CP[r.a].n)}</b> + <b>${esc(CP[r.b].n)}</b>`
    : `<b>${esc(CP[r.a].n)}</b> with <b>${chem(RG[r.b].f)}</b> <span>(${chem(RG[r.b].n)})</span>`;
</script>

<div class="stage-head">
  <div class="label-chip">{circle.cfg.title}<small>{circle.cfg.sub}</small></div>
  <div class="stage-tools">
    <Seg label="Formula style" cls="fmtseg" options={FMTS} bind:value={app.prefs.fmt} />
    <button class="btn" type="button" disabled={circle.busy} onclick={() => circle.clear()}>Clear</button>
  </div>
</div>
<div class="vessel" class:charging={circle.charging} class:has-res={circle.showing} style:--fc={circle.fc} bind:this={vessel}>
  {@html SIGIL}
  <div class="vflash" bind:this={flash}></div>
  <canvas class="fx" bind:this={fx}></canvas>
  <div class="vtoast" class:on={!!circle.toast} role="status">{#if circle.toast}<b>{circle.toast.title}</b>{@html circle.toast.html}{/if}</div>
  <div class="slots" class:fuse={circle.fuse} class:fizz={circle.fizz} hidden={circle.showing}>
    {#each [0, 1] as i}
      {@const item = circle.slots[i]}
      <div class="slot" class:filled={!!item} data-slot={i} bind:this={slotEls[i]}>
        {#if !item}
          <div class="ph2"><b>{i ? 'Reagent' : 'Compound'}</b>{i ? 'Drop a reagent here — or a second compound to combine' : 'Drag a compound here, or tap one'}</div>
        {:else}
          {@const [k, id] = item.split(':')}
          <button class="x" type="button" aria-label="Remove" onclick={(e) => { e.stopPropagation(); circle.remove(i); }}>×</button>
          {#if k === 'c'}
            <div class="mv"><Mol {id} /></div><div class="sn">{CP[id].n}</div><div class="sk">{CLASSN[CP[id].cls]}</div>
          {:else}
            <div class="rbig">{@html chem(RG[id].f)}</div><div class="sn" style="font-weight:500;font-size:13px">{@html chem(RG[id].n)}</div><div class="sk">Reagent</div>
          {/if}
        {/if}
      </div>
      {#if i === 0}<div class="plus" aria-hidden="true">+</div>{/if}
    {/each}
  </div>
  {#if circle.result}
    {@const { r, extra, anim } = circle.result}
    <div class="result" class:in={anim} style:--hc={FAM[r.fam][1]}>
      {#if extra.win}
        <div class="win" style="padding:0 0 4px">
          <div class="stars">{#each [0, 1, 2] as s}<span class:off={s >= extra.win.stars}>★</span>{/each}</div>
          <h3><i>Target</i> made!</h3><p>{extra.win.msg}</p>
        </div>
      {/if}
      {#if extra.isNew}<span class="r-new">New discovery</span>{/if}
      <p class="r-from">{@html from(r)}</p>
      <div class="r-mols">{#each r.p as p, k (p)}{#if k}<span class="pl">+</span>{/if}<div class="rm"><Mol id={p} hl scale={1.55} /></div>{/each}</div>
      <h3 class="r-name">{r.p.map((p) => CP[p].n).join(' + ')}<small>{r.p.map((p) => CLASSN[CP[p].cls]).join(' + ')}</small></h3>
      <div class="r-tags"><span class="badge solid f-{r.fam}">{FAM[r.fam][0]}</span><span class="chip">{r.mech}</span><span class="chip u">{UNIT[r.unit]}</span><CopyButton text={() => rxPlain(r)} label="Copy reaction as text" /></div>
      <div class="eqs">{#each r.eq as e}<div class="eq">{@html chem(e)}</div>{/each}</div>
      <p class="r-cond"><b>Conditions</b>{@html chem(r.cond)}</p>
      {#if r.note}<p class="why">{r.note}</p>{/if}
      <div class="r-act">
        {#if extra.win}<button class="btn primary" type="button" onclick={() => circle.cfg.onNext?.()}>Next target</button>
        {:else}<button class="btn primary" type="button" onclick={() => circle.further()}>React {CP[r.p[0]].n} further</button>{/if}
        <button class="btn" type="button" onclick={() => circle.clear()}>New reaction</button>
      </div>
    </div>
  {/if}
  <div class="vcap" style:opacity={circle.slots[0] || circle.slots[1] ? 0 : 1}><span class="cap-d">{circle.cfg.cap}</span><span class="cap-m">Open Compounds or Reagents below · tap to add, hold to drag</span></div>
</div>
{#if !app.docked}<ReagentRack />{/if}
