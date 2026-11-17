<script lang="ts">
  /* Identify: run chemical tests on an unknown, then name it from four candidates. */
  import { chem } from '../../lib/chem';
  import { molFormula } from '../../lib/molecule';
  import { CP, CLASSN, TESTS, testResult } from './data';
  import { bottleSVG } from './art';
  import { useCarbon } from './app.svelte';
  import Mol from './Mol.svelte';
  import TestTube from './TestTube.svelte';

  let { hidden = false }: { hidden?: boolean } = $props();
  const app = useCarbon();
  const I = $derived(app.id);
  const C = $derived(I.cid ? CP[I.cid] : null);
  const formula = $derived(C ? molFormula(C.smi) : '');
  // the molecular formula is only a clue when isomers are among the options
  const iso = $derived(I.opts.filter((o) => molFormula(CP[o].smi) === formula).length > 1);
  const positives = $derived(C ? TESTS.filter((t) => testResult(C.id, t.id).pos).map((t) => `${t.n.toLowerCase()} (${testResult(C.id, t.id).obs.toLowerCase()})`) : []);
</script>

<main class="bay3" {hidden}>
  <section class="panel b-left" aria-label="Unknown sample and tests">
    <div class="ph"><h2>The unknown</h2></div>
    <div class="unk2">
      <div>
        <div class="sample">
          <div class="bot">{@html bottleSVG()}</div>
          <div><div class="code">{I.code}</div><div class="clue">{#if iso}Molecular formula<br /><b>{@html chem(formula)}</b>{:else}Formula withheld —<br />let the tests decide{/if}</div></div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
          <button class="btn" type="button" onclick={() => (app.id.done = [])}>Clear rack</button>
          <button class="btn primary" type="button" onclick={() => app.skipUnknown()}>New unknown</button>
        </div>
      </div>
      <div>
        <p class="sec-h"><span>Run a test</span><span>{I.done.length ? `${I.done.length}/${TESTS.length}` : ''}</span></p>
        <div class="testlist">
          {#each TESTS as t (t.id)}
            {@const done = I.done.includes(t.id)}
            <button class="tbtn" class:done type="button" style:--c={t.from} onclick={() => app.runTest(t.id)}>
              <i class="td"></i><span><span class="tn2">{t.n}</span><br /><span class="tf">{@html chem(t.f)}</span></span><span class="tk">{done ? 'DONE' : 'RUN'}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>
  </section>
  <section class="panel stage2" aria-label="Test-tube rack">
    <div class="stage-head"><div class="label-chip">Test-tube rack <small>{I.done.length ? 'Results stay here until you clear the rack' : 'Each test runs on a fresh portion of the sample'}</small></div></div>
    <div class="tray">
      {#each I.done as t (I.cid + t)}
        <!-- a tube mounts only when its test is run (the view stays mounted), so each one animates in -->
        <TestTube cid={I.cid} tid={t} animate replay={I.rerun.t === t ? I.rerun.n : 0} />
      {:else}
        <p class="tray-empty">Pick a test to run. Each one runs on a fresh portion of {I.code}, and the tube stays in the rack.</p>
      {/each}
      <div class="tray-note">Viewed against a white tile, as in the lab</div>
    </div>
  </section>
  <section class="panel nb nb2" aria-label="Name the unknown">
    <div class="ph"><h2>It is…</h2></div>
    <div class="opts2">
      {#each I.opts as id (id)}
        {@const wrong = I.wrong.includes(id)}
        <button class="opt" class:right={I.solved && id === I.cid} class:wrong type="button" disabled={I.solved || wrong} onclick={() => app.guess(id)}>
          <span class="mv"><Mol {id} /></span><span class="on">{CP[id].n}</span>
        </button>
      {/each}
    </div>
    {#if I.solved && C}
      <p class="verdict2"><b>{C.n.charAt(0).toUpperCase() + C.n.slice(1)}</b> — {CLASSN[C.cls].toLowerCase()}. Positive tests: {positives.length ? positives.join('; ') : 'none of these'}.</p>
    {/if}
    <div class="ph"><h2>Observations</h2></div>
    <ol class="log">
      {#each I.log as l, i (l.key)}
        <li class="entry" class:fresh={i === 0}>
          <div class="e-head"><span class="e-r">{l.t}</span><span class="badge {l.pos ? 'f-acid' : 'none'}">{l.pos ? 'Positive' : 'Negative'}</span></div>
          <p class="why" style="color:var(--ink)">{l.obs}</p><p class="why">{@html chem(l.info)}</p>
        </li>
      {:else}
        <p class="empty2">Observations are written down here as you test.</p>
      {/each}
    </ol>
  </section>
</main>
