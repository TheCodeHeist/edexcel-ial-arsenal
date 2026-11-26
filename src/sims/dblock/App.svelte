<script lang="ts">
  /* d-Block Colour Bench. Four modes (Explore, Predict, Unknown ion, Colour atlas) with hash routes:
     #explore #predict #unknown #atlas, and #reactions / #flowchart for the atlas reaction views. */
  import { onMount, tick } from 'svelte';
  import { persisted } from '../../lib/persist.svelte';
  import { glint, fadeIn } from '../../lib/motion';
  import { RM } from '../../lib/util';
  import SimHeader from '../../components/ui/SimHeader.svelte';
  import StatusLine from '../../components/ui/StatusLine.svelte';
  import Bench from './Bench.svelte';
  import Atlas from './Atlas.svelte';
  import { Bench as BenchState, type Mode, type Score } from './bench.svelte';
  import { SP, T, SHELF, TY, rxAmt, type Transition } from './data';
  import { plain } from '../../lib/chem';
  import { provideKernelTools } from '../../lib/kernel/live';
  import { matchSpecies, matchStock, matchReagent, matchAmount, findRoute, moveText, speciesText, spLabel, nextFrom, stockList, reagentList } from './kernel';

  const score = persisted<Score>('dblock-score', { pRight: 0, pTotal: 0, streak: 0, best: 0, uSolved: 0, uTotal: 0, aRight: 0, aTotal: 0 });
  score.streak = 0; // a streak never carries over between visits
  const bench = new BenchState(score);

  let sub = $state<'species' | 'reactions'>('species');
  let layout = $state<'cards' | 'flow'>('cards');
  let quiz = $state(false);
  let benchEl = $state<HTMLElement>(), atlasEl = $state<HTMLElement>();

  const TABS = [['explore', 'Explore'], ['predict', 'Predict'], ['unknown', 'Unknown ion', 'Unknown'], ['atlas', 'Colour atlas', 'Atlas']] as const;
  const INFO: Record<Mode, [string, string]> = {
    explore: ['Explore', 'Pick a stock solution, add reagents and watch the tube.'],
    predict: ['Predict', 'Choose what you will see before each reaction runs.'],
    unknown: ['Unknown ion', 'Test the mystery solution, then name the metal ion.'],
    atlas: ['Colour atlas', 'Every species and reaction on the specification.'],
  };

  const stats = $derived.by((): [string, string | number][] => {
    switch (bench.mode) {
      case 'predict': return [['Correct', `${score.pRight}/${score.pTotal}`], ['Streak', score.streak], ['Best', score.best]];
      case 'unknown': return [['Solved', `${score.uSolved}/${score.uTotal}`], ['Wrong guesses', bench.unkTries]];
      case 'atlas': return quiz ? [['Self-test', `${score.aRight}/${score.aTotal}`]] : [['Species', Object.keys(SP).length], ['Reactions', T.length]];
      default: return [['Notebook', bench.entries.length], ['Stock solutions', SHELF.length]];
    }
  });

  function setMode(m: Mode) {
    const prev = bench.mode;
    if (bench.busy && m !== prev) return;
    bench.cancelAsk();
    bench.mode = m;
    if ((prev === 'atlas') !== (m === 'atlas')) tick().then(() => fadeIn(m === 'atlas' ? atlasEl : benchEl));
    if (m === 'unknown' && (prev !== 'unknown' || !bench.unknown)) bench.newUnknown();
    else if (m !== 'atlas' && prev === 'unknown') bench.fresh(bench.start);
  }

  /* routing: the hash names the mode, or the atlas reaction view */
  const hashFor = () => (bench.mode === 'atlas' && sub === 'reactions' ? (layout === 'flow' ? 'flowchart' : 'reactions') : bench.mode);
  function fromHash() {
    const h = location.hash.slice(1);
    if (h === 'flowchart' || h === 'reactions') { sub = 'reactions'; layout = h === 'flowchart' ? 'flow' : 'cards'; setMode('atlas'); }
    else if (h === 'atlas') { sub = 'species'; setMode('atlas'); }
    else setMode((['explore', 'predict', 'unknown'] as const).find((m) => m === h) ?? 'explore');
  }
  fromHash(); // read the starting route before the effect below starts writing it
  $effect(() => { const h = '#' + hashFor(); if (location.hash !== h) history.replaceState(null, '', h); });

  function run(t: Transition) {
    if (bench.busy) return;
    setMode('explore');
    setTimeout(() => {
      bench.tube?.resize(); bench.fresh(t.f); bench.act(t.r, rxAmt(t));
      scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' });
    }, 60);
  }

  /* ---------- Kernel: the same actions the buttons take, so the tube animates on screen ---------- */
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  async function idle() {
    for (let i = 0; bench.busy && i < 400; i++) await wait(50);
    if (bench.busy) throw new Error('The bench is still busy with the last addition; try again in a moment.');
  }
  /** Show the bench (Explore, or stay on the unknown when asked to), as the atlas's "Run on the bench" does. */
  async function toBench(keepUnknown: boolean): Promise<string> {
    await idle(); bench.cancelAsk();
    const want: Mode = keepUnknown && bench.mode === 'unknown' ? 'unknown' : 'explore', prev = bench.mode;
    if (prev === want) return '';
    setMode(want); await tick(); await wait(60); bench.tube?.resize();
    if (prev === 'atlas') scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' });
    return `(Switched from ${INFO[prev][0]} to ${INFO[want][0]} so the student sees the tube.) `;
  }
  const stockName = (sp: string) => SHELF.find((s) => s[0] === sp)?.[2] || SP[sp].n;
  /** The notebook entries from index `from` on, as text; in the unknown-ion game only what can be seen. */
  function observe(from: number): string {
    const H = bench.hidden;
    return bench.entries.slice(from).map((e, i) => {
      const n = `${from + i + 1}. `, S = SP[e.sp];
      if (e.kind === 'start') return n + (H ? `Fresh tube of the unknown solution: ${S.look}.` : `Fresh tube of ${stockName(e.sp)} solution: ${speciesText(S)}.`);
      if (e.kind === 'none') return n + `+ ${moveText(e)}: no visible change. ${e.msg}`;
      const head = e.of > 1 && e.step > 0 ? '…then, as more is added' : `+ ${moveText(e)}`;
      return n + (H ? `${head}: ${S.look}.` : `${head}: ${S.look}. Now ${plain(S.f)} (${S.n}). ${TY[e.t.ty].l}: ${plain(e.t.eq)}. ${e.t.why}`);
    }).join('\n');
  }
  function tubeNow(): string {
    const S = SP[bench.cur];
    if (bench.hidden) return `In the tube: the unknown sample, ${S.look}. Its identity is hidden: the student is identifying it, so do not name the ion.`;
    return `In the tube: ${speciesText(S)}.`;
  }
  async function addOne(reagent: unknown, amount: unknown): Promise<string> {
    const r = matchReagent(String(reagent ?? '')), amt = matchAmount(r, amount);
    const note = await toBench(true), n = bench.entries.length;
    await bench.act(r, amt);
    if (bench.entries.length === n) throw new Error('The bench did not take the addition (it was busy); try again.');
    return note + observe(n);
  }

  const KERNEL_ABOUT = 'The d-Block Colour Bench is open: one test tube on a white tile, a shelf of transition-metal stock solutions and a rack of reagents (NaOH and NH₃ as a few drops or in excess, dilute acid, conc. HCl, water, zinc + acid, H₂O₂, acidified manganate(VII), KI, KSCN, air). '
    + 'Its dblock_ tools fill a fresh tube, add reagents and make a named complex step by step on screen, returning what the student sees, the equation and why; dblock_state says what is in the tube.';
  const kernelTools = () => provideKernelTools('dblock', KERNEL_ABOUT, [
    {
      name: 'dblock_state',
      description: 'What is on the d-Block Colour Bench now: the mode, what is in the test tube (formula, name, colour), the lab notebook so far, what each rack reagent would do next, and the stock solutions and reagents available.',
      parameters: { type: 'object', properties: {} },
      run: () => {
        const lines = [`Mode: ${INFO[bench.mode][0]}: ${INFO[bench.mode][1]}${bench.busy ? ' (a reaction is running)' : ''}`, tubeNow()];
        if (bench.mode === 'unknown') lines.push(bench.revealed ? 'The student has identified the unknown.' : `Unknown not yet identified; wrong guesses so far: ${bench.wrongIds.map((id) => plain(SP[id].f)).join(', ') || 'none'}.`);
        if (bench.mode === 'predict') lines.push(`Predict score ${score.pRight}/${score.pTotal}, streak ${score.streak}.`);
        if (bench.mode === 'atlas') lines.push(`Atlas showing ${sub === 'species' ? 'species' : layout === 'flow' ? 'reaction flowcharts' : 'reaction cards'}; self-test ${quiz ? 'on' : 'off'}.`);
        lines.push('Lab notebook:\n' + (observe(0) || '(empty)'));
        if (!bench.hidden) lines.push('Next additions from here:\n' + (nextFrom(bench.cur).join('\n') || 'nothing on the rack changes it'));
        lines.push(stockList(), reagentList() + ' Amounts: NaOH and NH3 take "few" (a few drops / dropwise) or "excess"; the others are one addition (zinc keeps reducing while you wait).');
        return lines.join('\n');
      },
    },
    {
      name: 'dblock_new_tube',
      description: 'Take a fresh test tube of a stock solution (clears the tube and notebook) and show it on the bench. Leaves Predict, Unknown ion or the atlas for Explore.',
      parameters: { type: 'object', properties: { stock: { type: 'string', description: 'Stock solution by ion, formula or bottle name, e.g. "Cu2+", "copper(II) sulfate", "iron(II)", "dichromate", "VO2+".' } }, required: ['stock'] },
      run: async (a) => {
        const id = matchStock(String(a.stock ?? ''));
        const note = await toBench(false);
        bench.pickStock(id);
        return note + observe(0) + '\nNext additions from here:\n' + nextFrom(id).join('\n');
      },
    },
    {
      name: 'dblock_add',
      description: 'Add a reagent to the tube on screen, exactly as the student would with the rack buttons, and wait for the animation. Returns what is seen (colour, precipitate), the species formed, the reaction type, equation and why. "Dropwise then in excess" is two calls: amount "few", then "excess". In the unknown-ion game it tests the unknown and returns only what is seen.',
      parameters: { type: 'object', properties: {
        reagent: { type: 'string', description: 'naoh, nh3, h2so4 (dilute acid), hcl (concentrated), water, zn (zinc + acid), h2o2, kmno4 (acidified manganate(VII)), ki, kscn, air (shake, leave to stand); names and formulae work too.' },
        amount: { type: 'string', enum: ['few', 'excess'], description: 'Only for NaOH and NH3: "few" (a few drops, dropwise; the default) or "excess". Ignored for other reagents.' },
        stock: { type: 'string', description: 'Optional: first take a fresh tube of this stock solution (as dblock_new_tube).' },
      }, required: ['reagent'] },
      run: async (a) => {
        let pre = '';
        if (a.stock) { const id = matchStock(String(a.stock)); pre = await toBench(false); bench.pickStock(id); pre += observe(0) + '\n'; }
        return pre + (await addOne(a.reagent, a.amount)) + '\n' + tubeNow();
      },
    },
    {
      name: 'dblock_make',
      description: 'Make a target species on screen: finds the shortest route in the lab (a stock solution, then rack additions) from its own reaction data, carrying on from the tube if it is already on the way, and performs each step with animation. Returns every observation and equation.',
      parameters: { type: 'object', properties: { target: { type: 'string', description: 'Formula or name, e.g. "[CuCl4]2-", "tetrachlorocuprate", "Cr(OH)3", "chromate(VI)", "[Co(NH3)6]3+", "V3+".' } }, required: ['target'] },
      run: async (a) => {
        const target = matchSpecies(String(a.target ?? ''));
        const note = await toBench(false);
        const route = findRoute(target, bench.cur);
        if (!route) throw new Error(`${spLabel(target)} cannot be made on this bench. What can be done from here:\n${nextFrom(bench.cur).join('\n')}`);
        const out = [note + `Route to ${spLabel(target)}: ${route.start === bench.cur && bench.entries.length ? 'carry on from the tube' : 'fresh ' + stockName(route.start)}${route.moves.map((m) => ' → ' + moveText(m)).join('')}.`];
        if (route.start !== bench.cur || !bench.entries.length) { bench.pickStock(route.start); out.push(observe(0)); }
        if (!route.moves.length && route.start === bench.cur) out.push(`${spLabel(target)} is already in the tube.`);
        for (const m of route.moves) out.push(await addOne(m.r, m.amt === 'xs' ? 'excess' : 'few'));
        if (route.passes) out.push(`Note: ${spLabel(target)} only appears part-way through the last addition (the bench cannot stop it there); the tube has moved on.`);
        out.push(tubeNow());
        return out.join('\n');
      },
    },
    {
      name: 'dblock_reset',
      description: 'Fresh tube of the same stock solution (or a fresh sample of the unknown in the unknown-ion game): clears the tube and the notebook.',
      parameters: { type: 'object', properties: {} },
      run: async () => {
        const note = await toBench(true);
        bench.fresh(bench.mode === 'unknown' && bench.unknown ? bench.unknown : bench.start);
        return note + observe(0);
      },
    },
    {
      name: 'dblock_mode',
      description: 'Switch the lab tab: explore (free bench), predict (student predicts before each reaction runs), unknown (a new mystery ion for the student to identify), atlas (colour atlas of every species and reaction).',
      parameters: { type: 'object', properties: {
        mode: { type: 'string', enum: ['explore', 'predict', 'unknown', 'atlas'] },
        atlas_view: { type: 'string', enum: ['species', 'reactions', 'flowchart'], description: 'Only for atlas.' },
      }, required: ['mode'] },
      run: async (a) => {
        const m = String(a.mode ?? '').toLowerCase() as Mode;
        if (!(m in INFO)) throw new Error('mode must be one of explore, predict, unknown, atlas.');
        await idle(); bench.cancelAsk();
        if (m === 'atlas') {
          const v = String(a.atlas_view ?? 'species');
          if (!['species', 'reactions', 'flowchart'].includes(v)) throw new Error('atlas_view must be species, reactions or flowchart.');
          sub = v === 'species' ? 'species' : 'reactions'; if (v !== 'species') layout = v === 'flowchart' ? 'flow' : 'cards';
        }
        setMode(m);
        return `Now showing ${INFO[m][0]}: ${INFO[m][1]}` + (m === 'unknown' ? ' A new unknown is in the tube; let the student test and name it, and do not reveal it.' : '');
      },
    },
  ]);

  onMount(() => {
    if (bench.mode !== 'unknown') bench.fresh('Cu2');
    addEventListener('hashchange', fromHash);
    glint('.at,.rx,.reagent,.bottle,.flow,.tp-row');
    const unprovide = kernelTools();
    return () => { removeEventListener('hashchange', fromHash); unprovide(); };
  });
</script>

<SimHeader title="d-Block Colour Bench" eyebrow="Edexcel IAL Chemistry · Units 5 & 6 · Transition metals"
  back={{ href: '/chemistry/', label: 'Arsenal' }} tabs={TABS} value={bench.mode} onselect={setMode} />
<StatusLine label={INFO[bench.mode][0]} hint={INFO[bench.mode][1]} {stats} />

<div bind:this={benchEl}><Bench {bench} hidden={bench.mode === 'atlas'} /></div>
<div bind:this={atlasEl}><Atlas {score} bind:sub bind:layout bind:quiz onrun={run} hidden={bench.mode !== 'atlas'} /></div>
