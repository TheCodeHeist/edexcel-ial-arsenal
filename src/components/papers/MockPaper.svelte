<script lang="ts">
  /* A mock paper made in the browser from a unit's pool of checked past-paper questions (see lib/papers/mock.ts).
     Setup → the paper (timer, questions as printed, no sources or topics to give hints) → marking (each
     question's source and mark scheme, a box for the marks you gave yourself, the total). The link holds the
     options and seed, so it reopens or shares the same mock. */
  import { onMount, untrack } from 'svelte';
  import Seg from '../ui/Seg.svelte';
  import { CROPS_BASE } from '../../lib/papers/crops';
  import { pick, newSeed, toQuery, fromQuery, type MockPool, type MockQuestion, type MockCrop } from '../../lib/papers/mock';

  interface Point { id: string; short: string; text: string; n: number }
  interface Group { title: string; unit: string; points: Point[] }
  interface Unit { code: string; badge: string; title: string; questions: number; paperMarks: number; minutesPerMark: number; mcqShare: number; groups: Group[] }

  let { subject, subjectName, units }: { subject: string; subjectName: string; units: Unit[] } = $props();

  // ---- options
  let unitCode = $state(untrack(() => units[0].code));   // the first unit to start with; the list itself never changes
  let length = $state<'quick' | 'half' | 'full'>('half');
  let mcq = $state(true);
  let chosen = $state<string[]>([]);
  let showTopics = $state(false);
  const unit = $derived(units.find((u) => u.code === unitCode) ?? units[0]);
  const hasMcq = $derived(unit.mcqShare > 0);
  const targets = $derived({ quick: Math.min(20, unit.paperMarks), half: Math.round(unit.paperMarks / 2), full: unit.paperMarks });
  const marks = $derived(targets[length]);

  // ---- the mock
  let phase = $state<'setup' | 'paper' | 'marking'>('setup');
  let loading = $state(false);
  let error = $state('');
  let seed = $state('');
  let questions = $state<MockQuestion[]>([]);
  let poolInfo = $state<MockPool | null>(null);
  let scores = $state<Record<number, number | undefined>>({});
  const pools = new Map<string, MockPool>();

  const total = $derived(questions.reduce((n, q) => n + q.marks, 0));
  const minutes = $derived(poolInfo ? Math.round(total * poolInfo.minutesPerMark) : 0);
  const scored = $derived(questions.reduce((n, _, i) => n + (scores[i] ?? 0), 0));
  const marked = $derived(questions.filter((_, i) => scores[i] !== undefined).length);

  async function load(code: string): Promise<MockPool> {
    if (!pools.has(code)) {
      const r = await fetch(`/papers/${subject}/mock/${code}.json`);
      if (!r.ok) throw new Error(`couldn't load the ${code} questions (${r.status})`);
      pools.set(code, await r.json());
    }
    return pools.get(code)!;
  }

  async function make(withSeed = newSeed(), opts?: { unit: string; marks: number; topics: string[]; mcq: boolean }) {
    loading = true; error = '';
    try {
      const o = opts ?? { unit: unitCode, marks, topics: [...chosen], mcq: hasMcq && mcq };
      const p = await load(o.unit);
      const qs = pick(p, { ...o, seed: withSeed });
      if (!qs.length) { error = 'No checked questions match those topics yet. Pick more topics, or none.'; return; }
      poolInfo = p; questions = qs; seed = withSeed; scores = {};
      history.replaceState(null, '', `?${toQuery({ ...o, seed: withSeed })}`);
      resetTimer();
      phase = 'paper';
      window.scrollTo({ top: 0 });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  function backToSetup() {
    phase = 'setup'; stopTimer();
    history.replaceState(null, '', location.pathname);
  }

  function lengthFor(u: Unit, m: number): 'quick' | 'half' | 'full' {
    return m >= u.paperMarks ? 'full' : m <= Math.min(20, u.paperMarks) ? 'quick' : 'half';
  }

  onMount(() => {
    const o = fromQuery(location.search);
    const u = units.find((x) => x.code === o.unit);
    if (!u) return;
    unitCode = u.code;
    if (o.marks) length = lengthFor(u, o.marks);
    if (o.topics) chosen = o.topics;
    if (o.mcq === false) mcq = false;
    if (o.seed) make(o.seed, { unit: u.code, marks: o.marks ?? targets[length], topics: o.topics ?? [], mcq: o.mcq !== false });
  });

  // ---- timer
  let running = $state(false);
  let elapsed = $state(0);          // ms
  let started = 0;
  let tick: ReturnType<typeof setInterval> | undefined;
  function startTimer() {
    if (running) return;
    running = true; started = Date.now() - elapsed;
    tick = setInterval(() => (elapsed = Date.now() - started), 250);
  }
  function stopTimer() { running = false; clearInterval(tick); }
  function resetTimer() { stopTimer(); elapsed = 0; }
  const left = $derived(minutes * 60000 - elapsed);
  function clock(ms: number) {
    const s = Math.floor(Math.abs(ms) / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(r).padStart(2, '0')}`;
  }

  // ---- display
  const url = (c: MockCrop) => `${CROPS_BASE}/${c.src}`;
  const size = (c: MockCrop) => ({ width: Math.round((c.w * 96) / 150), height: Math.round((c.h * 96) / 150) });
  const sameIntro = (a?: MockCrop[], b?: MockCrop[]) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

  function toggle(id: string) {
    chosen = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
  }
  function pickUnit(code: string) {
    if (code !== unitCode) { unitCode = code; chosen = []; }
  }

  let copied = $state(false);
  async function copyLink() {
    try { await navigator.clipboard.writeText(location.href); copied = true; setTimeout(() => (copied = false), 1600); } catch { /* the address bar has it */ }
  }
  function startMarking() {
    stopTimer(); phase = 'marking';
    requestAnimationFrame(() => document.getElementById('marking')?.scrollIntoView({ behavior: 'smooth' }));
  }
  // ---- PDFs (pdf-lib is loaded only when asked for)
  let pdfBusy = $state('');
  async function pdf(which: 'paper' | 'ms') {
    if (pdfBusy) return;
    pdfBusy = which === 'paper' ? 'Making the paper…' : 'Making the mark scheme…';
    try {
      const m = await import('../../lib/papers/mockPdf');
      const u = units.find((x) => x.code === poolInfo?.unit) ?? unit;
      const names = new Map(u.groups.flatMap((g) => g.points.map((p) => [p.id, p.short] as const)));
      const meta = {
        subjectName, unit: u.code, unitTitle: u.title, unitLabel: /^\d$/.test(u.badge) ? `Unit ${u.badge}` : u.badge,
        minutes, topics: (fromQuery(location.search).topics ?? []).map((id) => names.get(id) ?? id), url: location.href,
        layout: subject === 'maths' ? 'maths' as const : 'science' as const,
      };
      const label = pdfBusy;
      const progress = (d: number, a: number) => (pdfBusy = `${label} ${d}/${a}`);
      const bytes = which === 'paper' ? await m.questionPaper(questions, meta, progress) : await m.markScheme(questions, meta, progress);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
      a.download = `${u.code}-mock-${seed}${which === 'ms' ? '-mark-scheme' : ''}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    } catch (e) {
      error = `Couldn't make the PDF: ${e instanceof Error ? e.message : e}`;
    } finally {
      pdfBusy = '';
    }
  }

  function setScore(i: number, v: string, max: number) {
    const n = Number(v);
    scores[i] = v === '' || Number.isNaN(n) ? undefined : Math.max(0, Math.min(max, Math.round(n)));
  }
</script>

{#if phase === 'setup'}
  <div class="panel mock-setup rise">
    <fieldset>
      <legend>Unit</legend>
      <div class="unit-picks">
        {#each units as u (u.code)}
          <button type="button" class="unit-pick" aria-pressed={u.code === unitCode} onclick={() => pickUnit(u.code)}>
            <span class="n" class:wide={u.badge.length > 1}>{u.badge}</span>
            <span><span class="code">{u.code}</span><b>{u.title}</b><small>{u.questions} questions</small></span>
          </button>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>Length</legend>
      <Seg label="Length" bind:value={length} options={[
        ['quick', `Quick · ${targets.quick} marks`, `${targets.quick}`],
        ['half', `Half paper · ${targets.half} marks`, `${targets.half}`],
        ['full', `Full paper · ${targets.full} marks`, `${targets.full}`],
      ]} />
      <p class="hint">About {Math.round(marks * unit.minutesPerMark)} minutes, at Pearson's pace for {unit.code}.</p>
      {#if hasMcq}
        <label class="check"><input type="checkbox" bind:checked={mcq} /> Include multiple-choice questions</label>
      {/if}
    </fieldset>

    <fieldset>
      <legend>Topics <small>{chosen.length ? `${chosen.length} chosen` : 'any'}</small></legend>
      <p class="hint">Leave them all off for a paper across the whole unit, or pick the ones you're revising: every
        question then tests at least one of them.</p>
      <div class="topic-tools">
        <button type="button" class="btn" onclick={() => (showTopics = !showTopics)} aria-expanded={showTopics}>
          {showTopics ? 'Hide topics' : 'Choose topics'}</button>
        {#if chosen.length}<button type="button" class="btn" onclick={() => (chosen = [])}>Clear</button>{/if}
      </div>
      {#if showTopics}
        <div class="topic-pick">
          {#each unit.groups as g (g.unit + g.title)}
            <div class="tgroup">
              <h4>{g.unit === unit.code ? '' : `${g.unit} · `}{g.title}</h4>
              <div class="tchips">
                {#each g.points as p (p.id)}
                  <button type="button" class="fchip" aria-pressed={chosen.includes(p.id)} title={p.text} onclick={() => toggle(p.id)}>
                    {p.short} <small>{p.n}</small></button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </fieldset>

    <div class="go">
      <button type="button" class="btn primary big" disabled={loading} onclick={() => make()}>{loading ? 'Picking questions…' : 'Make my mock'}</button>
      {#if error}<p class="err" role="alert">{error}</p>{/if}
    </div>
  </div>
{:else}
  <div class="mock-bar panel">
    <div class="what"><b>{poolInfo?.unit} mock</b> · {total} marks · {minutes} min</div>
    <div class="timer" class:over={left < 0} aria-live="off">
      <span class="t">{left < 0 ? '+' : ''}{clock(left)}</span>
      {#if phase === 'paper'}
        {#if running}<button type="button" class="btn" onclick={stopTimer}>Pause</button>
        {:else}<button type="button" class="btn primary" onclick={startTimer}>{elapsed ? 'Resume' : 'Start timer'}</button>{/if}
      {/if}
    </div>
    <div class="acts">
      <button type="button" class="btn" onclick={backToSetup}>Change options</button>
      <button type="button" class="btn" disabled={loading} onclick={() => make()}>New questions</button>
      <button type="button" class="btn" onclick={copyLink}>{copied ? 'Link copied' : 'Copy link'}</button>
      <button type="button" class="btn" onclick={() => print()}>Print</button>
    </div>
    <div class="pdfs">
      <span>For printing:</span>
      <button type="button" class="btn primary" disabled={!!pdfBusy} onclick={() => pdf('paper')}>Question paper (PDF)</button>
      <button type="button" class="btn" disabled={!!pdfBusy} onclick={() => pdf('ms')}>Mark scheme (PDF)</button>
      {#if pdfBusy}<span class="busy" aria-live="polite">{pdfBusy}</span>{/if}
      {#if error}<span class="err" role="alert">{error}</span>{/if}
    </div>
  </div>

  {#if phase === 'paper'}
    <p class="mock-hint">Each question keeps the number printed on its original paper; the paper's name is shown with
      its mark scheme, at the end.</p>
  {/if}
  <ol class="questions mock-qs">
    {#each questions as q, i (q.paper + q.number)}
      <li class="qcard panel">
        <div class="qhead"><h3>Question {i + 1}</h3><span class="marks">{q.marks} mark{q.marks === 1 ? '' : 's'}</span></div>
        {#if q.note}<p class="paper-note"><span class="bang" aria-hidden="true">!</span><span><b>Note</b> {q.note}</span></p>{/if}
        {#each q.stem as c}<img class="crop" src={url(c)} {...size(c)} loading="lazy" decoding="async" alt="" />{/each}
        {#each q.parts as part, j}
          <div class="part">
            {#if part.intro?.length && !sameIntro(part.intro, q.parts[j - 1]?.intro)}
              {#each part.intro as c}<img class="crop" src={url(c)} {...size(c)} loading="lazy" decoding="async" alt="" />{/each}
            {/if}
            {#each part.qp as c}<img class="crop" src={url(c)} {...size(c)} loading="lazy" decoding="async" alt={`Question ${i + 1}, part ${part.label}`} />{/each}
          </div>
        {/each}
      </li>
    {/each}
  </ol>

  {#if phase === 'paper'}
    <div class="mock-end panel">
      <p>Finished, or out of time? Mark it against Pearson's mark schemes.</p>
      <button type="button" class="btn primary big" onclick={startMarking}>Mark my answers</button>
    </div>
  {:else}
    <section id="marking" class="marking">
      <div class="section-h"><div><h2>Mark scheme</h2>
        <p>Each question's own mark scheme, and the paper it came from. Give yourself the marks you'd get.</p></div></div>
      <ol class="questions">
        {#each questions as q, i (q.paper + q.number)}
          <li class="qcard panel">
            <div class="qhead">
              <h3>Question {i + 1}</h3>
              <a class="src" href={`/papers/${subject}/${q.slug}/#q${q.number}`} target="_blank" rel="noopener">{q.source} · Q{q.number}</a>
              <label class="score">
                <input type="number" inputmode="numeric" min="0" max={q.marks} value={scores[i] ?? ''}
                  oninput={(e) => setScore(i, e.currentTarget.value, q.marks)} aria-label={`Marks for question ${i + 1}`} />
                <span>/ {q.marks}</span>
              </label>
            </div>
            {#each q.parts as part}
              <div class="ms-part">
                {#if q.parts.length > 1}<p class="plabel">{part.label}</p>{/if}
                {#if part.kind === 'mcq' && part.answer}<p class="answer">Answer: <b>{part.answer}</b></p>{/if}
                {#each part.ms as c}<img class="crop" src={url(c)} {...size(c)} loading="lazy" decoding="async" alt={`Mark scheme for ${part.label}`} />{/each}
              </div>
            {/each}
            {#if q.msNotes?.length}
              <div class="ms-notes"><p class="ms-cap">Notes for examiners</p>
                {#each q.msNotes as c}<img class="crop" src={url(c)} {...size(c)} loading="lazy" decoding="async" alt="Notes for examiners" />{/each}
              </div>
            {/if}
          </li>
        {/each}
      </ol>
      <div class="mock-total panel" aria-live="polite">
        <b>{scored} / {total}</b>
        <span>{total ? Math.round((100 * scored) / total) : 0}%{marked < questions.length ? ` · ${questions.length - marked} question${questions.length - marked === 1 ? '' : 's'} not marked yet` : ''}</span>
        <span class="spacer"></span>
        <button type="button" class="btn" disabled={loading} onclick={() => make()}>Another mock like this</button>
      </div>
    </section>
  {/if}
{/if}

<style>
  .mock-setup { padding: clamp(16px, 3vw, 26px); display: grid; gap: 18px; border-radius: var(--r-lg); }
  fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
  legend { font: 600 12px/1.3 var(--f-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; padding: 0; }
  legend small { text-transform: none; letter-spacing: 0; margin-left: 6px; color: var(--accent); }
  .hint { margin: 8px 0 0; font-size: 13px; color: var(--muted); max-width: 70ch; }
  .check { display: flex; gap: 8px; align-items: center; margin-top: 10px; font-size: 14px; }
  .unit-picks { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(250px, 100%), 1fr)); gap: 8px; }
  .unit-pick { display: flex; gap: 12px; align-items: center; text-align: left; padding: 10px 12px; border-radius: var(--r-md, 12px);
    border: 1px solid var(--rim); background: var(--raised); color: var(--ink); cursor: pointer; font: inherit; }
  .unit-pick:hover { border-color: var(--accent); }
  .unit-pick[aria-pressed='true'] { border-color: var(--accent); background: var(--accent-soft); }
  .unit-pick .n { flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center;
    font: 700 16px/1 var(--f-display); color: var(--hue); background: color-mix(in srgb, var(--hue) 13%, transparent); }
  .unit-pick .n.wide { font-size: 12px; }
  .unit-pick .code { display: block; font: 600 10.5px/1.3 var(--f-mono); letter-spacing: .08em; color: var(--muted); }
  .unit-pick b { display: block; font-size: 13.5px; line-height: 1.25; }
  .unit-pick small { color: var(--muted); font-size: 12px; }
  .topic-tools { display: flex; gap: 8px; margin-top: 10px; }
  .topic-pick { margin-top: 12px; display: grid; gap: 12px; max-height: 60vh; overflow: auto; padding-right: 4px; }
  .tgroup h4 { margin: 0 0 6px; font: 600 12px/1.3 var(--f-mono); color: var(--muted); }
  .tchips { display: flex; flex-wrap: wrap; gap: 6px; }
  .tchips .fchip { font-size: 12.5px; font-weight: 600; }
  .tchips small { opacity: .6; margin-left: 2px; font-weight: 500; }
  .go { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
  .err { margin: 0; color: var(--redox, #c92a2a); font-size: 14px; }

  .mock-bar { position: sticky; top: 8px; z-index: 5; display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center;
    padding: 10px 14px; margin-bottom: 14px; border-radius: var(--r-lg);
    background: color-mix(in srgb, var(--solid) 94%, transparent); backdrop-filter: blur(12px); }
  @media (max-width: 640px) { .mock-bar { position: static; } .acts { margin-left: 0; } }
  .pdfs { flex-basis: 100%; display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center; font-size: 13px; color: var(--muted);
    border-top: 1px dashed var(--line); padding-top: 8px; }
  .pdfs .busy { font: 600 12px/1 var(--f-mono); color: var(--accent); }
  .mock-hint { margin: -4px 0 12px; font-size: 13px; color: var(--muted); }
  .mock-bar .what { font-size: 14px; }
  .timer { display: flex; gap: 8px; align-items: center; }
  .timer .t { font: 700 20px/1 var(--f-mono); font-variant-numeric: tabular-nums; min-width: 4.5ch; }
  .timer.over .t { color: var(--redox, #c92a2a); }
  .acts { display: flex; flex-wrap: wrap; gap: 6px; margin-left: auto; }
  .mock-end { margin-top: 14px; padding: 16px 18px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; border-radius: var(--r-lg); }
  .mock-end p { margin: 0; }
  .marking { margin-top: 26px; }
  .qhead .src { font: 600 12px/1 var(--f-mono); color: var(--accent); text-decoration: none; }
  .qhead .src:hover { text-decoration: underline; }
  .score { margin-left: auto; display: flex; gap: 6px; align-items: center; font: 600 13px/1 var(--f-mono); color: var(--muted); }
  .score input { width: 4.2em; padding: 5px 6px; border-radius: var(--r-sm); border: 1px solid var(--rim); background: var(--raised); color: var(--ink); font: inherit; text-align: right; }
  .plabel { margin: 10px 0 4px; font: 600 12px/1 var(--f-mono); color: var(--muted); }
  .mock-total { margin-top: 14px; padding: 14px 18px; display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; border-radius: var(--r-lg); }
  .mock-total b { font: 700 24px/1 var(--f-mono); }
  .mock-total .spacer { flex: 1; }

  @media print {
    .mock-bar, .mock-end, .mock-total .btn { display: none !important; }
  }
</style>
