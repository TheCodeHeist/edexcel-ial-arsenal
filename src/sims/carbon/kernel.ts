/* Carbon Alchemy for Kernel: the lab's tools. Everything goes through the same code paths as the student's hands —
   items are added to the Lab's transmutation circle, the bench is set, React runs with its animation, products are
   discovered and logged; tests run in the Identify rack — so the AI's actions show on screen and count the way the
   student's would. Name matching and route finding live in kernel-find.ts. Registered by App.svelte while mounted. */

import { tick } from 'svelte';
import { sleep } from '../../lib/util';
import { plain } from '../../lib/chem';
import { provideKernelTools, type LiveTool } from '../../lib/kernel/live';
import { CP, RG, TESTS, LABSET, BENCH0, findRx, makeOpts, testResult, type Bench, type Reaction } from './data';
import type { Carbon, Tab } from './app.svelte';
import { findCompound, findReagent, findTest, planRoute, usable, madeBy, usesOf, benchFor, benchPlain, rxText, stepLine,
  cpLabel, cpName, cpClass, reagentList, reagentText, unhtml, TEMP_IDS, CAT_IDS } from './kernel-find';

const ABOUT = 'Carbon Alchemy (organic synthesis lab) is open. Its carbon_ tools let you see what the student has (carbon_state), '
  + 'run a reaction in the Lab’s transmutation circle (carbon_react), make a target compound step by step by the shortest route (carbon_make), '
  + 'run identification tests in test tubes (carbon_test) and switch modes (carbon_mode) — all on screen, exactly as if the student did it.';

const TABS: Tab[] = ['lab', 'synthesis', 'identify', 'codex'];
const MAX_STEPS = 8;

export function provideCarbonTools(app: Carbon, setTab: (t: Tab) => void): () => void {
  let running = false;
  const C = app.lab;

  /** one thing at a time: the circle and the rack are shared with the student */
  async function exclusive<T>(f: () => Promise<T>): Promise<T> {
    if (running) throw new Error('Carbon Alchemy is still running the last action. Wait for it to finish, then try again.');
    running = true;
    try { return await f(); } finally { running = false; }
  }
  async function idle() { for (let i = 0; i < 100 && C.busy; i++) await sleep(50); }
  async function toLab() { if (app.tab !== 'lab') { setTab('lab'); await tick(); await sleep(250); } }
  const have = () => usable(app.progress.found, app.prefs.free);
  const notYet = (id: string) => {
    const rt = planRoute(id, have());
    return `${cpLabel(id)} isn’t on the student’s bench yet: the Lab starts with a few compounds and the rest are discovered by making them.`
      + (rt ? ` carbon_make can make it in ${rt.length} step${rt.length > 1 ? 's' : ''}.` : LABSET.has(id) ? '' : ' Nothing in this lab can make it from what the student has.');
  };

  /** Put items in the Lab circle with the bench set, press React, wait for the animation, and read the outcome. */
  async function run(items: string[], bench: Bench | null): Promise<{ ok: true; r: Reaction; isNew: boolean } | { ok: false; title: string; text: string }> {
    await idle();
    C.clear();
    if (bench) C.bench = bench;
    for (const [k, it] of items.entries()) { C.add(it, k); await sleep(260); }
    await C.react();   // clears the circle's own auto-react timer; if that already fired, wait for it below
    await idle();
    if (C.result) return { ok: true, r: C.result.r, isNew: !!C.result.extra.isNew };
    const t = C.toast;
    return { ok: false, title: t?.title ?? 'No reaction', text: t ? unhtml(t.html) : 'Nothing happened.' };
  }
  const item = (id: string) => (RG[id] ? 'r:' : 'c:') + id;
  const found = () => `${app.labFound}/${LABSET.size} lab compounds discovered`;

  const tools: LiveTool[] = [
    {
      name: 'carbon_state',
      description: 'What Carbon Alchemy is showing: the mode, what is in the Lab circle and on the bench, the last product, the compounds the student has discovered (the ones carbon_react can use), every reagent card, the identification tests, and the current Synthesis challenge and Identify unknown (the unknown’s identity is never revealed).',
      parameters: { type: 'object', properties: {} },
      run: () => {
        const out: string[] = [`Mode: ${app.tab} (modes: ${TABS.join(', ')}).`];
        const slots = C.slots.filter(Boolean).map((s) => s![0] === 'c' ? cpName(s!.slice(2)) : reagentText(s!.slice(2)));
        out.push(`Lab circle: ${C.result ? `showing the result of ${stepLine(C.result.r)}` : slots.length ? slots.join(' + ') + ' (not yet reacted)' : 'empty'}. Bench: ${benchPlain(C.bench)}.`);
        if (app.lastProduct) out.push(`Last product: ${cpLabel(app.lastProduct)}.`);
        const h = have();
        out.push(`Free play: ${app.prefs.free ? 'on (the whole core set is usable)' : 'off'}. ${found()}; ${app.labRxFound} reactions found.`);
        out.push(`Compounds the student has (usable in carbon_react): ${h.map(cpLabel).join('; ')}.`);
        if (!app.prefs.free) out.push(`${LABSET.size - app.labFound} more lab compounds are still to discover (carbon_make makes any of them from what the student has).`);
        out.push(`Reagent cards: ${reagentList()}.`);
        out.push(`Bench conditions (carbon_react "conditions"): temperature ${TEMP_IDS.join('/')}; catalyst ${CAT_IDS.join('/')}/none; uv; dry.`);
        out.push(`Identification tests: ${TESTS.map((t) => t.n).join('; ')}.`);
        const S = app.syn;
        if (S.target) out.push(`Synthesis challenge: make ${cpName(S.target)} from ${S.start.map(cpName).join(' and ')} (par ${S.par}). ${S.steps.length ? `Student’s route so far: ${S.steps.map(stepLine).join(' ⇒ ')}.` : 'No steps yet.'}${S.won ? ' Solved.' : ''}${S.given ? ' Route shown.' : ''} This is the student’s puzzle: coach with hints, don’t solve it for them.`);
        const I = app.id;
        if (I.cid) out.push(`Identify: unknown ${I.code}${I.solved ? ` (solved: it is ${cpName(I.cid)})` : ''}. Options: ${I.opts.map(cpName).join('; ')}. ${I.log.length ? 'Results so far: ' + [...I.log].reverse().map((l) => `${l.t}: ${l.obs}`).join('; ') + '.' : 'No tests run yet.'}${I.wrong.length ? ` Wrong guesses: ${I.wrong.map(cpName).join(', ')}.` : ''}`);
        return out.join('\n');
      },
    },
    {
      name: 'carbon_react',
      description: 'Run one reaction on screen in the Lab’s transmutation circle, exactly as the student would: the compound and the reagent (or a second compound) go into the circle, the bench conditions are set, React runs with its animation, and any product is discovered and logged. Returns the products, reaction type, mechanism, conditions and equation, or why nothing happened and what that compound does react with. Names are loose: IUPAC or common names, or formulae such as CH3CH2OH; reagents such as "KOH in ethanol", "acidified dichromate, reflux", "steam", "H2/Ni". The compounds must be ones the student has (see carbon_state); use carbon_make for anything else.',
      parameters: {
        type: 'object',
        properties: {
          compound: { type: 'string', description: 'The starting compound, e.g. "bromoethane", "propan-2-ol", "CH3CH2OH".' },
          reagent: { type: 'string', description: 'The reagent card (e.g. "KOH in ethanol", "NaOH(aq)", "acidified dichromate under reflux", "HBr", "LiAlH4"), or a second compound to combine with the first (e.g. "ethanol" with "ethanoic acid").' },
          conditions: {
            type: 'object', description: 'Optional bench settings, for reactions that need them (esterification, Friedel–Crafts, Grignard, coupling, and the plain H2, Br2, H2O and dichromate cards). Left out, any conditions the reaction itself needs are set automatically.',
            properties: {
              temperature: { type: 'string', enum: TEMP_IDS },
              catalyst: { type: 'string', enum: [...CAT_IDS, 'none'] },
              uv: { type: 'boolean' }, dry: { type: 'boolean' },
            },
          },
        },
        required: ['compound', 'reagent'],
      },
      run: (args) => exclusive(async () => {
        const a = findCompound(String(args.compound ?? ''));
        const rq = String(args.reagent ?? '').trim();
        if (!rq) throw new Error('Give a reagent (or a second compound) to react it with. Reagent cards: ' + reagentList());
        let b = findReagent(rq);
        if (!b) {
          try { b = findCompound(rq); } catch (e) { throw new Error(`“${rq}” is neither a reagent card nor a compound in the lab. Reagent cards: ${reagentList()}. (${(e as Error).message})`); }
        }
        const h = have();
        for (const c of [a, b]) if (CP[c] && !h.includes(c)) throw new Error(notYet(c));
        // the bench: as asked, or whatever this reaction needs on top of the current settings
        let bench: Bench | null = null;
        const cond = args.conditions as { temperature?: string; catalyst?: string; uv?: boolean; dry?: boolean } | undefined;
        if (cond && typeof cond === 'object') {
          bench = { ...BENCH0 };
          if (cond.temperature) { if (!TEMP_IDS.includes(cond.temperature as never)) throw new Error(`temperature must be one of ${TEMP_IDS.join(', ')}`); bench.temp = cond.temperature as Bench['temp']; }
          if (cond.catalyst && cond.catalyst !== 'none') { if (!CAT_IDS.includes(cond.catalyst as never)) throw new Error(`catalyst must be one of ${CAT_IDS.join(', ')} or none`); bench.cat = cond.catalyst as Bench['cat']; }
          bench.uv = !!cond.uv; bench.dry = !!cond.dry;
        } else {
          const d = findRx(a, b);
          if (d?.need) bench = benchFor(d, C.bench);
        }
        await toLab();
        const res = await run([item(a), item(b)], bench);
        const what = `${cpName(a)} + ${RG[b] ? reagentText(b) : cpName(b)} (bench: ${benchPlain(C.bench)})`;
        if (res.ok) {
          return `Reacted on screen: ${what}.${res.isNew ? ' New discovery!' : ''}\n${rxText(res.r)}\nThe product${res.r.p.length > 1 ? 's are' : ' is'} now in the student’s compounds (${found()}).`;
        }
        const uses = usesOf(a);
        return `No reaction on screen: ${what}. The lab says — ${res.title}: ${res.text}\n`
          + (uses.length ? `${cpName(a)} does react with: ${uses.join('; ')}.` : `${cpName(a)} has no reactions in this lab.`)
          + (res.title.startsWith('Almost') ? ' Retry with "conditions" set as the lab suggests.' : '');
      }),
    },
    {
      name: 'carbon_make',
      description: 'Make a target compound on screen by the shortest route in the lab’s own reaction table, running each reaction in the Lab circle in turn (with the animation, discoveries and lab notebook, as if the student did it). Starts from a given compound, or from everything the student has. Returns each step with its conditions and type, or what is missing if there is no route.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'The compound to make, e.g. "ethanoic acid", "propan-2-ol", "ethyl ethanoate".' },
          from: { type: 'string', description: 'Optional starting compound, e.g. "ethene". Left out, the route can start from anything the student has.' },
        },
        required: ['target'],
      },
      run: (args) => exclusive(async () => {
        const t = findCompound(String(args.target ?? ''));
        const h = have();
        let start = h;
        if (args.from) {
          const f = findCompound(String(args.from));
          if (!h.includes(f)) throw new Error(notYet(f) + ` (Or leave out "from" to start from what the student has.)`);
          if (f === t) throw new Error(`${cpName(t)} is the starting compound already.`);
          start = [f];
        }
        const rt = planRoute(t, start);
        if (!rt) {
          const alt = args.from ? planRoute(t, h) : null, by = madeBy(t);
          throw new Error(`No route to ${cpLabel(t)} from ${args.from ? cpName(start[0]) + ' alone' : 'the compounds the student has'} in this lab.`
            + (alt ? ` From everything the student has it takes ${alt.length} step${alt.length > 1 ? 's' : ''}: ${alt.map(stepLine).join(' ⇒ ')} (call again without "from").` : '')
            + (by.length ? ` It is made from: ${by.join('; ')}.` : ' Nothing in this lab makes it.'));
        }
        if (rt.length > MAX_STEPS) throw new Error(`The shortest route is ${rt.length} steps; make an intermediate first (it starts ${rt.slice(0, 3).map(stepLine).join(' ⇒ ')}).`);
        await toLab();
        const lines: string[] = [];
        for (const [i, r] of rt.entries()) {
          if (i) await sleep(1100);   // let the student see each product before the next step clears the circle
          const res = await run([item(r.a), item(r.b)], r.need ? benchFor(r, C.bench) : null);
          if (!res.ok || res.r.id !== r.id) {
            lines.push(`${i + 1}. ${stepLine(r)} — did not run: ${res.ok ? 'a different reaction happened (' + stepLine(res.r) + ')' : res.title + ': ' + res.text}`);
            return `Stopped after ${i} of ${rt.length} steps.\n${lines.join('\n')}`;
          }
          lines.push(`${i + 1}. ${stepLine(r)}${res.isNew ? ' — new discovery' : ''}\n   ${r.eq.map(plain).join('; ')}`);
        }
        return `Made ${cpLabel(t)} on screen in ${rt.length} step${rt.length > 1 ? 's' : ''}${args.from ? ' from ' + cpName(start[0]) : ''}:\n${lines.join('\n')}\nThe student now has ${found()}; the final product is showing in the circle.`;
      }),
    },
    {
      name: 'carbon_test',
      description: 'Run an identification test on screen in the Identify test-tube rack and return the observation. Without a compound it tests the student’s current unknown sample (identity stays hidden). With a compound, that compound is put in the rack as a labelled known sample (replacing the current unknown) and tested.',
      parameters: {
        type: 'object',
        properties: {
          test: { type: 'string', description: 'The test, e.g. "Tollens’", "Fehling’s", "2,4-DNPH", "iodoform", "bromine water", "acidified dichromate", "NaHCO3", "PCl5", "AgNO3", "litmus", "smell", or "all".' },
          compound: { type: 'string', description: 'Optional compound to test, e.g. "ethanal". Leave out to test the unknown.' },
        },
        required: ['test'],
      },
      run: (args) => exclusive(async () => {
        const tq = String(args.test ?? '').trim();
        const tids = /^all( tests)?$/i.test(tq) ? TESTS.map((t) => t.id) : [findTest(tq)];
        const I = app.id;
        let known = false, note = '';
        if (args.compound) {
          const c = findCompound(String(args.compound));
          if (!(I.cid === c && !I.solved)) {
            if (I.cid && !I.solved && I.done.length) note = ` (This replaced the student’s unsolved unknown ${I.code}; it was not counted as a miss.)`;
            Object.assign(I, { cid: c, code: cpName(c).charAt(0).toUpperCase() + cpName(c).slice(1), done: [], tries: 0, solved: true, opts: makeOpts(c), wrong: [], log: [], rerun: { t: '', n: 0 } });
            known = true;
          }
        }
        if (app.tab !== 'identify') setTab('identify');
        await tick(); await sleep(200);
        const out: string[] = [];
        for (const tid of tids) {
          app.runTest(tid);
          const T = TESTS.find((t) => t.id === tid)!, r = testResult(I.cid, tid);
          out.push(`${T.n} (${T.proc}) → ${r.obs} [${r.pos ? 'positive' : 'negative'}; positive for ${T.pos}]`);
          await sleep(tids.length > 1 ? 350 : 0);
        }
        await sleep(1900);   // the tube rises in and its colour change / precipitate plays out
        const who = known ? cpLabel(I.cid) + ` (${cpClass(I.cid)})` : `the unknown ${I.code}`;
        return `Tested ${who} on screen:\n${out.join('\n')}${note}`;
      }),
    },
    {
      name: 'carbon_mode',
      description: 'Switch Carbon Alchemy’s mode: lab (react compounds in the circle), synthesis (the student’s make-the-target challenge), identify (test an unknown) or codex (every reaction, test and technique).',
      parameters: { type: 'object', properties: { mode: { type: 'string', enum: TABS } }, required: ['mode'] },
      run: (args) => {
        const m = String(args.mode ?? '') as Tab;
        if (!TABS.includes(m)) throw new Error(`mode must be one of ${TABS.join(', ')}`);
        setTab(m);
        return `Switched to ${m}.`;
      },
    },
  ];
  return provideKernelTools('carbon', ABOUT, tools);
}
