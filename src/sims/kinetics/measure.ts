/* Kinetics Lab, Measuring rates: the five bench reactions of Topic 9A / 11.3, worked out as numbers.

   Each run is integrated once (small fixed steps, 1200 stored samples) and then read back by interpolation: the amount
   reacted, the quantity the apparatus shows (gas volume, mass lost, cloudiness, absorbance) and its true gradient.
   Rate laws are the accepted ones at this level, with constants chosen so runs last a minute or a few on the bench:

   marble   CaCO₃(s) + 2HCl(aq) → CaCl₂(aq) + H₂O(l) + CO₂(g)      chips in excess: rate = k·(surface)·[HCl]
   h2o2     2H₂O₂(aq) → 2H₂O(l) + O₂(g), MnO₂ catalyst             rate = k·(mass of MnO₂)·[H₂O₂]
   mg       Mg(s) + 2HCl(aq) → MgCl₂(aq) + H₂(g)                    acid in excess: rate = k·[HCl]·(Mg surface ∝ n^⅔)
   thio     S₂O₃²⁻(aq) + 2H⁺(aq) → S(s) + SO₂(aq) + H₂O(l)          rate = k[S₂O₃²⁻]; the cross goes at a fixed [S]
   iodine   CH₃COCH₃ + I₂ → CH₃COCH₂I + H⁺ + I⁻ (H⁺ catalyst)      rate = k[CH₃COCH₃][H⁺], zero order in I₂

   Temperature enters through Arrhenius, k(T) = k₂₉₈ exp(−Ea/R (1/T − 1/298)). Gas volumes use 24.0 dm³ mol⁻¹. */

import { R } from './consts';

export type RxId = 'marble' | 'h2o2' | 'mg' | 'thio' | 'iodine';
export type Method = 'syringe' | 'mass' | 'cross' | 'colour';
export type Size = 'large' | 'small' | 'powder';

export interface Setup {
  rx: RxId; method: Method;
  conc: number;      // marble, mg: [HCl]; h2o2: [H₂O₂]; mol dm⁻³
  temp: number;      // °C
  size: Size;        // marble chips
  cat: number;       // h2o2: g of MnO₂
  mg: number;        // g of Mg ribbon
  vThio: number;     // cm³ of 0.15 mol dm⁻³ thiosulfate, made up to 50 cm³ with water
  i2: number;        // iodine: [I₂]₀ / mol dm⁻³
  prop: number;      // [propanone] / mol dm⁻³
  acid: number;      // [H⁺] / mol dm⁻³
}

export const RX: { id: RxId; name: string; short: string; eq: string; methods: Method[] }[] = [
  { id: 'marble', name: 'Marble chips and hydrochloric acid', short: 'Marble + HCl', eq: 'CaCO₃(s) + 2HCl(aq) → CaCl₂(aq) + H₂O(l) + CO₂(g)', methods: ['syringe', 'mass'] },
  { id: 'h2o2', name: 'Hydrogen peroxide with manganese(IV) oxide', short: 'H₂O₂ + MnO₂', eq: '2H₂O₂(aq) → 2H₂O(l) + O₂(g)', methods: ['syringe', 'mass'] },
  { id: 'mg', name: 'Magnesium ribbon and hydrochloric acid', short: 'Mg + HCl', eq: 'Mg(s) + 2HCl(aq) → MgCl₂(aq) + H₂(g)', methods: ['syringe', 'mass'] },
  { id: 'thio', name: 'Sodium thiosulfate and hydrochloric acid', short: 'Thiosulfate', eq: 'Na₂S₂O₃(aq) + 2HCl(aq) → 2NaCl(aq) + S(s) + SO₂(aq) + H₂O(l)', methods: ['cross'] },
  { id: 'iodine', name: 'Iodine and propanone (acid catalysed)', short: 'Iodine + propanone', eq: 'CH₃COCH₃(aq) + I₂(aq) → CH₃COCH₂I(aq) + H⁺(aq) + I⁻(aq)', methods: ['colour'] },
];
export const METHOD_NAME: Record<Method, string> = { syringe: 'Gas syringe', mass: 'Mass loss on a balance', cross: 'Disappearing cross', colour: 'Colorimeter' };

export const VM = 24000;                 // cm³ of gas per mole at room temperature and pressure
export const THIO0 = 0.15;               // stock thiosulfate / mol dm⁻³
export const V_TOT = 55;                 // 50 cm³ thiosulfate + water, then 5 cm³ of 2.0 mol dm⁻³ HCl
export const S_CROSS = 0.0015;           // [S] formed when the cross can no longer be seen / mol dm⁻³
export const EPS = 200;                  // absorbance per mol dm⁻³ of I₂ in the 1 cm cell with a blue filter (A = εlc)
export const MASS0: Record<RxId, number> = { marble: 152.37, h2o2: 148.62, mg: 155.08, thio: 0, iodine: 0 };
export const SIZE_K: Record<Size, number> = { large: 0.012, small: 0.03, powder: 0.15 };   // s⁻¹ per mol dm⁻³ ... per [HCl] (first order)
const EA: Record<RxId, number> = { marble: 45e3, h2o2: 50e3, mg: 40e3, thio: 50e3, iodine: 86e3 };
export const K_IOD = 2.8e-5;             // dm³ mol⁻¹ s⁻¹ at 25 °C
export const K_THIO = 5.5e-4;            // s⁻¹ at 25 °C

export const arr = (rx: RxId, tC: number) => Math.exp((-EA[rx] / R) * (1 / (tC + 273) - 1 / 298));
export const thioConc = (v: number) => (THIO0 * v) / V_TOT;

export interface Run {
  setup: Setup;
  tEnd: number;            // s
  /** what the apparatus shows, against time */
  y: (t: number) => number;
  /** its true gradient (y units per second) */
  dy: (t: number) => number;
  yLabel: string; yUnit: string; yMax: number;
  res: number;             // the reading resolution (syringe 1 cm³, balance 0.01 g, colorimeter 0.001)
  every: number;           // a reading every … s
  /** convert a gradient in y units per second into mol dm⁻³ s⁻¹ or mol s⁻¹, with its unit and the working */
  toMol: (g: number) => { v: number; unit: string; how: string };
  extent: (t: number) => number;   // fraction of the limiting reagent used, 0–1
  crossT: number | null;           // thio: when the cross vanishes
  max: number;                     // final value of y (theoretical)
  note: string;
}

function integrate(f: (x: number) => number, x0: number, tEnd: number, N = 1200) {
  // f gives dx/dt for the amount left x; classic RK4 on a fixed grid, stored for interpolation
  const xs = new Float64Array(N + 1), h = tEnd / N;
  xs[0] = x0;
  let x = x0;
  for (let i = 1; i <= N; i++) {
    const sub = 4, hh = h / sub;
    for (let j = 0; j < sub; j++) {
      const k1 = f(x), k2 = f(Math.max(0, x + (hh / 2) * k1)), k3 = f(Math.max(0, x + (hh / 2) * k2)), k4 = f(Math.max(0, x + hh * k3));
      x = Math.max(0, x + (hh / 6) * (k1 + 2 * k2 + 2 * k3 + k4));
    }
    xs[i] = x;
  }
  const at = (t: number) => {
    const u = Math.min(N, Math.max(0, t / h)), i = Math.min(N - 1, Math.floor(u)), fr = u - i;
    return xs[i] + (xs[i + 1] - xs[i]) * fr;
  };
  return { at, rate: (t: number) => f(at(t)) };
}

const niceEnd = (t: number) => { const s = t > 400 ? 60 : t > 120 ? 30 : 10; return Math.max(30, Math.ceil(t / s) * s); };

export function simulate(s: Setup): Run {
  const ar = arr(s.rx, s.temp);
  if (s.rx === 'marble' || s.rx === 'h2o2') {
    // limiting solution: 20 cm³ of acid (marble) or of peroxide; both give one gas molecule per two molecules used
    const V = 0.02, n0 = s.conc * V;
    const k = s.rx === 'marble' ? SIZE_K[s.size] * ar : 0.02 * (s.cat / 0.2) * ar;
    const f = (n: number) => -k * n;                    // first order in the dissolved reagent
    const tEnd = niceEnd(Math.min(900, Math.log(50) / k));
    const I = integrate(f, n0, tEnd);
    const gas = (t: number) => (n0 - I.at(t)) / 2;     // mol of gas
    const dgas = (t: number) => -I.rate(t) / 2;
    const Mgas = s.rx === 'marble' ? 44.0 : 32.0, gasName = s.rx === 'marble' ? 'CO₂' : 'O₂';
    const syr = s.method === 'syringe';
    return {
      setup: s, tEnd,
      y: (t) => (syr ? gas(t) * VM : gas(t) * Mgas), dy: (t) => (syr ? dgas(t) * VM : dgas(t) * Mgas),
      yLabel: syr ? `volume of ${gasName}` : `mass lost`, yUnit: syr ? 'cm³' : 'g', yMax: syr ? 100 : Math.max(0.05, (n0 / 2) * Mgas * 1.15),
      res: syr ? 1 : 0.01, every: tEnd > 400 ? 30 : tEnd > 150 ? 15 : 10,
      toMol: (g) => syr
        ? { v: g / VM, unit: `mol s⁻¹ of ${gasName}`, how: `÷ 24 000 cm³ mol⁻¹` }
        : { v: g / Mgas, unit: `mol s⁻¹ of ${gasName}`, how: `÷ M(${gasName}) = ${Mgas} g mol⁻¹` },
      extent: (t) => 1 - I.at(t) / n0, crossT: null, max: syr ? (n0 / 2) * VM : (n0 / 2) * Mgas,
      note: s.rx === 'marble'
        ? 'The chips are in excess, so the acid runs out: the rate falls as [HCl] falls. Smaller chips: more surface, more collisions per second.'
        : 'MnO₂ is a heterogeneous catalyst: weigh it before and after, it is unchanged. More catalyst, more surface for the reaction.',
    };
  }
  if (s.rx === 'mg') {
    const n0 = s.mg / 24.3, Vacid = 0.05;
    const k = 0.02 * ar;
    // [HCl] falls by 2 mol per mol of Mg; the ribbon's area goes as n^⅔ (it thins evenly)
    const f = (n: number) => -k * Math.max(0, s.conc - (2 * (n0 - n)) / Vacid) * Math.pow(Math.max(0, n), 2 / 3) * Math.pow(n0, 1 / 3);
    const tEnd = niceEnd(Math.min(900, 4.6 / (k * s.conc)));
    const I = integrate(f, n0, tEnd);
    const h2 = (t: number) => n0 - I.at(t), dh2 = (t: number) => -I.rate(t);
    const syr = s.method === 'syringe';
    return {
      setup: s, tEnd,
      y: (t) => (syr ? h2(t) * VM : h2(t) * 2.02), dy: (t) => (syr ? dh2(t) * VM : dh2(t) * 2.02),
      yLabel: syr ? 'volume of H₂' : 'mass lost', yUnit: syr ? 'cm³' : 'g', yMax: syr ? 100 : 0.05,
      res: syr ? 1 : 0.01, every: tEnd > 400 ? 30 : tEnd > 150 ? 15 : 10,
      toMol: (g) => syr ? { v: g / VM, unit: 'mol s⁻¹ of H₂', how: '÷ 24 000 cm³ mol⁻¹' } : { v: g / 2.02, unit: 'mol s⁻¹ of H₂', how: '÷ M(H₂) = 2.02 g mol⁻¹' },
      extent: (t) => 1 - I.at(t) / n0, crossT: null, max: syr ? n0 * VM : n0 * 2.02,
      note: syr
        ? 'The acid is in excess, so the magnesium runs out. Hydrogen is the lightest gas there is: a gas syringe is the method to use.'
        : `Only ${(n0 * 2.02 * 1000).toFixed(1)} mg of hydrogen can form: on a balance reading to 0.01 g the whole reaction is a change of one or two digits. Mass loss suits heavy gases like CO₂, not H₂.`,
    };
  }
  if (s.rx === 'thio') {
    const c0 = thioConc(s.vThio), k = K_THIO * ar;
    const sOf = (t: number) => c0 * (1 - Math.exp(-k * t));
    const crossT = S_CROSS < c0 ? -Math.log(1 - S_CROSS / c0) / k : Infinity;
    const tEnd = niceEnd(Math.min(900, Number.isFinite(crossT) ? crossT * 1.25 : 900));
    return {
      setup: s, tEnd,
      y: (t) => sOf(t) / S_CROSS, dy: (t) => (c0 * k * Math.exp(-k * t)) / S_CROSS,
      yLabel: 'cloudiness ([S] ÷ [S] that hides the cross)', yUnit: '', yMax: 1.4,
      res: 0.01, every: 10,
      toMol: (g) => ({ v: g * S_CROSS, unit: 'mol dm⁻³ s⁻¹ of S', how: `× ${S_CROSS} mol dm⁻³` }),
      extent: (t) => sOf(t) / c0, crossT: Number.isFinite(crossT) ? crossT : null, max: c0 / S_CROSS,
      note: 'Every run stops at the same point: when the same amount of sulfur has formed. So the rate is proportional to 1/t.',
    };
  }
  // iodine + propanone, colorimetry: zero order in iodine, so the absorbance falls in a straight line
  const k = K_IOD * ar, r = k * s.prop * s.acid;
  const tEnd = niceEnd(Math.min(900, (s.i2 / r) * 1.15));
  const i2 = (t: number) => Math.max(0, s.i2 - r * t);
  return {
    setup: s, tEnd,
    y: (t) => EPS * i2(t), dy: (t) => (i2(t) > 0 ? -EPS * r : 0),
    yLabel: 'absorbance', yUnit: '', yMax: Math.max(0.5, EPS * s.i2 * 1.15),
    res: 0.001, every: tEnd > 400 ? 30 : 15,
    toMol: (g) => ({ v: g / EPS, unit: 'mol dm⁻³ s⁻¹ of I₂', how: `÷ ${EPS} (the calibration: A = ${EPS} × [I₂])` }),
    extent: (t) => 1 - i2(t) / s.i2, crossT: null, max: 0,
    note: 'A straight line: the rate does not change as the iodine is used up. The reaction is zero order with respect to iodine.',
  };
}

/** a reading as the instrument shows it: rounded to its resolution */
export const readAt = (run: Run, t: number) => Math.round(run.y(t) / run.res) * run.res;

/* ---------- choosing a technique (11.3) ---------- */
export type Tech = 'titration' | 'colour' | 'mass' | 'gas' | 'ph' | 'cond';
export const TECHS: { id: Tech; name: string; how: string; when: string; snag: string }[] = [
  { id: 'titration', name: 'Titration (sampling and quenching)', how: 'Take samples at intervals, stop the reaction at once (quench: dilute in iced water, or neutralise the catalyst with NaHCO₃), then titrate.', when: 'A reactant or product is an acid, an alkali or iodine.', snag: 'Each point takes a sample and a titration: few points, and the reaction runs on while you take the sample.' },
  { id: 'colour', name: 'Colorimetry', how: 'Shine light of the complementary colour through the mixture; the absorbance is proportional to the concentration of the coloured species (calibrate with known solutions first).', when: 'Exactly one species is coloured: I₂ (brown), Br₂ (orange), MnO₄⁻ (purple).', snag: 'Needs a calibration curve and a filter of the right colour.' },
  { id: 'mass', name: 'Mass change', how: 'Stand the flask on a balance, with a cotton wool plug: the gas escapes, the acid spray does not.', when: 'A dense gas is given off: CO₂ (44 g mol⁻¹).', snag: 'Useless for H₂ (2 g mol⁻¹): too little mass. The gas must not be very soluble.' },
  { id: 'gas', name: 'Volume of gas evolved', how: 'Collect the gas in a gas syringe (or over water in an inverted burette) and read the volume every few seconds.', when: 'Any gas is given off: H₂, O₂, CO₂.', snag: 'Not for gases that dissolve well (NH₃, HCl, SO₂); a gas syringe holds 100 cm³.' },
  { id: 'ph', name: 'pH meter', how: 'Read the pH continuously with a probe and data logger.', when: 'H⁺ or OH⁻ is used up or made.', snag: 'pH is a log scale: convert back to [H⁺] = 10⁻ᵖᴴ first.' },
  { id: 'cond', name: 'Electrical conductivity', how: 'Measure the conductivity as ions are made or used up.', when: 'The number (or kind) of ions changes, as in hydrolysis of a halogenoalkane.', snag: 'Needs a calibration; all the ions contribute.' },
];
export const TECH_Q: { rx: string; best: Tech[]; why: string }[] = [
  { rx: 'CaCO₃(s) + 2HCl(aq) → CaCl₂(aq) + H₂O(l) + CO₂(g)', best: ['mass', 'gas'], why: 'CO₂ is given off and is heavy: follow the mass lost, or collect it in a gas syringe.' },
  { rx: 'Mg(s) + 2HCl(aq) → MgCl₂(aq) + H₂(g)', best: ['gas'], why: 'H₂ is a gas but very light: collect its volume. The mass change would be a few milligrams.' },
  { rx: 'Br₂(aq) + HCOOH(aq) → 2Br⁻(aq) + 2H⁺(aq) + CO₂(g)', best: ['colour', 'gas'], why: 'Bromine is the only coloured species: its orange colour fades, so colorimetry follows [Br₂]. (The CO₂ could be collected too.)' },
  { rx: 'CH₃COCH₃(aq) + I₂(aq) → CH₃COCH₂I(aq) + H⁺(aq) + I⁻(aq)', best: ['colour', 'titration'], why: 'Iodine is coloured (colorimetry), or take samples, quench with NaHCO₃ to remove the acid catalyst, and titrate the I₂ left with thiosulfate.' },
  { rx: 'CH₃COOCH₂CH₃(aq) + OH⁻(aq) → CH₃COO⁻(aq) + CH₃CH₂OH(aq)', best: ['titration', 'ph', 'cond'], why: 'OH⁻ is used up: titrate samples with acid after quenching in iced water, or follow the pH; the conductivity falls as OH⁻ is replaced by slower CH₃COO⁻.' },
  { rx: '(CH₃)₃CBr(l) + H₂O(l) → (CH₃)₃COH(aq) + H⁺(aq) + Br⁻(aq)', best: ['cond', 'ph', 'titration'], why: 'Ions are made from molecules: the conductivity rises, the pH falls, or titrate the acid formed.' },
  { rx: '2H₂O₂(aq) → 2H₂O(l) + O₂(g)', best: ['gas'], why: 'O₂ is given off: collect it in a gas syringe. (Mass loss works but O₂ is light, so the change is small.)' },
];
