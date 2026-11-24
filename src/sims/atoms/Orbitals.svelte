<script lang="ts" module>
  export interface OrbitalsPrefs {
    z: number;
    charge: number;
    orbital: OrbitalKind;
    shorthand: boolean;
    showAxes: boolean;
  }
  export const ORBITALS: OrbitalsPrefs = {
    z: 24, charge: 0, orbital: '2px', shorthand: false, showAxes: true,
  };
</script>

<script lang="ts">
  /* Orbitals & Electron Configuration: 3D probability density clouds, Hund's rule boxes, Cr/Cu exceptions & ions (2.9–2.14). */
  import View3D from './View3D.svelte';
  import CopyButton from '../../components/ui/CopyButton.svelte';
  import type { OrbitalLook } from './orbitals3d';
  import { ELEMENTS, SUBSHELLS, ORBITAL_DEFS, fillConfig, formatConfig, boxStates, type OrbitalKind } from './orbitals';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: OrbitalsPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });

  const el = $derived(ELEMENTS.find((e) => e.z === prefs.z) ?? ELEMENTS[0]);
  const occ = $derived(fillConfig(el.z, prefs.charge));
  const fullStr = $derived(formatConfig(occ, false));
  const shortStr = $derived(formatConfig(occ, true));
  const shownStr = $derived(prefs.shorthand ? shortStr : fullStr);
  const eTotal = $derived(Object.values(occ).reduce((a, b) => a + b, 0));
  const orbDef = $derived(ORBITAL_DEFS.find((o) => o.id === prefs.orbital) ?? ORBITAL_DEFS[0]);

  const ionLabel = $derived(
    prefs.charge === 0 ? el.sym :
    prefs.charge === 1 ? `${el.sym}⁺` :
    prefs.charge === -1 ? `${el.sym}⁻` :
    prefs.charge > 0 ? `${el.sym}${prefs.charge}⁺` : `${el.sym}${-prefs.charge}⁻`
  );

  const look = $derived<OrbitalLook>({ orbital: prefs.orbital, showAxes: prefs.showAxes });

  $effect(() => {
    stats = [
      ['Species', ionLabel],
      ['Electrons', eTotal],
      ['Block', `${el.block}-block`],
    ];
  });
</script>

<main class="layout ab-orbitals" hidden={off}>
  <section class="panel stage" aria-label="3D orbital shape">
    <div class="stage-head">
      <div class="label-chip">
        <small>Quantum orbital</small>
        <span>{orbDef.name} · {orbDef.shape} {#if orbDef.beyond}<span class="beyond">beyond</span>{/if}</span>
      </div>
      <div class="stage-tools">
        <button type="button" class="chip" class:on={prefs.showAxes} onclick={() => (prefs.showAxes = !prefs.showAxes)}>Axes</button>
      </div>
    </div>

    <div class="picker" role="group" aria-label="Choose an orbital">
      {#each ORBITAL_DEFS as o (o.id)}
        <button type="button" class="chip" class:on={prefs.orbital === o.id} onclick={() => (prefs.orbital = o.id)}>
          {o.id.replace('x2y2', 'x²-y²').replace('z2', 'z²')}
        </button>
      {/each}
    </div>

    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./orbitals3d').then((m) => m.OrbitalsScene)} {look} label="3D orbital probability cloud. Drag to rotate.">
          <div class="hud tl">
            <b>{orbDef.name}</b>
            <span>{orbDef.shape} · max {orbDef.capacity} e⁻</span>
          </div>
          <div class="hud tr">
            <span>Blue / pink = opposite wave phases</span>
          </div>
          <div class="hud bl">Each dot is a sampled electron position from |ψ|² · yellow dot is the nucleus</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>

    <p class="note pad">{orbDef.note}</p>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Element and ion selector">
      <div class="ph"><h2>Element &amp; ion (Z = 1–36)</h2></div>
      <div class="ctls">
        <label class="ctl">
          <span class="ctl-l">Atomic number Z <b>{el.z} · {el.name} ({el.sym})</b></span>
          <input class="slider" type="range" min="1" max="36" step="1" bind:value={prefs.z} />
        </label>

        <div class="ab-quick">
          <span class="ab-lbl">Quick picks:</span>
          {#each [6, 7, 8, 24, 26, 29, 30] as qz (qz)}
            {@const qe = ELEMENTS[qz - 1]}
            <button type="button" class="chip" class:on={prefs.z === qz} onclick={() => (prefs.z = qz)}>
              {qe.sym}{qz === 24 || qz === 29 ? ' ★' : ''}
            </button>
          {/each}
        </div>

        <div class="ab-quick">
          <span class="ab-lbl">Charge:</span>
          {#each [-2, -1, 0, 1, 2, 3] as q (q)}
            <button type="button" class="chip" class:on={prefs.charge === q} onclick={() => (prefs.charge = q)}>
              {q === 0 ? 'Atom (0)' : q > 0 ? `+${q}` : `${q}`}
            </button>
          {/each}
        </div>
      </div>
    </section>

    <section class="panel" aria-label="Electron configuration">
      <div class="ph">
        <h2>{ionLabel} configuration</h2>
        <div class="ab-headtools">
          <button type="button" class="chip" class:on={prefs.shorthand} onclick={() => (prefs.shorthand = !prefs.shorthand)}>Noble gas</button>
          <CopyButton text={`${ionLabel}: ${shownStr}`} />
        </div>
      </div>

      <div class="ab-cfg">{shownStr}</div>

      {#if el.exception && prefs.charge === 0}
        <div class="ab-alert">{el.exception}</div>
      {/if}
      {#if prefs.z >= 21 && prefs.z <= 30 && prefs.charge > 0}
        <div class="ab-alert">Transition-metal ion rule: <b>4s fills before 3d, and 4s empties before 3d</b> when forming positive ions.</div>
      {/if}

      <div class="ab-boxes" aria-label="Electrons-in-boxes diagram">
        {#each SUBSHELLS as s (s.id)}
          {@const count = occ[s.id]}
          {#if count > 0 || s.id === '4s' && prefs.z >= 19}
            <div class="ab-sub">
              <span class="ab-sname">{s.id}</span>
              <div class="ab-row">
                {#each boxStates(s.boxes, count) as st, i (i)}
                  <span class="ab-box" class:filled={st > 0} aria-label="{s.id} orbital {i + 1}: {st} electrons">
                    {st === 2 ? '↑↓' : st === 1 ? '↑' : ''}
                  </span>
                {/each}
              </div>
            </div>
          {/if}
        {/each}
      </div>

      <div class="facts pad">
        <b>Key facts</b>
        <ul>
          <li>Each orbital holds at most 2 electrons with opposite spins (Pauli exclusion principle).</li>
          <li>Degenerate orbitals (e.g. 2pₓ, 2pᵧ, 2p_z) fill singly with parallel spins before pairing (Hund's rule).</li>
          <li>Watch out for Cr ([Ar] 3d⁵ 4s¹), Cu ([Ar] 3d¹⁰ 4s¹) and removing 4s electrons first in d-block ions.</li>
        </ul>
      </div>
    </section>
  </aside>
</main>
