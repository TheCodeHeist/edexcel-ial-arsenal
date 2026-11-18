/* Past-paper registry: the contract between the offline pipeline (pipeline/, Python) and the site.

   The pipeline writes one JSON file per paper to registry/<subject>/papers/<PaperId>.json, and the site
   only ever reads those files — it never touches a PDF. Crop images live in the separate data repo and are
   referenced by path relative to its root.

   Granularity: a Question is what a mock paper picks (a whole numbered question, with its shared stem).
   Its Parts are what topic tags, marks and mark-scheme rows attach to, so topic browsing can point at
   13(b)(ii) while a mock still prints all of question 13. */

/** e.g. 'WPH14_2026_06' = unit code, year, month of the series. */
export type PaperId = string;

/** The registry's subjects, as in registry/<subject>/. */
export type Subject = 'physics' | 'chemistry' | 'maths';

/** A tag: a spec content statement's number ('106'), or a practical skill ('3.5i'). Unique within a subject
    (see registry/<subject>/topics.json). */
export type TopicId = string;

/** registry/<subject>/topics.json: the spec turned into tags, unit by unit. */
export interface TopicList {
  subject: Subject;
  spec: string;                 // which spec issue the statements come from
  units: TopicUnit[];
}

export interface TopicUnit {
  code: string;                 // 'WPH14'
  title: string;
  groups: { id: string; title: string; points: TopicPoint[] }[];   // spec headings: '4.4' Electric and Magnetic Fields
}

export interface TopicPoint {
  id: TopicId;
  short: string;                // chip label: 'Impulse'
  text: string;                 // the statement as printed, equations in plain text
  core?: number;                // a core practical's number
  skill?: true;                 // a practical-skills tag (units 3 and 6), not a content statement
}

/** A rectangle on one PDF page, in PDF points (72 per inch, origin top-left), page numbers from 1. */
export interface Region {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** One rendered image cut from a PDF, ready to show: the printed column (x 36–559 pt) of one page between two
    heights, greyscale WebP at 150 dpi. A part that crosses a page break has several, shown one under another.
    Display order for a part: its question's stem, then its intro (if any), then the part itself. */
export interface Crop {
  src: string;          // path in the data repo, e.g. 'physics/WPH14_2026_06/q13b.webp'
  w: number;            // pixel size, so the page can reserve space before the image loads
  h: number;
  region: Region;       // where it came from, so the review tool can re-cut it
}

/** Who stands behind a tag: nobody yet, a model's guess, or a human who checked it. */
export type TagStatus = 'none' | 'suggested' | 'reviewed';

export type PartKind =
  | 'mcq'               // Section A, one of A–D
  | 'calc'              // calculation / show that
  | 'short'             // short open response
  | 'draw'              // sketch a graph, draw a diagram, add arrows/rays, plot points: answered on paper
  | 'extended';         // asterisked question, marked on structure (QWC)

export interface Part {
  label: string;        // '13(b)(ii)'; for a question with no parts, just '13'
  marks: number;
  kind: PartKind;
  topics: TopicId[];
  tagStatus: TagStatus;
  answer?: 'A' | 'B' | 'C' | 'D';   // mcq only: read from the mark scheme, or a reviewer's correction
  answerRead?: 'A' | 'B' | 'C' | 'D';  // what the pipeline read, kept so a correction is visible and undoable
  kindGuessed?: PartKind;              // the pipeline's guess, likewise
  intro?: Crop[];       // its parent part's lead-in, e.g. 19(b)'s text and diagram, shown above 19(b)(i), (ii), (iii)
                        // (the same images for every sibling; they're stored once)
  qp: Crop[];           // the part as printed, answer space trimmed
  ms: Crop[];           // its mark-scheme rows
  text?: string;        // extracted text, for search and tagging only (equations come out mangled, never shown)
}

export interface Question {
  id: string;           // '<PaperId>_q13'
  number: number;
  marks: number;        // sum of parts; checked against the paper's '(Total for Question 13 = 7 marks)'
  stem: Crop[];         // shared context printed before the first part (may be empty)
  parts: Part[];
  check: CheckStatus;   // who stands behind the crops; only 'machine' and 'human' reach the site
  risks?: string[];     // why the pipeline wants a person to look (see pipeline/risks.py); absent when none
}

/** How far a question's crops and mark-scheme pairing have been checked.
    pending: not yet looked at, or a risk signal / AI concern says a person must look.
    machine: no risk signals, and the AI reader saw nothing wrong.
    human:   a person looked and it's right.   flagged: a person looked and it's wrong (never shown). */
export type CheckStatus = 'pending' | 'machine' | 'human' | 'flagged';

/** Who we got a file from. Shown on every paper: Pearson owns the papers; the archives that collect and share
    them for free (PaperLords, Physics & Maths Tutor) are credited by name with a link back, as a matter of
    gratitude, not just law. Comes from "providers" in registry/sources.json. */
export interface Provider {
  name: string;         // 'PaperLords'
  url: string;          // their page for these papers, linked from the credit
  credit: string;       // one line of thanks shown under the paper
}

export interface SourceFile {
  url: string;          // the original PDF, for an "open original" link
  via: Provider;
}

export interface Paper {
  id: PaperId;
  subject: Subject;
  unit: string;         // 'WPH14'
  series: string;       // '2026-06'
  variant?: string;     // 'A': Pearson's second paper for another time zone (WPH14/01A)
  totalMarks: number;
  durationMin: number;
  source: { qp: SourceFile; ms: SourceFile };   // the copyright holder is always Pearson; `via` is who shared the file
  questions: Question[];
}
