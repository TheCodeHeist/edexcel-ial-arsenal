<script lang="ts" module>
  export interface BurettePrefs {
    indicator: 'phenol' | 'methyl';
  }
  export const BURETTE_PREFS: BurettePrefs = { indicator: 'phenol' };
</script>

<script lang="ts">
  /* 3D Burette Titration Bench: dropwise delivery, white tile colour spotting & concordant titres table (WCH13 / WCH14). */
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { BuretteLook } from './burette3d';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: BurettePrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });

  // Hidden true equivalence volume (cm³) for 25.0 cm³ of unknown HCl titrated with 0.100 mol dm⁻³ NaOH
  let targetVol = $state(23.4);
  let vol = $state(0);
  let dropSeq = $state(0);
  let swirlSeq = $state(0);
  let runs = $state<{ label: string; vol: number; rough: boolean }[]>([]);

  function add(dv: number) {
    vol = Math.min(40, Number((vol + dv).toFixed(2)));
    dropSeq++;
  }
  function swirl() { swirlSeq++; }
  function record() {
    if (vol <= 0) return;
    const isRough = runs.length === 0;
    runs = [...runs, { label: isRough ? 'Rough' : `Run ${runs.length}`, vol, rough: isRough }];
    vol = 0;
  }
  function newUnknown() {
    targetVol = Number((18.5 + Math.random() * 11.0).toFixed(1));
    vol = 0;
    runs = [];
  }

  // Flask colour based on proximity to targetVol
  const flaskHex = $derived((() => {
    const diff = vol - targetVol;
    if (prefs.indicator === 'phenol') {
      if (diff < -0.15) return 0xdbeafe;     // colourless
      if (diff <= 0.15) return 0xfbcfe8;     // faint permanent pale pink (end-point!)
      return 0xec4899;                       // overshot deep magenta!
    }
    // Methyl orange: red -> peach/orange -> yellow
    if (diff < -0.15) return 0xf87171;
    if (diff <= 0.15) return 0xfb923c;
    return 0xfde047;
  })());

  const flaskStatus = $derived((() => {
    const diff = vol - targetVol;
    if (diff < -0.15) return prefs.indicator === 'phenol' ? 'Colourless (before end-point)' : 'Red (acidic)';
    if (diff <= 0.15) return prefs.indicator === 'phenol' ? 'Faint permanent pink — END-POINT!' : 'Peach-orange — END-POINT!';
    return prefs.indicator === 'phenol' ? 'Deep magenta — OVERSHOT!' : 'Yellow — OVERSHOT!';
  })());

  // Concordant titres (non-rough runs within 0.20 cm³ of each other)
  const concordant = $derived((() => {
    const nonRough = runs.filter((r) => !r.rough);
    if (nonRough.length < 2) return [];
    // Find largest cluster within 0.20 cm³
    let best: number[] = [];
    for (const r of nonRough) {
      const grp = nonRough.filter((x) => Math.abs(x.vol - r.vol) <= 0.205).map((x) => x.vol);
      if (grp.length > best.length) best = grp;
    }
    return best.length >= 2 ? best : [];
  })());

  const meanTitre = $derived(concordant.length ? concordant.reduce((a, b) => a + b, 0) / concordant.length : null);
  const calcConc = $derived(meanTitre !== null ? (0.100 * meanTitre) / 25.0 : null);

  const look = $derived<BuretteLook>({ volAdded: vol, flaskHex, dropSeq, swirlSeq });

  $effect(() => {
    stats = [
      ['Burette', `${vol.toFixed(2)} cm³`],
      ['Mean titre', meanTitre !== null ? `${meanTitre.toFixed(2)} cm³` : '—'],
      ['Concordant', `${concordant.length}`],
    ];
  });
</script>

<main class="layout ac-bur" hidden={off}>
  <section class="panel stage" aria-label="3D burette titration bench">
    <div class="stage-head">
      <div class="label-chip">
        <small>Core Practicals 2 &amp; 11 · Burette bench</small>
        <span>25.0 cm³ unknown HCl + 0.100 mol dm⁻³ NaOH</span>
      </div>
      <div class="stage-tools">
        <Seg label="Indicator" options={[['phenol', 'Phenolphthalein', 'Phenol'], ['methyl', 'Methyl orange', 'Methyl']]} bind:value={prefs.indicator} />
      </div>
    </div>

    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./burette3d').then((m) => m.BuretteScene)} {look} label="3D burette and conical flask on white tile. Drag to rotate.">
          <div class="hud tl">
            <b>{vol.toFixed(2)} cm³ added</b>
            <span>{flaskStatus}</span>
          </div>
          <div class="hud tr">
            <span>Burette precision: ±0.05 cm³</span>
          </div>
          <div class="hud bl">Add rapidly for a rough titre, then add 0.10 cm³ dropwise near the end-point</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>

    <div class="playbar">
      <button type="button" class="btn" onclick={() => add(5)}>+5.0 cm³</button>
      <button type="button" class="btn" onclick={() => add(1)}>+1.0 cm³</button>
      <button type="button" class="btn primary" onclick={() => add(0.1)}>+0.10 cm³ (drop)</button>
      <button type="button" class="btn" onclick={swirl}>Swirl</button>
      <button type="button" class="btn" onclick={record} disabled={vol === 0}>Record titre</button>
      <button type="button" class="btn" onclick={() => (vol = 0)}>Refill</button>
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Titration results table">
      <div class="ph">
        <h2>Titres table</h2>
        <button type="button" class="chip" onclick={newUnknown}>New unknown</button>
      </div>

      {#if runs.length === 0}
        <p class="note pad">Run a rough titration first to find the approximate end-point, then record at least two concordant runs (within 0.20 cm³) by adding dropwise.</p>
      {:else}
        <div class="ac-tblwrap">
          <table class="ac-tbl">
            <thead><tr><th>Run</th><th>Titre / cm³</th><th>Status</th></tr></thead>
            <tbody>
              {#each runs as r, i (i)}
                <tr>
                  <td>{r.label}</td>
                  <td><b>{r.vol.toFixed(2)}</b></td>
                  <td>{r.rough ? 'Rough (exclude)' : Math.abs(r.vol - targetVol) <= 0.16 ? 'Sharp end-point' : r.vol > targetVol + 0.16 ? 'Overshot' : 'Under'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      <dl class="reads pad">
        <div><dt>Mean concordant</dt><dd>{meanTitre !== null ? `${meanTitre.toFixed(2)} cm³` : 'Need 2+'}</dd></div>
        <div><dt>Calculated [HCl]</dt><dd>{calcConc !== null ? `${calcConc.toFixed(4)} mol dm⁻³` : '—'}</dd></div>
      </dl>

      <div class="facts pad">
        <b>Core practical tips (WCH13)</b>
        <ul>
          <li>Read the burette at eye level from the <b>bottom of the meniscus</b> to the nearest 0.05 cm³ (ending in .00 or .05).</li>
          <li>Always rinse the burette with the titrant (NaOH), rinse the conical flask with distilled water only, and remove the funnel before titrating.</li>
          <li>Never include the rough titre in the mean — only average concordant titres within 0.10–0.20 cm³.</li>
        </ul>
      </div>
    </section>
  </aside>
</main>
