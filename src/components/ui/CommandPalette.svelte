<script lang="ts">
  /* Global Command Palette (Ctrl+K / ⌘K or top-bar search button).
     Jump to any simulation, topic/sub-tab, past paper hub, or quick action. */
  import { onMount, tick } from 'svelte';
  import { TOOLS } from '../../data/tools';
  import { getPerf, setPerf, setPreset } from '../../lib/perf';
  import { getTheme, setTheme } from '../../lib/theme';

  interface CmdItem {
    id: string;
    title: string;
    sub: string;
    tag: string;
    keywords: string;
    href?: string;
    run?: () => void;
  }

  let open = $state(false);
  let q = $state('');
  let sel = $state(0);
  let inputEl = $state<HTMLInputElement>();

  const SUBTABS: Omit<CmdItem, 'id'>[] = [
    { title: 'VSEPR Shapes & Polarity', sub: 'Atoms & Bonding Lab', tag: 'Chem', keywords: 'vsepr bond angle lone pair dipole tetrahedral', href: '/chemistry/atoms-bonding-lab/#shapes' },
    { title: 'Quantum Orbitals & Electron Config', sub: 'Atoms & Bonding Lab', tag: 'Chem', keywords: 'orbitals s p d cr cu aufbau hunds', href: '/chemistry/atoms-bonding-lab/#orbitals' },
    { title: 'Ionisation Energies', sub: 'Atoms & Bonding Lab', tag: 'Chem', keywords: 'ionisation ie successive period 3', href: '/chemistry/atoms-bonding-lab/#ie' },
    { title: '3D Crystal Lattices', sub: 'Atoms & Bonding Lab', tag: 'Chem', keywords: 'lattice diamond graphite nacl metallic shear', href: '/chemistry/atoms-bonding-lab/#lattices' },
    { title: 'Intermolecular Forces', sub: 'Atoms & Bonding Lab', tag: 'Chem', keywords: 'imf hydrogen bonding london dispersion boiling point', href: '/chemistry/atoms-bonding-lab/#imf' },
    { title: '3D Mass Spectrometer', sub: 'Atoms & Bonding Lab', tag: 'Chem', keywords: 'mass spec isotope m/z fragmentation', href: '/chemistry/atoms-bonding-lab/#ms' },
    { title: 'Calorimetry & Cooling Curves', sub: 'Energetics Lab', tag: 'Chem', keywords: 'calorimetry cp2 q=mcdt enthalpy cooling curve', href: '/chemistry/energetics-lab/#calorimetry' },
    { title: 'Hess’s Law Cycles', sub: 'Energetics Lab', tag: 'Chem', keywords: 'hess formation combustion cycle', href: '/chemistry/energetics-lab/#hess' },
    { title: 'Born–Haber Staircase', sub: 'Energetics Lab', tag: 'Chem', keywords: 'born haber lattice energy polarisation covalent character', href: '/chemistry/energetics-lab/#bh' },
    { title: 'Entropy & Gibbs Free Energy (ΔG)', sub: 'Energetics Lab', tag: 'Chem', keywords: 'entropy gibbs dg dh tds feasible', href: '/chemistry/energetics-lab/#entropy' },
    { title: 'Maxwell–Boltzmann & Collisions', sub: 'Kinetics Lab', tag: 'Chem', keywords: 'maxwell boltzmann activation energy collision', href: '/chemistry/kinetics-lab/#collide' },
    { title: 'Rate Equations, Orders & Arrhenius', sub: 'Kinetics Lab', tag: 'Chem', keywords: 'orders half-life arrhenius rate constant', href: '/chemistry/kinetics-lab/#orders' },
    { title: 'SN1 & SN2 Mechanisms', sub: 'Kinetics Lab', tag: 'Chem', keywords: 'sn1 sn2 nucleophilic substitution rds', href: '/chemistry/kinetics-lab/#mechanism' },
    { title: 'Dynamic Equilibrium & Le Chatelier', sub: 'Kinetics Lab', tag: 'Chem', keywords: 'equilibrium kc kp le chatelier haber', href: '/chemistry/kinetics-lab/#equil' },
    { title: 'Organic Synthesis & Identification', sub: 'Carbon Alchemy', tag: 'Chem', keywords: 'organic synthesis reflux tollens fehling bromine', href: '/chemistry/carbon-alchemy/' },
    { title: 'Transition Metal Ion Bench', sub: 'd-Block Colour Bench', tag: 'Chem', keywords: 'transition metal ligand complex precipitate colour', href: '/chemistry/d-block-colour-bench/' },
    { title: 'Capacitor Discharge Lab', sub: 'Circuit Builder', tag: 'Phys', keywords: 'capacitor rc time constant exponential discharge', href: '/physics/circuit-builder/#capacitor' },
    { title: 'I–V Characteristics & Internal Resistance', sub: 'Circuit Builder', tag: 'Phys', keywords: 'iv diode filament lamp emf internal resistance', href: '/physics/circuit-builder/#iv' },
    { title: 'Standing Waves & Resonance', sub: 'Waves Lab', tag: 'Phys', keywords: 'standing wave harmonic node antinode cp5', href: '/physics/waves-lab/#standing' },
    { title: 'Diffraction Grating & de Broglie', sub: 'Waves Lab', tag: 'Phys', keywords: 'grating nlambda d sin theta electron diffraction', href: '/physics/waves-lab/#grating' },
    { title: 'Photoelectric Effect & Line Spectra', sub: 'Waves Lab', tag: 'Phys', keywords: 'photoelectric work function stopping potential photon', href: '/physics/waves-lab/#photon' },
    { title: 'Ripple Tank Interference', sub: 'Waves Lab', tag: 'Phys', keywords: 'ripple tank double slit huygens path difference', href: '/physics/waves-lab/#ripple' },
    { title: 'Linac & Cyclotron Accelerators', sub: 'Particle Lab', tag: 'Phys', keywords: 'accelerator linac cyclotron electron gun', href: '/physics/particle-lab/#accel' },
    { title: 'Cloud & Bubble Chamber Detectors', sub: 'Particle Lab', tag: 'Phys', keywords: 'detector magnetic track r=p/bq pair production', href: '/physics/particle-lab/#detect' },
    { title: 'Quarks, Leptons & Conservation Rules', sub: 'Particle Lab', tag: 'Phys', keywords: 'quark lepton baryon meson baryon number strangeness', href: '/physics/particle-lab/#zoo' },
    { title: 'HR Diagram & Star Life Cycle', sub: 'Star Lab', tag: 'Phys', keywords: 'hr diagram supernova white dwarf black hole cepheid', href: '/physics/star-lab/#life' },
    { title: 'Binary Stars & Eclipsing Curves', sub: 'Star Lab', tag: 'Phys', keywords: 'binary star doppler shift type ia', href: '/physics/star-lab/#binary' },
    { title: 'Hubble’s Law & Dark Matter', sub: 'Star Lab', tag: 'Phys', keywords: 'hubble redshift cosmology dark matter fate', href: '/physics/star-lab/#hubble' },
  ];

  const PAGES: Omit<CmdItem, 'id'>[] = [
    { title: 'Past Papers Hub', sub: 'Physics, Chemistry & Maths papers', tag: 'Papers', keywords: 'past papers mark schemes wph wch wma', href: '/papers/' },
    { title: 'Physics Past Papers & Mock Generator', sub: 'WPH11 – WPH16', tag: 'Papers', keywords: 'physics papers wph11 wph12 wph13 wph14 wph15 wph16 mock', href: '/papers/physics/' },
    { title: 'Chemistry Past Papers & Mock Generator', sub: 'WCH11 – WCH16', tag: 'Papers', keywords: 'chemistry papers wch11 wch12 wch13 wch14 wch15 wch16 mock', href: '/papers/chemistry/' },
    { title: 'Maths Past Papers & Mock Generator', sub: 'WMA, WFM, WME, WST, WDM', tag: 'Papers', keywords: 'maths papers wma11 wma12 wma13 wma14 pure mechanics stats mock', href: '/papers/maths/' },
    { title: 'Chemistry Hub', sub: 'All 5 Chemistry labs & unit map', tag: 'Hub', keywords: 'chemistry subject units', href: '/chemistry/' },
    { title: 'Physics Hub', sub: 'All 5 Physics labs & unit map', tag: 'Hub', keywords: 'physics subject units', href: '/physics/' },
  ];

  const ITEMS: CmdItem[] = [
    {
      id: 'act-booklet',
      title: 'Open Formula & Data Booklet',
      sub: 'Constants, equations, IR peaks & periodic table (Alt+B)',
      tag: 'Action',
      keywords: 'formula data booklet constants periodic table equations',
      run: () => window.dispatchEvent(new CustomEvent('arsenal-booklet')),
    },
    {
      id: 'act-progress',
      title: 'Open Revision Progress & Backup',
      sub: 'Scores across all 10 labs + JSON export/import',
      tag: 'Action',
      keywords: 'progress scores stats mastery export import backup',
      run: () => window.dispatchEvent(new CustomEvent('arsenal-progress')),
    },
    {
      id: 'act-eco',
      title: 'Switch to Eco / Battery Saver Mode',
      sub: 'Flat UI, no aurora, no bloom, 1× 3D, 30 fps',
      tag: 'Action',
      keywords: 'eco battery performance lag smooth fast potato',
      run: () => setPreset('eco'),
    },
    {
      id: 'act-full',
      title: 'Switch to Full Graphics Mode',
      sub: 'Liquid glass, aurora glow, 3D bloom, 60 fps',
      tag: 'Action',
      keywords: 'full graphics liquid glass bloom high quality',
      run: () => setPreset('full'),
    },
    {
      id: 'act-glass',
      title: 'Toggle Flat UI / Liquid Glass',
      sub: 'Switch translucent blur surfaces on or off',
      tag: 'Action',
      keywords: 'flat ui liquid glass blur',
      run: () => setPerf({ glass: !getPerf().glass }),
    },
    {
      id: 'act-mode',
      title: 'Toggle Light / Dark Mode',
      sub: 'Flip between light and dark theme',
      tag: 'Action',
      keywords: 'light dark theme appearance',
      run: () => setTheme({ mode: getTheme().effective === 'dark' ? 'light' : 'dark' }),
    },
    ...TOOLS.map((t) => ({
      id: `tool-${t.slug}`,
      title: t.title,
      sub: `${t.units.join(' · ')} — ${t.topics.slice(0, 3).join(', ')}`,
      tag: t.subject === 'chemistry' ? 'Chem' : 'Phys',
      keywords: `${t.title} ${t.subject} ${t.units.join(' ')} ${t.topics.join(' ')}`,
      href: t.href,
    })),
    ...SUBTABS.map((s, i) => ({ id: `sub-${i}`, ...s })),
    ...PAGES.map((p, i) => ({ id: `pg-${i}`, ...p })),
  ];

  const results = $derived.by(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return ITEMS.slice(0, 14);
    return ITEMS.filter((it) => {
      const hay = `${it.title} ${it.sub} ${it.tag} ${it.keywords}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    }).slice(0, 16);
  });

  $effect(() => { void results; sel = 0; });

  async function show() {
    open = true;
    q = '';
    sel = 0;
    await tick();
    inputEl?.focus();
  }

  function close() { open = false; }

  function pickItem(item: CmdItem) {
    close();
    if (item.run) item.run();
    else if (item.href) window.location.href = item.href;
  }

  function onInputKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); }
    else if (e.key === 'Enter' && results[sel]) { e.preventDefault(); pickItem(results[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open ? close() : show();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
</script>

<button
  class="perf-btn tool-icon cmd-trigger"
  type="button"
  aria-label="Quick search (Ctrl+K)"
  title="Quick jump (Ctrl+K / ⌘K)"
  onclick={show}
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
</button>

{#if open}
  <div class="modal-bg" role="presentation" onclick={close}>
    <div class="modal-box glass cmd-modal" role="dialog" aria-modal="true" aria-label="Quick search" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && close()}>
      <div class="cmd-in">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          bind:this={inputEl}
          type="search"
          bind:value={q}
          onkeydown={onInputKey}
          placeholder="Jump to a lab, topic, paper, or action…"
          aria-label="Search labs, topics, papers and actions"
        />
        <kbd>Esc</kbd>
      </div>

      <div class="cmd-list" role="listbox">
        {#each results as item, i (item.id)}
          <button
            type="button"
            class="cmd-row"
            class:sel={i === sel}
            role="option"
            aria-selected={i === sel}
            onmouseenter={() => (sel = i)}
            onclick={() => pickItem(item)}
          >
            <span class="cmd-txt">
              <b>{item.title}</b>
              <small>{item.sub}</small>
            </span>
            <span class="cmd-tag tag-{item.tag.toLowerCase()}">{item.tag}</span>
          </button>
        {:else}
          <p class="db-empty">No matches for “{q}”.</p>
        {/each}
      </div>

      <div class="cmd-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate · <kbd>↵</kbd> open</span>
        <span><kbd>Alt+B</kbd> data booklet</span>
      </div>
    </div>
  </div>
{/if}
