/* Star Lab: the life of a star of any starting mass, as a list of stages with durations and a path on the HR diagram.

   This is a teaching model, not a stellar-evolution code. It uses the textbook scaling laws (L ∝ M^3.5 on the main
   sequence, lifetime ∝ M/L, R ∝ M^0.8 or M^0.57) and hand-placed paths for the later stages that follow the real
   shapes: the Hayashi track down to the main sequence, across to the red-giant branch, the horizontal track of a
   planetary-nebula nucleus, and a white dwarf cooling down a line of constant radius. Numbers are rounded to the
   precision the course works in. The mass boundaries are the ones the course uses:
     below 0.08 M☉  brown dwarf: never hot enough for hydrogen fusion
     0.08–0.5 M☉    red dwarf: burns for a trillion years, never a giant, ends as a white dwarf (none has yet)
     0.5–8 M☉        red giant → planetary nebula → white dwarf (core below 1.4 M☉);
                     from about 3 M☉ the star loops back across the instability strip as a Cepheid variable
     8–25 M☉         main sequence → red giant → red supergiant → supernova → neutron star
     above 25 M☉     blue supergiant (its main sequence) → red supergiant → supernova → black hole (core above about 3 M☉)
   Only the very massive stars are blue supergiants: so hot and large on the main sequence that they are supergiants from
   the start. They skip the red-giant stage and swell straight into red supergiants, all within a few million years.
   Every stage carries the facts an exam answer needs (Stage.facts). */

import { radius, TSUN, cepheidP } from './data';

export type Fate = 'browndwarf' | 'reddwarf' | 'sunlike' | 'neutron' | 'blackhole';
export type Visual = 'cloud' | 'protostar' | 'star' | 'bluegiant' | 'cepheid' | 'browndwarf' | 'giant' | 'nebula' | 'whitedwarf' | 'blackdwarf' | 'supernova' | 'neutron' | 'blackhole';

/** A keyframe on the HR diagram: at fraction u of the stage, temperature T (K) and luminosity L (L☉). */
type Key = [u: number, T: number, L: number];

export interface Stage {
  id: string;
  name: string;
  visual: Visual;
  dur: number;        // years
  weight: number;     // share of the timeline bar
  keys: Key[];        // HR path (empty: not on the diagram)
  R?: number;         // fixed radius (R☉) for compact objects, otherwise R comes from L and T
  what: string;       // what is happening, in one or two sentences
  why: string;        // the physics behind it
  facts: string[];    // the points an exam answer needs
  period?: number;    // a Cepheid's pulsation period / days
  future?: boolean;   // no star has reached this stage yet: the universe is too young
  off?: string;       // why it is off the HR diagram
}

export interface Track {
  M: number;
  fate: Fate;
  stages: Stage[];
  life: number;       // years from cloud to the end of fusion (the star's "lifetime")
  msLife: number;     // main-sequence lifetime / years
  remnant: { name: string; M: number; R: number; Rkm?: number };
}

/* ---------- main-sequence scaling ---------- */

export function msLum(M: number) {
  if (M < 0.43) return 0.23 * M ** 2.3;
  if (M < 2) return M ** 4;
  if (M < 20) return 1.4 * M ** 3.5;
  return 1.4 * 20 ** 3.5 * (M / 20) ** 2;
}
export const msRad = (M: number) => (M < 1 ? M ** 0.8 : M ** 0.57);
export const msTemp = (M: number) => TSUN * (msLum(M) / msRad(M) ** 2) ** 0.25;
export function msLife(M: number) {
  if (M <= 10) return 1e10 * M ** -2.5;
  return 1e10 * 10 ** -2.5 * (M / 10) ** -0.9;
}

export const fateOf = (M: number): Fate => (M < 0.08 ? 'browndwarf' : M < 0.5 ? 'reddwarf' : M < 8 ? 'sunlike' : M < 25 ? 'neutron' : 'blackhole');
const M_NAME = 'Sun-like star';
export const FATE_NAME: Record<Fate, string> = {
  browndwarf: 'Failed star', reddwarf: 'Red dwarf', sunlike: M_NAME, neutron: 'Massive star', blackhole: 'Very massive star',
};
export const FATE_END: Record<Fate, string> = {
  browndwarf: 'cold brown dwarf', reddwarf: 'white dwarf', sunlike: 'white dwarf', neutron: 'neutron star', blackhole: 'black hole',
};

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const glerp = (a: number, b: number, u: number) => a * (b / a) ** u;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const fmtM = (M: number) => `${Number(M.toPrecision(2))} M☉`;

/** The Cepheid stage: the star crosses the instability strip and pulsates. */
function cepheidStage(M: number, P: number, keys: Key[], dur: number, kind: 'giant' | 'supergiant'): Stage {
  return {
    id: 'cep', name: 'Cepheid variable', visual: 'cepheid', dur, weight: 1.5, keys, period: P,
    what: `Moving across the HR diagram, the star enters the instability strip and starts to pulsate: its outer layers swell and shrink every ${Number(P.toPrecision(2))} days, and its luminosity rises and falls with them. It is now a Cepheid variable ${kind === 'supergiant' ? 'supergiant' : 'giant'}, like Polaris or Delta Cephei.`,
    why: 'A layer of partly ionised helium acts like a valve: squeezed, it becomes more opaque, traps radiation, heats up and pushes the layers out; expanded, it lets the radiation escape, cools and falls back. More luminous Cepheids are bigger, so they pulse more slowly.',
    facts: [
      'A Cepheid’s luminosity varies with a regular period, from about 1 to 100 days.',
      'Period–luminosity relationship: the longer the period, the more luminous the star.',
      'So it is a standard candle: period → L, measure intensity I, then d = √(L/4πI).',
      'Cepheids lie in the instability strip on the HR diagram, between the main sequence and the giants.',
      `This one: ${fmtM(M)}, period ${Number(P.toPrecision(2))} days.`,
    ],
  };
}

/* ---------- building a track ---------- */

export function track(M: number): Track {
  const fate = fateOf(M);
  const L0 = msLum(M), T0 = msTemp(M);
  const tMS = msLife(M);
  // by the end of the main sequence the core is helium-rich: brighter, slightly larger and cooler
  const L1 = L0 * (M < 1.5 ? 1.8 : 2.2), T1 = T0 * (M < 0.5 ? 1.02 : 0.9);
  const stages: Stage[] = [];

  /* birth: a cold cloud collapses into a protostar, which slides down the Hayashi track to the main sequence */
  const tPre = clamp(5e7 * M ** -2.5, 6e4, 8e8);
  const La = 20 * M ** 1.8, Ta = 3000 + 380 * Math.log2(M + 1);
  stages.push({
    id: 'cloud', name: 'Nebula', visual: 'cloud', dur: M > 8 ? 3e5 : 1e6, weight: 0.9, keys: [],
    what: 'A cold cloud of hydrogen, helium and dust, about 10 K, starts to collapse under its own gravity. It breaks into clumps; the densest clump will become this star.',
    why: 'Gravity wins once the cloud is cold and dense enough that its particles move too slowly to resist. Gravitational potential energy becomes kinetic energy of the particles, so the centre heats up.',
    off: 'too cold to plot: about 10 K',
    facts: [
      'Stars form in nebulae: huge clouds of gas (mostly hydrogen) and dust.',
      'Gravity pulls the densest regions together; a shock wave from a nearby supernova can start the collapse.',
      'As it collapses, gravitational potential energy becomes kinetic energy of the particles, so the temperature rises.',
    ],
  });
  stages.push({
    id: 'protostar', name: 'Protostar', visual: 'protostar', dur: tPre, weight: 1,
    keys: [[0, Ta, La], [0.65, glerp(Ta, T0, 0.3), Math.sqrt(La * L0 * 0.8)], [1, T0, L0]],
    what: `The core heats as it contracts and glows in infrared. Spinning material settles into a disc that feeds the star; jets carry spare angular momentum away. ${M > 8 ? 'A star this massive reaches the main sequence while it is still swallowing its cocoon of gas.' : 'It slides down the HR diagram as it shrinks.'}`,
    why: 'No fusion yet: the energy it radiates comes from gravitational potential energy as it contracts. Fusion starts when the core reaches about 10⁷ K, hot enough for protons to overcome their electrostatic repulsion.',
    facts: [
      'No fusion yet: it shines because gravitational potential energy is converted as it contracts.',
      'Hydrogen fusion needs about 10⁷ K: nuclei must be fast enough to overcome their electrostatic repulsion.',
      'Below about 0.08 M☉ the core never gets that hot, so the object becomes a brown dwarf instead.',
    ],
  });

  if (fate === 'browndwarf') {
    // never ignites: the protostar stage ends as it settles, then it simply cools
    stages[1].keys = [[0, 2900, 0.06], [1, 2500, 0.002]];
    stages[1].what = 'The core heats as it contracts, but there is too little mass to squeeze it to 10⁷ K. Hydrogen fusion never starts.';
    stages.push({
      id: 'bdw', name: 'Brown dwarf', visual: 'browndwarf', dur: 1e10, weight: 3, R: 0.1,
      keys: [[0, 2500, 0.002], [0.3, 1800, 2e-4], [1, 700, 3e-6]],
      what: 'A failed star: too light for hydrogen fusion, so it glows dimly in the infrared from the heat of its contraction and cools for ever. It is about the size of Jupiter.',
      why: 'Without fusion there is nothing to replace the energy it radiates, so its temperature keeps falling. It sits between the largest planets and the smallest stars.',
      facts: [
        'Mass below about 0.08 M☉ (about 80 times Jupiter’s mass).',
        'The core never reaches the 10⁷ K needed for hydrogen fusion.',
        'Faint, cool and red: it radiates mostly infrared and soon drops off the bottom right of the HR diagram.',
      ],
      off: 'too cool and faint to plot',
    });
    return { M, fate, stages, life: stages.reduce((a, x) => a + x.dur, 0), msLife: 0, remnant: { name: 'Brown dwarf', M, R: 0.1 } };
  }

  /* the main sequence; for a very massive star that is its blue-supergiant phase */
  if (fate === 'blackhole') stages.push({
    id: 'ms', name: 'Blue supergiant', visual: 'bluegiant', dur: tMS, weight: 3,
    keys: [[0, T0, L0], [1, T1, L1]],
    what: `A star this massive is a blue supergiant from the moment fusion starts: its main sequence is spent hot, blue-white and huge, like Rigel, ${L1 > 1e5 ? 'hundreds of thousands' : 'tens of thousands'} of times as luminous as the Sun. Fierce winds blow its outer layers away.`,
    why: `It burns hydrogen so furiously (L ∝ M^3.5) that, for all its fuel, it lasts only about ${Number((tMS / 1e6).toPrecision(2))} million years: a brilliant, short life, over while the Sun would barely have formed. Lifetime ∝ M/L, so the bigger the star, the shorter its life.`,
    facts: [
      'Only very massive stars (above about 25 M☉) are blue supergiants: for them it is the main-sequence stage, and hydrogen still fuses to helium in the core.',
      'Very hot (about 20 000–50 000 K) and very luminous (L = σ4πr²T⁴ with r and T both large): top left of the HR diagram. Examples: Rigel, Deneb.',
      'The shortest lives of all: a few million years, against about 10 billion for the Sun, because L rises much faster than M.',
      'It never becomes a red giant: when the core’s hydrogen runs out it swells straight into a red supergiant.',
    ],
  });
  else stages.push({
    id: 'ms', name: 'Main sequence', visual: 'star', dur: tMS, weight: 3,
    keys: [[0, T0, L0], [1, T1, L1]],
    what: fate === 'reddwarf'
      ? 'Hydrogen fuses to helium in the core. The whole star is convective, so it slowly uses nearly all its hydrogen, not just the core’s: it lasts far longer than the universe has existed so far.'
      : `Hydrogen fuses to helium in the core. The star is stable: the outward pressure from the hot core balances the inward pull of gravity. It spends about 90% of its life here.`,
    why: `More massive stars are hotter and much more luminous (L ∝ M^3.5 roughly), so they burn through their fuel far faster: lifetime ∝ M/L. At ${fmtM(M)} the main sequence lasts about ${Number((tMS / (tMS >= 1e9 ? 1e9 : 1e6)).toPrecision(2))} ${tMS >= 1e9 ? 'billion' : 'million'} years.`,
    facts: [
      'Hydrogen nuclei fuse to make helium. The products have a greater binding energy per nucleon, so mass is lost and energy released: ΔE = c²Δm.',
      'The star is in equilibrium: outward pressure (gas and radiation) balances the inward pull of gravity.',
      'Where a star sits on the main sequence depends on its mass: more massive means hotter, more luminous and shorter-lived.',
      'Stars spend about 90% of their lives on the main sequence.',
    ],
  });

  let remnant: Track['remnant'];
  const life = () => stages.reduce((s, x) => s + (x.visual === 'whitedwarf' || x.visual === 'blackdwarf' || x.visual === 'neutron' || x.visual === 'blackhole' ? 0 : x.dur), 0);

  if (fate === 'reddwarf') {
    const Mwd = M * 0.9, Rwd = 0.0126 * (Mwd / 0.6) ** (-1 / 3);
    const Tend = T1 * 1.5;
    stages.push({
      id: 'wd', name: 'White dwarf', visual: 'whitedwarf', dur: 1e10, weight: 2, R: Rwd, future: true,
      keys: [[0, Math.max(Tend, 9000), Rwd * Rwd * (Math.max(Tend, 9000) / TSUN) ** 4], [1, 4000, Rwd * Rwd * (4000 / TSUN) ** 4]],
      what: 'With its hydrogen gone, the star contracts into a helium white dwarf and cools for ever. No red dwarf has got this far: the universe is only 13.8 billion years old.',
      why: 'A red dwarf never gets hot enough in the core to fuse helium, so it never becomes a red giant. What is left is supported by electron degeneracy pressure, not by heat.',
      facts: [
        'Red dwarfs (0.08–0.5 M☉) are the commonest stars, e.g. Proxima Centauri.',
        'They never become red giants: the core never gets hot enough to fuse helium.',
        'Their main-sequence lifetimes are longer than the present age of the universe.',
      ],
    });
    remnant = { name: 'Helium white dwarf', M: Mwd, R: Rwd };
  } else if (fate === 'sunlike') {
    const Ltip = 2500 * M ** 1.2, Ttip = 3100 + 60 * M;
    const LHB = 50 * M ** 1.4;
    const Mwd = Math.min(1.35, 0.48 + 0.1 * M), Rwd = 0.012 * (Mwd / 0.6) ** (-1 / 3);
    const GIANT_FACTS = [
      'The core runs out of hydrogen, contracts and heats up.',
      'Hydrogen now fuses in a shell around the helium core; the outer layers expand and cool.',
      'Helium then fuses in the core to make carbon and oxygen.',
      'Cool (red) yet very luminous because its surface area is huge: top right of the HR diagram.',
    ];
    if (M < 3) {
      stages.push({
        id: 'giant', name: 'Red giant', visual: 'giant', dur: tMS * 0.12, weight: 2.2,
        keys: [[0, T1, L1], [0.35, 4900, L1 * 3], [0.72, Ttip, Ltip], [0.8, 4800, LHB], [0.92, 4300, LHB * 3], [1, Ttip - 200, Ltip * 1.6]],
        what: `The core runs out of hydrogen and contracts; hydrogen now fuses in a shell around it. The outer layers swell to ${M < 2 ? 'about 100–200' : 'a few hundred'} times the Sun’s radius and cool to red. ${M < 2 ? 'Then the core ignites helium in a sudden helium flash, ' : 'Then the core starts fusing helium, '}making carbon and oxygen.`,
        why: 'The surface is cooler, so each square metre emits less (P ∝ T⁴), but the area is so huge that the luminosity is hundreds or thousands of times larger: L = σ4πr²T⁴. That is why giants sit at the top right of the HR diagram.',
        facts: GIANT_FACTS,
      });
    } else {
      // from about 3 M☉, helium burning carries the star back across the instability strip: a Cepheid
      const Lcep = 130 * M * M, Lrgb = Lcep * 0.55, P = cepheidP(Lcep);
      stages.push({
        id: 'giant', name: 'Red giant', visual: 'giant', dur: tMS * 0.03, weight: 1.6,
        keys: [[0, T1, L1], [0.4, 5200, L1 * 2.5], [1, 4100, Lrgb]],
        what: 'The core runs out of hydrogen and contracts; hydrogen fuses in a shell around it and the outer layers swell and cool into a red giant.',
        why: 'The surface is cooler, so each square metre emits less (P ∝ T⁴), but the area is so huge that the luminosity is far larger: L = σ4πr²T⁴.',
        facts: GIANT_FACTS,
      });
      stages.push(cepheidStage(M, P, [[0, 4100, Lrgb], [0.3, 6000, Lcep], [0.7, 6100, Lcep * 1.05], [1, 4300, Lcep]], tMS * 0.08, 'giant'));
      stages.push({
        id: 'giant2', name: 'Red giant again', visual: 'giant', dur: tMS * 0.012, weight: 1.2,
        keys: [[0, 4300, Lcep], [1, Ttip - 200, Ltip * 1.6]],
        what: 'With the helium in its core used up, the star swells into a red giant a second time, larger and more luminous than before, with helium and hydrogen fusing in shells round a carbon–oxygen core.',
        why: 'Its core will end below 1.4 M☉, too light to fuse carbon, so this star’s fusion ends here.',
        facts: ['Helium and hydrogen fuse in shells round an inert carbon–oxygen core.', 'Strong winds strip away its outer layers, ready to form a planetary nebula.'],
      });
    }
    stages.push({
      id: 'pn', name: 'Planetary nebula', visual: 'nebula', dur: 3e4, weight: 1.2,
      keys: [[0, Ttip - 200, Ltip * 1.6], [0.6, 100000, Ltip * 1.2], [1, 120000, 300]],
      what: 'The outer layers drift away as a glowing shell of gas, lit by ultraviolet from the exposed hot core. The core crosses the HR diagram to the left: same luminosity, much hotter, much smaller.',
      why: 'Nothing to do with planets: early telescopes showed these round shells as planet-like discs. The shell returns carbon, nitrogen and oxygen made in the star to space, for the next generation of stars.',
      facts: [
        'The outer layers are ejected as a shell of gas; the hot core is left behind.',
        'The core is hot but small: it moves left across the HR diagram, then down.',
        'The ejected gas carries elements made in the star back into space.',
      ],
    });
    stages.push({
      id: 'wd', name: 'White dwarf', visual: 'whitedwarf', dur: 1e10, weight: 2, R: Rwd,
      keys: [[0, 120000, Rwd * Rwd * (120000 / TSUN) ** 4], [1, 4000, Rwd * Rwd * (4000 / TSUN) ** 4]],
      what: `What is left is the core: ${Number(Mwd.toPrecision(2))} M☉ packed into a ball about the size of the Earth. No fusion happens; it simply cools, sliding down the HR diagram along a line of constant radius.`,
      why: 'Electron degeneracy pressure holds it up against gravity. That works only for a core below 1.4 M☉ (the Chandrasekhar limit). A teaspoon of it would have a mass of a few tonnes.',
      facts: [
        'No fusion: it glows only because it is hot, and slowly cools.',
        'Held up by electron degeneracy pressure; possible only below 1.4 M☉ (the Chandrasekhar limit).',
        'Bottom left of the HR diagram: hot but tiny, so faint. Example: Sirius B.',
        'In a binary it can pull gas from its companion; reaching 1.4 M☉ it explodes as a type Ia supernova.',
      ],
    });
    stages.push({
      id: 'bd', name: 'Black dwarf', visual: 'blackdwarf', dur: 1e15, weight: 0.7, R: Rwd, keys: [], future: true,
      what: 'In theory a white dwarf eventually cools until it no longer glows: a cold, dark black dwarf. It takes far longer than the age of the universe, so none exist yet.',
      why: 'It has no fuel and only loses energy by radiating, so its temperature falls for ever. The cooler it gets, the more slowly it radiates (P ∝ T⁴), so the last stage takes the longest.',
      facts: ['A cold, dark remnant: no light, no fusion.', 'Hypothetical: the universe is too young for any to exist yet.'],
      off: 'too faint and cold to plot',
    });
    remnant = { name: 'White dwarf', M: Mwd, R: Rwd };
  } else {
    // massive: red giant then red supergiant; very massive: straight from blue supergiant (its main sequence) to red supergiant
    const Lsg = L1 * 1.3;
    const bh = fate === 'blackhole';
    if (!bh) stages.push({
      id: 'rg', name: 'Red giant', visual: 'giant', dur: tMS * 0.02, weight: 1.2,
      keys: [[0, T1, L1], [0.2, 5200, Lsg * 0.95], [1, 4300, Lsg]],
      what: 'The core runs out of hydrogen. Just like a Sun-like star, it swells and cools into a red giant: hydrogen fuses in a shell around a contracting core, which heats up until helium fusion starts. But a star this massive does not stop there.',
      why: 'The swelling is the same process as in smaller stars; the difference is that the core of a massive star gets hot enough to go on fusing heavier and heavier elements, so it keeps growing into a red supergiant.',
      facts: [
        'A massive star (about 8–25 M☉) leaves the main sequence as a red giant, then grows into a red supergiant.',
        'Hydrogen fuses in a shell; the core contracts and heats until helium fusion starts.',
        'Only the very massive stars skip this stage: they start as blue supergiants and swell straight into red supergiants.',
      ],
    });
    stages.push({
      id: 'rsg', name: 'Red supergiant', visual: 'giant', dur: tMS * 0.08, weight: 2,
      keys: bh ? [[0, T1, L1], [0.25, 4100, Lsg * 1.02], [0.6, 3550, Lsg * 1.05], [1, 3450, Lsg * 1.1]] : [[0, 4300, Lsg], [0.5, 3550, Lsg * 1.05], [1, 3450, Lsg * 1.1]],
      what: `${bh ? 'Its core’s hydrogen gone, the blue supergiant swells and cools straight into a red supergiant (no red-giant stage)' : 'The red giant keeps swelling into a red supergiant'} to hundreds of times the Sun’s radius, like Betelgeuse. ${bh ? 'Very massive stars blow so much of their envelope away that some never get this red (Wolf–Rayet stars). ' : ''}The core fuses heavier and heavier elements: helium → carbon → neon → oxygen → silicon → iron, in shells like an onion.`,
      why: 'Each new fuel lasts a shorter time than the last: helium for about a million years, silicon for about a day. Iron is the end: fusing iron takes in energy instead of releasing it, so the core can no longer support itself.',
      facts: [
        bh ? 'A very massive star goes from blue supergiant straight to red supergiant: it is never a red giant.' : 'A massive star becomes a red supergiant after its red-giant stage, as heavier elements start to fuse.',
        'The largest stars of all: hundreds to about 1000 R☉ (Betelgeuse, Antares). Top right of the HR diagram.',
        'Fusion goes on in shells: H → He → C → Ne → O → Si → Fe, the heaviest at the centre.',
        'Iron has the highest binding energy per nucleon, so fusing it releases no energy: fusion stops and the core collapses.',
      ],
    });
    stages.push({
      id: 'sn', name: 'Supernova', visual: 'supernova', dur: 1, weight: 1.3,
      keys: [[0, 3450, Lsg * 1.1], [0.12, 20000, 1e9], [0.5, 9000, 2e8], [1, 6000, 1e7]],
      what: `The iron core collapses in under a second. The infalling layers rebound off the incredibly dense core and the star explodes as a type II (core-collapse) supernova: for a few weeks it can outshine its whole galaxy (around 10⁹ L☉), then it fades over months.`,
      why: 'The collapse releases a vast amount of gravitational potential energy. The explosion makes elements heavier than iron and scatters them into space: the iron in your blood and the gold in jewellery were made in stars.',
      facts: [
        'Type II (core-collapse) supernova: the end of a massive star.',
        'For a few weeks as luminous as a whole galaxy, about 10⁹ L☉.',
        'Makes the elements heavier than iron and scatters them into space.',
        'Not a standard candle: type II supernovae vary. Type Ia (a white dwarf in a binary reaching 1.4 M☉) is.',
      ],
    });
    if (!bh) {
      const Mns = clamp(1.3 + 0.03 * (M - 8), 1.3, 2.0);
      stages.push({
        id: 'ns', name: 'Neutron star', visual: 'neutron', dur: 1e7, weight: 2, R: 1.6e-5, keys: [],
        what: `The core survives as a neutron star: ${Number(Mns.toPrecision(2))} M☉ in a sphere about 20 km across, spinning many times a second. Its beams of radiation sweep past us like a lighthouse: a pulsar, like the one in the Crab Nebula.`,
        why: 'Gravity crushes electrons into protons, making neutrons; neutron degeneracy pressure stops the collapse. This works for cores between 1.4 and about 3 M☉. A teaspoon would have a mass of about a billion tonnes.',
        facts: [
          'Left when the collapsing core is between 1.4 and about 3 M☉.',
          'Made almost entirely of neutrons, held up by neutron degeneracy pressure; about 20 km across, density about 10¹⁷ kg m⁻³.',
          'A rapidly spinning neutron star sweeping beams past us is a pulsar.',
        ],
        off: 'a surface near 10⁶ K, far too hot for the diagram',
      });
      remnant = { name: 'Neutron star', M: Mns, R: 1.6e-5, Rkm: 11 };
    } else {
      const Mbh = clamp(0.25 * M, 5, 40);
      const rs = 2.95 * Mbh;
      stages.push({
        id: 'bh', name: 'Black hole', visual: 'blackhole', dur: 1e10, weight: 2, R: (rs * 1e3) / 6.96e8, keys: [],
        what: `The core is above about 3 M☉, so nothing can stop its collapse: it becomes a black hole of about ${Math.round(Mbh)} M☉. Gas falling towards it forms a hot, spinning accretion disc that glows in X-rays, as in Cygnus X-1.`,
        why: `Inside a radius of about ${Math.round(rs)} km (the event horizon) the escape velocity is greater than the speed of light, so nothing, not even light, gets out. We see black holes by their effect on matter around them.`,
        facts: [
          'Left when the collapsing core is above about 3 M☉: no pressure can stop the collapse.',
          'At the event horizon the escape velocity equals the speed of light.',
          'Found through their companions: gas pulled from a star in a binary heats up in an accretion disc and emits X-rays (Cygnus X-1).',
        ],
        off: 'it has no surface to glow',
      });
      remnant = { name: 'Black hole', M: Mbh, R: (rs * 1e3) / 6.96e8, Rkm: rs };
    }
  }

  return { M, fate, stages, life: life(), msLife: tMS, remnant: remnant! };
}

/* ---------- reading a track at a point on the timeline ---------- */

export interface Now {
  i: number;            // stage index
  stage: Stage;
  u: number;            // 0–1 through the stage
  age: number;          // years since the cloud began to collapse
  T: number;            // surface temperature / K (NaN when there is no surface to speak of)
  L: number;            // luminosity / L☉ (NaN likewise)
  R: number;            // radius / R☉
  onHR: boolean;
}

export const weights = (t: Track) => t.stages.reduce((s, x) => s + x.weight, 0);

/** Where each stage starts and ends on the timeline bar (0–1). */
export function bounds(t: Track): [number, number][] {
  const W = weights(t);
  let a = 0;
  return t.stages.map((s) => { const b = a + s.weight / W; const r: [number, number] = [a, b]; a = b; return r; });
}

function onKeys(keys: Key[], u: number): [number, number] {
  if (keys.length === 1) return [keys[0][1], keys[0][2]];
  for (let k = 1; k < keys.length; k++) {
    if (u <= keys[k][0] || k === keys.length - 1) {
      const [u0, T0, L0] = keys[k - 1], [u1, T1, L1] = keys[k];
      const f = clamp((u - u0) / (u1 - u0 || 1), 0, 1);
      // smoothstep keeps the motion along the path from looking mechanical
      const s = f * f * (3 - 2 * f);
      return [glerp(T0, T1, s), glerp(L0, L1, s)];
    }
  }
  return [keys[0][1], keys[0][2]];
}

/** The star at position x (0–1) along the timeline bar. */
export function at(t: Track, x: number): Now {
  const b = bounds(t);
  let i = b.findIndex(([, hi]) => x <= hi + 1e-9);
  if (i < 0) i = t.stages.length - 1;
  const stage = t.stages[i];
  const u = clamp((x - b[i][0]) / (b[i][1] - b[i][0]), 0, 1);
  const age = t.stages.slice(0, i).reduce((s, x) => s + x.dur, 0) + stage.dur * u;
  let T = NaN, L = NaN, R: number;
  if (stage.keys.length) [T, L] = onKeys(stage.keys, u);
  if (stage.R !== undefined) R = stage.R;
  else if (stage.visual === 'cloud') R = lerp(4e7, 3e5, u);           // a collapsing clump, in R☉ (≈ 1 pc to 0.01 pc)
  else R = radius(L, T);
  if (stage.visual === 'whitedwarf' && stage.keys.length) L = R * R * (T / TSUN) ** 4;
  if (stage.visual === 'blackdwarf') { T = lerp(4000, 5, u); L = R * R * (T / TSUN) ** 4; }
  if (stage.visual === 'neutron') { T = glerp(1e6, 3e5, u); L = R * R * (T / TSUN) ** 4; }
  if (stage.visual === 'cloud') T = lerp(10, 30, u);
  const onHR = stage.keys.length > 0 && T >= 2400 && T <= 60000 && L >= 1e-5 && L <= 1e7;
  return { i, stage, u, age, T, L, R, onHR };
}

/** The whole path on the HR diagram, sampled finely, split wherever the star leaves the diagram. */
export function hrPath(t: Track, n = 600): [number, number][][] {
  const runs: [number, number][][] = [];
  let cur: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const p = at(t, k / n);
    if (p.onHR) cur.push([p.T, p.L]);
    else if (cur.length) { runs.push(cur); cur = []; }
  }
  if (cur.length) runs.push(cur);
  return runs;
}

/** Presets on the mass slider: one for each kind of ending, plus the Sun. */
export const PRESETS: { M: number; label: string; like: string }[] = [
  { M: 0.05, label: '0.05', like: 'a brown dwarf' },
  { M: 0.2, label: '0.2', like: 'like Proxima Centauri' },
  { M: 1, label: '1', like: 'the Sun' },
  { M: 5, label: '5', like: 'becomes a Cepheid, like Delta Cephei' },
  { M: 15, label: '15', like: 'like Betelgeuse' },
  { M: 40, label: '40', like: 'like the progenitor of Cygnus X-1' },
];

/** Mass slider position (0–1) ↔ mass, on a log scale from 0.1 to 50 M☉. */
export const MMIN = 0.05, MMAX = 50;
export const massAt = (s: number) => Number((MMIN * (MMAX / MMIN) ** s).toPrecision(2));
export const posOf = (M: number) => Math.log(M / MMIN) / Math.log(MMAX / MMIN);
