/* The Circuit Builder's live tools for Kernel (see lib/kernel/live.ts). App.svelte hands over the editor and the bits
   of its state the tools need; every change goes through the editor (load, setProp, toggle, clear), so it shows on
   the board, is saved, and can be undone exactly like the student's own edits. The circuit logic is in kernel.ts. */

import type { LiveTool } from '../../lib/kernel/live';
import type { Editor } from './editor.svelte';
import type { Clock } from './transient.svelte';
import type { Example } from './examples';
import type { Solution } from './solve';
import type { CircuitData, Props } from './parts';
import * as K from './kernel';

type Mode = 'build' | 'predict' | 'lab';
type Sub = 'iv' | 'emf' | 'cap';
export interface Host {
  ed: Editor;
  board: CircuitData & { example: string };
  prefs: { adv: boolean; scope: boolean; scopePins: string[] };
  clock: Clock;
  EXAMPLES: Example[];
  sol: () => Solution;          // the board solved now (at this instant of time, if time runs)
  timed: () => boolean;         // is there time on the board (a capacitor, an a.c. supply or the oscilloscope)?
  view: () => { mode: Mode; sub: Sub };
  go: (m: Mode, sub?: Sub) => void;
}

const SETTINGS = {
  value: { type: 'number', description: 'Main setting in SI units: cell/ac e.m.f. in V (0–12; ac = peak); resistor Ω (1–100000); varres Ω (0–100); pot Ω end to end (10–10000); thermistor temperature in °C (−10–100); ldr light intensity in lux (1–10000); capacitor F (0.000001–0.01, e.g. 0.00047 for 470 µF). Not for other types.' },
  internal_resistance: { type: 'number', description: 'Cell only: internal resistance in Ω (0–10). Default 0.' },
  frequency: { type: 'number', description: 'A.c. supply only: frequency in Hz (0.1–20). Default 1.' },
  closed: { type: 'boolean', description: 'Switch only: true = closed (default), false = open.' },
  rating: { type: 'string', enum: ['2.5V', '6V', '12V'], description: 'Lamp only: rating (2.5 V 0.3 A, 6 V 0.5 A, 12 V 0.5 A). Default 6V.' },
  colour: { type: 'string', enum: ['red', 'yellow', 'green', 'blue'], description: 'LED only. Default red.' },
} as const;

const TAB: Record<string, string> = { build: 'Build', predict: 'Predict', iv: 'I–V Lab: I–V characteristics', emf: 'I–V Lab: e.m.f. and internal resistance', cap: 'I–V Lab: capacitor practical' };

export function kernelTools(h: Host): LiveTool[] {
  const { ed, board, prefs, clock } = h;

  function state(): string {
    const v = h.view(), lines: string[] = [];
    lines.push(`Tab on screen: ${TAB[v.mode === 'lab' ? v.sub : v.mode]}${v.mode !== 'build' ? ' (the circuit_ tools work on the Build board; building or editing switches to it)' : ''}.`);
    lines.push(`Syllabus switch: ${prefs.adv ? 'Units 2 & 3 + Unit 4 capacitors' : 'Units 2 & 3 (capacitors hidden)'}.`);
    const ex = h.EXAMPLES.find((e) => e.id === board.example);
    if (ex) lines.push(`Loaded example: ${ex.name} (${ex.id}), not changed since.`);
    if (h.timed()) lines.push(`Time: t = ${clock.t.toFixed(1)} s, ${clock.playing ? 'running' : 'paused'} at ×${clock.speed}. Readings below are at this instant.`);
    const sel = ed.part;
    if (sel) lines.push(`The student has ${sel.name} selected.`);
    lines.push(K.describe(board, h.sol()));
    return lines.join('\n');
  }
  /** Bring the Build board into view and report what is on it now. */
  const show = (what: string) => { h.go('build'); return `${what}\n\n${state()}`; };
  const load = (d: CircuitData) => { if (d.parts.some((p) => p.kind === 'capacitor')) prefs.adv = true; ed.load(d); board.example = ''; };
  const str = (x: unknown) => (x === undefined || x === null ? '' : String(x).trim());

  return [
    {
      name: 'circuit_state',
      description: 'Read the Circuit Builder: which tab is showing, and the Build board: every part (name, type, setting), which node each terminal is wired to, and the live readings (meter readings, p.d., current and power for each part, capacitor charge). Call this before changing a circuit the student made, and to check readings after a change.',
      parameters: { type: 'object', properties: {} },
      run: () => state(),
    },
    {
      name: 'circuit_build',
      description:
        'Replace the Build board with a new circuit, laid out neatly (supply along the bottom, the rest along the top, parallel branches stacked) and shown to the student, who can Undo it. ' +
        'Give the parts in `components` and how they connect in `loop`: one closed loop written as a series of part ids, with parallel groups in brackets and their branches separated by |. ' +
        'Example, a 6 V cell with an ammeter in the main branch and two 10 Ω resistors in parallel, with a voltmeter across R1: ' +
        'components [{"id":"E1","type":"cell","value":6},{"id":"A1","type":"ammeter"},{"id":"R1","type":"resistor","value":10},{"id":"R2","type":"resistor","value":10},{"id":"V1","type":"voltmeter","across":["R1"]}], loop "E1 - A1 - (R1 | R2)". ' +
        'Branches can hold series parts and nest: "E1 - S1 - (R1 - A2 | L1 | (R2 | R3))". Every component appears exactly once: in the loop, or (voltmeters usually) via `across`. ' +
        'Polarity: the loop is read in the direction conventional current leaves the + terminal of the first cell, so cells push current along the loop and diodes/LEDs point along it (forward biased); set reverse: true to flip one. ' +
        'Bridges (not series–parallel, so they need their own shape): bridge(a1; a2; b1; b2; mid) is one item in the loop, entered on the left and left on the right; its top path is a1 then a2 (meeting at point P), its bottom path b1 then b2 (meeting at Q), and mid joins P to Q, read from P to Q. Each of the five can be a series run or "X | Y". ' +
        'Full-wave bridge rectifier with smoothing: components AC1 ac, D1 diode, D2 diode reverse true, D3 diode reverse true, D4 diode, R1 resistor (load), C1 capacitor; loop "AC1 - bridge(D1; D2; D3; D4; R1 | C1)" (P is then the + output). Wheatstone bridge: "E1 - bridge(R1; R2; R3; R4; V1)". ' +
        'Potentiometer and two-way switch circuits cannot be built this way: use circuit_example ("pot" lamp dimmer, "rc" capacitor rig). Returns the new board and its readings.',
      parameters: {
        type: 'object',
        properties: {
          components: {
            type: 'array',
            description: 'The parts. Ids are what the student sees on the board; use the lab\'s style: E1 cell, AC1 a.c. supply, R1 resistor, VR1 variable resistor, L1 lamp, D1 diode, LED1, TH1 thermistor, LDR1, S1 switch, A1 ammeter, V1 voltmeter, C1 capacitor.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Unique short name: a letter then up to 5 letters or digits.' },
                type: { type: 'string', enum: K.BUILD_KINDS, description: 'cell (d.c. cell or battery), ac (a.c. supply), resistor, varres (variable resistor/rheostat), lamp (filament lamp), diode, led, thermistor (NTC), ldr, switch, ammeter, voltmeter, capacitor.' },
                ...SETTINGS,
                reverse: { type: 'boolean', description: 'Turn this part round relative to the loop direction (a cell opposing the others, a reverse-biased diode).' },
                across: { type: 'array', items: { type: 'string' }, description: 'Put this part (usually a voltmeter) in parallel across these part ids instead of in the loop: one id, or several that follow each other in one series run, e.g. ["R1"] or ["R1","R2"]. Across a whole parallel group, add it as another branch in the loop instead.' },
              },
              required: ['id', 'type'],
            },
          },
          loop: { type: 'string', description: 'The circuit as one loop, e.g. "E1 - A1 - (R1 | R2 - L1)". "-" (or a space or comma) joins parts in series; "(X | Y)" puts branches X and Y in parallel; bridge(a1; a2; b1; b2; mid) is a bridge.' },
        },
        required: ['components', 'loop'],
      },
      run: (a) => {
        const comps = (Array.isArray(a.components) ? a.components : []).map((c) => ({ ...(c as K.CompSpec), across: typeof (c as K.CompSpec).across === 'string' ? [(c as K.CompSpec).across as string] : (c as K.CompSpec).across }));
        const d = K.buildCircuit(comps, str(a.loop));
        load(d);
        clock.reset(); // a new circuit starts uncharged at t = 0
        ed.select(null);
        return show(`Built ${d.parts.length} parts on the Build board (the student can press Undo to get the previous board back).`);
      },
    },
    {
      name: 'circuit_edit',
      description:
        'Change the circuit already on the Build board, in place (the student sees it and can Undo). Refer to parts by the names circuit_state shows. Actions: ' +
        '"set": change part\'s settings (value, internal_resistance, frequency, closed, rating, colour, wiper, position), e.g. make R2 20 Ω; ' +
        '"toggle": open/close a switch or flip a two-way switch; ' +
        '"add": add a new part of `type` (optional `name`) either `across` an existing part (in parallel beside it: a voltmeter across a lamp) or `in_series_with` one (put into the wire next to it; "R1.2" picks the side of terminal 2); ' +
        '"remove": take `part` away; join: true puts a plain wire in its place (use for an ammeter or anything in series you want bypassed), otherwise its leftover wires go too and that path is broken; ' +
        '"connect": run a wire from terminal `from` to terminal `to` (terminals are PART.N as circuit_state lists them, e.g. "R1.2", "E1.+", "S1.A"). ' +
        'If there is no clean room on the board for an add or connect, it says so: then rebuild with circuit_build.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['set', 'toggle', 'add', 'remove', 'connect'] },
          part: { type: 'string', description: 'set, toggle, remove: the part\'s name, e.g. "R2".' },
          ...SETTINGS,
          wiper: { type: 'number', description: 'Potentiometer only: slider position, 0 to 1 from terminal 1.' },
          position: { type: 'string', enum: ['A', 'B'], description: 'Two-way switch only: which side it connects to.' },
          type: { type: 'string', enum: K.BUILD_KINDS, description: 'add: the new part\'s type.' },
          name: { type: 'string', description: 'add: name for the new part (optional; the lab numbers it, e.g. V2).' },
          across: { type: 'string', description: 'add: the existing part to put the new one in parallel with.' },
          in_series_with: { type: 'string', description: 'add: the existing part to put the new one in series next to, e.g. "L1" or "L1.2".' },
          reverse: { type: 'boolean', description: 'add: turn the new part round (a new cell or diode in series faces the way current already flows unless reversed).' },
          join: { type: 'boolean', description: 'remove: replace the part with a wire.' },
          from: { type: 'string', description: 'connect: first terminal, e.g. "R1.1".' },
          to: { type: 'string', description: 'connect: second terminal, e.g. "V1.2".' },
        },
        required: ['action'],
      },
      run: (a) => {
        const act = str(a.action).toLowerCase();
        if (act === 'set') {
          const p = K.findPart(board, a.part);
          if (!K.hasSettings(a)) throw new Error('say what to change, e.g. {"action":"set","part":"R2","value":20}.');
          const props = K.settingsToProps(p.kind, a, p.name);
          for (const k of Object.keys(props) as (keyof Props)[]) ed.setProp(p.id, k, props[k]);
          ed.select({ t: 'part', id: p.id });
          return show(`Set ${p.name} to ${K.settingText(p)}.`);
        }
        if (act === 'toggle') {
          const p = K.findPart(board, a.part);
          if (p.kind !== 'switch' && p.kind !== 'switch2') throw new Error(`${p.name} is a ${K.kindLabel(p.kind).toLowerCase()}, not a switch. Use action "set" to change it.`);
          ed.toggle(p.id);
          return show(`${p.name} is now ${K.settingText(p)}.`);
        }
        if (act === 'add') {
          const kind = K.toKind(a.type, 'type');
          if (kind === 'pot' || kind === 'switch2') throw new Error('a potentiometer or two-way switch can\'t be added by a tool; load the "pot" or "rc" example with circuit_example.');
          const name = str(a.name) || undefined, props = K.settingsToProps(kind, a, name ?? 'the new part');
          let r: { c: CircuitData; part: { id: string; name: string } };
          if (str(a.across)) r = K.addAcrossPart(board, K.findPart(board, a.across), kind, props, name, !!a.reverse);
          else if (str(a.in_series_with)) {
            const ref = str(a.in_series_with), target = K.findPart(board, ref);
            r = K.addSeriesPart(board, h.sol(), target, ref.includes('.') ? K.findTerminal(board, ref).t : null, kind, props, name, !!a.reverse);
          } else throw new Error('say where the new part goes: "across": "L1" (in parallel) or "in_series_with": "L1".');
          load(r.c);
          ed.select({ t: 'part', id: r.part.id });
          return show(`Added ${r.part.name} (${K.kindLabel(kind).toLowerCase()}) ${str(a.across) ? 'across ' + str(a.across) : 'in series with ' + str(a.in_series_with)}.`);
        }
        if (act === 'remove') {
          const p = K.findPart(board, a.part);
          load(K.removePart(board, p, !!a.join));
          return show(`Removed ${p.name}${a.join ? ' and put a wire in its place' : ''}.`);
        }
        if (act === 'connect') {
          const A = K.findTerminal(board, a.from), B = K.findTerminal(board, a.to);
          const pt = (x: typeof A) => K.terminalAt(x.part, x.t);
          load(K.connectTerminals(board, pt(A), pt(B)));
          return show(`Wired ${str(a.from)} to ${str(a.to)}.`);
        }
        throw new Error('action must be one of set, toggle, add, remove, connect.');
      },
    },
    {
      name: 'circuit_example',
      description: 'Load one of the lab\'s ready-made circuits onto the Build board: ' + h.EXAMPLES.map((e) => `"${e.id}" ${e.name}`).join(', ') + '. The capacitor rig "rc" charges C through R with its two-way switch S1 at A and discharges it at B.',
      parameters: { type: 'object', properties: { example: { type: 'string', enum: h.EXAMPLES.map((e) => e.id) } }, required: ['example'] },
      run: (a) => {
        const ex = h.EXAMPLES.find((e) => e.id === str(a.example));
        if (!ex) throw new Error(`example must be one of ${h.EXAMPLES.map((e) => e.id).join(', ')}.`);
        if (ex.adv) prefs.adv = true;
        const d = ex.data();
        ed.load(d); board.example = ex.id;
        // as the parts bin does: an example about signals opens the oscilloscope with its probes pinned
        if (ex.pins) { prefs.scope = true; prefs.scopePins = d.parts.filter((p) => ex.pins!.includes(p.name)).map((p) => p.id + (p.kind === 'ammeter' ? ':i' : ':v')); }
        clock.reset();
        return show(`Loaded "${ex.name}": ${ex.note}`);
      },
    },
    {
      name: 'circuit_clear',
      description: 'Clear the Build board (the student can Undo it).',
      parameters: { type: 'object', properties: {} },
      run: () => { ed.clear(); board.example = ''; return show('Cleared the board.'); },
    },
    {
      name: 'circuit_time',
      description: 'Control time on the Build board, which runs when there is a capacitor or an a.c. supply on it: play, pause, discharge every capacitor and reset t to 0, and/or set the speed. wait_seconds (up to 30) waits that long in real time before reporting the readings, e.g. to watch a capacitor discharge (simulated time passes at the chosen speed; the time constant RC is in seconds).',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['play', 'pause', 'discharge_all'] },
          speed: { type: 'number', enum: [0.1, 1, 10], description: 'Simulated seconds per real second.' },
          wait_seconds: { type: 'number', description: 'Real seconds to wait before reading the board (0–30).' },
        },
      },
      run: async (a) => {
        if (!h.timed()) throw new Error('time only runs with a capacitor or an a.c. supply on the board. Build one (or load the "rc" example) first.');
        h.go('build');
        const act = str(a.action);
        if (act === 'play') clock.playing = true;
        else if (act === 'pause') clock.playing = false;
        else if (act === 'discharge_all') clock.reset();
        else if (act) throw new Error('action must be play, pause or discharge_all.');
        if (a.speed !== undefined) {
          const s = Number(a.speed);
          if (![0.1, 1, 10].includes(s)) throw new Error('speed must be 0.1, 1 or 10.');
          clock.speed = s;
        }
        const w = Math.max(0, Math.min(30, Number(a.wait_seconds) || 0));
        if (w) await new Promise((r) => setTimeout(r, w * 1000));
        return show(w ? `Waited ${w} s.` : 'Done.');
      },
    },
    {
      name: 'circuit_view',
      description: 'Switch the Circuit Builder\'s tab: "build" (the board), "predict" (meter-reading questions), "iv" (I–V characteristics practical), "emf" (e.m.f. and internal resistance practical), "capacitor" (capacitor practical). capacitors: true/false sets the syllabus switch that shows capacitors (Unit 4).',
      parameters: {
        type: 'object',
        properties: {
          tab: { type: 'string', enum: ['build', 'predict', 'iv', 'emf', 'capacitor'] },
          capacitors: { type: 'boolean' },
        },
      },
      run: (a) => {
        if (typeof a.capacitors === 'boolean') prefs.adv = a.capacitors;
        const t = str(a.tab);
        if (t === 'iv' || t === 'emf') h.go('lab', t);
        else if (t === 'capacitor') { prefs.adv = true; h.go('lab', 'cap'); }
        else if (t === 'build' || t === 'predict') h.go(t);
        else if (t) throw new Error('tab must be build, predict, iv, emf or capacitor.');
        const v = h.view();
        return `Showing ${TAB[v.mode === 'lab' ? v.sub : v.mode]}; capacitors ${prefs.adv ? 'on' : 'off'}.`;
      },
    },
  ];
}
