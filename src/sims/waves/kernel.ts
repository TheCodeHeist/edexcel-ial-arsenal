/* Kernel live tools for Waves Lab: drives all 8 tabs through the exact same reactive prefs and component actions. */
import { tick } from 'svelte';
import { provideKernelTools } from '../../lib/kernel/live';
import { MEDIA, aText, lenText, timeText, piText, type Medium, type MediumSpec, type MediumSet } from './bench';
import { WIRES, tension, waveSpeed, f1Of, soundSpeed, tubeF, type XAxis, type TubeEnd, type Wire } from './standing';
import { V as RIPPLE_V, lamText, type RMode } from './ripple';
import { MATERIALS, SHAPES, MAX_ANGLE, type Shape, type Hit } from './light';
import { LASERS, BODIES, type LaserId, type Order, type Body } from './grating';
import { SCENARIOS, dB, type Scenario, type Echo as EchoHit } from './echo';
import { METALS, ATOMS, f0, nm0, vMax, type Metal, type Atom, type Line, type Band } from './photon';
import { TOPICS, type Topic, type Question } from './practice';
import { sci, plain, short, C } from './consts';
import type { BenchPrefs } from './Bench.svelte';
import type { RipplePrefs } from './Ripple.svelte';
import type { StandPrefs } from './Standing.svelte';
import type { LightPrefs } from './Light.svelte';
import type { GratePrefs } from './Grating.svelte';
import type { EchoPrefs } from './Echo.svelte';
import type { PhotonPrefs } from './Photon.svelte';
import type { PScore } from './Practice.svelte';

export type Mode = 'wave' | 'ripple' | 'standing' | 'light' | 'grating' | 'echo' | 'photon' | 'practice';

export interface WavesHost {
  getMode(): Mode;
  setMode(m: Mode): void;
  bench: BenchPrefs;
  ripple: RipplePrefs;
  stand: StandPrefs;
  light: LightPrefs;
  grate: GratePrefs;
  echo: EchoPrefs;
  photon: PhotonPrefs;
  score: PScore;
  topic: { t: Topic | 'all' };
  cmp: {
    bench(): {
      kSetPlaying(on: boolean): void; kStep(): void; kRestart(): void; kSendPulse(): void; kSetQ(frac: number): void;
      kReadouts(): { playing: boolean; M: MediumSpec; S: MediumSet; A: number; aMax: number; lam: number; T: number; P: number; Q: number; dx: number; phi: number; words: string | null; pAmp: number };
    } | undefined;
    ripple(): {
      kSetPlaying(on: boolean): void; kSnap(kind: 'max' | 'min'): void;
      kReadouts(): { playing: boolean; lambda: number; r1: number; r2: number; D: number; cyc: number; verdict: string; here: { amp: number }; one: number; theta: number; ahead: number; linesMax: number; firstMin: number };
    } | undefined;
    standing(): {
      kSweep(maxMs?: number): Promise<boolean>; kRecord(): boolean; kClearReads(): void; kMark(): boolean; kClearMarks(): void;
      kReadouts(): { wire: Wire; mu: number; T: number; v: number; f1: number; near: { n: number; off: number; on: boolean; half: number }; lam: number; amp: number; sweeping: boolean; line: { m: number; c: number } | null; theory: number; vs: number; lamS: number; lag: number; inPhase: boolean; lamMeas: number; markFit: { m: number; c: number } | null; tubeRes: number[]; tNear: { i: number; f: number; on: boolean }; tLabel: number };
    } | undefined;
    light(): {
      kSetPlaying(on: boolean): void; kTakeReading(iDeg?: number): { i: number; r: number } | null; kClearReadings(): void; kCrossPol(): void; kAlignPol(): void;
      kReadouts(): { playing: boolean; nBlock: number; nOut: number; vIn: number; Ck: number | null; willTir: boolean; key: { from: number; to: number; theta: number | null; fromName: string; toName: string }; hits: Hit[]; fibreAccept: number | null; readings: { i: number; r: number }[]; grad: number; iSet: number; share: number; delta: number; planeNow: string; Iat: number; sphere: number; Pdet: number; laser: boolean };
    } | undefined;
    grating(): {
      kSetPlaying(on: boolean): void; kMeasure(n?: number): { n: number; X: number; theta: number; lam: number } | null; kClearReadings(): void;
      kReadouts(): { playing: boolean; white: boolean; nm: number; d: number; ords: Order[]; nmx: number; onScreen: Order[]; whiteOn: number; overlap: number | null; readings: { n: number; X: number; theta: number; lam: number }[]; meanLam: number; el: { V: number; Ek: number; p: number; v: number; lam: number; rings: { d: number; theta: number; r: number }[] }; body: Body; speed: number; dbP: number; dbL: number; scaleWord: string };
    } | undefined;
    echo(): {
      kSetPlaying(on: boolean): void; kSend(maxMs?: number): Promise<boolean>; kSetCursors(t1?: number, t2?: number): void; kSnap(which: 1 | 2): void; kClearCursors(): void;
      kReadouts(): { playing: boolean; sc: Scenario; f: number; gap: number; tau: number; lam: number; plen: number; res: { ok: boolean; dip: number }; pairDt: number; list: EchoHit[]; tend: number; ts: number; c1: number; c2: number; maxPRF: number };
    } | undefined;
    photon(): {
      kSetPlaying(on: boolean): void; kRecord(): boolean; kCharge(sign: -1 | 1): void; kGoLevel(i: number): void; kClearBars(): void;
      kReadouts(): { playing: boolean; mt: Metal; Eph: number; f: number; ek: number; emits: boolean; vs: number; nPh: number; nE: number; amps: number; charge: number; pts: { f: number; ek: number; metal: string }[]; at: Atom; lvl: number; last2: { from: number; to: number } | null; trans: { up: boolean; dE: number; nm: number; f: number; J: number; ion: boolean; obs: boolean } | null; visLines: Line[]; invis: Line[]; cm: number; cband: Band; cJ: number; cEV: number };
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
  const v = step ? Number((Math.round(c / step) * step).toFixed(8)) : c;
  return { val: Math.max(lo, Math.min(hi, v)), clamped: Math.abs(c - x) > 1e-9 };
}

function matchMode(raw: unknown): Mode {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'wave' || s === 'waves' || s === 'bench' || s === 'progressive') return 'wave';
  if (s === 'ripple' || s.includes('ripple') || s.includes('tank')) return 'ripple';
  if (s === 'standing' || s.includes('stand') || s.includes('stationary') || s.includes('string')) return 'standing';
  if (s === 'light' || s.includes('refract') || s.includes('polar') || s.includes('tir')) return 'light';
  if (s === 'grating' || s.includes('diffract') || s.includes('electron') || s.includes('grating')) return 'grating';
  if (s === 'echo' || s.includes('echo') || s.includes('ultrasound') || s.includes('sonar')) return 'echo';
  if (s === 'photon' || s.includes('photon') || s.includes('photoelectric') || s.includes('spectr')) return 'photon';
  if (s === 'practice' || s === 'quiz') return 'practice';
  throw new Error(`mode must be one of wave, ripple, standing, light, grating, echo, photon, practice (got ${JSON.stringify(raw)}).`);
}

function matchWire(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  const w = WIRES.find((x) => x.id === s || x.name.toLowerCase() === s || x.name.toLowerCase().includes(s) || x.id.includes(s));
  if (w) return w.id;
  throw new Error(`Unknown wire ${JSON.stringify(raw)}. Valid wires: ${WIRES.map((x) => `${x.id} (${x.name})`).join(', ')}.`);
}

function matchMetal(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  const m = METALS.find((x) => x.id === s || x.sym.toLowerCase() === s || x.name.toLowerCase() === s || x.name.toLowerCase().startsWith(s));
  if (m) return m.id;
  throw new Error(`Unknown metal ${JSON.stringify(raw)}. Valid metals: ${METALS.map((x) => `${x.id} (${x.name}, φ=${x.phi} eV)`).join(', ')}.`);
}

function matchAtom(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  const a = ATOMS.find((x) => x.id === s || x.name.toLowerCase() === s || x.name.toLowerCase().startsWith(s));
  if (a) return a.id;
  throw new Error(`Unknown atom ${JSON.stringify(raw)}. Valid atoms: ${ATOMS.map((x) => `${x.id} (${x.name})`).join(', ')}.`);
}

function matchLaser(raw: unknown): LaserId {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'violet' || s === 'purple' || s === 'blue' || s.includes('405')) return 'blue';
  if (s === 'red' || s.includes('650')) return 'red';
  if (s === 'green' || s.includes('532')) return 'green';
  if (s === 'white' || s.includes('white')) return 'white';
  if (s === 'custom' || s.includes('any')) return 'custom';
  throw new Error(`laser must be one of red (650 nm), green (532 nm), blue (violet 405 nm), custom, white (got ${JSON.stringify(raw)}).`);
}

function matchShape(raw: unknown): Shape {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'rect' || s.includes('rect')) return 'rect';
  if (s === 'semi' || s.includes('semi')) return 'semi';
  if (s === 'prism' || s.includes('prism') || s.includes('triang')) return 'prism';
  if (s === 'fibre' || s === 'fiber' || s.includes('fibr') || s.includes('fiber')) return 'fibre';
  if (s === 'tank' || s.includes('tank') || s.includes('lamp')) return 'tank';
  throw new Error(`shape must be one of ${SHAPES.map((x) => `${x[0]} (${x[1]})`).join(', ')} (got ${JSON.stringify(raw)}).`);
}

function matchMaterial(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  const m = MATERIALS.find((x) => x.id === s || x.name.toLowerCase() === s || x.name.toLowerCase().includes(s));
  if (m) return m.id;
  throw new Error(`material must be one of ${MATERIALS.map((x) => x.id).join(', ')} (got ${JSON.stringify(raw)}).`);
}

function matchBody(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'e' || s === 'e-' || s.includes('electron')) return 'e';
  if (s === 'p' || s === 'p+' || s.includes('proton')) return 'p';
  if (s === 'n' || s.includes('neutron')) return 'n';
  if (s === 'a' || s === 'α' || s.includes('alpha')) return 'a';
  if (s === 'ball' || s.includes('tennis') || s.includes('ball')) return 'ball';
  throw new Error(`particle must be one of ${BODIES.map((b) => `${b.id} (${b.name})`).join(', ')} (got ${JSON.stringify(raw)}).`);
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

/** Parse a length with optional unit (m, cm, mm, μm, nm) into metres; defaultUnit used when no unit is present. */
function parseLengthM(v: unknown, label: string, defaultUnit: 'm' | 'cm' | 'mm' | 'um' | 'nm'): number {
  const n = num(v, label);
  const s = typeof v === 'string' ? v.toLowerCase() : '';
  if (s.includes('nm')) return n * 1e-9;
  if (s.includes('μm') || s.includes('um') || s.includes('micron')) return n * 1e-6;
  if (s.includes('mm')) return n * 1e-3;
  if (s.includes('cm')) return n * 1e-2;
  if (/\bm\b/.test(s)) return n;
  const scale = { m: 1, cm: 1e-2, mm: 1e-3, um: 1e-6, nm: 1e-9 }[defaultUnit];
  return n * scale;
}

const ABOUT = 'Waves Lab (Edexcel IAL Physics Unit 2) is open with 8 interactive 3D tabs: wave (progressive rope/slinky/sound), ripple (two-source interference, gap/obstacle diffraction), standing (vibrating string CP5, speed of sound CP4, air column), light (refraction/TIR, polarisation, intensity), grating (diffraction grating CP6, electron diffraction), echo (ultrasound & sonar pulse–echo), photon (photoelectric effect & atomic line spectra) and practice. '
  + 'Use waves_ tools to inspect state, switch tabs, configure any experiment on screen (e.g. 3 loops on a standing wave, 600 lines/mm grating, two-source ripple tank) and run actions.';

export function provideWavesTools(host: WavesHost): () => void {
  async function ensureMode(m: Mode) {
    if (host.getMode() !== m) { host.setMode(m); await tick(); }
  }

  function describeTab(m: Mode): string {
    const lines: string[] = [`Tab: ${m} (all tabs: wave, ripple, standing, light, grating, echo, photon, practice)`];
    if (m === 'wave') {
      const p = host.bench, r = host.cmp.bench()?.kReadouts();
      const M = MEDIA[p.medium], S = p.sets[p.medium];
      lines.push(
        `Medium: ${p.medium} (${M.name}, ${M.kind}, length ${M.L} m). Source: ${p.pulse ? 'pulses' : 'continuous'}. Playing: ${r?.playing ?? true}.`,
        `Parameters: A = ${aText(r?.A ?? S.A, M.aUnit)} (range ${aText(M.A[0], M.aUnit)}–${aText(r?.aMax ?? M.A[1], M.aUnit)}), `
        + `f = ${plain(S.f, 3)} Hz (${M.f[0]}–${M.f[1]} Hz), v = ${plain(S.v, 3)} m s⁻¹ (${M.v[0]}–${M.v[1]} m s⁻¹), `
        + `time_scale = 10^${S.slow.toFixed(2)} (log10 range ${M.slow[0]}..${M.slow[1]}).`,
        `Markers: P at ${lenText(p.P * M.L)} (${(p.P * 100).toFixed(1)}%), Q at ${lenText(p.Q * M.L)} (${(p.Q * 100).toFixed(1)}%). Long toggles: pressure=${p.pressure}, ghost=${p.ghost}.`,
      );
      if (r) {
        lines.push(`Readouts: λ = ${lenText(r.lam)}, T = ${timeText(r.T)}, Δx = ${lenText(Math.abs(r.dx))} (${plain(Math.abs(r.dx) / r.lam, 3)} λ), phase difference = ${piText(r.phi)} rad (${Math.round((r.phi * 180) / Math.PI)}°)${r.words ? ` (${r.words})` : ''}.`);
      }
    } else if (m === 'ripple') {
      const p = host.ripple, r = host.cmp.ripple()?.kReadouts();
      const lam = (RIPPLE_V * 100) / p.f;
      lines.push(
        `Setup: ${p.mode} (two / gap / obstacle). Display: shade=${p.shade} (wave/amp), strobe=${p.strobe}, lines=${p.lines}, huygens=${p.huygens}, superposition=${p.sup} (same/opp), playing=${r?.playing ?? true}.`,
        `Parameters: f = ${p.f} Hz (6–20), λ = ${plain(lam, 3)} cm (v = ${RIPPLE_V} m s⁻¹)`
        + (p.mode === 'two' ? `, d = ${p.d} cm (2–14), phase lead = ${p.phiDeg}° (0–360), coherent = ${p.coherent}.`
          : p.mode === 'gap' ? `, gap b = ${p.gap} cm (1–18), b/λ = ${plain(p.gap / lam, 2)}.`
          : `, obstacle = ${p.obs} cm (1–16), obs/λ = ${plain(p.obs / lam, 2)}.`),
        `Probe X at (${p.probe[0]} cm, ${p.probe[1]} cm) (x: -20..20, z: 0..30).`,
      );
      if (r) {
        if (p.mode === 'two') {
          lines.push(`Readouts: ${r.linesMax} antinodal lines. At X: r₁ = ${plain(r.r1, 3)} cm, r₂ = ${plain(r.r2, 3)} cm, path diff = ${plain(Math.abs(r.D), 3)} cm (${lamText(Math.abs(r.D), r.lambda)}), phase = ${p.coherent ? `${Math.round(r.cyc * 360) % 360}°` : 'changing'}, verdict: ${r.verdict}.`);
        } else {
          lines.push(`Readouts at X: angle = ${plain(Math.abs(r.theta), 3)}°, amplitude = ${plain(r.here.amp, 2)} × incident${p.mode === 'gap' && Number.isFinite(r.firstMin) ? `, first minimum θ = ${plain(r.firstMin, 3)}°` : ''}.`);
        }
      }
    } else if (m === 'standing') {
      const p = host.stand, r = host.cmp.standing()?.kReadouts();
      lines.push(`Bench: ${p.mode} (string / sound / tube). Strobe: ${p.strobe} Hz (0/0.25/0.5/1).`);
      if (p.mode === 'string') {
        const w = WIRES.find((x) => x.id === p.wire) ?? WIRES[2];
        const mu = w.id === 'custom' ? p.mu : w.mu;
        const T = tension(p.mass), v = waveSpeed(T, mu), f1 = f1Of(v, p.l);
        lines.push(
          `String: wire=${w.id} (${w.name}, μ = ${plain(mu * 1000, 3)} g m⁻¹; custom range 0.1–5 g m⁻¹), mass = ${Math.round(p.mass * 1000)} g (${p.mass} kg, range 0.05–1 kg), `
          + `length l = ${p.l.toFixed(2)} m (0.3–1.5 m), frequency f = ${plain(p.f, 4)} Hz (1–400 Hz), show_travelling=${p.parts}, graph_axis=${p.ax} (invl/sqrtT/invsqrtmu).`,
          `Readouts: T = ${plain(T, 3)} N, v = ${plain(v, 3)} m s⁻¹, f₁ = ${plain(f1, 3)} Hz, `
          + (r ? `nearest harmonic n = ${r.near.n} (${plain(r.near.n * f1, 4)} Hz), resonating = ${r.near.on ? `yes (${r.near.n} loops, λ = ${plain(r.lam, 3)} m)` : 'no'}, antinode amp = ${sci(r.amp * 1000, 2)} mm. ` : '')
          + `CP5 readings recorded: ${p.reads.length}${r?.line ? ` (gradient = ${sci(r.line.m, 3)}, theory = ${sci(r.theory, 3)})` : ''}.`,
        );
      } else if (p.mode === 'sound') {
        const vs = soundSpeed(p.temp), lamS = vs / p.fs;
        lines.push(
          `Speed of sound (CP4): f = ${p.fs} Hz (500–5000), mic d = ${plain(p.mic * 100, 3)} cm (0–100 cm), temp = ${p.temp} °C (0–40), show_phase=${p.phase}, scope tb=${p.tb} ms/div, v1=${p.v1} V/div, v2=${p.v2} V/div.`,
          `Readouts: v_sound = ${plain(vs, 3)} m s⁻¹, λ = ${plain(lamS * 100, 3)} cm`
          + (r ? `, phase lag = ${Math.round(r.lag)}° (${r.inPhase ? 'in phase' : 'not in phase'}), marks = ${p.marks.length}${Number.isFinite(r.lamMeas) ? `, measured λ = ${plain(r.lamMeas * 100, 3)} cm → v = ${plain(p.fs * r.lamMeas, 3)} m s⁻¹` : ''}.` : '.'),
        );
      } else {
        const vs = soundSpeed(p.temp);
        const res = [1, 2, 3, 4].map((i) => `${p.tube === 'closed' ? 2 * i - 1 : i}: ${plain(tubeF(p.tube, i, vs, p.L), 3)} Hz`);
        lines.push(
          `Air column: end = ${p.tube} (closed/open), length L = ${p.L.toFixed(2)} m (0.2–1.0 m), f = ${p.ft} Hz (80–2000 Hz).`,
          `Resonances (v = ${plain(vs, 3)} m s⁻¹): ${res.join(', ')}. ${r ? (r.tNear.on ? `Resonating at harmonic ${r.tLabel}.` : 'Not resonating.') : ''}`,
        );
      }
    } else if (m === 'light') {
      const p = host.light, r = host.cmp.light()?.kReadouts();
      lines.push(`View: ${p.mode} (refract / polar / intensity). Playing: ${r?.playing ?? true}.`);
      if (p.mode === 'refract') {
        lines.push(
          `Refraction: shape=${p.shape} (rect/semi/prism/fibre/tank), material=${p.mat} (water/perspex/glass/diamond/custom, n=${plain(r?.nBlock ?? 1.52, 3)}; custom 1.05–2.6), `
          + `outer=${p.outer} (air/water), angle=${p.angle}° (0–${MAX_ANGLE[p.shape]}°), white=${p.white}${p.shape === 'fibre' ? `, cladding n=${p.nClad} (1.0–2.0)` : ''}.`,
        );
        if (r) {
          lines.push(
            `Readouts: v = ${sci(r.vIn)} m s⁻¹, λ_in(589nm) = ${plain(589 / r.nBlock, 3)} nm, critical angle C = ${r.Ck === null ? 'none' : `${plain(r.Ck, 3)}°`}, `
            + `key interface ${r.key.fromName}→${r.key.toName} at ${plain(r.key.theta ?? 0, 3)}°: ${r.willTir ? 'TOTAL INTERNAL REFLECTION' : 'refracts'}.`
            + (r.fibreAccept !== null ? ` Fibre acceptance angle = ${plain(r.fibreAccept, 3)}°.` : ''),
          );
          if (r.hits.length) {
            lines.push('Interfaces: ' + r.hits.slice(0, 4).map((h, i) => `${i + 1}) ${h.m1}→${h.m2} i=${plain(h.i, 3)}° ${h.tir ? 'TIR' : `r=${plain(h.t ?? 0, 3)}°`}`).join('; '));
          }
          if (r.readings.length) lines.push(`Block readings (${r.readings.length}): gradient n = ${r.readings.length >= 2 ? plain(r.grad, 3) : 'need ≥2'}.`);
        }
      } else if (p.mode === 'polar') {
        lines.push(
          `Polarisation: source=${p.src} (light/radio/sound), polariser=${p.pol} (${p.polA}°, 0–180°), analyser=${p.ana} (${p.anaA}°, 0–180°).`,
          r ? `Readouts: ${plain(r.share * 100, 3)}% transmitted, plane: ${r.planeNow}${p.pol && p.ana && p.src !== 'sound' ? `, angle between axes Δ = ${r.delta}°` : ''}.` : '',
        );
      } else {
        const isL = p.lamp === 'laser';
        lines.push(
          `Intensity: lamp=${p.lamp} (bulb/laser), power P = ${p.P} ${isL ? 'mW (0.5–5)' : 'W (5–200)'}, distance r = ${plain(p.r, 2)} m (0.5–5 m), detector area A = ${p.A} cm² (1–100 cm²).`,
          r ? `Readouts: I = ${sci(r.Iat)} W m⁻², power on detector = ${sci(r.Pdet)} W.` : '',
        );
      }
    } else if (m === 'grating') {
      const p = host.grate, r = host.cmp.grating()?.kReadouts();
      lines.push(`View: ${p.mode} (grating / electron). Playing: ${r?.playing ?? true}.`);
      if (p.mode === 'grating') {
        lines.push(
          `Grating: laser=${p.laser} (red 650 / green 532 / blue 405 / custom 380–750 nm / white), λ = ${r?.white ? '400–700 nm (white)' : `${r?.nm ?? p.nm} nm`}, `
          + `lines_per_mm = ${p.lpm} (50–1000, step 10), screen distance D = ${plain(p.D, 3)} m (0.3–2.0 m), N_slits comparison = ${p.N} (2/3/6/20).`,
        );
        if (r) {
          const ordTxt = r.white
            ? `white central max + ${r.nmx * 2} spectra (${r.whiteOn * 2 + 1} reach screen)${r.overlap !== null ? `; order ${r.overlap} red overlaps order ${r.overlap + 1} violet` : ''}`
            : `max order n = ${r.nmx} (${r.nmx * 2 + 1} spots, ${r.onScreen.length * 2 + 1} on screen): `
              + r.ords.filter((o) => o.n > 0).map((o) => `n=${o.n}: θ=${plain((o.theta * 180) / Math.PI, 3)}° (x=${plain(p.D * Math.tan(o.theta) * 100, 3)} cm)`).join(', ');
          lines.push(`Readouts: slit spacing d = ${sci(r.d)} m, ${ordTxt}.`);
          if (r.readings.length) lines.push(`CP6 measured (${r.readings.length} orders): mean λ = ${plain(r.meanLam * 1e9, 3)} nm.`);
        }
      } else {
        lines.push(
          `Electron diffraction: accelerating p.d. V = ${plain(p.kV, 2)} kV (1.5–5.0 kV). de Broglie calculator: particle=${p.body} (e/p/n/a/ball), speed = ${r ? sci(r.speed) : ''} m s⁻¹.`,
        );
        if (r) {
          lines.push(
            `Electrons: Ek = ${sci(r.el.Ek)} J (${sci(r.el.V)} eV), v = ${sci(r.el.v)} m s⁻¹, p = ${sci(r.el.p)} kg m s⁻¹, λ = ${sci(r.el.lam)} m, rings = ${plain(r.el.rings[0].r * 1000, 3)} mm & ${plain(r.el.rings[1].r * 1000, 3)} mm.`,
            `de Broglie (${r.body.name}): p = ${sci(r.dbP)} kg m s⁻¹, λ = ${sci(r.dbL)} m (${r.scaleWord}).`,
          );
        }
      }
    } else if (m === 'echo') {
      const p = host.echo, r = host.cmp.echo()?.kReadouts();
      const sc = SCENARIOS.find((s) => s.id === p.sc) ?? SCENARIOS[0];
      const fVal = p.sc === 'body' ? p.fBody : p.fSea;
      const gVal = p.sc === 'body' ? p.gBody : p.gSea;
      lines.push(
        `Scene: ${p.sc} (${sc.name}; body / sea). Playing: ${r?.playing ?? true}. Speed: ×${p.speed} (0.25/1/4).`,
        `Parameters: f = ${fVal} ${sc.fUnit} (${sc.fMin}–${sc.fMax}), duration = ${p.cyc} cycles (1–20), reflector gap = ${gVal} ${sc.gUnit} (${sc.gMin}–${sc.gMax}).`,
      );
      if (r) {
        lines.push(
          `Readouts: λ = ${lenText(r.lam)}, pulse length = ${lenText(r.plen)}, pair echoes ${plain(r.pairDt / sc.tScale, 3)} ${sc.tUnit} apart → ${r.res.ok ? 'RESOLVED (two echoes)' : 'UNRESOLVED (one blur)'}.`,
          `Echoes: ` + r.list.map((e) => `${e.what}: t=${plain(e.t / sc.tScale, 3)} ${sc.tUnit} (vt/2=${plain((sc.vAssumed * e.t) / 2 / sc.dScale, 3)} ${sc.dUnit}, true=${plain(e.depth / sc.dScale, 3)} ${sc.dUnit}, ${plain(dB(Math.abs(e.A)), 2)} dB)`).join(' | '),
        );
        if (Number.isFinite(r.c1)) lines.push(`Cursor 1: t = ${plain(r.c1 / sc.tScale, 3)} ${sc.tUnit} → d = ${plain((sc.vAssumed * r.c1) / 2 / sc.dScale, 3)} ${sc.dUnit}.` + (Number.isFinite(r.c2) ? ` Cursor 2: t = ${plain(r.c2 / sc.tScale, 3)} ${sc.tUnit}, Δd = ${plain((sc.vAssumed * Math.abs(r.c2 - r.c1)) / 2 / sc.dScale, 3)} ${sc.dUnit}.` : ''));
      }
    } else if (m === 'photon') {
      const p = host.photon, r = host.cmp.photon()?.kReadouts();
      lines.push(`View: ${p.mode} (pe / lines). Playing: ${r?.playing ?? true}.`);
      if (p.mode === 'pe') {
        lines.push(
          `Photoelectric: apparatus=${p.app} (cell/scope), metal=${p.metal} (${r?.mt.name ?? ''}, φ=${r?.mt.phi ?? ''} eV; cs/k/na/ca/mg/zn/cu/pt), λ = ${p.nm} nm (150–900 nm), intensity = ${Math.round(p.I * 100)}% (0–1), stopping V = ${plain(p.V, 3)} V (0–5 V).`,
        );
        if (r) {
          lines.push(
            `Readouts: f = ${sci(r.f)} Hz, hf = ${plain(r.Eph)} eV, threshold f₀ = ${sci(f0(r.mt.phi))} Hz (λ₀ = ${short(nm0(r.mt.phi))} nm), `
            + (r.emits ? `EMITS: Ek(max) = ${plain(r.ek)} eV, v(max) = ${sci(vMax(r.ek))} m s⁻¹, Vs = ${plain(r.vs)} V` : 'NO EMISSION (hf < φ)')
            + (p.app === 'cell' ? `, photocurrent = ${sci(r.amps)} A, plotted points = ${r.pts.length}.` : `, electroscope charge = ${r.charge.toFixed(2)}.`),
          );
        }
      } else if (r) {
        const curLvl = r.lvl < 0 ? 'ionised (0 eV)' : `${r.at.levels[r.lvl].name} (${plain(r.at.levels[r.lvl].e, 3)} eV)`;
        lines.push(
          `Line spectra: atom=${p.atom} (${r.at.name}; h/na/hg), spectrum=${p.spec} (emit/abs), electron at ${curLvl}.`,
          `Levels: ${r.at.levels.map((l, i) => `[${i}] ${l.name} (${plain(l.e, 3)} eV)`).join(', ')}, [-1] ionised (0 eV).`,
          `Visible lines (nm): ${r.visLines.map((l) => Math.round(l.nm)).sort((a, b) => a - b).join(', ')}.`,
        );
        if (r.trans) lines.push(`Last transition: ${r.trans.up ? (r.trans.ion ? 'ionisation' : 'absorbed') : 'emitted'} ΔE = ${plain(r.trans.dE)} eV, f = ${sci(r.trans.f)} Hz, λ = ${short(r.trans.nm)} nm.`);
      }
      if (r) lines.push(`EM calculator: λ = ${sci(r.cm)} m (log10=${p.calc.toFixed(2)}, range -13.5..3.5), f = ${sci(C / r.cm)} Hz, E = ${sci(r.cJ)} J = ${sci(r.cEV)} eV (${r.cband.name}).`);
    } else {
      const s = host.cmp.practice()?.kSnapshot();
      lines.push(`Practice topic: ${host.topic.t} (all/waves/superpose/standing/light/diffract/echo/photon). Score: ${host.score.right}/${host.score.total}, streak ${host.score.streak}.`);
      if (s) {
        lines.push(`Question: ${s.q.prompt}`, `Options: ${s.q.options.map((o, i) => `${i + 1}) ${o}`).join(' | ')}`);
        if (s.picked) lines.push(`Answered: ${s.picked} (${s.ok ? 'Correct' : `Incorrect, answer is ${s.q.answer}`}).\nWorking:\n${s.q.working.join('\n')}`);
        else lines.push('Not answered yet (do not spoil the answer before the student tries unless asked).');
      }
    }
    return lines.filter(Boolean).join('\n');
  }

  return provideKernelTools('waves', ABOUT, [
    {
      name: 'waves_state',
      description: 'Read the active tab of Waves Lab: mode, sub-mode, every adjustable parameter with its value, range and unit, and all current physics readouts.',
      parameters: { type: 'object', properties: {} },
      run: () => describeTab(host.getMode()),
    },
    {
      name: 'waves_mode',
      description: 'Switch Waves Lab tab (wave, ripple, standing, light, grating, echo, photon, practice) and optionally its sub-mode (e.g. rope/slinky/air, two/gap/obstacle, string/sound/tube, refract/polar/intensity, grating/electron, body/sea, pe/lines, or practice topic).',
      parameters: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['wave', 'ripple', 'standing', 'light', 'grating', 'echo', 'photon', 'practice'] },
          sub: { type: 'string', description: 'Optional sub-mode for that tab.' },
        },
        required: ['mode'],
      },
      run: async (a) => {
        const m = matchMode(a.mode);
        if (a.sub !== undefined) {
          const s = String(a.sub).trim().toLowerCase();
          if (m === 'wave') {
            if (!['rope', 'slinky', 'air'].includes(s)) throw new Error('wave sub must be rope, slinky or air.');
            host.bench.medium = s as Medium;
          } else if (m === 'ripple') {
            const rm: RMode = s.includes('two') ? 'two' : s.includes('gap') ? 'gap' : s.includes('obs') || s.includes('block') ? 'obstacle' : (() => { throw new Error('ripple sub must be two, gap or obstacle.'); })();
            host.ripple.mode = rm;
          } else if (m === 'standing') {
            const sm = s.includes('str') ? 'string' : s.includes('sou') ? 'sound' : s.includes('tub') || s.includes('air') ? 'tube' : (() => { throw new Error('standing sub must be string, sound or tube.'); })();
            host.stand.mode = sm;
          } else if (m === 'light') {
            const lm = s.includes('ref') || s.includes('tir') ? 'refract' : s.includes('pol') ? 'polar' : s.includes('int') ? 'intensity' : (() => { throw new Error('light sub must be refract, polar or intensity.'); })();
            host.light.mode = lm;
          } else if (m === 'grating') {
            const gm = s.includes('el') ? 'electron' : s.includes('gr') ? 'grating' : (() => { throw new Error('grating sub must be grating or electron.'); })();
            host.grate.mode = gm;
          } else if (m === 'echo') {
            const em = s.includes('sea') || s.includes('sonar') ? 'sea' : s.includes('body') || s.includes('ultra') ? 'body' : (() => { throw new Error('echo sub must be body or sea.'); })();
            host.echo.sc = em;
          } else if (m === 'photon') {
            const pm = s.includes('line') || s.includes('spec') ? 'lines' : s === 'pe' || s.includes('photo') ? 'pe' : (() => { throw new Error('photon sub must be pe or lines.'); })();
            host.photon.mode = pm;
          } else if (m === 'practice') {
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
      name: 'waves_wave',
      description: 'Configure and control the Waves (progressive wave) tab: medium (rope/slinky/air), amplitude, frequency, wave speed, continuous/pulse mode, markers P and Q, and play/pause/step/restart/send_pulse.',
      parameters: {
        type: 'object',
        properties: {
          medium: { type: 'string', enum: ['rope', 'slinky', 'air'] },
          amplitude: { description: 'Amplitude (rope: 2–30 cm or 0.02–0.3 m; slinky: 1–12 cm; air: 1–50 μm). Accepts units like "15 cm", "0.15 m", "20 um".', oneOf: [{ type: 'number' }, { type: 'string' }] },
          frequency: { description: 'Frequency in Hz (rope 0.5–4, slinky 0.5–3, air 100–2000).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          speed: { description: 'Wave speed in m/s (rope 1–6, slinky 0.5–3, air 320–350).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          source: { type: 'string', enum: ['continuous', 'pulse'] },
          P_m: { description: 'Marker P position along medium in metres (0 to medium length).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          Q_m: { description: 'Marker Q position in metres, or preset offset "lambda/4", "lambda/2", "lambda".', oneOf: [{ type: 'number' }, { type: 'string' }] },
          pressure: { type: 'boolean', description: 'Show pressure curve (longitudinal only).' },
          ghost: { type: 'boolean', description: 'Show sideways displacement curve (longitudinal only).' },
          time_scale_log10: { description: 'Log10 of time scale (rope/slinky -1.5..0, air -4..-2).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          action: { type: 'string', enum: ['play', 'pause', 'step', 'restart', 'send_pulse'] },
        },
      },
      run: async (a) => {
        await ensureMode('wave');
        const p = host.bench, notes: string[] = [];
        if (a.medium !== undefined) {
          const med = String(a.medium).trim().toLowerCase() as Medium;
          if (!(med in MEDIA)) throw new Error('medium must be rope, slinky or air.');
          p.medium = med;
          await tick();
        }
        const M = MEDIA[p.medium], S = p.sets[p.medium];
        if (a.frequency !== undefined) {
          const r = clamp(num(a.frequency, 'frequency'), M.f[0], M.f[1], M.f[2]);
          S.f = r.val; if (r.clamped) notes.push(`f clamped to ${r.val} Hz`);
        }
        if (a.speed !== undefined) {
          const r = clamp(num(a.speed, 'speed'), M.v[0], M.v[1], M.v[2]);
          S.v = r.val; if (r.clamped) notes.push(`v clamped to ${r.val} m s⁻¹`);
        }
        if (a.amplitude !== undefined) {
          // If no unit given: cm if value > 0.5 for rope/slinky, μm if value > 1e-3 for air
          const raw = num(a.amplitude, 'amplitude');
          const defU = M.aUnit === 'μm' ? (raw > 1e-3 ? 'um' : 'm') : (raw > 0.5 ? 'cm' : 'm');
          const mVal = parseLengthM(a.amplitude, 'amplitude', defU);
          const r = clamp(mVal, M.A[0], M.A[1], M.A[2]);
          S.A = r.val; if (r.clamped) notes.push(`A clamped to ${aText(r.val, M.aUnit)}`);
        }
        if (a.time_scale_log10 !== undefined) S.slow = clamp(num(a.time_scale_log10, 'time_scale_log10'), M.slow[0], M.slow[1], 0.05).val;
        if (a.source !== undefined) {
          const s = String(a.source).toLowerCase();
          if (s !== 'continuous' && s !== 'pulse') throw new Error('source must be continuous or pulse.');
          p.pulse = s === 'pulse';
          host.cmp.bench()?.kRestart();
        }
        if (a.P_m !== undefined) {
          const x = parseLengthM(a.P_m, 'P_m', 'm');
          p.P = clamp(x / M.L, 0, 1, 0.0025).val;
        }
        if (a.Q_m !== undefined) {
          const s = String(a.Q_m).toLowerCase().replace(/\s+/g, '');
          if (s === 'lambda/4' || s === 'λ/4') host.cmp.bench()?.kSetQ(0.25);
          else if (s === 'lambda/2' || s === 'λ/2') host.cmp.bench()?.kSetQ(0.5);
          else if (s === 'lambda' || s === 'λ') host.cmp.bench()?.kSetQ(1);
          else p.Q = clamp(parseLengthM(a.Q_m, 'Q_m', 'm') / M.L, 0, 1, 0.0025).val;
        }
        if (typeof a.pressure === 'boolean') p.pressure = a.pressure;
        if (typeof a.ghost === 'boolean') p.ghost = a.ghost;
        await tick();
        const cmp = host.cmp.bench();
        if (a.action && cmp) {
          const act = String(a.action).toLowerCase();
          if (act === 'play') cmp.kSetPlaying(true);
          else if (act === 'pause') cmp.kSetPlaying(false);
          else if (act === 'step') cmp.kStep();
          else if (act === 'restart') cmp.kRestart();
          else if (act === 'send_pulse') { p.pulse = true; await tick(); cmp.kSendPulse(); }
          else throw new Error('action must be play, pause, step, restart or send_pulse.');
        }
        await tick();
        return (notes.length ? `Notes: ${notes.join('; ')}.\n` : '') + describeTab('wave');
      },
    },
    {
      name: 'waves_ripple',
      description: 'Configure and control the Ripple tank tab: two sources, gap or obstacle diffraction, frequency, source separation, phase, gap/obstacle width, coherence, probe X position or snap to max/min.',
      parameters: {
        type: 'object',
        properties: {
          setup: { type: 'string', enum: ['two', 'gap', 'obstacle'], description: 'two (two sources), gap, or obstacle.' },
          frequency: { description: 'Dipper frequency in Hz (6–20, step 0.5).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          separation_cm: { description: 'Source separation d in cm (2–14, step 0.5) for two-source mode.', oneOf: [{ type: 'number' }, { type: 'string' }] },
          phase_deg: { description: 'Phase lead of S2 over S1 in degrees (0–360, step 15).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          gap_cm: { description: 'Gap width b in cm (1–18, step 0.5) for gap mode.', oneOf: [{ type: 'number' }, { type: 'string' }] },
          obstacle_cm: { description: 'Obstacle width in cm (1–16, step 0.5) for obstacle mode.', oneOf: [{ type: 'number' }, { type: 'string' }] },
          coherent: { type: 'boolean' },
          shade: { type: 'string', enum: ['wave', 'amp'], description: 'wave (instantaneous) or amp (time-averaged intensity).' },
          lines: { type: 'boolean', description: 'Show antinodal/nodal lines (two-source mode).' },
          huygens: { type: 'boolean', description: 'Show Huygens wavelets (gap mode).' },
          strobe: { type: 'boolean', description: 'Freeze wave with stroboscope.' },
          probe_x_cm: { description: 'Probe X horizontal position in cm (-20..20).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          probe_z_cm: { description: 'Probe X distance from back wall in cm (0..30).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          superposition: { type: 'string', enum: ['same', 'opp'], description: 'Pulses diagram: same side or opposite sides.' },
          action: { type: 'string', enum: ['play', 'pause', 'snap_max', 'snap_min'] },
        },
      },
      run: async (a) => {
        await ensureMode('ripple');
        const p = host.ripple, notes: string[] = [];
        if (a.setup !== undefined) {
          const s = String(a.setup).trim().toLowerCase();
          if (s.includes('two')) p.mode = 'two';
          else if (s.includes('gap')) p.mode = 'gap';
          else if (s.includes('obs') || s.includes('block')) p.mode = 'obstacle';
          else throw new Error('setup must be two, gap or obstacle.');
        }
        if (a.frequency !== undefined) { const r = clamp(num(a.frequency, 'frequency'), 6, 20, 0.5); p.f = r.val; if (r.clamped) notes.push(`f clamped to ${r.val} Hz`); }
        if (a.separation_cm !== undefined) { const r = clamp(parseLengthM(a.separation_cm, 'separation_cm', 'cm') * 100, 2, 14, 0.5); p.d = r.val; if (r.clamped) notes.push(`d clamped to ${r.val} cm`); }
        if (a.phase_deg !== undefined) { const r = clamp(num(a.phase_deg, 'phase_deg'), 0, 360, 15); p.phiDeg = r.val; }
        if (a.gap_cm !== undefined) { const r = clamp(parseLengthM(a.gap_cm, 'gap_cm', 'cm') * 100, 1, 18, 0.5); p.gap = r.val; if (r.clamped) notes.push(`gap clamped to ${r.val} cm`); }
        if (a.obstacle_cm !== undefined) { const r = clamp(parseLengthM(a.obstacle_cm, 'obstacle_cm', 'cm') * 100, 1, 16, 0.5); p.obs = r.val; if (r.clamped) notes.push(`obstacle clamped to ${r.val} cm`); }
        if (typeof a.coherent === 'boolean') p.coherent = a.coherent;
        if (a.shade !== undefined) {
          const s = String(a.shade).toLowerCase();
          if (s !== 'wave' && s !== 'amp') throw new Error('shade must be wave or amp.');
          p.shade = s;
        }
        if (typeof a.lines === 'boolean') p.lines = a.lines;
        if (typeof a.huygens === 'boolean') p.huygens = a.huygens;
        if (typeof a.strobe === 'boolean') p.strobe = a.strobe;
        if (a.probe_x_cm !== undefined || a.probe_z_cm !== undefined) {
          const x = a.probe_x_cm !== undefined ? clamp(parseLengthM(a.probe_x_cm, 'probe_x_cm', 'cm') * 100, -20, 20, 0.1).val : p.probe[0];
          const z = a.probe_z_cm !== undefined ? clamp(parseLengthM(a.probe_z_cm, 'probe_z_cm', 'cm') * 100, 0, 30, 0.1).val : p.probe[1];
          p.probe = [x, z];
        }
        if (a.superposition !== undefined) {
          const s = String(a.superposition).toLowerCase();
          if (s !== 'same' && s !== 'opp') throw new Error('superposition must be same or opp.');
          p.sup = s;
        }
        await tick();
        const cmp = host.cmp.ripple();
        if (a.action && cmp) {
          const act = String(a.action).toLowerCase();
          if (act === 'play') cmp.kSetPlaying(true);
          else if (act === 'pause') cmp.kSetPlaying(false);
          else if (act === 'snap_max') cmp.kSnap('max');
          else if (act === 'snap_min') cmp.kSnap('min');
          else throw new Error('action must be play, pause, snap_max or snap_min.');
        }
        await tick();
        return (notes.length ? `Notes: ${notes.join('; ')}.\n` : '') + describeTab('ripple');
      },
    },
    {
      name: 'waves_standing',
      description: 'Configure and control the Standing waves tab (string CP5, speed of sound CP4, or air column). Pass loops/harmonic to automatically tune the frequency to that exact resonance (e.g. loops=3 for 3 loops on the string).',
      parameters: {
        type: 'object',
        properties: {
          bench: { type: 'string', enum: ['string', 'sound', 'tube'], description: 'Sub-bench: string (CP5), sound (CP4), or tube (air column).' },
          strobe: { type: 'string', enum: ['0', '0.25', '0.5', '1'], description: 'Stroboscope beat rate in Hz (0 = off).' },
          wire: { type: 'string', description: 'String bench: wire id or name (cotton, nylon, steel25, copper, steel50, cord, custom).' },
          mu_g_per_m: { description: 'Custom wire mass per unit length in g/m (0.1–5.0); sets wire to custom.', oneOf: [{ type: 'number' }, { type: 'string' }] },
          mass_kg: { description: 'Hanging mass in kg (0.05–1.0, step 0.05; strings with "g" like "200 g" also accepted).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          length_m: { description: 'String length l in m (0.3–1.5, step 0.01).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          frequency_hz: { description: 'Signal generator frequency in Hz (string: 1–400; sound: 500–5000; tube: 80–2000).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          loops: { description: 'String harmonic / number of loops n (1, 2, 3, ...), or tube resonance number (1st, 2nd, 3rd...). Automatically tunes frequency to exact resonance.', oneOf: [{ type: 'number' }, { type: 'string' }] },
          show_travelling: { type: 'boolean', description: 'Show incident and reflected travelling waves (string mode, needs strobe ≠ 0).' },
          graph_axis: { type: 'string', enum: ['invl', 'sqrtT', 'invsqrtmu'], description: 'CP5 straight-line graph x-axis.' },
          mic_m: { description: 'Sound bench: microphone distance d in m (0–1.0; "cm" strings accepted).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          temp_c: { description: 'Air temperature in °C (0–40) for sound/tube.', oneOf: [{ type: 'number' }, { type: 'string' }] },
          show_phase: { type: 'boolean', description: 'Sound bench: show phase difference hint.' },
          tube_end: { type: 'string', enum: ['closed', 'open'], description: 'Air column far end.' },
          tube_length_m: { description: 'Air column length L in m (0.2–1.0, step 0.01).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          action: { type: 'string', enum: ['sweep', 'record', 'clear_readings', 'mark', 'clear_marks'], description: 'sweep: animate f up to next resonance and wait; record/clear_readings (CP5); mark/clear_marks (CP4).' },
        },
      },
      run: async (a) => {
        await ensureMode('standing');
        const p = host.stand, notes: string[] = [];
        if (a.bench !== undefined) {
          const s = String(a.bench).trim().toLowerCase();
          if (s.includes('str')) p.mode = 'string';
          else if (s.includes('sou')) p.mode = 'sound';
          else if (s.includes('tub') || s.includes('air')) p.mode = 'tube';
          else throw new Error('bench must be string, sound or tube.');
        }
        if (a.strobe !== undefined) {
          const s = String(a.strobe).trim();
          if (!['0', '0.25', '0.5', '1'].includes(s)) throw new Error('strobe must be "0", "0.25", "0.5" or "1".');
          p.strobe = s as StandPrefs['strobe'];
        }
        if (a.wire !== undefined) p.wire = matchWire(a.wire);
        if (a.mu_g_per_m !== undefined) {
          p.wire = 'custom';
          const raw = num(a.mu_g_per_m, 'mu_g_per_m');
          const muKg = raw > 0.01 ? raw / 1000 : raw; // accept g/m or kg/m
          const r = clamp(muKg, 0.0001, 0.005, 0.0001);
          p.mu = r.val; if (r.clamped) notes.push(`μ clamped to ${plain(r.val * 1000, 3)} g m⁻¹`);
        }
        if (a.mass_kg !== undefined) {
          const raw = num(a.mass_kg, 'mass_kg');
          const s = typeof a.mass_kg === 'string' ? a.mass_kg.toLowerCase() : '';
          const kg = (s.includes('g') && !s.includes('kg')) || raw > 5 ? raw / 1000 : raw;
          const r = clamp(kg, 0.05, 1.0, 0.05);
          p.mass = r.val; if (r.clamped) notes.push(`mass clamped to ${Math.round(r.val * 1000)} g`);
        }
        if (a.length_m !== undefined) {
          const r = clamp(parseLengthM(a.length_m, 'length_m', 'm'), 0.3, 1.5, 0.01);
          p.l = r.val; if (r.clamped) notes.push(`l clamped to ${r.val.toFixed(2)} m`);
        }
        if (typeof a.show_travelling === 'boolean') {
          p.parts = a.show_travelling;
          if (p.parts && p.strobe === '0') p.strobe = '0.5'; // strobe must be on to show travelling waves
        }
        if (a.graph_axis !== undefined) {
          const ax = String(a.graph_axis) as XAxis;
          if (!['invl', 'sqrtT', 'invsqrtmu'].includes(ax)) throw new Error('graph_axis must be invl, sqrtT or invsqrtmu.');
          p.ax = ax;
        }
        if (a.mic_m !== undefined) {
          const raw = num(a.mic_m, 'mic_m');
          const mVal = parseLengthM(a.mic_m, 'mic_m', raw > 1.5 ? 'cm' : 'm');
          p.mic = clamp(mVal, 0, 1, 0.001).val;
        }
        if (a.temp_c !== undefined) p.temp = clamp(num(a.temp_c, 'temp_c'), 0, 40, 1).val;
        if (typeof a.show_phase === 'boolean') p.phase = a.show_phase;
        if (a.tube_end !== undefined) {
          const e = String(a.tube_end).trim().toLowerCase() as TubeEnd;
          if (e !== 'closed' && e !== 'open') throw new Error('tube_end must be closed or open.');
          p.tube = e;
        }
        if (a.tube_length_m !== undefined) p.L = clamp(parseLengthM(a.tube_length_m, 'tube_length_m', 'm'), 0.2, 1.0, 0.01).val;

        if (a.loops !== undefined) {
          const n = Math.round(num(a.loops, 'loops'));
          if (n < 1) throw new Error('loops/harmonic must be a positive integer (1, 2, 3, ...).');
          if (p.mode === 'tube') {
            const vs = soundSpeed(p.temp);
            const fTarget = tubeF(p.tube, n, vs, p.L);
            if (fTarget < 80 || fTarget > 2000) throw new Error(`Resonance #${n} is ${plain(fTarget, 4)} Hz, outside the 80–2000 Hz range. Adjust tube_length_m.`);
            p.ft = Math.round(fTarget);
          } else {
            p.mode = 'string';
            const w = WIRES.find((x) => x.id === p.wire) ?? WIRES[2];
            const mu = w.id === 'custom' ? p.mu : w.mu;
            const f1 = f1Of(waveSpeed(tension(p.mass), mu), p.l);
            const fTarget = n * f1;
            if (fTarget > 400) {
              const maxN = Math.floor(400 / f1);
              throw new Error(`${n} loops would need ${plain(fTarget, 4)} Hz, above the 400 Hz generator limit (max ${maxN} loops with current wire/tension/length; lower mass, lengthen string, or pick a heavier wire like steel50 or cord).`);
            }
            p.f = Math.round(fTarget * 100) / 100;
          }
        } else if (a.frequency_hz !== undefined) {
          const f = num(a.frequency_hz, 'frequency_hz');
          if (p.mode === 'string') { const r = clamp(f, 1, 400, 0.1); p.f = r.val; if (r.clamped) notes.push(`f clamped to ${r.val} Hz`); }
          else if (p.mode === 'sound') { const r = clamp(f, 500, 5000, 10); p.fs = r.val; if (r.clamped) notes.push(`f clamped to ${r.val} Hz`); }
          else { const r = clamp(f, 80, 2000, 1); p.ft = r.val; if (r.clamped) notes.push(`f clamped to ${r.val} Hz`); }
        }
        await tick();

        const cmp = host.cmp.standing();
        if (a.action && cmp) {
          const act = String(a.action).toLowerCase();
          if (act === 'sweep') {
            p.mode = 'string'; await tick();
            const done = await cmp.kSweep(15000);
            if (!done) notes.push('sweep timed out before reaching next peak');
          } else if (act === 'record') {
            if (!cmp.kRecord()) throw new Error('String is not resonating right now; tune to a harmonic (or pass loops) before recording.');
            notes.push('recorded CP5 reading');
          } else if (act === 'clear_readings') cmp.kClearReads();
          else if (act === 'mark') {
            if (!cmp.kMark()) notes.push('microphone already marked at this position');
            else notes.push('marked microphone position');
          } else if (act === 'clear_marks') cmp.kClearMarks();
          else throw new Error('action must be sweep, record, clear_readings, mark or clear_marks.');
        }
        await tick();
        return (notes.length ? `Notes: ${notes.join('; ')}.\n` : '') + describeTab('standing');
      },
    },
    {
      name: 'waves_light',
      description: 'Configure and control the Light tab: refraction/TIR (block shape, material, custom n, outer medium, ray angle, white light, cladding n, take block reading), polarisation (source, polariser/analyser angles, cross/align), or intensity (bulb/laser, power, distance, detector area).',
      parameters: {
        type: 'object',
        properties: {
          view: { type: 'string', enum: ['refract', 'polar', 'intensity'] },
          shape: { type: 'string', enum: ['rect', 'semi', 'prism', 'fibre', 'tank'] },
          material: { type: 'string', enum: ['water', 'perspex', 'glass', 'diamond', 'custom'] },
          n_custom: { description: 'Custom refractive index (1.05–2.6); sets material to custom.', oneOf: [{ type: 'number' }, { type: 'string' }] },
          outer: { type: 'string', enum: ['air', 'water'] },
          angle_deg: { description: 'Ray incidence angle in degrees (0–85°, fibre 0–80°).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          white_light: { type: 'boolean', description: 'Enable white light dispersion.' },
          n_clad: { description: 'Optical fibre cladding refractive index (1.0–2.0).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          source: { type: 'string', enum: ['light', 'radio', 'sound'], description: 'Polarisation view wave source.' },
          polariser: { type: 'boolean' },
          analyser: { type: 'boolean' },
          polariser_angle: { description: 'Polariser axis angle in degrees (0–180).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          analyser_angle: { description: 'Analyser axis angle in degrees (0–180).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          lamp: { type: 'string', enum: ['bulb', 'laser'], description: 'Intensity view source.' },
          power: { description: 'Power: W for bulb (5–200 W), mW for laser (0.5–5 mW).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          distance_m: { description: 'Distance r in m (0.5–5.0).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          detector_area_cm2: { description: 'Detector area A in cm² (1–100).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          measure_i_deg: { description: 'Angle of incidence i (5–80°, step 5) for take_reading.', oneOf: [{ type: 'number' }, { type: 'string' }] },
          action: { type: 'string', enum: ['play', 'pause', 'take_reading', 'clear_readings', 'cross_polarisers', 'align_polarisers'] },
        },
      },
      run: async (a) => {
        await ensureMode('light');
        const p = host.light, notes: string[] = [];
        if (a.view !== undefined) {
          const v = String(a.view).toLowerCase();
          if (v !== 'refract' && v !== 'polar' && v !== 'intensity') throw new Error('view must be refract, polar or intensity.');
          p.mode = v;
        }
        if (a.shape !== undefined) { p.mode = 'refract'; p.shape = matchShape(a.shape); }
        if (a.material !== undefined) { p.mode = 'refract'; p.mat = matchMaterial(a.material); }
        if (a.n_custom !== undefined) { p.mode = 'refract'; p.mat = 'custom'; p.nCustom = clamp(num(a.n_custom, 'n_custom'), 1.05, 2.6, 0.01).val; }
        if (a.outer !== undefined) {
          const o = String(a.outer).toLowerCase();
          if (o !== 'air' && o !== 'water') throw new Error('outer must be air or water.');
          p.outer = o;
        }
        if (a.angle_deg !== undefined) {
          const mx = MAX_ANGLE[p.shape];
          const r = clamp(num(a.angle_deg, 'angle_deg'), 0, mx, 1);
          p.angle = r.val; if (r.clamped) notes.push(`angle clamped to ${r.val}°`);
        }
        if (typeof a.white_light === 'boolean') p.white = a.white_light;
        if (a.n_clad !== undefined) p.nClad = clamp(num(a.n_clad, 'n_clad'), 1.0, 2.0, 0.01).val;
        if (a.source !== undefined) {
          const s = String(a.source).toLowerCase();
          if (s !== 'light' && s !== 'radio' && s !== 'sound') throw new Error('source must be light, radio or sound.');
          p.mode = 'polar'; p.src = s;
        }
        if (typeof a.polariser === 'boolean') p.pol = a.polariser;
        if (typeof a.analyser === 'boolean') p.ana = a.analyser;
        if (a.polariser_angle !== undefined) p.polA = clamp(num(a.polariser_angle, 'polariser_angle'), 0, 180, 1).val;
        if (a.analyser_angle !== undefined) p.anaA = clamp(num(a.analyser_angle, 'analyser_angle'), 0, 180, 1).val;
        if (a.lamp !== undefined) {
          const l = String(a.lamp).toLowerCase();
          if (l !== 'bulb' && l !== 'laser') throw new Error('lamp must be bulb or laser.');
          p.mode = 'intensity';
          if (p.lamp !== l) { p.lamp = l; p.P = l === 'laser' ? 1 : 60; }
        }
        if (a.power !== undefined) {
          const isL = p.lamp === 'laser';
          const r = clamp(num(a.power, 'power'), isL ? 0.5 : 5, isL ? 5 : 200, isL ? 0.5 : 5);
          p.P = r.val; if (r.clamped) notes.push(`P clamped to ${r.val} ${isL ? 'mW' : 'W'}`);
        }
        if (a.distance_m !== undefined) p.r = clamp(parseLengthM(a.distance_m, 'distance_m', 'm'), 0.5, 5.0, 0.1).val;
        if (a.detector_area_cm2 !== undefined) p.A = clamp(num(a.detector_area_cm2, 'detector_area_cm2'), 1, 100, 1).val;
        await tick();

        const cmp = host.cmp.light();
        if (a.action && cmp) {
          const act = String(a.action).toLowerCase();
          if (act === 'play') cmp.kSetPlaying(true);
          else if (act === 'pause') cmp.kSetPlaying(false);
          else if (act === 'take_reading') {
            p.mode = 'refract'; await tick();
            const rd = cmp.kTakeReading(a.measure_i_deg !== undefined ? num(a.measure_i_deg, 'measure_i_deg') : undefined);
            if (rd) notes.push(`recorded i=${rd.i}°, r=${rd.r}°`);
          } else if (act === 'clear_readings') cmp.kClearReadings();
          else if (act === 'cross_polarisers') { p.mode = 'polar'; cmp.kCrossPol(); }
          else if (act === 'align_polarisers') { p.mode = 'polar'; cmp.kAlignPol(); }
          else throw new Error('action must be play, pause, take_reading, clear_readings, cross_polarisers or align_polarisers.');
        }
        await tick();
        return (notes.length ? `Notes: ${notes.join('; ')}.\n` : '') + describeTab('light');
      },
    },
    {
      name: 'waves_grating',
      description: 'Configure and control the Diffraction tab: diffraction grating (laser/wavelength, lines per mm 50–1000, screen distance D, N-slit comparison, Core Practical 6 measurement) or electron diffraction (accelerating voltage 1.5–5 kV, de Broglie calculator).',
      parameters: {
        type: 'object',
        properties: {
          view: { type: 'string', enum: ['grating', 'electron'] },
          laser: { type: 'string', description: 'red (650 nm), green (532 nm), blue (violet 405 nm), custom, or white.' },
          wavelength_nm: { description: 'Custom laser wavelength in nm (380–750); selects custom laser (or matching preset).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          lines_per_mm: { description: 'Grating spacing in lines per mm (50–1000, step 10).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          screen_distance_m: { description: 'Grating-to-screen distance D in m (0.3–2.0, step 0.05).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          n_slits: { description: 'Number of slits for N-slit comparison graph (2, 3, 6, or 20).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          voltage_kv: { description: 'Electron accelerating p.d. in kV (1.5–5.0, step 0.1; values ≥ 500 interpreted as V).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          particle: { type: 'string', description: 'de Broglie calculator particle: e (electron), p (proton), n (neutron), a (alpha), ball (tennis ball).' },
          particle_speed_m_s: { description: 'de Broglie calculator speed in m/s.', oneOf: [{ type: 'number' }, { type: 'string' }] },
          measure_order: { description: 'Order n (1, 2, ...) to measure for Core Practical 6.', oneOf: [{ type: 'number' }, { type: 'string' }] },
          action: { type: 'string', enum: ['play', 'pause', 'measure', 'clear_readings'] },
        },
      },
      run: async (a) => {
        await ensureMode('grating');
        const p = host.grate, notes: string[] = [];
        if (a.view !== undefined) {
          const v = String(a.view).toLowerCase();
          if (v !== 'grating' && v !== 'electron') throw new Error('view must be grating or electron.');
          p.mode = v;
        }
        if (a.laser !== undefined) { p.mode = 'grating'; p.laser = matchLaser(a.laser); }
        if (a.wavelength_nm !== undefined) {
          p.mode = 'grating';
          const nm = clamp(num(a.wavelength_nm, 'wavelength_nm'), 380, 750, 1);
          const preset = LASERS.find(([, , v]) => v === nm.val && v > 0);
          if (preset) p.laser = preset[0]; else { p.laser = 'custom'; p.nm = nm.val; }
          if (nm.clamped) notes.push(`λ clamped to ${nm.val} nm`);
        }
        if (a.lines_per_mm !== undefined) {
          p.mode = 'grating';
          const r = clamp(num(a.lines_per_mm, 'lines_per_mm'), 50, 1000, 10);
          p.lpm = r.val; if (r.clamped) notes.push(`lines_per_mm clamped to ${r.val}`);
        }
        if (a.screen_distance_m !== undefined) {
          const r = clamp(parseLengthM(a.screen_distance_m, 'screen_distance_m', 'm'), 0.3, 2.0, 0.05);
          p.D = r.val; if (r.clamped) notes.push(`D clamped to ${r.val} m`);
        }
        if (a.n_slits !== undefined) {
          const n = num(a.n_slits, 'n_slits');
          p.N = [2, 3, 6, 20].reduce((b, x) => (Math.abs(x - n) < Math.abs(b - n) ? x : b), 6);
        }
        if (a.voltage_kv !== undefined) {
          p.mode = 'electron';
          let kv = num(a.voltage_kv, 'voltage_kv');
          if (kv >= 500) kv /= 1000; // accept V as well as kV
          const r = clamp(kv, 1.5, 5.0, 0.1);
          p.kV = r.val; if (r.clamped) notes.push(`V clamped to ${r.val} kV`);
        }
        if (a.particle !== undefined) { p.mode = 'electron'; p.body = matchBody(a.particle); }
        if (a.particle_speed_m_s !== undefined) {
          p.mode = 'electron';
          const v = num(a.particle_speed_m_s, 'particle_speed_m_s');
          if (v <= 0) throw new Error('particle_speed_m_s must be positive.');
          const [lo, hi] = p.body === 'ball' ? [0, 1.7] : [2, 7.4];
          p.speed = clamp(Math.log10(v), lo, hi, 0.01).val;
        }
        await tick();

        const cmp = host.cmp.grating();
        if (a.action && cmp) {
          const act = String(a.action).toLowerCase();
          if (act === 'play') cmp.kSetPlaying(true);
          else if (act === 'pause') cmp.kSetPlaying(false);
          else if (act === 'clear_readings') cmp.kClearReadings();
          else if (act === 'measure') {
            p.mode = 'grating'; await tick();
            if (p.laser === 'white') throw new Error('Cannot measure single-order spots with white light; pick a laser first.');
            const n = a.measure_order !== undefined ? Math.round(num(a.measure_order, 'measure_order')) : undefined;
            const rd = cmp.kMeasure(n);
            if (!rd) throw new Error(`Order ${n ?? 1} is not on the 2.5 m screen; try a lower order or smaller D.`);
            notes.push(`measured order ${rd.n}: X = ${rd.X.toFixed(3)} m → λ = ${plain(rd.lam * 1e9, 3)} nm`);
          } else throw new Error('action must be play, pause, measure or clear_readings.');
        }
        await tick();
        return (notes.length ? `Notes: ${notes.join('; ')}.\n` : '') + describeTab('grating');
      },
    },
    {
      name: 'waves_echo',
      description: 'Configure and control the Pulse–echo tab (ultrasound scan or sonar): frequency, pulse duration in cycles, gap between the two small reflectors, playback speed, A-scan cursors, and send pulse.',
      parameters: {
        type: 'object',
        properties: {
          scene: { type: 'string', enum: ['body', 'sea'], description: 'body (medical ultrasound) or sea (sonar).' },
          frequency: { description: 'Frequency: MHz for body (1–15), kHz for sea (10–200).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          cycles: { description: 'Pulse duration in cycles (1–20, step 1).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          gap: { description: 'Gap between the pair of reflectors: mm for body (0.2–5 mm), m for sea (0.02–1 m).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          speed: { type: 'string', enum: ['0.25', '1', '4'] },
          cursor1: { description: 'Cursor 1 time in μs (body) or ms (sea).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          cursor2: { description: 'Cursor 2 time in μs (body) or ms (sea).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          action: { type: 'string', enum: ['send', 'play', 'pause', 'snap1', 'snap2', 'clear_cursors'] },
        },
      },
      run: async (a) => {
        await ensureMode('echo');
        const p = host.echo, notes: string[] = [];
        if (a.scene !== undefined) {
          const s = String(a.scene).toLowerCase();
          if (s.includes('sea') || s.includes('sonar')) p.sc = 'sea';
          else if (s.includes('body') || s.includes('ultra')) p.sc = 'body';
          else throw new Error('scene must be body or sea.');
        }
        const sc = SCENARIOS.find((x) => x.id === p.sc) ?? SCENARIOS[0];
        if (a.frequency !== undefined) {
          const r = clamp(num(a.frequency, 'frequency'), sc.fMin, sc.fMax, sc.fStep);
          if (p.sc === 'body') p.fBody = r.val; else p.fSea = r.val;
          if (r.clamped) notes.push(`f clamped to ${r.val} ${sc.fUnit}`);
        }
        if (a.cycles !== undefined) p.cyc = clamp(num(a.cycles, 'cycles'), 1, 20, 1).val;
        if (a.gap !== undefined) {
          const gM = parseLengthM(a.gap, 'gap', p.sc === 'body' ? 'mm' : 'm');
          const r = clamp(gM / sc.gScale, sc.gMin, sc.gMax, sc.gStep);
          if (p.sc === 'body') p.gBody = r.val; else p.gSea = r.val;
          if (r.clamped) notes.push(`gap clamped to ${r.val} ${sc.gUnit}`);
        }
        if (a.speed !== undefined) {
          const s = String(a.speed);
          if (!['0.25', '1', '4'].includes(s)) throw new Error('speed must be "0.25", "1" or "4".');
          p.speed = s as EchoPrefs['speed'];
        }
        await tick();
        const cmp = host.cmp.echo();
        if (cmp) {
          if (a.cursor1 !== undefined || a.cursor2 !== undefined) {
            const t1 = a.cursor1 !== undefined ? num(a.cursor1, 'cursor1') * sc.tScale : undefined;
            const t2 = a.cursor2 !== undefined ? num(a.cursor2, 'cursor2') * sc.tScale : undefined;
            cmp.kSetCursors(t1, t2);
          }
          if (a.action) {
            const act = String(a.action).toLowerCase();
            if (act === 'send') { await cmp.kSend(6000); }
            else if (act === 'play') cmp.kSetPlaying(true);
            else if (act === 'pause') cmp.kSetPlaying(false);
            else if (act === 'snap1') cmp.kSnap(1);
            else if (act === 'snap2') cmp.kSnap(2);
            else if (act === 'clear_cursors') cmp.kClearCursors();
            else throw new Error('action must be send, play, pause, snap1, snap2 or clear_cursors.');
          }
        }
        await tick();
        return (notes.length ? `Notes: ${notes.join('; ')}.\n` : '') + describeTab('echo');
      },
    },
    {
      name: 'waves_photon',
      description: 'Configure and control the Photons tab: photoelectric effect (photocell/electroscope, metal, wavelength 150–900 nm, intensity 0–100%, stopping p.d. 0–5 V, find Vs, charge plate) or atomic line spectra (H/Na/Hg, emission/absorption, jump electron to a level), plus EM photon-energy calculator.',
      parameters: {
        type: 'object',
        properties: {
          view: { type: 'string', enum: ['pe', 'lines'] },
          apparatus: { type: 'string', enum: ['cell', 'scope'], description: 'Photoelectric apparatus: cell (vacuum photocell) or scope (gold-leaf electroscope).' },
          metal: { type: 'string', description: 'Metal id, symbol or name: cs, k, na, ca, mg, zn, cu, pt.' },
          wavelength_nm: { description: 'Lamp wavelength in nm (150–900, step 1).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          intensity: { description: 'Lamp intensity: 0–1 or 0–100%.', oneOf: [{ type: 'number' }, { type: 'string' }] },
          stopping_v: { description: 'Stopping p.d. in V (0–5, step 0.01) for photocell.', oneOf: [{ type: 'number' }, { type: 'string' }] },
          atom: { type: 'string', description: 'Line spectra atom: h (hydrogen), na (sodium), hg (mercury).' },
          spectrum: { type: 'string', enum: ['emit', 'abs'], description: 'Emission or absorption spectrum.' },
          level: { description: 'Move electron to level index (0 = ground, 1, 2, ...), level name (e.g. "n = 3", "3p"), or "ionised" (-1).', oneOf: [{ type: 'number' }, { type: 'string' }] },
          calc_wavelength_m: { description: 'Set the EM spectrum photon-energy calculator wavelength in metres (10^-13.5 to 10^3.5 m; accepts units like "500 nm", "10 cm").', oneOf: [{ type: 'number' }, { type: 'string' }] },
          action: { type: 'string', enum: ['play', 'pause', 'find_vs', 'charge_neg', 'charge_pos', 'clear_screen'] },
        },
      },
      run: async (a) => {
        await ensureMode('photon');
        const p = host.photon, notes: string[] = [];
        if (a.view !== undefined) {
          const v = String(a.view).toLowerCase();
          if (v !== 'pe' && v !== 'lines') throw new Error('view must be pe or lines.');
          p.mode = v;
        }
        if (a.apparatus !== undefined) {
          const s = String(a.apparatus).toLowerCase();
          if (s.includes('cell')) p.app = 'cell';
          else if (s.includes('scope') || s.includes('leaf') || s.includes('electro')) p.app = 'scope';
          else throw new Error('apparatus must be cell or scope.');
          p.mode = 'pe';
        }
        if (a.metal !== undefined) { p.mode = 'pe'; p.metal = matchMetal(a.metal); }
        if (a.wavelength_nm !== undefined) {
          p.mode = 'pe';
          const r = clamp(num(a.wavelength_nm, 'wavelength_nm'), 150, 900, 1);
          p.nm = r.val; if (r.clamped) notes.push(`λ clamped to ${r.val} nm`);
        }
        if (a.intensity !== undefined) {
          const raw = num(a.intensity, 'intensity');
          const frac = (typeof a.intensity === 'string' && a.intensity.includes('%')) || raw > 1 ? raw / 100 : raw;
          p.I = clamp(frac, 0, 1, 0.01).val;
        }
        if (a.stopping_v !== undefined) p.V = clamp(num(a.stopping_v, 'stopping_v'), 0, 5, 0.01).val;
        if (a.atom !== undefined) { p.mode = 'lines'; p.atom = matchAtom(a.atom); await tick(); }
        if (a.spectrum !== undefined) {
          const s = String(a.spectrum).toLowerCase();
          if (s.startsWith('emit')) p.spec = 'emit';
          else if (s.startsWith('abs')) p.spec = 'abs';
          else throw new Error('spectrum must be emit or abs.');
          p.mode = 'lines';
        }
        if (a.calc_wavelength_m !== undefined) {
          const m = parseLengthM(a.calc_wavelength_m, 'calc_wavelength_m', 'm');
          if (m <= 0) throw new Error('calc_wavelength_m must be positive.');
          p.calc = clamp(Math.log10(m), -13.5, 3.5, 0.01).val;
        }
        await tick();

        const cmp = host.cmp.photon();
        if (a.level !== undefined && cmp) {
          p.mode = 'lines'; await tick();
          const at = ATOMS.find((x) => x.id === p.atom) ?? ATOMS[0];
          let idx: number;
          if (typeof a.level === 'number') {
            idx = Math.round(a.level);
          } else {
            const s = String(a.level).trim().toLowerCase();
            if (s.includes('ion') || s === '-1' || s === '0 ev') idx = -1;
            else if (/^n\s*=\s*(\d+)$/.test(s) && at.id === 'h') idx = Number(s.match(/\d+/)![0]) - 1;
            else {
              const found = at.levels.findIndex((l) => l.name.toLowerCase().includes(s));
              if (found >= 0) idx = found;
              else if (/^\d+$/.test(s)) idx = Number(s);
              else throw new Error(`Unknown level ${JSON.stringify(a.level)} for ${at.name}. Valid: ${at.levels.map((l, i) => `${i} (${l.name})`).join(', ')}, or "ionised" (-1).`);
            }
          }
          if (idx < -1 || idx >= at.levels.length) throw new Error(`level index must be -1 (ionised) or 0..${at.levels.length - 1}.`);
          cmp.kGoLevel(idx);
        }
        if (a.action && cmp) {
          const act = String(a.action).toLowerCase();
          if (act === 'play') cmp.kSetPlaying(true);
          else if (act === 'pause') cmp.kSetPlaying(false);
          else if (act === 'find_vs') {
            p.mode = 'pe'; p.app = 'cell'; await tick();
            if (!cmp.kRecord()) throw new Error('No photoelectrons emitted at this wavelength (hf < φ); shorten wavelength or pick a lower work-function metal.');
            notes.push('found stopping potential Vs and plotted point');
          } else if (act === 'charge_neg') { p.mode = 'pe'; p.app = 'scope'; cmp.kCharge(-1); }
          else if (act === 'charge_pos') { p.mode = 'pe'; p.app = 'scope'; cmp.kCharge(1); }
          else if (act === 'clear_screen') cmp.kClearBars();
          else throw new Error('action must be play, pause, find_vs, charge_neg, charge_pos or clear_screen.');
        }
        await tick();
        return (notes.length ? `Notes: ${notes.join('; ')}.\n` : '') + describeTab('photon');
      },
    },
    {
      name: 'waves_practice',
      description: 'Control the Waves Lab Practice quiz tab: choose a topic, answer the current question, or move to the next question.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', enum: ['all', 'waves', 'superpose', 'standing', 'light', 'diffract', 'echo', 'photon'] },
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
