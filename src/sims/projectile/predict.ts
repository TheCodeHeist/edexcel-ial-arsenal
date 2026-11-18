/* Predict: generated projectile questions in the style of Unit 1, with four options. g = 9.81 m s⁻², no air
   resistance. The wrong options are the slips students actually make: sin for cos, forgetting the ×2 for the
   whole flight, ignoring the launch height, using the launch speed instead of a component, thinking the velocity
   is zero at the top. Each question carries the working that the reveal shows and the dimension it draws. */

import { fly, rad, G, type Launch, type Flight } from './physics';
import type { Annot, Dim } from './scene';
import { pick, shuffle } from '../../lib/util';
import { sig, num } from '../circuit/format';

export interface Question {
  L: Launch;
  f: Flight;
  prompt: string;
  options: string[];
  answer: string;
  working: string[];
  why: string;
  annot: Annot;          // what the set-up shows (the unknown is hidden)
  dims: Dim[];           // drawn once answered
  stopAt?: number;       // freeze the replay here (questions about the top of the flight)
}

const MS = 'm s⁻¹';
const n = (x: number) => sig(x);
const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const half = (a: number, b: number) => (a * 2 + Math.floor(Math.random() * ((b - a) * 2 + 1))) / 2;

function options(ans: number, wrong: number[], unit: string) {
  const fmt = (x: number) => `${sig(x)} ${unit}`;
  const answer = fmt(ans);
  const set = new Set([answer]);
  for (const w of [...wrong, ans * 2, ans / 2, ans * 1.5, ans / 1.5]) {
    if (set.size >= 4) break;
    if (isFinite(w) && w > 0) set.add(fmt(w));
  }
  return { options: shuffle([...set]), answer };
}

const THINGS = ['ball', 'stone', 'tennis ball', 'small rock', 'golf ball'];
const KICKS: [string, string][] = [['football', 'kicked'], ['golf ball', 'struck'], ['ball', 'thrown'], ['stone', 'thrown'], ['javelin', 'thrown']];

/** Swap one wrong option for “0 m s⁻¹”, the classic slip about the top of the flight. */
function zeroOption(o: { options: string[]; answer: string }) {
  const zero = `0 ${MS}`, wrong = o.options.filter((x) => x !== o.answer && x !== zero);
  return { answer: o.answer, options: shuffle([o.answer, zero, ...wrong.slice(0, 2)]) };
}

/* ---------- thrown horizontally from a height ---------- */
function horizontal(): Question {
  const u = half(3, 20), h = ri(5, 60), thing = pick(THINGS);
  const L: Launch = { u, deg: 0, h, g: G, k: 0 };
  const f = fly(L);
  const t = Math.sqrt((2 * h) / G), vv = Math.sqrt(2 * G * h);
  const set = `A ${thing} is thrown horizontally at ${num(u)} ${MS} from the top of a cliff ${h} m high.`;
  const tLine = `Vertically: s = ut + ½at² with u = 0, so ${h} = ½ × 9.81 × t², t = √(2 × ${h} ÷ 9.81) = ${n(t)} s`;
  const annot = { u: `${num(u)} ${MS}`, h: `${h} m` };
  switch (pick(['t', 'R', 'R', 'vv', 'v'])) {
    case 't': return {
      L, f, annot, prompt: `${set} How long does it take to reach the ground?`,
      ...options(t, [Math.sqrt(h / G), h / u, 2 * t], 's'),
      working: [tLine], why: 'The horizontal speed has no effect on the time to fall: vertically it starts from rest, like a dropped ball.',
      dims: [{ a: [f.R, 0], b: [f.R, h], label: `t = ${n(t)} s` }],
    };
    case 'R': return {
      L, f, annot, prompt: `${set} How far from the foot of the cliff does it land?`,
      ...options(u * t, [u * Math.sqrt(h / G), (u * u) / G, u * 2 * t], 'm'),
      working: [tLine, `Horizontally the velocity is constant: s = vt = ${num(u)} × ${n(t)} = ${n(u * t)} m`],
      why: 'Work out the time from the vertical motion, then use it in the horizontal motion: time is the only thing the two share.',
      dims: [{ a: [0, 0], b: [f.R, 0], label: `${n(u * t)} m` }],
    };
    case 'vv': return {
      L, f, annot, prompt: `${set} What is the vertical component of its velocity as it hits the ground?`,
      ...options(vv, [Math.sqrt(G * h), Math.hypot(u, vv), vv + u], MS),
      working: [`Vertically: v² = u² + 2as = 0 + 2 × 9.81 × ${h}`, `v = ${n(vv)} ${MS}`],
      why: 'The vertical motion is the same as a ball dropped from the same height; the horizontal velocity plays no part.',
      dims: [],
    };
    default: return {
      L, f, annot, prompt: `${set} At what speed does it hit the ground?`,
      ...options(Math.hypot(u, vv), [vv, u + vv, Math.hypot(u, Math.sqrt(G * h))], MS),
      working: [`Vertical component: v² = 2 × 9.81 × ${h}, so vV = ${n(vv)} ${MS}`, `Horizontal component stays ${num(u)} ${MS}`, `Speed = √(${num(u)}² + ${n(vv)}²) = ${n(Math.hypot(u, vv))} ${MS}`],
      why: 'The components are at right angles, so combine them with Pythagoras, never by adding.',
      dims: [],
    };
  }
}

/* ---------- launched at an angle from level ground ---------- */
function angled(): Question {
  const u = ri(8, 30), deg = ri(15, 75), [thing, verb] = pick(KICKS);
  const L: Launch = { u, deg, h: 0, g: G, k: 0 };
  const f = fly(L);
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)), uh = u * c, uv = u * s;
  const set = `A ${thing} is ${verb} from level ground at ${u} ${MS} at ${deg}° above the horizontal.`;
  const comps = `uH = ${u} cos ${deg}° = ${n(uh)} ${MS},  uV = ${u} sin ${deg}° = ${n(uv)} ${MS}`;
  const annot = { u: `${u} ${MS}`, deg: `${deg}°` };
  const T = (2 * uv) / G, H = (uv * uv) / (2 * G), R = uh * T;
  switch (pick(['H', 'T', 'R', 'R', 'uv', 'top'])) {
    case 'H': return {
      L, f, annot, prompt: `${set} What is the greatest height it reaches?`,
      ...options(H, [(uh * uh) / (2 * G), (u * u) / (2 * G), (uv * uv) / G], 'm'),
      working: [`uV = ${u} sin ${deg}° = ${n(uv)} ${MS}`, `At the top vV = 0:  0 = uV² − 2 × 9.81 × s,  s = ${n(uv)}² ÷ 19.62 = ${n(H)} m`],
      why: 'Only the vertical component lifts it: at the top the vertical velocity is zero while the horizontal one carries on.',
      dims: [{ a: [f.R / 2, 0], b: [f.R / 2, H], label: `${n(H)} m` }],
    };
    case 'T': return {
      L, f, annot, prompt: `${set} How long is it in the air?`,
      ...options(T, [uv / G, (2 * uh) / G, (2 * u) / G], 's'),
      working: [`uV = ${u} sin ${deg}° = ${n(uv)} ${MS}`, `Back to the ground, s = 0:  0 = uV t − ½ × 9.81 t²,  t = 2uV ÷ g = ${n(T)} s`],
      why: 'It takes as long to come down as to go up, so the whole flight is twice the time to the top.',
      dims: [],
    };
    case 'R': return {
      L, f, annot, prompt: `${set} How far away does it land?`,
      ...options(R, [R / 2, (u * u) / G, u * T], 'm'),
      working: [comps, `Time of flight t = 2uV ÷ g = ${n(T)} s`, `Range = uH × t = ${n(uh)} × ${n(T)} = ${n(R)} m`],
      why: 'Time of flight from the vertical motion, then distance from the steady horizontal component.',
      dims: [{ a: [0, 0], b: [R, 0], label: `${n(R)} m` }],
    };
    case 'uv': return {
      L, f, annot, prompt: `${set} What is the initial vertical component of its velocity?`,
      ...options(uv, [uh, u * Math.tan(rad(deg)), u / s], MS),
      working: [`uV = u sin θ = ${u} × sin ${deg}° = ${n(uv)} ${MS}`],
      why: 'The vertical side of the velocity triangle is opposite the angle to the horizontal, so it takes the sine.',
      dims: [],
    };
    default: return {
      L, f, annot, prompt: `${set} What is its speed at the highest point?`,
      ...zeroOption(options(uh, [uv, u], MS)),
      working: [`At the top vV = 0, so the speed is just the horizontal component`, `uH = ${u} cos ${deg}° = ${n(uh)} ${MS}`],
      why: 'Only the vertical velocity is zero at the top: the horizontal component never changes, so the ball is still moving.',
      dims: [], stopAt: f.tTop,
    };
  }
}

/* ---------- launched at an angle from a height ---------- */
function fromHeight(): Question {
  const u = ri(8, 22), deg = ri(15, 50), h = ri(5, 40), thing = pick(THINGS);
  const L: Launch = { u, deg, h, g: G, k: 0 };
  const f = fly(L);
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)), uh = u * c, uv = u * s;
  const T = f.T, root = Math.sqrt(uv * uv + 2 * G * h);
  const set = `A ${thing} is thrown at ${u} ${MS} at ${deg}° above the horizontal from the top of a building ${h} m high.`;
  const annot = { u: `${u} ${MS}`, deg: `${deg}°`, h: `${h} m` };
  const quad = [`uV = ${u} sin ${deg}° = ${n(uv)} ${MS}; taking up as positive, s = −${h} m`, `−${h} = ${n(uv)}t − 4.905t²  →  4.905t² − ${n(uv)}t − ${h} = 0`, `t = (${n(uv)} + √(${n(uv)}² + 4 × 4.905 × ${h})) ÷ 9.81 = ${n(T)} s`];
  if (Math.random() < 0.5) return {
    L, f, annot, prompt: `${set} How long is it in the air?`,
    ...options(T, [(2 * uv) / G, Math.sqrt((2 * h) / G), (root - uv) / G], 's'),
    working: quad, why: 'The ball ends up below where it started, so the displacement is negative; take the positive root.',
    dims: [],
  };
  return {
    L, f, annot, prompt: `${set} How far from the foot of the building does it land?`,
    ...options(uh * T, [(uh * 2 * uv) / G, uh * Math.sqrt((2 * h) / G), u * T], 'm'),
    working: [...quad, `Range = uH × t = ${u} cos ${deg}° × ${n(T)} = ${n(uh * T)} m`],
    why: 'The flight lasts longer than on level ground because it has further to fall, so it lands further away.',
    dims: [{ a: [0, 0], b: [f.R, 0], label: `${n(f.R)} m` }],
  };
}

/* ---------- work backwards from the range ---------- */
function backwards(): Question {
  const deg = pick([20, 25, 30, 35, 40, 45, 50, 55, 60]), u0 = ri(10, 28);
  const R = Number(sig((u0 * u0 * Math.sin(rad(2 * deg))) / G));
  const u = Math.sqrt((R * G) / Math.sin(rad(2 * deg)));
  const [thing, verb] = pick(KICKS);
  const L: Launch = { u, deg, h: 0, g: G, k: 0 };
  const f = fly(L);
  return {
    L, f, annot: { u: 'u = ?', deg: `${deg}°` },
    prompt: `A ${thing} is ${verb} from level ground at ${deg}° above the horizontal and lands ${R} m away. What was its launch speed?`,
    ...options(u, [Math.sqrt((R * G) / Math.sin(rad(deg))), Math.sqrt(R * G), Math.sqrt((R * G) / 2)], MS),
    working: [`Time of flight t = 2u sin ${deg}° ÷ g; range = u cos ${deg}° × t = u² sin ${2 * deg}° ÷ g`, `u = √(${R} × 9.81 ÷ sin ${2 * deg}°) = ${n(u)} ${MS}`],
    why: 'Write the range in terms of u using both components, then rearrange: the two motions share the same time.',
    dims: [{ a: [0, 0], b: [f.R, 0], label: `${R} m` }],
  };
}

export function newQuestion(): Question {
  return pick([horizontal, horizontal, angled, angled, angled, fromHeight, backwards])();
}
