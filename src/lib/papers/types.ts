/* Past-paper registry: the contract between the offline pipeline (pipeline/, Python) and the site.

   The pipeline writes one JSON file per paper to registry/<subject>/papers/<PaperId>.json, and the site
   only ever reads those files — it never touches a PDF. Crop images live in the separate data repo and are
   referenced by path relative to its root.

   Granularity: a Question is what a mock paper picks (a whole numbered question, with its shared stem).
   Its Parts are what topic tags, marks and mark-scheme rows attach to, so topic browsing can point at
   13(b)(ii) while a mock still prints all of question 13. */

/** e.g. 'WPH14_2026_06' = unit code, year, month of the series. */
export type PaperId = string;

/** Spec point number as a string, e.g. '106'. Unique within a subject (see registry/<subject>/topics.json). */
export type TopicId = string;

/** A rectangle on one PDF page, in PDF points (72 per inch, origin top-left), page numbers from 1. */
export interface Region {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** One rendered image cut from a PDF, ready to show. A part that crosses a page break has several. */
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
  | 'extended';         // asterisked question, marked on structure (QWC)

export interface Part {
  label: string;        // '13(b)(ii)'; for a question with no parts, just '13'
  marks: number;
  kind: PartKind;
  topics: TopicId[];
  tagStatus: TagStatus;
  answer?: 'A' | 'B' | 'C' | 'D';   // mcq only, read from the mark scheme
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
  reviewed: boolean;    // crops checked by a human; unreviewed questions never reach the site
}

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
  subject: 'physics' | 'chemistry';
  unit: string;         // 'WPH14'
  series: string;       // '2026-06'
  totalMarks: number;
  durationMin: number;
  source: { qp: SourceFile; ms: SourceFile };   // the copyright holder is always Pearson; `via` is who shared the file
  questions: Question[];
}
