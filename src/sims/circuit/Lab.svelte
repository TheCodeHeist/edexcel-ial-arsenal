<script lang="ts">
  /* I–V Lab: two core practicals on the same board.
     #iv   I–V characteristics: pick a component, set the supply, record readings or sweep, compare with the true curve.
     #emf  E.m.f. and internal resistance: a cell of unknown ε and r; vary the load, plot V against I, read ε from the
           intercept and r from the gradient. Readings here carry small random errors, like real meters. */
  import Board, { type Flow } from './Board.svelte';
  import Plot from './Plot.svelte';
  import SubTabs from '../../components/ui/SubTabs.svelte';
  import FilterRow from '../../components/ui/FilterRow.svelte';
  import CopyButton from '../../components/ui/CopyButton.svelte';
  import { DUTS, SUPPLY, ivCircuit, measure, ivCurve, emfCircuit, fit, niceMax, type Dut } from './lab';
  import { solve } from './solve';
  import { meter, num, ohms, sig } from './format';
  import { pick, sleep } from '../../lib/util';

  let { sub = $bindable('iv'), flow, hidden: off = false, onfit }: {
    sub?: 'iv' | 'emf'; flow: Flow; hidden?: boolean; onfit?: (err: number) => void;
  } = $props();

  /* ---------- I–V characteristics ---------- */
  let dut = $state<Dut>('lamp');
  let vs = $state(3), T = $state(20), lux = $state(100);
  let pts = $state<{ x: number; y: number }[]>([]);
  let showCurve = $state(false), sweeping = $state(false);

  const extra = $derived(dut === 'thermistor' ? { T } : dut === 'ldr' ? { lux } : {});
  const ivc = $derived(ivCircuit(dut, vs, extra));
  const m = $derived(measure(ivc));
  const curve = $derived(ivCurve(dut, extra));
  // the current axis fits the curve; a one-sided curve (diode, LED) keeps a short stub on the other side
  const yr = $derived.by((): [number, number] => {
    const lo = Math.min(0, ...curve.map(([, i]) => i)), hi = Math.max(0, ...curve.map(([, i]) => i));
    const top = niceMax(Math.max(hi, 1e-6) * 1.05), bot = niceMax(Math.max(-lo, 1e-6) * 1.05);
    return [-Math.max(bot, top * 0.2), Math.max(top, bot * 0.2)];
  });
  const iMax = $derived(Math.max(-yr[0], yr[1]));
  const mA = $derived(iMax <= 0.1);
  const k = $derived(mA ? 1000 : 1);
  const clean = (x: number) => (Math.abs(x) < 1e-6 ? 0 : x);

  function setDut(d: Dut) { if (sweeping) return; dut = d; pts = []; showCurve = false; }
  function record() { pts.push({ x: clean(m.v), y: clean(m.i) }); }
  async function sweep() {
    if (sweeping) return;
    sweeping = true; pts = [];
    for (let v = -SUPPLY; v <= SUPPLY + 1e-9; v += 1) { vs = v; await sleep(170); if (off) break; record(); }
    sweeping = false;
  }
  const ivText = () => ['V / V\tI / ' + (mA ? 'mA' : 'A'), ...pts.map((p) => `${sig(p.x)}\t${sig(p.y * k)}`)].join('\n');

  /* ---------- e.m.f. and internal resistance ---------- */
  const randCell = () => ({ E: pick([1.5, 3, 4.5, 6, 9]), r: Math.round((0.4 + Math.random() * 2.6) * 10) / 10 });
  let cell = $state(randCell());
  let load = $state(10);
  let epts = $state<{ x: number; y: number }[]>([]);
  let revealed = $state(false);
  const ec = $derived(emfCircuit(cell.E, cell.r, load));
  const es = $derived(solve(ec));
  const eI = $derived(es.parts[ec.parts[2].id].reading ?? 0);
  const eV = $derived(es.parts[ec.parts[3].id].reading ?? 0);
  const line = $derived(fit(epts));
  const noise = () => 1 + (Math.random() + Math.random() + Math.random() - 1.5) * 0.012;
  function erecord() { epts.push({ x: Number(sig(eI * noise())), y: Number(sig(eV * noise())) }); }
  function newCell() { cell = randCell(); epts = []; revealed = false; load = 10; }
  function reveal() {
    revealed = true;
    if (line && epts.length >= 3) onfit?.(Math.abs(line.c - cell.E) / cell.E);
  }
  const eiMax = $derived(niceMax(cell.E / (cell.r + 0.5)));
  const evMax = $derived(niceMax(cell.E * 1.05));
  const emfText = () => ['I / A\tV / V', ...epts.map((p) => `${p.x}\t${p.y}`)].join('\n');
</script>

<div class="labview" hidden={off}>
  <SubTabs label="Experiment" options={[['iv', 'I–V characteristics'], ['emf', 'E.m.f. and internal resistance']]} bind:value={sub} />

  {#if sub === 'iv'}
    {@const D = DUTS[dut]}
    <main class="layout lab">
      <section class="panel stage" aria-label="Test circuit">
        <div class="stage-head">
          <div class="label-chip"><small>Testing</small><span>{D.label}</span></div>
          <div class="stage-tools">
            <button class="btn" type="button" disabled={sweeping} onclick={record}>Record</button>
            <button class="btn primary" type="button" disabled={sweeping} onclick={sweep}>{sweeping ? 'Sweeping…' : 'Sweep −6 V to +6 V'}</button>
          </div>
        </div>
        <div class="lab-pick"><FilterRow label="Part" options={(Object.keys(DUTS) as Dut[]).map((d) => [d, DUTS[d].short] as const)} value={dut} onchange={setDut} /></div>
        <div class="board-box"><Board fit c={ivc} sol={m.s} {flow} label="I–V test circuit for a {D.label}" /></div>
        <div class="lab-ctl">
          <div class="ctl">
            <label class="ctl-l" for="vs"><span>Supply p.d.</span><b>{num(vs, 2)} V{vs < 0 ? ' (reversed)' : ''}</b></label>
            <input id="vs" class="slider" type="range" min={-SUPPLY} max={SUPPLY} step="0.1" value={vs} disabled={sweeping} oninput={(e) => (vs = Number(e.currentTarget.value))} />
          </div>
          {#if dut === 'thermistor'}
            <div class="ctl">
              <label class="ctl-l" for="temp"><span>Temperature (water bath)</span><b>{T} °C</b></label>
              <input id="temp" class="slider" type="range" min="0" max="100" step="5" value={T} disabled={sweeping} oninput={(e) => { T = Number(e.currentTarget.value); pts = []; }} />
            </div>
          {:else if dut === 'ldr'}
            <div class="ctl">
              <label class="ctl-l" for="lux"><span>Light intensity</span><b>{num(lux, 2)} lx</b></label>
              <input id="lux" class="slider" type="range" min="0" max="1000" step="1" value={Math.round(1000 * Math.log10(lux) / 4)} disabled={sweeping}
                oninput={(e) => { lux = Number(Math.pow(10, (4 * Number(e.currentTarget.value)) / 1000).toPrecision(2)); pts = []; }} />
            </div>
          {/if}
        </div>
      </section>

      <section class="panel graph" aria-label="I–V graph">
        <div class="ph"><h2>Current against p.d.</h2><span class="score">{pts.length ? `${pts.length} readings` : ''}</span></div>
        <div class="plot-box">
          <Plot xr={[-SUPPLY, SUPPLY]} yr={[yr[0] * k, yr[1] * k]} xLabel="V / V" yLabel={mA ? 'I / mA' : 'I / A'}
            points={pts.map((p) => ({ x: p.x, y: p.y * k }))} curve={showCurve ? curve.map(([x, y]) => [x, y * k] as [number, number]) : null}
            now={{ x: m.v, y: m.i * k }} label="Graph of current against potential difference for a {D.label}" />
        </div>
        <dl class="reads three">
          <div><dt>V across</dt><dd>{meter(m.v, 'V')}</dd></div>
          <div><dt>I through</dt><dd>{meter(m.i, 'A')}</dd></div>
          <div><dt>R = V / I</dt><dd>{Math.abs(m.i) < 1e-6 ? '—' : ohms(Math.abs(m.v / m.i))}</dd></div>
        </dl>
        <div class="graph-acts">
          <button class="btn" type="button" aria-pressed={showCurve} onclick={() => (showCurve = !showCurve)}>{showCurve ? 'Hide' : 'Show'} the true curve</button>
          <button class="btn" type="button" disabled={!pts.length || sweeping} onclick={() => (pts = [])}>Clear readings</button>
          {#if pts.length}<CopyButton text={ivText} label="Copy the readings as a table" />{/if}
        </div>
        {#key dut}
          <div class="explain swap">
            <p class="look"><b>Shape:</b>&nbsp;{D.shape}</p>
            <p class="why">{D.why}</p>
          </div>
        {/key}
      </section>
    </main>
  {:else}
    <main class="layout lab">
      <section class="panel stage" aria-label="E.m.f. circuit">
        <div class="stage-head">
          <div class="label-chip"><small>Unknown cell</small><span>{revealed ? `ε = ${num(cell.E)} V, r = ${num(cell.r)} Ω` : 'ε and r hidden'}</span></div>
          <div class="stage-tools">
            <button class="btn primary" type="button" onclick={erecord}>Record</button>
            <button class="btn" type="button" onclick={newCell}>New cell</button>
          </div>
        </div>
        <div class="board-box"><Board fit c={ec} sol={es} {flow} mask={revealed ? [] : [ec.parts[0].id]} label="Circuit to measure e.m.f. and internal resistance" /></div>
        <div class="lab-ctl">
          <div class="ctl">
            <label class="ctl-l" for="load"><span>Variable resistor</span><b>{num(load)} Ω</b></label>
            <input id="load" class="slider" type="range" min="0.5" max="30" step="0.5" value={load} oninput={(e) => (load = Number(e.currentTarget.value))} />
          </div>
          <p class="why">Record readings for at least five settings of the variable resistor. Don’t leave the current high for long: the cell warms up and r changes.</p>
        </div>
      </section>

      <section class="panel graph" aria-label="V against I graph">
        <div class="ph"><h2>Terminal p.d. against current</h2><span class="score">{epts.length ? `${epts.length} readings` : ''}</span></div>
        <div class="plot-box">
          <Plot xr={[0, eiMax]} yr={[0, evMax]} xLabel="I / A" yLabel="V / V" points={epts} line={epts.length >= 2 ? line : null}
            now={{ x: eI, y: eV }} label="Graph of terminal potential difference against current" />
        </div>
        <dl class="reads three">
          <div><dt>V (terminal)</dt><dd>{meter(eV, 'V')}</dd></div>
          <div><dt>I</dt><dd>{meter(eI, 'A')}</dd></div>
          <div><dt>Readings</dt><dd>{epts.length}</dd></div>
        </dl>
        {#if line && epts.length >= 2}
          <div class="eq">V = ε − Ir &nbsp;→&nbsp; intercept ε ≈ {sig(line.c)} V, gradient −r ≈ {sig(line.m)} V A⁻¹, so r ≈ {sig(-line.m)} Ω</div>
        {/if}
        <div class="graph-acts">
          <button class="btn" type="button" disabled={epts.length < 3 || revealed} onclick={reveal}>{epts.length < 3 ? 'Record 3+ readings to check' : 'Check against the true values'}</button>
          <button class="btn" type="button" disabled={!epts.length} onclick={() => { epts = []; revealed = false; }}>Clear readings</button>
          {#if epts.length}<CopyButton text={emfText} label="Copy the readings as a table" />{/if}
        </div>
        {#if revealed && line}
          <div class="explain swap">
            <p class="look"><b>True values:</b>&nbsp;ε = {num(cell.E)} V, r = {num(cell.r)} Ω</p>
            <p class="why">Your line gives ε = {sig(line.c)} V ({sig(Math.abs(line.c - cell.E) / cell.E * 100, 2)}% out) and r = {sig(-line.m)} Ω ({sig(Math.abs(-line.m - cell.r) / cell.r * 100, 2)}% out). A wider spread of currents makes the gradient more reliable.</p>
          </div>
        {:else}
          <div class="explain">
            <p class="why">The terminal p.d. is V = ε − Ir. Plotted against I it is a straight line: the y-intercept (I = 0) is the e.m.f. and the gradient is −r.</p>
          </div>
        {/if}
      </section>
    </main>
  {/if}
</div>
