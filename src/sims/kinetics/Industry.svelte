<script lang="ts" module>
  export interface IndustryPrefs {
    proc: 'haber' | 'contact' | 'methanol';
    T: number;                 // °C
    P: number;                 // atm
    measure: 'frac' | 'conv';
    colour: 'yield' | 'rate' | 'cost';
  }
  export const INDUSTRY: IndustryPrefs = { proc: 'haber', T: 450, P: 200, measure: 'frac', colour: 'yield' };
</script>

<script lang="ts">
  /* Industry: choosing the conditions for an industrial equilibrium (spec 9.11): the yield landscape against
     temperature and pressure from a real K(T), with rate and cost; how K changes with temperature for exothermic and
     endothermic reactions (13.6); and why, in terms of entropy: ΔS_surroundings = −ΔH/T, so ΔS_total = R ln K changes
     with temperature (13.8). */
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import Plot from '../circuit/Plot.svelte';
  import type { ILook } from './industry3d';
  import { PROCS, Kp, yieldAt, rateRel, costRel, entropy, ENDO, R } from './industry';
  import { sci, plain } from './consts';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: IndustryPrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });

  const p = $derived(PROCS.find((x) => x.id === prefs.proc) ?? PROCS[0]);
  function pick(id: IndustryPrefs['proc']) {
    const q = PROCS.find((x) => x.id === id)!;
    prefs.proc = id; prefs.T = q.real.T; prefs.P = q.real.P;
    // contact: the gas is mostly nitrogen from the air, so % SO₃ in the mixture says little; show % converted
    prefs.measure = id === 'contact' ? 'conv' : 'frac';
  }
  // keep stored values inside the process's ranges
  $effect.pre(() => {
    if (!(prefs.T >= p.Tr[0] && prefs.T <= p.Tr[1])) prefs.T = p.real.T;
    if (!(prefs.P >= p.Pr[0] && prefs.P <= p.Pr[1])) prefs.P = p.real.P;
  });
  const Pstep = $derived(p.Pr[1] <= 20 ? 0.5 : 1);

  const TK = $derived(prefs.T + 273);
  const Y = $derived(yieldAt(p, TK, prefs.P));
  const Yreal = $derived(yieldAt(p, p.real.T + 273, p.real.P));
  const rate = $derived(rateRel(p, prefs.T, prefs.P));
  const cost = $derived(costRel(p, prefs.T, prefs.P));
  const K = $derived(Kp(p, TK));
  const E = $derived(entropy(p, TK));
  const E298 = $derived(entropy(p, 298));
  const pct = (x: number) => `${plain(x * 100, 3)}%`;
  const ymain = $derived(prefs.measure === 'frac' ? Y.frac : Y.conv);
  const yreal = $derived(prefs.measure === 'frac' ? Yreal.frac : Yreal.conv);

  /* the verdict on the chosen conditions */
  const verdict = $derived.by(() => {
    const out: string[] = [];
    if (rate < 0.1) out.push(`Too slow: the rate is only ${sci(rate, 2)} × that at ${p.real.T} °C and ${p.real.P} atm.${prefs.T < p.real.T - 30 ? ' The catalyst is not effective this cold.' : ''}`);
    else if (rate > 3) out.push(`Fast (${plain(rate, 2)} × the rate at the industrial conditions).`);
    if (ymain < yreal * 0.6) out.push(`The equilibrium yield is poor (${pct(ymain)} against ${pct(yreal)}).`);
    else if (ymain > yreal * 1.15) out.push(`A higher equilibrium yield (${pct(ymain)} against ${pct(yreal)}).`);
    if (cost > 1.4) out.push(`Expensive to run: cost index ${plain(cost, 2)} (energy for compression, thick-walled plant, safety).`);
    if (!out.length) out.push('Close to the industrial compromise: a reasonable yield, at a good rate, at a sensible cost.');
    return out;
  });

  /* 13.6: K against T, exothermic against endothermic (log scale) */
  const KT = $derived.by(() => {
    const T0 = 300, T1 = 1000, pts = (f: (T: number) => number) => Array.from({ length: 71 }, (_, i) => { const T = T0 + i * 10; return [T, Math.log10(f(T))] as [number, number]; });
    const series = [
      { color: 'var(--ch1)', name: `${p.product} (exo)`, pts: pts((T) => Kp(p, T)) },
      { color: 'var(--ch2)', name: 'NO₂ (endo)', pts: pts((T) => Kp(ENDO[0], T)) },
      { color: 'var(--ch3, #e0a030)', name: 'CO₂ (endo)', pts: pts((T) => Kp(ENDO[1], T)) },
    ];
    const ys = series.flatMap((s) => s.pts.map((q) => q[1])).filter(Number.isFinite);
    const lo = Math.max(-40, Math.floor(Math.min(...ys))), hi = Math.min(40, Math.ceil(Math.max(...ys)));
    return { series, yr: [lo, hi] as [number, number], now: { x: TK, y: Math.log10(K) } };
  });

  /* the yield against T at the chosen pressure, and against P at the chosen temperature */
  const cuts = $derived.by(() => {
    const m = (y: { frac: number; conv: number }) => 100 * (prefs.measure === 'frac' ? y.frac : y.conv);
    const byT = Array.from({ length: 61 }, (_, i) => { const t = p.Tr[0] + (i / 60) * (p.Tr[1] - p.Tr[0]); return [t, m(yieldAt(p, t + 273, prefs.P))] as [number, number]; });
    const byP = Array.from({ length: 61 }, (_, i) => { const q = p.Pr[0] + (i / 60) * (p.Pr[1] - p.Pr[0]); return [q, m(yieldAt(p, TK, q))] as [number, number]; });
    const ymax = Math.min(100, Math.ceil((Math.max(...byT.map((q) => q[1]), ...byP.map((q) => q[1])) * 1.1) / 10) * 10) || 10;
    return { byT, byP, ymax };
  });

  const look = $derived<ILook>({ proc: prefs.proc, measure: prefs.measure, colour: prefs.colour, T: prefs.T, P: prefs.P });
  $effect(() => { stats = [['Yield', pct(ymain)], ['Kp', `${sci(K)} ${p.units}`], ['Rate', `${sci(rate, 2)}×`]]; });
  const sgn = (x: number) => (x >= 0 ? '+' : '−') + plain(Math.abs(x), 3);
</script>

<main class="layout kn-industry" hidden={off}>
  <section class="panel stage" aria-label="Yield landscape">
    <div class="stage-head">
      <div class="label-chip"><small>{p.name} · ΔH = {sgn(p.dH / 1000)} kJ mol⁻¹</small><span>{p.eq}</span></div>
      <div class="stage-tools">
        <Seg label="Process" options={[['haber', 'Haber', 'NH₃'], ['contact', 'Contact', 'SO₃'], ['methanol', 'Methanol', 'CH₃OH']]} value={prefs.proc} onchange={pick} />
      </div>
    </div>
    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./industry3d').then((m) => m.IndustryScene)} {look} label="3D surface of the equilibrium yield against temperature and pressure. Drag to turn it.">
          <div class="hud tl"><b>{pct(ymain)} {prefs.measure === 'frac' ? p.product + ' at equilibrium' : 'converted'}</b><span>{prefs.T} °C · {prefs.P} atm · Kp = {sci(K)} {p.units}</span></div>
          <div class="hud tr"><span>rate × {sci(rate, 2)}</span><span>cost × {plain(cost, 2)}</span></div>
          <div class="hud bl">Height: equilibrium yield. Colour: {prefs.colour === 'yield' ? 'yield' : prefs.colour === 'rate' ? 'rate (yellow = fast)' : 'cost (yellow = cheap)'}. Gold ring: the conditions used.</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      <label class="ctl scrub"><span class="ctl-l">Temperature <b>{prefs.T} °C</b></span>
        <input class="slider" type="range" min={p.Tr[0]} max={p.Tr[1]} step="5" bind:value={prefs.T} /></label>
      <label class="ctl scrub"><span class="ctl-l">Pressure <b>{prefs.P} atm</b></span>
        <input class="slider" type="range" min={p.Pr[0]} max={p.Pr[1]} step={Pstep} bind:value={prefs.P} /></label>
    </div>
    <div class="ctls row">
      <div class="ctl"><span class="ctl-l">Height</span><Seg label="Yield measure" options={[['frac', `% ${p.product} in the mixture`, `% ${p.product}`], ['conv', '% converted', '% conv']]} bind:value={prefs.measure} /></div>
      <div class="ctl"><span class="ctl-l">Colour</span><Seg label="Colour the surface by" options={[['yield', 'Yield'], ['rate', 'Rate'], ['cost', 'Cost']]} bind:value={prefs.colour} /></div>
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="The chosen conditions">
      <div class="ph"><h2>Your conditions</h2><button class="btn" type="button" onclick={() => { prefs.T = p.real.T; prefs.P = p.real.P; }}>Use the real ones</button></div>
      <dl class="reads pad nocase">
        <div><dt>{p.product} at equilibrium</dt><dd>{pct(Y.frac)}</dd></div>
        <div><dt>Converted</dt><dd>{pct(Y.conv)}</dd></div>
        <div><dt>Kp at {TK} K</dt><dd>{sci(K)} {p.units}</dd></div>
        <div><dt>Rate (relative)</dt><dd>{sci(rate, 2)}×</dd></div>
        <div><dt>Cost index</dt><dd>{plain(cost, 2)}</dd></div>
        <div><dt>Catalyst</dt><dd class="txt">{p.catalyst}</dd></div>
      </dl>
      <div class="said">{#each verdict as v, i (i)}<p>{v}</p>{/each}</div>
    </section>
    <section class="panel" aria-label="What industry uses">
      <div class="ph"><h2>The compromise</h2></div>
      <p class="real"><b>{p.real.T} °C, {p.real.P} atm, {p.catalyst}</b><br />Used for {p.use}.</p>
      <ul class="whys">{#each p.why as w, i (i)}<li>{w}</li>{/each}</ul>
    </section>
  </aside>

  <section class="panel full" aria-label="Slices through the surface">
    <div class="ph"><h2>Yield against temperature and pressure</h2></div>
    <div class="cols2">
      <div class="plotbox">
        <Plot xr={p.Tr} yr={[0, cuts.ymax]} xLabel="temperature / °C" yLabel="yield / %" h={240} trace curve={cuts.byT} now={{ x: prefs.T, y: ymain * 100 }} probe label="Equilibrium yield against temperature at the chosen pressure" />
        <p class="cap">At {prefs.P} atm. Exothermic: the yield falls as the temperature rises.</p>
      </div>
      <div class="plotbox">
        <Plot xr={p.Pr} yr={[0, cuts.ymax]} xLabel="pressure / atm" yLabel="yield / %" h={240} trace curve={cuts.byP} now={{ x: prefs.P, y: ymain * 100 }} probe label="Equilibrium yield against pressure at the chosen temperature" />
        <p class="cap">At {prefs.T} °C. Fewer moles of gas on the right ({p.dn} mol): the yield rises with pressure.</p>
      </div>
    </div>
  </section>

  <section class="panel full" aria-label="K and temperature">
    <div class="ph"><h2>How K changes with temperature <span class="tag">13.6, 13.8</span></h2></div>
    <div class="cols2">
      <div class="plotbox">
        <Plot xr={[300, 1000]} yr={KT.yr} xLabel="T / K" yLabel="log₁₀ Kp" h={280} series={KT.series} now={KT.now} probe label="log of K against temperature for exothermic and endothermic reactions" />
        <div class="legend">{#each KT.series as s (s.name)}<span><i style:background={s.color}></i>{s.name}</span>{/each}</div>
        <p class="cap">Exothermic: K falls as T rises, so the yield falls. Endothermic: K rises with T. A change of pressure or concentration never changes K.</p>
      </div>
      <div class="work">
        <div class="gh">Why, in terms of entropy, at {TK} K</div>
        <div class="eq">ΔS<sub>system</sub> = {sgn(E.sys)} J K⁻¹ mol⁻¹ ({p.dn} mol of gas: fewer ways to arrange the energy)</div>
        <div class="eq">ΔS<sub>surroundings</sub> = −ΔH / T = −({sgn(p.dH)}) / {TK} = {sgn(E.surr)} J K⁻¹ mol⁻¹</div>
        <div class="eq">ΔS<sub>total</sub> = {sgn(E.sys)} + ({sgn(E.surr)}) = <b>{sgn(E.tot)}</b> J K⁻¹ mol⁻¹</div>
        <div class="eq">ΔS<sub>total</sub> = R ln K → ln K = {sgn(E.tot)} / {R} = {sgn(E.lnK)} → K = <b>{sci(E.K)}</b></div>
        <div class="eq">At 298 K: ΔS<sub>surroundings</sub> = {sgn(E298.surr)}, ΔS<sub>total</sub> = {sgn(E298.tot)} J K⁻¹ mol⁻¹, K = {sci(E298.K)}</div>
        <p class="why">For an exothermic reaction ΔS<sub>surroundings</sub> is positive, but it gets smaller as T rises (the same heat given to hotter surroundings makes less difference). ΔS<sub>system</sub> hardly changes, so ΔS<sub>total</sub> falls, and so does K. For an endothermic reaction ΔS<sub>surroundings</sub> is negative and gets less negative as T rises, so ΔS<sub>total</sub> and K rise.</p>
        <p class="why">K here is Kp with pressures in atm (the standard pressure, so the numbers in ln K work out). ΔH and ΔS are taken as constant with temperature.</p>
      </div>
    </div>
  </section>

  <section class="panel full explain" aria-label="Key facts">
    <div class="ex-body">
      <h3>Choosing the conditions <small>spec 9.11, 13.6, 13.8</small></h3>
      <div class="cols2 bare">
        <div>
          <p>Industry wants as much product as possible, as fast as possible, as cheaply and as safely as possible. Equilibrium yield, rate and cost pull in different directions, so the conditions chosen are a <b>compromise</b>.</p>
          <p>A catalyst does not change the yield, but it lets a lower temperature (higher yield) be used at a good rate, and it saves energy. Removing the product and recycling unreacted gases makes up for a low yield per pass.</p>
        </div>
        <div class="facts"><b>Key facts</b><ul>
          <li>Haber: 450 °C, 200 atm, iron catalyst, about 15% per pass, NH₃ liquefied out and gases recycled.</li>
          <li>Contact: 450 °C, 1–2 atm, V₂O₅ catalyst, about 99.5% conversion overall.</li>
          <li>Low temperature: higher yield (exothermic) but slow. High temperature: fast, low yield.</li>
          <li>High pressure: higher yield (fewer gas moles) and faster, but costly: energy, strong plant, safety.</li>
          <li>Only temperature changes K. ΔS<sub>total</sub> = ΔS<sub>system</sub> − ΔH/T = R ln K.</li>
        </ul></div>
      </div>
    </div>
  </section>
</main>
