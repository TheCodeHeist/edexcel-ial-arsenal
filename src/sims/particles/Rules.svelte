<script lang="ts" module>
  export interface RulePrefs { lhs: string[]; rhs: string[]; preset: string; side: 'lhs' | 'rhs'; conv: number; unit: string }
  export const RULES: RulePrefs = { lhs: ['n'], rhs: ['p', 'e', 'anti-nue'], preset: 'beta-', side: 'rhs', conv: 938, unit: 'MeV' };
</script>

<script lang="ts">
  /* Reactions: write a particle equation (or pick a classic one) and the table checks every conservation law, term
     by term, as a candidate should: charge, baryon number, lepton number (and each lepton family), then energy and
     momentum. Below, the energy: how much a decay releases, what an annihilation's photons carry, the threshold to
     make new particles, and a converter for the units the course uses (eV, MeV, GeV, J, MeV/c², kg, u). */
  import Sym from './Sym.svelte';
  import { get, thirds, signed, sci, short, eV, E, C, MEV, MEVC2, U, H, parseNum } from './data';
  import { PRESETS, PALETTE, check, qValue, photon, type Preset } from './rules';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: RulePrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  const preset0 = $derived(PRESETS.find((p) => p.id === prefs.preset));
  const c = $derived(check(prefs.lhs, prefs.rhs, !!preset0?.nucleus && preset0.lhs.join() === prefs.lhs.join() && preset0.rhs.join() === prefs.rhs.join()));
  const preset = $derived<Preset | undefined>(PRESETS.find((p) => p.id === prefs.preset && p.lhs.join() === prefs.lhs.join() && p.rhs.join() === prefs.rhs.join()));
  const Q = $derived(qValue(c));
  $effect(() => { stats = [['Reaction', c.possible ? 'possible' : 'forbidden']]; });

  function choose(p: Preset) { prefs.preset = p.id; prefs.lhs = [...p.lhs]; prefs.rhs = [...p.rhs]; }
  function add(id: string) {
    if (prefs[prefs.side].length >= 4) return;
    prefs[prefs.side] = [...prefs[prefs.side], id];
  }
  function remove(side: 'lhs' | 'rhs', i: number) { prefs[side] = prefs[side].filter((_, k) => k !== i); }
  function swap() { const l = prefs.lhs; prefs.lhs = prefs.rhs; prefs.rhs = l; }
  function clear() { prefs.lhs = []; prefs.rhs = []; prefs.side = 'lhs'; }

  const fmt = (r: { unit: string }, x: number) => (r.unit === 'thirds' ? thirds(x) : signed(x));
  const termList = (ids: string[], r: { key: string; unit: string }) => ids.map((id) => {
    const p = get(id);
    const v = r.key === 'Q' ? p.q3 : r.key === 'B' ? p.b3 : r.key === 'L' ? p.L[0] + p.L[1] + p.L[2] : r.key === 'Le' ? p.L[0] : r.key === 'Lmu' ? p.L[1] : r.key === 'Ltau' ? p.L[2] : p.S;
    return r.unit === 'thirds' ? thirds(v) : signed(v);
  }).join(' ') || '0';
  // only show the lepton-family rows when a lepton is involved
  const leptons = $derived([...prefs.lhs, ...prefs.rhs].some((id) => get(id).family === 'lepton'));
  const shownRows = $derived(c.rows.filter((r) => !['Le', 'Lmu', 'Ltau'].includes(r.key) || (leptons && (r.left !== 0 || r.right !== 0 || !r.ok))));

  const GROUPS = [['decay', 'Decays'], ['collision', 'Collisions'], ['forbidden', 'Which rule breaks?']] as const;

  /* ---------- energy ---------- */
  const annihilation = $derived(prefs.rhs.length === 2 && prefs.rhs.every((id) => id === 'gamma') && prefs.lhs.length === 2);
  const ph = $derived(annihilation ? photon(c.mL / 2) : null);
  const pairPh = $derived(prefs.lhs.length === 1 && prefs.lhs[0] === 'gamma' ? photon(c.mR) : null);

  /* ---------- unit converter ---------- */
  const UNITS: [string, string, number][] = [   // [id, label, size in J (energy) or kg (mass)]
    ['eV', 'eV', E], ['keV', 'keV', E * 1e3], ['MeV', 'MeV', MEV], ['GeV', 'GeV', MEV * 1e3], ['TeV', 'TeV', MEV * 1e6], ['J', 'J', 1],
  ];
  const MUNITS: [string, string, number][] = [['MeVc2', 'MeV/c²', MEVC2], ['GeVc2', 'GeV/c²', MEVC2 * 1e3], ['u', 'u', U], ['kg', 'kg', 1]];
  // what is typed stays as typed (so 1.05 can be entered); presets write both
  let convText = $state(String(RULES.conv));
  let synced = false;
  $effect(() => { if (!synced) { synced = true; convText = String(prefs.conv); } });
  const isMass = $derived(MUNITS.some((u) => u[0] === prefs.unit));
  const baseVal = $derived.by(() => {
    const list = isMass ? MUNITS : UNITS;
    const u = list.find((x) => x[0] === prefs.unit) ?? list[0];
    return prefs.conv * u[2];
  });
  // energy and mass are the same thing measured differently: E = mc²
  const asJ = $derived(isMass ? baseVal * C * C : baseVal);
  const asKg = $derived(isMass ? baseVal : baseVal / (C * C));
  function onConv(s: string) { convText = s; const x = parseNum(s); if (isFinite(x) && x > 0) prefs.conv = x; }
</script>

<main class="layout rules" hidden={off}>
  <section class="panel rbench" aria-label="Reaction workbench">
    <div class="stage-head">
      <div class="label-chip"><small>{preset ? (preset.group === 'forbidden' ? 'Find the broken rule' : preset.group === 'decay' ? 'Decay' : 'Collision') : 'Your reaction'}</small><span>{preset?.name ?? 'Custom'}</span></div>
      <div class="stage-tools">
        <button class="btn" type="button" onclick={swap} disabled={!prefs.lhs.length && !prefs.rhs.length}>Reverse</button>
        <button class="btn" type="button" onclick={clear}>Clear</button>
      </div>
    </div>

    <div class="equation" aria-label="The reaction">
      {#each ['lhs', 'rhs'] as const as side (side)}
        <button type="button" class="eside" class:active={prefs.side === side} onclick={() => (prefs.side = side)} aria-label={side === 'lhs' ? 'Before: add particles here' : 'After: add particles here'}>
          <small>{side === 'lhs' ? 'before' : 'after'}</small>
        </button>
        <div class="terms" class:active={prefs.side === side}>
          {#each prefs[side] as id, i (i + id)}
            {#if i > 0}<span class="plus">+</span>{/if}
            <button type="button" class="tok" onclick={() => remove(side, i)} title="Remove {get(id).name}"><Sym s={get(id).sym} size="26px" /></button>
          {:else}
            <span class="empty">{prefs.side === side ? 'pick particles below' : 'empty'}</span>
          {/each}
        </div>
        {#if side === 'lhs'}<span class="arrow">→</span>{/if}
      {/each}
    </div>

    <div class="rpal" aria-label="Particles">
      <small>Add to <b>{prefs.side === 'lhs' ? 'before' : 'after'}</b>:</small>
      {#each PALETTE as id (id)}
        <button type="button" class="ptok" onclick={() => add(id)} title={get(id).name} disabled={prefs[prefs.side].length >= 4}><Sym s={get(id).sym} size="17px" /></button>
      {/each}
    </div>

    <table class="ctable">
      <thead><tr><th>Quantity</th><th>Before</th><th>After</th><th></th></tr></thead>
      <tbody>
        {#each shownRows as r (r.key)}
          <tr class:bad={!r.ok && !r.soft} class:soft={r.soft}>
            <th scope="row">{r.name}{#if r.beyond}<span class="beyond">beyond</span>{/if}</th>
            <td><span class="terms-s">{termList(prefs.lhs, r)}</span><b>= {fmt(r, r.left)}</b></td>
            <td><span class="terms-s">{termList(prefs.rhs, r)}</span><b>= {fmt(r, r.right)}</b></td>
            <td class="mark">{#if r.ok}<span class="tick">✓</span>{:else if r.soft}<span class="maybe">{Math.abs(r.left - r.right) === 1 ? 'weak only' : '✗'}</span>{:else}<span class="cross">✗</span>{/if}</td>
          </tr>
        {/each}
        <tr class:bad={c.energy === 'forbidden'}>
          <th scope="row">Energy (rest mass)</th>
          <td><b>{short(c.mL, 5)} MeV/c²</b></td>
          <td><b>{short(c.mR, 5)} MeV/c²</b></td>
          <td class="mark">{#if c.energy === 'ok'}<span class="tick">✓</span>{:else if c.energy === 'needs-ke'}<span class="maybe">needs Eₖ</span>{:else if c.energy === 'photon'}<span class="maybe">E ≥ {short(c.mR, 4)} MeV</span>{:else if c.energy === 'nucleus'}<span class="maybe">nucleus</span>{:else}<span class="cross">✗</span>{/if}</td>
        </tr>
        <tr class:bad={c.momentum === 'forbidden'}>
          <th scope="row">Momentum</th>
          <td colspan="2" class="txt">{c.momentum === 'ok' ? 'can be conserved' : c.momentum === 'needs-nucleus' ? 'needs a nucleus nearby to recoil' : 'cannot be conserved'}</td>
          <td class="mark">{#if c.momentum === 'ok'}<span class="tick">✓</span>{:else if c.momentum === 'needs-nucleus'}<span class="maybe">nucleus</span>{:else}<span class="cross">✗</span>{/if}</td>
        </tr>
      </tbody>
    </table>

    {#key prefs.lhs.join() + '>' + prefs.rhs.join()}
      <div class="rverdict swap" class:ok={c.possible}>
        <p class="big">{c.possible ? 'Possible' : 'Not possible'}{#if c.possible && c.force}<span class="force">{c.force[0].toUpperCase() + c.force.slice(1)} interaction <span class="beyond">beyond</span></span>{/if}</p>
        {#each c.why as w (w)}<p>{w}</p>{/each}
        {#if c.possible && c.energy === 'photon'}<p>A photon has no rest mass, but it has energy E = hf: it must bring at least {short(c.mR, 4)} MeV to make the rest mass of the products.</p>{/if}
        {#if c.possible && c.energy === 'nucleus'}<p>The products are {short(c.mR - c.mL, 3)} MeV/c² heavier, so this can only happen inside a nucleus that supplies the energy (the nucleus it leaves is more tightly bound).</p>{/if}
        {#if c.possible && c.energy === 'needs-ke'}<p>The products are heavier than what went in: the colliding particles must bring at least {short(-Q, 4)} MeV of kinetic energy (more in practice, because the products must also share the momentum).</p>{/if}
        {#if preset}<p class="pnote">{preset.note}</p>{/if}
        {#if preset?.quark}<p class="pnote"><b>Quarks:</b> {preset.quark}</p>{/if}
      </div>
    {/key}
  </section>

  <aside class="side">
    <section class="panel" aria-label="Classic reactions">
      <div class="ph"><h2>Classic reactions</h2></div>
      <div class="plist">
        {#each GROUPS as [g, name] (g)}
          <b class="pgh">{name}</b>
          <div class="pchips">
            {#each PRESETS.filter((p) => p.group === g) as p (p.id)}
              <button type="button" class="fchip" aria-pressed={preset?.id === p.id} onclick={() => choose(p)}>{p.name}</button>
            {/each}
          </div>
        {/each}
      </div>
    </section>
    <section class="panel" aria-label="The rules">
      <div class="facts pad">
        <b>Key facts</b>
        <ul>
          <li>In every interaction, charge, baryon number and lepton number are conserved (and energy and momentum).</li>
          <li>Baryons have B = +1, antibaryons −1, mesons and leptons 0. Each quark has B = +⅓, each antiquark −⅓.</li>
          <li>Leptons have L = +1, antileptons −1; hadrons 0. Each family (e, μ, τ) is conserved separately.</li>
          <li>An antiparticle has the same mass, opposite charge, baryon number and lepton number.</li>
          <li>Matter and antimatter are made in pairs (pair production) and destroyed in pairs (annihilation): ΔE = c²Δm.</li>
          <li>A decay can only give products lighter than the parent; making heavier particles needs kinetic energy.</li>
        </ul>
      </div>
    </section>
  </aside>

  <section class="panel full" aria-label="Energy">
    <div class="ph"><h2>Mass and energy: ΔE = c²Δm</h2></div>
    <div class="cols2">
      <div class="work">
        {#if !prefs.lhs.length || !prefs.rhs.length}
          <p class="why">Write a reaction above to see its energy.</p>
        {:else if annihilation && ph}
          <div class="eq">Rest mass before = {short(c.mL, 4)} MeV/c², all of it becomes photon energy.</div>
          <div class="eq">At rest, two photons back to back, each E = {short(c.mL / 2, 4)} MeV = {sci((c.mL / 2) * MEV)} J</div>
          <div class="eq">f = E/h = {sci(ph.f)} Hz,  λ = hc/E = {sci(ph.lam)} m (γ-rays)</div>
          <div class="eq">In kilograms: Δm = {sci(c.mL * MEVC2)} kg → ΔE = c²Δm = (3.00 × 10⁸)² × {sci(c.mL * MEVC2)} = {sci(c.mL * MEV)} J</div>
        {:else if pairPh}
          <div class="eq">The photon must supply the rest energy of the pair: E ≥ {short(c.mR, 4)} MeV = {sci(c.mR * MEV)} J</div>
          <div class="eq">Minimum frequency f = E/h = {sci(pairPh.f)} Hz, maximum wavelength λ = hc/E = {sci(pairPh.lam)} m</div>
          <div class="eq">Any extra energy becomes the kinetic energy of the electron and positron.</div>
        {:else if Q >= 0}
          <div class="eq">Mass lost Δm = {short(c.mL, 5)} − {short(c.mR, 5)} = {short(Q, 4)} MeV/c² = {sci(Q * MEVC2)} kg</div>
          <div class="eq">Energy released ΔE = c²Δm = {short(Q, 4)} MeV = {sci(Q * MEV)} J</div>
          <div class="eq">It becomes the kinetic energy of the products{prefs.rhs.includes('gamma') ? ' and the energy of the photons' : ''}.</div>
        {:else}
          <div class="eq">Mass gained Δm = {short(c.mR, 5)} − {short(c.mL, 5)} = {short(-Q, 4)} MeV/c² = {sci(-Q * MEVC2)} kg</div>
          <div class="eq">Energy needed ΔE = c²Δm = {short(-Q, 4)} MeV = {sci(-Q * MEV)} J{prefs.lhs.length > 1 ? ', from the kinetic energy of the collision' : ''}</div>
        {/if}
        <p class="why">1 eV is the energy an electron gains through a p.d. of 1 V: 1 eV = 1.60 × 10⁻¹⁹ J, 1 MeV = 1.60 × 10⁻¹³ J. Masses are given as energies divided by c²: the proton’s 938 MeV/c² is 1.67 × 10⁻²⁷ kg.</p>
      </div>
      <div class="conv">
        <b class="gh">Unit converter</b>
        <div class="convrow">
          <input class="num wide" type="text" inputmode="decimal" value={convText} oninput={(e) => onConv(e.currentTarget.value)} aria-label="Value" />
          <select class="sel" bind:value={prefs.unit} aria-label="Unit">
            <optgroup label="Energy">{#each UNITS as [id, l] (id)}<option value={id}>{l}</option>{/each}</optgroup>
            <optgroup label="Mass">{#each MUNITS as [id, l] (id)}<option value={id}>{l}</option>{/each}</optgroup>
          </select>
        </div>
        <dl class="reads">
          <div><dt>Joules</dt><dd>{sci(asJ)} J</dd></div>
          <div><dt>Electronvolts</dt><dd>{eV(asJ / E)}</dd></div>
          <div><dt>Mass (E = mc²)</dt><dd>{sci(asKg)} kg</dd></div>
          <div><dt>Mass</dt><dd>{short(asJ / MEV, 4)} MeV/c²</dd></div>
          <div><dt>Atomic mass units</dt><dd>{sci(asKg / U)} u</dd></div>
          <div><dt>Photon of this energy</dt><dd>λ = {sci((H * C) / asJ)} m</dd></div>
        </dl>
        <div class="presets">
          {#each [['electron', 0.511], ['proton', 938.3], ['Higgs', 125200], ['1 u', 931.5]] as [n, v] (n)}
            <button type="button" class="fchip" onclick={() => { prefs.unit = 'MeVc2'; prefs.conv = v as number; convText = String(v); }}>{n}</button>
          {/each}
        </div>
      </div>
    </div>
  </section>
</main>
