import type { SubjectId } from './subjects';

/* Every tool on the site: one entry each. The cards, subject pages, unit map and stats all read from this list.

   href:
   - a standalone HTML simulation lives in public/<subject>/<slug>/index.html → href '/<subject>/<slug>/'
   - a tool built as an Astro page lives in src/pages/<subject>/<slug>.astro → same href pattern
   standalone: true for plain-HTML pages in public/ (they carry their own header and theme picker). */

export type ToolKind = 'Simulation' | 'Drill' | 'Reference' | 'Calculator';
export type ToolArt = 'tube' | 'sigil' | 'wave' | 'helix' | 'hex';

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
  standalone?: boolean;
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
    standalone: true,
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
    standalone: true,
    added: '2026-11-17',
  },
];

export const toolsFor = (subject: SubjectId) => TOOLS.filter((t) => t.subject === subject);
export const toolsForUnit = (code: string) => TOOLS.filter((t) => t.units.includes(code));
