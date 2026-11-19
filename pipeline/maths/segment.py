"""Segment an IAL Mathematics / Further Mathematics paper into questions and pair each with its mark scheme.

Usage:  pipeline/.venv/bin/python pipeline/maths/segment.py WMA11_2024_01             outline + checks
        pipeline/.venv/bin/python pipeline/maths/segment.py WMA11_2024_01 --preview   overlay PNG per page
        pipeline/.venv/bin/python pipeline/maths/segment.py WMA11_2024_01 --write     crops + the registry file
                                                                                        (registry/maths/papers/)
        pipeline/.venv/bin/python pipeline/maths/segment.py WMA11_2024_01 --render    crops + paper.json in
                                                                    pipeline/cache/segments/<id>/

Kept separate from the Physics segmenter (pipeline/segment.py) on purpose: the layouts differ, and the Physics
pipeline is being worked on in parallel. Output follows the same registry format (src/lib/papers/types.ts).

Layout of a current-spec IAL Maths question paper (PDF points, A4 595 x 842), the same for P1–P4, F1–F3,
M1–M3, S1–S3 and D1:
    question number   x ~ 42.5, bold   '5.'  or  '3. (i) Find …'
    part labels       x ~ 60           '(a)'          sub-parts x ~ 76  '(i)'
                      (some questions nest the other way round: '(i)' then '(a)')
    marks             x ~ 496, bold    '(3)'   – often once for a group: '(a) (i) … (ii) … (3)'
    total             '(Total for Question 5 is 10 marks)'
    answer space      ruled '_____' lines and whole 'Question 5 continued' pages

The unit we cut is the *marked block*: everything that one '(n)' marks covers. Its label is the deepest label
all of its lines share, so '(a)(i) … (ii) … (3)' is one part, 5(a), worth 3.

Mark scheme: a table 'Question Number | Scheme | Marks'. Labels sit in the first column ('3.(a)', '4 (a)',
'(b)', '(ii) (a)'), part totals '(4)' and question totals '(7 marks)' in the last. Parts of a question share
one bordered box, so rows are split where each label starts. Free-text notes and alternative methods follow
each question's table; they are kept as the question's `msNotes`.
"""

import io
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import units  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "pipeline" / "cache"
PDF = CACHE / "pdf"
SUBJECT = "maths"

DPI, QUALITY = 150, 70                      # same as Physics crops
COL_X0, COL_X1 = 36, 559                    # the printed column; margins hold 'DO NOT WRITE IN THIS AREA'
COL_Y0, COL_Y1 = 40, 790                    # below 790: barcode, page number, 'Turn over'
PAD = 4

Q_START = re.compile(r"^(\d{1,2})[.:]\s*(.*)$")          # '5.'; June 2025 papers print '5:'
# No dot: '6 A particular lift …' (S3 Jun 2022 from question 6 on, S2 Jun 2024), or the number alone on its line
# with '(a)' on the next (FP3 Jan 2022). Only as the next question's number, bold, in the margin.
Q_START_BARE = re.compile(r"^(\d{1,2})(?:\s+(?=[A-Z(])(.*))?$")
ANSWER_BOOK = re.compile(r"^Answer Book$")
LABEL = re.compile(r"^\(([a-h]|i|ii|iii|iv|v|vi|vii|viii|ix|x)\)\s*")
MARK = re.compile(r"^\((\d{1,2})\)$")
# '(Total for Question 5 is 10 marks)'; papers up to about 2022 print just '(Total 10 marks)'
TOTAL = re.compile(r"^\(Total (?:for Question (\d{1,2}) is )?(\d{1,2}) marks?\)")
CONTINUED = re.compile(r"^Question \d{1,2} continued")
RULED = re.compile(r"^_{10,}$")
NOT_CONTENT = re.compile(r"^(BLANK PAGE|TOTAL FOR PAPER|END)\b", re.I)
ROMAN = {"i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"}


@dataclass
class Line:
    page: int           # 0-based
    x0: float
    y0: float
    x1: float
    y1: float
    text: str
    bold: bool

    @property
    def mid(self):
        return (self.y0 + self.y1) / 2


@dataclass
class Item:
    """Something printed that belongs in a crop: a text line, a drawing or an image."""
    page: int
    y0: float
    y1: float
    kind: str


@dataclass
class Node:
    """A crop: a question's stem, a parent part's intro, or a marked block (a Part)."""
    role: str           # 'stem' | 'intro' | 'part'
    label: str          # '5', '5(b)', '3(ii)(a)'
    start: tuple        # (page, y) where this crop may start
    marks: int = 0
    path: tuple = ()    # ('b',) or ('ii', 'a')
    intro: "Node | None" = None
    bands: list = field(default_factory=list)


@dataclass
class Question:
    number: int
    line: Line
    total: int | None = None
    total_line: Line | None = None
    nodes: list = field(default_factory=list)      # reading order
    problems: list = field(default_factory=list)

    @property
    def parts(self):
        return [n for n in self.nodes if n.role == "part"]


def label_of(q, path):
    return str(q) + "".join(f"({p})" for p in path)


# ---------------------------------------------------------------------------------------------- reading

def open_pdf(path):
    """Open a paper, undoing a tight crop: some A papers (M2 Oct 2025, D1 Jan 2026) are A4 pages cropped to
    539 x 785 pt, which moves everything 28 pt up and left of where every position threshold here expects
    it. Showing the whole A4 page puts it back. (Pages that bleed past A4 are left alone.)"""
    doc = pymupdf.open(path)
    for page in doc:
        if page.rect.width < 580 and abs(page.mediabox.width - 595.3) < 2:
            page.set_cropbox(page.mediabox)
    return doc


_RIGHT = {}


def right_edge(doc):
    """Where this paper's printed column ends. Papers up to 2022 keep a 'Leave blank' box down the right margin
    (x ≈ 515–560: the label, the box's rule, a 'Q12' score box at each question's end). It isn't the question:
    counted as content it made every answer page part of a question, and it showed in every crop. So for those
    papers the column stops at the box's rule; for the rest (and mark schemes) it's the usual COL_X1."""
    key = doc.name                  # the file: a closed document's id() can be reused by the next one
    if key not in _RIGHT:
        edge = COL_X1
        for page in list(doc)[1:4]:
            leave = [l["bbox"][0] for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])
                     if "".join(s["text"] for s in l["spans"]).strip() in ("Leave", "blank", "Leave blank")
                     and l["bbox"][0] > 470]
            if not leave:
                continue
            lx = min(leave)
            rules = [it[1].x for d in page.get_drawings() for it in d["items"]
                     if it[0] == "l" and abs(it[1].x - it[2].x) < 1 and abs(it[1].y - it[2].y) > 300 and 470 < it[1].x < lx]
            rules += [d["rect"].x0 for d in page.get_drawings()
                      if d["rect"].width < 3 and d["rect"].height > 300 and 470 < d["rect"].x0 < lx]
            edge = (min(rules) if rules else lx - 4) - 1
            break
        _RIGHT[key] = edge
    return _RIGHT[key]


# 'First released on AP - Edexcel Discord' + a sites.google.com link, printed over answer lines and mark-scheme
# tables of some 2023-24 papers (26 files)
STAMP = re.compile(r"(released (?:first )?on\b.*discord|sites\.google\.com/view/ap-edexcel)", re.I)


def unshift(text):
    """Undo the +29 shift of fonts with no character map (P2 Oct 2019, as in some 2019 Physics papers):
    ')LQG' -> 'Find', 'D' -> 'a'. Such spans always contain chr(3), their space, which never occurs in real
    text; an ordinary space or tab in them is a real one."""
    if "\x03" not in text:
        return text
    return "".join(chr(ord(c) + 29) if ord(c) < 94 and c not in " \t" else c for c in text)


def read_lines(doc, skip_cover=True, top=COL_Y0):
    """Text lines in the printed column. `top`: mark-scheme pages have no furniture above the column, and
    a table row continued onto a new page can put its label at y≈29 (FP3 Jan 2024), so they read from 20."""
    lines = []
    right = right_edge(doc)
    for pno, page in enumerate(doc):
        if skip_cover and pno == 0:
            continue
        for b in page.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                spans = [s for s in l["spans"] if s["text"].strip()]
                if not spans:
                    continue
                x0, y0, x1, y1 = l["bbox"]
                if x1 < COL_X0 or x0 > right or y0 < top or y0 > COL_Y1:
                    continue
                text = " ".join("".join(unshift(s["text"]) for s in l["spans"]).split())
                if STAMP.search(text):
                    continue                    # a stamp added by whoever first shared the paper, not Pearson's
                lines.append(Line(pno, x0, y0, x1, y1, text, any("Bold" in s["font"] for s in spans)))
    lines.sort(key=lambda l: (l.page, round(l.y0), l.x0))
    if skip_cover:
        # An A paper (2025–26) is the question paper and a separate answer book in one PDF: the book repeats
        # every question's total line. The questions all come first, so read only up to the book's cover.
        book = next((l.page for l in lines if l.bold and ANSWER_BOOK.match(l.text)), None)
        if book is not None:
            lines = [l for l in lines if l.page < book]
        # Older D1 PDFs are the answer book (questions and answer space, but only question totals) followed by
        # the question paper (with each part's marks): question 1 starts twice. Read the part with the marks.
        starts = [l.page for l in lines if l.bold and l.x0 < 60 and re.match(r"^1[.:]?(?:\s|$)", l.text)]
        if len(starts) > 1:
            bounds = starts + [doc.page_count]
            sections = [(a, b) for a, b in zip(bounds, bounds[1:])]

            def marks(sec):
                return sum(1 for l in lines if sec[0] <= l.page < sec[1] and l.bold and l.x0 > 470 and MARK.match(l.text))
            best = max(sections, key=marks)
            if marks(best) > 0:
                lines = [l for l in lines if best[0] <= l.page < best[1]]
    return lines


def content_items(doc, lines):
    """What's printed in the column: text (minus answer lines and page furniture), drawings (minus the page
    frame and hairlines) and images."""
    items = [Item(l.page, l.y0, l.y1, "text") for l in lines
             if not (RULED.match(l.text) or CONTINUED.match(l.text) or TOTAL.match(l.text)
                     or NOT_CONTENT.match(l.text))]
    right = right_edge(doc)
    for pno, page in enumerate(doc):
        for d in page.get_drawings():
            r = d["rect"]
            if r.x1 < COL_X0 or r.x0 > right - 2 or r.y1 < COL_Y0 or r.y0 > COL_Y1:
                continue
            if (r.width > 500 and r.height > 700) or (r.width > 400 and r.height < 1.5):
                continue                                    # page frame, answer rules, separators
            fill = d.get("fill")
            if d.get("color") is None and fill and min(fill) > 0.98:
                continue                                    # white on white: invisible (P2 Jun 2025 answer pages)
            items.append(Item(pno, max(r.y0, COL_Y0), min(r.y1, COL_Y1), "drawing"))
        for img in page.get_image_info():
            x0, y0, x1, y1 = img["bbox"]
            if x1 < COL_X0 + 5 or x0 > right - 5:
                continue
            items.append(Item(pno, max(y0, COL_Y0), min(y1, COL_Y1), "image"))
    return items


def cut_above(line, items):
    """Where a crop starting at `line` may begin: just above it, or above stacked maths on the same line that
    rises higher (a fraction's numerator, a surd's bar). MathType sets those as separate small pieces."""
    y = line.y0
    for it in items:
        if it.page == line.page and it.y0 < line.y0 - 1 and it.y1 > line.mid and line.y0 - it.y0 < 30:
            y = min(y, it.y0)
    return y - 1


# ---------------------------------------------------------------------------------------------- outline

def outline(lines, items):
    """Questions, their marked blocks and the crop nodes, in reading order."""
    questions, q = [], None
    pending = []        # (path, line) of labels opened since the last mark, in this question
    path = ()
    level1 = None       # 'letter' or 'roman': which kind of label is the outer one in this question
    prev_mark = None    # the last mark line in this question
    first_label = None
    for l in lines:
        m = Q_START.match(l.text) or Q_START_BARE.match(l.text)
        if m and l.bold and l.x0 < 60 and int(m[1]) == (q.number + 1 if q else 1):
            q = Question(int(m[1]), l)
            questions.append(q)
            pending, path, level1, prev_mark, first_label = [], (), None, None, None
            rest = m[2] or ""
        elif q is None:
            continue
        else:
            rest = l.text
        if t := TOTAL.match(l.text):
            if t[1] and int(t[1]) != q.number:
                q.problems.append(f"total line for question {t[1]} inside question {q.number}")
            q.total, q.total_line = int(t[2]), l
            if not q.parts and not pending:
                # no part marks at all, only the total (a one-part D1 question): the whole question is the part
                q.nodes.append(Node("part", label_of(q.number, ()), (q.line.page, cut_above(q.line, items)),
                                    int(t[2]), ()))
            continue
        # labels at the start of the line (possibly several: '(a) (i) …'); a sub-part can sit further in, on
        # the line of its parent ('(c) Find' then '(i) E(Y)' at x 140, S1 Jan 2021)
        if l.x0 < 100 or (l.x0 < 150 and (lm0 := LABEL.match(rest)) and lm0[1] in ROMAN and path):
            while lm := LABEL.match(rest):
                lab = lm[1]
                kind = "roman" if lab in ROMAN else "letter"
                level1 = level1 or kind
                if kind == level1:
                    path = (lab,)
                elif path:
                    path = (path[0], lab)
                else:
                    q.problems.append(f"Q{q.number}: label ({lab}) with no outer label")
                    path = (lab,)
                pending.append((path, l))
                first_label = first_label or l
                rest = rest[lm.end():]
        mm = MARK.match(l.text)
        if mm and l.bold and l.x0 > 470:
            marks = int(mm[1])
            if pending:
                shared = list(pending[0][0])
                for p, _ in pending[1:]:
                    n = 0
                    while n < min(len(shared), len(p)) and shared[n] == p[n]:
                        n += 1
                    shared = shared[:n]
                if shared:
                    bpath = tuple(shared)
                elif all(len(p) == 1 for p, _ in pending):
                    bpath = ()      # sibling labels under one mark ('(i) … (ii) … (8)', M1 Q4): the question
                else:
                    bpath = pending[0][0][:1]
            elif q.parts:
                q.problems.append(f"Q{q.number}: mark ({marks}) at p{l.page + 1} y{l.y0:.0f} with no new label")
                bpath = q.parts[-1].path
            else:
                bpath = ()
            # where the block starts: the first line after the previous mark (so 'Given that …' lead-ins
            # belong to the part they introduce); the first block starts at its first label
            if prev_mark is None:
                # a block that is the whole question ('(i) … (ii) … (8)') has no stem crop to carry the
                # question's opening, so it starts at the question number, figure and all
                start_line = q.line if bpath == () else (first_label or q.line)
            else:
                # below the mark's row: past its middle, as a mark's box can run tall enough to cover the next
                # label's line ('(b) Hence find …' at y 110 under a '(5)' boxed 96-113, P2 Jun 2025), while a
                # limit hanging under the mark's own line ('2' at y 211 by a '(3)' at 206-223) is still that row
                start_line = next(x for x in lines if (x.page, x.y0) > (prev_mark.page, prev_mark.mid)
                                  and not RULED.match(x.text) and not CONTINUED.match(x.text))
            node = Node("part", label_of(q.number, bpath), (start_line.page, cut_above(start_line, items)),
                        marks, bpath)
            # a parent label opened in this block on an earlier line than the child's: its text is an intro
            if len(bpath) == 2:
                parent_line = next((pl for p, pl in pending if p == bpath[:1]), None)
                child_line = next((pl for p, pl in pending if p == bpath), None)
                if parent_line is not None and child_line is not None and child_line is not parent_line:
                    node.intro = Node("intro", label_of(q.number, bpath[:1]), node.start, path=bpath[:1])
                    node.start = (child_line.page, cut_above(child_line, items))
                    q.nodes.append(node.intro)
            q.nodes.append(node)
            pending, prev_mark = [], l
    for q in questions:
        q_start = (q.line.page, cut_above(q.line, items))
        if q.nodes and q.nodes[0].path and q.nodes[0].start > (q_start[0], q.line.y1):
            q.nodes.insert(0, Node("stem", label_of(q.number, ()), q_start))
        # siblings under one parent share its intro
        intros = {}
        for n in q.parts:
            if n.intro:
                intros[n.path[:1]] = n.intro
            elif len(n.path) == 2 and n.path[:1] in intros:
                n.intro = intros[n.path[:1]]
    return questions


def regions(questions, items, page_count):
    """node.bands = [(page, y0, y1), …]: each node runs from its start to the next node's start (or the
    question's total line), trimmed to what's actually printed, so answer space falls away."""
    for qi, q in enumerate(questions):
        if q.total_line is not None:
            q_end = (q.total_line.page, q.total_line.y0 - 1)
        elif qi + 1 < len(questions):
            nq = questions[qi + 1].line
            q_end = (nq.page, nq.y0 - 1)
        else:
            q_end = (page_count - 1, COL_Y1)
        for i, node in enumerate(q.nodes):
            end = q.nodes[i + 1].start if i + 1 < len(q.nodes) else q_end
            node.bands = []
            for page in range(node.start[0], end[0] + 1):
                top = node.start[1] if page == node.start[0] else COL_Y0
                bottom = end[1] if page == end[0] else COL_Y1
                inside = [it for it in items if it.page == page and top <= (it.y0 + it.y1) / 2 <= bottom]
                if inside:
                    node.bands.append((page, max(top, min(it.y0 for it in inside) - PAD),
                                       min(bottom, max(it.y1 for it in inside) + PAD)))


def check(questions):
    problems = []
    for q in questions:
        problems += q.problems
        got = sum(n.marks for n in q.parts)
        if q.total is None:
            problems.append(f"Q{q.number}: no '(Total for Question …)' line")
        elif got != q.total:
            problems.append(f"Q{q.number}: parts add up to {got}, total says {q.total}")
        if not q.parts:
            problems.append(f"Q{q.number}: no marks found")
        labels = [n.label for n in q.parts]
        if len(set(labels)) != len(labels):
            problems.append(f"Q{q.number}: repeated part label in {labels}")
        for n in q.nodes:
            if not n.bands:
                problems.append(f"{n.label} ({n.role}): nothing printed in its region")
    return problems


# ---------------------------------------------------------------------------------------------- mark scheme

# A label may trail one stray '(' from MathType on the same line ('(b) (i) (' in P1 Jan 2024's Q6).
MS_LABEL = re.compile(r"^(?:(\d{1,2})\s*\.?\s*)?((?:\(\s*[a-z]{1,4}\s*\)\s*)*)\(?\s*$")
MS_LETTER = re.compile(r"^(?:[a-h]|i|ii|iii|iv|v|vi)$")       # a part alone, under its number: '1' then 'a' (M2 2026)
FIRST_LABEL = re.compile(r"^1(?:\s*\.|\s*\(?[a-h]\)?)?(?:\s*\(\s*[a-z]{1,4}\s*\))*\s*$")   # question 1's label: '1', '1.', '1a', '1(a)'
HEADER = re.compile(r"^(?:Question\b(?! Paper)|Q$|Q\s+(?=[A-Z]))", re.I)
MS_LABEL_BARE = re.compile(r"^(\d{1,2})\s*([a-h])\s*((?:\(\s*(?:i|ii|iii|iv|v|vi)\s*\)\s*)*|(?:i|ii|iii|iv|v|vi))$")   # M2: '1a', '2b(ii)'; P1 Oct 2023: '7ai'
# A label at the start of a line, with the scheme's text after it on the same line (S3: '2. (a) Number all …',
# S1 Oct 2021: '1 (a) [Sum of probs …', no dot).
MS_LABEL_LEAD = re.compile(r"^(?:(\d{1,2})\s*\.?\s*)?((?:\(\s*[a-z]{1,4}\s*\)\s*)+)(?=\S)")
# A question with no parts, its number running on into the scheme (S1 Jan 2020: '1. [Sum of probs = 1 gives]').
MS_NUM_LEAD = re.compile(r"^(\d{1,2})\s*\.\s+(?=\S)")
# A question's closing total, in each unit's style: '(7 marks)' (P), '(Total 5 marks)' (FP), 'Total 8' (S1),
# '(6)' (M1, bold), '[8]' (S3, bold), '(9)' (M3, plain, after bold part totals '[5]'). The bracketed forms look
# just like part totals and boldness differs by unit, so they count only when the number is the question's
# total as printed on the question paper.
# Also '7 marks', '[7 marks]', '(7marks)', '7 Marks' in other series.
# Also '[Total 14]' (S2 2023), and the total run on after the last row's mark codes, 'A1A1 (8)' (FP2 2022).
MS_TOTAL = re.compile(r"^(?:[(\[]?(?:Total\s+)?(\d{1,2})\s*marks?[)\]]?|[(\[]?Total\s+(\d{1,2})(?:\s+marks?)?[)\]]?"
                      r"|(?:(?:d{0,2}[MABE]\d\*?\s*)+)?[(\[](\d{1,2})[)\]])$",
                      re.I)
MARK_CODES = re.compile(r"^(?:d{0,2}[MABE]\d\*?\s*,?\s*)+(?:ft)?$")
MS_PART_TOTAL = re.compile(r"^\((\d{1,2})\)$")


@dataclass
class MsRow:
    q: int
    path: tuple
    start: tuple        # (page, y)
    end: tuple = None
    total_line: Line = None


def label_columns(ms_doc):
    """Per page, the x-range of the mark scheme's 'Question Number' column: from the table's left edge to the
    first vertical rule after it. Units place and style it differently (P1 labels bold at x≈61, M1 at x≈105,
    S1 not bold at x≈40), but every table rules its first column, and the scheme's maths fragments ('3', '12',
    a stray '(') sit to the right of that rule, so the column tells labels from fragments better than any fixed
    position or font could."""
    out = {}
    for pno, page in enumerate(ms_doc):
        xs = []
        for d in page.get_drawings():
            for it in d["items"]:
                if it[0] == "l" and abs(it[1].x - it[2].x) < 1 and abs(it[1].y - it[2].y) > 20:
                    xs.append(it[1].x)
                elif it[0] == "re" and it[1].width < 2.5 and it[1].height > 20:
                    xs.append(it[1].x0)
        xs = sorted(set(round(x) for x in xs))
        if len(xs) < 2:
            continue
        left = xs[0]
        right = next((x for x in xs if x > left + 12), None)
        # a first column is narrow; a 'column' spanning most of the page is a notes box drawn round the text
        if right is not None and right - left < 150:
            out[pno] = (left - 3, right + 2)
    return out


LABELISH = re.compile(r"^(?:\d{1,2}\s*\.?\s*)?\(?[a-h]\)?(?:\s*\(?(?:i|ii|iii|iv|v|vi)\)?)?$|^\d{1,2}\s*\(?[a-h]")


def fix_columns(columns, lines):
    """A page whose column holds no label while the paper's usual column does, on that page, measured a stray
    rule (P4 Oct 2023 p12 gave 40-61 where '3(i)' sits at 78): use the usual column there. Pages whose own
    column has its labels keep it (tables do change width between questions)."""
    if len(columns) < 3:
        return columns
    common = max(set(columns.values()), key=lambda c: sum(abs(o[0] - c[0]) < 6 and abs(o[1] - c[1]) < 6
                                                          for o in columns.values()))
    out = dict(columns)
    for pno, c in columns.items():
        if c == common:
            continue
        mine = [l for l in lines if l.page == pno and c[0] <= l.x0 < c[1] and LABELISH.match(l.text)]
        usual = [l for l in lines if l.page == pno and common[0] <= l.x0 < common[1] and LABELISH.match(l.text)]
        if not mine and usual:
            out[pno] = common
    return out


def label_x(lines):
    """Where this mark scheme prints its labels, from the labels themselves: the commonest left edge of lines
    that are nothing but a question label ('3(a)', '1a', '(b)'). For tables drawn without vertical rules."""
    xs = [round(l.x0) for l in lines
          if (MS_LABEL_BARE.match(l.text) or (MS_LABEL.match(l.text) and "(" in l.text and re.search(r"[a-h]\)", l.text)))]
    if not xs:
        return None
    best = max(set(xs), key=lambda x: sum(abs(y - x) <= 3 for y in xs))
    return (best - 10, best + 40)


def join_totals(lines):
    """Question totals that don't sit on one line of their own: '(10' over 'marks)' wrapped in a narrow Marks
    column (P4 Oct 2025), and a part's total then the question's on one line, '[1] [11]' (M2 Jan 2021: only the
    last one is the question's)."""
    out, used = [], set()
    for i, l in enumerate(lines):
        if i in used:
            continue
        if re.fullmatch(r"[(\[]?\d{1,2}", l.text):
            for j in range(i + 1, min(i + 8, len(lines))):
                m = lines[j]
                if (m.page == l.page and 0 < m.y0 - l.y0 < 24 and abs(m.x1 - l.x1) < 40
                        and re.fullmatch(r"marks?[)\]]?", m.text, re.I)):
                    l = Line(l.page, min(l.x0, m.x0), l.y0, max(l.x1, m.x1), m.y1, f"{l.text} {m.text}", l.bold or m.bold)
                    used.add(j)
                    break
        elif two := re.fullmatch(r"[(\[]\d{1,2}[)\]]\s+([(\[]\d{1,2}[)\]])", l.text):
            l = Line(l.page, l.x0, l.y0, l.x1, l.y1, two[1], l.bold)
        out.append(l)
    return out


def ms_split(ms_doc, questions):
    """Mark-scheme segments, one per label in the 'Question Number' column, and each question's notes."""
    lines = join_totals(read_lines(ms_doc, skip_cover=False, top=8))   # a row label can sit at y 11 (FP3 Jan 2021)
    items = content_items(ms_doc, lines)
    columns = fix_columns(label_columns(ms_doc), lines)
    fallback = label_x(lines)
    level1 = {}
    for q in questions:
        first = next((n.path[0] for n in q.parts if n.path), None)
        level1[q.number] = None if first is None else ("roman" if first in ROMAN else "letter")
    # the table starts on the first page whose 'Question' header sits in the first column
    # the first column's heading: 'Question Number', 'QUESTION', or just 'Q' (M2 2021–22)
    header_pages = {l.page for l in lines if l.x0 < 160 and HEADER.match(l.text)}
    totals = {q.number: q.total for q in questions}
    part_labels = {q.number: {x for n in q.parts for x in n.path} for q in questions}
    headers = [l for l in lines if l.x0 < 160 and (HEADER.match(l.text) or re.match(r"Number\b", l.text, re.I))]

    page_top = {}
    for l in lines:
        page_top[l.page] = min(page_top.get(l.page, 1e9), l.y0)

    def in_column(line):
        col = columns.get(line.page) or fallback
        return col is not None and col[0] <= line.x0 < col[1]

    col_top = {}            # the first label-sized line in each page's label column (not guidance prose
    for l in lines:         # that happens to start at the same x, as on M2 2026's first table page)
        col = columns.get(l.page) or fallback
        if in_column(l) and l.x1 <= col[1] + 20 and l.page not in col_top:
            col_top[l.page] = l.y0

    def under_header(line):
        """Where a new question's table begins: just below a 'Question Number' header row, as the first line of
        a page (M3 starts each question on a fresh page with no header), or as the first thing in the page's
        label column (M2 2026). There a plain '4' is a question number; anywhere else it's a digit of the maths."""
        return (line.y0 - page_top[line.page] < 3
                or col_top.get(line.page) == line.y0
                or any(h.page == line.page and 0 < line.y0 - h.y1 < 45 for h in headers))

    # The table starts at the first header, or at the first ruled first column holding question 1's label,
    # whichever comes first (some mark schemes print their header only on later pages, or not at all).
    starts = set(header_pages) | {l.page for l in lines if l.page in columns and in_column(l)
                                  and FIRST_LABEL.match(l.text)}
    if not starts:
        return [], {}, ["mark scheme: no 'Question Number' table header found"], lines, items
    first_page = min(starts)
    # where each page prints its mark codes (M1, A1, B1 …): a question's plain '(9)' total sits in that column
    codes = [l for l in lines if MARK_CODES.match(l.text)]
    by_page = {}
    for l in codes:
        by_page.setdefault(l.page, []).append(l.x0)
    marks_x = {pg: sorted(xs)[len(xs) // 2] for pg, xs in by_page.items()}
    marks_x_all = sorted(l.x0 for l in codes)[len(codes) // 2] if codes else 0
    rows, notes, problems = [], {}, []
    cur_q, path = None, ()
    expected = 1
    closed = False          # the current question's '(n marks)' line has passed: what follows is its notes
    for l in lines:
        if l.page < first_page:
            continue
        col = columns.get(l.page) or fallback
        t = MS_TOTAL.match(l.text) if rows and col and l.x0 > col[1] + 120 else None
        if t and t[3] and (int(t[3]) != totals.get(rows[-1].q)
                           or (not l.bold and l.x0 < marks_x.get(l.page, marks_x_all) - 40)):
            t = None    # a part's '(3)', or a '(9)' in the scheme's working (P4 Jan 2026), not the question's total
        if (not t and rows and col and l.bold and l.x0 > 480 and re.fullmatch(r"\d{1,2}", l.text)
                and int(l.text) == totals.get(rows[-1].q)):
            t = True    # the total alone, bold, at the foot of the Marks column (S1 Oct 2023, FP3 Jun 2025)
        if t and closed:
            continue        # a total after this question already closed: a question whose label was missed
        if t:
            r = rows[-1]
            r.total_line = l
            r.end = (l.page, l.y1 + PAD)
            closed = True
            continue
        # A label starts inside the column. Its line may overhang the rule a little when a stray '(' of the
        # scheme's maths is merged onto it ('(b) (i) (' in P1 Jan 2024), or run on with the scheme's text (S3).
        if col is None or not col[0] <= l.x0 < col[1]:
            continue
        long_line = l.x1 > col[1] + 20
        lead = MS_LABEL_LEAD.match(l.text)                  # also short: '(b) 10' (S1 Jan 2020)
        nlead = MS_NUM_LEAD.match(l.text) if long_line and not lead else None
        if nlead and not (int(nlead[1]) == expected and under_header(l)):
            nlead = None                                    # only right under a header, as the next question
        if long_line and not lead and not nlead:
            continue                                        # a line of scheme text that merely starts here
        if nlead:
            num, labs = nlead[1], []
        elif lead:
            num, labs = lead[1], re.findall(r"\(\s*([a-z]{1,4})\s*\)", lead[2])
        elif b := MS_LABEL_BARE.match(l.text):
            num, labs = b[1], [b[2], *(re.findall(r"\(\s*([a-z]{1,4})\s*\)", b[3]) if "(" in (b[3] or "")
                                       else [b[3]] if b[3] else [])]
        elif (m := MS_LABEL.match(l.text)) and (m[1] or m[2]):
            num, labs = m[1], re.findall(r"\(\s*([a-z]{1,4})\s*\)", m[2] or "")
        elif (MS_LETTER.match(l.text) and cur_q is not None and not closed
              and l.text in part_labels.get(cur_q, ())):        # a real part of this question, not an 'e' of the maths
            num, labs = None, [l.text]
        else:
            continue                                        # 'Notes', 'Alt', 'Way 2', 'Note 1' …
        if num and not labs and not l.bold and "." not in l.text and not (
                under_header(l) and (cur_q is None or closed)):
            continue    # a lone plain digit, unless it opens a table after the last question closed: maths
        if num:
            n = int(num)
            if n == cur_q and labs and not closed:
                pass                                        # '3(b)' after '3(a)': the same question (M1)
            elif n != expected:
                continue                                    # a stray number, not the next question
            else:
                cur_q, path, expected, closed = n, (), n + 1, False
        if cur_q is None or closed:
            continue                                        # before the table, or a label inside the notes
        for lab in labs:
            kind = "roman" if lab in ROMAN else "letter"
            outer = level1.get(cur_q) or kind
            if kind == outer:
                path = (lab,)
            elif path:
                path = (path[0], lab)
            else:
                path = (lab,)
        rows.append(MsRow(cur_q, path, (l.page, cut_above(l, items))))
    # each row runs to the next row's start; a question's last row to its '(n marks)' line
    for i, r in enumerate(rows):
        nxt = rows[i + 1] if i + 1 < len(rows) else None
        if nxt is not None and nxt.q == r.q:
            r.end = nxt.start
            r.total_line = None
        elif r.end is None:
            problems.append(f"MS Q{r.q}: no '(n marks)' line after its last row")
            r.end = nxt.start if nxt else (len(ms_doc) - 1, COL_Y1)
    # notes: from a question's '(n marks)' line to the top of the next question's table (its first labelled row
    # can sit under an unlabelled preamble row restating the question, which belongs to that question, not to the
    # notes before it); the last question's notes stop at Pearson's publisher footer
    by_q = {}
    for r in rows:
        by_q.setdefault(r.q, []).append(r)
    qnums = sorted(by_q)
    for i, qn in enumerate(qnums):
        last = by_q[qn][-1]
        if last.total_line is None:
            continue
        start = (last.total_line.page, last.total_line.y1 + 1)
        if i + 1 < len(qnums):
            first = by_q[qnums[i + 1]][0]
            floor = start[1] if first.start[0] == start[0] else 0
            top = table_top(ms_doc[first.start[0]], first.start[1], floor,
                            [h for h in headers if h.page == first.start[0]])
            if top < first.start[1] - 1:
                first.start = (first.start[0], top)
            end = first.start
        else:
            foot = next((l for l in lines if (l.page, l.y0) > start and FOOTER.match(l.text)), None)
            end = (foot.page, foot.y0 - 4) if foot else (len(ms_doc) - 1, COL_Y1)
        notes[qn] = (start, end)
    # a row's end is the next row's start: keep the row before a moved start in step
    for a, b in zip(rows, rows[1:]):
        if a.q == b.q and a.end != b.start:
            a.end = b.start
    return rows, notes, problems, lines, items


FOOTER = re.compile(r"^Pearson Education Limited\. Registered company", re.I)


def table_top(page, y_first, floor, headers=()):
    """Top of the ruled table a question's first row is in: the highest of the unbroken run of full-width
    horizontal rules (gaps under 90 pt) that ends at that row, no higher than `floor`, and below the table's
    'Question | Scheme | Marks' header row if it has one."""
    ys = set()
    for d in page.get_drawings():
        for it in d["items"]:
            if it[0] == "l" and abs(it[1].y - it[2].y) < 1 and abs(it[1].x - it[2].x) > 300:
                ys.add(round(it[1].y, 1))
        r = d["rect"]
        if r.height < 2.5 and r.width > 300:
            ys.add(round(r.y0, 1))
    head = max((h.y1 for h in headers if floor < h.y0 < y_first), default=None)
    if head is not None:
        floor = max(floor, head)
    above = sorted((y for y in ys if floor < y <= y_first + 3), reverse=True)
    if not above:
        return y_first
    top = above[0]
    for y in above[1:]:
        if top - y >= 90:
            break
        top = y
    return min(top - 1, y_first)


def ms_bands(start, end, items, lines):
    """Bands of mark-scheme content between two points, skipping each page's repeated table header."""
    bands = []
    for page in range(start[0], end[0] + 1):
        top = start[1] if page == start[0] else COL_Y0
        bottom = end[1] if page == end[0] else COL_Y1
        hdr = [l for l in lines if l.page == page and l.text in ("Question", "Number", "Scheme", "Marks")
               and top <= l.mid <= bottom]
        if hdr and page != start[0]:
            top = max(l.y1 for l in hdr) + 3
        inside = [it for it in items if it.page == page and top <= (it.y0 + it.y1) / 2 <= bottom
                  and not (it.kind == "drawing" and it.y1 - it.y0 > 300)]   # table's long column rules
        texts = [it for it in inside if it.kind == "text"]
        if texts:
            bands.append((page, max(top, min(it.y0 for it in inside) - PAD),
                          min(bottom, max(it.y1 for it in inside) + PAD)))
    return bands


def pair(questions, rows):
    """Map each part to its mark-scheme rows. A row belongs to the part whose path is a prefix of the row's
    path ('(b)(ii)' rows belong to part (b)), or to the parts it covers when the scheme is less specific."""
    out, problems = {}, []
    for q in questions:
        qrows = [r for r in rows if r.q == q.number]
        if not qrows:
            problems.append(f"Q{q.number}: no mark-scheme rows")
            continue
        for n in q.parts:
            mine = [r for r in qrows if r.path[:len(n.path)] == n.path or
                    (len(r.path) < len(n.path) and n.path[:len(r.path)] == r.path)]
            if not n.path:
                mine = qrows
            if not mine:
                problems.append(f"{n.label}: no mark-scheme rows (scheme has "
                                f"{[label_of(q.number, r.path) for r in qrows]})")
            out[n.label] = mine
        for r in qrows:
            if not any(r in v for v in out.values()):
                problems.append(f"MS {label_of(q.number, r.path)}: matches no part of the paper")
    return out, problems


# ---------------------------------------------------------------------------------------------- output

def slug(label, suffix=""):
    """'3(ii)(a)' -> 'q3_ii_a'."""
    return "q" + "_".join(re.findall(r"[0-9]+|[a-z]+", label)) + suffix


def render_bands(doc, bands, name, out_dir, paper_id, x0=COL_X0, x1=None):
    crops = []
    x1 = x1 if x1 is not None else right_edge(doc)
    for i, (page, y0, y1) in enumerate(bands):
        fname = name + (f"_{i + 1}" if len(bands) > 1 else "") + ".webp"
        clip = pymupdf.Rect(x0, y0, x1, y1)
        pix = doc[page].get_pixmap(dpi=DPI, clip=clip, colorspace=pymupdf.csGRAY)
        img = Image.frombytes("L", (pix.width, pix.height), pix.samples)
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=QUALITY, method=6)
        (out_dir / fname).write_bytes(buf.getvalue())
        crops.append({"src": f"{SUBJECT}/{paper_id}/{fname}", "w": pix.width, "h": pix.height,
                      "region": {"page": page + 1, "x0": round(x0, 1), "y0": round(y0, 1),
                                 "x1": round(x1, 1), "y1": round(y1, 1)}})
    return crops


KIND_DRAW = re.compile(r"\b(Sketch|Draw|Plot|Complete (the|Diagram|Grid|Table))\b", re.I)
KIND_SHORT = re.compile(r"^\W*(State|Explain|Describe|Give|Write down|Interpret|Comment|Suggest|Name)\b", re.I)


def text_in(bands, lines):
    out = [l.text for page, y0, y1 in bands for l in lines
           if l.page == page and y0 <= l.mid <= y1 and not RULED.match(l.text)]
    return " ".join(" ".join(out).split())


def guess_kind(text):
    body = LABEL.sub("", re.sub(r"^\d{1,2}\.\s*", "", text))
    if KIND_DRAW.search(text):
        return "draw"
    return "short" if KIND_SHORT.match(body) else "calc"


_INK = {}


def page_ink(doc, pno):
    """A page as greyscale pixels at 100 dpi, read once."""
    key = (doc.name, pno)
    if key not in _INK:
        pix = doc[pno].get_pixmap(dpi=100, colorspace=pymupdf.csGRAY)
        _INK[key] = (pix.width, pix.height, pix.stride, bytes(pix.samples))
    return _INK[key]


def clear_of_ink(doc, pno, y, limit=16):
    """y, or the nearest row above it (up to `limit` pt) with nothing printed across the column, so a crop edge
    there cuts through no glyph. Tall maths on a part's first line often sits wholly above the line's box (a
    numerator, the n over a Σ, the top of a matrix bracket, π/2), so the line's box alone can't tell where it
    starts. If no clear row is near, y stays."""
    w, h, stride, s = page_ink(doc, pno)
    k = 100 / 72
    x0, x1 = int(COL_X0 * k), int(right_edge(doc) * k) - 2

    def blank(r):
        return min(s[r * stride + x0: r * stride + x1]) >= 140

    def width(r):                               # how much of the row is ink, as a share of the column
        row = s[r * stride + x0: r * stride + x1]
        return sum(1 for v in row if v < 140) / max(1, x1 - x0)

    r = int(y * k)
    if r >= h:
        return y
    top = r
    if not blank(r):
        top = next((rr for rr in range(r - 1, max(0, r - int(limit * k)), -1) if blank(rr)), None)
        if top is None:
            return y
    # Stacked maths can rise further in narrow pieces with gaps between them (a column vector's top entry,
    # FP3 Jun 2023): keep climbing past narrow ink close above, up to 30 pt, never into a full line of text.
    while True:
        above = [rr for rr in range(top - 1, max(0, top - int(8 * k)), -1) if not blank(rr)]
        if not above or r - above[-1] > 30 * k:
            break
        if max(width(rr) for rr in above) > 0.4:
            break
        nxt = next((rr for rr in range(above[0], max(0, above[0] - int(limit * k)), -1) if blank(rr)), None)
        if nxt is None or r - nxt > 30 * k:
            break
        top = nxt
    return top / k if top != r else y


def clear_edges(doc, questions):
    """Move each question's crop boundaries off printed ink: the top of its first crop, and every boundary two
    of its crops share (both move, so nothing is lost or shown twice)."""
    for q in questions:
        refs = [(n, i) for n in q.nodes for i in range(len(n.bands))]
        if not refs:
            continue
        n, i = refs[0]
        p, y0, y1 = n.bands[i]
        n.bands[i] = (p, clear_of_ink(doc, p, y0), y1)
        for (na, ia), (nb, ib) in zip(refs, refs[1:]):
            pa, y0a, y1a = na.bands[ia]
            pb, y0b, y1b = nb.bands[ib]
            if pa == pb and abs(y1a - y0b) < 0.6:
                y = clear_of_ink(doc, pb, y0b)
                if y0a + 5 < y < y0b:
                    na.bands[ia] = (pa, y0a, y)
                    nb.bands[ib] = (pb, y, y1b)


# 'Diagram 1', 'Copy of Diagram 1', and a spare 'Copy of Figure 2' (FP2 Jan 2022); a plain 'Figure N' on a later
# page can be the last part's own figure, so it doesn't move
DIAGRAM_CAPTION = re.compile(r"^(?:(?:Copy of )?Diagram|Copy of Figure) (\d+)$", re.I)


def move_diagram_pages(questions, lines):
    """A figure the student draws on is reprinted as 'Diagram N' (and often again as 'Copy of Diagram N', to
    redraw on) on a later page. Being after the question's last part, that page was cropped into the last part;
    it belongs to the part that says 'On Diagram N' / 'Using Diagram N' (or else first mentions it)."""
    for q in questions:
        parts = [n for n in q.nodes if n.role == "part"]
        for n in parts:
            for band in list(n.bands[1:]):              # a continuation page, never a part's own first crop
                p, y0, y1 = band
                caps = [DIAGRAM_CAPTION.match(l.text) for l in lines
                        if l.page == p and y0 <= l.y0 <= y1 and DIAGRAM_CAPTION.match(l.text)]
                if not caps:
                    continue
                d = caps[0][1]
                kind = "Figure" if "figure" in caps[0][0].lower() else "Diagram"
                others = [(m, text_in(m.bands, lines)) for m in parts if m is not n]
                use = re.compile(rf"\b(?:On|Using|use)\s+{kind}\s+{d}\b", re.I)
                target = (next((m for m, s in others if use.search(s)), None)
                          or next((m for m, s in others if re.search(rf"\b{kind}\s+{d}\b", s)), None))
                if target is not None:
                    n.bands.remove(band)
                    target.bands.append(band)
                    target.bands.sort()


def export(paper_id, doc, questions, lines, ms_doc, rows, notes, ms_lines, ms_items, matched):
    move_diagram_pages(questions, lines)
    clear_edges(doc, questions)
    out = CACHE / "segments" / paper_id
    crops = out / "crops"
    crops.mkdir(parents=True, exist_ok=True)
    for old in crops.glob("*.webp"):
        old.unlink()
    qs = []
    for q in questions:
        stem = next((n for n in q.nodes if n.role == "stem"), None)
        rendered_intros = {}
        parts = []
        for n in q.parts:
            intro = []
            if n.intro is not None:
                key = id(n.intro)
                if key not in rendered_intros:
                    rendered_intros[key] = render_bands(doc, n.intro.bands, slug(n.intro.label, "_intro"),
                                                        crops, paper_id)
                intro = rendered_intros[key]
            ms_crop_bands = []
            for r in matched.get(n.label, []):
                ms_crop_bands += ms_bands(r.start, r.end, ms_items, ms_lines)
            text = text_in(n.bands, lines)
            parts.append({
                "label": n.label,
                "marks": n.marks,
                "kind": guess_kind((text_in(n.intro.bands, lines) + " " if n.intro else "") + text),
                "topics": [],
                "tagStatus": "none",
                **({"intro": intro} if intro else {}),
                "qp": render_bands(doc, n.bands, slug(n.label), crops, paper_id),
                "ms": render_bands(ms_doc, ms_crop_bands, slug(n.label, "_ms"), crops, paper_id, 36, 560),
                "text": text,
            })
        note = []
        if q.number in notes:
            note = render_bands(ms_doc, ms_bands(*notes[q.number], ms_items, ms_lines),
                                slug(str(q.number), "_notes"), crops, paper_id, 36, 560)
        qs.append({"id": f"{paper_id}_q{q.number}", "number": q.number, "marks": q.total,
                   "stem": render_bands(doc, stem.bands, slug(stem.label, "_stem"), crops, paper_id) if stem else [],
                   "parts": parts,
                   **({"msNotes": note} if note else {}),
                   "check": "pending"})
    paper = {"id": paper_id, "subject": SUBJECT, "questions": qs}
    (out / "paper.json").write_text(json.dumps(paper, indent=1, ensure_ascii=False) + "\n")
    files = list(crops.glob("*.webp"))
    return out, len(files), sum(f.stat().st_size for f in files)


def preview(doc, questions, out_dir):
    """One PNG per page with each node's bands outlined (stem grey, intro blue, part red)."""
    out_dir.mkdir(parents=True, exist_ok=True)
    colours = {"stem": (120, 120, 120), "intro": (30, 90, 220), "part": (220, 40, 40)}
    pages = {}
    for q in questions:
        for n in q.nodes:
            for page, y0, y1 in n.bands:
                pages.setdefault(page, []).append((n, y0, y1))
    scale = 100 / 72
    paths = []
    for page, boxes in sorted(pages.items()):
        pix = doc[page].get_pixmap(dpi=100)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        d = ImageDraw.Draw(img)
        for n, y0, y1 in boxes:
            c = colours[n.role]
            d.rectangle([COL_X0 * scale, y0 * scale, COL_X1 * scale, y1 * scale], outline=c, width=2)
            d.text((COL_X1 * scale - 90, y0 * scale + 2), f"{n.label} {n.role} {n.marks or ''}", fill=c)
        p = out_dir / f"p{page + 1:02}.png"
        img.save(p)
        paths.append(p)
    return paths


DURATION = re.compile(r"Time:\s*(?:(\d)\s*hours?)?\s*(?:(\d{1,2})\s*minutes?)?", re.I)
QUESTION_OF = re.compile(r"^(?:MS )?(?:Q(\d{1,2})\b|(\d{1,2})(?:\(|:))")


def duration_min(doc):
    """Exam length from the cover, e.g. '(Time: 1 hour 30 minutes)' -> 90."""
    m = DURATION.search(" ".join(doc[0].get_text().split()))
    return int(m[1] or 0) * 60 + int(m[2] or 0) if m and (m[1] or m[2]) else None


def problems_by_question(problems):
    """Each segmenter problem under the question(s) it is about; the rest are about the whole paper."""
    out, paper = {}, []
    for p in problems:
        if m := re.match(r"total line for question (\d+) inside question (\d+)", p):
            for n in (int(m[1]), int(m[2])):
                out.setdefault(n, []).append(p)
        elif m := QUESTION_OF.match(p):
            out.setdefault(int(m[1] or m[2]), []).append(p)
        else:
            paper.append(p)
    return out, paper


def write_registry(paper_id, doc, ms_doc, out_dir, problems):
    """registry/maths/papers/<id>.json, in the same shape as Physics (src/lib/papers/types.ts). Questions start
    'pending'. Each one carries risks: the shared crop checks (pipeline/risks.py: content cut by an edge, text
    after the marks, a part across pages) plus any segmenter problem about it, so a paper the segmenter isn't
    sure of in one place can still be written, and only that question waits for a person. A problem with the
    whole paper (no questions found, no mark-scheme table) stops the write."""
    sys.path.insert(0, str(ROOT / "pipeline"))
    import risks
    import reviews
    by_q, whole = problems_by_question(problems)
    if whole:
        print("not writing the registry file: " + "; ".join(whole))
        return None
    sources = json.loads(units.SOURCES.read_text())
    entry = next(p for p in sources["papers"] if p["id"] == paper_id)
    providers = sources["providers"]

    def source(kind):
        f = entry[kind]
        prov = providers[f["via"]]
        return {"url": f["url"], "via": {"name": prov["name"], "url": prov["url"], "credit": prov["credit"]}}

    seg = json.loads((out_dir / "paper.json").read_text())
    paper = {
        "id": paper_id, "subject": SUBJECT, "unit": entry["unit"], "series": entry["series"],
        **({"variant": entry["variant"]} if entry.get("variant") else {}),
        "totalMarks": sum(q["marks"] or 0 for q in seg["questions"]),
        "durationMin": duration_min(doc),
        "source": {"qp": source("qp"), "ms": source("ms")},
        "questions": seg["questions"],
    }
    pages = risks.Pages(doc)
    for q in paper["questions"]:
        # A Maths part often opens with its set-up ('Given that θ > 90 (b) find …'): that's its own text, so
        # only a label missing from the part altogether is a risk.
        texts = {p["label"]: p.get("text", "") for p in q["parts"]}
        shared = [r for r in risks.text_risks(q) if not (
            r.endswith("text doesn't start at its label")
            and any(h in texts.get(r.split(":")[0], "") for h in risks.label_heads(q["number"], r.split(":")[0])))]
        found = risks.edge_risks(q, pages) + shared + by_q.get(q["number"], [])
        if found:
            q["risks"] = found
    reviews.apply(paper, reviews.load(SUBJECT, paper_id))
    path = ROOT / "registry" / SUBJECT / "papers" / f"{paper_id}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(paper, indent=1, ensure_ascii=False) + "\n")
    return path


def main():
    paper_id = sys.argv[1]
    doc = open_pdf(PDF / f"{paper_id}_qp.pdf")
    lines = read_lines(doc)
    items = content_items(doc, lines)
    questions = outline(lines, items)
    regions(questions, items, len(doc))
    for q in questions:
        print(f"Q{q.number} [{q.total}]")
        for n in q.nodes:
            where = ", ".join(f"p{p + 1} {y0:.0f}–{y1:.0f}" for p, y0, y1 in n.bands)
            print(f"   {n.role:5} {n.label:10} {n.marks or '':>2}   {where}")
    problems = check(questions)
    total = sum(q.total or 0 for q in questions)
    print(f"\n{len(questions)} questions, {total} marks")

    ms_doc = open_pdf(PDF / f"{paper_id}_ms.pdf")
    rows, notes, ms_problems, ms_lines, ms_items = ms_split(ms_doc, questions)
    matched, pair_problems = pair(questions, rows)
    print(f"mark scheme: {len(rows)} labelled rows, notes for {len(notes)} questions")
    for p in problems + ms_problems + pair_problems:
        print("  !! " + p)

    if "--preview" in sys.argv:
        out = CACHE / "segments" / paper_id / "preview"
        print(f"preview: {len(preview(doc, questions, out))} pages in {out}")
    if "--render" in sys.argv or "--write" in sys.argv:
        out, n, size = export(paper_id, doc, questions, lines, ms_doc, rows, notes, ms_lines, ms_items, matched)
        print(f"render: {n} crops, {size / 1024:.0f} KB, in {out}")
    if "--write" in sys.argv:
        path = write_registry(paper_id, doc, ms_doc, out, problems + ms_problems + pair_problems)
        if path:
            print(f"registry: {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
