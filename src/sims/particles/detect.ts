/* Particle Lab: detectors. Every track is computed, not drawn by hand.

   A charged particle is stepped along its path. At each step the magnetic force turns it through ds/r, with
   r = p/BQ (in practical units r/cm = p/(MeV/c) ÷ 3B/T for charge e), towards the side Fleming's left-hand rule
   gives; the magnetic force is always at right angles to the motion, so it does no work and the speed changes only
   because the particle ionises the medium and loses energy (dE/dx, from the Bethe formula scaled so that a fast
   particle loses 0.28 MeV per cm of liquid hydrogen). As it slows, p falls and the track curls more tightly; the
   ionisation per cm rises, so the track gets denser (thicker) towards the end.

   Conventions: 2D coordinates in cm in the plane the photograph sees; B points out of that plane (towards the
   camera). Then a positive particle curves clockwise and a negative one anticlockwise.

   The bubble-chamber events use real masses and two-body kinematics (the decay products are boosted from the
   parent's rest frame), so the momenta and opening angles are what a real photograph would show. */

const MASS = { e: 0.511, mu: 105.66, pi: 139.57, p: 938.27, K: 497.61, L: 1115.68, a: 3727.4 } as const;

export interface TPt { x: number; y: number; r: number /* radius of curvature / cm (Infinity: straight) */; p: number /* MeV/c */; t: number /* s */; d: number /* ionisation relative to a fast particle */ }
export interface Track {
  pid: string;            // particle id in data.ts ('anti-pi+' is π⁻), or '' for a neutral hint
  name: string;           // what it is, in words
  q: number;              // charge / e
  pts: TPt[];
  why: string;            // how you can tell what it is
  neutral?: boolean;      // a neutral particle: no track (drawn only as a dashed hint)
  B: number;              // field it moved in / T
}

/* ---------- random numbers that repeat (so an event looks the same every time) ---------- */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gaussOf = (rnd: () => number) => () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };

/* ---------- energy loss ---------- */

/** Ionisation per cm relative to a minimum-ionising particle, from the Bethe formula (mean excitation energy I in eV). */
export function bethe(p: number, m: number, I = 21.8): number {
  const E = Math.sqrt(p * p + m * m), b2 = (p / E) ** 2, bg2 = (p / m) ** 2;
  const L = (bg: number, bb: number) => Math.log((2 * 511000 * bg) / I) - bb;
  const min = L(12.25, 0.9246) / 0.9246;
  const l = L(bg2, b2);
  if (l < 0.5) return 60;
  return Math.max(1, Math.min(60, l / b2 / min));
}
/** Electrons: ionisation is almost constant once they are relativistic (above about 1 MeV). */
const dEdxRel = (pid: string, p: number, m: number) => (pid === 'e' || pid === 'anti-e' ? Math.max(1, bethe(p, m) * 0.9) : bethe(p, m));

/* ---------- stepping a charged particle through a field ---------- */

export interface Box { x0: number; x1: number; y0: number; y1: number }
interface TraceOpts {
  pid: string; name: string; q: number; m: number;
  x: number; y: number; ang: number;   // start, direction (radians from +x, anticlockwise)
  p: number;                            // MeV/c
  B: number;                            // T (out of the plane)
  loss: number;                         // MeV per cm for a minimum-ionising particle of charge e (0.28 in liquid hydrogen)
  t0: number; v?: number;               // start time / s and drawing speed / cm s⁻¹
  box?: Box; circle?: number;           // stop when it leaves the chamber
  maxLen?: number; pStop?: number;      // stop after this path length, or below this momentum
  scatter?: number;                     // multiple scattering: rms angle per √cm for p = 1 MeV/c
  rnd?: () => number;
  why: string;
}
export interface TraceEnd { x: number; y: number; ang: number; p: number; t: number; stopped: boolean }

const DS = 0.12; // cm per step

export function trace(o: TraceOpts): { track: Track; end: TraceEnd } {
  const pts: TPt[] = [];
  let { x, y, ang, p } = o;
  let t = o.t0, s = 0;
  const v = o.v ?? 30;
  const g = o.rnd ? gaussOf(o.rnd) : null;
  const max = o.maxLen ?? 400, pStop = o.pStop ?? 0.6 * Math.sqrt(o.m) * 0.05 + 0.4;
  let stopped = false;
  const push = (d: number) => pts.push({ x, y, r: o.B ? p / (3 * o.B * Math.abs(o.q)) : Infinity, p, t, d });
  push(dEdxRel(o.pid, p, o.m) * o.q * o.q);
  for (let k = 0; k < 20000; k++) {
    const d = dEdxRel(o.pid, p, o.m) * o.q * o.q;
    // energy lost in this step, then the new momentum
    const E = Math.sqrt(p * p + o.m * o.m) - o.loss * d * DS;
    if (E <= o.m * 1.0000001) { stopped = true; break; }
    p = Math.sqrt(E * E - o.m * o.m);
    if (p < pStop) { stopped = true; break; }
    // turn: positive charge clockwise with B out of the plane
    if (o.B) ang -= Math.sign(o.q) * (DS * 3 * o.B * Math.abs(o.q)) / p;
    if (g && o.scatter) ang += g() * (o.scatter / p) * Math.sqrt(DS);
    x += Math.cos(ang) * DS;
    y += Math.sin(ang) * DS;
    s += DS;
    t += DS / v;
    if (o.box && (x < o.box.x0 || x > o.box.x1 || y < o.box.y0 || y > o.box.y1)) break;
    if (o.circle && x * x + y * y > o.circle * o.circle) break;
    if (s >= max) break;
    if (k % 2 === 0) push(d);
  }
  push(dEdxRel(o.pid, p, o.m) * o.q * o.q);
  return { track: { pid: o.pid, name: o.name, q: o.q, pts, why: o.why, B: o.B }, end: { x, y, ang, p, t, stopped } };
}

/** A neutral particle: a straight dashed hint of length len. */
export function neutral(pid: string, name: string, x: number, y: number, ang: number, len: number, p: number, t0: number, why: string, v = 30): { track: Track; end: TraceEnd } {
  const pts: TPt[] = [];
  const n = Math.max(2, Math.round(len / 0.5));
  for (let i = 0; i <= n; i++) {
    const s = (len * i) / n;
    pts.push({ x: x + Math.cos(ang) * s, y: y + Math.sin(ang) * s, r: Infinity, p, t: t0 + s / v, d: 0 });
  }
  const e = pts[pts.length - 1];
  return { track: { pid, name, q: 0, pts, why, neutral: true, B: 0 }, end: { x: e.x, y: e.y, ang, p, t: e.t, stopped: false } };
}

/* ---------- relativistic two-body kinematics, in the plane ---------- */

const pStar = (M: number, m1: number, m2: number) => Math.sqrt(Math.max(0, (M * M - (m1 + m2) ** 2) * (M * M - (m1 - m2) ** 2))) / (2 * M);

/** A parent of mass M moving with momentum P at angle A decays to m1 and m2; daughter 1 leaves at angle phi to the
    parent's direction in the parent's rest frame. Returns the lab momenta and directions of both. */
export function decay2(M: number, P: number, A: number, m1: number, m2: number, phi: number) {
  const ps = pStar(M, m1, m2);
  const E = Math.sqrt(P * P + M * M), gam = E / M, beta = P / E;
  const out = [[m1, phi], [m2, phi + Math.PI]].map(([m, f]) => {
    const Es = Math.sqrt(ps * ps + m * m);
    const par = gam * (ps * Math.cos(f) + beta * Es), perp = ps * Math.sin(f);
    return { p: Math.hypot(par, perp), ang: A + Math.atan2(perp, par) };
  });
  return { ps, d1: out[0], d2: out[1] };
}
/** Beam a (mass ma, momentum pa along angle A) hits target b at rest, making c and d; c leaves at CM angle th. */
export function collide2(ma: number, pa: number, A: number, mb: number, mc: number, md: number, th: number) {
  const Ea = Math.sqrt(pa * pa + ma * ma);
  const s = ma * ma + mb * mb + 2 * Ea * mb, W = Math.sqrt(s);
  // the CM moves like a "parent" of mass W and momentum pa
  const r = decay2(W, pa, A, mc, md, th);
  return { W, threshold: ((mc + md) ** 2 - ma * ma - mb * mb) / (2 * mb), ...r };
}

/* ---------- the bubble chamber: classic events ---------- */

export const BUBBLE_B = 1.5;     // T
export const LH2 = 0.28;         // MeV cm⁻¹ for a minimum-ionising particle in liquid hydrogen
export const CHAMBER: Box = { x0: -40, x1: 40, y0: -25, y1: 25 };

export interface BEvent {
  id: string;
  name: string;
  title: string;
  equation: string;           // the reaction(s), written out
  what: string[];             // what happened
  checks: { label: string; before: string; after: string; ok: boolean }[];
  momentum: string;           // how momentum is conserved
  tracks: Track[];
  vertex?: { x: number; y: number; label: string }[];
  dur: number;                // seconds to draw it all
}

const posWhy = 'Curves clockwise here. B points out of the screen, so by Fleming’s left-hand rule (current = direction of a positive charge’s motion) a positive charge is pushed this way: it is positive.';
const negWhy = 'Curves anticlockwise here: the opposite way to a positive charge in the same field (Fleming’s left-hand rule), so it is negative.';

export function bubbleEvents(): BEvent[] {
  const B = BUBBLE_B, box = CHAMBER;
  const ev: BEvent[] = [];

  /* 1. positive and negative: π⁺, π⁻ of the same momentum, and a slow proton */
  {
    const t1 = trace({ pid: 'pi+', name: 'π⁺ (positive pion)', q: 1, m: MASS.pi, x: -40, y: 4, ang: 0.02, p: 320, B, loss: LH2, t0: 0, box,
      why: `${posWhy} It has the same radius as the π⁻ beside it, so the same momentum.` });
    const t2 = trace({ pid: 'anti-pi+', name: 'π⁻ (negative pion)', q: -1, m: MASS.pi, x: -40, y: -4, ang: -0.02, p: 320, B, loss: LH2, t0: 0, box,
      why: `${negWhy} Same momentum as the π⁺, so the same radius, curving the other way.` });
    const t3 = trace({ pid: 'p', name: 'proton (slow)', q: 1, m: MASS.p, x: -40, y: 14, ang: -0.05, p: 360, B, loss: LH2, t0: 0.4, box,
      why: 'Positive (curves clockwise) and much thicker than the pions: a slow, heavy particle ionises far more per cm. It loses energy fast, curls more tightly and stops: a proton.' });
    ev.push({
      id: 'signs', name: 'Positive and negative', title: 'Which way it curves gives the sign of the charge',
      equation: 'π⁺ and π⁻ enter with the same momentum; a slow proton enters above them',
      what: [
        'All three move from left to right through the same magnetic field, out of the screen.',
        'The π⁺ and π⁻ curve opposite ways with the same radius: equal momentum, opposite charge (r = p/BQ).',
        'The proton is moving much more slowly. It ionises far more strongly, so its track is thick, and it loses energy quickly: p falls, so r falls and the track curls tighter until it stops.',
      ],
      checks: [], momentum: 'Nothing interacts here: each particle’s momentum changes direction (the force is always at right angles to the motion) and falls only through ionisation.',
      tracks: [t1.track, t2.track, t3.track], dur: Math.max(t1.end.t, t2.end.t, t3.end.t) + 0.3,
    });
  }

  /* 2. electrons spiralling: Compton electrons knocked out by invisible γ-rays */
  {
    const a = trace({ pid: 'e', name: 'electron (e⁻)', q: -1, m: MASS.e, x: -22, y: -6, ang: 0.15, p: 32, B, loss: LH2, t0: 0, box, pStop: 0.8,
      why: `${negWhy} A light particle that keeps losing energy by ionisation: its radius shrinks steadily, so it spirals inwards. A spiral is the signature of an electron.` });
    const b = trace({ pid: 'e', name: 'electron (e⁻)', q: -1, m: MASS.e, x: 6, y: 10, ang: -0.6, p: 18, B, loss: LH2, t0: 0.6, box, pStop: 0.8,
      why: `${negWhy} It starts in the middle of the liquid: a γ-ray (no track) knocked it out of a hydrogen atom.` });
    const c = trace({ pid: 'anti-e', name: 'positron (e⁺)', q: 1, m: MASS.e, x: 14, y: -12, ang: 2.4, p: 24, B, loss: LH2, t0: 1.1, box, pStop: 0.8,
      why: `${posWhy} Spirals inwards like an electron, same mass, opposite charge: a positron.` });
    const gA = neutral('gamma', 'γ-ray photon', -40, -9, Math.atan2(3, 18), Math.hypot(18, 3), 40, -0.6, 'No charge, so no ionisation and no bubbles: you can only infer it.');
    ev.push({
      id: 'spirals', name: 'Spirals', title: 'Electrons spiral because they keep losing energy',
      equation: 'γ + e⁻ (in an atom) → γ + e⁻ (Compton scattering); a positron spirals the other way',
      what: [
        'Electrons are so light that a few tens of MeV/c of momentum gives a radius of only a few cm in 1.5 T.',
        'Each centimetre of liquid hydrogen takes about 0.28 MeV from it by ionisation. Its momentum falls, so r = p/BQ falls and the track winds into a spiral.',
        'The magnetic force does no work (it is always at right angles to the velocity): it never changes the speed. Only the liquid slows the particle.',
        'Electrons that start in mid-liquid were knocked out of atoms by γ-ray photons, which leave no track of their own.',
      ],
      checks: [], momentum: 'An electron knocked out by a γ-ray moves roughly in the photon’s direction: the photon’s momentum is shared between the electron and the scattered photon.',
      tracks: [gA.track, a.track, b.track, c.track], dur: Math.max(a.end.t, b.end.t, c.end.t) + 0.3,
    });
  }

  /* 3. pair production γ → e⁺ e⁻ */
  {
    const Eg = 64; // MeV
    const x0 = -6, y0 = -2;
    const g = neutral('gamma', 'γ-ray photon (no track)', -40, -10, Math.atan2(y0 + 10, x0 + 40), Math.hypot(x0 + 40, y0 + 10), Eg, -0.8, 'No charge, so no track: the photon is only seen when it turns into charged particles.');
    const A = Math.atan2(y0 + 10, x0 + 40);
    const Ke1 = 38.5, Ke2 = Eg - 2 * MASS.e - Ke1;
    const pe1 = Math.sqrt(Ke1 * Ke1 + 2 * Ke1 * MASS.e), pe2 = Math.sqrt(Ke2 * Ke2 + 2 * Ke2 * MASS.e);
    const ep = trace({ pid: 'anti-e', name: 'positron (e⁺)', q: 1, m: MASS.e, x: x0, y: y0, ang: A - 0.03, p: pe1, B, loss: LH2, t0: g.end.t, box, pStop: 0.8,
      why: `${posWhy} It appears from nowhere together with an electron that curls the opposite way: the pair was made by a photon.` });
    const em = trace({ pid: 'e', name: 'electron (e⁻)', q: -1, m: MASS.e, x: x0, y: y0, ang: A + 0.04, p: pe2, B, loss: LH2, t0: g.end.t, box, pStop: 0.8,
      why: `${negWhy} Starts at the same point as the positron: one of an electron–positron pair.` });
    ev.push({
      id: 'pair', name: 'Pair production', title: 'A photon turns into an electron and a positron',
      equation: 'γ → e⁻ + e⁺  (next to a nucleus, which takes up a little momentum)',
      what: [
        'A γ-ray photon enters from the left. It has no charge, so it leaves no track: the gap before the V.',
        'Near a nucleus it converts into an electron–positron pair: energy becomes mass, ΔE = c²Δm.',
        `It needs at least 2 × 0.511 = 1.02 MeV to make the two rest masses; this photon had ${Eg} MeV, so the rest (${(Eg - 1.022).toFixed(1)} MeV) is the pair’s kinetic energy: ${Ke1} MeV and ${Ke2.toFixed(1)} MeV here.`,
        'The two tracks start at one point and curl opposite ways: opposite charges. The more energetic one curls less.',
      ],
      checks: [
        { label: 'Charge', before: 'γ: 0', after: 'e⁻ + e⁺: −1 + 1 = 0', ok: true },
        { label: 'Lepton number', before: '0', after: '+1 + (−1) = 0', ok: true },
        { label: 'Energy', before: `${Eg} MeV`, after: `2 × 0.511 + ${Ke1} + ${Ke2.toFixed(1)} = ${Eg} MeV`, ok: true },
      ],
      momentum: 'Both particles go forwards, in the photon’s direction, with a narrow opening angle: together they carry the photon’s momentum. A photon cannot do this in empty space (energy and momentum could not both be conserved); a nearby nucleus recoils to make it possible.',
      tracks: [g.track, ep.track, em.track], vertex: [{ x: x0, y: y0, label: 'γ → e⁺ e⁻' }], dur: Math.max(ep.end.t, em.end.t) + 0.3,
    });
  }

  /* 4. delta rays along a fast beam track */
  {
    const rnd = seeded(41);
    const tracks: Track[] = [];
    let dur = 0;
    for (const [k, y] of [-12, -3, 9].entries()) {
      const beam = trace({ pid: 'anti-pi+', name: 'π⁻ beam particle (4 GeV/c)', q: -1, m: MASS.pi, x: -40, y, ang: 0.02, p: 4000, B, loss: LH2, t0: k * 0.15, box, v: 60,
        why: 'A fast beam particle: momentum 4 GeV/c, so r = p/BQ is about 9 m and the track looks almost straight. Thin, because a fast particle ionises least.' });
      tracks.push(beam.track);
      dur = Math.max(dur, beam.end.t);
      // knock-on electrons at random points along it
      const n = 2 + Math.floor(rnd() * 3);
      for (let j = 0; j < n; j++) {
        const at = beam.track.pts[Math.floor((0.1 + 0.8 * rnd()) * beam.track.pts.length)];
        const T = 1.5 + rnd() * 9;     // MeV
        const pe = Math.sqrt(T * T + 2 * T * MASS.e);
        // a knock-on electron leaves at cos θ = √(T/(T + 2mₑ)) × (relative to the beam) for a heavy fast projectile
        const th = Math.acos(Math.min(1, Math.sqrt(T / (T + 2 * MASS.e)) * 0.99));
        const side = rnd() < 0.5 ? 1 : -1;
        const dr = trace({ pid: 'e', name: 'δ-ray (knock-on electron)', q: -1, m: MASS.e, x: at.x, y: at.y, ang: 0.02 + side * th, p: pe, B, loss: LH2, t0: at.t, box, pStop: 0.6,
          why: `${negWhy} A small curl starting on a fast track: an atomic electron knocked out by the passing particle (a δ-ray). They all curl the same way because they are all electrons.` });
        tracks.push(dr.track);
        dur = Math.max(dur, dr.end.t);
      }
    }
    ev.push({
      id: 'delta', name: 'δ-rays', title: 'Knock-on electrons along fast tracks',
      equation: 'π⁻ + e⁻ (in an atom) → π⁻ + e⁻ (fast)',
      what: [
        'Three fast negative pions from the accelerator cross the chamber. At 4 GeV/c they are hardly bent.',
        'Every so often a pion gives an atomic electron enough energy (a few MeV) to make a track of its own: a δ-ray.',
        'All the δ-rays curl the same way, because they are all negative electrons, and spiral in as they lose energy.',
        'Counting δ-rays per cm is one way to tell how strongly a particle ionises: more charge, or slower, means more.',
      ],
      checks: [{ label: 'Charge', before: 'π⁻ + e⁻: −2', after: 'π⁻ + e⁻: −2', ok: true }],
      momentum: 'The electron is knocked forwards and sideways; the pion, far heavier and faster, carries on almost undeflected.',
      tracks, dur: dur + 0.3,
    });
  }

  /* 5. associated production: π⁻ + p → K⁰ + Λ⁰, then K⁰ → π⁺ π⁻ and Λ⁰ → p π⁻ */
  {
    const pb = 1050, x0 = -12, y0 = 1;
    const Eth = collide2(MASS.pi, 0, 0, MASS.p, MASS.K, MASS.L, 0).threshold;
    const beam = trace({ pid: 'anti-pi+', name: 'π⁻ beam particle', q: -1, m: MASS.pi, x: -40, y: 0, ang: 0.02, p: pb, B, loss: LH2, t0: 0, box, maxLen: 28,
      why: `${negWhy} A beam particle from the accelerator. Its track ends where it hit a proton (a hydrogen nucleus) in the liquid.` });
    const vx = beam.end.x, vy = beam.end.y, A = beam.end.ang;
    const pr = collide2(MASS.pi, beam.end.p, A, MASS.p, MASS.K, MASS.L, 2.0);
    const kLen = 5.5, lLen = 12;
    const k0 = neutral('K0', 'K⁰ (neutral kaon, no track)', vx, vy, pr.d1.ang, kLen, pr.d1.p, beam.end.t, 'Neutral: no ionisation, so a gap. It travelled a few cm (its lifetime is about 10⁻¹⁰ s) before decaying.');
    const l0 = neutral('Lambda', 'Λ⁰ (lambda, no track)', vx, vy, pr.d2.ang, lLen, pr.d2.p, beam.end.t, 'Neutral: no track. The V of a proton and a π⁻ points back to the vertex.');
    const kd = decay2(MASS.K, pr.d1.p, pr.d1.ang, MASS.pi, MASS.pi, 1.1);
    const ld = decay2(MASS.L, pr.d2.p, pr.d2.ang, MASS.p, MASS.pi, -0.6);
    const kp = trace({ pid: 'pi+', name: 'π⁺ (from the K⁰)', q: 1, m: MASS.pi, x: k0.end.x, y: k0.end.y, ang: kd.d1.ang, p: kd.d1.p, B, loss: LH2, t0: k0.end.t, box,
      why: `${posWhy} One arm of a V appearing from nowhere: a neutral particle decayed into a + and a − particle.` });
    const km = trace({ pid: 'anti-pi+', name: 'π⁻ (from the K⁰)', q: -1, m: MASS.pi, x: k0.end.x, y: k0.end.y, ang: kd.d2.ang, p: kd.d2.p, B, loss: LH2, t0: k0.end.t, box,
      why: `${negWhy} The other arm of the K⁰ V: total charge +1 − 1 = 0, as the K⁰ had.` });
    const lp = trace({ pid: 'p', name: 'proton (from the Λ⁰)', q: 1, m: MASS.p, x: l0.end.x, y: l0.end.y, ang: ld.d1.ang, p: ld.d1.p, B, loss: LH2, t0: l0.end.t, box,
      why: `${posWhy} Thicker than a pion track at similar curvature: a slower, heavier particle. The Λ⁰ always gives the proton most of the momentum.` });
    const lm = trace({ pid: 'anti-pi+', name: 'π⁻ (from the Λ⁰)', q: -1, m: MASS.pi, x: l0.end.x, y: l0.end.y, ang: ld.d2.ang, p: ld.d2.p, B, loss: LH2, t0: l0.end.t, box,
      why: `${negWhy} With the proton, it makes the second V: charge 0 before (Λ⁰), +1 − 1 = 0 after.` });
    void x0; void y0;
    ev.push({
      id: 'strange', name: 'Strange particles', title: 'Two neutral particles, two V’s',
      equation: 'π⁻ + p → K⁰ + Λ⁰,  then K⁰ → π⁺ + π⁻  and  Λ⁰ → p + π⁻',
      what: [
        `A π⁻ from the beam (${(pb / 1000).toFixed(2)} GeV/c) hits a proton at rest, a hydrogen nucleus in the liquid. Its track simply ends.`,
        'Two neutral particles fly out, a K⁰ and a Λ⁰. Being neutral they leave no track: two gaps.',
        'A few cm later each decays into a positive and a negative particle: two V shapes, each pointing back to where the π⁻ track ended.',
        `Energy: the beam needs a total energy of at least ${(Eth / 1000).toFixed(2)} GeV (momentum ${(Math.sqrt(Eth * Eth - MASS.pi ** 2) / 1000).toFixed(2)} GeV/c) because the K⁰ and Λ⁰ have more rest mass (1613 MeV/c²) than the π⁻ and p (1078 MeV/c²).`,
        'Strange particles are always made in pairs like this (associated production) but decay slowly, one at a time.',
      ],
      checks: [
        { label: 'Charge', before: 'π⁻ + p: −1 + 1 = 0', after: 'K⁰ + Λ⁰: 0 + 0 = 0', ok: true },
        { label: 'Baryon number', before: '0 + 1 = 1', after: '0 + 1 = 1', ok: true },
        { label: 'K⁰ decay, charge', before: '0', after: 'π⁺ + π⁻: +1 − 1 = 0', ok: true },
        { label: 'Λ⁰ decay, charge', before: '0', after: 'p + π⁻: +1 − 1 = 0', ok: true },
        { label: 'Λ⁰ decay, baryon number', before: '1', after: 'p + π⁻: 1 + 0 = 1', ok: true },
        { label: 'Strangeness (beyond the spec)', before: '0 + 0 = 0', after: 'K⁰ (+1) + Λ⁰ (−1) = 0', ok: true },
      ],
      momentum: 'Before, all the momentum is the beam’s, along its track. Afterwards the two neutral particles share it, one each side of the beam line, so their sideways momenta cancel. Each V’s two tracks then share the momentum of the neutral particle that made it, so the V opens around the line pointing back to the vertex.',
      tracks: [beam.track, k0.track, l0.track, kp.track, km.track, lp.track, lm.track],
      vertex: [{ x: vx, y: vy, label: 'π⁻ p → K⁰ Λ⁰' }, { x: k0.end.x, y: k0.end.y, label: 'K⁰ → π⁺π⁻' }, { x: l0.end.x, y: l0.end.y, label: 'Λ⁰ → pπ⁻' }],
      dur: Math.max(kp.end.t, km.end.t, lp.end.t, lm.end.t) + 0.3,
    });
  }

  /* 6. π⁺ → μ⁺ → e⁺ */
  {
    const pi = trace({ pid: 'pi+', name: 'π⁺ (comes to rest)', q: 1, m: MASS.pi, x: -38, y: -15, ang: 0.9, p: 110, B, loss: LH2, t0: 0, box, v: 26,
      why: `${posWhy} It slows down (the track thickens and curls tighter) and stops inside the liquid, then decays at rest.` });
    // at rest: π⁺ → μ⁺ ν, muon 4.1 MeV, same every time
    const Tmu = 4.12, pmu = Math.sqrt(Tmu * Tmu + 2 * Tmu * MASS.mu);
    const nu1 = neutral('numu', 'ν_μ (no track)', pi.end.x, pi.end.y, 0.9 + Math.PI, 6, pmu, pi.end.t, 'A neutrino: no charge, hardly interacts, no track. It carries off momentum equal and opposite to the muon’s.');
    const mu = trace({ pid: 'anti-mu', name: 'μ⁺ (antimuon)', q: 1, m: MASS.mu, x: pi.end.x, y: pi.end.y, ang: 0.9, p: pmu, B, loss: LH2, t0: pi.end.t + 0.2, box, v: 3,
      why: 'A short, thick track, always the same length: a pion at rest decays into two particles, so the muon always gets the same energy (4.1 MeV), like the α particles from one source.' });
    const pe = Math.sqrt(36 * 36 + 2 * 36 * MASS.e);
    const e = trace({ pid: 'anti-e', name: 'e⁺ (positron)', q: 1, m: MASS.e, x: mu.end.x, y: mu.end.y, ang: 2.6, p: pe, B, loss: LH2, t0: mu.end.t + 0.3, box, pStop: 0.8,
      why: `${posWhy} It spirals: a positron, from the decay of the stopped μ⁺. Its energy varies from event to event because three particles share it.` });
    ev.push({
      id: 'pimue', name: 'π → μ → e', title: 'A decay chain: pion, muon, positron',
      equation: 'π⁺ → μ⁺ + ν_μ,  then  μ⁺ → e⁺ + νₑ + ν̄_μ',
      what: [
        'A slow π⁺ comes in, thickens as it slows (more ionisation per cm) and stops.',
        'At rest it decays into a μ⁺ and a neutrino. The muon track is short (under 1 cm: zoom in) and always the same length, because a two-body decay at rest always shares the energy the same way.',
        'The μ⁺ stops and decays into a positron and two neutrinos. The positron spirals away; its energy varies, because three particles share it.',
        'The neutrinos leave nothing: their only sign is that momentum seems to be missing at each vertex.',
      ],
      checks: [
        { label: 'π⁺ decay, charge', before: '+1', after: 'μ⁺ + ν_μ: +1 + 0', ok: true },
        { label: 'π⁺ decay, lepton number', before: '0', after: 'μ⁺ (−1) + ν_μ (+1) = 0', ok: true },
        { label: 'μ⁺ decay, charge', before: '+1', after: 'e⁺ + νₑ + ν̄_μ: +1', ok: true },
        { label: 'μ⁺ decay, lepton numbers', before: 'L_μ = −1, Lₑ = 0', after: 'L_μ: −1 (ν̄_μ); Lₑ: −1 (e⁺) + 1 (νₑ) = 0', ok: true },
      ],
      momentum: 'The pion stopped, so it had no momentum: the muon and the invisible neutrino must fly apart in exactly opposite directions with equal momenta. That fixed share is why every muon track has the same length.',
      tracks: [pi.track, nu1.track, mu.track, e.track],
      vertex: [{ x: pi.end.x, y: pi.end.y, label: 'π⁺ → μ⁺ ν' }],
      dur: e.end.t + 0.3,
    });
  }
  return ev;
}

/* ---------- the cloud chamber ---------- */

export const CLOUD_R = 10;          // chamber radius / cm
export const CLOUD_B = 0.5;         // T, when the magnet is on
export const AIR = 0.0018;          // MeV cm⁻¹, minimum-ionising, in air
export const SOURCE_AT = { x: -8, y: 0 };

/** One kind of emission from a source: α (energy), β⁻/β⁺ (end-point energy: a continuous spectrum), γ (energy: seen
    only as a Compton electron), a conversion electron (one energy), or a thoron pair (two α from one atom in the gas). */
export type Emit =
  | { k: 'alpha'; E: number; from: string }
  | { k: 'beta-' | 'beta+'; Emax: number; from: string }
  | { k: 'gamma'; E: number; from: string }
  | { k: 'ce'; E: number; from: string }
  | { k: 'thoron'; from: string };

export interface CSource {
  id: string; label: string; name: string; half: string;
  gas?: boolean;                 // emanates from the whole volume (radon), not a point
  emits: string; use: string; safety: string;
  rate: number;                  // visible tracks per second in the chamber
  mix: [number, Emit][];         // relative share of the visible tracks
}

/* Energies in MeV from the nuclear data tables (rounded); a decay chain in equilibrium gives each member's
   emissions at about the same rate. */
export const CSOURCES: CSource[] = [
  { id: 'am241', label: 'Am-241', name: 'americium-241', half: '432 years', rate: 2.0,
    emits: 'α 5.49 MeV (85%) and 5.44 MeV (13%); a weak 60 keV γ-ray',
    use: 'The school α source; also in smoke detectors, where its α particles ionise the air between two plates.',
    safety: 'Sealed behind a thin foil. Handle with tongs and keep it pointing away from you; α is stopped by paper or skin, but is very dangerous inside the body.',
    mix: [[0.85, { k: 'alpha', E: 5.486, from: 'americium-241' }], [0.13, { k: 'alpha', E: 5.443, from: 'americium-241' }], [0.03, { k: 'ce', E: 0.0595, from: 'americium-241 (60 keV γ, absorbed by an atom: photoelectron)' }]] },
  { id: 'sr90', label: 'Sr-90', name: 'strontium-90 / yttrium-90', half: '28.8 years (Sr-90); 64 hours (Y-90)', rate: 1.6,
    emits: 'β⁻ up to 0.546 MeV (Sr-90) and up to 2.28 MeV (its daughter Y-90): a continuous spread of energies; no γ',
    use: 'The school β source; thickness gauges for paper and metal foil.',
    safety: 'Handle with tongs. β is stopped by a few mm of aluminium; keep it at arm’s length and in its lead-lined box.',
    mix: [[1, { k: 'beta-', Emax: 0.546, from: 'strontium-90' }], [1, { k: 'beta-', Emax: 2.28, from: 'yttrium-90' }]] },
  { id: 'co60', label: 'Co-60', name: 'cobalt-60', half: '5.27 years', rate: 1.3,
    emits: 'β⁻ up to 0.318 MeV, then two γ-rays every decay: 1.17 and 1.33 MeV',
    use: 'The school γ source; radiotherapy and sterilising medical equipment and food.',
    safety: 'γ-rays pass through the body: use tongs, keep your distance (inverse-square law) and store it behind lead.',
    mix: [[0.55, { k: 'beta-', Emax: 0.318, from: 'cobalt-60' }], [0.22, { k: 'gamma', E: 1.173, from: 'cobalt-60' }], [0.23, { k: 'gamma', E: 1.332, from: 'cobalt-60' }]] },
  { id: 'cs137', label: 'Cs-137', name: 'caesium-137', half: '30.1 years', rate: 1.3,
    emits: 'β⁻ up to 0.514 MeV (94%) or 1.18 MeV (6%); a 0.662 MeV γ-ray (85%), and sometimes a 0.624 MeV conversion electron instead',
    use: 'Calibrating γ-ray detectors; medical and industrial gauges. A product of nuclear fission (Chernobyl, Fukushima).',
    safety: 'Mostly a γ hazard: tongs, distance and lead.',
    mix: [[0.62, { k: 'beta-', Emax: 0.514, from: 'caesium-137' }], [0.04, { k: 'beta-', Emax: 1.176, from: 'caesium-137' }], [0.07, { k: 'ce', E: 0.624, from: 'barium-137m (conversion electron: one energy, so one length)' }], [0.27, { k: 'gamma', E: 0.662, from: 'barium-137m' }]] },
  { id: 'na22', label: 'Na-22', name: 'sodium-22', half: '2.60 years', rate: 1.4,
    emits: 'β⁺ (positrons) up to 0.546 MeV; a 1.27 MeV γ-ray; and two 0.511 MeV γ-rays each time a positron annihilates',
    use: 'A positron source: calibrating PET scanners, and studying antimatter in the lab.',
    safety: 'The annihilation γ-rays need lead shielding; tongs and distance as for any γ source.',
    mix: [[0.62, { k: 'beta+', Emax: 0.546, from: 'sodium-22' }], [0.2, { k: 'gamma', E: 1.275, from: 'sodium-22' }], [0.18, { k: 'gamma', E: 0.511, from: 'positron annihilation' }]] },
  { id: 'ra226', label: 'Ra-226', name: 'radium-226 (with its decay chain)', half: '1600 years', rate: 2.6,
    emits: 'α from Ra-226 (4.78), Rn-222 (5.49), Po-218 (6.00), Po-214 (7.69) and Po-210 (5.30 MeV); β⁻ from Pb-214 (up to 1.02) and Bi-214 (up to 3.27 MeV); γ-rays (0.35, 0.61 MeV)',
    use: 'The classic “mixed” source of old school labs (α, β and γ at once); once used in luminous paint for watch dials.',
    safety: 'Must stay sealed: its daughter radon is a gas. Very toxic if swallowed or breathed in.',
    mix: [[1, { k: 'alpha', E: 4.784, from: 'radium-226' }], [1, { k: 'alpha', E: 5.49, from: 'radon-222' }], [1, { k: 'alpha', E: 6.002, from: 'polonium-218' }], [1, { k: 'alpha', E: 7.687, from: 'polonium-214' }], [0.7, { k: 'alpha', E: 5.304, from: 'polonium-210' }],
      [1, { k: 'beta-', Emax: 1.02, from: 'lead-214' }], [1, { k: 'beta-', Emax: 3.27, from: 'bismuth-214' }], [0.3, { k: 'gamma', E: 0.609, from: 'bismuth-214' }], [0.2, { k: 'gamma', E: 0.352, from: 'lead-214' }]] },
  { id: 'th232', label: 'Thorium mantle', name: 'thorium-232 gas-lantern mantle (with its chain)', half: '1.4 × 10¹⁰ years (Th-232)', rate: 2.4,
    emits: 'α from Th-232 (4.01), Th-228 (5.42), Ra-224 (5.69), Rn-220 (6.29), Po-216 (6.78), Bi-212 (6.05) and Po-212 (8.78 MeV, the longest α track); β⁻ from Ac-228, Pb-212, Bi-212, Tl-208; a 2.61 MeV γ. Thoron gas (Rn-220) leaks out and makes “V” pairs in the air.',
    use: 'Old camping-lantern mantles, which glow brightly because they contain thorium oxide: a free, harmless-looking source.',
    safety: 'Don’t handle a crumbling mantle or breathe its dust; wash your hands afterwards.',
    mix: [[1, { k: 'alpha', E: 4.012, from: 'thorium-232' }], [1, { k: 'alpha', E: 5.423, from: 'thorium-228' }], [1, { k: 'alpha', E: 5.686, from: 'radium-224' }], [0.6, { k: 'alpha', E: 6.288, from: 'radon-220 (thoron)' }], [0.6, { k: 'alpha', E: 6.778, from: 'polonium-216' }],
      [0.36, { k: 'alpha', E: 6.05, from: 'bismuth-212' }], [0.64, { k: 'alpha', E: 8.785, from: 'polonium-212' }], [0.6, { k: 'thoron', from: 'thoron (radon-220) that has leaked into the air' }],
      [0.6, { k: 'beta-', Emax: 2.08, from: 'actinium-228' }], [0.6, { k: 'beta-', Emax: 0.57, from: 'lead-212' }], [0.6, { k: 'beta-', Emax: 2.25, from: 'bismuth-212' }], [0.4, { k: 'beta-', Emax: 1.80, from: 'thallium-208' }], [0.25, { k: 'gamma', E: 2.614, from: 'thallium-208' }]] },
  { id: 'rn222', label: 'Radon gas', name: 'radon-222 in the air', half: '3.82 days', gas: true, rate: 1.2,
    emits: 'α 5.49 MeV from radon atoms anywhere in the gas, then α 6.00 (Po-218) and 7.69 MeV (Po-214) from its daughters',
    use: 'Not a lab source: radon seeps out of rocks and soil and gives about half of the average background dose in the UK.',
    safety: 'A risk in badly ventilated houses on granite: breathing it in raises the chance of lung cancer. Ventilation fixes it.',
    mix: [[1, { k: 'alpha', E: 5.49, from: 'radon-222' }], [0.6, { k: 'alpha', E: 6.002, from: 'polonium-218' }], [0.5, { k: 'alpha', E: 7.687, from: 'polonium-214' }]] },
  { id: 'u238', label: 'Uranium ore', name: 'uranium ore (pitchblende)', half: '4.47 × 10⁹ years (U-238)', rate: 2.2,
    emits: 'α from U-238 (4.20), U-234 (4.77), Th-230 (4.69), Ra-226 (4.78) and the radon daughters (5.49, 6.00, 7.69 MeV); β⁻ from Pa-234m (up to 2.27 MeV) and others; γ-rays',
    use: 'A mineral sample: the ore Becquerel and the Curies worked with. Uranium glass (it glows green under UV) gives the U-238 α and Pa-234m β alone.',
    safety: 'Low activity: keep it in a sealed box, don’t grind it, wash your hands.',
    mix: [[1, { k: 'alpha', E: 4.198, from: 'uranium-238' }], [1, { k: 'alpha', E: 4.775, from: 'uranium-234' }], [0.8, { k: 'alpha', E: 4.687, from: 'thorium-230' }], [0.8, { k: 'alpha', E: 4.784, from: 'radium-226' }],
      [0.6, { k: 'alpha', E: 5.49, from: 'radon-222' }], [0.6, { k: 'alpha', E: 6.002, from: 'polonium-218' }], [0.6, { k: 'alpha', E: 7.687, from: 'polonium-214' }],
      [1, { k: 'beta-', Emax: 2.27, from: 'protactinium-234m' }], [0.6, { k: 'beta-', Emax: 3.27, from: 'bismuth-214' }], [0.25, { k: 'gamma', E: 0.609, from: 'bismuth-214' }]] },
];
export const csource = (id: string) => CSOURCES.find((x) => x.id === id) ?? CSOURCES[0];

/** α range in air (Geiger’s rule): R ≈ 0.318 E^1.5 cm for E in MeV (good from 4 to 8 MeV). */
export const alphaRange = (E: number) => 0.318 * E ** 1.5;
/** Electron range in air (Katz–Penfold), cm: R = 0.412 E^(1.265 − 0.0954 ln E) g cm⁻² ÷ 1.2 × 10⁻³ g cm⁻³. */
export function electronRange(T: number) {
  const g = T < 2.5 ? 0.412 * T ** (1.265 - 0.0954 * Math.log(T)) : 0.53 * T - 0.106;
  return g / 1.2e-3;
}
/** A kinetic energy drawn from an allowed β spectrum with end-point Emax: N(T) ∝ pW(Emax − T)² (no Coulomb correction). */
export function betaEnergy(Emax: number, rnd: () => number) {
  const m = MASS.e, f = (T: number) => Math.sqrt(T * T + 2 * T * m) * (T + m) * (Emax - T) ** 2;
  let fmax = 0;
  for (let i = 1; i < 40; i++) fmax = Math.max(fmax, f((Emax * i) / 40));
  for (let i = 0; i < 300; i++) { const T = rnd() * Emax; if (rnd() * fmax * 1.05 <= f(T)) return Math.max(0.005, T); }
  return Emax / 3;
}

export interface Origin { x: number; y: number; dir: number | null /* null: any direction (a gas) */; spread: number }

/** The tracks one emission makes (two for a thoron pair). Times start at t0; `delay` marks a later track. */
export function cloudEmit(e: Emit, o: Origin, B: number, rnd: () => number, t0: number): Track[] {
  const g = gaussOf(rnd);
  const dirOf = () => (o.dir === null ? rnd() * Math.PI * 2 : o.dir + g() * o.spread);
  const fld = B ? ' The field barely bends it: its momentum is large (about 200 MeV/c), so r = p/BQ is metres, and it curves the opposite way to the electrons.' : '';
  if (e.k === 'alpha') return [alphaTrack(e.E, o.x, o.y, dirOf(), B, rnd, t0, `α particle, ${e.E.toFixed(2)} MeV`,
    `Short, thick and straight: an α particle from ${e.from}. It ionises so strongly that it loses all its ${e.E.toFixed(2)} MeV within ${alphaRange(e.E).toPrecision(2)} cm of air, and all α particles from one nuclide have the same energy, so the same range (R ≈ 0.318E^1.5 cm).${fld}`)];
  if (e.k === 'thoron') {
    // radon-220 decays (α 6.29 MeV); the polonium-216 left behind decays a fraction of a second later (α 6.78 MeV) from the same spot
    const ang = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * CLOUD_R * 0.72;
    const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
    const wait = -0.21 * Math.log(1 - rnd());   // mean life of Po-216: 0.145 s ÷ ln 2
    const a1 = rnd() * Math.PI * 2, a2 = a1 + (0.6 + rnd() * 2.2) * (rnd() < 0.5 ? 1 : -1);
    return [
      alphaTrack(6.288, x, y, a1, B, rnd, t0, 'α particle, 6.29 MeV (thoron, Rn-220)', 'One arm of a “V”: a thoron atom (radon-220) floating in the air decayed, giving a 6.29 MeV α. The polonium-216 atom it left behind decays about 0.2 s later from the same point: the second arm.'),
      alphaTrack(6.778, x, y, a2, B, rnd, t0 + wait, 'α particle, 6.78 MeV (polonium-216)', `The second arm of a thoron “V”: polonium-216 (half-life 0.145 s) decayed ${wait.toFixed(2)} s after the radon-220 at the same spot. Two α tracks from one point, slightly different lengths (6.29 and 6.78 MeV).`),
    ];
  }
  if (e.k === 'gamma') {
    // the photon leaves no track; occasionally it knocks an electron out of a molecule (Compton scattering) in mid-air
    const k = e.E / MASS.e, Tmax = (e.E * 2 * k) / (1 + 2 * k);
    const T = Math.max(0.01, Tmax * (0.15 + 0.85 * rnd()));
    const dist = 2 + rnd() * 12;
    const d0 = o.dir === null ? rnd() * Math.PI * 2 : o.dir + g() * 0.5;
    let x = o.x + Math.cos(d0) * dist, y = o.y + Math.sin(d0) * dist;
    if (x * x + y * y > (CLOUD_R * 0.9) ** 2) { const f = (CLOUD_R * 0.9) / Math.hypot(x, y); x *= f; y *= f; }
    const ang = d0 + g() * 0.6;   // Compton electrons go roughly forwards along the photon
    return [electronTrack(T, -1, x, y, ang, B, rnd, t0, `electron knocked out by a ${e.E.toFixed(3)} MeV γ-ray`,
      `A short, faint, wiggly track starting in mid-air, not at the source: an electron knocked out of a molecule by a γ-ray from ${e.from} (Compton scattering). The photon itself has no charge and ionises too weakly to leave a track. This electron got ${T.toFixed(2)} MeV; the most a ${e.E.toFixed(3)} MeV photon can give is ${Tmax.toFixed(2)} MeV.`)];
  }
  if (e.k === 'ce') return [electronTrack(e.E, -1, o.x, o.y, dirOf(), B, rnd, t0, `electron, ${e.E.toFixed(3)} MeV`,
    `A thin electron track from ${e.from}. Unlike β⁻ particles these electrons all have one energy (${e.E.toFixed(3)} MeV): the nucleus passed its energy straight to one of its atom’s own electrons.`)];
  const pos = e.k === 'beta+';
  const T = betaEnergy(e.Emax, rnd);
  return [electronTrack(T, pos ? 1 : -1, o.x, o.y, dirOf(), B, rnd, t0, pos ? `β⁺ particle (positron), ${T.toFixed(2)} MeV` : `β⁻ particle (electron), ${T.toFixed(2)} MeV`,
    `Thin, faint and wiggly: a ${pos ? 'β⁺ particle (a positron)' : 'β⁻ particle (an electron)'} from ${e.from}. It ionises weakly, and being so light it is knocked off course by collisions with air molecules. This one had ${T.toFixed(2)} MeV; β particles come out with any energy up to ${e.Emax} MeV, because a${pos ? ' neutrino' : 'n antineutrino'} takes the rest.${B ? ` In the field it curls tightly, ${pos ? 'the opposite way to the electrons (positive), the same way as the α particles' : 'the opposite way to the α particles (negative)'}.` : ''}${pos ? ' At the end it meets an electron and annihilates into two 0.511 MeV γ-rays (no tracks).' : ''}`)];
}

function alphaTrack(E: number, x: number, y: number, ang: number, B: number, rnd: () => number, t0: number, name: string, why: string): Track {
  const g = gaussOf(rnd);
  const R = alphaRange(E) * (1 + g() * 0.012);   // straggling: about 1%
  const pts: TPt[] = [];
  let a = ang, px = x, py = y;
  const n = Math.max(40, Math.round(R * 30));
  for (let i = 0; i <= n; i++) {
    const s = (R * i) / n;
    const T = E * Math.max(0, (R - s) / R) ** (1 / 1.5);
    const p = Math.sqrt(T * T + 2 * T * MASS.a);
    const d = Math.min(14, 1 / Math.max(0.07, (R - s) / R) ** 0.43);   // the Bragg peak: densest at the end
    if (i > 0) {
      if (B && p > 1) a -= (R / n) * (3 * B * 2) / p;
      px += Math.cos(a) * (R / n); py += Math.sin(a) * (R / n);
    }
    if (px * px + py * py > CLOUD_R * CLOUD_R) break;
    pts.push({ x: px, y: py, r: B ? p / (3 * B * 2) : Infinity, p, t: t0 + (s / R) * 0.14, d: 6 * d });
  }
  return { pid: 'alpha', name, q: 2, pts, B, why };
}

function electronTrack(T: number, q: 1 | -1, x: number, y: number, ang: number, B: number, rnd: () => number, t0: number, name: string, why: string): Track {
  const p = Math.sqrt(T * T + 2 * T * MASS.e);
  // the path drawn: its range in air, or until it leaves the thin sensitive layer (it is wiggling in 3D)
  let len = Math.min(electronRange(T) * 0.7, 3 + -9 * Math.log(1 - rnd()));
  if (B) len = Math.min(len, 2 * Math.PI * (p / (3 * B)) * (1.4 + rnd()));
  const { track } = trace({ pid: q > 0 ? 'anti-e' : 'e', name, q, m: MASS.e, x, y, ang, p, B, loss: AIR * 1.4, t0, v: 180,
    circle: CLOUD_R, maxLen: Math.max(0.3, len), scatter: 0.18, rnd, pStop: 0.05, why });
  return track;
}

/** Background tracks: cosmic-ray muons, cosmic electron showers, natural radon (and the odd thoron pair). */
export function backgroundTrack(kind: 'muon' | 'shower' | 'radon' | 'thoron', B: number, rnd: () => number, t0: number): Track[] {
  if (kind === 'radon') return cloudEmit({ k: 'alpha', E: 5.49, from: 'radon-222 in the air (natural background)' }, { x: (rnd() * 2 - 1) * 6, y: (rnd() * 2 - 1) * 6, dir: null, spread: 0 }, B, rnd, t0);
  if (kind === 'thoron') return cloudEmit({ k: 'thoron', from: 'thoron in the air' }, { x: 0, y: 0, dir: null, spread: 0 }, B, rnd, t0);
  const ang = rnd() * Math.PI * 2, off = (rnd() * 2 - 1) * 7;
  const x0 = -Math.cos(ang) * 13 - Math.sin(ang) * off, y0 = -Math.sin(ang) * 13 + Math.cos(ang) * off;
  if (kind === 'muon') {
    const q = rnd() < 0.56 ? 1 : -1; // slightly more μ⁺ than μ⁻ at sea level
    const { track } = trace({ pid: q > 0 ? 'anti-mu' : 'mu', name: q > 0 ? 'cosmic-ray muon (μ⁺)' : 'cosmic-ray muon (μ⁻)', q, m: MASS.mu, x: x0, y: y0, ang, p: 2000 + rnd() * 6000, B, loss: AIR, t0, v: 400, maxLen: 30, circle: 16,
      why: 'Long, thin and dead straight right across the chamber: a cosmic-ray muon, made high in the atmosphere. With a few GeV of energy it ionises lightly and is hardly deflected, even by the field. Time dilation is why so many reach the ground.' });
    track.pts = track.pts.filter((p) => p.x * p.x + p.y * p.y < CLOUD_R * CLOUD_R);
    return [track];
  }
  // a cosmic-ray shower: several fast electrons and positrons crossing together, almost parallel
  const n = 3 + Math.floor(rnd() * 4), out: Track[] = [];
  for (let i = 0; i < n; i++) {
    const q = rnd() < 0.5 ? 1 : -1, pe = 15 + rnd() * 120, da = (rnd() - 0.5) * 0.12, dx = (rnd() - 0.5) * 3;
    const { track } = trace({ pid: q > 0 ? 'anti-e' : 'e', name: q > 0 ? 'shower positron (cosmic ray)' : 'shower electron (cosmic ray)', q, m: MASS.e,
      x: x0 - Math.sin(ang) * dx, y: y0 + Math.cos(ang) * dx, ang: ang + da, p: pe, B, loss: AIR * 1.4, t0: t0 + i * 0.01, v: 400, maxLen: 30, circle: 16, scatter: 0.18, rnd,
      why: `One of several thin tracks crossing the chamber together: a cosmic-ray air shower, in which one very energetic particle high up has made a cascade of electrons, positrons and photons.${B ? ` In the field the electrons and positrons (${pe.toFixed(0)} MeV/c here) curve opposite ways.` : ''}` });
    track.pts = track.pts.filter((p) => p.x * p.x + p.y * p.y < CLOUD_R * CLOUD_R);
    if (track.pts.length > 1) out.push(track);
  }
  return out;
}

/** Where each solid source sits: around the edge, each pointing in (spread out), or all on one holder. */
export function holders(ids: string[], together: boolean): { id: string; x: number; y: number; dir: number }[] {
  const solid = ids.filter((id) => !csource(id).gas);
  if (together) return solid.map((id) => ({ id, x: SOURCE_AT.x, y: SOURCE_AT.y, dir: 0 }));
  const n = solid.length;
  return solid.map((id, i) => {
    const a = Math.PI + (n === 1 ? 0 : ((i / (n - 1)) - 0.5) * Math.min(Math.PI * 1.5, n * 0.75));
    const r = CLOUD_R * 0.8;
    return { id, x: Math.cos(a) * r, y: Math.sin(a) * r, dir: a + Math.PI };
  });
}

/* ---------- the collider detector (beyond the spec) ---------- */

export type Layer = 'tracker' | 'ecal' | 'hcal' | 'coil' | 'muon';
export const LAYERS: { id: Layer; name: string; r0: number; r1: number; what: string }[] = [
  { id: 'tracker', name: 'Tracker', r0: 0.04, r1: 1.1, what: 'Layers of silicon: a charged particle ionises each one it crosses. The hits join into a track; its curvature in the 3.8 T field gives the momentum (r = p/BQ).' },
  { id: 'ecal', name: 'Electromagnetic calorimeter', r0: 1.2, r1: 1.7, what: 'Dense crystals: electrons, positrons and photons make a shower of particles and stop. The light given out measures their energy.' },
  { id: 'hcal', name: 'Hadron calorimeter', r0: 1.78, r1: 2.9, what: 'Thick brass and steel with detectors between: hadrons (pions, protons, neutrons) smash into nuclei and stop in a wider, deeper shower.' },
  { id: 'coil', name: 'Magnet coil', r0: 2.95, r1: 3.25, what: 'A superconducting solenoid making the field along the beam pipe.' },
  { id: 'muon', name: 'Muon chambers', r0: 4.0, r1: 7.2, what: 'Gas detectors between thick iron: only muons (and neutrinos) get this far, so any track here is a muon.' },
];
export const COLLIDER_B = 3.8;

export type Shot = 'e' | 'anti-e' | 'gamma' | 'pi+' | 'n' | 'mu' | 'nue';
export const SHOTS: { id: Shot; label: string; charged: boolean; stops: Layer | 'escapes'; why: string }[] = [
  { id: 'e', label: 'e⁻', charged: true, stops: 'ecal', why: 'Electron: a curved track in the tracker, then a narrow shower that stops in the electromagnetic calorimeter.' },
  { id: 'gamma', label: 'γ', charged: false, stops: 'ecal', why: 'Photon: no track (no charge), then a narrow shower in the electromagnetic calorimeter. Same shower as an electron, but nothing in the tracker.' },
  { id: 'pi+', label: 'π⁺', charged: true, stops: 'hcal', why: 'Charged hadron: a track, a little energy in the electromagnetic calorimeter, then a big shower in the hadron calorimeter.' },
  { id: 'n', label: 'n', charged: false, stops: 'hcal', why: 'Neutral hadron (neutron): no track, then a shower in the hadron calorimeter only.' },
  { id: 'mu', label: 'μ⁻', charged: true, stops: 'escapes', why: 'Muon: a track that goes through everything, leaving only a little ionisation in each layer, and hits in the muon chambers.' },
  { id: 'nue', label: 'ν', charged: false, stops: 'escapes', why: 'Neutrino: passes through everything without a trace. It is found from missing momentum: the momenta of everything else do not add up to zero across the beam.' },
];
