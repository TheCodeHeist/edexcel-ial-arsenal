/* Kernel's tools: what it can do on the site beyond talking. A small, MCP-style registry: each tool has a name, a
   description the model reads, a JSON Schema for its arguments, and a handler that runs in the browser.
   To add one, add an entry to TOOLS; the model is told about it automatically, and CAPABILITIES (shown to the
   model and to students who ask "what can you do?") lists it by its `label`.

   Data comes from two static files built with the site: /kernel/index.json (every paper, topic, unit and lab) and
   /kernel/paper/<id>.json (one paper's questions, with the images Kernel needs to see them). */

import type { ToolDef, ToolResult } from '../ai';
import type { KContext } from './store.svelte';
import { liveTools, findLiveTool, runLiveTool } from './live';
import { pick, toQuery, newSeed, type MockPool } from '../papers/mock';

/** What a tool may do to Kernel and the page. Supplied by the store for each answer. */
export interface ToolHost {
  /** put a question in front of Kernel: it becomes the chat's question, with its images */
  setContext(c: KContext): void;
  /** go to a page on the site once the answer has finished */
  navigate(path: string): void;
  /** a short line shown in the chat, so the student can see what Kernel did */
  note(label: string): void;
}

interface Tool extends ToolDef {
  label: string; // what it lets Kernel do, for the capabilities list
  run(args: Record<string, unknown>, host: ToolHost): Promise<ToolResult>;
}

/* ---------- data ---------- */

interface Index {
  papers: { id: string; subject: string; unit: string; series: string; year: number; href: string; questions: number; checked: number }[];
  topics: { subject: string; id: string; unit: string; group: string; short: string; text: string; href: string | null; parts: number; recent: string[] }[];
  units: { subject: string; code: string; badge: string; title: string }[];
  tools: { title: string; subject: string; kind: string; blurb: string; href: string; units: string[]; topics: string[] }[];
}
interface PaperFile {
  id: string; unit: string; unitTitle?: string; series: string; totalMarks: number; durationMin: number;
  questions: { number: number; marks: number; checked: boolean; parts: { label: string; marks: number; kind: string; topics: string[] }[]; context: KContext | null }[];
}

let indexP: Promise<Index> | null = null;
const getIndex = () => (indexP ??= fetch('/kernel/index.json').then((r) => {
  if (!r.ok) throw new Error('could not load the site index');
  return r.json() as Promise<Index>;
}).catch((e) => { indexP = null; throw e; }));

const papersCache = new Map<string, Promise<PaperFile>>();
const getPaper = (id: string) => {
  if (!papersCache.has(id)) {
    papersCache.set(id, fetch(`/kernel/paper/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`no paper called ${id}`);
      return r.json() as Promise<PaperFile>;
    }).catch((e) => { papersCache.delete(id); throw e; }));
  }
  return papersCache.get(id)!;
};

/* ---------- helpers ---------- */

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const words = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9.]+/g, ' ').split(' ').filter((w) => w.length > 1);
/** a query word matches a word in the text: the same, or one a form of the other (quadratic/quadratics, integrate/integration) */
const hit = (q: string, h: string) => h === q || (Math.min(q.length, h.length) >= 4 && (h.startsWith(q) || q.startsWith(h) || h.slice(0, 6) === q.slice(0, 6)));
const MONTH: Record<string, string> = { jan: 'January', january: 'January', jun: 'June', june: 'June', may: 'June', oct: 'October', october: 'October', nov: 'October' };
const SUBJECT = { type: 'string', enum: ['physics', 'chemistry', 'maths'], description: 'Subject, if known' };

/** Finds papers from loose words: "WPH11 Jan 2019", "physics unit 1 2019", or an exact id like WPH11_2019_01. */
function matchPapers(idx: Index, a: Record<string, unknown>) {
  const subject = str(a.subject).toLowerCase();
  const unit = str(a.unit).toUpperCase().replace(/\s+/g, '');
  const year = parseInt(str(a.year), 10);
  const month = MONTH[str(a.month).toLowerCase().slice(0, 3)] ?? MONTH[str(a.month).toLowerCase()] ?? '';
  return idx.papers
    .filter((p) => (!subject || p.subject === subject)
      && (!unit || p.unit === unit || p.unit.endsWith(unit) || p.id === unit)
      && (!year || p.year === year)
      && (!month || p.series.startsWith(month)))
    .sort((x, y) => y.year - x.year || y.series.localeCompare(x.series));
}

/* ---------- the tools ---------- */

export const TOOLS: Tool[] = [
  {
    name: 'current_page',
    label: 'see which page you are on (a past paper, a topic, a lab)',
    description: 'What page of the site the student is looking at right now, and which past paper or topic it is if any. Use this when the student says "this question", "this paper" or "this page".',
    parameters: { type: 'object', properties: {} },
    async run() {
      const path = location.pathname;
      const paper = /^\/papers\/(physics|chemistry|maths)\/([a-z0-9_]+)\/?$/.exec(path);
      const topic = /^\/papers\/(physics|chemistry|maths)\/topics\/([^/]+)\/?$/.exec(path);
      const lines = [`Page: ${document.title} (${path})`];
      if (paper) lines.push(`This is a past paper: id ${paper[2].toUpperCase()}. Use open_question with this id to look at one of its questions.`);
      if (topic) lines.push(`This is a topic page: ${topic[1]} in ${topic[2]}. Use find_topic_questions to see its questions.`);
      if (location.hash) lines.push(`Scrolled to: ${location.hash}`);
      return { text: lines.join('\n') };
    },
  },
  {
    name: 'find_papers',
    label: 'find past papers by subject, unit, year and series',
    description: 'Search the site\'s Edexcel IAL past papers. All filters are optional. Returns paper ids (for open_question) and links.',
    parameters: {
      type: 'object',
      properties: {
        subject: SUBJECT,
        unit: { type: 'string', description: 'Unit code, e.g. WPH11, WCH14, WMA11' },
        year: { type: 'integer', description: 'e.g. 2019' },
        month: { type: 'string', description: 'Series month: January, June or October' },
      },
    },
    async run(a, host) {
      const idx = await getIndex();
      const found = matchPapers(idx, a);
      host.note(`Searched past papers${a.unit ? ` · ${str(a.unit).toUpperCase()}` : ''}${a.year ? ` · ${str(a.year)}` : ''}`);
      if (!found.length) return { text: `No papers match. Units available: ${[...new Set(idx.papers.map((p) => p.unit))].join(', ')}.` };
      return {
        text: `${found.length} paper(s), newest first${found.length > 25 ? ' (first 25 shown)' : ''}:\n` +
          found.slice(0, 25).map((p) => `- ${p.id}: ${p.unit} ${p.series}, ${p.checked}/${p.questions} questions on the site, ${p.href}`).join('\n'),
      };
    },
  },
  {
    name: 'open_question',
    label: 'open any past-paper question (with its mark scheme) and read it',
    description: 'Load one question of a past paper so you can see it and its official mark scheme as images, and show it to the student in the chat. Use the paper id from find_papers or current_page (e.g. WPH11_2019_01).',
    parameters: {
      type: 'object',
      properties: {
        paper_id: { type: 'string', description: 'Paper id, e.g. WPH11_2019_01' },
        question: { type: 'integer', description: 'Question number' },
      },
      required: ['paper_id', 'question'],
    },
    async run(a, host) {
      let id = str(a.paper_id).toUpperCase().replace(/\s+/g, '_');
      const n = parseInt(str(a.question), 10);
      const idx = await getIndex();
      if (!idx.papers.some((p) => p.id === id)) {
        // be forgiving: "WPH11 Jan 2019"
        const m = /^([A-Z]{3}\d{2})\W*([A-Z]*)\W*(\d{4})?/.exec(id.replace(/_/g, ' '));
        const guess = m ? matchPapers(idx, { unit: m[1], month: m[2], year: m[3] })[0] : undefined;
        if (!guess) return { text: `There is no paper ${id}. Use find_papers to get the right id.` };
        id = guess.id;
      }
      const paper = await getPaper(id);
      const q = paper.questions.find((x) => x.number === n);
      if (!q) return { text: `${id} has questions 1 to ${paper.questions.length}; there is no question ${n}.` };
      const href = idx.papers.find((p) => p.id === id)?.href ?? '';
      if (!q.checked || !q.context) {
        host.note(`${paper.unit} ${paper.series} Q${n} isn't on the site yet`);
        return { text: `Question ${n} of ${id} is still being checked, so it isn't on the site yet. The student can read it in the original paper linked from ${href}.` };
      }
      host.setContext(q.context);
      host.note(`Opened ${q.context.title}`);
      return {
        text: `Loaded ${q.context.title}, ${q.marks} marks. Parts: ${q.parts.map((x) => `${x.label} (${x.marks})`).join(', ')}. The images are the question then its mark scheme. Link: ${q.context.href}`,
        images: [...q.context.qp, ...q.context.ms],
      };
    },
  },
  {
    name: 'find_topic_questions',
    label: 'find past-paper questions on any spec topic',
    description: 'Find specification topics matching some words (e.g. "moments", "Hess cycle", "integration by parts") and the past-paper questions tagged with them. Returns topic page links and recent question references like "WPH11_2019_01 Q3 3(b)" (open one with open_question).',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'What the topic is about' }, subject: SUBJECT },
      required: ['query'],
    },
    async run(a, host) {
      const idx = await getIndex();
      const q = words(str(a.query));
      const subject = str(a.subject).toLowerCase();
      const scored = idx.topics
        .filter((t) => !subject || t.subject === subject)
        .map((t) => {
          const hay = words(`${t.short} ${t.text} ${t.group}`), short = words(t.short);
          const score = q.reduce((n, w) => n + (short.some((h) => hit(w, h)) ? 3 : hay.some((h) => hit(w, h)) ? 1 : 0), 0);
          return { t, score };
        })
        .filter((x) => x.score > 0)
        .sort((x, y) => y.score - x.score || y.t.parts - x.t.parts)
        .slice(0, 6);
      host.note(`Looked up topics: “${str(a.query)}”`);
      if (!scored.length) return { text: 'No topic matches those words. Try other words for it.' };
      return {
        text: scored.map(({ t }) => `- ${t.subject} ${t.unit} · ${t.short} (spec ${t.id}): ${t.text}\n  ${t.parts} question part(s)${t.href ? `, all at ${t.href}` : ''}${t.recent.length ? `\n  recent: ${t.recent.join('; ')}` : ''}`).join('\n'),
      };
    },
  },
  {
    name: 'find_labs',
    label: 'suggest the site\'s interactive labs, simulations and drills',
    description: 'List the site\'s interactive tools (simulations, drills, references), optionally for a subject or matching some words. Recommend one when it would help the student understand something.',
    parameters: { type: 'object', properties: { subject: SUBJECT, query: { type: 'string', description: 'Words to match, optional' } } },
    async run(a, host) {
      const idx = await getIndex();
      const subject = str(a.subject).toLowerCase();
      const q = words(str(a.query));
      const list = idx.tools
        .filter((t) => !subject || t.subject === subject)
        .map((t) => ({ t, score: q.length ? q.filter((w) => words(`${t.title} ${t.blurb} ${t.topics.join(' ')}`).some((h) => h.startsWith(w))).length : 1 }))
        .filter((x) => x.score > 0)
        .sort((x, y) => y.score - x.score);
      host.note('Looked through the labs');
      if (!list.length) return { text: 'No lab matches. All labs: ' + idx.tools.map((t) => t.title).join(', ') };
      return { text: list.map(({ t }) => `- ${t.title} (${t.subject} ${t.kind}, ${t.units.join('/')}): ${t.blurb} ${t.href}`).join('\n') };
    },
  },
  {
    name: 'build_mock',
    label: 'build a mock paper (any unit, length and topics) and open it',
    description: 'Build a timed mock paper from real past-paper questions with the site\'s own mock builder, and open it for the student (it opens when your answer finishes). Use this whenever the student asks for a mock, practice paper or set of questions to sit. Unit can be a code (WPH14) or a unit number/badge with the subject (subject physics, unit "4"; maths "P1"–"P4", "S1", "M1", "D1", "FP1"). The result says which unit was built: tell the student that, and never say you built a mock unless this tool returned "Built".',
    parameters: {
      type: 'object',
      properties: {
        subject: SUBJECT,
        unit: { type: 'string', description: 'Unit code like WPH14, or its number/badge like 4, P1, S2' },
        length: { type: 'string', enum: ['quick', 'half', 'full'], description: 'quick ≈ 20 marks, half = half a paper, full = a whole paper. Default half.' },
        marks: { type: 'integer', description: 'Exact number of marks instead of length, optional' },
        topics: { type: 'array', items: { type: 'string' }, description: 'Optional topics to focus on, in words ("moments", "electric fields") or spec ids' },
        include_mcq: { type: 'boolean', description: 'Include multiple-choice questions (default true)' },
      },
      required: ['unit'],
    },
    async run(a, host) {
      const idx = await getIndex();
      const said = str(a.unit).toLowerCase();
      const subject = str(a.subject).toLowerCase() || (/math|pure|stat|mechanic|decision|further/.test(said) ? 'maths' : /physics/.test(said) ? 'physics' : /chem/.test(said) ? 'chemistry' : '');
      // "Maths P4", "Physics unit 4", "U4" → "P4", "4"
      const u = str(a.unit).toUpperCase().replace(/\b(PURE\s+)?MATH(S|EMATICS)?\b|\bFURTHER\b|\bPHYSICS\b|\bCHEMISTRY\b|\bSTAT(S|ISTICS)?\b|\bMECHANICS\b|\bDECISION\b/g, '')
        .replace(/^\s*(UNIT|U)\s*/, '').replace(/\s+/g, '');
      if (!u) return { text: 'Say which unit: a code like WMA14, or the subject and unit, e.g. subject maths, unit "P4".' };
      // an exact code wins; then a badge (P4, S1, 4) in the subject given, then in any subject if that was wrong (P4 is
      // only ever maths); a bare number shared by several subjects is asked about rather than guessed
      const by = (list: typeof idx.units) => list.filter((x) => x.badge.toUpperCase() === u || x.code.endsWith(u));
      const inSub = idx.units.filter((x) => !subject || x.subject === subject);
      const exact = idx.units.find((x) => x.code === u);
      const cands = exact ? [exact] : by(inSub).length ? by(inSub) : by(idx.units);
      if (cands.length > 1) return { text: `"${str(a.unit)}" could be ${cands.map((x) => `${x.code} (${x.subject} ${x.badge}: ${x.title})`).join(', ')}. Call build_mock again with the unit code the student means, or ask them.` };
      const unit = cands[0];
      if (!unit) return { text: `No unit "${str(a.unit)}"${subject ? ` in ${subject}` : ''}. Units: ${idx.units.filter((x) => !subject || x.subject === subject).map((x) => `${x.code} (${x.badge}: ${x.title})`).join(', ')}.` };
      const res = await fetch(`/papers/${unit.subject}/mock/${unit.code}.json`);
      if (!res.ok) return { text: `There are no checked questions for ${unit.code} yet, so no mock can be made for it.` };
      const pool = (await res.json()) as MockPool;
      const len = str(a.length) || 'half';
      const marks = Math.max(1, Math.round(Number(a.marks) || (len === 'quick' ? Math.min(20, pool.paperMarks) : len === 'full' ? pool.paperMarks : pool.paperMarks / 2)));
      // topics: spec ids as given, or the best-matching spec point for each phrase
      const topics: string[] = [];
      const unmatched: string[] = [];
      for (const t of Array.isArray(a.topics) ? a.topics.map(str).filter(Boolean) : []) {
        const own = idx.topics.filter((x) => x.subject === unit.subject);
        const exact = own.find((x) => x.id === t);
        if (exact) { topics.push(exact.id); continue; }
        const w = words(t);
        const score = (x: (typeof own)[number]) => w.reduce((n, q) => n + (words(x.short).some((h) => hit(q, h)) ? 3 : words(`${x.text} ${x.group}`).some((h) => hit(q, h)) ? 1 : 0), 0);
        // the chosen unit's own topics first; other units' only if none of its own match
        const rank = (list: typeof own) => list.map((x) => ({ x, score: score(x) })).filter((m) => m.score >= 1).sort((p, q) => q.score - p.score)[0];
        const best = rank(own.filter((x) => x.unit === unit.code)) ?? rank(own);
        if (best) topics.push(best.x.id); else unmatched.push(t);
      }
      const o = { unit: unit.code, marks, topics: [...new Set(topics)], mcq: a.include_mcq !== false, seed: newSeed() };
      const qs = pick(pool, o);
      if (!qs.length) return { text: `No checked ${unit.code} questions match those topics yet.${unmatched.length ? ` (No topic matched: ${unmatched.join(', ')}.)` : ''} Try fewer or broader topics.` };
      const path = `/papers/${unit.subject}/mock/?${toQuery(o)}`;
      const total = qs.reduce((n, q) => n + q.marks, 0);
      host.navigate(path);
      host.note(`Built a ${unit.code} mock · ${total} marks`);
      return {
        text: `Built a ${unit.code} (${unit.title}) mock: ${qs.length} questions, ${total} marks, about ${Math.round(total * pool.minutesPerMark)} minutes. It opens at ${path} when you finish, with a timer and the mark schemes at the end.\n` +
          qs.map((q) => `- ${q.source} Q${q.number} (${q.marks} marks)`).join('\n') +
          (o.topics.length ? `\nTopics: ${o.topics.map((id) => idx.topics.find((x) => x.subject === unit.subject && x.id === id)?.short ?? id).join(', ')}` : '') +
          (unmatched.length ? `\nNo topic matched: ${unmatched.join(', ')}` : '') +
          '\nKeep your answer short: say what you built and wish them luck. Don\'t list the questions again.',
      };
    },
  },
  {
    name: 'open_page',
    label: 'take you to a page: a paper, a topic, a lab',
    description: 'Take the student to a page on this site (a path starting with /, from another tool\'s results). Not for mock papers: use build_mock. It opens when your answer finishes, and the chat stays open. Only do this when the student wants to go there.',
    parameters: { type: 'object', properties: { path: { type: 'string', description: 'e.g. /papers/physics/wph11_2019_01/#q3' } }, required: ['path'] },
    async run(a, host) {
      const path = str(a.path);
      if (!/^\/(?!\/)[\w\-./#%?=&]*$/.test(path)) return { text: 'That is not a page on this site. Use a path from another tool, starting with /.' };
      // a mock is only real when build_mock picked its questions; a hand-made mock link opens some other paper
      if (/\/mock\/?(?:[?#]|$)/.test(path)) return { text: 'Do not open mock pages directly: nothing has been built yet. Call build_mock with the unit (e.g. "WMA14" or subject maths, unit "P4"), the length and any topics; it builds the mock and opens it.' };
      host.navigate(path);
      host.note(`Opening ${path}`);
      return { text: `The page ${path} will open when you finish this answer. Keep your answer short.` };
    },
  },
  {
    name: 'open_formula_booklet',
    label: 'open the formula booklet and data tables',
    description: 'Open the site\'s formula and data booklet over the page (the IAL physics/chemistry data booklet, or the maths formula book and statistical tables).',
    parameters: { type: 'object', properties: { subject: SUBJECT } },
    async run(a, host) {
      window.dispatchEvent(new CustomEvent('arsenal-booklet', str(a.subject).toLowerCase() === 'maths' ? { detail: 'maths' } : undefined));
      host.note('Opened the formula booklet');
      return { text: 'The booklet is now open over the page.' };
    },
  },
];

/* ---------- driving the page like a person would ---------- */

/* read_screen numbers the controls it reports (data-kx-ref); click and set_value act on those numbers. Kernel's own
   window is never included, and nothing outside this site can be reached. */
const SKIP = '#kernel-panel, .kx-fab, .kx-scrim, [aria-hidden="true"], [inert]';
const CONTROLS = 'button, a[href], input, select, textarea, summary, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="slider"], [role="option"], [role="menuitem"], [tabindex]:not([tabindex="-1"])';
const RISKY = /\b(delete|reset|clear|erase|remove all|wipe|sign out|log ?out)\b/i;
let refs = new Map<number, Element>();

function visible(el: Element) {
  if (el.closest(SKIP)) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05;
}
function nameOf(el: Element): string {
  const h = el as HTMLElement;
  const label = el.getAttribute('aria-label') || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent)
    || el.closest('label')?.textContent || h.innerText || el.getAttribute('title') || el.getAttribute('placeholder') || el.getAttribute('alt') || '';
  return label.replace(/\s+/g, ' ').trim().slice(0, 80);
}
function describe(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role') || (tag === 'a' ? 'link' : tag === 'select' ? 'dropdown' : tag === 'input' ? `${(el as HTMLInputElement).type || 'text'} input` : tag === 'summary' ? 'expander' : tag === 'textarea' ? 'text box' : 'button');
  const bits: string[] = [];
  for (const a of ['aria-pressed', 'aria-selected', 'aria-checked', 'aria-expanded']) {
    const v = el.getAttribute(a);
    if (v === 'true') bits.push(a.slice(5));
  }
  if ((el as HTMLInputElement).disabled || el.getAttribute('aria-disabled') === 'true') bits.push('disabled');
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked) bits.push('checked'); }
    else bits.push(`value=${JSON.stringify(el.value)}${el.type === 'range' || el.type === 'number' ? ` (min ${el.min || '?'}, max ${el.max || '?'}, step ${el.step || 'any'})` : ''}`);
  }
  if (el instanceof HTMLSelectElement) bits.push(`value=${JSON.stringify(el.value)}; options: ${[...el.options].map((o) => o.text.trim()).slice(0, 25).join(' | ')}`);
  if (el.getAttribute('role') === 'slider') bits.push(`value=${el.getAttribute('aria-valuenow') ?? '?'} (min ${el.getAttribute('aria-valuemin') ?? '?'}, max ${el.getAttribute('aria-valuemax') ?? '?'})`);
  if (el instanceof HTMLAnchorElement) bits.push(`→ ${el.getAttribute('href')}`);
  const r = el.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) bits.push('off screen');
  return `${role} "${nameOf(el)}"${bits.length ? ` (${bits.join(', ')})` : ''}`;
}
function byRef(a: Record<string, unknown>): HTMLElement {
  const n = parseInt(str(a.ref), 10);
  const el = refs.get(n);
  if (!el || !el.isConnected) throw new Error(`No control [${str(a.ref)}] on screen any more. Call read_screen again to get fresh numbers.`);
  return el as HTMLElement;
}
const settle = (ms = 350) => new Promise((r) => setTimeout(r, ms));

const DOM_TOOLS: Tool[] = [
  {
    name: 'read_screen',
    label: 'see what is on the page and use its buttons, tabs, sliders and menus',
    description: 'Read the page the student has open: its headings, any status text, and every visible control (buttons, tabs, links, sliders, inputs, dropdowns) numbered like [12]. Use the numbers with click and set_value. Call it again after acting, since the page changes. Use the lab-specific tools instead when the page offers them.',
    parameters: { type: 'object', properties: { contains: { type: 'string', description: 'Optional: only list controls whose label contains this text' } } },
    async run(a, host) {
      refs = new Map();
      const filter = str(a.contains).toLowerCase();
      const lines = [`Page: ${document.title} (${location.pathname})`];
      const heads = [...document.querySelectorAll('h1, h2, h3, [role="status"], [aria-live], .statusbar .sb-l')]
        .filter(visible).map((h) => (h as HTMLElement).innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 25);
      if (heads.length) lines.push('Headings and status:', ...heads.map((h) => `  ${h}`));
      lines.push('Controls:');
      let n = 0;
      for (const el of document.querySelectorAll(CONTROLS)) {
        if (!visible(el)) continue;
        const d = describe(el);
        if (filter && !d.toLowerCase().includes(filter)) continue;
        refs.set(++n, el);
        el.setAttribute('data-kx-ref', String(n));
        lines.push(`  [${n}] ${d}`);
        if (n >= 220) { lines.push('  … (more; pass `contains` to narrow it down)'); break; }
      }
      host.note('Read the screen');
      return { text: lines.join('\n') };
    },
  },
  {
    name: 'click',
    label: '',
    description: 'Click a control from read_screen by its number, exactly as the student would. Controls that delete, reset or clear things need confirm: true, and only when the student explicitly asked for that.',
    parameters: { type: 'object', properties: { ref: { type: 'integer' }, confirm: { type: 'boolean' } }, required: ['ref'] },
    async run(a, host) {
      const el = byRef(a);
      const name = nameOf(el) || el.tagName.toLowerCase();
      if (RISKY.test(name) && a.confirm !== true) return { text: `"${name}" would delete or reset something. Only click it with confirm: true if the student clearly asked for that.` };
      if (el instanceof HTMLAnchorElement && el.href && new URL(el.href, location.href).origin !== location.origin) return { text: 'That link leaves the site; give the student the link instead.' };
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await settle(200);
      el.focus({ preventScroll: true });
      el.click();
      host.note(`Clicked “${name}”`);
      await settle();
      return { text: `Clicked "${name}". Call read_screen to see the result.` };
    },
  },
  {
    name: 'set_value',
    label: '',
    description: 'Set a slider, number/text input, checkbox or dropdown from read_screen to a value (for a dropdown, the option text or value; for a checkbox, true/false).',
    parameters: { type: 'object', properties: { ref: { type: 'integer' }, value: { type: 'string' } }, required: ['ref', 'value'] },
    async run(a, host) {
      const el = byRef(a);
      const v = str(a.value);
      const name = nameOf(el) || 'control';
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (el instanceof HTMLSelectElement) {
        const opt = [...el.options].find((o) => o.value === v || o.text.trim().toLowerCase() === v.toLowerCase())
          ?? [...el.options].find((o) => o.text.toLowerCase().includes(v.toLowerCase()));
        if (!opt) throw new Error(`No option "${v}". Options: ${[...el.options].map((o) => o.text.trim()).join(' | ')}`);
        el.value = opt.value;
      } else if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
        const want = /^(true|1|yes|on|checked)$/i.test(v);
        if (el.checked !== want) el.click();
        host.note(`Set “${name}” to ${want ? 'on' : 'off'}`);
        return { text: `"${name}" is now ${el.checked ? 'on' : 'off'}.` };
      } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        let val = v;
        if (el instanceof HTMLInputElement && (el.type === 'range' || el.type === 'number')) {
          const x = parseFloat(v);
          if (!Number.isFinite(x)) throw new Error('That control needs a number.');
          const lo = el.min ? parseFloat(el.min) : -Infinity, hi = el.max ? parseFloat(el.max) : Infinity;
          val = String(Math.min(hi, Math.max(lo, x)));
        }
        // the native setter, so frameworks that watch the element see a real change
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, val);
      } else if (el.getAttribute('role') === 'slider') {
        throw new Error('That slider is drawn by the page; use the arrow keys via click on the nearby buttons, or the lab\'s own tools.');
      } else {
        throw new Error('That control has no value to set; use click instead.');
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      host.note(`Set “${name}” to ${v}`);
      await settle();
      return { text: `Set "${name}" to ${(el as HTMLInputElement).value}.` };
    },
  },
];
TOOLS.push(...DOM_TOOLS);

export const TOOL_DEFS: ToolDef[] = TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters }));

/** Plain-language list of what Kernel can do, for the system prompt. */
export const CAPABILITIES = TOOLS.filter((t) => t.label).map((t) => `- ${t.label}`).join('\n');

/** Site-wide tools plus whatever the open lab offers right now. */
export function allToolDefs(): { defs: ToolDef[]; about: string[] } {
  const live = liveTools();
  return { defs: [...TOOL_DEFS, ...live.defs], about: live.about };
}

export async function runTool(name: string, args: Record<string, unknown>, host: ToolHost): Promise<ToolResult> {
  const t = TOOLS.find((x) => x.name === name);
  if (t) return t.run(args, host);
  const lt = findLiveTool(name);
  if (lt) {
    const r = await runLiveTool(lt, args);
    host.note(name.replace(/^[a-z]+_/, '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) + (r.text.startsWith("That didn't work") ? ' (failed)' : ''));
    return r;
  }
  return { text: `There is no tool called ${name}. It may belong to a page that is no longer open.` };
}
