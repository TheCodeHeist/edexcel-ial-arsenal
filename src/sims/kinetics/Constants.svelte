<script lang="ts" module>
  export interface KPrefs {
    rx: string;
    mode: 'Kc' | 'Kp';
    n0: number[];          // initial moles
    meas: number;          // which species was measured at equilibrium
    neq: number;           // its equilibrium moles
    V: number;             // volume / dm³ (Kc)
    P: number;             // total pressure / atm (Kp)
    prog: number;          // 0 = the start, 1 = equilibrium (3D view)
    loaded: string;        // the reaction whose preset is loaded
  }
  export const KCALC: KPrefs = { rx: 'haber', mode: 'Kp', n0: [1, 3, 0], meas: 2, neq: 0, V: 10, P: 200, prog: 1, loaded: '' };
</script>

<script lang="ts">
  /* Kc and Kp: write the expression for a homogeneous or heterogeneous equilibrium (spec 13.1, 13.2), work out its
     units, calculate it from experimental data with an initial / change / equilibrium table (13.3), and say what its
     size means (13.9). Plus the suggested esterification practical: find Kc by titration. */
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { KLook } from './constants3d';
  import { RXNS, inKc, inKp, dnK, unitsKc, unitsKp, litK, quotient, solve, sf3, extent, sup, type KRx } from './constants';
  import { sci, plain } from './consts';
  import { RM } from '../../lib/util';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: KPrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });
  let playing = $state(!RM);

  const rx = $derived<KRx>(RXNS.find((r) => r.id === prefs.rx) ?? RXNS[0]);
  /** Load a reaction's preset: the measured amount is solved from the literature K, then rounded as if measured. */
  function preset(r: KRx, mode: 'Kc' | 'Kp' = r.pre.mode) {
    const n0 = [...r.pre.n0];
    let P = r.pre.P;
    const V = r.pre.V;
    // heterogeneous Kp with a fixed gas ratio: K depends on P only, so set P to match
    const lone = mode === 'Kp' && r.sp.filter(inKp).every((s) => s.nu > 0);
    if (lone) {
      const g = r.sp.filter(inKp), d = dnK(r, 'Kp'), share = g.reduce((a, s) => a * (s.nu / g.reduce((b, t) => b + t.nu, 0)) ** s.nu, 1);
      P = sf3((litK(r, 'Kp') / share) ** (1 / d));
    }
    let neq: number;
    if (lone) neq = sf3((P * V) / (0.08206 * r.T) * (r.sp[r.pre.meas].nu / r.sp.filter(inKp).reduce((b, t) => b + t.nu, 0)));
    else neq = sf3(solve(r, mode, n0, V, P).n[r.pre.meas]);
    Object.assign(prefs, { rx: r.id, mode, n0, meas: r.pre.meas, neq, V, P, loaded: r.id });
  }
  $effect.pre(() => { if (prefs.loaded !== prefs.rx || prefs.n0.length !== rx.sp.length) preset(rx); });
  function pick(id: string) { const r = RXNS.find((x) => x.id === id)!; preset(r, r.pre.mode); }
  function setMode(m: 'Kc' | 'Kp') { preset(rx, m); }

  /* ---------- the table ---------- */
  const xi = $derived((prefs.neq - (prefs.n0[prefs.meas] ?? 0)) / (rx.sp[prefs.meas]?.nu || 1));
  const neqAll = $derived(rx.sp.map((s, i) => (prefs.n0[i] ?? 0) + s.nu * xi));
  const bad = $derived(neqAll.some((n) => n < -1e-9));
  const Q = $derived(quotient(rx, prefs.mode, neqAll.map((n) => Math.max(n, 0)), prefs.V, prefs.P));
  const inK = $derived(prefs.mode === 'Kc' ? inKc : inKp);
  const d = $derived(dnK(rx, prefs.mode));
  const units = $derived(prefs.mode === 'Kc' ? unitsKc(d) : unitsKp(d));
  const lit = $derived(litK(rx, prefs.mode));
  const lone = $derived(prefs.mode === 'Kp' && rx.sp.filter(inKp).every((s) => s.nu > 0));

  /* ---------- the expression ---------- */
  const term = (f: string, n: number) => (prefs.mode === 'Kc' ? `[${f}]` : `p(${f})`) + (n > 1 ? sup(n) : '');
  const top = $derived(rx.sp.filter((s) => s.nu > 0 && inK(s)).map((s) => term(s.f, s.nu)));
  const bottom = $derived(rx.sp.filter((s) => s.nu < 0 && inK(s)).map((s) => term(s.f, -s.nu)));
  const left = $derived(rx.sp.filter((s) => !inK(s)));
  const a = $derived(rx.sp.filter((s) => s.nu > 0 && inK(s)).reduce((x, s) => x + s.nu, 0));
  const b = $derived(rx.sp.filter((s) => s.nu < 0 && inK(s)).reduce((x, s) => x - s.nu, 0));
  const U1 = $derived(prefs.mode === 'Kc' ? '(mol dm⁻³)' : 'atm');
  const pw = (n: number) => (n === 1 ? '' : sup(n));
  const eqn = $derived(`${rx.sp.filter((s) => s.nu < 0).map((s) => `${-s.nu > 1 ? -s.nu : ''}${s.f}(${s.st})`).join(' + ')} ⇌ ${rx.sp.filter((s) => s.nu > 0).map((s) => `${s.nu > 1 ? s.nu : ''}${s.f}(${s.st})`).join(' + ')}`);
  const subst = $derived.by(() => {
    const f = (i: number) => { const s = rx.sp[i], v = Q.val[i], n = Math.abs(s.nu); return `${n > 1 ? '(' : ''}${sci(v)}${n > 1 ? ')' + sup(n) : ''}`; };
    const num = rx.sp.map((s, i) => [s, i] as const).filter(([s]) => s.nu > 0 && inK(s)).map(([, i]) => f(i)).join(' × ') || '1';
    const den = rx.sp.map((s, i) => [s, i] as const).filter(([s]) => s.nu < 0 && inK(s)).map(([, i]) => f(i)).join(' × ');
    return den ? `${num} ÷ (${den})` : num;
  });

  /* ---------- the 3D view: from the start to equilibrium ---------- */
  const at = $derived(rx.sp.map((s, i) => Math.max(0, (prefs.n0[i] ?? 0) + s.nu * xi * prefs.prog)));
  const Qnow = $derived(quotient(rx, prefs.mode, at, prefs.V, prefs.P).K);
  const scale = $derived.by(() => {
    const tot = (ns: number[]) => ns.reduce((x, n, i) => x + (rx.sp[i].st === 's' ? 0 : n), 0);
    const m = Math.max(1e-9, tot(prefs.n0), tot(neqAll.map((n) => Math.max(0, n))));
    const ms = Math.max(1e-9, ...rx.sp.map((s, i) => (s.st === 's' ? Math.max(prefs.n0[i] ?? 0, neqAll[i]) : 0)));
    return { g: 140 / m, s: 40 / ms };
  });
  const look = $derived<KLook>({
    vessel: rx.vessel, cols: rx.sp.map((s) => s.c3), solid: rx.sp.map((s) => s.st === 's'),
    counts: at.map((n, i) => n * (rx.sp[i].st === 's' ? scale.s : scale.g)), playing,
  });

  /* ---------- the esterification practical ---------- */
  const EST = $derived.by(() => {
    if (rx.id !== 'ester') return null;
    const acid = 0.1, alc = 0.1, hcl = 0.002, water = 1.0 / 18.0;       // 1.00 cm³ of 2.00 mol dm⁻³ HCl: ~1.00 g of water
    const sol = solve(rx, 'Kc', [acid, alc, 0, water], 1, 1);
    const left = sol.n[0], titre = sf3(((left + hcl) / 1.0) * 1000), blank = 2.0;
    const nAcid = (titre - blank) / 1000, made = acid - nAcid;
    const K = (made * (water + made)) / (nAcid * (alc - made));
    return { acid, alc, hcl, water, titre, blank, nAcid, made, K };
  });

  $effect(() => { stats = [['Reaction', rx.name], [prefs.mode, bad ? '—' : `${sci(Q.K)} ${units === 'no units' ? '' : units}`.trim()], ['T', `${rx.T} K`]]; });
  const num = (x: number) => (Number.isFinite(x) ? x : 0);

  /** Kernel helpers: pick a reaction/mode via the preset solver and read back the ICE table & K. */
  export function selectPreset(id: string, mode?: 'Kc' | 'Kp') {
    const r = RXNS.find((x) => x.id === id);
    if (!r) return;
    const m: 'Kc' | 'Kp' = mode ? (mode === 'Kp' && !r.kp ? 'Kc' : mode) : r.pre.mode;
    preset(r, m);
  }
  export function resetData() { preset(rx, prefs.mode); }
  export function getState() {
    const expr = `${prefs.mode} = ${bottom.length ? `(${top.join(' ') || '1'}) / (${bottom.join(' ')})` : (top.join(' ') || '1')}`;
    return {
      id: rx.id, name: rx.name, eqn, T: rx.T, mode: prefs.mode, kcOk: rx.kc, kpOk: rx.kp,
      expr, units, lit, K: Q.K, bad, V: prefs.V, P: prefs.P, prog: prefs.prog,
      meas: rx.sp[prefs.meas]?.f ?? '', neq: prefs.neq,
      rows: rx.sp.map((s, i) => ({
        f: s.f, st: s.st, n0: prefs.n0[i] ?? 0, neq: neqAll[i],
        val: Q.val[i], inK: inK(s),
      })),
      extentText: extent(lit), note: rx.note,
    };
  }
</script>

<main class="layout kn-k" hidden={off}>
  <section class="panel stage" aria-label="The mixture">
    <div class="stage-head">
      <div class="label-chip"><small>{rx.name} · {rx.T} K</small><span>{eqn}</span></div>
      <div class="stage-tools">
        {#if rx.kc && rx.kp}
          <Seg label="Constant" options={[['Kc', 'Kc'], ['Kp', 'Kp']]} value={prefs.mode} onchange={setMode} />
        {/if}
      </div>
    </div>
    <div class="picker flat" role="group" aria-label="Reaction">
      {#each RXNS as r (r.id)}<button type="button" class="fchip" aria-pressed={prefs.rx === r.id} onclick={() => pick(r.id)}>{r.name}</button>{/each}
    </div>
    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./constants3d').then((m) => m.KScene)} {look} label="3D view of the reaction mixture. Drag to turn it.">
          <div class="hud tl"><b>{prefs.prog >= 1 ? 'at equilibrium' : prefs.prog <= 0 ? 'at the start' : 'on the way'}</b><span>{prefs.mode === 'Kc' ? 'Qc' : 'Qp'} = {Qnow > 0 ? sci(Qnow) : '0'}{prefs.prog >= 1 ? ` = ${prefs.mode}` : ''}</span></div>
          <div class="hud tr">{#each rx.sp as s (s.f)}<span><i class="dot" style:background={s.col}></i>{s.f}{s.st === 's' ? ' (solid, not in K)' : ''}</span>{/each}</div>
          <div class="hud bl">Dots to scale with the amounts in the table. Solids are a heap: present, but not in the expression.</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      <button class="btn primary big playbtn" type="button" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      <label class="ctl scrub"><span class="ctl-l">From the start to equilibrium <b>{Math.round(prefs.prog * 100)}%</b></span>
        <input class="slider" type="range" min="0" max="1" step="0.01" bind:value={prefs.prog} /></label>
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="The expression">
      <div class="ph"><h2>The expression</h2></div>
      <div class="kexpr">
        <span class="kk">{prefs.mode === 'Kc' ? 'K' : 'K'}<sub>{prefs.mode === 'Kc' ? 'c' : 'p'}</sub> =</span>
        {#if bottom.length}
          <span class="frac"><span class="nu">{top.join(' ') || '1'}</span><span class="de">{bottom.join(' ')}</span></span>
        {:else}
          <span class="flat">{top.join(' ') || '1'}</span>
        {/if}
      </div>
      <div class="work">
        <div class="eq">Units: {U1}{pw(a)}{b ? ` ÷ ${U1}${pw(b)}` : ''} = {d === 0 ? 'cancel: no units' : units}</div>
        {#if left.length}<div class="eq">Left out: {left.map((s) => `${s.f}(${s.st})`).join(', ')}: {left.some((s) => s.st === 's') ? 'solids do not appear' : ''}{left.some((s) => s.st === 's') && left.some((s) => s.st !== 's') ? '; ' : ''}{left.some((s) => s.st !== 's') ? 'only gases appear in Kp' : ''}.</div>{/if}
        <div class="eq">{rx.sp.some((s) => s.st === 's') ? 'Heterogeneous: the substances are in more than one phase.' : 'Homogeneous: every substance is in the same phase.'}</div>
        <div class="eq">Products on top, reactants underneath, each raised to the power of its coefficient in the equation.</div>
      </div>
      <p class="why pad2">{rx.note}</p>
    </section>
    <section class="panel" aria-label="What the value means">
      <div class="ph"><h2>What the size of K means</h2></div>
      <div class="kbar" aria-hidden="true">
        <div class="track"></div>
        <i class="mark" style:left="{Math.max(0, Math.min(100, ((Math.log10(Math.max(lit, 1e-30)) + 15) / 30) * 100))}%"></i>
        <span class="lo">10⁻¹⁵</span><span class="mid">1</span><span class="hi">10¹⁵</span>
      </div>
      <dl class="reads pad nocase">
        <div><dt>Data-book {prefs.mode} at {rx.T} K</dt><dd>{sci(lit)} {units === 'no units' ? '' : units}</dd></div>
        <div><dt>Yours from the table</dt><dd>{bad ? '—' : sci(Q.K)}</dd></div>
      </dl>
      <p class="why pad2">{extent(lit)}{d !== 0 ? ' (With units, compare like with like: the size also depends on the units used.)' : ''}</p>
    </section>
  </aside>

  <section class="panel full" aria-label="Initial, change, equilibrium">
    <div class="ph"><h2>Calculate {prefs.mode} from experimental data</h2>
      <button class="btn" type="button" onclick={() => preset(rx, prefs.mode)}>Reset the data</button></div>
    <div class="ctls row">
      {#if prefs.mode === 'Kc'}
        <label class="ctl"><span class="ctl-l">Volume of the mixture <b>{prefs.V} dm³</b></span>
          <input class="num" type="number" min="0.001" step="any" bind:value={prefs.V} /></label>
      {:else}
        <label class="ctl"><span class="ctl-l">Total pressure at equilibrium <b>{prefs.P} atm</b></span>
          <input class="num" type="number" min="0.001" step="any" bind:value={prefs.P} /></label>
      {/if}
      <div class="ctl"><span class="ctl-l">Amount measured at equilibrium</span>
        <div class="picker flat" role="group" aria-label="Measured species">
          {#each rx.sp as s, i (s.f)}<button type="button" class="fchip" aria-pressed={prefs.meas === i} onclick={() => { prefs.meas = i; prefs.neq = sf3(neqAll[i]); }}>{s.f}</button>{/each}
        </div>
      </div>
    </div>
    <div class="tscroll">
      <table class="ice">
        <thead><tr><th></th>{#each rx.sp as s (s.f)}<th style:color={s.col}>{s.f}({s.st})</th>{/each}</tr></thead>
        <tbody>
          <tr><th>Initial / mol</th>{#each rx.sp as s, i (s.f)}<td><input class="num" type="number" min="0" step="any" bind:value={prefs.n0[i]} aria-label="Initial moles of {s.f}" /></td>{/each}</tr>
          <tr><th>Change / mol</th>{#each rx.sp as s, i (s.f)}<td>{s.nu * xi >= 0 ? '+' : '−'}{sci(Math.abs(num(s.nu * xi)))}</td>{/each}</tr>
          <tr><th>Equilibrium / mol</th>{#each rx.sp as s, i (s.f)}<td class:meas={prefs.meas === i}>{#if prefs.meas === i}<input class="num" type="number" min="0" step="any" bind:value={prefs.neq} aria-label="Equilibrium moles of {s.f}" />{:else}<span class:neg={neqAll[i] < -1e-9}>{sci(num(neqAll[i]))}</span>{/if}</td>{/each}</tr>
          {#if prefs.mode === 'Kc'}
            <tr><th>Concentration / mol dm⁻³</th>{#each rx.sp as s, i (s.f)}<td>{inKc(s) ? sci(Q.val[i]) : 'not in Kc'}</td>{/each}</tr>
          {:else}
            <tr><th>Mole fraction</th>{#each rx.sp as s, i (s.f)}<td>{inKp(s) ? plain(Q.ng > 0 ? neqAll[i] / Q.ng : 0, 3) : 'not a gas'}</td>{/each}</tr>
            <tr><th>Partial pressure / atm</th>{#each rx.sp as s, i (s.f)}<td>{inKp(s) ? sci(Q.val[i]) : 'not in Kp'}</td>{/each}</tr>
          {/if}
        </tbody>
      </table>
    </div>
    <div class="work">
      {#if bad}
        <div class="eq warn">Those numbers are impossible: more of something would be used up than there was. Check the measured amount.</div>
      {:else}
        <div class="eq">Change: the measured {rx.sp[prefs.meas].f} went from {sci(prefs.n0[prefs.meas] ?? 0)} to {sci(prefs.neq)} mol, so every change follows the mole ratio {rx.sp.map((s) => Math.abs(s.nu)).join(' : ')}.</div>
        {#if prefs.mode === 'Kc'}
          <div class="eq">Concentration = moles ÷ volume: divide each equilibrium amount by {prefs.V} dm³.</div>
        {:else}
          <div class="eq">Total moles of gas = {sci(Q.ng)}; mole fraction x = n ÷ {sci(Q.ng)}; partial pressure p = x × {prefs.P} atm. The partial pressures add up to the total.</div>
          {#if lone}<div class="eq">The gases are made in a fixed ratio, so their mole fractions are fixed: here Kp depends only on the total pressure.</div>{/if}
        {/if}
        <div class="eq big">{prefs.mode} = {subst} = <b>{sci(Q.K)}</b> {units === 'no units' ? '(no units)' : units}</div>
      {/if}
    </div>
  </section>

  {#if EST}
    <section class="panel full" aria-label="Finding Kc for esterification">
      <div class="ph"><h2>Suggested practical: Kc for esterification by titration</h2></div>
      <div class="cols2">
        <ol class="method">
          <li>Mix {EST.acid} mol of ethanoic acid and {EST.alc} mol of ethanol in a sealed flask with 1.00 cm³ of 2.00 mol dm⁻³ hydrochloric acid as the catalyst.</li>
          <li>Leave it for a week at room temperature to reach equilibrium.</li>
          <li>Titrate the mixture with 1.00 mol dm⁻³ sodium hydroxide, with phenolphthalein. Titrate 1.00 cm³ of the catalyst alone too (the blank).</li>
          <li>The difference between the two titres is the ethanoic acid left at equilibrium.</li>
        </ol>
        <div class="work">
          <div class="eq">Titre {plain(EST.titre, 3)} cm³ − blank {plain(EST.blank, 3)} cm³ = {plain(EST.titre - EST.blank, 3)} cm³ → n(acid) at equilibrium = {sci(EST.nAcid)} mol</div>
          <div class="eq">Ester made = water made = {EST.acid} − {sci(EST.nAcid)} = {sci(EST.made)} mol; ethanol left = {sci(EST.alc - EST.made)} mol</div>
          <div class="eq">Water at equilibrium = {sci(EST.made)} made + {sci(EST.water)} from the catalyst solution = {sci(EST.made + EST.water)} mol</div>
          <div class="eq big">Kc = ({sci(EST.made)} × {sci(EST.made + EST.water)}) ÷ ({sci(EST.nAcid)} × {sci(EST.alc - EST.made)}) = <b>{plain(EST.K, 3)}</b> (no units: the volume cancels)</div>
          <p class="why">Forgetting the water added with the catalyst is the classic slip; so is forgetting the blank (the HCl is an acid too).</p>
        </div>
      </div>
    </section>
  {/if}

  <section class="panel full explain" aria-label="Key facts">
    <div class="ex-body">
      <h3>Equilibrium constants <small>spec 13.1–13.3, 13.9</small></h3>
      <div class="cols2 bare">
        <div>
          <p>For aA + bB ⇌ cC + dD: K<sub>c</sub> = [C]<sup>c</sup>[D]<sup>d</sup> / [A]<sup>a</sup>[B]<sup>b</sup> using equilibrium concentrations, and K<sub>p</sub> = p(C)<sup>c</sup>p(D)<sup>d</sup> / p(A)<sup>a</sup>p(B)<sup>b</sup> using equilibrium partial pressures in atm.</p>
          <p>Partial pressure p = mole fraction × total pressure, where mole fraction = moles of that gas ÷ total moles of gas.</p>
          <p>In a heterogeneous equilibrium, solids are left out of both; K<sub>p</sub> includes only the gases.</p>
        </div>
        <div class="facts"><b>Key facts</b><ul>
          <li>Work out the units every time: substitute the units into the expression and cancel.</li>
          <li>Use equilibrium amounts, not the starting ones; use concentrations in K<sub>c</sub>, not moles (unless the volume cancels).</li>
          <li>K is constant at constant temperature: changing concentrations, pressure or adding a catalyst does not change it.</li>
          <li>Large K (much more than 1): mostly products. Small K: mostly reactants. Around 1: a real mixture of both.</li>
        </ul></div>
      </div>
    </div>
  </section>
</main>
