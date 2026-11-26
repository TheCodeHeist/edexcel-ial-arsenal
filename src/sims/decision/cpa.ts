/* D1.4 Critical path analysis on activity-on-arc networks. Events are numbered nodes with a drawing position;
   activities are arcs (a dummy has duration 0 and no letter). Early event times are the largest of the incoming
   (early + duration); late event times the smallest of the outgoing (late − duration). Total float = late(end) −
   duration − early(start). */
import { ask, rng, sum, type Step } from './util';

export interface Ev { n: number; x: number; y: number }
export interface Act { id: string; from: number; to: number; d: number; dummy?: boolean }
export interface Project { name: string; story: string; ev: Ev[]; acts: Act[] }

const ev = (s: string) => s.split(' ').map((t) => { const [n, x, y] = t.split(',').map(Number); return { n, x, y }; });
const acts = (s: string) => s.split(' ').map((t) => {
  const [id, ft, d] = t.split(':'); const [from, to] = ft.split('-').map(Number);
  return { id: id === '~' ? '' : id, from, to, d: +d, dummy: id === '~' };
});

export const PROJECTS: Project[] = [
  { name: 'Kitchen refit', story: 'Twelve jobs in a kitchen refit, durations in days.',
    ev: ev('0,4,30 1,24,8 2,24,52 3,44,30 4,64,8 5,64,52 6,82,48 7,98,26'),
    acts: acts('A:0-1:5 B:0-2:4 C:1-3:3 D:2-3:6 E:1-4:7 F:3-4:4 G:3-5:5 H:2-5:8 I:4-6:3 J:5-6:6 K:6-7:2 L:4-7:9') },
  { name: 'School fair', story: 'Organising a school fair, durations in hours. Two dummies keep the precedences right.',
    ev: ev('0,4,30 1,22,6 2,22,30 3,22,54 4,46,14 5,46,46 6,70,14 7,70,46 8,96,30'),
    acts: acts('A:0-1:3 B:0-2:5 C:0-3:4 ~:1-2:0 D:1-4:6 E:2-4:2 F:2-5:7 G:3-5:3 ~:4-5:0 H:4-6:5 I:5-7:4 J:6-8:3 K:7-8:6 L:6-7:2') },
  { name: 'App launch', story: 'Launching a small app, durations in weeks.',
    ev: ev('0,4,30 1,26,10 2,26,50 3,50,30 4,72,10 5,72,50 6,96,30'),
    acts: acts('A:0-1:2 B:0-2:3 C:1-3:4 D:2-3:2 E:1-4:9 F:3-4:3 G:3-5:6 H:2-5:5 I:4-6:4 J:5-6:3') },
];

export interface Times { early: number[]; late: number[]; T: number }

export function times(p: Project): Times {
  const N = p.ev.length, early = Array(N).fill(0), late = Array(N).fill(Infinity);
  for (let n = 0; n < N; n++) for (const a of p.acts.filter((x) => x.to === n)) early[n] = Math.max(early[n], early[a.from] + a.d);
  const T = early[N - 1]; late[N - 1] = T;
  for (let n = N - 2; n >= 0; n--) for (const a of p.acts.filter((x) => x.from === n)) late[n] = Math.min(late[n], late[a.to] - a.d);
  return { early, late, T };
}

export interface ActInfo { a: Act; es: number; ef: number; ls: number; lf: number; float: number; critical: boolean }
export function activityTable(p: Project, t = times(p)): ActInfo[] {
  return p.acts.filter((a) => !a.dummy).map((a) => {
    const es = t.early[a.from], lf = t.late[a.to], float = lf - a.d - es;
    return { a, es, ef: es + a.d, ls: lf - a.d, lf, float, critical: float === 0 };
  });
}

export const criticalPaths = (p: Project, t = times(p)) => {
  const out: string[][] = [];
  const walk = (n: number, path: string[]) => {
    if (n === p.ev.length - 1) { out.push(path); return; }
    for (const a of p.acts.filter((x) => x.from === n && t.early[n] === t.late[n] && t.early[x.to] === t.late[x.to] && t.early[n] + x.d === t.early[x.to]))
      walk(a.to, a.dummy ? path : [...path, a.id]);
  };
  walk(0, []);
  return out;
};

/** Immediately preceding activities, as in a precedence table (through dummies). */
export function precedence(p: Project): Record<string, string[]> {
  const into = (n: number): string[] => p.acts.filter((a) => a.to === n).flatMap((a) => (a.dummy ? into(a.from) : [a.id]));
  return Object.fromEntries(p.acts.filter((a) => !a.dummy).map((a) => [a.id, into(a.from).sort()]));
}

export const workersLowerBound = (p: Project, t = times(p)) => Math.ceil(sum(p.acts.map((a) => a.d)) / t.T);

/** Activities that must be happening at time t (take t between whole numbers, e.g. 10.5): latest start < t < earliest finish. */
export const mustHappen = (rows: ActInfo[], t: number) => rows.filter((r) => r.ls < t && t < r.ef).map((r) => r.a.id);

export interface PassState { early: (number | null)[]; late: (number | null)[]; focus?: number; phase: 'early' | 'late' | 'done' }

export function passSteps(p: Project): Step<PassState>[] {
  const t = times(p), N = p.ev.length, r = rng(N * 37 + p.acts.length);
  const early: (number | null)[] = Array(N).fill(null), late: (number | null)[] = Array(N).fill(null);
  const steps: Step<PassState>[] = [{ s: { early: [...early], late: [...late], phase: 'early' }, say: 'Forward pass: early event times, starting with 0 at the source.' }];
  early[0] = 0;
  steps.push({ s: { early: [...early], late: [...late], focus: 0, phase: 'early' }, say: 'Event 0: early time 0.' });
  for (let n = 1; n < N; n++) {
    const ins = p.acts.filter((a) => a.to === n);
    const vals = ins.map((a) => t.early[a.from] + a.d);
    early[n] = t.early[n];
    const parts = ins.map((a) => `${t.early[a.from]} + ${a.d}${a.dummy ? ' (dummy)' : ` (${a.id})`}`).join(', ');
    steps.push({ s: { early: [...early], late: [...late], focus: n, phase: 'early' },
      say: ins.length > 1 ? `Event ${n}: the largest of ${parts} → ${t.early[n]}.` : `Event ${n}: ${parts} = ${t.early[n]}.`,
      ask: ask(`Early event time at event ${n}?`, String(t.early[n]), [String(Math.min(...vals)), String(t.early[n] + 1), String(sum(vals) - (ins.length > 1 ? Math.min(...vals) : 0)), String(Math.max(0, t.early[n] - 2))], r) });
  }
  late[N - 1] = t.T;
  steps.push({ s: { early: [...early], late: [...late], focus: N - 1, phase: 'late' }, say: `Backward pass: the sink's late time equals its early time, ${t.T}. That's the minimum completion time.` });
  for (let n = N - 2; n >= 0; n--) {
    const outs = p.acts.filter((a) => a.from === n);
    const vals = outs.map((a) => t.late[a.to] - a.d);
    late[n] = t.late[n];
    const parts = outs.map((a) => `${t.late[a.to]} − ${a.d}${a.dummy ? ' (dummy)' : ` (${a.id})`}`).join(', ');
    steps.push({ s: { early: [...early], late: [...late], focus: n, phase: 'late' },
      say: outs.length > 1 ? `Event ${n}: the smallest of ${parts} → ${t.late[n]}.` : `Event ${n}: ${parts} = ${t.late[n]}.`,
      ask: ask(`Late event time at event ${n}?`, String(t.late[n]), [String(Math.max(...vals)), String(t.early[n] === t.late[n] ? t.late[n] + 2 : t.early[n]), String(t.late[n] - 1)], r) });
  }
  const cp = criticalPaths(p, t);
  steps.push({ s: { early: [...early], late: [...late], phase: 'done' }, say: `Critical path${cp.length > 1 ? 's' : ''}: ${cp.map((x) => x.join(' – ')).join(' and ')}. Events on it have equal early and late times.` });
  return steps;
}
