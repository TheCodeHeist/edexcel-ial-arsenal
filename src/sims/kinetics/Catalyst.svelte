<script lang="ts" module>
  import type { Surf, Kind } from './catalyst';
  export interface CatalystPrefs {
    surf: Surf;           // the 3D surface reaction
    kind: Kind;           // profile: exothermic or endothermic
    uncat: boolean; cat: boolean;
    T: number;            // for the Maxwell–Boltzmann curve
  }
  export const CATALYST: CatalystPrefs = { surf: 'ethene', kind: 'exo', uncat: true, cat: true, T: 400 };
</script>

<script lang="ts">
  /* Catalysts: an alternative route with a lower activation energy (spec 9.5), reaction profiles with the
     intermediate (9.6), catalysts and sustainable industry (9.7), the catalyst on the Maxwell–Boltzmann curve (9.8),
     homogeneous and heterogeneous catalysts (11.1ix), and a solid catalyst for gas reactions providing a surface
     (11.11): adsorption, reaction and desorption on nickel or iron, in 3D. */
  import { onDestroy } from 'svelte';
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import CollideMB from './CollideMB.svelte';
  import type { SLook } from './catalyst3d';
  import { SURFACES, LEVELS, profile, CO_STEPS, CASES, AE } from './catalyst';
  import { EA, EA_CAT, fracAbove } from './collide';
  import { plain } from './consts';
  import { RM } from '../../lib/util';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: CatalystPrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });

  /* ---------- the surface ---------- */
  const S = $derived(SURFACES[prefs.surf]);
  let stage = $state(0);
  let playing = $state(!RM);
  const si = $derived(Math.min(stage, S.stages.length - 1));
  const auto = setInterval(() => {
    if (!playing || off) return;
    stage = (stage + 1) % S.stages.length;
  }, 3200);
  onDestroy(() => clearInterval(auto));
  function go(i: number) { playing = false; stage = (i + S.stages.length) % S.stages.length; }
  const look = $derived<SLook>({ surf: prefs.surf, stage: si, playing });

  /* ---------- profiles ---------- */
  const W = 520, H = 300, ML = 44, MR = 20, MT = 20, MB = 34;
  const px = (x: number) => ML + x * (W - ML - MR);
  const py = (e: number) => H - MB - e * (H - MT - MB);
  const path = (pts: [number, number][]) => pts.map(([x, e], i) => `${i ? 'L' : 'M'}${px(x).toFixed(1)} ${py(e).toFixed(1)}`).join('');
  const Lv = $derived(LEVELS[prefs.kind]);
  const catTop = $derived(Lv.p1 >= Lv.p2 ? { x: 0.34, e: Lv.p1 } : { x: 0.66, e: Lv.p2 });
  const exo = $derived(prefs.kind === 'exo');

  /* ---------- the cobalt demonstration ---------- */
  let co = $state(0);
  let coRun = 0;
  function runCo() {
    clearTimeout(coRun);
    co = 0;
    const next = () => { if (co < CO_STEPS.length - 1) { co++; coRun = window.setTimeout(next, RM ? 400 : co === 2 ? 4200 : 2600); } };
    coRun = window.setTimeout(next, RM ? 300 : 1800);
  }
  onDestroy(() => clearTimeout(coRun));
  const step = $derived(CO_STEPS[co]);
  const bubbles = Array.from({ length: 22 }, (_, i) => ({ x: 52 + ((i * 37) % 96), d: (i * 0.37) % 2.2, s: 1.4 + ((i * 7) % 5) * 0.25, r: 2 + (i % 3) }));

  $effect(() => {
    stats = [['Surface', `${S.metal}: stage ${si + 1}/${S.stages.length}`], ['Ea', `${EA} → ${EA_CAT} kJ mol⁻¹`], ['E ≥ Ea', `${plain(fracAbove(EA, prefs.T) * 100, 2)}% → ${plain(fracAbove(EA_CAT, prefs.T) * 100, 2)}%`]];
  });
  const kindName = { hetero: 'heterogeneous', homo: 'homogeneous', both: 'homogeneous and heterogeneous', enzyme: 'enzyme' };

  /** Kernel helpers: drive 3D surface stages and the Co²⁺ homogeneous catalysis demo. */
  export function setStage(v: number | 'play') {
    if (v === 'play') playing = true;
    else go(v);
  }
  export function setCoStep(i: number) {
    clearTimeout(coRun);
    co = Math.max(0, Math.min(CO_STEPS.length - 1, Math.round(i)));
  }
  export async function runCoDemo() {
    runCo();
    const end = performance.now() + 9500;
    while (co < CO_STEPS.length - 1 && performance.now() < end) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (co < CO_STEPS.length - 1) { clearTimeout(coRun); co = CO_STEPS.length - 1; }
  }
  export function getState() { return { stage: si, playing, co }; }
</script>

<main class="layout kn-catalyst" hidden={off}>
  <section class="panel stage" aria-label="Catalysis on a metal surface">
    <div class="stage-head">
      <div class="label-chip"><small>Heterogeneous catalysis</small><span>{S.equation} on {S.metalName}</span></div>
      <div class="stage-tools">
        <Seg label="Reaction" options={[['ethene', 'Ethene + hydrogen on Ni', 'Ni'], ['haber', 'Haber process on Fe', 'Fe']]} bind:value={prefs.surf} onchange={() => (stage = 0)} />
      </div>
    </div>
    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./catalyst3d').then((m) => m.SurfaceScene)} {look} label="3D view of molecules reacting on a metal surface. Drag to turn it.">
          <div class="hud tl"><b>{si + 1}. {S.stages[si].title}</b><span>{S.equation}</span></div>
          <div class="hud bl">Gold: bonds to the surface. Faint orange: a weakened bond. Glow: an occupied active site.</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      <button class="btn primary big playbtn" type="button" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      <button class="btn step" type="button" onclick={() => go(stage - 1)} aria-label="Previous stage">‹</button>
      <div class="picker flat stages" role="group" aria-label="Stage">
        {#each S.stages as s, i (s.title)}<button type="button" class="fchip" aria-pressed={si === i} onclick={() => go(i)} title={s.title}>{i + 1}</button>{/each}
      </div>
      <button class="btn step" type="button" onclick={() => go(stage + 1)} aria-label="Next stage">›</button>
    </div>
    <p class="caption">{S.stages[si].text}</p>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Kinds of catalyst">
      <div class="ph"><h2>Two kinds of catalyst</h2></div>
      <div class="kinds">
        <div><h4>Heterogeneous</h4><p>In a <strong>different phase</strong> from the reactants: usually a solid with gases or solutions. It provides a <strong>surface</strong>: reactants adsorb onto active sites, their bonds weaken, they react, and the products desorb.</p>
          <p class="eg">Fe in the Haber process · V₂O₅ in the Contact process · Ni for adding H₂ to alkenes · Pt, Rh in catalytic converters · MnO₂ with H₂O₂</p></div>
        <div><h4>Homogeneous</h4><p>In the <strong>same phase</strong> as the reactants, usually all in solution. It reacts to form an <strong>intermediate</strong>, which reacts on to give the products and the catalyst back.</p>
          <p class="eg">Co²⁺(aq) with tartrate and H₂O₂ · H⁺(aq) in esterification and in the iodination of propanone</p></div>
      </div>
      <div class="facts pad"><b>A solid catalyst for gas reactions</b><ul>
        <li>Gas molecules adsorb onto the surface: weak bonds to the metal atoms at active sites.</li>
        <li>Bonds within the reactants weaken, and the reactants are held close together in a good orientation.</li>
        <li>The products desorb, freeing the sites. Adsorption must be strong enough to weaken bonds, weak enough to let the products go.</li>
        <li>The catalyst is finely divided, or spread thinly on a support, to give a large surface area.</li>
      </ul></div>
      <p class="why pad2">{S.note}</p>
    </section>
  </aside>

  <section class="panel full" aria-label="Reaction profiles">
    <div class="ph phrow"><h2>Reaction profiles</h2>
      <div class="phctl">
        <Seg label="Reaction" options={[['exo', 'Exothermic'], ['endo', 'Endothermic']]} bind:value={prefs.kind} />
        <div class="picker flat" role="group" aria-label="Routes shown">
          <button type="button" class="fchip" aria-pressed={prefs.uncat} onclick={() => (prefs.uncat = !prefs.uncat)}>Uncatalysed</button>
          <button type="button" class="fchip t-acidbase" aria-pressed={prefs.cat} onclick={() => (prefs.cat = !prefs.cat)}>Catalysed</button>
        </div>
      </div>
    </div>
    <div class="cols2">
      <div class="plotbox">
        <svg class="prof" viewBox="0 0 {W} {H}" role="img" aria-label="{exo ? 'Exothermic' : 'Endothermic'} reaction profile with and without a catalyst">
          <defs>
            <marker id="kn-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="ah" /></marker>
            <marker id="kn-arc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="ahc" /></marker>
          </defs>
          <line class="ax" x1={ML} x2={W - MR} y1={H - MB} y2={H - MB} marker-end="url(#kn-ar)" />
          <line class="ax" x1={ML} x2={ML} y1={H - MB} y2={MT - 8} marker-end="url(#kn-ar)" />
          <text class="al" x={W - MR} y={H - 10} text-anchor="end">progress of reaction</text>
          <text class="al" x="16" y={MT + 4} transform="rotate(-90 16 {MT + 4})" text-anchor="end">energy</text>
          <line class="lvl" x1={ML} x2={px(0.98)} y1={py(Lv.R)} y2={py(Lv.R)} />
          <line class="lvl" x1={px(0.6)} x2={px(1)} y1={py(Lv.P)} y2={py(Lv.P)} />
          <text class="lab" x={px(0.02)} y={py(Lv.R) + 17}>reactants</text>
          <text class="lab" x={px(1)} y={py(Lv.P) + (exo ? 17 : -9)} text-anchor="end">products</text>
          {#if prefs.uncat}
            <path class="route" d={path(profile(prefs.kind, false))} />
            <line class="arr" x1={px(0.5)} x2={px(0.5)} y1={py(Lv.R)} y2={py(Lv.peak) + 2} marker-end="url(#kn-ar)" />
            <text class="lab b" x={px(0.5) + 7} y={py(Lv.peak) + 24}>Ea</text>
          {/if}
          {#if prefs.cat}
            <path class="route cat" d={path(profile(prefs.kind, true))} />
            <line class="arr cat" x1={px(catTop.x)} x2={px(catTop.x)} y1={py(Lv.R)} y2={py(catTop.e) + 2} marker-end="url(#kn-arc)" />
            <text class="lab c" x={px(catTop.x) + 7} y={py(Lv.R) - 6}>Ea (cat)</text>
            <circle class="idot" cx={px(0.5)} cy={py(Lv.inter)} r="4" />
            <text class="lab c sm" x={px(0.5)} y={py(Lv.inter) + 16} text-anchor="middle">intermediate</text>
          {/if}
          <line class="arr" x1={px(0.93)} x2={px(0.93)} y1={py(Lv.R)} y2={py(Lv.P) + (exo ? -2 : 2)} marker-end="url(#kn-ar)" />
          <text class="lab b" x={px(0.93) - 7} y={py((Lv.R + Lv.P) / 2) + 4} text-anchor="end">ΔH {exo ? '< 0' : '> 0'}</text>
        </svg>
      </div>
      <div>
        <div class="facts"><b>Drawing the profiles</b><ul>
          <li>The catalysed route has two (or more) humps: the reactants form an <strong>intermediate</strong> with the catalyst, which then reacts to give the products.</li>
          <li>Ea (cat) runs from the reactants to the <strong>highest</strong> point on the catalysed route, and it is lower than Ea.</li>
          <li>The reactant and product levels don’t move, so <strong>ΔH is the same</strong> with or without a catalyst.</li>
          <li>Ea is always measured up from the <strong>reactants</strong>; for an endothermic reaction it must be bigger than ΔH.</li>
        </ul></div>
        <p class="why">A catalyst speeds up a reaction without being used up, by providing an alternative reaction route with a lower activation energy. It speeds up the forward and backward reactions equally.</p>
      </div>
    </div>
  </section>

  <section class="panel full" aria-label="The catalyst on the Maxwell–Boltzmann curve">
    <div class="ph"><h2>The same molecules, a lower Ea</h2></div>
    <div class="cols2">
      <div class="plotbox">
        <CollideMB T={prefs.T} eas={[{ E: EA, name: 'Ea', tone: 'a' }, { E: EA_CAT, name: 'Ea (catalysed)', tone: 'b' }]} mag
          label="Maxwell–Boltzmann distribution with the uncatalysed and catalysed activation energies" />
        <label class="ctl tctl"><span class="ctl-l">Temperature <b>{prefs.T} K</b></span>
          <input class="slider" type="range" min="200" max="700" step="10" bind:value={prefs.T} /></label>
      </div>
      <div>
        <dl class="reads pad0 nocase">
          <div><dt>With E ≥ Ea ({EA} kJ mol⁻¹)</dt><dd>{plain(fracAbove(EA, prefs.T) * 100, 3)}%</dd></div>
          <div><dt>With E ≥ Ea (cat) ({EA_CAT} kJ mol⁻¹)</dt><dd>{plain(fracAbove(EA_CAT, prefs.T) * 100, 3)}%</dd></div>
          <div class="wide"><dt>Molecules that can react</dt><dd>× {plain(fracAbove(EA_CAT, prefs.T) / fracAbove(EA, prefs.T), 3)}</dd></div>
        </dl>
        <p class="why">The catalyst doesn’t change the distribution: the curve stays exactly where it is (it only moves with temperature). It moves the activation energy line to the left, so a much greater proportion of the molecules have energy ≥ Ea, more collisions are successful, and the rate rises.</p>
      </div>
    </div>
  </section>

  <section class="panel full" aria-label="A homogeneous catalyst you can see">
    <div class="ph"><h2>Watching an intermediate: cobalt(II) and tartrate</h2></div>
    <div class="cols2">
      <div class="codemo">
        <svg viewBox="0 0 200 200" class="beaker" role="img" aria-label="A beaker: {step.title}">
          <path class="glass" d="M40 30 V176 Q40 186 50 186 H150 Q160 186 160 176 V30" />
          <rect class="liquid" x="42" y="78" width="116" height="106" rx="8" style:fill={step.colour} />
          <g class="bub" class:still={RM}>
            {#each bubbles.slice(0, Math.round(step.fizz * bubbles.length)) as b, i (i)}
              <circle cx={b.x} cy="178" r={b.r} style:animation-delay="{b.d}s" style:animation-duration="{b.s}s" />
            {/each}
          </g>
          {#if step.fizz > 0.6}<path class="foam" d="M44 78 Q60 66 76 76 Q92 64 108 76 Q124 64 140 76 Q152 68 156 78 Z" />{/if}
          <rect class="hot" x="30" y="188" width="140" height="6" rx="3" />
          <text class="tt" x="100" y="22" text-anchor="middle">{step.temp}</text>
        </svg>
        <div class="costeps">
          <div class="picker flat" role="group" aria-label="Demonstration step">
            {#each CO_STEPS as s, i (s.id)}<button type="button" class="fchip" aria-pressed={co === i} onclick={() => { clearTimeout(coRun); co = i; }}>{i + 1}. {s.title}</button>{/each}
          </div>
          <button class="btn primary" type="button" onclick={runCo}>Run the demonstration</button>
        </div>
      </div>
      <div>
        <h4 class="sh">{co + 1}. {step.title}</h4>
        <p class="why big">{step.text}</p>
        <div class="facts"><b>What it shows</b><ul>
          <li>The catalyst takes part: it changes (pink Co²⁺ → green Co³⁺ complex), so the reaction goes by a different route.</li>
          <li>The green intermediate is the trough between the two humps on the catalysed profile.</li>
          <li>At the end the pink colour is back: the catalyst is regenerated, so only a small amount is needed.</li>
        </ul></div>
        <p class="safety"><b>Safety.</b> Hydrogen peroxide is an irritant and cobalt(II) chloride is toxic and a possible carcinogen: eye protection and gloves; the froth can overflow, so use a large beaker.</p>
      </div>
    </div>
  </section>

  <section class="panel full" aria-label="Catalysts and sustainability">
    <div class="ph"><h2>Catalysts make industry more sustainable</h2></div>
    <div class="cases">
      {#each CASES as c (c.name)}
        <article>
          <h4>{c.name}</h4>
          <p class="meta"><span class="tag {c.kind}">{kindName[c.kind]}</span> {c.cat}</p>
          <p class="eqn">{c.eq}</p>
          <p>{c.gain}</p>
        </article>
      {/each}
    </div>
    <div class="cols2">
      <div class="work">
        <div class="eq">atom economy = (Mr of the wanted product ÷ total Mr of the reactants) × 100%</div>
        <div class="eq">hydration: C₂H₄ + H₂O → C₂H₅OH: 46.0 ÷ (28.0 + 18.0) × 100 = {plain(AE.hydration, 3)}%</div>
        <div class="eq">fermentation: C₆H₁₂O₆ → 2C₂H₅OH + 2CO₂: (2 × 46.0) ÷ 180.0 × 100 = {plain(AE.fermentation, 3)}%</div>
      </div>
      <div class="facts"><b>Why it is greener</b><ul>
        <li>Lower temperatures (and pressures) for the same rate: less fuel burned, so lower costs and less CO₂ released.</li>
        <li>New routes with fewer steps or higher atom economy: less waste, fewer raw materials.</li>
        <li>The catalyst is not used up, so a small amount works for a long time <span class="beyond">poisoning, beyond the spec</span></li>
      </ul></div>
    </div>
  </section>

  <section class="panel full explain" aria-label="Key facts">
    <div class="ex-body">
      <h3>Catalysts <small>spec 9.5–9.8, 11.1 ix, 11.11</small></h3>
      <div class="cols2 bare">
        <p>A catalyst increases the rate of a reaction without being used up. It does this by providing an alternative reaction route with a lower activation energy. It doesn’t change ΔH, and it doesn’t change the position of an equilibrium: it speeds up the forward and backward reactions equally, so equilibrium is reached sooner.</p>
        <div class="facts"><b>Key facts</b><ul>
          <li>Heterogeneous: different phase from the reactants; works by adsorption on its surface.</li>
          <li>Homogeneous: same phase as the reactants; works by forming an intermediate.</li>
          <li>On the Maxwell–Boltzmann curve a catalyst moves the Ea line, not the curve.</li>
          <li>Sustainability: lower energy use and higher atom economy.</li>
        </ul></div>
      </div>
    </div>
  </section>
</main>
