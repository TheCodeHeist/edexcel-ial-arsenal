/* Kernel live tools for Projectile Lab: drives Launch, Predict and Target through the same reactive state and handlers. */
import { tick } from 'svelte';
import { provideKernelTools } from '../../lib/kernel/live';
import { EXAMPLES } from './examples';
import { speed as ptSpeed, dip, type Flight, type Launch } from './physics';
import { sig } from '../circuit/format';
import type { LPrefs } from './Launch.svelte';
import type { PScore } from './Predict.svelte';
import type { TScore } from './Target.svelte';
import type { Challenge, Course, Outcome, TMode } from './target';
import type { Question } from './predict';

export type Mode = 'launch' | 'predict' | 'target';

export interface ProjectileHost {
  getMode(): Mode;
  setMode(m: Mode): void;
  prefs: LPrefs;
  tprefs: { mode: TMode; course: Course };
  getShots(): Launch[];
  score: PScore;
  tscore: TScore;
  launch(): {
    kFire(): void;
    kReplayAll(): void;
    kClear(): void;
    kSelect(i: number): void;
    kRemove(i: number): void;
    kExample(id: string): void;
    kSeek(t: number): void;
    kSetPlaying(on: boolean): void;
    kWaitFlight(maxMs?: number): Promise<boolean>;
    kSnapshot(): { sel: number; flights: Flight[]; f: Flight | null; tNow: number; p: Flight['end'] | null; ideal: Flight | null; playing: boolean };
  } | undefined;
  target(): {
    kSetAngle(deg: number): number;
    kSetSpeed(u: number): number;
    kFire(): void;
    kFresh(): void;
    kSetWorking(show: boolean): void;
    kWaitFlight(maxMs?: number): Promise<boolean>;
    kSnapshot(): { c: Challenge; setDeg: number; setU: number; tries: Outcome[]; last: Outcome | null; solved: boolean; helped: boolean; showWork: boolean; lines: string[]; playing: boolean };
  } | undefined;
  predict(): {
    kAnswer(o: string): void;
    kNext(): void;
    kReplay(): void;
    kWaitFlight(maxMs?: number): Promise<boolean>;
    kSnapshot(): { q: Question; picked: string | null; ok: boolean; landed: boolean; playing: boolean };
  } | undefined;
}

const GRAV_MAP: Record<string, [number, string]> = {
  earth: [9.81, 'Earth'],
  moon: [1.62, 'Moon'],
  mars: [3.71, 'Mars'],
  jupiter: [24.8, 'Jupiter'],
};
const DRAG_MAP: Record<string, [number, string]> = {
  none: [0, 'None'], off: [0, 'None'], zero: [0, 'None'],
  light: [0.004, 'Light'], low: [0.004, 'Light'],
  heavy: [0.02, 'Heavy'], high: [0.02, 'Heavy'],
};
const GRAPH_KEYS = ['x', 'y', 'vx', 'vy'] as const;
const PLAY_SPEEDS = [0.25, 1, 4] as const;

function parseNum(v: unknown, label: string): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const m = v.replace(/−/g, '-').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
    if (m) {
      const n = Number(m[0]);
      if (Number.isFinite(n)) return n;
    }
  }
  throw new Error(`${label} must be a number (got ${JSON.stringify(v)}).`);
}

function clampStep(x: number, lo: number, hi: number, step: number): { val: number; clamped: boolean } {
  const c = Math.max(lo, Math.min(hi, x));
  const rounded = Math.round(c / step) * step;
  const val = Number(rounded.toFixed(6));
  return { val: Math.max(lo, Math.min(hi, val)), clamped: Math.abs(c - x) > 1e-9 };
}

function parseGravity(v: unknown): number {
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    for (const [k, [g]] of Object.entries(GRAV_MAP)) if (s.includes(k)) return g;
  }
  const n = parseNum(v, 'gravity');
  if (n <= 0) throw new Error('gravity must be positive (use Earth 9.81, Moon 1.62, Mars 3.71, Jupiter 24.8 N/kg).');
  // Snap to closest preset if within 0.05, otherwise clamp to a sensible preset? UI Seg only has the 4 presets.
  let best = 9.81, bestD = Infinity;
  for (const [g] of Object.values(GRAV_MAP)) {
    const d = Math.abs(g - n);
    if (d < bestD) { bestD = d; best = g; }
  }
  if (bestD <= 0.25) return best;
  throw new Error(`gravity must be one of Earth (9.81), Moon (1.62), Mars (3.71) or Jupiter (24.8) N/kg (got ${JSON.stringify(v)}).`);
}

function parseDrag(v: unknown): number {
  if (typeof v === 'boolean') return v ? 0.004 : 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    for (const [k, [val]] of Object.entries(DRAG_MAP)) if (s === k || s.includes(k)) return val;
  }
  const n = parseNum(v, 'drag');
  if (n <= 0.001) return 0;
  if (n <= 0.01) return 0.004;
  return 0.02;
}

function gravName(g: number): string {
  for (const [, [val, name]] of Object.entries(GRAV_MAP)) if (Math.abs(val - g) < 0.02) return `${name} (${val} N kg⁻¹)`;
  return `${g} N kg⁻¹`;
}

function dragName(k: number): string {
  if (k === 0) return 'None (k = 0)';
  if (Math.abs(k - 0.004) < 1e-4) return 'Light (k = 0.004 m⁻¹)';
  if (Math.abs(k - 0.02) < 1e-4) return 'Heavy (k = 0.02 m⁻¹)';
  return `k = ${k} m⁻¹`;
}

function fmtFlight(f: Flight, ideal: Flight | null, idx?: number): string {
  const head = idx !== undefined ? `Shot ${idx + 1}` : 'Flight';
  const base = `${head} (u = ${f.L.u} m s⁻¹, θ = ${f.L.deg}°, h = ${f.L.h} m, g = ${f.L.g} N kg⁻¹, drag ${dragName(f.L.k)}): `
    + `time of flight T = ${sig(f.T)} s, range R = ${sig(f.R)} m, greatest height H = ${sig(f.H)} m (at t = ${f.tTop > 0 ? sig(f.tTop) + ' s' : 'launch'}), `
    + `landing speed = ${sig(ptSpeed(f.end))} m s⁻¹ at ${sig(dip(f.end))}° below horizontal.`;
  if (!ideal) return base;
  return base + ` Without air resistance: R = ${sig(ideal.R)} m, T = ${sig(ideal.T)} s, H = ${sig(ideal.H)} m.`;
}

function matchMode(raw: unknown): Mode {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'launch' || s === 'sandbox' || s === 'fire') return 'launch';
  if (s === 'predict' || s === 'quiz' || s === 'question') return 'predict';
  if (s === 'target' || s === 'flag' || s === 'challenge') return 'target';
  throw new Error(`mode must be one of launch, predict, target (got ${JSON.stringify(raw)}).`);
}

function matchCourse(raw: unknown): Course {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'flat' || s === 'open' || s.includes('open')) return 'flat';
  if (s === 'raised' || s.includes('platform') || s.includes('high')) return 'raised';
  if (s === 'wall' || s.includes('over')) return 'wall';
  throw new Error(`course must be one of flat, raised, wall (got ${JSON.stringify(raw)}).`);
}

function matchTMode(raw: unknown): TMode {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'angle' || s.includes('angle')) return 'angle';
  if (s === 'speed' || s.includes('speed')) return 'speed';
  throw new Error(`target_mode must be angle or speed (got ${JSON.stringify(raw)}).`);
}

function matchExample(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  const byId = EXAMPLES.find((e) => e.id === s || e.name.toLowerCase() === s || e.name.toLowerCase().includes(s) || e.id.includes(s));
  if (byId) return byId.id;
  throw new Error(`Unknown example ${JSON.stringify(raw)}. Valid examples: ${EXAMPLES.map((e) => `${e.id} (${e.name})`).join(', ')}.`);
}

function matchOption(raw: unknown, opts: string[]): string {
  const s = String(raw ?? '').trim();
  const idx = /^[a-d]$/i.test(s) ? s.toUpperCase().charCodeAt(0) - 65 : /^[1-4]$/.test(s) ? Number(s) - 1 : -1;
  if (idx >= 0 && idx < opts.length) return opts[idx];
  const low = s.toLowerCase().replace(/−/g, '-');
  const exact = opts.find((o) => o.toLowerCase().replace(/−/g, '-') === low);
  if (exact) return exact;
  const sub = opts.filter((o) => o.toLowerCase().replace(/−/g, '-').includes(low));
  if (sub.length === 1) return sub[0];
  throw new Error(`Option ${JSON.stringify(raw)} did not match. Choices: ${opts.map((o, i) => `${i + 1}) ${o}`).join(' | ')}.`);
}

const ABOUT = 'Projectile Lab (Edexcel IAL Physics Unit 1) is open with three tabs: Launch (sandbox with speed, angle, height, planet gravity, air resistance, strobe/shadow/vector overlays and time graphs), Predict (exam-style questions) and Target (land on a flag over flat ground, a raised platform or a wall). '
  + 'Use projectile_ tools to inspect state, change settings, fire animated shots, load built-in examples, or aim and fire at targets on screen.';

export function provideProjectileTools(host: ProjectileHost): () => void {
  async function ensureMode(m: Mode) {
    if (host.getMode() !== m) {
      host.setMode(m);
      await tick();
    }
  }

  function applyLaunchArgs(a: Record<string, unknown>): string[] {
    const notes: string[] = [];
    const p = host.prefs;
    // Set height before angle so negative angles from a height are allowed
    if (a.height !== undefined) {
      const { val, clamped } = clampStep(parseNum(a.height, 'height'), 0, 80, 1);
      p.h = val;
      if (clamped) notes.push(`height clamped to ${val} m (range 0–80 m)`);
    }
    if (a.speed !== undefined) {
      const { val, clamped } = clampStep(parseNum(a.speed, 'speed'), 0, 50, 0.5);
      p.u = val;
      if (clamped) notes.push(`speed clamped to ${val} m s⁻¹ (range 0–50 m s⁻¹)`);
    }
    if (a.angle !== undefined) {
      const minDeg = p.h > 0 ? -60 : 0;
      const { val, clamped } = clampStep(parseNum(a.angle, 'angle'), minDeg, 90, 1);
      p.deg = val;
      if (clamped) notes.push(`angle clamped to ${val}° (range ${minDeg}°–90°)`);
    } else if (p.h === 0 && p.deg < 0) {
      p.deg = 0;
    }
    if (a.gravity !== undefined) p.g = parseGravity(a.gravity);
    if (a.drag !== undefined) p.k = parseDrag(a.drag);
    if (a.playback_speed !== undefined) {
      const n = parseNum(a.playback_speed, 'playback_speed');
      const best = PLAY_SPEEDS.reduce((b, x) => (Math.abs(x - n) < Math.abs(b - n) ? x : b), 1);
      p.speed = best;
    }
    if (a.graph !== undefined) {
      const g = String(a.graph).trim().toLowerCase() as LPrefs['graph'];
      if (!GRAPH_KEYS.includes(g)) throw new Error(`graph must be one of ${GRAPH_KEYS.join(', ')}.`);
      p.graph = g;
    }
    if (typeof a.aim === 'boolean') p.aim = a.aim;
    if (typeof a.strobe === 'boolean') p.strobe = a.strobe;
    if (typeof a.shadows === 'boolean') p.shadows = a.shadows;
    if (typeof a.vectors === 'boolean') p.vectors = a.vectors;
    return notes;
  }

  return provideKernelTools('projectile', ABOUT, [
    {
      name: 'projectile_state',
      description: 'Read the Projectile Lab state: active tab, all adjustable parameters with values, ranges and units, saved shots and live flight readouts, or current Predict question / Target challenge.',
      parameters: { type: 'object', properties: {} },
      run: () => {
        const m = host.getMode();
        const p = host.prefs;
        const lines: string[] = [`Mode: ${m} (tabs: launch, predict, target)`];
        if (m === 'launch') {
          const snap = host.launch()?.kSnapshot();
          const minDeg = p.h > 0 ? -60 : 0;
          lines.push(
            `Launch settings: speed u = ${p.u} m s⁻¹ (0–50, step 0.5), angle θ = ${p.deg}° (${minDeg}–90, step 1), height h = ${p.h} m (0–80, step 1), `
            + `gravity = ${gravName(p.g)} (Earth 9.81 / Moon 1.62 / Mars 3.71 / Jupiter 24.8), drag = ${dragName(p.k)} (none / light / heavy).`,
            `Display: aim=${p.aim}, strobe=${p.strobe}, shadows=${p.shadows}, vectors=${p.vectors}, playback_speed=×${p.speed} (0.25/1/4), graph=${p.graph} (x/y/vx/vy).`,
          );
          if (snap && snap.flights.length) {
            lines.push(`Saved shots (${snap.flights.length}/6, selected #${snap.sel + 1}):`);
            snap.flights.forEach((fl, i) => lines.push(`  ${i === snap.sel ? '*' : ' '} ${fmtFlight(fl, fl.L.k > 0 ? null : null, i)}`));
            if (snap.f && snap.p) {
              const pt = snap.p;
              lines.push(
                `Selected shot at t = ${sig(snap.tNow)} s${snap.playing ? ' (playing)' : ''}: x = ${sig(pt.x)} m, y = ${sig(pt.y)} m, `
                + `vx = ${sig(pt.vx)} m s⁻¹, vy = ${sig(pt.vy)} m s⁻¹, speed = ${sig(ptSpeed(pt))} m s⁻¹, direction = ${Math.abs(dip(pt)) < 0.05 ? 'horizontal' : `${sig(Math.abs(dip(pt)))}° ${dip(pt) > 0 ? 'below' : 'above'}`}.`,
              );
              if (snap.ideal) lines.push(`Without drag: R = ${sig(snap.ideal.R)} m, T = ${sig(snap.ideal.T)} s, H = ${sig(snap.ideal.H)} m.`);
            }
          } else {
            lines.push('No shots fired yet.');
          }
          lines.push(`Built-in examples: ${EXAMPLES.map((e) => `${e.id} (${e.name})`).join(', ')}.`);
        } else if (m === 'target') {
          const snap = host.target()?.kSnapshot();
          if (snap) {
            const c = snap.c;
            lines.push(
              `Target settings: target_mode=${host.tprefs.mode} (angle/speed), course=${host.tprefs.course} (flat/raised/wall).`,
              `Challenge (g = 9.81 m s⁻², no drag): launch height h = ${c.h} m, target at x = ${c.target.x} m, height y = ${c.target.y} m (width ${c.target.w} m)`
              + (c.wall ? `, wall at x = ${c.wall.x} m of height ${c.wall.h} m.` : ', no wall.'),
              c.mode === 'angle'
                ? `Fixed speed u = ${c.u} m s⁻¹. Current aim angle = ${snap.setDeg}° (range ${c.h > 0 ? -30 : 0}–85°, step 0.5°).`
                : `Fixed angle θ = ${c.deg}°. Current aim speed = ${snap.setU.toFixed(1)} m s⁻¹ (range 1–45 m s⁻¹, step 0.1).`,
              `Attempts: ${snap.tries.length}, solved: ${snap.solved}, working shown: ${snap.showWork}. Score: hits ${host.tscore.hits}, first-shot ${host.tscore.first}, streak ${host.tscore.streak}.`,
            );
            if (snap.last) lines.push(`Last shot: ${snap.last.hit ? 'HIT' : 'MISS'} — ${snap.last.msg}`);
            if (snap.showWork) lines.push('Working:\n' + snap.lines.join('\n'));
          }
        } else {
          const snap = host.predict()?.kSnapshot();
          if (snap) {
            lines.push(
              `Predict score: ${host.score.right}/${host.score.total}, streak ${host.score.streak}, best ${host.score.best}.`,
              `Question: ${snap.q.prompt}`,
              `Options: ${snap.q.options.map((o, i) => `${i + 1}) ${o}`).join(' | ')}`,
            );
            if (snap.picked) {
              lines.push(`Answered: ${snap.picked} (${snap.ok ? 'Correct' : `Incorrect, answer is ${snap.q.answer}`}).`);
              lines.push('Working:\n' + snap.q.working.join('\n'));
            } else {
              lines.push('Not answered yet (do not reveal the answer before the student attempts it unless asked).');
            }
          }
        }
        return lines.join('\n');
      },
    },
    {
      name: 'projectile_mode',
      description: 'Switch Projectile Lab tab (launch, predict, target), and optionally set target_mode (angle/speed) and course (flat/raised/wall) for Target.',
      parameters: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['launch', 'predict', 'target'], description: 'Lab tab to show.' },
          target_mode: { type: 'string', enum: ['angle', 'speed'], description: 'Target tab only: whether you choose angle or speed.' },
          course: { type: 'string', enum: ['flat', 'raised', 'wall'], description: 'Target tab only: flat (open ground), raised (platform), or wall (over a wall).' },
        },
        required: ['mode'],
      },
      run: async (a) => {
        const m = matchMode(a.mode);
        if (a.target_mode !== undefined) host.tprefs.mode = matchTMode(a.target_mode);
        if (a.course !== undefined) host.tprefs.course = matchCourse(a.course);
        await ensureMode(m);
        await tick();
        if (m === 'target') {
          const snap = host.target()?.kSnapshot();
          if (snap) {
            const c = snap.c;
            return `Switched to Target (${c.mode} mode, ${c.course} course). Launch h = ${c.h} m, target at x = ${c.target.x} m, y = ${c.target.y} m`
              + (c.wall ? `, wall at x = ${c.wall.x} m (height ${c.wall.h} m)` : '')
              + (c.mode === 'angle' ? `. Fixed u = ${c.u} m s⁻¹; choose angle.` : `. Fixed θ = ${c.deg}°; choose speed.`);
          }
        }
        if (m === 'predict') {
          const snap = host.predict()?.kSnapshot();
          if (snap) return `Switched to Predict.\nQuestion: ${snap.q.prompt}\nOptions: ${snap.q.options.map((o, i) => `${i + 1}) ${o}`).join(' | ')}`;
        }
        return `Switched to ${m} tab.`;
      },
    },
    {
      name: 'projectile_set',
      description: 'Adjust Launch tab settings without firing (switches to Launch). Values are clamped to slider ranges; accepts loose input like "moon", "40 deg", "10 m", "heavy".',
      parameters: {
        type: 'object',
        properties: {
          speed: { description: 'Launch speed u in m/s (0–50, step 0.5).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          angle: { description: 'Launch angle in degrees (0–90 when h=0, -60–90 when h>0, step 1).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          height: { description: 'Launch height h in m (0–80, step 1).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          gravity: { description: 'Planet name (Earth, Moon, Mars, Jupiter) or g in N/kg (9.81, 1.62, 3.71, 24.8).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          drag: { description: 'Air resistance: "none" (0), "light" (0.004), or "heavy" (0.02).', oneOf: [{ type: 'number' }, { type: 'string' }, { type: 'boolean' }] },
          playback_speed: { description: 'Animation speed multiplier: 0.25, 1, or 4.', oneOf: [{ type: 'number' }, { type: 'string' }] },
          graph: { type: 'string', enum: ['x', 'y', 'vx', 'vy'], description: 'Quantity plotted against time.' },
          aim: { type: 'boolean', description: 'Show aim preview line.' },
          strobe: { type: 'boolean', description: 'Show strobe images.' },
          shadows: { type: 'boolean', description: 'Show axis shadows.' },
          vectors: { type: 'boolean', description: 'Show velocity component arrows.' },
          time: { description: 'Seek the selected shot to time t (seconds) to inspect position and velocity there.', oneOf: [{ type: 'number' }, { type: 'string' }] },
        },
      },
      run: async (a) => {
        await ensureMode('launch');
        const notes = applyLaunchArgs(a);
        await tick();
        const cmp = host.launch();
        if (a.time !== undefined && cmp) {
          const t = parseNum(a.time, 'time');
          cmp.kSeek(t);
          await tick();
        }
        const p = host.prefs;
        const lines = [
          `Launch settings updated: u = ${p.u} m s⁻¹, θ = ${p.deg}°, h = ${p.h} m, gravity = ${gravName(p.g)}, drag = ${dragName(p.k)}, graph = ${p.graph}, playback = ×${p.speed}.`,
        ];
        if (notes.length) lines.push('Notes: ' + notes.join('; ') + '.');
        if (a.time !== undefined && cmp) {
          const snap = cmp.kSnapshot();
          if (snap.f && snap.p) {
            lines.push(`At t = ${sig(snap.tNow)} s: x = ${sig(snap.p.x)} m, y = ${sig(snap.p.y)} m, vx = ${sig(snap.p.vx)} m s⁻¹, vy = ${sig(snap.p.vy)} m s⁻¹, speed = ${sig(ptSpeed(snap.p))} m s⁻¹.`);
          } else {
            lines.push('No shot fired yet to seek.');
          }
        }
        return lines.join('\n');
      },
    },
    {
      name: 'projectile_launch',
      description: 'Fire a shot on the Launch tab (optionally setting speed, angle, height, gravity, drag first), animate it on screen, wait for it to land, and return all flight readouts.',
      parameters: {
        type: 'object',
        properties: {
          speed: { description: 'Launch speed u in m/s (0–50).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          angle: { description: 'Launch angle in degrees (-60–90 when h>0, else 0–90).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          height: { description: 'Launch height h in m (0–80).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          gravity: { description: 'Earth (9.81), Moon (1.62), Mars (3.71), or Jupiter (24.8).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          drag: { description: 'Air resistance: none (0), light (0.004), or heavy (0.02).', oneOf: [{ type: 'number' }, { type: 'string' }, { type: 'boolean' }] },
          clear_first: { type: 'boolean', description: 'Clear previous shots before firing.' },
        },
      },
      run: async (a) => {
        await ensureMode('launch');
        const cmp = host.launch();
        if (!cmp) throw new Error('Launch view is not ready.');
        if (a.clear_first) cmp.kClear();
        const notes = applyLaunchArgs(a);
        await tick();
        cmp.kFire();
        const finished = await cmp.kWaitFlight(9000);
        const snap = cmp.kSnapshot();
        const out: string[] = [];
        if (notes.length) out.push('Notes: ' + notes.join('; ') + '.');
        if (snap.f) out.push(fmtFlight(snap.f, snap.ideal, snap.sel));
        if (!finished) out.push('(Long flight is still animating on screen; full landing values are shown above.)');
        return out.join('\n');
      },
    },
    {
      name: 'projectile_shots',
      description: 'Replay all saved shots, clear shots, select/remove one shot, pause/play, or load a built-in example comparison (drop, cliff, complement, best, top, drag, moon).',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['replay_all', 'clear', 'select', 'remove', 'example', 'play', 'pause'], description: 'Action to perform on Launch shots.' },
          shot: { type: 'number', description: '1-based shot number for select or remove.' },
          example: { type: 'string', description: 'Example id or name: drop, cliff, complement, best, top, drag, moon.' },
        },
        required: ['action'],
      },
      run: async (a) => {
        await ensureMode('launch');
        const cmp = host.launch();
        if (!cmp) throw new Error('Launch view is not ready.');
        const act = String(a.action ?? '').toLowerCase();
        const shots = host.getShots();
        if (act === 'clear') { cmp.kClear(); return 'Cleared all saved shots.'; }
        if (act === 'play' || act === 'pause') { cmp.kSetPlaying(act === 'play'); return act === 'play' ? 'Playing flight.' : 'Paused flight.'; }
        if (act === 'replay_all') {
          if (!shots.length) throw new Error('No shots saved to replay. Fire a shot first.');
          cmp.kReplayAll();
          const done = await cmp.kWaitFlight(9000);
          const snap = cmp.kSnapshot();
          return `Replayed ${snap.flights.length} shot(s)${done ? '' : ' (still animating)'}:\n`
            + snap.flights.map((fl, i) => fmtFlight(fl, null, i)).join('\n');
        }
        if (act === 'example') {
          const id = matchExample(a.example);
          const ex = EXAMPLES.find((e) => e.id === id)!;
          cmp.kExample(id);
          const done = await cmp.kWaitFlight(9000);
          const snap = cmp.kSnapshot();
          return `Loaded example "${ex.name}" (${ex.note})${done ? '' : ' (still animating)'}:\n`
            + snap.flights.map((fl, i) => fmtFlight(fl, null, i)).join('\n');
        }
        if (act === 'select' || act === 'remove') {
          const n = Math.round(parseNum(a.shot, 'shot'));
          if (n < 1 || n > shots.length) throw new Error(`shot must be between 1 and ${shots.length} (there are ${shots.length} saved shots).`);
          if (act === 'select') {
            cmp.kSelect(n - 1);
            await tick();
            const snap = cmp.kSnapshot();
            return `Selected shot ${n}. ${snap.f ? fmtFlight(snap.f, snap.ideal, snap.sel) : ''}`;
          }
          cmp.kRemove(n - 1);
          return `Removed shot ${n}. ${host.getShots().length} shot(s) remaining.`;
        }
        throw new Error(`action must be one of replay_all, clear, select, remove, example, play, pause (got ${JSON.stringify(a.action)}).`);
      },
    },
    {
      name: 'projectile_target',
      description: 'Control the Target challenge tab: set target_mode/course, aim (angle or speed), fire and wait for hit/miss result, get a new target, or show/hide working.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['fire', 'aim', 'new', 'show_working', 'hide_working'], description: 'Action to take (defaults to fire if angle/speed given, else aim).' },
          target_mode: { type: 'string', enum: ['angle', 'speed'], description: 'Choose angle (fixed speed) or speed (fixed angle).' },
          course: { type: 'string', enum: ['flat', 'raised', 'wall'], description: 'Course type: flat, raised, or wall.' },
          angle: { description: 'Aim angle in degrees (0–85, or -30–85 if launched from a height, step 0.5). Used in angle mode.', oneOf: [{ type: 'number' }, { type: 'string' }] },
          speed: { description: 'Aim launch speed in m/s (1–45, step 0.1). Used in speed mode.', oneOf: [{ type: 'number' }, { type: 'string' }] },
        },
      },
      run: async (a) => {
        if (a.target_mode !== undefined) host.tprefs.mode = matchTMode(a.target_mode);
        if (a.course !== undefined) host.tprefs.course = matchCourse(a.course);
        await ensureMode('target');
        await tick();
        const cmp = host.target();
        if (!cmp) throw new Error('Target view is not ready.');
        const act = String(a.action ?? (a.angle !== undefined || a.speed !== undefined ? 'fire' : 'aim')).toLowerCase();
        if (act === 'new') {
          cmp.kFresh();
          await tick();
          const c = cmp.kSnapshot().c;
          return `New target (${c.mode} mode, ${c.course} course): launch h = ${c.h} m, target at x = ${c.target.x} m, y = ${c.target.y} m (width ${c.target.w} m)`
            + (c.wall ? `, wall at x = ${c.wall.x} m (height ${c.wall.h} m)` : '')
            + (c.mode === 'angle' ? `. Fixed u = ${c.u} m s⁻¹; choose angle.` : `. Fixed θ = ${c.deg}°; choose speed.`);
        }
        if (act === 'show_working' || act === 'hide_working') {
          cmp.kSetWorking(act === 'show_working');
          const snap = cmp.kSnapshot();
          return act === 'show_working' ? 'Working shown:\n' + snap.lines.join('\n') : 'Working hidden.';
        }
        const before = cmp.kSnapshot();
        if (a.angle !== undefined) {
          if (before.c.mode !== 'angle') throw new Error(`Current target is in speed mode (angle is fixed at ${before.c.deg}°). Pass speed instead, or switch target_mode to "angle".`);
          cmp.kSetAngle(parseNum(a.angle, 'angle'));
        }
        if (a.speed !== undefined) {
          if (before.c.mode !== 'speed') throw new Error(`Current target is in angle mode (speed is fixed at ${before.c.u} m s⁻¹). Pass angle instead, or switch target_mode to "speed".`);
          cmp.kSetSpeed(parseNum(a.speed, 'speed'));
        }
        await tick();
        if (act === 'aim') {
          const s = cmp.kSnapshot();
          return `Aim set to ${s.c.mode === 'angle' ? `${s.setDeg}°` : `${s.setU.toFixed(1)} m s⁻¹`} (not fired yet).`;
        }
        if (act === 'fire') {
          cmp.kFire();
          await cmp.kWaitFlight(15000);
          const s = cmp.kSnapshot();
          const o = s.last;
          return (o ? `${o.hit ? 'HIT!' : 'Miss.'} ${o.msg}` : 'Shot fired.')
            + ` (Aimed ${s.c.mode === 'angle' ? `${s.setDeg}° at u = ${s.c.u} m s⁻¹` : `${s.setU.toFixed(1)} m s⁻¹ at θ = ${s.c.deg}°`}; tries: ${s.tries.length}, solved: ${s.solved}.)`;
        }
        throw new Error(`action must be one of fire, aim, new, show_working, hide_working (got ${JSON.stringify(a.action)}).`);
      },
    },
    {
      name: 'projectile_predict',
      description: 'Control the Predict quiz tab: answer the current question (plays the flight and reveals working), replay the flight, or move to the next question.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['answer', 'next', 'replay'], description: 'Action on Predict tab.' },
          answer: { type: 'string', description: 'For action="answer": option text or choice number 1–4 / letter A–D.' },
        },
        required: ['action'],
      },
      run: async (a) => {
        await ensureMode('predict');
        const cmp = host.predict();
        if (!cmp) throw new Error('Predict view is not ready.');
        const act = String(a.action ?? '').toLowerCase();
        if (act === 'next') {
          cmp.kNext();
          await tick();
          const s = cmp.kSnapshot();
          return `Next question: ${s.q.prompt}\nOptions: ${s.q.options.map((o, i) => `${i + 1}) ${o}`).join(' | ')}`;
        }
        if (act === 'replay') {
          const s = cmp.kSnapshot();
          if (!s.picked) throw new Error('Answer the question first before replaying.');
          cmp.kReplay();
          await cmp.kWaitFlight(12000);
          return 'Replayed the flight.';
        }
        if (act === 'answer') {
          const s0 = cmp.kSnapshot();
          if (s0.picked) throw new Error('This question is already answered. Call with action="next" for a new question.');
          const opt = matchOption(a.answer, s0.q.options);
          cmp.kAnswer(opt);
          await cmp.kWaitFlight(12000);
          const s = cmp.kSnapshot();
          return `${s.ok ? 'Correct!' : `Not quite — correct answer is ${s.q.answer}.`} (Picked: ${opt})\nWorking:\n${s.q.working.join('\n')}\nWhy: ${s.q.why}`;
        }
        throw new Error(`action must be answer, next or replay (got ${JSON.stringify(a.action)}).`);
      },
    },
  ]);
}
