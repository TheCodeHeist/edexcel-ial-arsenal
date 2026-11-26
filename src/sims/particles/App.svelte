<script lang="ts">
  /* Particle Lab. Six modes with hash routes: #accel (electron gun, linac, cyclotron, synchrotron in 3D), #detect
     (cloud and bubble chambers, a collider detector), #nucleus (α-particle scattering), #table (every particle),
     #reactions (conservation laws, E = mc²), #matter (annihilation and pair production) and #practice. Each tab owns its prefs type and defaults and reports its
     own status-line numbers through `stats`. */
  import { onMount, tick } from 'svelte';
  import { persisted } from '../../lib/persist.svelte';
  import { glint, fadeIn } from '../../lib/motion';
  import SimHeader from '../../components/ui/SimHeader.svelte';
  import StatusLine from '../../components/ui/StatusLine.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import Accelerators, { ACCEL, type AccelPrefs } from './Accelerators.svelte';
  import Detectors, { DET, type DetPrefs } from './Detectors.svelte';
  import Scatter, { SCAT, type ScatPrefs } from './Scatter.svelte';
  import Zoo, { ZOO, type ZooPrefs } from './Zoo.svelte';
  import Rules, { RULES, type RulePrefs } from './Rules.svelte';
  import Matter, { MATTER, type MatterPrefs } from './Matter.svelte';
  import Practice, { type PScore } from './Practice.svelte';
  import { TOPICS, type Topic } from './practice';
  import { provideKernelTools } from '../../lib/kernel/live';
  import { REST } from './matter';
  import { sqrtS, channels } from './collide';
  import {
    matchParticle, matchQuark, matchReactionPreset, matchMode, matchAccelKind, matchCloudSource,
    matchClassicEvent, matchShot, matchFoil, matchMatterWho, COLLIDE_BEAMS, REACTION_PALETTE,
    summarizeAccel, summarizeCollision, summarizeDetector, summarizeScatter, summarizeZoo, summarizeRules, summarizeMatter,
    type ParticleMode,
  } from './kernel';

  type Mode = 'accel' | 'detect' | 'nucleus' | 'table' | 'reactions' | 'matter' | 'practice';
  type Stats = [string, string | number][];

  const accel = persisted<AccelPrefs>('particles-accel', ACCEL);
  const det = persisted<DetPrefs>('particles-detect', DET);
  const scat = persisted<ScatPrefs>('particles-nucleus', SCAT);
  const zoo = persisted<ZooPrefs>('particles-table', ZOO);
  const rules = persisted<RulePrefs>('particles-reactions', RULES);
  const matter = persisted<MatterPrefs>('particles-matter', MATTER);
  const score = persisted<PScore>('particles-score', { right: 0, total: 0, streak: 0, best: 0 });
  const topic = persisted<{ t: Topic | 'all' }>('particles-topic', { t: 'all' });
  score.streak = 0;

  let mode = $state<Mode>('accel');
  const views: Record<Mode, HTMLElement | undefined> = $state({ accel: undefined, detect: undefined, nucleus: undefined, table: undefined, reactions: undefined, matter: undefined, practice: undefined });
  let accelRef = $state<Accelerators>(), detRef = $state<Detectors>(), scatRef = $state<Scatter>();
  let zooRef = $state<Zoo>(), rulesRef = $state<Rules>(), matterRef = $state<Matter>();
  const TABS = [['accel', 'Accelerators', 'Accel'], ['detect', 'Detectors', 'Detect'], ['nucleus', 'Nucleus', 'Atom'], ['table', 'Particle table', 'Table'], ['reactions', 'Reactions', 'React'], ['matter', 'Annihilation', 'Pairs'], ['practice', 'Practice', 'Quiz']] as const;
  const INFO: Record<Mode, [string, string]> = {
    accel: ['Accelerators', 'Pick a machine, set the p.d. and the field, and watch the particles gain energy. Drag the view to turn it.'],
    detect: ['Detectors', 'Watch tracks form, then click one to identify it and measure its radius.'],
    nucleus: ['Nucleus', 'Fire α particles at gold foil and count where they go.'],
    table: ['Particle table', 'Pick any particle for its properties; flip to its antiparticle; build hadrons from quarks.'],
    reactions: ['Reactions', 'Check a reaction against the conservation laws, then work out the energy.'],
    matter: ['Annihilation', 'Annihilate a particle with its antiparticle, or turn a γ-ray into a pair, and follow the energy.'],
    practice: ['Practice', 'Answer, then check the working.'],
  };
  let stats = $state<Record<Mode, Stats>>({ accel: [], detect: [], nucleus: [], table: [], reactions: [], matter: [], practice: [] });
  const shown = $derived<Stats>(mode === 'practice' ? [['Correct', `${score.right}/${score.total}`], ['Streak', score.streak], ['Best', score.best]] : stats[mode]);

  function setMode(m: Mode) {
    const prev = mode;
    mode = m;
    if (prev !== m) tick().then(() => fadeIn(views[m]?.firstElementChild as HTMLElement));
  }
  const MODES = TABS.map((t) => t[0]) as readonly Mode[];
  function fromHash() {
    const h = location.hash.slice(1) as Mode;
    setMode(MODES.includes(h) ? h : 'accel');
  }
  fromHash();
  $effect(() => { const h = '#' + mode; if (location.hash !== h) history.replaceState(null, '', h); });

  /* ---------- Kernel live tools ---------- */
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  async function openMode(m: ParticleMode) {
    setMode(m);
    await tick();
  }
  function currentState(): string {
    const head = `Tab: ${INFO[mode][0]} (#${mode}).`;
    switch (mode) {
      case 'accel': return head + '\n' + summarizeAccel(accel);
      case 'detect': {
        const ds = detRef?.getState() ?? { result: null, fired: 0 };
        return head + '\n' + summarizeDetector(det, ds.result, ds.fired);
      }
      case 'nucleus': {
        const ss = scatRef?.getState() ?? { fired: 0, over90: 0, back: 0, atObs: 0, atPred: NaN };
        return head + '\n' + summarizeScatter(scat, ss);
      }
      case 'table': return head + '\n' + summarizeZoo(zoo);
      case 'reactions': return head + '\n' + summarizeRules(rules);
      case 'matter': return head + '\n' + summarizeMatter(matter, matterRef?.getEvent() ?? null);
      default: return `${head}\nPractice topic: ${topic.t}. Score: ${score.right}/${score.total}, streak ${score.streak} (best ${score.best}).`;
    }
  }

  const KERNEL_ABOUT = 'Particle Lab (Edexcel IAL Physics Unit 4: Nuclear & Particle Physics) is open, with tabs for Accelerators (3D gun/linac/cyclotron/LHC), Detectors (cloud chamber, bubble chamber collision lab & classic events, collider detector), Nucleus (α-scattering), Particle table (Standard Model, hadrons & quark builder), Reactions (conservation laws & ΔE = c²Δm), Annihilation & pair production, and Practice. '
    + 'Use particles_ tools to collide beams, check decays and reactions, open particles in the zoo or build hadrons from quarks, drive accelerators, run α-scattering, or trigger annihilation and pair production on screen.';

  const kernelTools = () => provideKernelTools('particles', KERNEL_ABOUT, [
    {
      name: 'particles_state',
      description: 'Read what is currently on screen in Particle Lab: active tab, parameters, live results and available tabs.',
      parameters: { type: 'object', properties: {} },
      run: () => currentState() + '\nAvailable tabs: accel, detect, nucleus, table, reactions, matter, practice.',
    },
    {
      name: 'particles_mode',
      description: 'Switch Particle Lab to a tab (accel, detect, nucleus, table, reactions, matter, practice).',
      parameters: { type: 'object', properties: {
        tab: { type: 'string', description: 'Tab name: accel, detect, nucleus, table, reactions, matter, or practice.' },
        topic: { type: 'string', enum: ['all', 'accel', 'detect', 'nucleus', 'table', 'rules', 'matter'], description: 'Only for practice: filter questions by topic.' },
      }, required: ['tab'] },
      run: async (a) => {
        const m = matchMode(String(a.tab ?? ''));
        if (m === 'practice' && a.topic !== undefined) {
          const valid = TOPICS.map((x) => x[0]) as string[];
          const tp = String(a.topic).toLowerCase();
          if (!valid.includes(tp)) throw new Error(`topic must be one of: ${valid.join(', ')}.`);
          topic.t = tp as Topic | 'all';
        }
        await openMode(m);
        return currentState();
      },
    },
    {
      name: 'particles_collide',
      description: 'Fire a particle collision in the bubble-chamber Collision Lab on screen. Supports fixed target (proton in liquid H₂, deuteron in D₂) or head-on two-beam collisions (e.g. proton + antiproton at 2 GeV). Returns √s, reaction equation, decays, conservation checks and open channels.',
      parameters: { type: 'object', properties: {
        beam: { type: 'string', description: 'Incoming beam particle, e.g. "p", "anti-p", "pi-", "K-", "e-", "e+", "gamma", "mu-", "n".' },
        target: { type: 'string', description: 'Target: "p" (proton at rest), "d" (deuteron at rest), or any beam particle name (e.g. "anti-p", "e+", "p") for a head-on collision.' },
        head_on: { type: 'boolean', description: 'Force head-on two-beam collision even when target is "p".' },
        momentum_mev: { type: 'number', description: 'Beam momentum in MeV/c (30–30000; or photon energy in MeV).' },
        momentum_gev: { type: 'number', description: 'Beam momentum in GeV/c (0.03–30), alternative to momentum_mev.' },
        momentum2_mev: { type: 'number', description: 'Second beam momentum in MeV/c (head-on only; defaults to beam momentum).' },
        momentum2_gev: { type: 'number', description: 'Second beam momentum in GeV/c (head-on only; defaults to beam momentum).' },
        outcome: { type: 'string', description: 'Optional: "auto" (weighted random, default) or part of an open channel label (e.g. "elastic", "K0", "pi+ + pi-").' },
        heavy_liquid: { type: 'boolean', description: 'Use heavy liquid (freon) instead of liquid hydrogen.' },
        show_neutral: { type: 'boolean', description: 'Draw neutral particles as dashed lines.' },
      } },
      run: async (a) => {
        await openMode('detect');
        det.det = 'bubble';
        det.bmode = 'collide';
        if (a.beam !== undefined) det.beam = matchParticle(String(a.beam), COLLIDE_BEAMS).id;
        const p1 = a.momentum_mev !== undefined ? Number(a.momentum_mev) : a.momentum_gev !== undefined ? Number(a.momentum_gev) * 1000 : undefined;
        if (p1 !== undefined) {
          if (!Number.isFinite(p1) || p1 < 30 || p1 > 30000) throw new Error('Beam momentum must be between 30 and 30000 MeV/c (0.03–30 GeV/c).');
          det.pb = Math.round(p1);
        }
        const p2 = a.momentum2_mev !== undefined ? Number(a.momentum2_mev) : a.momentum2_gev !== undefined ? Number(a.momentum2_gev) * 1000 : undefined;
        if (a.target !== undefined) {
          const raw = String(a.target).trim().toLowerCase();
          if (raw === 'd' || raw === 'deuteron' || raw === 'd2') {
            det.target = 'd';
          } else if ((raw === 'p' || raw === 'proton' || raw === 'h2' || raw === 'hydrogen') && !a.head_on && p2 === undefined) {
            det.target = 'p';
          } else {
            const b2 = matchParticle(String(a.target), COLLIDE_BEAMS).id;
            det.target = 'beam';
            det.beam2 = b2;
            det.pb2 = p2 !== undefined ? Math.round(p2) : det.pb;
          }
        } else if (a.head_on || p2 !== undefined) {
          det.target = 'beam';
          if (p2 !== undefined) det.pb2 = Math.round(p2);
        }
        if (p2 !== undefined && (!Number.isFinite(p2) || p2 < 30 || p2 > 30000)) {
          throw new Error('Second beam momentum must be between 30 and 30000 MeV/c (0.03–30 GeV/c).');
        }
        if (a.heavy_liquid !== undefined) det.heavy = Boolean(a.heavy_liquid);
        if (a.show_neutral !== undefined) det.neutral = Boolean(a.show_neutral);
        // resolve outcome channel
        const headOn = det.target === 'beam';
        const struck = headOn ? det.beam2 : 'p';
        const W = sqrtS(det.beam, det.pb, struck, det.pb2, headOn);
        const chs = channels(det.beam, struck, W, !headOn);
        if (a.outcome !== undefined && String(a.outcome).trim().toLowerCase() !== 'auto') {
          const q = String(a.outcome).trim().toLowerCase();
          const hit = chs.open.find((c) => c.key.toLowerCase() === q || c.label.toLowerCase().includes(q) || c.kind === q);
          if (!hit) throw new Error(`No open channel matches "${a.outcome}" at √s = ${(W / 1000).toPrecision(3)} GeV. Open channels: ${chs.open.slice(0, 8).map((c) => c.label).join('; ') || 'none'}.`);
          det.chan = hit.key;
        } else {
          det.chan = 'auto';
        }
        await tick();
        const res = detRef?.fireEvent() ?? null;
        await wait(120);
        return summarizeCollision(det, res);
      },
    },
    {
      name: 'particles_reaction',
      description: 'Open the Reactions tab and check a particle decay or interaction against conservation laws (Q, B, L, lepton families, S, energy, momentum) and ΔE = c²Δm. Accepts a named preset (e.g. "neutron decay", "beta-", "pion decay", "pair production", "proton decay") or custom before/after particle lists, plus an optional unit conversion.',
      parameters: { type: 'object', properties: {
        preset: { type: 'string', description: 'Classic reaction preset name or id, e.g. "beta-" ("neutron decay"), "beta+", "pi+", "mu", "pi0", "lambda", "k+", "annih", "pair", "pbar", "assoc", "omega", "x-n", "x-pdecay".' },
        before: { type: 'array', items: { type: 'string' }, description: 'Custom left-hand side particles (1–4), e.g. ["n"] or ["pi-", "p"].' },
        after: { type: 'array', items: { type: 'string' }, description: 'Custom right-hand side particles (1–4), e.g. ["p", "e-", "anti-nue"].' },
        convert_value: { type: 'number', description: 'Optional positive value to enter into the mass–energy unit converter.' },
        convert_unit: { type: 'string', enum: ['eV', 'keV', 'MeV', 'GeV', 'TeV', 'J', 'MeVc2', 'GeVc2', 'u', 'kg'], description: 'Unit for convert_value.' },
      } },
      run: async (a) => {
        await openMode('reactions');
        if (a.preset !== undefined) {
          const p = matchReactionPreset(String(a.preset));
          rules.preset = p.id;
          rules.lhs = [...p.lhs];
          rules.rhs = [...p.rhs];
        } else if (a.before !== undefined || a.after !== undefined) {
          if (!Array.isArray(a.before) || !Array.isArray(a.after)) throw new Error('Provide both "before" and "after" arrays of particle names (1–4 each).');
          if (a.before.length < 1 || a.before.length > 4 || a.after.length < 1 || a.after.length > 4) throw new Error('Each side of a reaction must have 1 to 4 particles.');
          rules.preset = '';
          rules.lhs = a.before.map((x) => matchParticle(String(x), REACTION_PALETTE).id);
          rules.rhs = a.after.map((x) => matchParticle(String(x), REACTION_PALETTE).id);
        }
        if (a.convert_value !== undefined) {
          const v = Number(a.convert_value);
          if (!Number.isFinite(v) || v <= 0) throw new Error('convert_value must be a positive number.');
          rules.conv = v;
        }
        if (a.convert_unit !== undefined) {
          const valid = ['eV', 'keV', 'MeV', 'GeV', 'TeV', 'J', 'MeVc2', 'GeVc2', 'u', 'kg'];
          const u = String(a.convert_unit);
          if (!valid.includes(u)) throw new Error(`convert_unit must be one of: ${valid.join(', ')}.`);
          rules.unit = u;
        }
        rulesRef?.syncConv();
        await tick();
        return summarizeRules(rules);
      },
    },
    {
      name: 'particles_zoo',
      description: 'Open the Particle Table (particle zoo) at any fundamental particle, baryon, meson or antiparticle (e.g. "kaon", "proton", "muon", "positron", "Higgs", "strange quark"), flip to antiparticles, adjust time-dilation speed, or build a hadron in the quark builder.',
      parameters: { type: 'object', properties: {
        particle: { type: 'string', description: 'Particle name, symbol or id to open, e.g. "kaon", "K-", "K0", "proton", "antiproton", "pion", "muon", "top quark", "Higgs", "Omega-".' },
        antiparticles: { type: 'boolean', description: 'Flip the table between particles (false) and antiparticles (true).' },
        spec_only: { type: 'boolean', description: 'Highlight only particles named in the Edexcel specification.' },
        beta: { type: 'number', description: 'Speed as a fraction of c (0.5–0.99999) for the time-dilation decay-distance calculator.' },
        quarks: { type: 'array', items: { type: 'string' }, description: 'Put 0–3 quarks/antiquarks in the quark builder, e.g. ["u", "u", "d"] or ["u", "-s"] or ["s", "s", "s"].' },
      } },
      run: async (a) => {
        await openMode('table');
        let note: string | undefined;
        if (a.antiparticles !== undefined && a.particle === undefined) zooRef?.setAntiMode(Boolean(a.antiparticles));
        if (a.particle !== undefined) {
          const hit = matchParticle(String(a.particle));
          zoo.sel = hit.id;
          note = hit.note;
          if (a.antiparticles !== undefined) zoo.anti = Boolean(a.antiparticles);
        }
        if (a.spec_only !== undefined) zoo.spec = Boolean(a.spec_only);
        if (a.beta !== undefined) {
          const b = Number(a.beta);
          if (!Number.isFinite(b) || b < 0.5 || b > 0.99999) throw new Error('beta must be between 0.5 and 0.99999.');
          zoo.beta = b;
        }
        if (a.quarks !== undefined) {
          if (!Array.isArray(a.quarks) || a.quarks.length > 3) throw new Error('quarks must be an array of 0 to 3 quarks/antiquarks.');
          zoo.slots = a.quarks.map((x) => matchQuark(String(x)));
        }
        await tick();
        return summarizeZoo(zoo, note);
      },
    },
    {
      name: 'particles_accelerator',
      description: 'Drive the 3D Accelerators tab: electron gun (fine-beam tube), linear accelerator (linac), cyclotron, or synchrotron (LHC). Sets parameters and returns live readings and exam working.',
      parameters: { type: 'object', properties: {
        machine: { type: 'string', description: 'Machine: "gun", "linac", "cyclo" (cyclotron), or "sync" (synchrotron / LHC).' },
        beam: { type: 'string', description: 'Particle beam: for linac "p" or "e"; for cyclotron "p", "d" (deuteron), or "a" (alpha).' },
        voltage_v: { type: 'number', description: 'Electron gun accelerating p.d. in V (100–400).' },
        voltage_kv: { type: 'number', description: 'Linac (50–1000 kV) or cyclotron (10–100 kV) peak gap p.d. in kV.' },
        field_mt: { type: 'number', description: 'Electron gun magnetic flux density in mT (0.5–3).' },
        field_t: { type: 'number', description: 'Cyclotron magnetic flux density in T (0.5–2).' },
        frequency_mhz: { type: 'number', description: 'Linac p.d. frequency in MHz (10–400 for protons, 500–3000 for electrons).' },
        gaps: { type: 'integer', description: 'Linac number of accelerating gaps (4–20).' },
        radius_m: { type: 'number', description: 'Cyclotron dee radius in m (0.2–1).' },
        energy_gev: { type: 'number', description: 'LHC synchrotron proton beam energy in GeV (450–6800).' },
        ramp: { type: 'boolean', description: 'For LHC: start ramping from 450 GeV injection to 6.8 TeV.' },
        restart: { type: 'boolean', description: 'Restart the particle bunch from the beginning.' },
      } },
      run: async (a) => {
        await openMode('accel');
        if (a.machine !== undefined) accel.kind = matchAccelKind(String(a.machine));
        const k = accel.kind;
        if (k === 'gun') {
          if (a.voltage_v !== undefined) { const v = Number(a.voltage_v); if (!isFinite(v) || v < 100 || v > 400) throw new Error('gun voltage_v must be 100–400 V.'); accel.gunV = v; }
          if (a.field_mt !== undefined) { const b = Number(a.field_mt); if (!isFinite(b) || b < 0.5 || b > 3) throw new Error('gun field_mt must be 0.5–3 mT.'); accel.gunB = b; }
        } else if (k === 'linac') {
          if (a.beam !== undefined) {
            const bm = String(a.beam).toLowerCase();
            const id = bm.startsWith('e') ? 'e' : bm.startsWith('p') ? 'p' : null;
            if (!id) throw new Error('Linac beam must be "p" (protons) or "e" (electrons).');
            accelRef?.setLinacBeam(id);
          }
          if (a.voltage_kv !== undefined) { const v = Number(a.voltage_kv); if (!isFinite(v) || v < 50 || v > 1000) throw new Error('linac voltage_kv must be 50–1000 kV.'); accel.linV = v; }
          if (a.frequency_mhz !== undefined) {
            const f = Number(a.frequency_mhz);
            if (accel.linBeam === 'e') { if (!isFinite(f) || f < 500 || f > 3000) throw new Error('Electron linac frequency_mhz must be 500–3000 MHz.'); accel.linFe = f; }
            else { if (!isFinite(f) || f < 10 || f > 400) throw new Error('Proton linac frequency_mhz must be 10–400 MHz.'); accel.linFp = f; }
          }
          if (a.gaps !== undefined) { const n = Number(a.gaps); if (!Number.isInteger(n) || n < 4 || n > 20) throw new Error('linac gaps must be an integer 4–20.'); accel.linN = n; }
        } else if (k === 'cyclo') {
          if (a.beam !== undefined) {
            const bm = String(a.beam).toLowerCase();
            const id = bm.startsWith('p') ? 'p' : bm.startsWith('d') ? 'd' : (bm.startsWith('a') || bm === 'α') ? 'a' : null;
            if (!id) throw new Error('Cyclotron beam must be "p" (protons), "d" (deuterons), or "a" (alpha particles).');
            accel.cycBeam = id;
          }
          if (a.field_t !== undefined) { const b = Number(a.field_t); if (!isFinite(b) || b < 0.5 || b > 2) throw new Error('cyclotron field_t must be 0.5–2 T.'); accel.cycB = b; }
          if (a.voltage_kv !== undefined) { const v = Number(a.voltage_kv); if (!isFinite(v) || v < 10 || v > 100) throw new Error('cyclotron voltage_kv must be 10–100 kV.'); accel.cycV = v; }
          if (a.radius_m !== undefined) { const r = Number(a.radius_m); if (!isFinite(r) || r < 0.2 || r > 1) throw new Error('cyclotron radius_m must be 0.2–1 m.'); accel.cycR = r; }
        } else {
          if (a.energy_gev !== undefined) { const e = Number(a.energy_gev); if (!isFinite(e) || e < 450 || e > 6800) throw new Error('LHC energy_gev must be 450–6800 GeV.'); accel.syncE = Math.round(e); }
          if (a.ramp) accelRef?.startRamp();
        }
        if (a.restart) accelRef?.restart();
        await tick();
        return summarizeAccel(accel);
      },
    },
    {
      name: 'particles_detector',
      description: 'Drive the Cloud Chamber (radioactive sources & magnet), Classic Bubble-Chamber events (1–6), or Collider Detector (fire e⁻, γ, π⁺, n, μ⁻, ν or all) on screen.',
      parameters: { type: 'object', properties: {
        detector: { type: 'string', enum: ['cloud', 'bubble_classic', 'collider'], description: 'Which detector view to open.' },
        sources: { type: 'array', items: { type: 'string' }, description: 'Cloud chamber: source ids/names, e.g. ["am241", "sr90", "co60", "na22", "ra226", "th232", "rn222", "u238"] or [] for background only.' },
        field: { type: 'boolean', description: 'Cloud chamber: turn 0.5 T magnetic field on or off.' },
        together: { type: 'boolean', description: 'Cloud chamber: put all solid sources on one holder (true) or spread apart (false).' },
        cosmic: { type: 'boolean', description: 'Cloud chamber: cosmic ray background on/off.' },
        radon: { type: 'boolean', description: 'Cloud chamber: natural radon background on/off.' },
        event: { type: ['number', 'string'], description: 'Classic bubble chamber: event 1–6 or name (signs, spirals, pair, delta, strange, pimue).' },
        show_neutral: { type: 'boolean', description: 'Classic bubble chamber: show neutral tracks as dashed lines.' },
        shoot: { type: 'string', description: 'Collider detector: fire "e", "gamma", "pi+", "n", "mu", "nue", or "all" (one of each).' },
        clear: { type: 'boolean', description: 'Clear tracks (cloud or collider).' },
      }, required: ['detector'] },
      run: async (a) => {
        await openMode('detect');
        const d = String(a.detector);
        if (d === 'cloud') {
          det.det = 'cloud';
          if (a.sources !== undefined) {
            if (!Array.isArray(a.sources)) throw new Error('sources must be an array of source ids/names.');
            det.srcs = a.sources.map((s) => matchCloudSource(String(s)));
            if (det.srcs[0]) det.info = det.srcs[0];
          }
          if (a.field !== undefined) det.field = Boolean(a.field);
          if (a.together !== undefined) det.together = Boolean(a.together);
          if (a.cosmic !== undefined) det.cosmic = Boolean(a.cosmic);
          if (a.radon !== undefined) det.radon = Boolean(a.radon);
          await tick();
          if (a.clear) detRef?.clearView();
        } else if (d === 'bubble_classic') {
          det.det = 'bubble';
          det.bmode = 'classic';
          if (a.show_neutral !== undefined) det.neutral = Boolean(a.show_neutral);
          await tick();
          if (a.event !== undefined) detRef?.selectEvent(matchClassicEvent(a.event as string | number));
          else detRef?.replayCurrent();
        } else if (d === 'collider') {
          det.det = 'collider';
          await tick();
          if (a.clear) detRef?.clearView();
          if (a.shoot !== undefined) detRef?.shootParticle(matchShot(String(a.shoot)));
        } else {
          throw new Error('detector must be "cloud", "bubble_classic", or "collider".');
        }
        await tick();
        const ds = detRef?.getState() ?? { result: null, fired: 0 };
        return summarizeDetector(det, ds.result, ds.fired);
      },
    },
    {
      name: 'particles_scatter',
      description: 'Drive the Nucleus tab (Geiger–Marsden α-scattering experiment & close-up): pick nuclear vs plum-pudding model, foil (Au/Ag/Al), α energy, thickness, microscope angle, and collect counts on screen.',
      parameters: { type: 'object', properties: {
        view: { type: 'string', enum: ['exp', 'zoom'], description: '"exp" (full Geiger–Marsden experiment) or "zoom" (close-up on one atom).' },
        model: { type: 'string', enum: ['nuclear', 'thomson'], description: '"nuclear" (Rutherford) or "thomson" (plum pudding).' },
        foil: { type: 'string', description: 'Target foil: "au" (gold), "ag" (silver), or "al" (aluminium).' },
        energy_mev: { type: 'number', description: 'α kinetic energy in MeV (4–8).' },
        thickness_um: { type: 'number', description: 'Foil thickness in μm (0.2–2).' },
        angle_deg: { type: 'number', description: 'Microscope angle θ in degrees (0–180).' },
        rate: { type: 'string', enum: ['1', '100', '10000'], description: 'Firing rate multiplier: "1" (12/s), "100" (1200/s), or "10000" (120 000/s).' },
        clear: { type: 'boolean', description: 'Clear counts before firing.' },
      } },
      run: async (a) => {
        await openMode('nucleus');
        if (a.view !== undefined) { const v = String(a.view); if (v !== 'exp' && v !== 'zoom') throw new Error('view must be "exp" or "zoom".'); scat.view = v; }
        if (a.model !== undefined) { const m = String(a.model); if (m !== 'nuclear' && m !== 'thomson') throw new Error('model must be "nuclear" or "thomson".'); scat.model = m; }
        if (a.foil !== undefined) scat.target = matchFoil(String(a.foil));
        if (a.energy_mev !== undefined) { const e = Number(a.energy_mev); if (!isFinite(e) || e < 4 || e > 8) throw new Error('energy_mev must be 4–8 MeV.'); scat.mev = e; }
        if (a.thickness_um !== undefined) { const t = Number(a.thickness_um); if (!isFinite(t) || t < 0.2 || t > 2) throw new Error('thickness_um must be 0.2–2 μm.'); scat.t = t; }
        if (a.angle_deg !== undefined) { const d = Number(a.angle_deg); if (!isFinite(d) || d < 0 || d > 180) throw new Error('angle_deg must be 0–180°.'); scat.det = Math.round(d); }
        if (a.rate !== undefined) { const r = String(a.rate); if (!['1', '100', '10000'].includes(r)) throw new Error('rate must be "1", "100", or "10000".'); scat.rate = r; }
        await tick();
        if (a.clear) scatRef?.resetCounts();
        scatRef?.setPlaying(true);
        if (scat.view === 'exp') { scatRef?.burst(0.5); await wait(120); }
        const ss = scatRef?.getState() ?? { fired: 0, over90: 0, back: 0, atObs: 0, atPred: NaN };
        return summarizeScatter(scat, ss);
      },
    },
    {
      name: 'particles_matter',
      description: 'Drive the Annihilation & Pair Production tab in 3D: annihilate e⁻e⁺, μ⁻μ⁺, pp̄ or nn̄ into two γ-rays, or run γ → pair production in a magnetic field. Returns threshold 2mc², photon f/λ, track radii and ΔE = c²Δm working.',
      parameters: { type: 'object', properties: {
        process: { type: 'string', enum: ['annih', 'pair'], description: '"annih" (annihilation) or "pair" (pair production).' },
        particle: { type: 'string', description: 'Particle pair: "e" (e⁻/e⁺), "mu" (μ⁻/μ⁺), "p" (p/p̄), or "n" (n/n̄, annihilation only).' },
        ke_mev: { type: 'number', description: 'For annihilation: kinetic energy of each particle in MeV (0 to 2mc²).' },
        photon_mev: { type: 'number', description: 'For pair production: γ-ray energy in MeV (e: 0.5–20, mu: 150–700, p: 1500–5000).' },
        field_t: { type: 'number', description: 'For pair production: magnetic flux density B in T (0–2).' },
      } },
      run: async (a) => {
        await openMode('matter');
        if (a.process !== undefined) {
          const p = String(a.process).toLowerCase();
          if (p !== 'annih' && p !== 'pair') throw new Error('process must be "annih" or "pair".');
          matter.mode = p;
        }
        const annih = matter.mode === 'annih';
        if (a.particle !== undefined) {
          const w = matchMatterWho(String(a.particle), annih);
          if (annih) matter.who = w;
          else matter.pwho = w as Exclude<typeof w, 'n'>;
        }
        if (annih && a.ke_mev !== undefined) {
          const ke = Number(a.ke_mev), m = REST[matter.who];
          if (!isFinite(ke) || ke < 0 || ke > 2 * m + 1e-6) throw new Error(`ke_mev for ${matter.who} annihilation must be between 0 and ${(2 * m).toPrecision(4)} MeV.`);
          matter.K = ke / m;
        }
        if (!annih && a.photon_mev !== undefined) {
          const eg = Number(a.photon_mev);
          const ranges = { e: [0.5, 20], mu: [150, 700], p: [1500, 5000] } as const;
          const [lo, hi] = ranges[matter.pwho];
          if (!isFinite(eg) || eg < lo || eg > hi) throw new Error(`photon_mev for ${matter.pwho} pair production must be ${lo}–${hi} MeV.`);
          matter.Eg = { ...matter.Eg, [matter.pwho]: eg };
        }
        if (!annih && a.field_t !== undefined) {
          const b = Number(a.field_t);
          if (!isFinite(b) || b < 0 || b > 2) throw new Error('field_t must be 0–2 T.');
          matter.B = b;
        }
        await tick();
        matterRef?.triggerEvent();
        await wait(120);
        return summarizeMatter(matter, matterRef?.getEvent() ?? null);
      },
    },
  ]);

  onMount(() => {
    addEventListener('hashchange', fromHash);
    glint('.exbtn,.qpanel,.pcell');
    const unprovide = kernelTools();
    return () => { removeEventListener('hashchange', fromHash); unprovide(); };
  });
</script>

<SimHeader title="Particle Lab" eyebrow="Edexcel IAL Physics · Unit 4 · Nuclear and particle physics"
  back={{ href: '/physics/', label: 'Arsenal' }} tabs={TABS} value={mode} onselect={setMode} />
<StatusLine label={INFO[mode][0]} hint={INFO[mode][1]} stats={shown} />
{#if mode === 'practice'}
  <div class="scope"><Seg label="Topic" options={TOPICS} bind:value={topic.t} /></div>
{/if}

<div bind:this={views.accel}><Accelerators bind:this={accelRef} prefs={accel} hidden={mode !== 'accel'} bind:stats={stats.accel} /></div>
<div bind:this={views.detect}><Detectors bind:this={detRef} prefs={det} hidden={mode !== 'detect'} bind:stats={stats.detect} /></div>
<div bind:this={views.nucleus}><Scatter bind:this={scatRef} prefs={scat} hidden={mode !== 'nucleus'} bind:stats={stats.nucleus} /></div>
<div bind:this={views.table}><Zoo bind:this={zooRef} prefs={zoo} hidden={mode !== 'table'} bind:stats={stats.table} /></div>
<div bind:this={views.reactions}><Rules bind:this={rulesRef} prefs={rules} hidden={mode !== 'reactions'} bind:stats={stats.reactions} /></div>
<div bind:this={views.matter}><Matter bind:this={matterRef} prefs={matter} hidden={mode !== 'matter'} bind:stats={stats.matter} /></div>
<div bind:this={views.practice}><Practice {score} topic={topic.t} hidden={mode !== 'practice'} /></div>
