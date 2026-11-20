import type { SubjectId } from './subjects';

/* Every tool on the site: one entry each. The cards, subject pages, unit map and stats all read from this list.

   href: a tool lives at src/pages/<subject>/<slug>.astro and is served at '/<subject>/<slug>/'. */

export type ToolKind = 'Simulation' | 'Drill' | 'Reference' | 'Calculator';
export type ToolArt = 'tube' | 'sigil' | 'wave' | 'helix' | 'hex' | 'circuit' | 'projectile' | 'star';

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
];

export const toolsFor = (subject: SubjectId) => TOOLS.filter((t) => t.subject === subject);
export const toolsForUnit = (code: string) => TOOLS.filter((t) => t.units.includes(code));
