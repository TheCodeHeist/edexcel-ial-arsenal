/* Kernel live tools for Fields Lab: drives Electric, Magnetic, Charged particles (Lorentz), EM induction, Gravity and Practice. */
import { tick } from 'svelte';
import { provideKernelTools } from '../../lib/kernel/live';
import { ELECTRIC_PRESETS, type ElectricPreset, type ElectricPresetId, type PointCharge } from './electric';
import { type MagMode } from './magnetic';
import { PARTICLES, type ParticleDef, type ParticleId } from './lorentz';
import { type IndMode } from './induction';
import { BODIES, type BodyPreset } from './gravity';
import { TOPICS, type Topic, type Question } from './practice';
import { sci, signed } from './consts';
import type { ElectricPrefs } from './Electric.svelte';
import type { MagPrefs } from './Magnetic.svelte';
import type { LorentzPrefs } from './Lorentz.svelte';
import type { IndPrefs } from './Induction.svelte';
import type { GravityPrefs } from './Gravity.svelte';
import type { PScore } from './Practice.svelte';

export type Mode = 'electric' | 'magnetic' | 'lorentz' | 'induction' | 'gravity' | 'practice';

export interface FieldsHost {
  getMode(): Mode;
  setMode(m: Mode): void;
  elec: ElectricPrefs;
  mag: MagPrefs;
  lor: LorentzPrefs;
  ind: IndPrefs;
  grav: GravityPrefs;
  score: PScore;
  topic: { t: Topic | 'all' };
  cmp: {
    elec(): {
      kSetPreset(id: ElectricPresetId): void; kSetCustom(charges: PointCharge[] | null): void; kAddCharge(c: PointCharge, clear?: boolean): void; kSetPlaying(on: boolean): void;
      kReadouts(): { playing: boolean; custom: boolean; activeMode: 'radial' | 'plates'; activeCharges: PointCharge[]; activeName: string; preset: ElectricPreset; probe: { ex: number; ey: number; eMag: number; v: number; insideCharge: boolean }; plateE: number };
    } | undefined;
    mag(): {
      kReadouts(): { F: number; fDirLabel: string };
    } | undefined;
    lor(): {
      kSetPlaying(on: boolean): void; kBalance(): void;
      kReadouts(): { playing: boolean; p: ParticleDef; vPhys: number; bPhys: number; ePhys: number; cyc: { r: number; T: number; F: number }; vSel: number; matched: boolean };
    } | undefined;
    ind(): {
      kSetPlaying(on: boolean): void;
      kReadouts(): { playing: boolean; phase: number; gen: { theta: number; fluxLink: number; emf: number; peakEmf: number }; mag: { x: number; fluxLink: number; emf: number }; fluxNow: number; emfNow: number };
    } | undefined;
    grav(): {
      kSetPlaying(on: boolean): void;
      kReadouts(): { playing: boolean; body: BodyPreset; orb: { r: number; g: number; vg: number; vOrb: number; vEsc: number; T: number }; tHours: number; isGeo: boolean };
    } | undefined;
    practice(): {
      kAnswer(o: string): void; kNext(): void;
      kSnapshot(): { q: Question; picked: string | null; ok: boolean };
    } | undefined;
  };
}

function num(v: unknown, label: string): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const m = v.replace(/−/g, '-').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
    if (m) { const n = Number(m[0]); if (Number.isFinite(n)) return n; }
  }
  throw new Error(`${label} must be a number (got ${JSON.stringify(v)}).`);
}

function clamp(x: number, lo: number, hi: number, step?: number): { val: number; clamped: boolean } {
  const c = Math.max(lo, Math.min(hi, x));
  const v = step ? Number((Math.round(c / step) * step).toFixed(6)) : c;
  return { val: Math.max(lo, Math.min(hi, v)), clamped: Math.abs(c - x) > 1e-9 };
}

function matchMode(raw: unknown): Mode {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s.includes('elec') || s.includes('plate') || s.includes('charge')) return 'electric';
  if (s.includes('mag') || s.includes('bil') || s.includes('motor') || s.includes('solenoid') || s === 'wire') return 'magnetic';
  if (s.includes('lor') || s.includes('bqv') || s.includes('part') || s.includes('orbit') || s.includes('select') || s.includes('electron')) return 'lorentz';
  if (s.includes('ind') || s.includes('gen') || s.includes('faraday') || s.includes('lenz')) return 'induction';
  if (s.includes('grav') || s.includes('planet') || s.includes('geo')) return 'gravity';
  if (s.includes('prac') || s === 'quiz') return 'practice';
  throw new Error(`mode must be one of electric, magnetic, lorentz, induction, gravity, practice (got ${JSON.stringify(raw)}).`);
}

function matchPreset(raw: unknown): ElectricPresetId {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'pos' || s.includes('single +') || s === '+q') return 'pos';
  if (s === 'neg' || s.includes('single -') || s.includes('single −') || s === '-q') return 'neg';
  if (s === 'dipole' || s.includes('dip')) return 'dipole';
  if (s === 'like' || s.includes('same') || s.includes('neutral')) return 'like';
  if (s === 'unequal' || s.includes('2q')) return 'unequal';
  if (s === 'plates' || s.includes('plate') || s.includes('uniform') || s.includes('parallel')) return 'plates';
  throw new Error(`preset must be one of ${ELECTRIC_PRESETS.map((p) => `${p.id} (${p.name})`).join(', ')} (got ${JSON.stringify(raw)}).`);
}

function matchParticle(raw: unknown): ParticleId {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'e' || s === 'e-' || s === 'e−' || s.includes('elec')) return 'electron';
  if (s === 'p' || s === 'p+' || s.includes('prot')) return 'proton';
  if (s === 'a' || s === 'α' || s.includes('alpha') || s.includes('he')) return 'alpha';
  throw new Error(`particle must be one of electron, proton, alpha (got ${JSON.stringify(raw)}).`);
}

function matchBody(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  const b = BODIES.find((x) => x.id === s || x.name.toLowerCase() === s || x.name.toLowerCase().includes(s));
  if (b) return b.id;
  throw new Error(`body must be one of ${BODIES.map((x) => x.id).join(', ')} (got ${JSON.stringify(raw)}).`);
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

function parseCm(v: unknown, label: string): number {
  const n = num(v, label);
  const s = typeof v === 'string' ? v.toLowerCase() : '';
  if (s.includes('mm')) return n / 10;
  if (/\bm\b/.test(s) && !s.includes('cm') && !s.includes('mm')) return n * 100;
  return n;
}

function parseCharge(raw: Record<string, unknown>): PointCharge {
  const qRaw = raw.q_uC ?? raw.q ?? raw.charge;
  let q = num(qRaw, 'q_uC');
  const qs = typeof qRaw === 'string' ? qRaw.toLowerCase() : '';
  if (qs.includes('nc')) q /= 1000;
  else if (qs.includes('mc')) q *= 1000;
  if (Math.abs(q) < 0.05) throw new Error('Charge magnitude must be at least 0.05 μC (non-zero).');
  q = Math.max(-10, Math.min(10, Number(q.toFixed(2))));
  const xCm = raw.x_cm !== undefined ? parseCm(raw.x_cm, 'x_cm') : raw.x !== undefined ? parseCm(raw.x, 'x') : 0;
  const yCm = raw.y_cm !== undefined ? parseCm(raw.y_cm, 'y_cm') : raw.y !== undefined ? parseCm(raw.y, 'y') : 0;
  // 1 world unit = 10 cm; keep inside visible stage (-28..28 cm, -18..18 cm)
  const x = clamp(xCm / 10, -2.8, 2.8, 0.05).val;
  const y = clamp(yCm / 10, -1.8, 1.8, 0.05).val;
  return { x, y, qMicro: q };
}

const ABOUT = 'Fields Lab (Edexcel IAL Physics Units 4 & 5) is open with 6 interactive 3D tabs: electric (radial Coulomb fields, presets or custom point charges, test probe, and uniform parallel plates E = V/d), magnetic (F = BIL sin θ motor effect, straight wire, solenoid), lorentz (charged particles in circular magnetic orbits r = mv/BQ and crossed E/B velocity selector), induction (AC generator & plunging bar magnet), gravity (3D potential well, orbits & geostationary altitude) and practice. '
  + 'Use fields_ tools to inspect state, switch tabs, place charges, set parallel-plate voltages, fire particles into magnetic/crossed fields, and control every experiment on screen.';

export function provideFieldsTools(host: FieldsHost): () => void {
  async function ensureMode(m: Mode) {
    if (host.getMode() !== m) { host.setMode(m); await tick(); }
  }

  function describeTab(m: Mode): string {
    const lines: string[] = [`Tab: ${m} (all tabs: electric, magnetic, lorentz, induction, gravity, practice)`];
    if (m === 'electric') {
      const p = host.elec, r = host.cmp.elec()?.kReadouts();
      const mode = r?.activeMode ?? 'radial';
      lines.push(`Arrangement: ${r?.activeName ?? p.preset} (presets: pos, neg, dipole, like, unequal, plates; custom charges supported). Equipotentials: ${p.showEquipot}.`);
      if (mode === 'radial') {
        const ch = (r?.activeCharges ?? []).map((c, i) => `#${i + 1}: ${c.qMicro > 0 ? '+' : ''}${c.qMicro} μC at (${(c.x * 10).toFixed(1)} cm, ${(c.y * 10).toFixed(1)} cm)`).join('; ');
        lines.push(
          `Charges: ${ch || 'none'}.`,
          `Test probe (+q): x = ${signed(p.probeX * 10, 1)} cm (-28..28 cm), y = ${signed(p.probeY * 10, 1)} cm (-18..18 cm).`,
          r ? (r.probe.insideCharge ? 'Readouts at probe: inside charge sphere (move probe away).' : `Readouts at probe: |E| = ${sci(r.probe.eMag, 3)} N C⁻¹ (Ex = ${sci(r.probe.ex, 3)}, Ey = ${sci(r.probe.ey, 3)}), V = ${sci(r.probe.v, 3)} V.`) : '',
        );
      } else {
        const E = r?.plateE ?? (p.plateV * 1000) / (p.plateD / 100);
        lines.push(
          `Parallel plates: V = ${p.plateV.toFixed(1)} kV (${Math.round(p.plateV * 1000)} V; range 0.5–5.0 kV), separation d = ${p.plateD.toFixed(1)} cm (range 2.0–10.0 cm), electron beam playing = ${r?.playing ?? true}.`,
          `Readouts: uniform E = V/d = ${sci(E, 3)} V m⁻¹, force on e⁻ = ${sci(E * 1.6e-19, 3)} N.`,
        );
      }
    } else if (m === 'magnetic') {
      const p = host.mag, r = host.cmp.mag()?.kReadouts();
      lines.push(`View: ${p.mode} (motor / wire / solenoid). Current reversed: ${p.revI}${p.mode === 'motor' ? `, N/S poles swapped: ${p.revB}` : ''}.`);
      if (p.mode === 'motor') {
        lines.push(
          `Parameters: B = ${p.B.toFixed(2)} T (0.1–1.5), I = ${p.I.toFixed(1)} A (0.5–10), L = ${p.L.toFixed(2)} m (0.1–1.0), θ = ${p.angle}° (0–90).`,
          r ? `Readouts: F = BIL sin θ = ${r.F.toFixed(2)} N, direction: ${r.fDirLabel}.` : '',
        );
      }
    } else if (m === 'lorentz') {
      const p = host.lor, r = host.cmp.lor()?.kReadouts();
      const pt = PARTICLES[p.particle];
      const vPhys = p.vScale * 1e6, bPhys = p.bScale * 0.05, ePhys = p.eScale * 5e4;
      lines.push(
        `View: ${p.mode} (orbit / selector). Particle: ${pt.id} (${pt.name}, ${pt.sym}). Playing: ${r?.playing ?? true}.`,
        `Parameters: speed v = ${sci(vPhys, 3)} m s⁻¹ (scale ${p.vScale.toFixed(2)}, range 0.4–2.0 × 10⁶ m s⁻¹), B = ${bPhys.toFixed(3)} T (scale ${p.bScale.toFixed(2)}, range 0.02–0.10 T)`
        + (p.mode === 'selector' ? `, E = ${sci(ePhys, 3)} V m⁻¹ (scale ${p.eScale.toFixed(2)}, range 7.5×10³–2.0×10⁵ V m⁻¹).` : '.'),
      );
      if (r) {
        lines.push(
          `Readouts: magnetic force F = ${sci(r.cyc.F, 3)} N, orbit radius r = ${sci(r.cyc.r, 3)} m, cyclotron period T = ${sci(r.cyc.T, 3)} s`
          + (p.mode === 'selector' ? `, selected speed E/B = ${sci(r.vSel, 3)} m s⁻¹ → ${r.matched ? 'BALANCED (passes through slit)' : 'UNBALANCED (deflected)'}.` : '.'),
        );
      }
    } else if (m === 'induction') {
      const p = host.ind, r = host.cmp.ind()?.kReadouts();
      lines.push(
        `View: ${p.mode} (generator / magnet). Playing: ${r?.playing ?? true}.`,
        `Parameters: turns N = ${p.N} (50–500, step 25), frequency f = ${p.freq.toFixed(1)} Hz (0.2–2.5)` + (p.mode === 'generator' ? `, B = ${p.B.toFixed(2)} T (0.1–1.2), coil area A = 0.015 m².` : '.'),
      );
      if (r) {
        lines.push(`Readouts: flux linkage NΦ = ${r.fluxNow.toFixed(2)} Wb, induced ε = ${signed(r.emfNow, 2)} V` + (p.mode === 'generator' ? `, peak ε₀ = BANω = ${r.gen.peakEmf.toFixed(2)} V.` : '.'));
      }
    } else if (m === 'gravity') {
      const p = host.grav, r = host.cmp.grav()?.kReadouts();
      const b = BODIES.find((x) => x.id === p.body) ?? BODIES[0];
      lines.push(
        `Body: ${b.id} (${b.name}; earth/moon/mars/jupiter). Orbital radius: r = ${p.rRatio.toFixed(2)} R (range 1.3–7.0 R). Playing: ${r?.playing ?? true}.`,
      );
      if (r) {
        lines.push(`Readouts: r = ${sci(r.orb.r / 1000, 3)} km, g = ${r.orb.g.toFixed(2)} N kg⁻¹, Vg = ${sci(r.orb.vg, 3)} J kg⁻¹, orbital speed v = ${(r.orb.vOrb / 1000).toFixed(2)} km s⁻¹, escape speed = ${(r.orb.vEsc / 1000).toFixed(2)} km s⁻¹, period T = ${r.tHours.toFixed(2)} h (${sci(r.orb.T, 3)} s)${r.isGeo ? ' [Geostationary!]' : ''}.`);
      }
    } else {
      const s = host.cmp.practice()?.kSnapshot();
      lines.push(`Practice topic: ${host.topic.t} (all/electric/magnetic/lorentz/induction/gravity). Score: ${host.score.right}/${host.score.total}, streak ${host.score.streak}.`);
      if (s) {
        lines.push(`Question: ${s.q.prompt}`, `Options: ${s.q.options.map((o, i) => `${i + 1}) ${o}`).join(' | ')}`);
        if (s.picked) lines.push(`Answered: ${s.picked} (${s.ok ? 'Correct' : `Incorrect, answer is ${s.q.answer}`}).\nWorking:\n${s.q.working.join('\n')}`);
        else lines.push('Not answered yet (do not reveal the answer before the student attempts it unless asked).');
      }
    }
    return lines.filter(Boolean).join('\n');
  }

  return provideKernelTools('fields', ABOUT, [
    {
      name: 'fields_state',
      description: 'Read the active tab of Fields Lab: mode, sub-mode, every adjustable parameter with value, range and unit, and all current readouts.',
      parameters: { type: 'object', properties: {} },
      run: () => describeTab(host.getMode()),
    },
    {
      name: 'fields_mode',
      description: 'Switch Fields Lab tab (electric, magnetic, lorentz, induction, gravity, practice) and optionally its sub-mode.',
      parameters: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['electric', 'magnetic', 'lorentz', 'induction', 'gravity', 'practice'] },
          sub: { type: 'string', description: 'Optional sub-mode: electric preset (pos/neg/dipole/like/unequal/plates), magnetic (motor/wire/solenoid), lorentz (orbit/selector), induction (generator/magnet), gravity body (earth/moon/mars/jupiter), or practice topic.' },
        },
        required: ['mode'],
      },
      run: async (a) => {
        const m = matchMode(a.mode);
        if (a.sub !== undefined) {
          const s = String(a.sub).trim().toLowerCase();
          if (m === 'electric') { host.cmp.elec()?.kSetPreset(matchPreset(s)); }
          else if (m === 'magnetic') {
            const mv: MagMode = s.includes('wire') ? 'wire' : s.includes('sol') ? 'solenoid' : s.includes('mot') || s.includes('bil') ? 'motor' : (() => { throw new Error('magnetic sub must be motor, wire or solenoid.'); })();
            host.mag.mode = mv;
          } else if (m === 'lorentz') {
            const lv = s.includes('sel') ? 'selector' : s.includes('orb') ? 'orbit' : (() => { throw new Error('lorentz sub must be orbit or selector.'); })();
            host.lor.mode = lv;
          } else if (m === 'induction') {
            const iv: IndMode = s.includes('mag') ? 'magnet' : s.includes('gen') ? 'generator' : (() => { throw new Error('induction sub must be generator or magnet.'); })();
            host.ind.mode = iv;
          } else if (m === 'gravity') { host.grav.body = matchBody(s); }
          else if (m === 'practice') {
            const t = TOPICS.find(([id, nm]) => id === s || nm.toLowerCase().includes(s));
            if (!t) throw new Error(`practice sub must be one of ${TOPICS.map(([id]) => id).join(', ')}.`);
            host.topic.t = t[0];
          }
        }
        await ensureMode(m);
        await tick();
        return describeTab(m);
      },
    },
    {
      name: 'fields_electric',
      description: 'Configure the Electric fields tab: pick a preset (pos, neg, dipole, like, unequal, plates) OR place custom point charges (array of {q_uC, x_cm, y_cm}), adjust parallel-plate voltage (500–5000 V / 0.5–5.0 kV) and separation (2–10 cm), move the test probe, or toggle equipotentials.',
      parameters: {
        type: 'object',
        properties: {
          preset: { type: 'string', enum: ['pos', 'neg', 'dipole', 'like', 'unequal', 'plates'], description: 'Built-in charge arrangement or parallel plates.' },
          charges: {
            type: 'array',
            description: 'Custom point charges (1–6 charges) to display instead of a preset. Coordinates in cm (x: -28..28, y: -18..18), charge in μC (-10..10, non-zero).',
            items: {
              type: 'object',
              properties: {
                q_uC: { description: 'Charge in μC (-10..10, non-zero).', oneOf: [{ type: 'number' }, { type: 'string' }] },
                x_cm: { description: 'Horizontal position in cm (-28..28).', oneOf: [{ type: 'number' }, { type: 'string' }] },
                y_cm: { description: 'Vertical position in cm (-18..18).', oneOf: [{ type: 'number' }, { type: 'string' }] },
              },
              required: ['q_uC'],
            },
          },
          plate_voltage: { description: 'Parallel plates potential difference: 0.5–5.0 kV, or 500–5000 V (e.g. "500 V", "2 kV", 500, 2).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          plate_separation_cm: { description: 'Parallel plates separation d in cm (2.0–10.0, step 0.5).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          probe_x_cm: { description: 'Test probe x position in cm (-28..28).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          probe_y_cm: { description: 'Test probe y position in cm (-18..18).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          probe_midpoint: { type: 'boolean', description: 'Place test probe at midpoint (0, 0).' },
          show_equipotentials: { type: 'boolean' },
          playing: { type: 'boolean', description: 'Play/pause the electron beam in parallel plates mode.' },
        },
      },
      run: async (a) => {
        await ensureMode('electric');
        const p = host.elec, cmp = host.cmp.elec(), notes: string[] = [];
        if (a.preset !== undefined) cmp?.kSetPreset(matchPreset(a.preset));
        if (Array.isArray(a.charges)) {
          if (!a.charges.length) throw new Error('charges array must contain at least one charge.');
          const parsed = a.charges.slice(0, 6).map((c) => parseCharge(c as Record<string, unknown>));
          cmp?.kSetCustom(parsed);
        }
        if (a.plate_voltage !== undefined) {
          if (a.preset === undefined && !Array.isArray(a.charges)) cmp?.kSetPreset('plates');
          let kv = num(a.plate_voltage, 'plate_voltage');
          const s = typeof a.plate_voltage === 'string' ? a.plate_voltage.toLowerCase() : '';
          if ((s.includes('v') && !s.includes('kv')) || kv > 10) kv /= 1000;
          const r = clamp(kv, 0.5, 5.0, 0.5);
          p.plateV = r.val; if (r.clamped) notes.push(`V clamped to ${r.val.toFixed(1)} kV (range 0.5–5.0 kV)`);
        }
        if (a.plate_separation_cm !== undefined) {
          const r = clamp(parseCm(a.plate_separation_cm, 'plate_separation_cm'), 2.0, 10.0, 0.5);
          p.plateD = r.val; if (r.clamped) notes.push(`d clamped to ${r.val.toFixed(1)} cm (range 2–10 cm)`);
        }
        if (a.probe_midpoint) { p.probeX = 0; p.probeY = 0; }
        if (a.probe_x_cm !== undefined) p.probeX = clamp(parseCm(a.probe_x_cm, 'probe_x_cm') / 10, -2.8, 2.8, 0.1).val;
        if (a.probe_y_cm !== undefined) p.probeY = clamp(parseCm(a.probe_y_cm, 'probe_y_cm') / 10, -1.8, 1.8, 0.1).val;
        if (typeof a.show_equipotentials === 'boolean') p.showEquipot = a.show_equipotentials;
        if (typeof a.playing === 'boolean') cmp?.kSetPlaying(a.playing);
        await tick();
        return (notes.length ? `Notes: ${notes.join('; ')}.\n` : '') + describeTab('electric');
      },
    },
    {
      name: 'fields_add_charge',
      description: 'Add a point charge (in μC) at (x_cm, y_cm) to the Electric fields 3D scene. Set clear=true to start a fresh custom arrangement with this charge.',
      parameters: {
        type: 'object',
        properties: {
          q_uC: { description: 'Charge in μC (-10..10, non-zero), e.g. 2 or -1.', oneOf: [{ type: 'number' }, { type: 'string' }] },
          x_cm: { description: 'Horizontal position in cm (-28..28, default 0).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          y_cm: { description: 'Vertical position in cm (-18..18, default 0).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          clear: { type: 'boolean', description: 'If true, remove existing charges before adding this one.' },
        },
        required: ['q_uC'],
      },
      run: async (a) => {
        await ensureMode('electric');
        const c = parseCharge(a);
        host.cmp.elec()?.kAddCharge(c, Boolean(a.clear));
        await tick();
        return describeTab('electric');
      },
    },
    {
      name: 'fields_magnetic',
      description: 'Configure the Magnetic & F=BIL tab: view (motor, wire, solenoid), flux density B (0.1–1.5 T), current I (0.5–10 A), wire length L (0.1–1.0 m), angle θ (0–90°), and reverse current or N/S poles.',
      parameters: {
        type: 'object',
        properties: {
          view: { type: 'string', enum: ['motor', 'wire', 'solenoid'] },
          B_T: { description: 'Magnetic flux density B in tesla (0.1–1.5, step 0.05).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          I_A: { description: 'Current I in amps (0.5–10, step 0.5).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          L_m: { description: 'Wire length in field L in metres (0.1–1.0, step 0.05).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          angle_deg: { description: 'Angle θ between current and field in degrees (0–90, step 5).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          reverse_I: { type: 'boolean', description: 'Reverse current direction.' },
          reverse_B: { type: 'boolean', description: 'Swap N and S magnet poles (motor mode).' },
        },
      },
      run: async (a) => {
        await ensureMode('magnetic');
        const p = host.mag, notes: string[] = [];
        if (a.view !== undefined) {
          const s = String(a.view).toLowerCase();
          if (s.includes('wire')) p.mode = 'wire';
          else if (s.includes('sol')) p.mode = 'solenoid';
          else if (s.includes('mot') || s.includes('bil')) p.mode = 'motor';
          else throw new Error('view must be motor, wire or solenoid.');
        }
        if (a.B_T !== undefined) { const r = clamp(num(a.B_T, 'B_T'), 0.1, 1.5, 0.05); p.B = r.val; if (r.clamped) notes.push(`B clamped to ${r.val} T`); }
        if (a.I_A !== undefined) { const r = clamp(num(a.I_A, 'I_A'), 0.5, 10, 0.5); p.I = r.val; if (r.clamped) notes.push(`I clamped to ${r.val} A`); }
        if (a.L_m !== undefined) { const r = clamp(num(a.L_m, 'L_m'), 0.1, 1.0, 0.05); p.L = r.val; if (r.clamped) notes.push(`L clamped to ${r.val} m`); }
        if (a.angle_deg !== undefined) { const r = clamp(num(a.angle_deg, 'angle_deg'), 0, 90, 5); p.angle = r.val; if (r.clamped) notes.push(`θ clamped to ${r.val}°`); }
        if (typeof a.reverse_I === 'boolean') p.revI = a.reverse_I;
        if (typeof a.reverse_B === 'boolean') p.revB = a.reverse_B;
        await tick();
        return (notes.length ? `Notes: ${notes.join('; ')}.\n` : '') + describeTab('magnetic');
      },
    },
    {
      name: 'fields_lorentz',
      description: 'Configure and run the Charged particles tab: circular magnetic orbit (r = mv/BQ) or crossed E & B velocity selector (v = E/B). Choose electron, proton or alpha, set speed/B/E, balance v = E/B, and play/pause.',
      parameters: {
        type: 'object',
        properties: {
          view: { type: 'string', enum: ['orbit', 'selector'] },
          particle: { type: 'string', description: 'electron (e-), proton (p+), or alpha (He2+).' },
          speed: { description: 'Particle speed: either in m/s (0.4e6–2.0e6) or slider scale (0.4–2.0 × 10⁶ m/s).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          B_T: { description: 'Magnetic flux density B: in T (0.02–0.10), mT (20–100 mT), or slider scale (0.4–2.0 × 0.05 T).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          E_V_m: { description: 'Electric field E (selector mode): in V/m (7500–200000), kV/m (7.5–200), or slider scale (0.15–4.0 × 5×10⁴ V/m).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          balance: { type: 'boolean', description: 'In selector mode, set E so v = E/B and the beam passes straight through.' },
          playing: { type: 'boolean', description: 'Play or pause the particle animation (defaults to true when firing/switching).' },
        },
      },
      run: async (a) => {
        await ensureMode('lorentz');
        const p = host.lor, cmp = host.cmp.lor(), notes: string[] = [];
        if (a.view !== undefined) {
          const s = String(a.view).toLowerCase();
          if (s.includes('sel')) p.mode = 'selector';
          else if (s.includes('orb')) p.mode = 'orbit';
          else throw new Error('view must be orbit or selector.');
        }
        if (a.particle !== undefined) p.particle = matchParticle(a.particle);
        if (a.speed !== undefined) {
          let sc = num(a.speed, 'speed');
          if (sc > 100) sc /= 1e6; // accept m/s as well as scale
          const r = clamp(sc, 0.4, 2.0, 0.05);
          p.vScale = r.val; if (r.clamped) notes.push(`v clamped to ${sci(r.val * 1e6, 3)} m s⁻¹`);
        }
        if (a.B_T !== undefined) {
          let b = num(a.B_T, 'B_T');
          const s = typeof a.B_T === 'string' ? a.B_T.toLowerCase() : '';
          let sc: number;
          if (s.includes('mt')) sc = (b / 1000) / 0.05;
          else if (b <= 0.25) sc = b / 0.05;
          else sc = b; // scale 0.4..2.0
          const r = clamp(sc, 0.4, 2.0, 0.05);
          p.bScale = r.val; if (r.clamped) notes.push(`B clamped to ${(r.val * 0.05).toFixed(3)} T`);
        }
        if (a.E_V_m !== undefined) {
          p.mode = 'selector';
          let e = num(a.E_V_m, 'E_V_m');
          const s = typeof a.E_V_m === 'string' ? a.E_V_m.toLowerCase() : '';
          let sc: number;
          if (s.includes('kv')) sc = (e * 1000) / 5e4;
          else if (e > 20) sc = e / 5e4;
          else sc = e; // scale 0.15..4.0
          const r = clamp(sc, 0.15, 4.0, 0.05);
          p.eScale = r.val; if (r.clamped) notes.push(`E clamped to ${sci(r.val * 5e4, 3)} V m⁻¹`);
        }
        if (a.balance) { p.mode = 'selector'; cmp?.kBalance(); }
        if (typeof a.playing === 'boolean') cmp?.kSetPlaying(a.playing);
        else cmp?.kSetPlaying(true); // ensure the particle visibly fires/orbits on screen
        await tick();
        return (notes.length ? `Notes: ${notes.join('; ')}.\n` : '') + describeTab('lorentz');
      },
    },
    {
      name: 'fields_induction',
      description: 'Configure and control the EM induction tab: rotating AC generator or bar magnet plunging through a coil, number of turns N (50–500), flux density B (0.1–1.2 T), frequency f (0.2–2.5 Hz), and play/pause.',
      parameters: {
        type: 'object',
        properties: {
          view: { type: 'string', enum: ['generator', 'magnet'] },
          turns: { description: 'Number of coil turns N (50–500, step 25).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          B_T: { description: 'Magnetic flux density B in tesla (0.1–1.2, step 0.05, generator mode).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          frequency_hz: { description: 'Rotation / oscillation frequency in Hz (0.2–2.5, step 0.1).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          playing: { type: 'boolean' },
        },
      },
      run: async (a) => {
        await ensureMode('induction');
        const p = host.ind, cmp = host.cmp.ind(), notes: string[] = [];
        if (a.view !== undefined) {
          const s = String(a.view).toLowerCase();
          if (s.includes('mag')) p.mode = 'magnet';
          else if (s.includes('gen')) p.mode = 'generator';
          else throw new Error('view must be generator or magnet.');
        }
        if (a.turns !== undefined) { const r = clamp(num(a.turns, 'turns'), 50, 500, 25); p.N = r.val; if (r.clamped) notes.push(`N clamped to ${r.val}`); }
        if (a.B_T !== undefined) { const r = clamp(num(a.B_T, 'B_T'), 0.1, 1.2, 0.05); p.B = r.val; if (r.clamped) notes.push(`B clamped to ${r.val} T`); }
        if (a.frequency_hz !== undefined) { const r = clamp(num(a.frequency_hz, 'frequency_hz'), 0.2, 2.5, 0.1); p.freq = r.val; if (r.clamped) notes.push(`f clamped to ${r.val} Hz`); }
        if (typeof a.playing === 'boolean') cmp?.kSetPlaying(a.playing);
        await tick();
        return (notes.length ? `Notes: ${notes.join('; ')}.\n` : '') + describeTab('induction');
      },
    },
    {
      name: 'fields_gravity',
      description: 'Configure and control the Gravity vs Electric tab: pick planet/body (earth, moon, mars, jupiter), set orbital radius r/R (1.3–7.0), jump to Earth geostationary orbit (24 h, 6.62 R), and play/pause.',
      parameters: {
        type: 'object',
        properties: {
          body: { type: 'string', enum: ['earth', 'moon', 'mars', 'jupiter'] },
          r_ratio: { description: 'Orbital radius as multiple of body radius R (1.3–7.0, step 0.02).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          geostationary: { type: 'boolean', description: 'Set Earth and geostationary orbital radius r = 6.62 R (T ≈ 24 h).' },
          playing: { type: 'boolean' },
        },
      },
      run: async (a) => {
        await ensureMode('gravity');
        const p = host.grav, cmp = host.cmp.grav(), notes: string[] = [];
        if (a.body !== undefined) p.body = matchBody(a.body);
        if (a.geostationary) { p.body = 'earth'; p.rRatio = 6.62; }
        else if (a.r_ratio !== undefined) {
          const r = clamp(num(a.r_ratio, 'r_ratio'), 1.3, 7.0, 0.02);
          p.rRatio = r.val; if (r.clamped) notes.push(`r clamped to ${r.val} R`);
        }
        if (typeof a.playing === 'boolean') cmp?.kSetPlaying(a.playing);
        await tick();
        return (notes.length ? `Notes: ${notes.join('; ')}.\n` : '') + describeTab('gravity');
      },
    },
    {
      name: 'fields_practice',
      description: 'Control the Fields Lab Practice quiz tab: choose topic (all, electric, magnetic, lorentz, induction, gravity), answer the current question, or move to the next question.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', enum: ['all', 'electric', 'magnetic', 'lorentz', 'induction', 'gravity'] },
          action: { type: 'string', enum: ['next', 'answer'] },
          answer: { type: 'string', description: 'Option text or 1–4 / A–D when action="answer".' },
        },
      },
      run: async (a) => {
        if (a.topic !== undefined) {
          const s = String(a.topic).toLowerCase();
          const t = TOPICS.find(([id, nm]) => id === s || nm.toLowerCase().includes(s));
          if (!t) throw new Error(`topic must be one of ${TOPICS.map(([id]) => id).join(', ')}.`);
          host.topic.t = t[0];
        }
        await ensureMode('practice');
        await tick();
        const cmp = host.cmp.practice();
        if (a.action && cmp) {
          const act = String(a.action).toLowerCase();
          if (act === 'next') cmp.kNext();
          else if (act === 'answer') {
            const s0 = cmp.kSnapshot();
            if (s0.picked) throw new Error('Already answered. Call with action="next" for a new question.');
            cmp.kAnswer(matchOption(a.answer, s0.q.options));
          } else throw new Error('action must be next or answer.');
        }
        await tick();
        return describeTab('practice');
      },
    },
  ]);
}
