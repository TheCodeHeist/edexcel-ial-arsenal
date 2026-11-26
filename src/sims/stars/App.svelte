<script lang="ts">
  /* Star Lab. Five modes with hash routes: #life (a star's life in 3D), #hr (the HR diagram of named stars), #binary,
     the distance views #parallax, #candles, #hubble and #fate (sub-tabs of Distance), and #practice. */
  import { onMount, tick } from 'svelte';
  import { persisted } from '../../lib/persist.svelte';
  import { glint, fadeIn } from '../../lib/motion';
  import SimHeader from '../../components/ui/SimHeader.svelte';
  import StatusLine from '../../components/ui/StatusLine.svelte';
  import SubTabs from '../../components/ui/SubTabs.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import Life, { type LifePrefs } from './Life.svelte';
  import HRView, { type HRPrefs } from './HRView.svelte';
  import Parallax, { type PxPrefs } from './Parallax.svelte';
  import Candles, { type CandlePrefs } from './Candles.svelte';
  import Hubble, { type HubblePrefs } from './Hubble.svelte';
  import Fate, { type FatePrefs } from './Fate.svelte';
  import Practice, { type PScore } from './Practice.svelte';
  import Binary, { type BinPrefs } from './Binary.svelte';
  import { SYSTEMS, periodYears } from './binary';
  import { TOPICS, type Topic } from './practice';
  import { track, at } from './evolve';
  import { short, sci, plain, STARS, MPC, YEAR } from './data';
  import { provideKernelTools } from '../../lib/kernel/live';
  import {
    matchStar, matchSystem, matchTab, matchStage, parseMonth, clampMass, starList, sysList,
    summarizeLife, summarizeHR, summarizeBinary, summarizeParallax, type StarTab,
  } from './kernel';

  type Mode = 'life' | 'hr' | 'binary' | 'distance' | 'practice';
  type Sub = 'parallax' | 'candles' | 'hubble' | 'fate';

  const life = persisted<LifePrefs>('stars-life', { M: 1, x: 0.3, speed: 1, spin: true });
  const hr = persisted<HRPrefs>('stars-hr', { sel: 'sirius-b', vs: 'sirius-a', regions: true, radii: true, tracks: false, labels: true, norm: false });
  const px = persisted<PxPrefs>('stars-parallax', { star: 'proxima', d: 10, month: 0 });
  const cand = persisted<CandlePrefs>('stars-candles', { kind: 'cepheid', seed: 1, solved: 0 });
  const hub = persisted<HubblePrefs>('stars-hubble', { seed: 1, sel: 0, done: [] });
  const fate = persisted<FatePrefs>('stars-fate', { omega: 1, lambda: false, H0: 70, halo: 0 });
  const bin = persisted<BinPrefs>('stars-binary', { sys: 'sirius', earth: false, speed: 1 });
  const score = persisted<PScore>('stars-score', { right: 0, total: 0, streak: 0, best: 0 });
  const topic = persisted<{ t: Topic | 'all' }>('stars-topic', { t: 'all' });
  score.streak = 0;

  let mode = $state<Mode>('life');
  let sub = $state<Sub>('parallax');
  const views: Record<Mode, HTMLElement | undefined> = $state({ life: undefined, hr: undefined, binary: undefined, distance: undefined, practice: undefined });
  let lifeRef = $state<Life>(), hrRef = $state<HRView>(), binRef = $state<Binary>();
  let pxRef = $state<Parallax>(), candRef = $state<Candles>(), hubRef = $state<Hubble>(), fateRef = $state<Fate>();
  const TABS = [['life', 'Life cycle', 'Life'], ['hr', 'HR diagram', 'HR'], ['binary', 'Binaries', 'Pairs'], ['distance', 'Distances', 'Dist.'], ['practice', 'Practice', 'Quiz']] as const;
  const SUBS = [['parallax', 'Parallax'], ['candles', 'Standard candles'], ['hubble', 'Redshift and Hubble'], ['fate', 'Fate and dark matter']] as const;
  const INFO: Record<Mode | Sub, [string, string]> = {
    life: ['Life cycle', 'Pick a mass, then play or scrub through its life. Drag the view to turn it.'],
    hr: ['HR diagram', 'Pick a star on the diagram to see its numbers and compare it with another.'],
    binary: ['Binaries', 'Pick a system; watch the orbit, the light curve and the Doppler-shifted lines together.'],
    distance: ['Distances', ''],
    parallax: ['Parallax', 'Move the Earth round its orbit and watch the nearby star shift.'],
    candles: ['Standard candles', 'Read the light curve, find the luminosity, then work out the distance.'],
    hubble: ['Redshift and Hubble', 'Measure each galaxy’s redshift, plot v against d, find H₀ and the age.'],
    fate: ['Fate and dark matter', 'Change the density and see how the universe ends; fit a galaxy’s rotation.'],
    practice: ['Practice', 'Answer, then check the working.'],
  };
  const key = $derived<Mode | Sub>(mode === 'distance' ? sub : mode);

  const stats = $derived.by((): [string, string | number][] => {
    switch (key) {
      case 'life': { const n = at(track(life.M), life.x); return [['Mass', `${short(life.M, 2)} M☉`], ['Stage', n.stage.name]]; }
      case 'hr': return [['Stars', STARS.length]];
      case 'binary': { const sy = SYSTEMS.find((x) => x.id === bin.sys) ?? SYSTEMS[0]; const P = periodYears(sy); return [['Period', P < 1 ? `${short(P * 365.25, 3)} d` : `${short(P, 3)} yr`]]; }
      case 'parallax': return [];
      case 'candles': return [['Solved', cand.solved]];
      case 'hubble': return [['Plotted', `${hub.done.length}/8`]];
      case 'fate': return [['H₀', fate.H0]];
      default: return [['Correct', `${score.right}/${score.total}`], ['Streak', score.streak], ['Best', score.best]];
    }
  });

  function setMode(m: Mode) {
    const prev = mode;
    mode = m;
    if (prev !== m) tick().then(() => fadeIn(views[m]?.firstElementChild as HTMLElement));
  }
  function fromHash() {
    const h = location.hash.slice(1);
    if (h === 'parallax' || h === 'candles' || h === 'hubble' || h === 'fate') { sub = h; setMode('distance'); }
    else if (h === 'distance') setMode('distance');
    else setMode(h === 'hr' || h === 'practice' || h === 'binary' ? h : 'life');
  }
  fromHash();
  $effect(() => { const h = '#' + key; if (location.hash !== h) history.replaceState(null, '', h); });

  /* ---------- Kernel live tools ---------- */
  async function openTab(t: StarTab) {
    if (t === 'parallax' || t === 'candles' || t === 'hubble' || t === 'fate') { sub = t; setMode('distance'); }
    else setMode(t);
    await tick();
  }
  function summarizeCandles(): string {
    const st = candRef?.getState();
    if (!st) return `Standard candles: ${cand.kind === 'cepheid' ? 'Cepheid variable' : 'Type Ia supernova'}.`;
    const { obj, shown, checked, fmtD, Lw } = st;
    const lines = [
      `Standard candles: ${obj.name} (${obj.cep ? 'Cepheid variable star' : 'Type Ia supernova'}), solved count ${cand.solved}.`,
      obj.cep ? `Mean intensity received: I = ${sci(obj.I)} W m⁻².` : `Peak luminosity L ≈ ${sci(obj.L)} L☉ (${sci(Lw)} W); peak intensity I = ${sci(obj.I)} W m⁻².`,
      `Working on screen: ${shown || checked ? 'shown' : 'hidden (student challenge)'}.`,
      `True values (for tutor guidance${shown || checked ? '' : ' — do not spoil unless asked'}): ${obj.cep ? `P = ${obj.P} days, L = ${sci(obj.L)} L☉ (${sci(Lw)} W), ` : ''}d = ${fmtD} (${sci(obj.d)} pc).`,
    ];
    return lines.join('\n');
  }
  function summarizeHubble(): string {
    const st = hubRef?.getState();
    if (!st) return `Redshift and Hubble: ${hub.done.length}/8 galaxies plotted.`;
    const { gal, sel, done, g, ha, fit, H0si, age } = st;
    const lines = [
      `Redshift and Hubble: selected galaxy #${sel + 1} ${g.name} (d = ${short(g.d)} Mpc, ${done.includes(sel) ? 'plotted' : 'not yet plotted'}). Plotted: ${done.length}/${gal.length}.`,
      `Hα lab = 656.3 nm, measured = ${plain(ha, 4)} nm, shift Δλ = ${plain(ha - 656.3)} nm → z = ${sci(g.z)}, v = cz = ${short(g.v, 3)} km s⁻¹.`,
      fit && H0si && age
        ? `Best line through origin: H₀ = ${plain(fit)} km s⁻¹ Mpc⁻¹ = ${sci(H0si)} s⁻¹ (from H₀ = ${plain(fit)}×10³ ÷ ${sci(MPC)}), age ≈ 1/H₀ = ${sci(1 / H0si)} s = ${plain(age / 1e9)} billion years (${sci(age)} yr, 1 yr = ${sci(YEAR)} s).`
        : 'Plot at least 2 galaxies to fit H₀ and estimate the age of the universe.',
      `Galaxies: ${gal.map((x, idx) => `${idx + 1}. ${x.name} (${short(x.d)} Mpc${done.includes(idx) ? ' ✓' : ''})`).join('; ')}.`,
    ];
    return lines.join('\n');
  }
  function summarizeFate(): string {
    const st = fateRef?.getState();
    if (!st) return `Fate and dark matter: Ω = ${fate.omega}, H₀ = ${fate.H0}, dark energy ${fate.lambda ? 'on' : 'off'}, halo ${fate.halo}×10¹¹ M☉.`;
    return [
      `Fate and dark matter: Ω = ρ/ρc = ${plain(fate.omega, 2)}, H₀ = ${fate.H0} km s⁻¹ Mpc⁻¹, dark energy ${fate.lambda ? 'on (Ω_Λ = 0.7)' : 'off'}.`,
      `1/H₀ = ${plain(st.hub)} billion yr; actual age = ${plain(st.ageGyr)} billion yr; critical density ρc = 3H₀²/8πG = ${sci(st.rhoC)} kg m⁻³.`,
      `Fate: ${st.verdict}`,
      `Dark matter rotation curve: halo mass inside 30 kpc = ${plain(fate.halo, 2)} × 10¹¹ M☉ (${Math.round(st.darkFrac * 100)}% dark, RMS error ${(st.fitErr * 100).toFixed(1)}%${st.fitErr < 0.06 ? ' — good fit!' : ''}).`,
    ].join('\n');
  }
  function currentState(): string {
    const head = `Tab: ${INFO[key][0]} (#${key}).`;
    switch (key) {
      case 'life': return head + '\n' + summarizeLife(life.M, life.x, life.speed, lifeRef?.isPlaying() ?? false);
      case 'hr': return head + '\n' + summarizeHR(hr.sel, hr.vs, hr);
      case 'binary': {
        const bs = binRef?.getState() ?? { phi: 0.15, feed: 0, boom: 0, playing: false };
        return head + '\n' + summarizeBinary(bin.sys, bin.earth, bs.phi, bin.speed, bs.playing, bs.feed, bs.boom);
      }
      case 'parallax': return head + '\n' + summarizeParallax(px.star, px.d, px.month, pxRef?.isOrbiting() ?? false);
      case 'candles': return head + '\n' + summarizeCandles();
      case 'hubble': return head + '\n' + summarizeHubble();
      case 'fate': return head + '\n' + summarizeFate();
      default: return `${head}\nPractice topic: ${topic.t}. Score: ${score.right}/${score.total}, streak ${score.streak} (best ${score.best}).`;
    }
  }

  const KERNEL_ABOUT = 'Star Lab (Edexcel IAL Physics Unit 5: Astrophysics & Cosmology) is open, with tabs for stellar life cycles in 3D, the HR diagram, binary systems, parallax, standard candles, redshift & Hubble’s law, fate of the universe & dark matter, and practice. '
    + 'Use stars_ tools to switch tabs, run a star’s life cycle for any mass, inspect or compare named stars on the HR diagram, drive binaries, measure parallax, or adjust cosmology/Hubble/candle experiments on screen.';

  const kernelTools = () => provideKernelTools('stars', KERNEL_ABOUT, [
    {
      name: 'stars_state',
      description: 'Read what is currently on screen in Star Lab: active tab, settings, live numbers and working, plus available tabs.',
      parameters: { type: 'object', properties: {} },
      run: () => currentState() + '\nAvailable tabs: life, hr, binary, parallax, candles, hubble, fate, practice.',
    },
    {
      name: 'stars_mode',
      description: 'Switch Star Lab to a tab or distance sub-tab (life, hr, binary, parallax, candles, hubble, fate, practice).',
      parameters: { type: 'object', properties: {
        tab: { type: 'string', description: 'Tab name: life, hr, binary, parallax, candles, hubble, fate, or practice.' },
        topic: { type: 'string', enum: ['all', 'bb', 'dist', 'cosmo', 'life', 'binary'], description: 'Only for practice: filter questions by topic.' },
      }, required: ['tab'] },
      run: async (a) => {
        const t = matchTab(String(a.tab ?? ''));
        if (t === 'practice' && a.topic !== undefined) {
          const valid = TOPICS.map((x) => x[0]) as string[];
          const tp = String(a.topic).toLowerCase();
          if (!valid.includes(tp)) throw new Error(`topic must be one of: ${valid.join(', ')}.`);
          topic.t = tp as Topic | 'all';
        }
        await openTab(t);
        return currentState();
      },
    },
    {
      name: 'stars_life',
      description: 'Show a star’s life cycle in 3D on screen: pick a starting mass (0.05–50 M☉), optionally jump to a stage or progress (0–1), and play or pause.',
      parameters: { type: 'object', properties: {
        mass: { type: 'number', description: 'Starting mass in solar masses (M☉), from 0.05 to 50 (e.g. 0.05 brown dwarf, 0.2 red dwarf, 1 Sun, 5 Cepheid, 15 neutron star, 40 black hole).' },
        stage: { type: 'string', description: 'Optional stage to jump to, e.g. "nebula", "main sequence", "red giant", "cepheid", "planetary nebula", "white dwarf", "red supergiant", "supernova", "neutron star", "black hole".' },
        progress: { type: 'number', description: 'Optional timeline position 0–1 (overrides stage if given).' },
        speed: { type: 'number', enum: [0.5, 1, 3], description: 'Playback speed multiplier: 0.5, 1, or 3.' },
        play: { type: 'boolean', description: 'Whether to play the evolution animation. Defaults to true when setting a mass without a specific stage/progress.' },
      } },
      run: async (a) => {
        await openTab('life');
        if (a.mass !== undefined) life.M = clampMass(a.mass);
        if (a.speed !== undefined) {
          const sp = Number(a.speed);
          if (![0.5, 1, 3].includes(sp)) throw new Error('speed must be 0.5, 1, or 3.');
          life.speed = sp;
        }
        await tick();
        const tr = track(life.M);
        if (a.progress !== undefined) {
          const p = Number(a.progress);
          if (!Number.isFinite(p) || p < 0 || p > 1) throw new Error('progress must be between 0 and 1.');
          lifeRef?.setPlaying(false);
          life.x = p;
        } else if (a.stage !== undefined) {
          const idx = matchStage(tr, String(a.stage));
          lifeRef?.jumpTo(idx);
        } else if (a.mass !== undefined && a.play !== false) {
          life.x = 0;
        }
        const shouldPlay = a.play !== undefined ? Boolean(a.play) : (a.stage === undefined && a.progress === undefined);
        lifeRef?.setPlaying(shouldPlay, a.stage === undefined && a.progress === undefined && a.mass !== undefined);
        await tick();
        return summarizeLife(life.M, life.x, life.speed, lifeRef?.isPlaying() ?? false);
      },
    },
    {
      name: 'stars_hr',
      description: 'Open the Hertzsprung–Russell diagram, select a named star (e.g. Sun, Sirius B, Betelgeuse, Rigel, Proxima Centauri), optionally compare with another star and toggle overlays.',
      parameters: { type: 'object', properties: {
        star: { type: 'string', description: 'Star name or id to highlight on the HR diagram, e.g. "Sun", "Sirius B", "Betelgeuse", "Delta Cephei".' },
        compare: { type: 'string', description: 'Optional second star name or id to compare against.' },
        regions: { type: 'boolean', description: 'Show HR regions.' },
        radii: { type: 'boolean', description: 'Show lines of equal radius.' },
        tracks: { type: 'boolean', description: 'Show 1, 4 and 15 M☉ life tracks.' },
        labels: { type: 'boolean', description: 'Show star names on the diagram.' },
        normalise_curves: { type: 'boolean', description: 'Normalise black-body comparison curves each to its own peak (true) or same scale (false).' },
      } },
      run: async (a) => {
        await openTab('hr');
        if (a.star !== undefined) {
          const st = matchStar(String(a.star));
          hrRef?.pickStar(st.id);
        }
        if (a.compare !== undefined) {
          const vs = matchStar(String(a.compare));
          if (vs.id === hr.sel) throw new Error(`Pick a star different from ${vs.name} to compare with. ${starList()}`);
          hr.vs = vs.id;
        }
        if (a.regions !== undefined) hr.regions = Boolean(a.regions);
        if (a.radii !== undefined) hr.radii = Boolean(a.radii);
        if (a.tracks !== undefined) hr.tracks = Boolean(a.tracks);
        if (a.labels !== undefined) hr.labels = Boolean(a.labels);
        if (a.normalise_curves !== undefined) hr.norm = Boolean(a.normalise_curves);
        await tick();
        return summarizeHR(hr.sel, hr.vs, hr);
      },
    },
    {
      name: 'stars_binary',
      description: 'Show a binary star system in 3D with its light curve, radial-velocity graph and Doppler-shifted Hα line (Sirius, Algol, Spica, Type Ia supernova, Cygnus X-1).',
      parameters: { type: 'object', properties: {
        system: { type: 'string', description: 'System id, name or type: sirius (visual), algol (eclipsing), spica (spectroscopic), ia (type Ia supernova), cygx1 (X-ray / black hole).' },
        view: { type: 'string', enum: ['free', 'earth'], description: 'Camera view: free 3D or from the Earth.' },
        phase: { type: 'number', description: 'Orbital phase 0–1 (pauses playback at that phase unless play is true).' },
        speed: { type: 'number', enum: [0.5, 1, 3], description: 'Playback speed: 0.5, 1, or 3.' },
        play: { type: 'boolean', description: 'Play or pause the orbit.' },
        restart: { type: 'boolean', description: 'For the Type Ia system, restart the mass transfer and supernova.' },
      } },
      run: async (a) => {
        await openTab('binary');
        if (a.system !== undefined) {
          const sy = matchSystem(String(a.system));
          binRef?.selectSystem(sy.id);
        }
        if (a.view !== undefined) {
          const v = String(a.view).toLowerCase();
          if (v !== 'free' && v !== 'earth') throw new Error('view must be "free" or "earth".');
          bin.earth = v === 'earth';
        }
        if (a.speed !== undefined) {
          const sp = Number(a.speed);
          if (![0.5, 1, 3].includes(sp)) throw new Error('speed must be 0.5, 1, or 3.');
          bin.speed = sp;
        }
        if (a.restart) binRef?.restart();
        if (a.phase !== undefined) {
          const ph = Number(a.phase);
          if (!Number.isFinite(ph) || ph < 0 || ph > 1) throw new Error('phase must be between 0 and 1.');
          binRef?.setPhase(ph);
          if (a.play === undefined) binRef?.setPlaying(false);
        }
        if (a.play !== undefined) binRef?.setPlaying(Boolean(a.play));
        await tick();
        const bs = binRef?.getState() ?? { phi: 0.15, feed: 0, boom: 0, playing: false };
        return summarizeBinary(bin.sys, bin.earth, bs.phi, bin.speed, bs.playing, bs.feed, bs.boom) + '\n' + sysList();
      },
    },
    {
      name: 'stars_parallax',
      description: 'Measure trigonometric parallax on screen for a nearby named star or any custom distance in parsecs (1–10 000 pc). Optionally set the month or animate Earth’s orbit.',
      parameters: { type: 'object', properties: {
        star: { type: 'string', description: 'A nearby named star (e.g. "Proxima Centauri", "Sirius A", "Vega", "Betelgeuse") or "custom".' },
        distance_pc: { type: 'number', description: 'Custom distance in parsecs (1–10000 pc). Sets star to custom distance.' },
        month: { type: ['number', 'string'], description: 'Time of year: 0–11.99 or month name (e.g. "Jan", "Jul").' },
        orbit: { type: 'boolean', description: 'Start (true) or stop (false) the Earth orbiting animation.' },
      } },
      run: async (a) => {
        await openTab('parallax');
        if (a.distance_pc !== undefined) {
          const d = Number(a.distance_pc);
          if (!Number.isFinite(d) || d < 1 || d > 10000) throw new Error('distance_pc must be between 1 and 10000 pc.');
          px.star = 'custom';
          px.d = d;
        } else if (a.star !== undefined) {
          const raw = String(a.star).trim().toLowerCase();
          if (raw === 'custom') px.star = 'custom';
          else {
            const near = STARS.filter((s) => s.d > 0);
            const st = matchStar(String(a.star), near);
            px.star = st.id;
          }
        }
        if (a.month !== undefined) px.month = parseMonth(a.month);
        if (a.orbit !== undefined) pxRef?.setOrbiting(Boolean(a.orbit));
        await tick();
        return summarizeParallax(px.star, px.d, px.month, pxRef?.isOrbiting() ?? false);
      },
    },
    {
      name: 'stars_cosmos',
      description: 'Drive the Standard Candles, Redshift & Hubble’s Law, or Fate & Dark Matter sub-tabs on screen.',
      parameters: { type: 'object', properties: {
        tab: { type: 'string', enum: ['candles', 'hubble', 'fate'], description: 'Which distance/cosmology sub-tab to open.' },
        candle_kind: { type: 'string', enum: ['cepheid', 'sn'], description: 'For candles: "cepheid" or "sn" (Type Ia supernova).' },
        new_object: { type: 'boolean', description: 'For candles: generate a fresh mystery object.' },
        show_working: { type: 'boolean', description: 'For candles: show or hide the worked distance calculation on screen.' },
        galaxy: { type: ['number', 'string'], description: 'For hubble: select galaxy 1–8 (1-based) or by name.' },
        plot: { type: 'string', enum: ['current', 'all'], description: 'For hubble: plot the selected galaxy or plot all 8 galaxies.' },
        new_galaxies: { type: 'boolean', description: 'For hubble: generate a fresh set of 8 galaxies.' },
        omega: { type: 'number', description: 'For fate: density / critical density Ω (0.1–3.0).' },
        H0: { type: 'number', description: 'For fate: Hubble constant H₀ in km s⁻¹ Mpc⁻¹ (60–80).' },
        dark_energy: { type: 'boolean', description: 'For fate: turn dark energy on or off.' },
        dark_matter: { type: 'number', description: 'For fate: dark matter halo mass inside 30 kpc, in 10¹¹ M☉ (0–5).' },
      } },
      run: async (a) => {
        const inferred: Sub = a.tab ? (String(a.tab) as Sub)
          : (a.candle_kind !== undefined || a.new_object || a.show_working !== undefined) ? 'candles'
          : (a.galaxy !== undefined || a.plot !== undefined || a.new_galaxies) ? 'hubble'
          : 'fate';
        if (!['candles', 'hubble', 'fate'].includes(inferred)) throw new Error('tab must be candles, hubble, or fate.');
        await openTab(inferred);
        if (inferred === 'candles') {
          if (a.candle_kind !== undefined) {
            const k = String(a.candle_kind).toLowerCase();
            if (k !== 'cepheid' && k !== 'sn') throw new Error('candle_kind must be "cepheid" or "sn".');
            cand.kind = k;
            await tick();
          }
          if (a.new_object) { candRef?.nextObject(); await tick(); }
          if (a.show_working !== undefined) { candRef?.setShowWorking(Boolean(a.show_working)); await tick(); }
          return summarizeCandles();
        }
        if (inferred === 'hubble') {
          if (a.new_galaxies) { hubRef?.newGalaxies(); await tick(); }
          if (a.galaxy !== undefined) {
            const st = hubRef?.getState();
            const gal = st?.gal ?? [];
            const n = Number(a.galaxy);
            if (Number.isInteger(n) && n >= 1 && n <= gal.length) hubRef?.selectGalaxy(n - 1);
            else {
              const q = String(a.galaxy).toLowerCase().replace(/\s+/g, '');
              const idx = gal.findIndex((x) => x.name.toLowerCase().replace(/\s+/g, '').includes(q));
              if (idx < 0) throw new Error(`No galaxy matches "${a.galaxy}". Available (1–${gal.length}): ${gal.map((x) => x.name).join(', ')}.`);
              hubRef?.selectGalaxy(idx);
            }
            await tick();
          }
          if (a.plot === 'current') { hubRef?.plotCurrent(); await tick(); }
          else if (a.plot === 'all') { hubRef?.plotAll(); await tick(); }
          return summarizeHubble();
        }
        // fate
        if (a.omega !== undefined) {
          const o = Number(a.omega);
          if (!Number.isFinite(o) || o < 0.1 || o > 3) throw new Error('omega must be between 0.1 and 3.');
          fate.omega = o;
        }
        if (a.H0 !== undefined) {
          const h = Number(a.H0);
          if (!Number.isFinite(h) || h < 60 || h > 80) throw new Error('H0 must be between 60 and 80 km s⁻¹ Mpc⁻¹.');
          fate.H0 = Math.round(h);
        }
        if (a.dark_energy !== undefined) fate.lambda = Boolean(a.dark_energy);
        if (a.dark_matter !== undefined) {
          const dm = Number(a.dark_matter);
          if (!Number.isFinite(dm) || dm < 0 || dm > 5) throw new Error('dark_matter must be between 0 and 5 (× 10¹¹ M☉ inside 30 kpc).');
          fate.halo = dm;
        }
        await tick();
        return summarizeFate();
      },
    },
  ]);

  onMount(() => {
    addEventListener('hashchange', fromHash);
    glint('.exbtn,.qpanel,.card');
    const unprovide = kernelTools();
    return () => { removeEventListener('hashchange', fromHash); unprovide(); };
  });
</script>

<SimHeader title="Star Lab" eyebrow="Edexcel IAL Physics · Unit 5 · Astrophysics and cosmology"
  back={{ href: '/physics/', label: 'Arsenal' }} tabs={TABS} value={mode} onselect={setMode} />
<StatusLine label={INFO[key][0]} hint={INFO[key][1]} {stats} />
{#if mode === 'distance'}
  <div class="subbar"><SubTabs label="Distance method" options={SUBS} bind:value={sub} /></div>
{:else if mode === 'practice'}
  <div class="scope"><Seg label="Topic" options={TOPICS} bind:value={topic.t} /></div>
{/if}

<div bind:this={views.life}><Life bind:this={lifeRef} prefs={life} hidden={mode !== 'life'} /></div>
<div bind:this={views.hr}><HRView bind:this={hrRef} prefs={hr} hidden={mode !== 'hr'} /></div>
<div bind:this={views.binary}><Binary bind:this={binRef} prefs={bin} hidden={mode !== 'binary'} /></div>
<div bind:this={views.distance}>
  <div>
    <Parallax bind:this={pxRef} prefs={px} hidden={mode !== 'distance' || sub !== 'parallax'} />
    <Candles bind:this={candRef} prefs={cand} hidden={mode !== 'distance' || sub !== 'candles'} />
    <Hubble bind:this={hubRef} prefs={hub} hidden={mode !== 'distance' || sub !== 'hubble'} />
    <Fate bind:this={fateRef} prefs={fate} hidden={mode !== 'distance' || sub !== 'fate'} />
  </div>
</div>
<div bind:this={views.practice}><Practice {score} topic={topic.t} hidden={mode !== 'practice'} /></div>
