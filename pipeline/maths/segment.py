"""Segment an IAL Mathematics / Further Mathematics paper into questions and pair each with its mark scheme.

Usage:  pipeline/.venv/bin/python pipeline/maths/segment.py WMA11_2024_01             outline + checks
        pipeline/.venv/bin/python pipeline/maths/segment.py WMA11_2024_01 --preview   overlay PNG per page
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

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "pipeline" / "cache"
PDF = CACHE / "pdf"
SUBJECT = "maths"

DPI, QUALITY = 150, 70                      # same as Physics crops
COL_X0, COL_X1 = 36, 559                    # the printed column; margins hold 'DO NOT WRITE IN THIS AREA'
COL_Y0, COL_Y1 = 40, 790                    # below 790: barcode, page number, 'Turn over'
PAD = 4

Q_START = re.compile(r"^(\d{1,2})[.:]\s*(.*)$")          # '5.'; June 2025 papers print '5:'
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

def read_lines(doc, skip_cover=True, top=COL_Y0):
    """Text lines in the printed column. `top`: mark-scheme pages have no furniture above the column, and
    a table row continued onto a new page can put its label at y≈29 (FP3 Jan 2024), so they read from 20."""
    lines = []
    for pno, page in enumerate(doc):
        if skip_cover and pno == 0:
            continue
        for b in page.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                spans = [s for s in l["spans"] if s["text"].strip()]
                if not spans:
                    continue
                x0, y0, x1, y1 = l["bbox"]
                if x1 < COL_X0 or x0 > COL_X1 or y0 < top or y0 > COL_Y1:
                    continue
                text = " ".join("".join(s["text"] for s in l["spans"]).split())
                lines.append(Line(pno, x0, y0, x1, y1, text, any("Bold" in s["font"] for s in spans)))
    lines.sort(key=lambda l: (l.page, round(l.y0), l.x0))
    if skip_cover:
        # An A paper (2025–26) is the question paper and a separate answer book in one PDF: the book repeats
        # every question's total line. The questions all come first, so read only up to the book's cover.
        book = next((l.page for l in lines if l.bold and ANSWER_BOOK.match(l.text)), None)
        if book is not None:
            lines = [l for l in lines if l.page < book]
    return lines


def content_items(doc, lines):
    """What's printed in the column: text (minus answer lines and page furniture), drawings (minus the page
    frame and hairlines) and images."""
    items = [Item(l.page, l.y0, l.y1, "text") for l in lines
             if not (RULED.match(l.text) or CONTINUED.match(l.text) or TOTAL.match(l.text)
                     or NOT_CONTENT.match(l.text))]
    for pno, page in enumerate(doc):
        for d in page.get_drawings():
            r = d["rect"]
            if r.x1 < COL_X0 or r.x0 > COL_X1 or r.y1 < COL_Y0 or r.y0 > COL_Y1:
                continue
            if (r.width > 500 and r.height > 700) or (r.width > 400 and r.height < 1.5):
                continue                                    # page frame, answer rules, separators
            items.append(Item(pno, max(r.y0, COL_Y0), min(r.y1, COL_Y1), "drawing"))
        for img in page.get_image_info():
            x0, y0, x1, y1 = img["bbox"]
            if x1 < COL_X0 + 5 or x0 > COL_X1 - 5:
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
        m = Q_START.match(l.text)
        if m and l.bold and l.x0 < 60 and int(m[1]) == (q.number + 1 if q else 1):
            q = Question(int(m[1]), l)
            questions.append(q)
            pending, path, level1, prev_mark, first_label = [], (), None, None, None
            rest = m[2]
        elif q is None:
            continue
        else:
            rest = l.text
        if t := TOTAL.match(l.text):
            if t[1] and int(t[1]) != q.number:
                q.problems.append(f"total line for question {t[1]} inside question {q.number}")
            q.total, q.total_line = int(t[2]), l
            continue
        # labels at the start of the line (possibly several: '(a) (i) …')
        if l.x0 < 100:
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
                start_line = next(x for x in lines if (x.page, x.y0) > (prev_mark.page, prev_mark.y1 - 1)
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
MS_LABEL_BARE = re.compile(r"^(\d{1,2})\s*([a-h])\s*((?:\(\s*(?:i|ii|iii|iv|v|vi)\s*\)\s*)*)$")   # M2: '1a', '2b(ii)'
# A label at the start of a line, with the scheme's text after it on the same line (S3: '2. (a) Number all …').
MS_LABEL_LEAD = re.compile(r"^(?:(\d{1,2})\s*\.\s*)?((?:\(\s*[a-z]{1,4}\s*\)\s*)+)(?=\S)")
# A question's closing total, in each unit's style: '(7 marks)' (P), '(Total 5 marks)' (FP), 'Total 8' (S1),
# '(6)' (M1, bold), '[8]' (S3, bold), '(9)' (M3, plain, after bold part totals '[5]'). The bracketed forms look
# just like part totals and boldness differs by unit, so they count only when the number is the question's
# total as printed on the question paper.
MS_TOTAL = re.compile(r"^(?:\((?:Total\s+)?(\d{1,2})\s+marks?\)|Total\s+(\d{1,2})(?:\s+marks?)?|[(\[](\d{1,2})[)\]])$", re.I)
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


def label_x(lines):
    """Where this mark scheme prints its labels, from the labels themselves: the commonest left edge of lines
    that are nothing but a question label ('3(a)', '1a', '(b)'). For tables drawn without vertical rules."""
    xs = [round(l.x0) for l in lines
          if (MS_LABEL_BARE.match(l.text) or (MS_LABEL.match(l.text) and "(" in l.text and re.search(r"[a-h]\)", l.text)))]
    if not xs:
        return None
    best = max(set(xs), key=lambda x: sum(abs(y - x) <= 3 for y in xs))
    return (best - 10, best + 40)


def ms_split(ms_doc, questions):
    """Mark-scheme segments, one per label in the 'Question Number' column, and each question's notes."""
    lines = read_lines(ms_doc, skip_cover=False, top=20)
    items = content_items(ms_doc, lines)
    columns = label_columns(ms_doc)
    fallback = label_x(lines)
    level1 = {}
    for q in questions:
        first = next((n.path[0] for n in q.parts if n.path), None)
        level1[q.number] = None if first is None else ("roman" if first in ROMAN else "letter")
    # the table starts on the first page whose 'Question' header sits in the first column
    header_pages = {l.page for l in lines if l.x0 < 160 and re.match(r"Question\b(?! Paper)", l.text, re.I)}
    totals = {q.number: q.total for q in questions}
    headers = [l for l in lines if l.x0 < 160 and re.match(r"(Question|Number)\b(?! Paper)", l.text, re.I)]

    page_top = {}
    for l in lines:
        page_top[l.page] = min(page_top.get(l.page, 1e9), l.y0)

    def under_header(line):
        """Where a new question's table begins: just below a 'Question Number' header row, or as the first line
        of a page (M3 starts each question on a fresh page with no header, and numbers it with a plain '4',
        the same as a stray digit of the maths elsewhere)."""
        return (line.y0 - page_top[line.page] < 3
                or any(h.page == line.page and 0 < line.y0 - h.y1 < 45 for h in headers))
    if not header_pages:
        return [], {}, ["mark scheme: no 'Question Number' table header found"], lines, items
    first_page = min(header_pages)
    rows, notes, problems = [], {}, []
    cur_q, path = None, ()
    expected = 1
    closed = False          # the current question's '(n marks)' line has passed: what follows is its notes
    for l in lines:
        if l.page < first_page:
            continue
        col = columns.get(l.page) or fallback
        t = MS_TOTAL.match(l.text) if rows and col and l.x0 > col[1] + 120 else None
        if t and t[3] and int(t[3]) != totals.get(rows[-1].q):
            t = None                                        # a part's '(3)', not the question's total
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
        lead = MS_LABEL_LEAD.match(l.text) if long_line else None
        if long_line and not lead:
            continue                                        # a line of scheme text that merely starts here
        if lead:
            num, labs = lead[1], re.findall(r"\(\s*([a-z]{1,4})\s*\)", lead[2])
        elif b := MS_LABEL_BARE.match(l.text):
            num, labs = b[1], [b[2], *re.findall(r"\(\s*([a-z]{1,4})\s*\)", b[3] or "")]
        elif (m := MS_LABEL.match(l.text)) and (m[1] or m[2]):
            num, labs = m[1], re.findall(r"\(\s*([a-z]{1,4})\s*\)", m[2] or "")
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
    # notes: from a question's '(n marks)' line to the next question's first row
    by_q = {}
    for r in rows:
        by_q.setdefault(r.q, []).append(r)
    qnums = sorted(by_q)
    for i, qn in enumerate(qnums):
        last = by_q[qn][-1]
        if last.total_line is None:
            continue
        start = (last.total_line.page, last.total_line.y1 + 1)
        end = by_q[qnums[i + 1]][0].start if i + 1 < len(qnums) else (len(ms_doc) - 1, COL_Y1)
        notes[qn] = (start, end)
    return rows, notes, problems, lines, items


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


def render_bands(doc, bands, name, out_dir, paper_id, x0=COL_X0, x1=COL_X1):
    crops = []
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


def export(paper_id, doc, questions, lines, ms_doc, rows, notes, ms_lines, ms_items, matched):
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


def main():
    paper_id = sys.argv[1]
    doc = pymupdf.open(PDF / f"{paper_id}_qp.pdf")
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

    ms_doc = pymupdf.open(PDF / f"{paper_id}_ms.pdf")
    rows, notes, ms_problems, ms_lines, ms_items = ms_split(ms_doc, questions)
    matched, pair_problems = pair(questions, rows)
    print(f"mark scheme: {len(rows)} labelled rows, notes for {len(notes)} questions")
    for p in problems + ms_problems + pair_problems:
        print("  !! " + p)

    if "--preview" in sys.argv:
        out = CACHE / "segments" / paper_id / "preview"
        print(f"preview: {len(preview(doc, questions, out))} pages in {out}")
    if "--render" in sys.argv:
        out, n, size = export(paper_id, doc, questions, lines, ms_doc, rows, notes, ms_lines, ms_items, matched)
        print(f"render: {n} crops, {size / 1024:.0f} KB, in {out}")


if __name__ == "__main__":
    main()
