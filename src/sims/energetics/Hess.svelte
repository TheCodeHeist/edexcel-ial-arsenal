<script lang="ts" module>
  export interface HessPrefs {
    cycle: string;
    route: 'direct' | 'indirect';
    custom: boolean;
    dh1: number;
    dh2: number;
  }
  export const HESS_PREFS: HessPrefs = {
    cycle: 'form_caco3', route: 'indirect', custom: false, dh1: -1207, dh2: -1029,
  };
</script>

<script lang="ts">
  /* Hess's Law: Formation, combustion & Core Practical 2 indirect cycles with route highlighter (Spec 6.8–6.9). */
  import Seg from '../../components/ui/Seg.svelte';
  import { HESS_CYCLES, calcHess } from './hess';
  import { signed } from './consts';
  import { chem } from '../../lib/chem';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: HessPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  const cyc = $derived(HESS_CYCLES.find((c) => c.id === prefs.cycle) ?? HESS_CYCLES[0]);
  const dh1 = $derived(prefs.custom ? prefs.dh1 : cyc.dh1);
  const dh2 = $derived(prefs.custom ? prefs.dh2 : cyc.dh2);
  const dhr = $derived(calcHess(cyc.arrowDir, dh1, dh2));

  function pickCycle(id: string) {
    const c = HESS_CYCLES.find((x) => x.id === id);
    if (!c) return;
    prefs.cycle = id;
    prefs.dh1 = c.dh1;
    prefs.dh2 = c.dh2;
  }

  $effect(() => {
    stats = [
      ['Cycle', cyc.kind === 'formation' ? 'ΔfH (up)' : cyc.kind === 'combustion' ? 'ΔcH (down)' : 'CP 2 (down)'],
      ['ΔrH', `${signed(dhr, 1)} kJ mol⁻¹`],
    ];
  });
</script>

<main class="layout en-hess" hidden={off}>
  <section class="panel stage" aria-label="Hess cycle diagram">
    <div class="stage-head">
      <div class="label-chip">
        <small>Hess’s law triangle</small>
        <span>{cyc.name}</span>
      </div>
      <div class="stage-tools">
        <Seg label="Route highlight" options={[['direct', 'Direct route', 'Direct'], ['indirect', 'Indirect route', 'Indirect']]} bind:value={prefs.route} />
      </div>
    </div>

    <div class="picker" role="group" aria-label="Choose a Hess cycle">
      {#each HESS_CYCLES as c (c.id)}
        <button type="button" class="chip" class:on={prefs.cycle === c.id} onclick={() => pickCycle(c.id)}>{c.name}</button>
      {/each}
    </div>

    <div class="plotbox">
      <svg viewBox="0 0 620 330" class="en-svg en-hsvg" role="img" aria-label="Hess cycle triangle">
        <defs>
          <marker id="arr-acc" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 1 L9 5 L0 9 Z" fill="var(--accent)" />
          </marker>
          <marker id="arr-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 1 L9 5 L0 9 Z" fill="var(--redox)" />
          </marker>
          <marker id="arr-mut" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 1 L9 5 L0 9 Z" fill="var(--muted)" />
          </marker>
        </defs>

        <!-- Reactants box (top left) -->
        <rect x="24" y="34" width="224" height="58" rx="12" class="hbox" />
        <text x="136" y="54" text-anchor="middle" class="htag">REACTANTS</text>
        <text x="136" y="76" text-anchor="middle" class="hval">{cyc.reactants}</text>

        <!-- Products box (top right) -->
        <rect x="372" y="34" width="224" height="58" rx="12" class="hbox" />
        <text x="484" y="54" text-anchor="middle" class="htag">PRODUCTS</text>
        <text x="484" y="76" text-anchor="middle" class="hval">{cyc.products}</text>

        <!-- Intermediate / Elements / Oxides box (bottom center) -->
        <rect x="160" y="246" width="300" height="60" rx="12" class="hbox" />
        <text x="310" y="266" text-anchor="middle" class="htag">
          {cyc.arrowDir === 'up' ? 'ELEMENTS IN STANDARD STATES' : 'COMMON PRODUCTS / SOLUTION'}
        </text>
        <text x="310" y="288" text-anchor="middle" class="hval">{cyc.bottom}</text>

        <!-- Direct top arrow: Reactants -> Products -->
        <line x1="256" y1="63" x2="362" y2="63"
          stroke={prefs.route === 'direct' ? 'var(--accent)' : 'var(--muted)'}
          stroke-width={prefs.route === 'direct' ? 3.4 : 2.2}
          marker-end={prefs.route === 'direct' ? 'url(#arr-acc)' : 'url(#arr-mut)'} />
        <text x="310" y="48" text-anchor="middle" class="hmath" fill={prefs.route === 'direct' ? 'var(--accent)' : 'var(--ink)'}>
          ΔrH = {signed(dhr, 1)}
        </text>

        <!-- Left leg (between Reactants and Bottom) -->
        {#if cyc.arrowDir === 'up'}
          <line x1="240" y1="240" x2="146" y2="100"
            stroke={prefs.route === 'indirect' ? 'var(--redox)' : 'var(--muted)'}
            stroke-width={prefs.route === 'indirect' ? 3.2 : 2.2}
            marker-end={prefs.route === 'indirect' ? 'url(#arr-red)' : 'url(#arr-mut)'} />
        {:else}
          <line x1="146" y1="100" x2="240" y2="240"
            stroke={prefs.route === 'indirect' ? 'var(--accent)' : 'var(--muted)'}
            stroke-width={prefs.route === 'indirect' ? 3.2 : 2.2}
            marker-end={prefs.route === 'indirect' ? 'url(#arr-acc)' : 'url(#arr-mut)'} />
        {/if}
        {#if cyc.arrowReagent}
          <text x="168" y="156" text-anchor="end" class="hsub" fill="var(--accent)">{cyc.arrowReagent}</text>
        {/if}
        <text x="168" y="176" text-anchor="end" class="hmath">{cyc.dh1Label}</text>
        <text x="168" y="194" text-anchor="end" class="hsub">{signed(dh1, 1)} kJ mol⁻¹ {prefs.route === 'indirect' && cyc.arrowDir === 'up' ? '(reversed!)' : ''}</text>

        <!-- Right leg (between Products and Bottom) -->
        {#if cyc.arrowDir === 'up'}
          <line x1="380" y1="240" x2="474" y2="100"
            stroke={prefs.route === 'indirect' ? 'var(--accent)' : 'var(--muted)'}
            stroke-width={prefs.route === 'indirect' ? 3.2 : 2.2}
            marker-end={prefs.route === 'indirect' ? 'url(#arr-acc)' : 'url(#arr-mut)'} />
        {:else}
          <line x1="474" y1="100" x2="380" y2="240"
            stroke={prefs.route === 'indirect' ? 'var(--redox)' : 'var(--muted)'}
            stroke-width={prefs.route === 'indirect' ? 3.2 : 2.2}
            marker-end={prefs.route === 'indirect' ? 'url(#arr-red)' : 'url(#arr-mut)'} />
        {/if}
        {#if cyc.arrowReagent}
          <text x="452" y="156" text-anchor="start" class="hsub" fill="var(--accent)">{cyc.arrowReagent}</text>
        {/if}
        <text x="452" y="176" text-anchor="start" class="hmath">{cyc.dh2Label}</text>
        <text x="452" y="194" text-anchor="start" class="hsub">{signed(dh2, 1)} kJ mol⁻¹ {prefs.route === 'indirect' && cyc.arrowDir === 'down' ? '(reversed!)' : ''}</text>
      </svg>
    </div>

    <div class="playbar">
      <button type="button" class="chip" class:on={prefs.custom} onclick={() => (prefs.custom = !prefs.custom)}>
        {prefs.custom ? 'Custom values: ON' : 'Edit ΔH₁ / ΔH₂'}
      </button>
    </div>
  </section>

  <aside class="side">
    {#if prefs.custom}
      <section class="panel" aria-label="Custom leg values">
        <div class="ph"><h2>Edit cycle values</h2></div>
        <div class="ctls">
          <label class="ctl">
            <span class="ctl-l">Left leg ΔH₁ <b>{signed(prefs.dh1, 0)} kJ mol⁻¹</b></span>
            <input class="slider" type="range" min="-2000" max="500" step="10" bind:value={prefs.dh1} />
          </label>
          <label class="ctl">
            <span class="ctl-l">Right leg ΔH₂ <b>{signed(prefs.dh2, 0)} kJ mol⁻¹</b></span>
            <input class="slider" type="range" min="-2000" max="500" step="10" bind:value={prefs.dh2} />
          </label>
        </div>
      </section>
    {/if}

    <section class="panel" aria-label="Hess working">
      <div class="ph"><h2>Step-by-step working</h2></div>
      <div class="en-eq">{@html chem(cyc.reactants)} → {@html chem(cyc.products)}</div>
      <dl class="reads pad">
        <div><dt>Arrow direction</dt><dd class="txt">{cyc.arrowDir === 'up' ? 'Up (formation)' : 'Down (combustion / HCl)'}</dd></div>
        <div><dt>Calculated ΔrH</dt><dd>{signed(dhr, 1)} kJ mol⁻¹</dd></div>
      </dl>
      <div class="work">
        <div class="eq">{cyc.formulaText}</div>
        <div class="eq">
          {#if cyc.arrowDir === 'up'}
            ΔrH = −({signed(dh1, 1)}) + ({signed(dh2, 1)}) = {signed(dhr, 1)} kJ mol⁻¹
          {:else}
            ΔrH = ({signed(dh1, 1)}) − ({signed(dh2, 1)}) = {signed(dhr, 1)} kJ mol⁻¹
          {/if}
        </div>
      </div>
      <p class="note pad">{cyc.note}</p>
      <div class="facts pad">
        <b>Key facts</b>
        <ul>
          {#each cyc.facts as f, i (i)}<li>{f}</li>{/each}
        </ul>
      </div>
    </section>
  </aside>
</main>
