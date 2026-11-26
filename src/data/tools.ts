import type { SubjectId } from './subjects';

/* Every tool on the site: one entry each. The cards, subject pages, unit map and stats all read from this list.

   href: a tool lives at src/pages/<subject>/<slug>.astro and is served at '/<subject>/<slug>/'. */

export type ToolKind = 'Simulation' | 'Drill' | 'Reference' | 'Calculator';
export type ToolArt = 'tube' | 'sigil' | 'wave' | 'helix' | 'hex' | 'circuit' | 'projectile' | 'star' | 'atom' | 'ripple' | 'kinetics' | 'atoms' | 'energetics' | 'fields' | 'graph';

export interface Tool {
  slug: string;
  subject: SubjectId;
  title: string;
  blurb: string;
  kind: ToolKind;
  units: string[];        // unit codes from subjects.ts, e.g. ['WCH15']
  topics: string[];
  art: ToolArt;
  href: string;
  added: string;          // ISO date
}

export const TOOLS: Tool[] = [
  {
    slug: 'd-block-colour-bench',
    subject: 'chemistry',
    title: 'd-Block Colour Bench',
    blurb: 'Add reagents to transition-metal ions on the white tile and watch the colours, precipitates and complexes form. Predict outcomes and identify unknown ions.',
    kind: 'Simulation',
    units: ['WCH15', 'WCH16'],
    topics: ['Transition metals', 'Ligand exchange', 'Redox'],
    art: 'tube',
    href: '/chemistry/d-block-colour-bench/',
    added: '2026-11-17',
  },
  {
    slug: 'carbon-alchemy',
    subject: 'chemistry',
    title: 'Carbon Alchemy',
    blurb: 'Discover organic reactions by combining compounds and reagents in a transmutation circle. Plan synthesis routes, run identification tests and drill the codex.',
    kind: 'Simulation',
    units: ['WCH15', 'WCH16'],
    topics: ['Organic synthesis', 'Identification tests', 'Mechanisms'],
    art: 'sigil',
    href: '/chemistry/carbon-alchemy/',
    added: '2026-11-17',
  },
  {
    slug: 'kinetics-lab',
    subject: 'chemistry',
    title: 'Kinetics Lab',
    blurb: 'Every kinetics and equilibria idea in Units 2 and 4, in 3D: collisions and the Maxwell–Boltzmann distribution, catalysts and reaction profiles, measuring rates, rate equations, orders and half-life, rate-determining steps and SN1/SN2, dynamic equilibrium and Le Chatelier, Kc and Kp, and the industrial compromise. Core Practicals 9a, 9b and 10 included.',
    kind: 'Simulation',
    units: ['WCH12', 'WCH14', 'WCH16'],
    topics: ['Collision theory', 'Maxwell–Boltzmann', 'Catalysts', 'Rate equations', 'Half-life', 'Arrhenius', 'Mechanisms', 'Le Chatelier', 'Kc and Kp', 'ΔS = R ln K'],
    art: 'kinetics',
    href: '/chemistry/kinetics-lab/',
    added: '2026-11-22',
  },
  {
    slug: 'atoms-bonding-lab',
    subject: 'chemistry',
    title: 'Atoms & Bonding Lab',
    blurb: 'Structure, bonding and periodicity in 3D: VSEPR shapes, lone-pair repulsion and dipoles, quantum orbital clouds and electron-in-box filling (with Cr/Cu exceptions and ions), first and successive ionisation energies, 3D crystal lattices with shear tests, intermolecular forces and boiling-point trends, and a 3D mass spectrometer.',
    kind: 'Simulation',
    units: ['WCH11', 'WCH12'],
    topics: ['VSEPR shapes', 'Electronegativity & polarity', 'Orbitals & electron config', 'Ionisation energy', 'Crystal lattices', 'Intermolecular forces', 'Mass spectrometry'],
    art: 'atoms',
    href: '/chemistry/atoms-bonding-lab/',
    added: '2026-11-24',
  },
  {
    slug: 'energetics-lab',
    subject: 'chemistry',
    title: 'Energetics Lab',
    blurb: 'Thermodynamics and energetics across Units 2 and 4 in 3D: calorimetry with cooling-curve extrapolation, Hess’s law cycles (Core Practical 2), mean bond enthalpies, a 3D Born–Haber staircase with covalent-character polarisation, and entropy & ΔG = ΔH − TΔS feasibility.',
    kind: 'Simulation',
    units: ['WCH12', 'WCH13', 'WCH14'],
    topics: ['Calorimetry', 'Cooling curves', 'Hess’s law', 'Mean bond enthalpies', 'Born–Haber cycles', 'Lattice energy', 'Polarisation', 'Entropy', 'Gibbs free energy'],
    art: 'energetics',
    href: '/chemistry/energetics-lab/',
    added: '2026-11-24',
  },
  {
    slug: 'circuit-builder',
    subject: 'physics',
    title: 'Circuit Builder',
    blurb: 'Wire up cells, resistors, lamps, diodes, sensors, capacitors and meters on a live board and watch the charge flow. Predict meter readings, plot I–V characteristics and time a capacitor discharge.',
    kind: 'Simulation',
    units: ['WPH12', 'WPH13', 'WPH14', 'WPH16'],
    topics: ['Electric circuits', 'Potential dividers', 'E.m.f. and internal resistance', 'I–V characteristics', 'Capacitors'],
    art: 'circuit',
    href: '/physics/circuit-builder/',
    added: '2026-11-17',
  },
  {
    slug: 'projectile-lab',
    subject: 'physics',
    title: 'Projectile Lab',
    blurb: 'Launch projectiles from the ground or a cliff and watch their strobe images, shadows and velocity components. Answer exam-style questions drawn to scale and land shots on targets.',
    kind: 'Simulation',
    units: ['WPH11'],
    topics: ['Projectile motion', 'SUVAT equations', 'Resolving vectors', 'Motion graphs'],
    art: 'projectile',
    href: '/physics/projectile-lab/',
    added: '2026-11-18',
  },
  {
    slug: 'star-lab',
    subject: 'physics',
    title: 'Star Lab',
    blurb: 'Follow a star of any mass in 3D from collapsing nebula to brown dwarf, white dwarf, neutron star or black hole, through blue supergiants and pulsing Cepheids, with its path on the HR diagram. Watch binary stars eclipse and Doppler-shift, then measure distances by parallax, standard candles and redshift.',
    kind: 'Simulation',
    units: ['WPH15'],
    topics: ['Life cycle of stars', 'HR diagram', 'Cepheid variables', 'Binary stars', 'Black-body radiation', 'Parallax and standard candles', 'Redshift and Hubble’s law', 'Dark matter'],
    art: 'star',
    href: '/physics/star-lab/',
    added: '2026-11-21',
  },
  {
    slug: 'particle-lab',
    subject: 'physics',
    title: 'Particle Lab',
    blurb: 'Accelerate electrons, protons and α particles in an electron gun, a linac and a cyclotron in 3D, read the tracks in cloud and bubble chambers, and fire α particles at gold. Explore every quark, lepton, baryon and meson in a particle table, build hadrons from quarks, check reactions against the conservation laws, and watch annihilation and pair production turn mass into energy and back.',
    kind: 'Simulation',
    units: ['WPH14'],
    topics: ['Particle accelerators', 'Particle detectors', 'r = p/BQ', 'Alpha-particle scattering', 'Quarks and leptons', 'Baryons and mesons', 'Antiparticles', 'Annihilation and pair production', 'Conservation laws', 'E = mc² and MeV'],
    art: 'atom',
    href: '/physics/particle-lab/',
    added: '2026-11-21',
  },
  {
    slug: 'waves-lab',
    subject: 'physics',
    title: 'Waves Lab',
    blurb: 'Every wave idea in Unit 2, in 3D: transverse and longitudinal waves, phase and path difference, interference and Huygens diffraction in a ripple tank, standing waves on a string, refraction, total internal reflection and polarisation, the diffraction grating and electron diffraction, pulse–echo, the photoelectric effect and line spectra. Core Practicals 4, 5 and 6 included.',
    kind: 'Simulation',
    units: ['WPH12', 'WPH13'],
    topics: ['v = fλ', 'Transverse and longitudinal', 'Superposition and interference', 'Standing waves', 'Refraction and TIR', 'Polarisation', 'Diffraction grating', 'de Broglie', 'Pulse–echo', 'Photoelectric effect', 'Line spectra'],
    art: 'ripple',
    href: '/physics/waves-lab/',
    added: '2026-11-22',
  },
  {
    slug: 'fields-lab',
    subject: 'physics',
    title: 'Fields Lab',
    blurb: 'Electric, magnetic and gravitational fields in 3D: radial dipoles, equipotentials and parallel plates (E = V/d), Fleming’s Left-Hand Rule (F = BIL sin θ), circular charged-particle tracks (r = mv/BQ) and velocity selectors (v = E/B), Faraday and Lenz electromagnetic induction, and a 3D gravitational potential well.',
    kind: 'Simulation',
    units: ['WPH14', 'WPH15'],
    topics: ['Electric fields', 'Equipotentials', 'F = BIL sin θ', 'Fleming’s Left-Hand Rule', 'r = mv/BQ', 'Velocity selector', 'Faraday & Lenz', 'AC generator', 'Gravitational fields'],
    art: 'fields',
    href: '/physics/fields-lab/',
    added: '2026-11-24',
  },
];

export const toolsFor = (subject: SubjectId) => TOOLS.filter((t) => t.subject === subject);
export const toolsForUnit = (code: string) => TOOLS.filter((t) => t.units.includes(code));
