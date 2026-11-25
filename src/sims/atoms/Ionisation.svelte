<script lang="ts" module>
  export interface IePrefs {
    mode: 'first' | 'succ';
    selectedZ: number;
    showRadius: boolean;
    succSym: string;
    mystery: boolean;
  }
  export const IE_PREFS: IePrefs = {
    mode: 'first', selectedZ: 8, showRadius: false, succSym: 'Al', mystery: false,
  };
</script>

<script lang="ts">
  /* Ionisation Energy: 1st IE trends across Periods 1–3 (Be→B & N→O dips) and successive IE log plots (2.6–2.8, 2.15–2.18). */
  import Seg from '../../components/ui/Seg.svelte';
  import { FIRST_IE, SUCCESSIVE_IE, firstJump } from './ie';
  import { sup } from './orbitals';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: IePrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  const cur = $derived(FIRST_IE.find((e) => e.z === prefs.selectedZ) ?? FIRST_IE[7]);
  const succ = $derived(SUCCESSIVE_IE.find((s) => s.sym === prefs.succSym) ?? SUCCESSIVE_IE[2]);
  const jump = $derived(firstJump(succ.values));

  let guess = $state<number | null>(null);
  let mysteryIdx = $state(2);
  const activeSucc = $derived(prefs.mystery ? SUCCESSIVE_IE[mysteryIdx] : succ);
  const activeJump = $derived(firstJump(activeSucc.values));

  function newMystery() {
    mysteryIdx = (mysteryIdx + 1 + Math.floor(Math.random() * (SUCCESSIVE_IE.length - 1))) % SUCCESSIVE_IE.length;
    guess = null;
  }

  const hideMystery = $derived(prefs.mystery && guess === null);

  $effect(() => {
    if (prefs.mode === 'first') {
      stats = [['Element', `${cur.sym} (Z=${cur.z})`], ['1st IE', `${cur.ie1} kJ mol⁻¹`], ['Config', cur.config]];
    } else {
      stats = [
        ['Element', hideMystery ? 'Mystery' : activeSucc.sym],
        ['Big jump', hideMystery ? '?' : `IE${activeJump.after} → IE${activeJump.after + 1}`],
        ['Group', hideMystery ? '?' : `Group ${activeSucc.group}`],
      ];
    }
  });

  // First IE SVG coordinate helpers (viewBox 0 0 640 310)
  const X0 = 56, X1 = 584, Y0 = 264, Y1 = 38;
  const xZ = (z: number) => X0 + ((z - 1) / 19) * (X1 - X0);
  const yIE = (v: number) => Y0 - (v / 2500) * (Y0 - Y1);
  const yRad = (r: number) => Y0 - (r / 220) * (Y0 - Y1);

  const iePath = FIRST_IE.map((e, i) => `${i ? 'L' : 'M'}${xZ(e.z).toFixed(1)} ${yIE(e.ie1).toFixed(1)}`).join(' ');
  const radPath = (() => {
    let penUp = true;
    const segs: string[] = [];
    for (const e of FIRST_IE) {
      if (e.radiusPm == null) { penUp = true; continue; }
      segs.push(`${penUp ? 'M' : 'L'}${xZ(e.z).toFixed(1)} ${yRad(e.radiusPm).toFixed(1)}`);
      penUp = false;
    }
    return segs.join(' ');
  })();

  // Successive IE log10 plot helpers
  const logMin = 2.4, logMax = 5.4;
  const xN = (i: number, n: number) => X0 + ((i + 0.5) / n) * (X1 - X0);
  const yLog = (v: number) => Y0 - ((Math.log10(v) - logMin) / (logMax - logMin)) * (Y0 - Y1);
  const succPath = $derived(
    activeSucc.values.map((v, i) => `${i ? 'L' : 'M'}${xN(i, activeSucc.values.length).toFixed(1)} ${yLog(v).toFixed(1)}`).join(' ')
  );
  const jx1 = $derived(xN(activeJump.after - 1, activeSucc.values.length));
  const jx2 = $derived(xN(activeJump.after, activeSucc.values.length));
</script>

<main class="layout ab-ie" hidden={off}>
  <section class="panel stage" aria-label="Ionisation energy graph">
    <div class="stage-head">
      <div class="label-chip">
        <small>{prefs.mode === 'first' ? 'First ionisation energy' : 'Successive ionisation energies'}</small>
        <span>{prefs.mode === 'first' ? 'H (Z = 1) to Ca (Z = 20)' : prefs.mystery ? 'Deduce the group from the jump' : `${activeSucc.name} (${activeSucc.sym})`}</span>
      </div>
      <div class="stage-tools">
        <Seg label="View" options={[['first', 'Periodic trends', '1st IE'], ['succ', 'Successive IEs', 'Successive']]} bind:value={prefs.mode} />
      </div>
    </div>

    {#if prefs.mode === 'first'}
      <div class="plotbox">
        <svg viewBox="0 0 640 310" class="ab-svg" role="img" aria-label="First ionisation energy against atomic number">
          {#each [500, 1000, 1500, 2000, 2500] as tick (tick)}
            <line class="grid" x1={X0} x2={X1} y1={yIE(tick)} y2={yIE(tick)} />
            <text class="axlbl" x={X0 - 8} y={yIE(tick) + 4} text-anchor="end">{tick}</text>
          {/each}
          <line class="ax" x1={X0} x2={X1} y1={Y0} y2={Y0} />
          <line class="ax" x1={X0} x2={X0} y1={Y1} y2={Y0} />
          <text class="axlbl" x="14" y="16">1st IE / kJ mol⁻¹</text>
          <text class="axlbl" x={X1} y="298" text-anchor="end">Atomic number Z</text>

          {#if prefs.showRadius}
            <line class="ax" x1={X1} x2={X1} y1={Y1} y2={Y0} />
            {#each [0, 50, 100, 150, 200] as rTick (rTick)}
              <line class="radtick" x1={X1} x2={X1 + 4} y1={yRad(rTick)} y2={yRad(rTick)} />
              <text class="axlbl radlbl" x={X1 + 7} y={yRad(rTick) + 4}>{rTick}</text>
            {/each}
            <text class="axlbl radlbl" x="634" y="16" text-anchor="end">Covalent r / pm</text>
            <path class="radline" d={radPath} />
          {/if}
          <path class="ieline" d={iePath} />

          {#each FIRST_IE as e (e.z)}
            {@const cx = xZ(e.z)}
            {@const cy = yIE(e.ie1)}
            <g class="ptg" role="button" tabindex="0" aria-label="{e.name}: {e.ie1} kJ mol⁻¹"
              onclick={() => (prefs.selectedZ = e.z)}
              onkeydown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') prefs.selectedZ = e.z; }}>
              <circle cx={cx} cy={cy} r={prefs.selectedZ === e.z ? 7.5 : 5} class="pt" class:dip={!!e.dip} class:sel={prefs.selectedZ === e.z} />
              <text class="sym" x={cx} y={e.dip ? cy + 16 : cy - 10} text-anchor="middle">{e.sym}</text>
            </g>
          {/each}
        </svg>
      </div>

      <div class="playbar">
        <button type="button" class="chip" class:on={prefs.showRadius} onclick={() => (prefs.showRadius = !prefs.showRadius)}>Overlay covalent radius</button>
        <button type="button" class="chip" class:on={prefs.selectedZ === 5} onclick={() => (prefs.selectedZ = 5)}>Be → B dip</button>
        <button type="button" class="chip" class:on={prefs.selectedZ === 8} onclick={() => (prefs.selectedZ = 8)}>N → O dip</button>
        <button type="button" class="chip" class:on={prefs.selectedZ === 13} onclick={() => (prefs.selectedZ = 13)}>Mg → Al dip</button>
        <button type="button" class="chip" class:on={prefs.selectedZ === 16} onclick={() => (prefs.selectedZ = 16)}>P → S dip</button>
      </div>
    {:else}
      <div class="picker" role="group" aria-label="Choose an element for successive IEs">
        <button type="button" class="chip" class:on={prefs.mystery} onclick={() => { prefs.mystery = !prefs.mystery; guess = null; }}>
          {prefs.mystery ? 'Mystery mode: ON' : 'Mystery challenge'}
        </button>
        {#if !prefs.mystery}
          {#each SUCCESSIVE_IE as s (s.sym)}
            <button type="button" class="chip" class:on={prefs.succSym === s.sym} onclick={() => (prefs.succSym = s.sym)}>{s.sym}</button>
          {/each}
        {:else}
          <button type="button" class="btn" onclick={newMystery}>New mystery element</button>
        {/if}
      </div>

      <div class="plotbox">
        <svg viewBox="0 0 640 310" class="ab-svg" role="img" aria-label="Log10 successive ionisation energies">
          {#each [3, 4, 5] as p (p)}
            <line class="grid" x1={X0} x2={X1} y1={yLog(10 ** p)} y2={yLog(10 ** p)} />
            <text class="axlbl" x={X0 - 8} y={yLog(10 ** p) + 4} text-anchor="end">10{sup(p)}</text>
          {/each}
          <line class="ax" x1={X0} x2={X1} y1={Y0} y2={Y0} />
          <line class="ax" x1={X0} x2={X0} y1={Y1} y2={Y0} />
          <text class="axlbl" x="14" y="16">log₁₀(IE / kJ mol⁻¹)</text>
          <text class="axlbl" x={X1} y="298" text-anchor="end">Electron removed (n)</text>

          {#if !hideMystery}
            <!-- Highlight the big shell jump -->
            <rect class="jumpband" x={jx1} y={Y1} width={jx2 - jx1} height={Y0 - Y1} />
            <text class="jumplbl" x={(jx1 + jx2) / 2} y={Y1 + 14} text-anchor="middle">Big jump!</text>
          {/if}

          <path class="ieline" d={succPath} />
          {#each activeSucc.values as v, i (i)}
            {@const cx = xN(i, activeSucc.values.length)}
            {@const cy = yLog(v)}
            <circle cx={cx} cy={cy} r="5.5" class="pt" class:dip={!hideMystery && i === activeJump.after} />
            <text class="axlbl" x={cx} y={Y0 + 16} text-anchor="middle">{i + 1}</text>
          {/each}
        </svg>
      </div>

      {#if prefs.mystery}
        <div class="ab-mystery">
          <p class="note">Which group does this mystery element belong to?</p>
          <div class="picker">
            {#each [1, 2, 3, 4, 5, 6, 7] as g (g)}
              <button type="button" class="chip" class:right={guess !== null && g === activeSucc.group}
                class:wrong={guess === g && g !== activeSucc.group} onclick={() => (guess = g)}>Group {g}</button>
            {/each}
          </div>
          {#if guess !== null}
            <p class="note">
              <b>{guess === activeSucc.group ? 'Correct!' : `Not quite — it is Group ${activeSucc.group}.`}</b>
              The large jump occurs between IE<sub>{activeJump.after}</sub> and IE<sub>{activeJump.after + 1}</sub>, so there are {activeJump.after} outer-shell electrons ({activeSucc.name}, {activeSucc.sym}).
            </p>
          {/if}
        </div>
      {/if}
    {/if}
  </section>

  <aside class="side">
    <section class="panel" aria-label="Explanation">
      <div class="ph"><h2>{prefs.mode === 'first' ? `${cur.name} (${cur.sym})` : 'Reading successive IEs'}</h2></div>
      {#if prefs.mode === 'first'}
        <dl class="reads pad">
          <div><dt>1st IE</dt><dd>{cur.ie1} kJ mol⁻¹</dd></div>
          <div><dt>Covalent radius</dt><dd>{cur.radiusPm == null ? '— (noble gas)' : `${cur.radiusPm} pm`}</dd></div>
          <div><dt>Nuclear charge</dt><dd>+{cur.z}</dd></div>
          <div><dt>Configuration</dt><dd>{cur.config}</dd></div>
        </dl>
        <p class="note pad">{cur.note}</p>
        <div class="facts pad">
          <b>Key facts (always mention all 3 factors)</b>
          <ul>
            <li><b>Across a period:</b> nuclear charge increases, shielding is similar, atomic radius decreases → stronger attraction to outer electron → general rise in 1st IE.</li>
            <li><b>Down a group:</b> extra electron shells increase distance and shielding, outweighing higher nuclear charge → 1st IE decreases.</li>
            <li><b>Be → B (Mg → Al) dip:</b> outer electron enters a higher-energy p sub-shell.</li>
            <li><b>N → O (P → S) dip:</b> first spin-pair repulsion in a p orbital.</li>
          </ul>
        </div>
      {:else}
        <dl class="reads pad">
          <div><dt>First big jump</dt><dd>{hideMystery ? 'Find the jump' : `IE${activeJump.after} → IE${activeJump.after + 1}`}</dd></div>
          <div><dt>Jump factor</dt><dd>{hideMystery ? 'Hidden' : `×${activeJump.ratio.toFixed(1)}`}</dd></div>
          <div><dt>Outer electrons</dt><dd>{hideMystery ? '?' : activeJump.after}</dd></div>
          <div><dt>Shell structure</dt><dd>{hideMystery ? 'Hidden' : activeSucc.shells.slice().reverse().join(', ')}</dd></div>
        </dl>
        <div class="facts pad">
          <b>Key facts</b>
          <ul>
            <li>Successive IEs always increase because each electron is removed from an increasingly positive ion with less electron–electron repulsion.</li>
            <li>A <b>large jump</b> means the next electron is being removed from a <b>new inner shell</b> closer to the nucleus with less shielding.</li>
            <li>Count the electrons removed <b>before</b> the first large jump to find the Group number.</li>
          </ul>
        </div>
      {/if}
    </section>
  </aside>
</main>
