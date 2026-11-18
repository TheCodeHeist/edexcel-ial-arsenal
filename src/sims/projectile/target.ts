/* Target: land the ball on the flag. Either the speed is fixed and you choose the angle, or the angle is fixed and
   you choose the speed. Every challenge is checked to have an answer before it is set. g = 9.81, no air
   resistance, so it can be worked out on paper first. */

import { fly, at, cut, timeAtX, timeDownAt, rad, deg, G, type Flight, type Launch } from './physics';
import type { Target, Wall } from './scene';
import { pick } from '../../lib/util';

export type TMode = 'angle' | 'speed';
export type Course = 'flat' | 'raised' | 'wall';

export interface Challenge {
  mode: TMode; course: Course;
  h: number;            // launch height
  u: number;            // the fixed speed (angle mode)
  deg: number;          // the fixed angle (speed mode)
  target: Target;
  wall: Wall | null;
  answers: number[];    // angles (angle mode) or the speed (speed mode) that hit
  top: number;          // greatest height of an answer's flight (for fitting the view)
}

export interface Outcome { f: Flight; hit: boolean; msg: string }

const W = 2;           // target width / m
const WALL = 0.4;      // half the wall's thickness / m
const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

/** Fly a shot over the course: it stops at the wall, the platform's side, the platform's top or the ground. */
export function shoot(L: Launch, t: Target, wall: Wall | null): Outcome {
  const f = fly(L);
  const ev: [number, string][] = [];
  if (wall) { const tw = timeAtX(f, wall.x - WALL); if (tw !== null && at(f, tw).y < wall.h) ev.push([tw, 'wall']); }
  if (t.y > 0) {
    const ts = timeAtX(f, t.x - t.w / 2); if (ts !== null && at(f, ts).y < t.y) ev.push([ts, 'side']);
    const td = timeDownAt(f, t.y); if (td !== null && Math.abs(at(f, td).x - t.x) <= t.w / 2) ev.push([td, 'hit']);
  } else if (Math.abs(f.R - t.x) <= t.w / 2) ev.push([f.T, 'hit']);
  ev.sort((a, b) => a[0] - b[0]);
  const first = ev[0];
  if (first) {
    const g = cut(f, first[0], first[1]);
    if (first[1] === 'hit') return { f: g, hit: true, msg: `On target, ${miss(g.end.x - t.x)}.` };
    if (first[1] === 'wall') return { f: g, hit: false, msg: 'It hit the wall. Go higher.' };
    return { f: g, hit: false, msg: 'It hit the side of the platform. Go higher or further.' };
  }
  // landed somewhere else: short or long, measured at the target’s height
  const td = t.y > 0 ? timeDownAt(f, t.y) : f.T;
  const x = td !== null ? at(f, td).x : f.R;
  const d = x - t.x;
  return { f, hit: false, msg: td === null && t.y > 0 ? 'It never got as high as the platform.' : d < 0 ? `Short by ${Math.abs(d).toFixed(1)} m.` : `Long by ${d.toFixed(1)} m.` };
}
const miss = (d: number) => (Math.abs(d) < 0.15 ? 'dead centre' : `${Math.abs(d).toFixed(1)} m ${d < 0 ? 'short of' : 'past'} the centre`);

function make(mode: TMode, course: Course): Challenge | null {
  const h = course === 'flat' ? pick([0, 0, 0, 5, 10]) : pick([0, 0, 2, 5]);
  const d = ri(course === 'wall' ? 20 : 12, 55);
  const ty = course === 'raised' ? ri(4, 16) : 0;
  const target: Target = { x: d, y: ty, w: W };
  const wall: Wall | null = course === 'wall' ? { x: Math.round(d * (0.35 + Math.random() * 0.3)), h: ri(6, 14) } : null;
  const dy = ty - h;
  let u = 0, dg = 0, answers: number[] = [];
  if (mode === 'angle') {
    // the slowest launch that can reach the target at all, then a bit more so there is a choice of angles
    const umin = Math.sqrt(G * (dy + Math.hypot(dy, d)));
    u = Math.round(umin * (1.12 + Math.random() * 0.35) * 2) / 2;
    if (u > 40) return null;
    const lo = h > 0 ? -30 : 0;
    let run: number[] = [];
    for (let a = lo; a <= 85.0001; a += 0.1) {
      if (shoot({ u, deg: a, h, g: G, k: 0 }, target, wall).hit) run.push(a);
      else if (run.length) { answers.push(run[Math.floor(run.length / 2)]); run = []; }
    }
    if (run.length) answers.push(run[Math.floor(run.length / 2)]);
    // the slider moves in half degrees: every answer must be reachable on it
    answers = answers.filter((a) => shoot({ u, deg: Math.round(a * 2) / 2, h, g: G, k: 0 }, target, wall).hit).map((a) => Math.round(a * 2) / 2);
  } else {
    const min = Math.ceil(deg(Math.atan2(dy, d))) + 8;
    if (min > 70) return null;
    dg = ri(Math.max(10, min), 70);
    const c = Math.cos(rad(dg));
    const den = 2 * c * c * (d * Math.tan(rad(dg)) - dy);
    if (den <= 0) return null;
    u = Math.sqrt((G * d * d) / den);
    if (u > 45 || !shoot({ u: Math.round(u * 10) / 10, deg: dg, h, g: G, k: 0 }, target, wall).hit) return null;
    answers = [Math.round(u * 10) / 10];
  }
  if (!answers.length) return null;
  const tops = answers.map((a) => fly(mode === 'angle' ? { u, deg: a, h, g: G, k: 0 } : { u: a, deg: dg, h, g: G, k: 0 }).H);
  return { mode, course, h, u, deg: dg, target, wall, answers, top: Math.min(...tops) };
}

export function newChallenge(mode: TMode, course: Course): Challenge {
  for (let i = 0; i < 200; i++) { const c = make(mode, course); if (c) return c; }
  // a fallback that always works
  return make(mode, 'flat') ?? { mode, course: 'flat', h: 0, u: 20, deg: 45, target: { x: 30, y: 0, w: W }, wall: null, answers: mode === 'angle' ? [24, 66] : [17.2], top: 10 };
}

/** The working for the hint, without the wall (it shows how to reach the target; the wall may rule an answer out). */
export function working(c: Challenge): string[] {
  const d = c.target.x, dy = c.target.y - c.h, g = 9.81;
  const m = (x: number) => (x < 0 ? '−' : '') + Math.abs(x);
  const dyTxt = dy === 0 ? '0' : `${m(dy)} m`;
  const less = (x: number) => (x === 0 ? '' : x < 0 ? ` + ${-x}` : ` − ${x}`);
  if (c.mode === 'speed') {
    return [
      `Horizontally: ${d} = u cos ${c.deg}° × t,  so t = ${d} ÷ (u cos ${c.deg}°)`,
      `Vertically (up positive): s = ${dyTxt} = u sin ${c.deg}° × t − ½ × ${g} × t²`,
      `Substitute t:  ${m(dy)} = ${d} tan ${c.deg}° − ${g} × ${d}² ÷ (2u² cos² ${c.deg}°)`,
      `u = √(${g} × ${d}² ÷ (2 cos² ${c.deg}° × (${d} tan ${c.deg}°${less(dy)})))  =  ${c.answers[0].toFixed(1)} m s⁻¹`,
    ];
  }
  const a = (g * d * d) / (2 * c.u * c.u);
  const disc = d * d - 4 * a * (a + dy);
  const roots = disc >= 0 ? [(d - Math.sqrt(disc)) / (2 * a), (d + Math.sqrt(disc)) / (2 * a)].map((t) => deg(Math.atan(t))) : [];
  return [
    `With t = ${d} ÷ (${c.u} cos θ) and 1 ÷ cos²θ = 1 + tan²θ:`,
    `${m(dy)} = ${d} tan θ − ${a.toFixed(3)}(1 + tan²θ)`,
    `${a.toFixed(3)} tan²θ − ${d} tan θ ${a + dy < 0 ? '−' : '+'} ${Math.abs(a + dy).toFixed(3)} = 0`,
    roots.length ? `tan θ = ${roots.map((r) => Math.tan(rad(r)).toFixed(3)).join(' or ')}  →  θ = ${roots.map((r) => r.toFixed(1) + '°').join(' or ')}` : 'No real roots: it cannot reach at this speed.',
    ...(c.wall ? ['Then check each angle clears the wall.'] : []),
  ];
}
