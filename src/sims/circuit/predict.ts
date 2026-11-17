/* Predict: generated circuit questions with four options. Numeric answers use the ideal-meter formulas (the board,
   once revealed, agrees to the meters' precision); the qualitative ones compare two solver runs; the wrong options are the mistakes students actually make: forgetting
   internal resistance, adding parallel resistors like series ones, using the wrong resistor in a potential
   divider, and so on. Each question carries the working that the reveal shows. */

import { build, rcRig } from './examples';
import { solve } from './solve';
import { num, si, ohms } from './format';
import { pick, shuffle } from '../../lib/util';
import type { CircuitData, Kind } from './parts';

export interface Question {
  type: string;
  c: CircuitData;
  ask: string;           // id of the part the question is about (ringed on the board)
  hide: string[];        // meters whose readings stay hidden until answered
  prompt: string;
  options: string[];
  answer: string;
  working: string[];     // lines of working, plain text
  why: string;           // one sentence: the physics behind it
  vc?: Record<string, number>;  // capacitor p.d.s the board shows (capacitor questions)
}

const EMF = [3, 4.5, 6, 9, 12];
const RS = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 24, 30, 40];
const RINT = [0.5, 1, 1.5, 2];

const f = (x: number, u: string) => `${num(x)} ${u}`;
const idOf = (c: CircuitData, name: string) => c.parts.find((p) => p.name === name)!.id;
const read = (c: CircuitData, name: string) => solve(c).parts[idOf(c, name)].reading ?? 0;
const meters = (c: CircuitData) => c.parts.filter((p) => p.kind === 'ammeter' || p.kind === 'voltmeter').map((p) => p.id);

/** Four distinct options: the answer plus wrong values (deduplicated, topped up with ×2 and ÷2 slips). */
function options(ans: number, wrong: number[], u: string, fmt = f): { options: string[]; answer: string } {
  const answer = fmt(ans, u);
  const set = new Set([answer]);
  for (const w of [...wrong, ans * 2, ans / 2, ans * 3, ans / 3]) {
    if (set.size >= 4) break;
    if (isFinite(w) && w > 0) set.add(fmt(w, u));
  }
  return { options: shuffle([...set]), answer };
}

/* ---------- question types ---------- */

function series(): Question {
  const E = pick(EMF), [R1, R2] = shuffle(RS.slice()).slice(0, 2), r = Math.random() < 0.5 ? pick(RINT) : 0;
  const c = build(
    [['cell', 9, 10, 0, { emf: E, r }], ['resistor', 7, 3, 0, { R: R1 }], ['resistor', 13, 3, 0, { R: R2 }], ['ammeter', 17, 6, 1], ['voltmeter', 13, 1]],
    [[[3, 3], [6, 3]], [[8, 3], [12, 3]], [[14, 3], [17, 3], [17, 5]], [[17, 7], [17, 10], [10, 10]], [[8, 10], [3, 10], [3, 3]], [[12, 1], [12, 3]], [[14, 1], [14, 3]]],
  );
  const Rt = R1 + R2 + r, I = E / Rt;
  const rTxt = r ? ` + ${num(r)}` : '';
  if (Math.random() < 0.5) {
    const ans = I;
    return {
      type: 'series', c, ask: idOf(c, 'A1'), hide: meters(c),
      prompt: `What does ammeter A1 read?`,
      ...options(ans, [r ? E / (R1 + R2) : E / R1, E / R2, E / R1 + E / R2], 'A'),
      working: [`Total resistance = ${num(R1)} + ${num(R2)}${rTxt} = ${num(Rt)} Ω`, `I = ε / R = ${num(E)} / ${num(Rt)} = ${num(I)} A`],
      why: `In series the resistances add${r ? ', including the internal resistance of the cell' : ''}, and the same current flows everywhere.`,
    };
  }
  const ans = I * R2;
  return {
    type: 'series', c, ask: idOf(c, 'V1'), hide: meters(c),
    prompt: `What does voltmeter V1 read?`,
    ...options(ans, [r ? (E * R2) / (R1 + R2) : (E * R1) / (R1 + R2), E, E - (E * R2) / Rt], 'V'),
    working: [`I = ${num(E)} / (${num(R1)} + ${num(R2)}${rTxt}) = ${num(I)} A`, `V = IR = ${num(I)} × ${num(R2)} = ${num(I * R2)} V`],
    why: 'The p.d. divides between series resistors in proportion to their resistances.',
  };
}

function parallel(): Question {
  const E = pick(EMF), [R1, R2] = shuffle(RS.slice()).slice(0, 2);
  const c = build(
    [['cell', 8, 10, 0, { emf: E }], ['ammeter', 13, 10], ['resistor', 8, 3, 0, { R: R1 }], ['ammeter', 13, 3], ['resistor', 8, 6, 0, { R: R2 }], ['ammeter', 13, 6]],
    [[[7, 10], [3, 10], [3, 3], [7, 3]], [[9, 3], [12, 3]], [[14, 3], [17, 3], [17, 10], [14, 10]], [[3, 6], [7, 6]], [[9, 6], [12, 6]], [[14, 6], [17, 6]], [[12, 10], [9, 10]]],
  );
  const I1 = E / R1, I2 = E / R2, Rp = 1 / (1 / R1 + 1 / R2);
  if (Math.random() < 0.6) {
    const ans = I1 + I2;
    return {
      type: 'parallel', c, ask: idOf(c, 'A1'), hide: meters(c),
      prompt: 'What does ammeter A1 read?',
      ...options(ans, [E / (R1 + R2), I1, I2], 'A'),
      working: [`I₂ = ${num(E)} / ${num(R1)} = ${num(I1)} A,  I₃ = ${num(E)} / ${num(R2)} = ${num(I2)} A`, `A1 = I₂ + I₃ = ${num(I1 + I2)} A`,
        `(or 1/R = 1/${num(R1)} + 1/${num(R2)}, so R = ${num(Rp)} Ω and I = ${num(E)} / ${num(Rp)})`],
      why: 'Each branch has the full e.m.f. across it, and the branch currents add (Kirchhoff’s first law).',
    };
  }
  const which = pick(['A2', 'A3'] as const), R = which === 'A2' ? R1 : R2, other = which === 'A2' ? R2 : R1;
  const ans = E / R;
  return {
    type: 'parallel', c, ask: idOf(c, which), hide: meters(c),
    prompt: `What does ammeter ${which} read?`,
    ...options(ans, [E / (R1 + R2), E / other, I1 + I2], 'A'),
    working: [`The branch has the full ${num(E)} V across it`, `I = V / R = ${num(E)} / ${num(R)} = ${num(E / R)} A`],
    why: 'Components in parallel all have the same p.d. across them.',
  };
}

function emf(): Question {
  const E = pick(EMF), r = pick(RINT), R = pick(RS.filter((x) => x <= 15));
  const c = build(
    [['cell', 5, 7, 1, { emf: E, r }], ['resistor', 10, 4, 0, { R }], ['ammeter', 15, 4], ['voltmeter', 1, 7, 1]],
    [[[5, 6], [5, 4], [9, 4]], [[11, 4], [14, 4]], [[16, 4], [18, 4], [18, 10], [5, 10], [5, 8]], [[1, 6], [1, 5], [5, 5]], [[1, 8], [1, 9], [5, 9]]],
  );
  const I = E / (R + r);
  if (Math.random() < 0.55) {
    const ans = E - I * r;
    return {
      type: 'emf', c, ask: idOf(c, 'V1'), hide: meters(c),
      prompt: 'Voltmeter V1 is across the cell’s terminals. What does it read?',
      ...options(ans, [E, I * r, E - (E / R) * r], 'V'),
      working: [`I = ε / (R + r) = ${num(E)} / (${num(R)} + ${num(r)}) = ${num(I)} A`, `Lost volts = Ir = ${num(I)} × ${num(r)} = ${num(I * r)} V`, `V = ε − Ir = ${num(E)} − ${num(I * r)} = ${num(E - I * r)} V`],
      why: 'Some of the e.m.f. is used driving current through the internal resistance, so the terminal p.d. is less than the e.m.f.',
    };
  }
  const ans = I;
  return {
    type: 'emf', c, ask: idOf(c, 'A1'), hide: meters(c),
    prompt: 'What does ammeter A1 read?',
    ...options(ans, [E / R, E / r, E / (R + 2 * r)], 'A'),
    working: [`ε = I(R + r)`, `I = ${num(E)} / (${num(R)} + ${num(r)}) = ${num(I)} A`],
    why: 'The internal resistance is in series with the external circuit, so it adds to the total resistance.',
  };
}

function mixed(): Question {
  const E = pick(EMF), R1 = pick(RS), [R2, R3] = shuffle(RS.slice()).slice(0, 2);
  const c = build(
    [['cell', 8, 12, 0, { emf: E }], ['resistor', 6, 3, 0, { R: R1 }], ['resistor', 13, 3, 0, { R: R2 }], ['resistor', 13, 6, 0, { R: R3 }], ['ammeter', 17, 10, 1], ['voltmeter', 13, 9]],
    [[[7, 12], [3, 12], [3, 3], [5, 3]], [[7, 3], [12, 3]], [[10, 3], [10, 6], [12, 6]], [[14, 3], [17, 3], [17, 9]], [[14, 6], [17, 6]], [[17, 11], [17, 12], [9, 12]], [[12, 9], [10, 9], [10, 6]], [[14, 9], [17, 9]]],
  );
  const Rp = 1 / (1 / R2 + 1 / R3), Rt = R1 + Rp, I = E / Rt;
  if (Math.random() < 0.5) {
    const ans = I;
    return {
      type: 'mixed', c, ask: idOf(c, 'A1'), hide: meters(c),
      prompt: 'What does ammeter A1 read?',
      ...options(ans, [E / (R1 + R2 + R3), E / R1, E / Rp], 'A'),
      working: [`R₂ and R₃ in parallel: 1/R = 1/${num(R2)} + 1/${num(R3)}, so R = ${num(Rp)} Ω`, `Total = ${num(R1)} + ${num(Rp)} = ${num(Rt)} Ω`, `I = ${num(E)} / ${num(Rt)} = ${num(I)} A`],
      why: 'Combine the parallel pair first, then add the series resistor.',
    };
  }
  const ans = I * Rp;
  return {
    type: 'mixed', c, ask: idOf(c, 'V1'), hide: meters(c),
    prompt: 'What does voltmeter V1 read?',
    ...options(ans, [(E * (R2 + R3)) / (R1 + R2 + R3), (E * R1) / Rt, E / 2], 'V'),
    working: [`Parallel pair: R = ${num(Rp)} Ω; total = ${num(Rt)} Ω`, `I = ${num(E)} / ${num(Rt)} = ${num(I)} A`, `V = I × ${num(Rp)} = ${num(I * Rp)} V`],
    why: 'The parallel pair behaves like one resistor of R₂R₃/(R₂ + R₃), and takes its share of the p.d.',
  };
}

function sensor(): Question {
  const kind: Kind = pick(['thermistor', 'ldr'] as const);
  const across = pick(['sensor', 'fixed'] as const);
  const up = Math.random() < 0.5;
  const base = kind === 'thermistor' ? { T: 20 } : { lux: 100 };
  const changed = kind === 'thermistor' ? { T: up ? 60 : 0 } : { lux: up ? 2000 : 5 };
  const make = (p: object) => build(
    [['cell', 6, 10, 0, { emf: 6 }], ['resistor', 12, 4, 1, { R: 2200 }], [kind, 12, 8, 1, p], ['voltmeter', 18, across === 'sensor' ? 8 : 4, 1]],
    across === 'sensor'
      ? [[[5, 10], [3, 10], [3, 2], [12, 2], [12, 3]], [[12, 5], [12, 7]], [[12, 9], [12, 10], [7, 10]], [[18, 7], [18, 6], [12, 6]], [[18, 9], [18, 10], [12, 10]]]
      : [[[5, 10], [3, 10], [3, 2], [12, 2], [12, 3]], [[12, 5], [12, 7]], [[12, 9], [12, 10], [7, 10]], [[18, 3], [18, 2], [12, 2]], [[18, 5], [18, 6], [12, 6]]],
  );
  const c = make(changed);
  const before = read(make(base), 'V1'), after = read(c, 'V1');
  const answer = Math.abs(after - before) < 0.01 ? 'Stays the same' : after > before ? 'Increases' : 'Decreases';
  const name = kind === 'thermistor' ? 'thermistor' : 'LDR';
  const change = kind === 'thermistor' ? (up ? 'The temperature rises' : 'The temperature falls') : up ? 'The light gets brighter' : 'The light gets dimmer';
  const Rdir = up ? 'falls' : 'rises';
  return {
    type: 'sensor', c, ask: idOf(c, 'V1'), hide: meters(c),
    prompt: `${change}. What happens to the reading on V1, across the ${across === 'sensor' ? name : 'fixed resistor'}?`,
    options: ['Increases', 'Decreases', 'Stays the same', 'Falls to zero'], answer,
    working: [`The ${name}’s resistance ${Rdir}`, `So its share of the 6 V ${Rdir === 'falls' ? 'falls' : 'rises'}, and the fixed resistor’s share ${Rdir === 'falls' ? 'rises' : 'falls'}`,
      `V1: ${num(before)} V → ${num(after)} V`],
    why: 'In a potential divider the larger resistance takes the larger share of the p.d.',
  };
}

/* ---------- capacitors (Unit 4) ---------- */

const CAPS = [100e-6, 220e-6, 470e-6, 1000e-6, 2200e-6];
const RBIG = [1000, 2200, 4700, 10000, 22000];
const fsi = (x: number, u: string) => si(x, u, 3);
const sec = (x: number) => `${num(x)} s`;
const capOf = (c: { parts: { kind: string; id: string }[] }) => c.parts.find((p) => p.kind === 'capacitor')!.id;
const rcPick = () => {
  const C = pick(CAPS), R = pick(RBIG.filter((r) => r * C >= 0.4 && r * C <= 60));
  return { C, R, E: pick([3, 4.5, 6, 9, 12]) };
};
const rcTxt = (R: number, C: number) => `τ = RC = ${ohms(R)} × ${si(C, 'F', 2)} = ${num(R * C)} s`;

function capStore(): Question {
  const { C, R, E } = rcPick(), c = rcRig(C, R, true, undefined, E), id = capOf(c);
  const Q = C * E;
  if (Math.random() < 0.55) return {
    type: 'cap', c, ask: id, hide: meters(c), vc: { [id]: E },
    prompt: 'S1 has been at A for a long time. How much charge is stored on C1?',
    ...options(Q, [Q / 2, C * E * E, C / E], 'C', fsi),
    working: ['Fully charged: no current, so no p.d. across R and V = ε = ' + num(E) + ' V', `Q = CV = ${si(C, 'F', 2)} × ${num(E)} V = ${si(Q, 'C', 3)}`],
    why: 'A capacitor charges until the p.d. across it equals the e.m.f.; then the current stops.',
  };
  const W = 0.5 * C * E * E;
  return {
    type: 'cap', c, ask: id, hide: meters(c), vc: { [id]: E },
    prompt: 'S1 has been at A for a long time. How much energy is stored in C1?',
    ...options(W, [C * E * E, 0.5 * C * E, Q], 'J', fsi),
    working: [`V = ε = ${num(E)} V`, `W = ½CV² = ½ × ${si(C, 'F', 2)} × ${num(E)}² = ${si(W, 'J', 3)}`],
    why: 'The energy stored is the area under the Q–V graph: ½QV = ½CV².',
  };
}

function capTime(): Question {
  const { C, R, E } = rcPick(), c = rcRig(C, R, false, undefined, E), id = capOf(c), tau = R * C;
  const kind = pick(['tau', 'half', 'decay'] as const);
  if (kind === 'tau') return {
    type: 'cap', c, ask: id, hide: meters(c), vc: { [id]: E },
    prompt: 'C1 is charged, then S1 is moved to B. What is the time constant of the discharge?',
    ...options(tau, [tau * Math.LN2, 1 / tau, tau / 2], 's', (x) => sec(x)),
    working: [rcTxt(R, C)],
    why: 'In one time constant the p.d., charge and current all fall to 1/e (37%) of their starting values.',
  };
  if (kind === 'half') return {
    type: 'cap', c, ask: id, hide: meters(c), vc: { [id]: E / 2 },
    prompt: `C1 is charged to ${num(E)} V, then S1 is moved to B. How long until V1 reads ${num(E / 2)} V?`,
    ...options(tau * Math.LN2, [tau, tau / 2, 2 * tau], 's', (x) => sec(x)),
    working: [rcTxt(R, C), '½V₀ = V₀e^(−t/RC), so t = RC ln 2', `t = ${num(tau)} × 0.693 = ${num(tau * Math.LN2)} s`],
    why: 'Exponential decay halves in the same time, RC ln 2, whatever the starting value.',
  };
  const t = Number((pick([0.5, 1, 2, 3]) * tau).toPrecision(2)), x = t / tau, V = E * Math.exp(-x);
  return {
    type: 'cap', c, ask: c.parts[5].id, hide: meters(c), vc: { [id]: V },
    prompt: `C1 is charged to ${num(E)} V, then S1 is moved to B at t = 0. What does V1 read at t = ${num(t)} s?`,
    ...options(V, [E * (1 - Math.exp(-x)), E * Math.pow(0.5, x), E * Math.exp(-x / 2)], 'V'),
    working: [rcTxt(R, C), `V = V₀e^(−t/RC) = ${num(E)} × e^(−${num(t)}/${num(tau)}) = ${num(V)} V`],
    why: 'On discharge V = V₀e^(−t/RC): it falls by the same fraction in every equal time interval.',
  };
}

function capStart(): Question {
  const { C, R, E } = rcPick(), c = rcRig(C, R, true, undefined, E), I0 = E / R;
  return {
    type: 'cap', c, ask: c.parts[3].id, hide: meters(c), vc: { [capOf(c)]: 0 },
    prompt: 'C1 is uncharged. S1 is moved to A. What does A1 read at that instant?',
    ...options(I0, [I0 / 2, I0 * Math.exp(-1), E * C], 'A', fsi),
    working: ['An uncharged capacitor has no p.d. across it, so the whole e.m.f. is across R', `I₀ = ε / R = ${num(E)} / ${ohms(R)} = ${si(I0, 'A', 3)}`],
    why: 'The charging current starts at its largest, ε/R, and falls as the capacitor’s p.d. rises.',
  };
}

const TYPES = [series, parallel, emf, mixed, sensor];
const CAP_TYPES = [capStore, capTime, capTime, capStart];
let last = '';
/** A new question; with adv (the Unit 4 switch) capacitor questions join the mix. */
export function newQuestion(adv = false): Question {
  const types = adv ? [...TYPES, ...CAP_TYPES] : TYPES;
  let q: Question;
  do q = pick(types)(); while (q.type === last && Math.random() < 0.85);
  last = q.type;
  return q;
}
