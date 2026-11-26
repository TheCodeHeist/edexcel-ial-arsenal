<script lang="ts" module>
  export interface EquilPrefs { sys: 'no2' | 'hi' | 'icl' }
  export const EQUIL: EquilPrefs = { sys: 'no2' };
</script>

<script lang="ts">
  /* Equilibrium: dynamic equilibrium and Le Chatelier's principle (spec 9.9, 9.10), and what does and does not change
     K (13.4, 13.5, 13.7). A sealed syringe of N₂O₄ ⇌ 2NO₂ (or H₂ + I₂ ⇌ 2HI) whose molecules really react both ways;
     heat it, cool it, push or pull the plunger, add a gas or a catalyst, and read the rates and concentrations as they
     settle. Plus the suggested ICl + Cl₂ ⇌ ICl₃ demonstration in a U-tube (a heterogeneous equilibrium). */
  import { onMount } from 'svelte';
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import Plot from '../circuit/Plot.svelte';
  import type { ELook, EquilScene } from './equil3d';
  import { Gas, UTube, SYSTEMS, kc, kcUnits, dn, pStar, ICL } from './equil';
  import { sci, plain } from './consts';
  import { RM } from '../../lib/util';
  import { frameReady } from '../../lib/perf';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: EquilPrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });
  let playing = $state(!RM);

  const sysOf = (id: string) => SYSTEMS.find((s) => s.id === id) ?? SYSTEMS[0];
  const gas = new Gas(SYSTEMS[0]);          // the effect below loads the chosen system
  const tube = new UTube();
  let scene: EquilScene | null = null;
  function onscene(s: unknown) { scene = s as EquilScene | null; if (scene) { scene.gas = gas; scene.tube = tube; } }

  let frame = $state(0);          // bumps ten times a second: everything read from the engines derives from it
  let lastSys = '';
  $effect(() => {
    const id = prefs.sys;
    if (id === lastSys) return;
    lastSys = id;
    if (id !== 'icl') { gas.reset(sysOf(id)); Tset = gas.Tset; Vcm = 100; cat = false; }
    else { tube.T = tube.Tset = 293; tube.liq = 1; tube.sol = 0; tube.gas = 0; tube.flow = false; Tset = 293; }
    msg = null; frame++;
  });

  onMount(() => {
    let raf = 0, last = performance.now(), acc = 0;
    const loop = (now: number) => {
      const g = frameReady(now, last);
      if (g !== 'go') { if (g === 'hidden') last = now; raf = requestAnimationFrame(loop); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!off && playing) { if (prefs.sys === 'icl') tube.step(dt); else gas.step(dt); }
      acc += dt;
      if (acc > 0.1) { acc = 0; if (!off) frame++; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  /* ---------- controls ---------- */
  let Tset = $state(gas.Tset);
  let Vcm = $state(100);
  let cat = $state(false);
  interface Msg { h: string; lines: string[] }
  let msg = $state<Msg | null>(null);

  const isGas = $derived(prefs.sys !== 'icl');
  const S = $derived.by(() => { void frame; return gas.s; });
  const forwardEndo = $derived(S.dH > 0);
  const dN = $derived(dn(S));
  const fwd = $derived(S.eq.split(' ⇌ ')[1]), bwd = $derived(S.eq.split(' ⇌ ')[0]);
  const gasMolesL = $derived(-S.nu.filter((v) => v < 0).reduce((a, b) => a + b, 0));
  const gasMolesR = $derived(S.nu.filter((v) => v > 0).reduce((a, b) => a + b, 0));
  const fmtK = (T: number) => `${sci(kc(S, T))}${dN ? ' ' + kcUnits(dN) : ''}`;

  function setT(T: number) {
    const from = isGas ? gas.Tset : tube.Tset;
    T = Math.round(T);
    if (isGas) gas.Tset = T; else tube.Tset = T;
    Tset = T;
    if (Math.abs(T - from) < 1) return;
    const up = T > from;
    if (!isGas) {
      msg = { h: up ? `Warmed to ${T} K` : `Cooled to ${T} K`, lines: [
        `The forward reaction, ICl(l) + Cl₂(g) → ICl₃(s), is exothermic (ΔH ≈ ${plain(ICL.dH / 1000, 3)} kJ mol⁻¹).`,
        up ? 'Raising the temperature moves the position of equilibrium in the endothermic direction, to the left: the yellow ICl₃ crystals break down to brown liquid ICl and chlorine.' : 'Lowering the temperature moves the position of equilibrium in the exothermic direction, to the right: more yellow ICl₃ forms (if there is chlorine to use).',
        `In terms of K: Kp = 1/p(Cl₂) ${up ? 'falls' : 'rises'} from ${sci(1 / pStar(from))} to ${sci(1 / pStar(T))} atm⁻¹, so the chlorine pressure the solid can stand ${up ? 'rises' : 'falls'} to ${sci(pStar(T))} atm.`,
      ] };
      return;
    }
    const k0 = kc(S, from), k1 = kc(S, T);
    const toRight = up === forwardEndo;
    msg = { h: up ? `Heated to ${T} K` : `Cooled to ${T} K`, lines: [
      `The forward reaction is ${forwardEndo ? 'endothermic' : 'exothermic'} (ΔH = ${forwardEndo ? '+' : '−'}${plain(Math.abs(S.dH) / 1000, 3)} kJ mol⁻¹).`,
      `${up ? 'Raising' : 'Lowering'} the temperature moves the position of equilibrium in the ${up ? 'endothermic' : 'exothermic'} direction, to the ${toRight ? 'right' : 'left'}, ${up ? 'absorbing' : 'releasing'} heat energy and so opposing the change.`,
      `Temperature is the only change that alters K: Kc goes from ${fmtK(from)} to ${fmtK(T)}. The old concentrations now give Qc ${toRight ? '<' : '>'} Kc, so the system reacts ${toRight ? 'forwards' : 'backwards'} until Qc = Kc.`,
      S.id === 'no2' ? (toRight ? 'More NO₂: the gas turns a darker brown.' : 'Less NO₂: the gas turns paler.') : (toRight ? 'More HI and less I₂: the purple fades.' : 'More I₂: the purple deepens.'),
    ] };
  }
  function setV(v: number) {
    const from = gas.V * 1000;
    v = Math.round(v);
    gas.V = v / 1000; Vcm = v;
    if (Math.abs(v - from) < 1) return;
    const smaller = v < from, ratio = from / v;
    const less = gasMolesL < gasMolesR ? 'left' : 'right', fewer = gasMolesL < gasMolesR ? gasMolesL : gasMolesR, more = gasMolesL < gasMolesR ? gasMolesR : gasMolesL;
    msg = { h: smaller ? `Plunger pushed in to ${v} cm³` : `Plunger pulled out to ${v} cm³`, lines: dN === 0 ? [
      `The pressure ${smaller ? 'rises' : 'falls'} by a factor of ${plain(smaller ? ratio : 1 / ratio, 3)}, but there are ${gasMolesL} mol of gas on each side of the equation.`,
      'Changing the pressure has no effect on the position of this equilibrium: Qc does not change when every concentration is multiplied by the same factor (the factors cancel).',
      `The colour still ${smaller ? 'darkens' : 'fades'} at once: [I₂] is ${smaller ? 'higher' : 'lower'} because the same molecules are in a ${smaller ? 'smaller' : 'larger'} volume. Kc is unchanged.`,
    ] : [
      `At once every concentration ${smaller ? 'rises' : 'falls'} by a factor of ${plain(smaller ? ratio : 1 / ratio, 3)}${S.id === 'no2' ? `, so the gas ${smaller ? 'darkens' : 'pales'} straight away (more or fewer NO₂ molecules per cm³)` : ''}.`,
      `Higher pressure moves the position of equilibrium towards the side with fewer gas molecules; lower pressure towards more. Here: ${smaller ? `to the ${less} (${fewer} mol of gas against ${more})` : `to the ${less === 'left' ? 'right' : 'left'} (${more} mol of gas against ${fewer})`}.`,
      `In terms of K: Qc = [NO₂]²/[N₂O₄] is ${smaller ? 'multiplied' : 'divided'} by ${plain(smaller ? ratio : 1 / ratio, 3)}, so Qc ${smaller ? '>' : '<'} Kc; the system reacts ${smaller ? 'backwards' : 'forwards'} until Qc = Kc again. Kc is unchanged (${fmtK(gas.T)}).`,
      S.id === 'no2' ? (smaller ? 'So the colour fades a little after the first darkening, but stays darker than before.' : 'So the colour darkens a little after the first fading, but stays paler than before.') : '',
    ].filter(Boolean) };
  }
  function add() {
    const i = S.add, f = S.sp[i].f;
    gas.addMol(i, 0.0006);
    const isR = S.nu[i] < 0;
    msg = { h: `Added ${f}`, lines: [
      `[${f}] goes up, so Qc ${isR ? '<' : '>'} Kc.`,
      `The position of equilibrium moves to the ${isR ? 'right' : 'left'}, using up some of the added ${f}, until Qc = Kc again (opposing the change).`,
      S.id === 'no2' ? 'The gas darkens at first, then fades a little as some NO₂ forms N₂O₄; it ends darker than before.' : 'Some I₂ is used up: the purple fades.',
      `Kc is unchanged at ${fmtK(gas.T)}; only temperature changes K.`,
    ] };
  }
  function setCat(on: boolean) {
    cat = on; gas.cat = on;
    msg = { h: on ? 'Catalyst added' : 'Catalyst removed', lines: [
      on ? 'A catalyst speeds up the forward and the backward reactions by the same factor: it provides a route of lower activation energy for both.' : 'Without the catalyst both reactions are slower again, by the same factor.',
      'So equilibrium is reached sooner, but the position of equilibrium and the value of K are unchanged: k_f/k_b = Kc either way.',
      S.id === 'no2' ? 'No real catalyst is used for this reaction; it is shown to make the point. (Platinum catalyses the H₂ + I₂ reaction.)' : 'Platinum catalyses this reaction.',
    ] };
  }
  function resetGas() { gas.reset(); Tset = gas.Tset; Vcm = 100; cat = false; msg = null; frame++; }
  function flow(on: boolean) {
    tube.flow = on;
    msg = { h: on ? 'Chlorine passed in' : 'Chlorine turned off', lines: on ? [
      'More Cl₂ raises p(Cl₂) above the equilibrium value p*, so the position of equilibrium moves to the right, using up Cl₂: yellow crystals of ICl₃ grow and the brown liquid disappears.',
      'Kp = 1/p(Cl₂): the liquid and the solid do not appear in the expression.',
    ] : ['The tube is closed: the chlorine left settles at p* for this temperature, with solid and liquid side by side.'] };
  }
  function vent() {
    tube.flow = false; tube.gas = 0;
    msg = { h: 'Tube turned upside down: chlorine out', lines: [
      'Chlorine is denser than air, so it pours out: p(Cl₂) falls below p*.',
      'The position of equilibrium moves to the left to replace the chlorine: the yellow crystals decompose back to brown liquid ICl and Cl₂.',
    ] };
  }

  /* ---------- readings (from the engine, refreshed ten times a second) ---------- */
  const R = $derived.by(() => {
    void frame;
    const c = gas.conc(), { rf, rb } = gas.rates(), K = gas.kc(), Q = gas.q();
    return { c, rf, rb, K, Q, P: gas.p(), T: gas.T, ratio: Q / K };
  });
  const status = $derived(Math.abs(Math.log(R.ratio)) < 0.03 ? 'at equilibrium' : R.ratio < 1 ? 'Qc < Kc: going forwards' : 'Qc > Kc: going backwards');
  const U = $derived.by(() => { void frame; return { T: tube.T, liq: tube.liq, sol: tube.sol, gas: tube.gas, ps: pStar(tube.T), flow: tube.flow }; });
  const uStatus = $derived(U.sol > 0.002 && U.liq > 0.002 && Math.abs(U.gas - U.ps) < 0.02 * Math.max(1, U.ps) ? 'at equilibrium' : U.gas > U.ps ? (U.liq > 0.002 ? 'p(Cl₂) > p*: ICl₃ forming' : 'all ICl used up') : U.sol > 0.002 ? 'p(Cl₂) < p*: ICl₃ decomposing' : 'no solid left');

  /* ---------- graphs ---------- */
  const G = $derived.by(() => {
    void frame;
    const h = gas.hist, t1 = Math.max(20, gas.t), t0 = t1 - 20;
    const vis = h.filter((x) => x.t >= t0);
    const cs = S.sp.map((sp, i) => ({ color: sp.css, name: sp.f, pts: vis.map((x) => [x.t, x.c[i]] as [number, number]) }));
    const cmax = Math.max(1e-6, ...vis.flatMap((x) => x.c)) * 1.15;
    const rmax = Math.max(1e-9, ...vis.map((x) => Math.max(x.rf, x.rb))) * 1.15;
    const rs = [
      { color: 'var(--ch1)', name: 'forward', pts: vis.map((x) => [x.t, x.rf] as [number, number]) },
      { color: 'var(--ch2)', name: 'backward', pts: vis.map((x) => [x.t, x.rb] as [number, number]) },
    ];
    return { t0, t1, cs, rs, cmax, rmax };
  });

  const look = $derived<ELook>({ mode: isGas ? 'gas' : 'icl', sys: prefs.sys, playing });
  $effect(() => {
    stats = isGas
      ? [['T', `${plain(R.T, 3)} K`], ['Kc', `${sci(R.K)}${dN ? ' ' + kcUnits(dN) : ''}`], ['Qc/Kc', plain(R.ratio, 3)]]
      : [['T', `${plain(U.T, 3)} K`], ['p(Cl₂)', `${plain(U.gas, 2)} atm`], ['p*', `${sci(U.ps)} atm`]];
  });

  /** Kernel helper: apply Le Chatelier disturbances through the exact button handlers and wait for settling. */
  export async function disturb(opts: {
    T?: number; deltaT?: number; V?: number; pressure?: 'increase' | 'decrease';
    add?: boolean; cat?: boolean; chlorine?: 'flow' | 'stop' | 'vent'; reset?: boolean;
  }) {
    playing = true;
    if (opts.reset) {
      if (isGas) resetGas();
      else { tube.liq = 1; tube.sol = 0; tube.gas = 0; tube.flow = false; tube.Tset = 293; Tset = 293; msg = null; frame++; }
    }
    if (isGas) {
      if (opts.T !== undefined) setT(Math.max(S.T[0], Math.min(S.T[2], opts.T)));
      else if (opts.deltaT !== undefined) setT(Math.max(S.T[0], Math.min(S.T[2], gas.Tset + opts.deltaT)));
      if (opts.V !== undefined) setV(Math.max(40, Math.min(100, opts.V)));
      else if (opts.pressure === 'increase') setV(Math.max(40, Math.round(Vcm / 2)));
      else if (opts.pressure === 'decrease') setV(Math.min(100, Vcm * 2));
      if (opts.add) add();
      if (typeof opts.cat === 'boolean') setCat(opts.cat);
      const disturbed = opts.T !== undefined || opts.deltaT !== undefined || opts.V !== undefined || opts.pressure !== undefined || opts.add;
      if (disturbed) {
        if (RM) {
          for (let i = 0; i < 120; i++) gas.step(0.05);
          frame++;
        } else {
          const end = performance.now() + 2600;
          await new Promise((r) => setTimeout(r, 300));
          while (performance.now() < end && !off && (Math.abs(Math.log(gas.q() / gas.kc())) > 0.03 || Math.abs(gas.T - gas.Tset) > 1.5)) {
            await new Promise((r) => setTimeout(r, 80));
          }
          frame++;
        }
      }
    } else {
      if (opts.T !== undefined) setT(Math.max(273, Math.min(360, opts.T)));
      else if (opts.deltaT !== undefined) setT(Math.max(273, Math.min(360, tube.Tset + opts.deltaT)));
      if (opts.chlorine === 'flow') flow(true);
      else if (opts.chlorine === 'stop') flow(false);
      else if (opts.chlorine === 'vent') vent();
      if (opts.T !== undefined || opts.deltaT !== undefined || opts.chlorine !== undefined) {
        if (RM) {
          for (let i = 0; i < 80; i++) tube.step(0.05);
          frame++;
        } else {
          await new Promise((r) => setTimeout(r, 1800));
          frame++;
        }
      }
    }
  }

  export function getState() {
    if (isGas) {
      const c = gas.conc(), { rf, rb } = gas.rates(), K = gas.kc(), Q = gas.q();
      return {
        isGas: true as const, id: S.id, name: S.name, eq: S.eq, Tmin: S.T[0], Tmax: S.T[2],
        T: gas.T, Tset, Vcm, P: gas.p(), cat, status,
        species: S.sp.map((sp, i) => ({ f: sp.f, conc: c[i] })),
        rf, rb, K, Q, units: dN ? kcUnits(dN) : 'no units', msg,
      };
    }
    return {
      isGas: false as const, id: 'icl', eq: 'ICl(l) + Cl₂(g) ⇌ ICl₃(s)', Tmin: 273, Tmax: 360,
      T: tube.T, Tset, liq: tube.liq, sol: tube.sol, gasP: tube.gas, ps: pStar(tube.T), flow: tube.flow, status: uStatus, msg,
    };
  }
</script>

<main class="layout kn-equil" hidden={off}>
  <section class="panel stage" aria-label="Equilibrium">
    <div class="stage-head">
      <div class="label-chip"><small>{isGas ? S.vessel : 'U-tube demonstration'}</small><span>{isGas ? S.eq : 'ICl(l) + Cl₂(g) ⇌ ICl₃(s)'}</span></div>
      <div class="stage-tools">
        <Seg label="System" options={[['no2', 'N₂O₄ ⇌ 2NO₂', 'NO₂'], ['hi', 'H₂ + I₂ ⇌ 2HI', 'HI'], ['icl', 'ICl + Cl₂ ⇌ ICl₃', 'ICl₃']]} bind:value={prefs.sys} />
      </div>
    </div>
    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./equil3d').then((m) => m.EquilScene)} {look} {onscene}
          label="3D view of the equilibrium mixture. Drag to turn it.">
          {#if isGas}
            <div class="hud tl"><b>{status}</b><span>rate forward {sci(R.rf)} · backward {sci(R.rb)} mol dm⁻³ s⁻¹</span></div>
            <div class="hud tr"><span>T = {plain(R.T, 3)} K · V = {Vcm} cm³</span><span>p = {plain(R.P, 3)} atm{cat ? ' · catalyst' : ''}</span></div>
            <div class="hud bl">Every dot is a molecule; new ones glow. Time slowed: the real change takes microseconds.</div>
          {:else}
            <div class="hud tl"><b>{uStatus}</b><span>p(Cl₂) = {plain(U.gas, 2)} atm · p* = {sci(U.ps)} atm</span></div>
            <div class="hud tr"><span>T = {plain(U.T, 3)} K</span><span>{U.flow ? 'Cl₂ flowing in' : 'tube closed'}</span></div>
          {/if}
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      <button class="btn primary big playbtn" type="button" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      <label class="ctl scrub"><span class="ctl-l">Water bath <b>{Tset} K ({Tset - 273} °C)</b></span>
        <input class="slider" type="range" min={isGas ? S.T[0] : 273} max={isGas ? S.T[2] : 360} step="1" bind:value={Tset} onchange={() => setT(Tset)} /></label>
      {#if isGas}
        <label class="ctl scrub"><span class="ctl-l">Volume <b>{Vcm} cm³</b></span>
          <input class="slider" type="range" min="40" max="100" step="1" bind:value={Vcm} onchange={() => setV(Vcm)} /></label>
      {/if}
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Change the conditions">
      <div class="ph"><h2>Disturb it</h2></div>
      {#if isGas}
        <div class="btns">
          <button class="btn" type="button" onclick={() => setT(Math.min(S.T[2], gas.Tset + 30))}>Heat +30 K</button>
          <button class="btn" type="button" onclick={() => setT(Math.max(S.T[0], gas.Tset - 30))}>Cool −30 K</button>
          <button class="btn" type="button" onclick={() => setV(Math.max(40, Math.round(Vcm / 2)))} disabled={Vcm <= 40}>Push in (halve V)</button>
          <button class="btn" type="button" onclick={() => setV(Math.min(100, Vcm * 2))} disabled={Vcm >= 100}>Pull out (double V)</button>
          <button class="btn" type="button" onclick={add}>Add {S.sp[S.add].f}</button>
          <button class="btn" type="button" aria-pressed={cat} onclick={() => setCat(!cat)}>{cat ? 'Remove catalyst' : 'Add a catalyst'}</button>
          <button class="btn" type="button" onclick={resetGas}>Start again</button>
        </div>
        <dl class="reads pad nocase">
          {#each S.sp as sp, i (sp.f)}
            <div><dt style:color={sp.css}>[{sp.f}]</dt><dd>{sci(R.c[i])} mol dm⁻³</dd></div>
          {/each}
          <div><dt>Kc at {plain(R.T, 3)} K</dt><dd>{sci(R.K)} {dN ? kcUnits(dN) : ''}</dd></div>
          <div><dt>Qc now</dt><dd>{sci(R.Q)}</dd></div>
          <div class="wide"><dt>Kc expression</dt><dd class="txt">{S.id === 'no2' ? 'Kc = [NO₂]² / [N₂O₄]' : 'Kc = [HI]² / ([H₂][I₂])'}</dd></div>
        </dl>
      {:else}
        <div class="btns">
          <button class="btn primary" type="button" aria-pressed={U.flow} onclick={() => flow(!U.flow)}>{U.flow ? 'Stop the chlorine' : 'Pass in chlorine'}</button>
          <button class="btn" type="button" onclick={vent}>Turn upside down (Cl₂ out)</button>
          <button class="btn" type="button" onclick={() => setT(Math.min(360, tube.Tset + 25))}>Warm +25 K</button>
          <button class="btn" type="button" onclick={() => setT(Math.max(273, tube.Tset - 25))}>Cool −25 K</button>
          <button class="btn" type="button" onclick={() => { tube.liq = 1; tube.sol = 0; tube.gas = 0; tube.flow = false; tube.Tset = 293; Tset = 293; msg = null; }}>Start again</button>
        </div>
        <dl class="reads pad nocase">
          <div><dt>ICl (liquid)</dt><dd>{plain(U.liq * 100, 2)}%</dd></div>
          <div><dt>ICl₃ (solid)</dt><dd>{plain(U.sol * 100, 2)}%</dd></div>
          <div><dt>p(Cl₂)</dt><dd>{plain(U.gas, 2)} atm</dd></div>
          <div><dt>p* at {plain(U.T, 3)} K</dt><dd>{sci(U.ps)} atm</dd></div>
          <div class="wide"><dt>Kp expression</dt><dd class="txt">Kp = 1 / p(Cl₂) = {sci(1 / U.ps)} atm⁻¹ at this temperature</dd></div>
        </dl>
      {/if}
    </section>
    <section class="panel" aria-label="What happened">
      <div class="ph"><h2>What happened</h2></div>
      {#if msg}
        <div class="said"><b>{msg.h}</b>{#each msg.lines as l, i (i)}<p>{l}</p>{/each}</div>
      {:else}
        <p class="why pad2">{isGas ? `The mixture is at dynamic equilibrium: both reactions are still going on (watch the glowing molecules) at equal rates, so the concentrations stay constant. Change something and the explanation appears here.` : 'Brown liquid ICl in a sealed U-tube. Pass chlorine in, warm or cool the tube, or tip the chlorine out, and the explanation appears here.'}</p>
      {/if}
    </section>
  </aside>

  {#if isGas}
    <section class="panel full" aria-label="Graphs">
      <div class="ph"><h2>Concentrations and rates against time</h2></div>
      <div class="cols2">
        <div class="plotbox">
          <Plot xr={[G.t0, G.t1]} yr={[0, G.cmax]} xLabel="time / s" yLabel="concentration / mol dm⁻³" h={260} series={G.cs} label="Concentration of each gas against time" />
        </div>
        <div class="plotbox">
          <Plot xr={[G.t0, G.t1]} yr={[0, G.rmax]} xLabel="time / s" yLabel="rate / mol dm⁻³ s⁻¹" h={260} series={G.rs} label="Forward and backward rates against time" />
        </div>
      </div>
      <p class="why pad2">At equilibrium the two rate lines meet and stay together, and the concentration lines go flat: the reactions have not stopped, they are going at the same rate. After a disturbance the rates separate, the concentrations change, and the rates come together again (at a new value).</p>
    </section>
  {/if}

  <section class="panel full explain" aria-label="Key facts">
    <div class="ex-body">
      <h3>Dynamic equilibrium and Le Chatelier <small>spec 9.9, 9.10, 13.4, 13.5, 13.7</small></h3>
      <div class="cols2 bare">
        <div>
          <p>Many reactions are reversible. In a closed system they reach a <b>dynamic equilibrium</b>: the rate of the forward reaction equals the rate of the backward reaction, so the concentrations of the reactants and the products stay constant, although both reactions carry on.</p>
          <p><b>Le Chatelier’s principle</b>: if a system at equilibrium is disturbed, the position of equilibrium moves to oppose the change. It predicts the direction; the equilibrium constant explains it. A change of concentration or pressure leaves K the same, and the mixture shifts until the quotient Q equals K again. A change of temperature changes K itself, so the mixture shifts to match the new K.</p>
          <p>Suggested demonstrations: the NO₂/N₂O₄ syringe (temperature and pressure) and chlorine with iodine(I) chloride in a U-tube (concentration and temperature); both are here.</p>
        </div>
        <div class="facts"><b>Key facts</b><ul>
          <li>Temperature up → moves in the endothermic direction; down → the exothermic direction. K changes.</li>
          <li>Pressure up → moves to the side with fewer gas molecules. No effect if both sides have the same number. K unchanged.</li>
          <li>Concentration of a substance up → moves to use it up. K unchanged.</li>
          <li>A catalyst speeds up both reactions equally: equilibrium is reached faster, with no change in position or K.</li>
          <li>Forward endothermic (K rises with T): N₂O₄ ⇌ 2NO₂, ΔH = +57 kJ mol⁻¹. Forward exothermic (K falls with T): H₂ + I₂ ⇌ 2HI, ΔH = −9.6 kJ mol⁻¹.</li>
        </ul></div>
      </div>
    </div>
  </section>
</main>
