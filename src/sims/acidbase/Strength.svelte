<script lang="ts" module>
  export interface StrengthPrefs {
    id: string;
    conc: number;   // mol dm⁻³ (0.01..1.0)
    tempC: number;  // °C for pure water Kw (0..100)
  }
  export const STRENGTH_PREFS: StrengthPrefs = { id: 'ch3cooh', conc: 0.10, tempC: 25 };
</script>

<script lang="ts">
  /* Strong vs Weak Acids/Bases, Ka & Kw(T): 3D dissociation box + live pH calculation (Spec 14.1–14.8). */
  import View3D from './View3D.svelte';
  import type { StrengthLook } from './strength3d';
  import { SPECIES, calcStrength } from './strength';
  import { sci } from './consts';
  import { chem } from '../../lib/chem';
  import { isReducedMotion } from '../../lib/perf';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: StrengthPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });
  let playing = $state(!isReducedMotion());

  const sp = $derived(SPECIES.find((s) => s.id === prefs.id) ?? SPECIES[2]);
  const res = $derived(calcStrength(sp, prefs.conc, prefs.tempC));

  const look = $derived<StrengthLook>({
    key: `${sp.id}:${prefs.conc.toFixed(2)}`,
    alpha: res.alpha,
    isBase: sp.kind === 'strong_base',
    isWater: sp.kind === 'water',
    playing,
  });

  $effect(() => {
    stats = [
      ['pH', res.pH.toFixed(2)],
      ['[H⁺]', `${sci(res.hPlus, 3)} mol dm⁻³`],
      ['Dissociated', sp.kind === 'water' ? 'Neutral' : `${(res.alpha * 100).toFixed(res.alpha < 0.01 ? 3 : 1)}%`],
    ];
  });
</script>

<main class="layout ac-str" hidden={off}>
  <section class="panel stage" aria-label="3D aqueous dissociation box">
    <div class="stage-head">
      <div class="label-chip">
        <small>{sp.kind === 'strong_acid' ? 'Strong acid' : sp.kind === 'weak_acid' ? 'Weak acid' : sp.kind === 'strong_base' ? 'Strong base' : 'Pure water (Kw)'}</small>
        <span>{sp.name} ({@html chem(sp.formula)})</span>
      </div>
      <div class="stage-tools">
        <button type="button" class="btn" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      </div>
    </div>

    <div class="picker" role="group" aria-label="Choose an acid, base or water">
      {#each SPECIES as s (s.id)}
        <button type="button" class="chip" class:on={prefs.id === s.id} onclick={() => (prefs.id = s.id)}>{s.name}</button>
      {/each}
    </div>

    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./strength3d').then((m) => m.StrengthScene)} {look} label="3D aqueous dissociation box. Drag to rotate.">
          <div class="hud tl">
            <b>pH = {res.pH.toFixed(2)}</b>
            <span>[H⁺] = {sci(res.hPlus, 3)} mol dm⁻³ · {sp.kind === 'water' ? 'Neutral ([H⁺] = [OH⁻])' : `${(res.alpha * 100).toFixed(res.alpha < 0.01 ? 3 : 1)}% dissociated`}</span>
          </div>
          <div class="hud tr">
            <span>Grey+white = intact HA</span>
            <span>Red = H⁺ · Green = A⁻</span>
          </div>
          <div class="hud bl">Strong acids split 100% into ions; weak acids stay mostly as intact molecules</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>

    <div class="playbar">
      {#if sp.kind === 'water'}
        <label class="ctl scrub">
          <span class="ctl-l">Temperature <b>{prefs.tempC} °C ({prefs.tempC + 273} K)</b></span>
          <input class="slider" type="range" min="0" max="100" step="5" bind:value={prefs.tempC} />
        </label>
      {:else}
        <label class="ctl scrub">
          <span class="ctl-l">Concentration c <b>{prefs.conc.toFixed(2)} mol dm⁻³</b></span>
          <input class="slider" type="range" min="0.01" max="1.0" step="0.01" bind:value={prefs.conc} />
        </label>
        <button type="button" class="chip" onclick={() => (prefs.conc = Math.max(0.01, Number((prefs.conc / 10).toFixed(2))))}>Dilute ×10</button>
      {/if}
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="pH working and key facts">
      <div class="ph"><h2>pH calculation</h2></div>
      <div class="ac-eq">{@html chem(sp.eq)}</div>
      <dl class="reads pad">
        <div><dt>pH</dt><dd>{res.pH.toFixed(2)}</dd></div>
        <div><dt>[H⁺]</dt><dd>{sci(res.hPlus, 3)} mol dm⁻³</dd></div>
        <div><dt>[OH⁻]</dt><dd>{sci(res.ohMinus, 3)} mol dm⁻³</dd></div>
        {#if sp.ka && res.pKa !== null}
          <div><dt>Ka / pKa</dt><dd>{sci(sp.ka, 3)} / {res.pKa.toFixed(2)}</dd></div>
        {:else}
          <div><dt>Kw</dt><dd>{sci(res.kw, 3)} mol² dm⁻⁶</dd></div>
        {/if}
      </dl>

      <div class="work">
        {#if sp.kind === 'weak_acid' && sp.ka}
          <div class="eq">[H⁺] = √(Ka × c) = √({sci(sp.ka, 3)} × {prefs.conc.toFixed(2)}) = {sci(res.hPlus, 3)}</div>
          <div class="eq">pH = −log₁₀[H⁺] = {res.pH.toFixed(2)}  (exact quadratic: {res.exactPH.toFixed(2)})</div>
        {:else if sp.kind === 'strong_base'}
          <div class="eq">[H⁺] = Kw / [OH⁻] = 1.00 × 10⁻¹⁴ / {prefs.conc.toFixed(2)} = {sci(res.hPlus, 3)}</div>
          <div class="eq">pH = −log₁₀[H⁺] = {res.pH.toFixed(2)}</div>
        {:else if sp.kind === 'water'}
          <div class="eq">[H⁺] = √Kw = √({sci(res.kw, 3)}) = {sci(res.hPlus, 3)} mol dm⁻³</div>
          <div class="eq">pH = −log₁₀[H⁺] = {res.pH.toFixed(2)}  (still NEUTRAL!)</div>
        {:else}
          <div class="eq">[H⁺] = {sp.proticity === 2 ? '2 × ' : ''}{prefs.conc.toFixed(2)} = {res.hPlus.toFixed(2)} mol dm⁻³</div>
          <div class="eq">pH = −log₁₀({res.hPlus.toFixed(2)}) = {res.pH.toFixed(2)}</div>
        {/if}
      </div>

      <p class="note pad">{sp.note}</p>
      <div class="facts pad">
        <b>Key facts</b>
        <ul>
          {#each sp.facts as f, i (i)}<li>{f}</li>{/each}
        </ul>
      </div>
    </section>
  </aside>
</main>
