<script lang="ts" module>
  import type { QSlot } from './data';
  export interface ZooPrefs { sel: string; anti: boolean; spec: boolean; slots: QSlot[]; beta: number }
  export const ZOO: ZooPrefs = { sel: 'p', anti: false, spec: false, slots: ['u', 'u', 'd'], beta: 0.995 };
</script>

<script lang="ts">
  /* The particle table: the fundamental particles laid out like the Standard Model chart (three generations of
     quarks and leptons, then the force carriers), and the hadrons below it in rows of strangeness. Every cell opens a
     card with its properties, worked from its quarks where it has them; one switch turns the whole table into
     antiparticles, so the rules for antiparticles can be seen rather than memorised. The quark builder at the bottom
     makes hadrons from quarks and says which particle (if any) you have made. */
  import Sym from './Sym.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import { get, anti, BY_ID, ALL, QCHARGE, qText, hadronFor, thirds, signed, massText, lifeText,
    sci, short, MEVC2, E, C, FAMILY_NAME, type Particle, type Q, type Family } from './data';
  import { reach } from './physics';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: ZooPrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  /* the table, as particle ids; the antiparticle switch swaps every one */
  const SM: (string | null)[][] = [
    ['u', 'c', 't', 'g'],
    ['d', 's', 'b', 'gamma'],
    ['e', 'mu', 'tau', 'Z'],
    ['nue', 'numu', 'nutau', 'W'],
  ];
  const ROWLAB = ['up-type quarks', 'down-type quarks', 'charged leptons', 'neutrinos'];
  const BARY: { lab: string; ids: string[]; note?: string }[] = [
    { lab: 'S = 0', ids: ['n', 'p', 'Delta++'] },
    { lab: 'S = −1', ids: ['Sigma-', 'Sigma0', 'Lambda', 'Sigma+'] },
    { lab: 'S = −2', ids: ['Xi-', 'Xi0'] },
    { lab: 'S = −3', ids: ['Omega-'], note: 'Predicted from the pattern before it was found' },
    { lab: 'charm', ids: ['Lambdac'] },
  ];
  const MESO: { lab: string; ids: string[] }[] = [
    { lab: 'pions', ids: ['anti-pi+', 'pi0', 'pi+'] },
    { lab: 'kaons', ids: ['K+', 'K0', 'anti-K0', 'anti-K+'] },
    { lab: 'heavy', ids: ['D0', 'Jpsi', 'B+', 'Upsilon'] },
  ];
  const flip = (id: string) => (prefs.anti ? anti(get(id)).id : id);
  const sel = $derived<Particle>(BY_ID[prefs.sel] ?? get('p'));
  const partner = $derived(anti(sel));

  function pick(id: string) { prefs.sel = id; }
  // flipping the table flips the selected card too
  function setAnti(on: boolean) { if (on !== prefs.anti) { prefs.anti = on; prefs.sel = anti(sel).id; } }
  export function setAntiMode(on: boolean) { setAnti(on); }

  const COUNT = ALL.length + ALL.filter((p) => !p.self).length;
  $effect(() => { stats = [['Particles', COUNT], ['Card', sel.name]]; });

  /* ---------- the card ---------- */
  const kind = $derived(sel.family === 'baryon' || sel.family === 'meson' ? 'Hadron (made of quarks)' : 'Fundamental (no smaller parts)');
  const stat = $derived(sel.family === 'boson' ? 'Boson' : sel.family === 'meson' ? 'Boson (whole-number spin)' : 'Fermion');
  const qOf = (q: QSlot) => (q.startsWith('-') ? -QCHARGE[q.slice(1) as Q] : QCHARGE[q as Q]);
  const chargeSum = $derived(sel.quarks ? sel.quarks.map((q) => `${qText(q)} (${thirds(qOf(q))})`).join(' + ') + ` = ${thirds(sel.quarks.reduce((a, q) => a + qOf(q), 0))}` : '');
  const baryonSum = $derived(sel.quarks ? sel.quarks.map((q) => (q.startsWith('-') ? '−⅓' : '+⅓')).join(' ') + ` = ${thirds(sel.b3)}` : '');
  const Lsum = $derived(sel.L[0] + sel.L[1] + sel.L[2]);
  const famCls = (f: Family) => `f-${f}`;

  /* how far it gets before decaying (time dilation) */
  const travel = $derived(isFinite(sel.life) && sel.mass > 0 ? reach(sel.life, prefs.beta * C) : null);
  const fmtDist = (m: number) => (m >= 1000 ? `${short(m / 1000, 3)} km` : m >= 1 ? `${short(m, 3)} m` : m >= 1e-3 ? `${short(m * 1000, 3)} mm` : m >= 1e-6 ? `${short(m * 1e6, 3)} μm` : `${sci(m)} m`);
  const betaSlider = $derived(-Math.log10(1 - prefs.beta));   // 0.5 → 0.3, 0.9999 → 4
  function setBeta(x: number) { prefs.beta = Math.min(0.99999, 1 - 10 ** -x); }

  /* ---------- the quark builder ---------- */
  const PALETTE: QSlot[] = ['u', 'd', 's', 'c', 'b', 't', '-u', '-d', '-s', '-c', '-b', '-t'];
  const nq = $derived(prefs.slots.filter((q) => !q.startsWith('-')).length);
  const na = $derived(prefs.slots.length - nq);
  const built = $derived.by(() => {
    const s = prefs.slots;
    const q3 = s.reduce((a, q) => a + qOf(q), 0);
    const b3 = s.reduce((a, q) => a + (q.startsWith('-') ? -1 : 1), 0);
    const S = s.reduce((a, q) => a + (q === 's' ? -1 : q === '-s' ? 1 : 0), 0);
    let verdict: string, ok = false;
    if (s.length === 0) verdict = 'Add quarks from the palette.';
    else if (s.length === 1) verdict = 'A single quark can never be found alone: quarks are always confined in hadrons.';
    else if (s.length === 2 && nq === 1) { ok = true; verdict = 'A quark and an antiquark: a meson. Baryon number ⅓ − ⅓ = 0.'; }
    else if (s.length === 2) verdict = nq === 2 ? 'Two quarks don’t make a hadron: a meson needs a quark and an antiquark.' : 'Two antiquarks don’t make a hadron: a meson needs a quark and an antiquark.';
    else if (s.length === 3 && nq === 3) { ok = true; verdict = 'Three quarks: a baryon. Baryon number ⅓ + ⅓ + ⅓ = 1.'; }
    else if (s.length === 3 && na === 3) { ok = true; verdict = 'Three antiquarks: an antibaryon. Baryon number −1.'; }
    else verdict = 'A mixture of quarks and antiquarks that isn’t a whole baryon or meson: baryon number must be a whole number.';
    const top = s.some((q) => q === 't' || q === '-t');
    const match = ok && !top ? hadronFor(s) : null;
    return { q3, b3, S, verdict, ok, top, match };
  });
  function addQ(q: QSlot) { if (prefs.slots.length < 3) prefs.slots = [...prefs.slots, q]; }
  function dropQ(i: number) { prefs.slots = prefs.slots.filter((_, k) => k !== i); }
  const PRESETS: [string, QSlot[]][] = [['proton', ['u', 'u', 'd']], ['neutron', ['u', 'd', 'd']], ['π⁺', ['u', '-d']], ['antiproton', ['-u', '-u', '-d']], ['K⁻', ['s', '-u']], ['Ω⁻', ['s', 's', 's']]];
</script>

{#snippet cell(id: string)}
  {@const p = get(flip(id))}
  <button type="button" class="pcell {famCls(p.family)}" class:on={prefs.sel === p.id} class:dim={prefs.spec && !p.spec} onclick={() => pick(p.id)}
    aria-label="{p.name}{p.anti ? ' (antiparticle)' : ''}">
    <span class="pq">{p.q3 === 0 ? '0' : thirds(p.q3)}</span>
    <Sym s={p.sym} size="26px" />
    <span class="pn">{p.name}</span>
    <span class="pm">{massText(p.mass).replace('/c²', '')}</span>
  </button>
{/snippet}

<main class="layout zoo" hidden={off}>
  <section class="panel ztable" aria-label="The particle table">
    <div class="stage-head">
      <div class="label-chip"><small>Standard model</small><span>{prefs.anti ? 'Antiparticles' : 'Particles'}</span></div>
      <div class="stage-tools">
        <Seg label="Show" options={[['all', 'Everything', 'All'], ['spec', 'Named in the spec', 'Spec']]} value={prefs.spec ? 'spec' : 'all'} onchange={(x) => (prefs.spec = x === 'spec')} />
        <Seg label="Matter" options={[['m', 'Particles', 'Matter'], ['a', 'Antiparticles', 'Anti']]} value={prefs.anti ? 'a' : 'm'} onchange={(x) => setAnti(x === 'a')} />
      </div>
    </div>

    <div class="legend-row">
      <span><i class="f-quark"></i>Quarks</span><span><i class="f-lepton"></i>Leptons</span><span><i class="f-boson"></i>Force carriers</span>
      <span><i class="f-baryon"></i>Baryons (qqq)</span><span><i class="f-meson"></i>Mesons (qq̄)</span>
    </div>

    <h3 class="zh">Fundamental particles <small>no smaller parts</small></h3>
    <div class="smgrid">
      <span class="gl c1">I</span><span class="gl c2">II</span><span class="gl c3">III</span><span class="gl c4">forces</span>
      {#each SM as row, r (r)}
        <span class="rl" style:grid-row={r + 2}>{ROWLAB[r]}</span>
        {#each row as id, c (c)}
          {#if id}<div class="slot" style:grid-row={r + 2} style:grid-column={c + 2}>{@render cell(id)}</div>{/if}
        {/each}
      {/each}
      <div class="slot higgs" style:grid-row="2 / span 2" style:grid-column="6">{@render cell('H')}</div>
      <span class="gen-note" style:grid-row="6" style:grid-column="2 / 5">← generations: each a heavier copy of the one before →</span>
    </div>

    <h3 class="zh">Hadrons <small>made of quarks, held by the strong force</small></h3>
    <div class="hgrid">
      <div class="hblock">
        <b class="hb">Baryons <small>three quarks · baryon number {prefs.anti ? '−1' : '+1'}</small></b>
        {#each BARY as row (row.lab)}
          <div class="hrow">
            <span class="hl">{row.lab}{#if row.lab.startsWith('S')}<span class="beyond">strangeness</span>{/if}</span>
            <div class="hcells">{#each row.ids as id (id)}{@render cell(id)}{/each}</div>
            {#if row.note}<small class="hnote">{row.note}</small>{/if}
          </div>
        {/each}
      </div>
      <div class="hblock">
        <b class="hb">Mesons <small>quark + antiquark · baryon number 0</small></b>
        {#each MESO as row (row.lab)}
          <div class="hrow">
            <span class="hl">{row.lab}</span>
            <div class="hcells">{#each row.ids as id (id)}{@render cell(id)}{/each}</div>
          </div>
        {/each}
        <p class="why hint">Mesons have baryon number 0, so a meson and its antimeson are both in the table: π⁻ is the antiparticle of π⁺.</p>
      </div>
    </div>
  </section>

  <aside class="side">
    <section class="panel pcard {famCls(sel.family)}" aria-label="Particle card">
      {#key sel.id}
        <div class="swap">
          <div class="pc-h">
            <div class="pc-sym"><Sym s={sel.sym} size="54px" /></div>
            <div>
              <h2>{sel.name}</h2>
              <p class="sub">{FAMILY_NAME[sel.family]}{sel.gen ? ` · generation ${['I', 'II', 'III'][sel.gen - 1]}` : ''}{sel.anti ? ' · antiparticle' : ''}</p>
              <p class="chips"><span class="kchip">{kind}</span>{#if !sel.spec}<span class="beyond">beyond the spec</span>{/if}</p>
            </div>
          </div>
          <dl class="reads pad">
            <div><dt>Charge</dt><dd>{sel.q3 === 0 ? '0' : `${thirds(sel.q3)}e`}</dd></div>
            <div><dt>Rest mass</dt><dd>{massText(sel.mass)}</dd></div>
            <div><dt>Baryon number</dt><dd>{thirds(sel.b3)}</dd></div>
            <div><dt>Lepton number</dt><dd>{signed(Lsum)}{#if Lsum !== 0}<small class="lfam"> ({sel.L[0] ? 'Lₑ' : sel.L[1] ? 'L_μ' : 'L_τ'})</small>{/if}</dd></div>
            <div><dt>Strangeness <span class="beyond">beyond</span></dt><dd>{signed(sel.S)}</dd></div>
            <div><dt>Mean lifetime</dt><dd>{lifeText(sel.life)}</dd></div>
            {#if sel.q3 !== 0}<div class="wide"><dt>Charge in coulombs</dt><dd>{sel.q3 > 0 ? '+' : '−'}{sci(Math.abs(sel.q3 / 3) * E)} C</dd></div>{/if}
            {#if sel.mass >= 1e-3}<div class="wide"><dt>Mass in kilograms</dt><dd>{sci(sel.mass * MEVC2)} kg {#if sel.family !== 'quark'}· {short(sel.mass / 938.272, 3)} × proton{/if}</dd></div>{/if}
            {#if sel.force}<div class="wide"><dt>Carries</dt><dd class="txt">{sel.id === 'H' ? 'no force: it is the ripple of the field that gives particles mass' : `the ${sel.force} force`}</dd></div>{/if}
            <div class="wide"><dt>Spin <span class="beyond">beyond</span></dt><dd class="txt">{sel.spin} · {stat}</dd></div>
          </dl>
          {#if sel.quarks}
            <div class="work">
              <b class="gh">From its quarks{sel.mix ? ` (${sel.mix})` : ''}</b>
              <div class="quarkrow">{#each sel.quarks as q, i (i)}<span class="qball" class:aq={q.startsWith('-')}>{qText(q)}</span>{/each}</div>
              <div class="eq">charge: {chargeSum}</div>
              <div class="eq">baryon number: {baryonSum}</div>
            </div>
          {/if}
          <div class="antibox">
            <button type="button" class="btn" onclick={() => pick(partner.id)} disabled={sel.self}>
              {#if sel.self}Its own antiparticle{:else}Antiparticle: <Sym s={partner.sym} size="17px" /> {partner.name}{/if}
            </button>
            {#if !sel.self}<p class="why">Same mass and lifetime; opposite charge ({sel.q3 === 0 ? '0 stays 0' : `${thirds(sel.q3)} → ${thirds(-sel.q3)}`}), baryon number, lepton number{sel.S ? ' and strangeness' : ''}.{sel.quarks ? ' Every quark becomes its antiquark.' : ''}</p>{/if}
          </div>
          {#if sel.decays?.length}
            <div class="work"><b class="gh">Decays</b>{#each sel.decays as d (d)}<div class="eq">{d}</div>{/each}</div>
          {/if}
          <div class="facts pad">
            <b>Key facts</b>
            <ul>{#each sel.facts as f (f)}<li>{f}</li>{/each}</ul>
          </div>
          <p class="found pad2"><b>Discovered:</b> {sel.found}</p>
        </div>
      {/key}
    </section>

    {#if travel && sel.life > 1e-21}
      <section class="panel" aria-label="Time dilation">
        <div class="ph"><h2>How far before it decays?</h2></div>
        <div class="ctls">
          <label class="ctl"><span class="ctl-l">Speed <b>{prefs.beta >= 0.999 ? prefs.beta.toFixed(5).replace(/0+$/, '') : prefs.beta.toFixed(3)}c</b></span>
            <input class="slider" type="range" min="0.3" max="4.3" step="0.01" value={betaSlider} oninput={(e) => setBeta(+e.currentTarget.value)} aria-label="Speed as a fraction of c" /></label>
          <dl class="reads">
            <div><dt>Ignoring relativity</dt><dd>{fmtDist(travel.classic)}</dd></div>
            <div><dt>Really (time dilation)</dt><dd>{fmtDist(travel.dilated)}</dd></div>
            <div class="wide"><dt>Lifetime measured in the lab</dt><dd>{lifeText(travel.life)} ({short(travel.g, 3)} × longer)</dd></div>
          </dl>
          <p class="why">{sel.id === 'mu' || sel.id === 'anti-mu' ? 'Cosmic-ray muons are made about 15 km up. Without time dilation hardly any would reach the ground; at 0.995c they live about 10 times longer in our frame, so many do.' : 'A fast unstable particle lives longer in the lab frame (time dilation), so it travels much further and can reach a detector. You don’t need the equation for the exam, only when it matters: at speeds close to c.'}</p>
        </div>
      </section>
    {/if}
  </aside>

  <section class="panel full builder" aria-label="Quark builder">
    <div class="ph"><h2>Build a hadron from quarks</h2></div>
    <div class="bbody">
      <div class="bleft">
        <div class="slots" aria-label="Your hadron">
          {#each [0, 1, 2] as i (i)}
            {#if prefs.slots[i]}
              <button type="button" class="qball big" class:aq={prefs.slots[i].startsWith('-')} onclick={() => dropQ(i)} aria-label="Remove {qText(prefs.slots[i])}">{qText(prefs.slots[i])}</button>
            {:else}
              <span class="qball big empty">{i === 2 ? '(3rd)' : '+'}</span>
            {/if}
          {/each}
          <button type="button" class="btn" onclick={() => (prefs.slots = [])} disabled={!prefs.slots.length}>Clear</button>
        </div>
        <div class="palette">
          <div class="prow"><small>quarks</small>{#each PALETTE.slice(0, 6) as q (q)}<button type="button" class="qball" onclick={() => addQ(q)} disabled={prefs.slots.length >= 3}>{qText(q)}<i>{thirds(qOf(q))}</i></button>{/each}</div>
          <div class="prow"><small>antiquarks</small>{#each PALETTE.slice(6) as q (q)}<button type="button" class="qball aq" onclick={() => addQ(q)} disabled={prefs.slots.length >= 3}>{qText(q)}<i>{thirds(qOf(q))}</i></button>{/each}</div>
        </div>
        <div class="presets">{#each PRESETS as [n, s] (n)}<button type="button" class="fchip" onclick={() => (prefs.slots = [...s])}>{n}</button>{/each}</div>
      </div>
      <div class="bright">
        <dl class="reads">
          <div><dt>Charge</dt><dd>{built.q3 === 0 ? '0' : `${thirds(built.q3)}e`}</dd></div>
          <div><dt>Baryon number</dt><dd>{thirds(built.b3)}</dd></div>
          <div><dt>Strangeness</dt><dd>{signed(built.S)}</dd></div>
          <div><dt>Type</dt><dd class="txt">{!built.ok ? '—' : prefs.slots.length === 2 ? 'Meson' : built.b3 > 0 ? 'Baryon' : 'Antibaryon'}</dd></div>
        </dl>
        <p class="verdict" class:ok={built.ok}>{built.verdict}</p>
        {#if built.top}
          <p class="why">The top quark decays (in about 5 × 10⁻²⁵ s) before it can bind to anything, so no hadron contains it.</p>
        {:else if built.match}
          <button type="button" class="btn primary made" onclick={() => pick(built.match!.id)}>You made <Sym s={built.match.sym} size="18px" /> {built.match.name} · open its card</button>
        {:else if built.ok}
          <p class="why">A real combination, but not one in this table: there are hundreds of hadrons, many of them short-lived resonances.</p>
        {/if}
      </div>
    </div>
  </section>
</main>
