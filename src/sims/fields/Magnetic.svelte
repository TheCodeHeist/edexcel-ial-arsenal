<script lang="ts" module>
  export interface MagPrefs {
    mode: MagMode;
    B: number;
    I: number;
    L: number;
    angle: number;
    revI: boolean;
    revB: boolean;
  }
  export const MAG_PREFS: MagPrefs = {
    mode: 'motor', B: 0.5, I: 4.0, L: 0.4, angle: 90, revI: false, revB: false,
  };
</script>

<script lang="ts">
  /* Magnetic Fields & Motor Effect: 3D F = BIL sin θ (Fleming's Left-Hand Rule), straight wire & solenoid (WPH14). */
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { MagLook } from './magnetic3d';
  import { motorForce, MAG_FACTS, type MagMode } from './magnetic';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: MagPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });

  const F = $derived(motorForce(prefs.B, prefs.I, prefs.L, prefs.angle));
  const fDirLabel = $derived(
    prefs.angle === 0 ? 'Zero (wire parallel to B)' :
    (prefs.revI !== prefs.revB ? 'Downward (−y)' : 'Upward (+y)')
  );

  const look = $derived<MagLook>({
    mode: prefs.mode, B: prefs.B, I: prefs.I, angle: prefs.angle, revI: prefs.revI, revB: prefs.revB,
  });

  $effect(() => {
    stats = prefs.mode === 'motor'
      ? [['Force F', `${F.toFixed(2)} N`], ['Angle θ', `${prefs.angle}°`], ['Direction', fDirLabel]]
      : [['Mode', prefs.mode === 'wire' ? 'Straight wire' : 'Solenoid'], ['Current', prefs.revI ? 'Reversed' : 'Forward']];
  });

  /* Kernel hooks */
  export function kReadouts() { return { F, fDirLabel }; }
</script>

<main class="layout fl-mag" hidden={off}>
  <section class="panel stage" aria-label="3D magnetic field">
    <div class="stage-head">
      <div class="label-chip">
        <small>Magnetic fields &amp; motor effect</small>
        <span>{prefs.mode === 'motor' ? 'F = BIL sin θ (Fleming’s Left-Hand Rule)' : prefs.mode === 'wire' ? 'Straight wire (right-hand grip)' : 'Solenoid field'}</span>
      </div>
      <div class="stage-tools">
        <Seg label="View" options={[['motor', 'F = BIL', 'Motor'], ['wire', 'Wire', 'Wire'], ['solenoid', 'Solenoid', 'Solenoid']]} bind:value={prefs.mode} />
      </div>
    </div>

    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./magnetic3d').then((m) => m.MagneticScene)} {look} label="3D magnetic field apparatus. Drag to rotate.">
          <div class="hud tl">
            <b>{prefs.mode === 'motor' ? `F = ${F.toFixed(2)} N` : prefs.mode === 'wire' ? 'Circular B-field rings' : 'Uniform internal B-field'}</b>
            <span>{prefs.mode === 'motor' ? fDirLabel : 'Blue arrows show B-field direction'}</span>
          </div>
          <div class="hud tr">
            <span>Blue = B (N → S)</span>
            <span>Amber = Current I · Green = Force F</span>
          </div>
          <div class="hud bl">Drag to rotate · reverse I or B below to verify Fleming’s Left-Hand Rule</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>

    <div class="playbar">
      <button type="button" class="chip" class:on={prefs.revI} onclick={() => (prefs.revI = !prefs.revI)}>Reverse current I</button>
      {#if prefs.mode === 'motor'}
        <button type="button" class="chip" class:on={prefs.revB} onclick={() => (prefs.revB = !prefs.revB)}>Swap N / S poles</button>
      {/if}
    </div>
  </section>

  <aside class="side">
    {#if prefs.mode === 'motor'}
      <section class="panel" aria-label="Motor controls">
        <div class="ph"><h2>Variables</h2></div>
        <div class="ctls">
          <label class="ctl">
            <span class="ctl-l">Flux density B <b>{prefs.B.toFixed(2)} T</b></span>
            <input class="slider" type="range" min="0.1" max="1.5" step="0.05" bind:value={prefs.B} />
          </label>
          <label class="ctl">
            <span class="ctl-l">Current I <b>{prefs.I.toFixed(1)} A</b></span>
            <input class="slider" type="range" min="0.5" max="10" step="0.5" bind:value={prefs.I} />
          </label>
          <label class="ctl">
            <span class="ctl-l">Wire length in field L <b>{prefs.L.toFixed(2)} m</b></span>
            <input class="slider" type="range" min="0.1" max="1.0" step="0.05" bind:value={prefs.L} />
          </label>
          <label class="ctl">
            <span class="ctl-l">Angle θ between I and B <b>{prefs.angle}°</b></span>
            <input class="slider" type="range" min="0" max="90" step="5" bind:value={prefs.angle} />
          </label>
        </div>
        <div class="work">
          <div class="eq">F = B I L sin θ = {prefs.B.toFixed(2)} × {prefs.I.toFixed(1)} × {prefs.L.toFixed(2)} × sin({prefs.angle}°) = {F.toFixed(2)} N</div>
        </div>
      </section>
    {/if}

    <section class="panel" aria-label="Key facts">
      <div class="ph"><h2>Key facts</h2></div>
      <div class="facts pad">
        <b>Exam points</b>
        <ul>
          {#each MAG_FACTS[prefs.mode] as f, i (i)}<li>{f}</li>{/each}
        </ul>
      </div>
    </section>
  </aside>
</main>
