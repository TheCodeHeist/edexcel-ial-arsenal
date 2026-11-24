<script lang="ts" module>
  export interface ImfPrefs {
    kind: ImfKind;
    electrons: number;
    trend: 'hydrides' | 'alkanes';
  }
  export const IMF_PREFS: ImfPrefs = {
    kind: 'hbond', electrons: 2, trend: 'hydrides',
  };
</script>

<script lang="ts">
  /* Intermolecular Forces: 3D London dispersion, permanent dipole–dipole & hydrogen bonding + boiling-point trend graphs (3.25–3.29). */
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { ImfLook } from './imf3d';
  import { IMF_INFO, HYDRIDES, ALKANE_ISOMERS, type ImfKind } from './imf';
  import { RM } from '../../lib/util';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: ImfPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });
  let playing = $state(!RM);

  const info = $derived(IMF_INFO[prefs.kind]);
  const look = $derived<ImfLook>({ kind: prefs.kind, electrons: prefs.electrons, playing });

  $effect(() => {
    stats = [
      ['Force', prefs.kind === 'london' ? 'London' : prefs.kind === 'dipole' ? 'Dipole–dipole' : 'H-bonding'],
      ['Strength', prefs.kind === 'london' ? 'Weakest' : prefs.kind === 'dipole' ? 'Moderate' : 'Strongest'],
    ];
  });

  // Hydrides SVG helpers (viewBox 0 0 560 250)
  const X0 = 54, X1 = 530, Y0 = 216, Y1 = 36;
  const xP = (p: number) => X0 + ((p - 2) / 3) * (X1 - X0);
  const yBp = (bp: number) => Y0 - ((bp + 180) / 300) * (Y0 - Y1);
</script>

<main class="layout ab-imf" hidden={off}>
  <section class="panel stage" aria-label="3D intermolecular force">
    <div class="stage-head">
      <div class="label-chip">
        <small>Intermolecular force</small>
        <span>{info.name}</span>
      </div>
      <div class="stage-tools">
        <Seg label="Force type" options={[['london', 'London', 'London'], ['dipole', 'Dipole–dipole', 'Dipole'], ['hbond', 'Hydrogen bond', 'H-bond']]} bind:value={prefs.kind} />
      </div>
    </div>

    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./imf3d').then((m) => m.ImfScene)} {look} label="3D intermolecular interaction. Drag to rotate.">
          <div class="hud tl">
            <b>{info.name}</b>
            <span>{info.strength}</span>
          </div>
          <div class="hud tr">
            <span>{info.occursIn}</span>
          </div>
          <div class="hud bl">Dashed line shows the intermolecular attraction — weaker than covalent bonds inside the molecule</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>

    <div class="playbar">
      <button type="button" class="btn primary playbtn" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      {#if prefs.kind === 'london'}
        <label class="ctl scrub">
          <span class="ctl-l">Electron cloud size (Mr) <b>{prefs.electrons === 1 ? 'Small (F₂ / CH₄)' : prefs.electrons === 2 ? 'Medium (Cl₂)' : 'Large (I₂)'}</b></span>
          <input class="slider" type="range" min="1" max="3" step="1" bind:value={prefs.electrons} />
        </label>
      {/if}
    </div>

    <div class="ab-trend">
      <div class="ph">
        <h2>Boiling-point trends</h2>
        <Seg label="Dataset" options={[['hydrides', 'Hydrides (Groups 4–7)', 'Hydrides'], ['alkanes', 'Alkane branching', 'Branching']]} bind:value={prefs.trend} />
      </div>

      {#if prefs.trend === 'hydrides'}
        <div class="plotbox">
          <svg viewBox="0 0 560 250" class="ab-svg" role="img" aria-label="Boiling points of Group 4, 5, 6 and 7 hydrides">
            {#each [-150, -100, -50, 0, 50, 100] as t (t)}
              <line class="grid" x1={X0} x2={X1} y1={yBp(t)} y2={yBp(t)} />
              <text class="axlbl" x={X0 - 8} y={yBp(t) + 4} text-anchor="end">{t}</text>
            {/each}
            <line class="ax" x1={X0} x2={X1} y1={Y0} y2={Y0} />
            <line class="ax" x1={X0} x2={X0} y1={Y1} y2={Y0} />
            <text class="axlbl" x="10" y="14">Boiling point / °C</text>
            {#each [2, 3, 4, 5] as p (p)}
              <text class="axlbl" x={xP(p)} y="236" text-anchor="middle">Period {p}</text>
            {/each}

            {#each HYDRIDES as s (s.group)}
              {@const d = s.points.map((pt, i) => `${i ? 'L' : 'M'}${xP(pt.period).toFixed(1)} ${yBp(pt.bp).toFixed(1)}`).join(' ')}
              <path d={d} fill="none" stroke={s.colorVar} stroke-width="2.5" stroke-linejoin="round" />
              {#each s.points as pt (pt.formula)}
                <circle cx={xP(pt.period)} cy={yBp(pt.bp)} r="4.5" fill={s.colorVar} />
                <text class="sym" x={xP(pt.period) + (pt.period === 2 ? 8 : 0)} y={yBp(pt.bp) - 7}
                  text-anchor={pt.period === 2 ? 'start' : 'middle'}>{pt.formula}</text>
              {/each}
            {/each}
          </svg>
        </div>
      {:else}
        <div class="ab-bars">
          {#each ALKANE_ISOMERS as a (a.name)}
            <div class="ab-bar-row">
              <div class="ab-bar-head"><b>{a.name}</b><span>{a.formula} · <b>{a.bp} °C</b></span></div>
              <div class="ab-track"><div class="ab-fill" style="width:{(a.bp / 40) * 100}%"></div></div>
              <p class="note">{a.note}</p>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Explanation">
      <div class="ph"><h2>{info.name}</h2></div>
      <dl class="reads pad">
        <div class="wide"><dt>Strength</dt><dd class="txt">{info.strength}</dd></div>
        <div class="wide"><dt>Occurs in</dt><dd class="txt">{info.occursIn}</dd></div>
      </dl>
      <p class="note pad">{info.summary}</p>
      <div class="facts pad">
        <b>Key facts</b>
        <ul>
          {#each info.facts as f, i (i)}<li>{f}</li>{/each}
        </ul>
      </div>
    </section>
  </aside>
</main>
