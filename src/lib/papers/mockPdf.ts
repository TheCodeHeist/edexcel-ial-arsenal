/* A mock paper as PDFs a teacher can print: the question paper (cover, questions renumbered 1, 2, 3 … at their
   printed size, space to answer, totals, page numbers) and its mark scheme (where each question came from, the
   answers, each question's mark-scheme rows). Made in the browser with pdf-lib from the same crops the site
   shows; loaded only when someone asks for a PDF.

   Renumbering: each question's first crop is a scan of the printed page, its original number ('7', '*17',
   '13:') at the top-left. That number is found from the pixels (the left-most ink of the first line, up to a
   gap before the text; checked against every Physics question, 1945 of 1945), painted out, and the new number
   is printed over it. If it isn't found, the original stays and the question is still headed by its new number. */
import type { PDFDocument as Doc, PDFFont, PDFImage, PDFPage } from 'pdf-lib';
import { CROPS_BASE } from './crops';
import type { MockCrop, MockQuestion } from './mock';

export interface MockMeta {
  subjectName: string;      // 'Physics'
  unit: string;             // 'WPH14'
  unitTitle: string;        // 'Further Mechanics, Fields and Particles'
  unitLabel: string;        // 'Unit 4'
  minutes: number;
  topics: string[];         // names of the chosen topics, if any
  url: string;              // the mock's link
  /** 'maths': each question on a fresh page with all its parts together, then ruled pages to answer on (as
      Pearson's Maths papers are); otherwise answer space after each part (as the science papers are) */
  layout?: 'maths' | 'science';
}

const A4 = { w: 595.28, h: 841.89 };
const M = { left: 46, right: 46, top: 54, bottom: 64 };
/* Each page is framed; the margin outside the frame carries the site's name and address (it isn't needed for
   scanning, unlike on Pearson's own papers). */
const FRAME = { x0: 34, x1: A4.w - 34, top: 40, bottom: 48 };
const SITE = 'ial-arsenal.thecodeheist.is-a.dev';
const SCALE = 72 / 150;     // crops are 150 dpi: this puts them back at the size they were printed
const INK = 150;            // a pixel darker than this is ink

/* ---- images ---- */

interface Img { canvas: HTMLCanvasElement; number?: { x0: number; y0: number; x1: number; y1: number } }

async function load(c: MockCrop): Promise<HTMLCanvasElement> {
  const r = await fetch(`${CROPS_BASE}/${c.src}`);
  if (!r.ok) throw new Error(`couldn't load ${c.src}`);
  const bmp = await createImageBitmap(await r.blob());
  const cv = document.createElement('canvas');
  cv.width = bmp.width; cv.height = bmp.height;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  g.drawImage(bmp, 0, 0);
  return cv;
}

/** The printed question number at the top-left of a question's first crop, in pixels; undefined if unsure. */
function findNumber(cv: HTMLCanvasElement) {
  const { width: w, height: h } = cv;
  const px = cv.getContext('2d')!.getImageData(0, 0, w, Math.min(h, 120)).data;
  const H = Math.min(h, 120);
  const ink = (x: number, y: number) => px[(y * w + x) * 4] < INK;
  const half = Math.floor(w / 2);
  const rowInk = (y: number) => { for (let x = 0; x < half; x++) if (ink(x, y)) return true; return false; };
  let top = 0;
  while (top < H && !rowInk(top)) top++;
  if (top >= H) return undefined;
  let bot = top;
  while (bot < Math.min(H, top + 45) && rowInk(bot)) bot++;
  const y0 = Math.max(0, top - 2), y1 = Math.min(H - 1, bot + 2);
  const col = (x: number) => { for (let y = y0; y <= y1; y++) if (ink(x, y)) return true; return false; };
  let c0 = 0;
  while (c0 < 61 && !col(c0)) c0++;
  if (c0 > 60) return undefined;                      // the number sits at the left edge
  let c1 = c0, gap = 0;
  for (let c = c0; c < w && c < c0 + 70; c++) {
    if (col(c)) { c1 = c; gap = 0; } else if (++gap >= 6) break;
  }
  const width = c1 - c0;
  // A number on its own (Maths prints '4.' alone above a centred instruction or a figure) counts too: it's the
  // first thing at the top-left of a question's first crop.
  if (width < 3 || width > 45 || bot - top > 40) return undefined;
  return { x0: c0, y0: top, x1: c1, y1: bot };
}

function paintOut(cv: HTMLCanvasElement, n: NonNullable<Img['number']>) {
  const g = cv.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(n.x0 - 3, n.y0 - 3, n.x1 - n.x0 + 6, n.y1 - n.y0 + 6);
}

async function embed(doc: Doc, cv: HTMLCanvasElement): Promise<PDFImage> {
  const blob = await new Promise<Blob>((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error('canvas'))), 'image/jpeg', 0.9));
  return doc.embedJpg(await blob.arrayBuffer());
}

/** Load many crops a few at a time, reporting progress. */
async function loadAll(crops: MockCrop[], progress: (done: number, all: number) => void) {
  const out = new Map<string, HTMLCanvasElement>();
  let done = 0;
  const queue = [...new Set(crops.map((c) => c.src))];
  const all = queue.length;
  const byName = new Map(crops.map((c) => [c.src, c]));
  async function worker() {
    for (let src = queue.shift(); src; src = queue.shift()) {
      out.set(src, await load(byName.get(src)!));
      progress(++done, all);
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  return out;
}

/* ---- layout ---- */

class Writer {
  page!: PDFPage;
  y = 0;                    // distance from the top of the page
  pages: PDFPage[] = [];
  constructor(public doc: Doc, public f: Fonts) {}
  newPage() {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.pages.push(this.page);
    this.y = M.top;
  }
  get left() { return A4.h - M.bottom - this.y; }
  need(h: number) { if (h > this.left) this.newPage(); }
  text(s: string, x: number, size: number, font: PDFFont, opts: { right?: boolean; grey?: boolean; y?: number } = {}) {
    const w = font.widthOfTextAtSize(s, size);
    this.page.drawText(s, { x: opts.right ? x - w : x, y: A4.h - (opts.y ?? this.y) - size * 0.8, size, font,
      ...(opts.grey ? { color: grey(0.35) } : {}) });
    return w;
  }
  /** wrapped paragraph; returns its height */
  para(s: string, x: number, width: number, size: number, font: PDFFont, lead = 1.35) {
    const words = s.split(' ');
    let line = '';
    const lines: string[] = [];
    for (const word of words) {
      const t = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(t, size) > width && line) { lines.push(line); line = word; } else line = t;
    }
    if (line) lines.push(line);
    for (const l of lines) { this.need(size * lead); this.text(l, x, size, font); this.y += size * lead; }
    return lines.length * size * lead;
  }
  /** an image at print size, split at a blank row if it can't fit on one page */
  async image(cv: HTMLCanvasElement, x = M.left) {
    const full = A4.h - M.top - M.bottom;
    let from = 0;
    while (from < cv.height) {
      let rows = cv.height - from;
      if (rows * SCALE > this.left) {
        if (rows * SCALE <= full && this.left < full) { this.newPage(); continue; }
        rows = Math.floor(this.left / SCALE);
        if (rows < 120) { this.newPage(); continue; }
        rows = blankRowAbove(cv, from + rows, 90) - from;
      }
      const part = slice(cv, from, rows);
      const img = await embed(this.doc, part);
      const w = cv.width * SCALE, h = rows * SCALE;
      const maxW = FRAME.x1 - 3 - x;                  // into the margin up to the frame rather than shrinking the scan
      const k = w > maxW ? maxW / w : 1;
      this.page.drawImage(img, { x, y: A4.h - this.y - h * k, width: w * k, height: h * k });
      this.y += h * k;
      from += rows;
    }
  }
}

let lib: typeof import('pdf-lib');
const grey = (v: number) => lib.rgb(v, v, v);

function slice(cv: HTMLCanvasElement, from: number, rows: number) {
  if (from === 0 && rows === cv.height) return cv;
  const out = document.createElement('canvas');
  out.width = cv.width; out.height = rows;
  out.getContext('2d')!.drawImage(cv, 0, from, cv.width, rows, 0, 0, cv.width, rows);
  return out;
}

/** The nearest row at or above `y` (within `range`) with no ink, so a split doesn't cut through a line. */
function blankRowAbove(cv: HTMLCanvasElement, y: number, range: number) {
  const g = cv.getContext('2d')!;
  for (let r = y; r > y - range && r > 0; r--) {
    const d = g.getImageData(0, r, cv.width, 1).data;
    let blank = true;
    for (let i = 0; i < d.length; i += 4) if (d[i] < INK) { blank = false; break; }
    if (blank) return r;
  }
  return y;
}

function duration(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return [h ? `${h} hour${h > 1 ? 's' : ''}` : '', m ? `${m} minute${m > 1 ? 's' : ''}` : ''].filter(Boolean).join(' ');
}

const ascii = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7e·–—é]/g, '');

/* The covers are set in the site's own type (design-system/DESIGN.md): PT Serif for headings, Geist for text,
   JetBrains Mono for labels and figures. Their TTFs (all SIL Open Font License) are in public/fonts/, fetched
   only when a PDF is made, and subset so only the letters used go into the file. The question pages keep Times
   and Helvetica, as Pearson's papers do. If the fonts can't be loaded, the cover falls back to those. */
interface Fonts {
  roman: PDFFont; bold: PDFFont; sans: PDFFont;
  display: PDFFont; serif: PDFFont; text: PDFFont; semi: PDFFont; mono: PDFFont;
}

async function fonts(doc: Doc): Promise<Fonts> {
  const { StandardFonts } = lib;
  const roman = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const std = { roman, bold, sans, display: bold, serif: roman, text: sans,
    semi: await doc.embedFont(StandardFonts.HelveticaBold), mono: await doc.embedFont(StandardFonts.Courier) };
  try {
    doc.registerFontkit((await import('@pdf-lib/fontkit')).default);
    const get = async (name: string) => {
      const r = await fetch(`/fonts/${name}.ttf`);
      if (!r.ok) throw new Error(`couldn't load ${name}`);
      return doc.embedFont(await r.arrayBuffer(), { subset: true });
    };
    const [display, serif, text, semi, mono] = await Promise.all(
      ['PT_Serif-Web-Bold', 'PT_Serif-Web-Regular', 'Geist-Regular', 'Geist-SemiBold', 'JetBrainsMono-Medium'].map(get));
    return { roman, bold, sans, display, serif, text, semi, mono };
  } catch {
    return std;
  }
}

/** The frame, the site in the margins, page numbers and 'Turn over' below the frame. */
function footers(w: Writer, label: string, from: number, turnOver: boolean) {
  const side = `Edexcel IAL Arsenal  ·  free past-paper practice  ·  ${SITE}`;
  w.pages.forEach((p, i) => {
    p.drawRectangle({ x: FRAME.x0, y: FRAME.bottom, width: FRAME.x1 - FRAME.x0, height: A4.h - FRAME.top - FRAME.bottom,
      borderColor: grey(0.55), borderWidth: 0.7 });
    const sw = w.f.mono.widthOfTextAtSize(side, 6.5);
    const mid = (A4.h - FRAME.top + FRAME.bottom) / 2;
    p.drawText(side, { x: FRAME.x0 - 10, y: mid - sw / 2, size: 6.5, font: w.f.mono, color: grey(0.5), rotate: lib.degrees(90) });
    p.drawText(side, { x: FRAME.x1 + 10, y: mid + sw / 2, size: 6.5, font: w.f.mono, color: grey(0.5), rotate: lib.degrees(-90) });
    if (i < from) return;
    const n = String(i + 1);
    p.drawText(n, { x: A4.w / 2 - w.f.mono.widthOfTextAtSize(n, 10) / 2, y: FRAME.bottom - 22, size: 10, font: w.f.mono });
    p.drawText(label, { x: FRAME.x0, y: FRAME.bottom - 21, size: 7.5, font: w.f.text, color: grey(0.45) });
    if (turnOver && i < w.pages.length - 1) {
      const t = 'Turn over';
      p.drawText(t, { x: FRAME.x1 - w.f.semi.widthOfTextAtSize(t, 9.5), y: FRAME.bottom - 22, size: 9.5, font: w.f.semi });
    }
  });
}

/** The site's black-and-white logo (assets/ial-arsenal-logo-bw, served from /brand/) and name, at the top of a
    cover. The colour logo is for screens; this one prints cleanly on any printer. */
async function logo(w: Writer) {
  const r = await fetch('/brand/ial-arsenal-logo-bw.png');
  const s = 40;
  if (r.ok) {
    const img = await w.doc.embedPng(await r.arrayBuffer());
    w.page.drawImage(img, { x: M.left, y: A4.h - w.y - s, width: s, height: s });
  }
  w.text('Edexcel IAL Arsenal', M.left + s + 10, 15, w.f.display, { y: w.y + 6 });
  w.text(SITE, M.left + s + 10, 8, w.f.mono, { grey: true, y: w.y + 25 });
  await pearson(w);
  w.y += s + 14;
}

/** Pearson's logo at the top right of a cover, as on its own papers, with a note under it: the questions are
    Pearson's, the mock isn't. Pearson's current wordmark, cropped from the cover of WMA13 October 2026
    (assets/pearson-logo, served from /brand/), drawn at its own aspect ratio, never stretched. */
async function pearson(w: Writer) {
  const r = await fetch('/brand/pearson-logo.png');
  if (!r.ok) return;
  const img = await w.doc.embedPng(await r.arrayBuffer());
  const wd = 96, h = wd * (img.height / img.width);   // a wide wordmark: sized by its width
  const right = A4.w - M.right, top = w.y + 6;       // level with the site's name on the left
  w.page.drawImage(img, { x: right - wd, y: A4.h - top - h, width: wd, height: h });
  w.text('Questions © Pearson Education Ltd.', right, 6.2, w.f.text, { right: true, grey: true, y: top + h + 6 });
  w.text('Not produced or endorsed by Pearson.', right, 6.2, w.f.text, { right: true, grey: true, y: top + h + 13.5 });
}

function credit(w: Writer, meta: MockMeta) {
  w.y = A4.h - M.bottom - 58;
  w.page.drawLine({ start: { x: M.left, y: A4.h - w.y + 6 }, end: { x: A4.w - M.right, y: A4.h - w.y + 6 }, thickness: 0.5, color: grey(0.6) });
  w.para(`Questions and mark schemes © Pearson Education Ltd, from Pearson Edexcel International A Level past papers (each question's paper is listed in the mark scheme), collected and shared for free by PaperLords and Physics & Maths Tutor. Put together with Edexcel IAL Arsenal (ial-arsenal.thecodeheist.is-a.dev), an independent, non-commercial revision site; not produced or endorsed by Pearson.`,
    M.left, A4.w - M.left - M.right, 7.2, w.f.text, 1.45);
  void meta;
}

/* ---- the question paper ---- */

const lines = (marks: number, kind: string) =>
  kind === 'extended' ? Math.min(22, Math.round(marks * 2.6)) : Math.min(14, Math.max(2, marks * 2));

export async function questionPaper(questions: MockQuestion[], meta: MockMeta, progress: (d: number, a: number) => void) {
  lib = await import('pdf-lib');
  const doc = await lib.PDFDocument.create();
  doc.setTitle(`${meta.unit} mock paper`);
  doc.setCreator('Edexcel IAL Arsenal');
  const f = await fonts(doc);
  const crops = questions.flatMap((q) => [...q.stem, ...q.parts.flatMap((p) => [...(p.intro ?? []), ...p.qp])]);
  const imgs = await loadAll(crops, progress);
  const total = questions.reduce((n, q) => n + q.marks, 0);
  const w = new Writer(doc, f);
  const width = A4.w - M.left - M.right;

  // cover
  w.newPage();
  await logo(w);
  const box = (label: string, x: number, wd: number) => {
    w.text(label, x, 8.5, f.text, { grey: true });
    w.page.drawRectangle({ x, y: A4.h - w.y - 34, width: wd, height: 20, borderColor: grey(0.4), borderWidth: 0.8 });
  };
  box('Candidate name', M.left, 300); box('Class', M.left + 312, 90); box('Date', M.left + 414, width - 414);
  w.y += 64;
  w.text(meta.subjectName.toUpperCase(), M.left, 11, f.mono, { grey: true }); w.y += 20;
  w.text(`${meta.unitLabel}: ${ascii(meta.unitTitle)}`, M.left, 22, f.display); w.y += 32;
  w.text(`Mock paper made from past ${meta.unit} questions`, M.left, 14, f.serif); w.y += 34;
  w.page.drawLine({ start: { x: M.left, y: A4.h - w.y }, end: { x: A4.w - M.right, y: A4.h - w.y }, thickness: 1.2 });
  w.y += 14;
  w.text(`Time: ${duration(meta.minutes)}`, M.left, 12.5, f.semi);
  w.text(`Total marks: ${total}`, A4.w - M.right, 12.5, f.semi, { right: true }); w.y += 22;
  w.text('You may need: a scientific calculator and a ruler.', M.left, 10.5, f.text); w.y += 18;
  if (meta.topics.length) { w.y += 4; w.para(`Topics: ${meta.topics.map(ascii).join('; ')}.`, M.left, width, 9.5, f.text); }
  w.y += 14;
  w.text('Instructions', M.left, 13, f.display); w.y += 18;
  for (const s of [
    'Use black ink or ball-point pen.',
    'Answer all questions, in the spaces provided.',
    'For a multiple-choice question, put a cross in the box next to your answer (or circle its letter where there are no boxes). If you change your mind, put a line through it and then mark your new answer.',
    'Show your working in calculations, and include units where appropriate.',
  ]) { w.text('•', M.left + 4, 10.5, f.text); w.para(s, M.left + 16, width - 16, 10.5, f.text); w.y += 3; }
  w.y += 10;
  w.text('Information', M.left, 13, f.display); w.y += 18;
  for (const s of [
    `The total mark for this paper is ${total}.`,
    'The marks for each question are shown in brackets: use this as a guide to how much time to spend on it.',
    ...(questions.some((q) => q.parts.some((p) => p.kind === 'extended'))
      ? ['Questions marked with an asterisk (*) are where your answer is marked on how clear and well structured it is, as well as on its physics.'] : []),
  ]) { w.text('•', M.left + 4, 10.5, f.text); w.para(s, M.left + 16, width - 16, 10.5, f.text); w.y += 3; }
  // a marks grid for the teacher
  w.y += 14;
  w.text('FOR THE MARKER', M.left, 8.5, f.mono, { grey: true }); w.y += 14;
  const cols = Math.min(10, questions.length + 1), cw = width / cols, rh = 16;
  const cells = [...questions.map((q, i) => [`Q${i + 1}`, `/${q.marks}`]), ['Total', `/${total}`]];
  for (let i = 0; i < cells.length; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const x = M.left + c * cw, y = w.y + r * rh * 2.4;
    w.page.drawRectangle({ x, y: A4.h - y - rh, width: cw, height: rh, borderColor: grey(0.4), borderWidth: 0.6, color: grey(0.93) });
    w.page.drawRectangle({ x, y: A4.h - y - rh * 2.2, width: cw, height: rh * 1.2, borderColor: grey(0.4), borderWidth: 0.6 });
    w.text(cells[i][0], x + 4, 8.5, f.semi, { y: y + 4 });
    w.text(cells[i][1], x + cw - 4, 8.5, f.mono, { right: true, grey: true, y: y + rh + 8 });
  }
  credit(w, meta);

  // questions
  w.newPage();
  for (const [i, q] of questions.entries()) {
    const n = i + 1;
    const star = q.parts.some((p) => p.kind === 'extended') ? '*' : '';
    if (meta.layout !== 'maths') {
      w.need(90);
      if (i > 0) w.y += 10;
    }
    let numbered = false;
    const show = async (c: MockCrop) => {
      const cv = imgs.get(c.src)!;
      if (!numbered && !c.src.endsWith('_lead.webp')) {
        numbered = true;
        const num = findNumber(cv);
        const k = cv.width * SCALE > FRAME.x1 - 3 - M.left ? (FRAME.x1 - 3 - M.left) / (cv.width * SCALE) : 1;
        if (num) {
          const own = cloneCanvas(cv);
          paintOut(own, num);
          // start the crop on a page where its first slice fits, so the number goes on that page
          const h = own.height * SCALE * k, full = A4.h - M.top - M.bottom;
          if ((h <= full && h > w.left) || w.left < 120) w.newPage();
          const top = w.y, page = w.page;
          await w.image(own);
          const size = Math.max(10, Math.min(13, ((num.y1 - num.y0) * SCALE * k) / 0.66));
          page.drawText(`${star}${n}`, { x: M.left + num.x0 * SCALE * k, y: A4.h - top - num.y1 * SCALE * k, size, font: f.bold });
          return;
        }
        w.text(`Question ${n}`, M.left, 11, f.bold); w.y += 16;
      }
      await w.image(cv);
    };
    if (meta.layout === 'maths') {
      // a fresh page; the whole question (stem, every part) together; then ruled lines to the foot of the
      // page and one or two ruled pages more, 'Question n continued'; the total under the last line
      if (i > 0 || w.y > M.top + 1) w.newPage();
      for (const c of q.stem) await show(c);
      for (const [j, p] of q.parts.entries()) {
        const prev = q.parts[j - 1];
        if (p.intro?.length && JSON.stringify(p.intro) !== JSON.stringify(prev?.intro ?? [])) for (const c of p.intro) await show(c);
        for (const c of p.qp) await show(c);
      }
      const rule = (y: number) => w.page.drawLine({ start: { x: M.left, y: A4.h - y }, end: { x: A4.w - M.right, y: A4.h - y },
        thickness: 0.6, color: grey(0.55) });
      const fill = (reserve: number) => { w.y += 8; while (w.left > reserve + 24) { w.y += 24; rule(w.y); } };
      const extra = q.marks <= 6 ? 1 : 2;
      fill(0);
      for (let k = 0; k < extra; k++) {
        w.newPage();
        w.text(`Question ${n} continued`, M.left, 12, f.bold); w.y += 14;
        fill(k === extra - 1 ? 30 : 0);
      }
      w.y += 10;
      w.text(`(Total for Question ${n} is ${q.marks} mark${q.marks === 1 ? '' : 's'})`, A4.w - M.right, 11, f.bold, { right: true });
      w.y += 18;
      continue;
    }
    for (const c of q.stem) await show(c);
    for (const [j, p] of q.parts.entries()) {
      const prev = q.parts[j - 1];
      if (p.intro?.length && JSON.stringify(p.intro) !== JSON.stringify(prev?.intro ?? [])) for (const c of p.intro) await show(c);
      for (const c of p.qp) await show(c);
      // space to answer
      const dot = (y: number, x0 = M.left + 26, x1 = A4.w - M.right - 30) =>
        w.page.drawLine({ start: { x: x0, y: A4.h - y }, end: { x: x1, y: A4.h - y }, thickness: 0.7, dashArray: [0.8, 2.4], color: grey(0.35) });
      if (p.kind === 'calc') {
        const space = Math.min(230, Math.max(70, p.marks * 40));
        w.need(Math.min(space, 140)); w.y += Math.min(space, w.left - 26);
        dot(w.y + 14, A4.w - M.right - 230); w.y += 24;
      } else if (p.kind === 'short' || p.kind === 'extended') {
        w.y += 8;
        for (let k = 0; k < lines(p.marks, p.kind); k++) { w.need(22); w.y += 22; dot(w.y); }
        w.y += 8;
      } else if (p.kind === 'draw') {
        w.y += 6;
      }
    }
    w.need(22); w.y += 6;
    w.text(`(Total for Question ${n} = ${q.marks} mark${q.marks === 1 ? '' : 's'})`, A4.w - M.right, 11, f.bold, { right: true });
    w.y += 18;
    w.page.drawLine({ start: { x: M.left, y: A4.h - w.y }, end: { x: A4.w - M.right, y: A4.h - w.y }, thickness: 0.4, color: grey(0.7) });
  }
  w.need(60); w.y += 20;
  w.text(`TOTAL FOR PAPER = ${total} MARKS`, A4.w - M.right, 12, f.bold, { right: true }); w.y += 30;
  w.text('END', A4.w / 2, 12, f.bold, { right: false });
  footers(w, `${meta.unit} mock paper · Edexcel IAL Arsenal`, 1, true);
  return doc.save();
}

function cloneCanvas(cv: HTMLCanvasElement) {
  const out = document.createElement('canvas');
  out.width = cv.width; out.height = cv.height;
  out.getContext('2d')!.drawImage(cv, 0, 0);
  return out;
}

/* ---- the mark scheme ---- */

const SERIES: Record<string, string> = { Jan: 'January', Jun: 'June', Oct: 'October' };
const longSource = (s: string) => s.replace(/\b(Jan|Jun|Oct)\b/, (m) => SERIES[m]);

export async function markScheme(questions: MockQuestion[], meta: MockMeta, progress: (d: number, a: number) => void) {
  lib = await import('pdf-lib');
  const doc = await lib.PDFDocument.create();
  doc.setTitle(`${meta.unit} mock paper: mark scheme`);
  doc.setCreator('Edexcel IAL Arsenal');
  const f = await fonts(doc);
  const imgs = await loadAll(questions.flatMap((q) => [...q.parts.flatMap((p) => p.ms), ...(q.msNotes ?? [])]), progress);
  const total = questions.reduce((n, q) => n + q.marks, 0);
  const w = new Writer(doc, f);
  const width = A4.w - M.left - M.right;

  w.newPage();
  await logo(w);
  w.text(`${meta.subjectName.toUpperCase()} · ${meta.unitLabel.toUpperCase()}: ${ascii(meta.unitTitle)}`, M.left, 10, f.mono, { grey: true }); w.y += 20;
  w.text('Mock paper: mark scheme', M.left, 22, f.display); w.y += 30;
  w.text(`Total marks: ${total}    Time: ${duration(meta.minutes)}`, M.left, 12, f.semi); w.y += 26;
  w.para(`Each question is a whole question from a past ${meta.unit} paper; its original number and paper are listed below. The mark-scheme rows are Pearson's, so they show the original question number.`,
    M.left, width, 10, f.text);
  w.y += 10;
  const head = (y: number) => {
    for (const [t, x] of [['Question', M.left], ['From', M.left + 70], ['Original number', M.left + 260], ['Marks', M.left + 370], ['Answer', M.left + 420]] as const)
      w.text(t, x, 9, f.semi, { y });
  };
  head(w.y); w.y += 16;
  for (const [i, q] of questions.entries()) {
    w.need(16);
    const mcq = q.parts.length === 1 && q.parts[0].kind === 'mcq' ? q.parts[0].answer ?? '' : '';
    w.text(String(i + 1), M.left, 9.5, f.mono);
    w.text(longSource(q.source), M.left + 70, 9.5, f.text);
    w.text(`Q${q.number}`, M.left + 260, 9.5, f.mono);
    w.text(String(q.marks), M.left + 370, 9.5, f.mono);
    w.text(mcq, M.left + 420, 9.5, f.semi);
    w.y += 15;
  }
  w.y += 8;
  w.text(`Total: ${total}`, M.left + 370, 9.5, f.semi);
  credit(w, meta);

  w.newPage();
  for (const [i, q] of questions.entries()) {
    w.need(80);
    if (i > 0) w.y += 12;
    w.text(`Question ${i + 1}`, M.left, 13, f.display);
    w.text(`${longSource(q.source)}, question ${q.number} · ${q.marks} mark${q.marks === 1 ? '' : 's'}`, A4.w - M.right, 9, f.text, { right: true, grey: true, y: w.y + 3 });
    w.y += 20;
    for (const p of q.parts) {
      if (p.kind === 'mcq' && p.answer) { w.need(18); w.text(`Answer: ${p.answer}`, M.left, 11, f.bold); w.y += 16; }
      for (const c of p.ms) await w.image(imgs.get(c.src)!, M.left - 10);
      w.y += 4;
    }
    if (q.msNotes?.length) {
      w.need(30); w.text('Notes for examiners', M.left, 10, f.bold); w.y += 14;
      for (const c of q.msNotes) await w.image(imgs.get(c.src)!, M.left - 10);
    }
  }
  footers(w, `${meta.unit} mock paper: mark scheme · Edexcel IAL Arsenal`, 1, false);
  return doc.save();
}
