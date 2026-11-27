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
ANSWER_BOOK = re.compile(r"^Answer Book$", re.I)
LABEL = re.compile(r"^\(([a-h]|i|ii|iii|iv|v|vi|vii|viii|ix|x)\)\s*")
MARK = re.compile(r"^\((\d{1,2})\)$")
# '(Total for Question 5 is 10 marks)'; papers up to about 2022 print just '(Total 10 marks)'
TOTAL = re.compile(r"^\(Total (?:for Question (\d{1,2}) (?:is|=) )?(\d{1,2}) marks?\)")
CONTINUED = re.compile(r"^Question \d{1,2} (?:continued|continues on (?:the next )?page)")
RULED = re.compile(r"^_{10,}$")
NOT_CONTENT = re.compile(r"^(BLANK PAGE|TOTAL FOR PAPER|END)\b", re.I)
ROMAN = {"i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"}
BELOW_DIAGRAM = re.compile(
    r"\b(?:(?:on|using|in)\s+(?:the\s+)?(?:grid|axes|Venn diagram|tree diagram|diagram|graph)\s+below|"
    r"(?:grid|axes|Venn diagram|tree diagram)\s+below)\b", re.I)


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
    x0: float = 0.0
    width: float = 0.0
    is_mark: bool = False


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


def read_lines(doc, skip_cover=True, top=COL_Y0, ms=False):
    """Text lines in the printed column. `top`: mark-scheme pages have no furniture above the column, and
    a table row continued onto a new page can put its label at y≈29 (FP3 Jan 2024), so they read from 20."""
    lines = []
    right = right_edge(doc)
    for pno, page in enumerate(doc):
        if skip_cover and pno == 0:
            continue
        x_left = 4 if ms else COL_X0
        x_right = (page.rect.width - 4) if ms else right
        y_bot = (page.rect.height - 6) if ms else COL_Y1
        for b in page.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                spans = [s for s in l["spans"] if s["text"].strip()]
                if not spans:
                    continue
                x0, y0, x1, y1 = l["bbox"]
                if x1 < x_left or x0 > x_right or y0 < top or y0 > y_bot:
                    continue
                text = " ".join("".join(unshift(s["text"]) for s in l["spans"]).split())
                if STAMP.search(text):
                    continue                    # a stamp added by whoever first shared the paper, not Pearson's
                if ms and text == "PMT" and y0 < 20 and x0 > page.rect.width - 50:
                    continue                    # PMT watermark in the top-right margin
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


def content_items(doc, lines, ms=False):
    """What's printed in the column: text (minus answer lines and page furniture), drawings (minus the page
    frame and hairlines) and images."""
    items = [Item(l.page, l.y0, l.y1, "text", l.x0, l.x1 - l.x0,
                  not ms and l.bold and l.x0 > 470 and bool(MARK.match(l.text)))
             for l in lines
             if not (RULED.match(l.text) or CONTINUED.match(l.text) or TOTAL.match(l.text)
                     or NOT_CONTENT.match(l.text))]
    right = right_edge(doc)
    for pno, page in enumerate(doc):
        x_left = 4 if ms else COL_X0
        x_right = (page.rect.width - 4) if ms else (right - 2)
        y_top = 8 if ms else COL_Y0
        y_bot = (page.rect.height - 6) if ms else COL_Y1
        for d in page.get_drawings():
            r = d["rect"]
            if r.x1 < x_left or r.x0 > x_right or r.y1 < y_top or r.y0 > y_bot:
                continue
            frame = (r.width > page.rect.width - 95 and r.height > page.rect.height - 140) if ms else (r.width > 500 and r.height > 700)
            if frame or (r.width > 400 and r.height < 1.5):
                continue                                    # page frame, answer rules, separators
            fill = d.get("fill")
            if d.get("color") is None and fill and min(fill) > 0.98:
                continue                                    # white on white: invisible (P2 Jun 2025 answer pages)
            items.append(Item(pno, max(r.y0, y_top), min(r.y1, y_bot), "drawing", r.x0, r.width))
        for img in page.get_image_info():
            x0, y0, x1, y1 = img["bbox"]
            if x1 < x_left + 5 or x0 > x_right - 3:
                continue
            items.append(Item(pno, max(y0, y_top), min(y1, y_bot), "image", x0, x1 - x0))
    return items


def cut_above(line, items):
    """Where a crop starting at `line` may begin: just above it, or above stacked maths on the same line that
    rises higher (a fraction's numerator, a surd's bar). MathType sets those as separate small pieces."""
    y = line.y0
    for it in items:
        if (it.page == line.page and not it.is_mark and it.y0 < line.y0 - 1 and line.y0 - it.y0 < 30
                and (it.y1 > line.mid or (it.y1 > line.y0 + 2.6 and it.width < 120))):
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
                # '(i)' after '(h)' is the letter i, unless an '(ii)' follows (S1 Jan 2021 5(i))
                if (lab == "i" and level1 == "letter" and path == ("h",)
                        and not any(o.page in (l.page, l.page + 1) and (o.page, o.y0) > (l.page, l.y0)
                                    and (o.page, o.y0) < (l.page, l.y0 + 400) and re.match(r"^\(ii\)", o.text)
                                    for o in lines)):
                    kind = "letter"
                level1 = level1 or kind
                if kind == level1:
                    path = (lab,)
                elif path:
                    path = (path[0], lab)
                else:
                    q.problems.append(f"Q{q.number}: label ({lab}) with no outer label")
                    path = (lab,)
                # '(ii)' whose '(i)' sits inside the line above ('Find (i) the centre of C,' then '(ii) the radius of
                # C.', one mark for both: FP2 Jun 2021 2): the part starts at that line
                at = l
                if lab == "ii" and not pending:
                    at = next((o for o in lines if o.page == l.page and l.y0 - 40 < o.y0 < l.y0 - 4 and o.x0 < 100
                               and re.search(r"\S\s*\(i\)\s", o.text)), l)
                pending.append((path, at))
                first_label = first_label or at
                rest = rest[lm.end():]
        mm = MARK.match(l.text)
        if mm and l.bold and l.x0 > 470:
            marks = int(mm[1])
            # a parent opened with its first sub-part ('(i)' and its set-up, then '(a) …' and the mark): the
            # block is that sub-part, the parent's text its intro. Longer runs only when they share a line.
            chain = len(pending) > 1 and all(b[0][:len(a[0])] == a[0] and len(b[0]) > len(a[0])
                                             and (len(pending) == 2 or a[1] is b[1])
                                             for a, b in zip(pending, pending[1:])) \
                and pending[-1][0][-1] in ("a", "i")      # a first sub-part ('(ii)' alone means an inline '(i)')
            if chain:
                # '(i) (a) …' then the mark: (i) opened with its first sub-part, so the block is (i)(a) (FP1 Jan
                # 2025 Q7 read it as (i), and (i)'s rows took (a)'s, (b)'s and (c)'s)
                bpath = pending[-1][0]
            elif pending:
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
                # limit hanging under the mark's own line ('2' at y 211 by a '(3)' at 206-223) is still that row.
                # When the part ended with an inline 'grid/diagram below', skip interior/axis labels (x0 > 105).
                prev_node = q.parts[-1] if q.parts else None
                prev_txt = (" ".join(x.text for x in lines
                                     if (prev_node.start[0], prev_node.start[1]) <= (x.page, x.y0) <= (prev_mark.page, prev_mark.y1))
                            if prev_node else "")
                skip_below = bool(BELOW_DIAGRAM.search(prev_txt))
                start_line = next(x for x in lines if (x.page, x.y0) > (prev_mark.page, prev_mark.mid)
                                  and not RULED.match(x.text) and not CONTINUED.match(x.text)
                                  and not (skip_below and x.page == prev_mark.page and x.x0 > 105 and not LABEL.match(x.text)))
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
MS_LETTER = re.compile(r"^(?:[a-h]|i|ii|iii|iv|v|vi|[a-h](?:i|ii|iii|iv|v|vi))$")       # a part alone, under its number: '1' then 'a' (M2 2026)
FIRST_LABEL = re.compile(r"^1(?:\s*\.|\s*\(?[a-h]\)?)?(?:\s*\(\s*[a-z]{1,4}\s*\))*\s*$")   # question 1's label: '1', '1.', '1a', '1(a)'
HEADER = re.compile(
    r"^(?:1?Questio(?:n(?:\s+(?:Number|No\.?|Scheme|Marks|Answer|Solution)\b.*)?)?"
    r"|QUESTION(?:\s+(?:NUMBER|SCHEME|MARKS|ANSWER|SOLUTION)\b.*)?"
    r"|Q(?:\s+(?:Scheme|Answer|Solution|Marks)\b.*)?)$"
)
MS_LABEL_BARE = re.compile(r"^(\d{1,2})\s*\.?\s*([a-h])\s*((?:\(\s*(?:i|ii|iii|iv|v|vi)\s*\)\s*)*|(?:i|ii|iii|iv|v|vi))$")   # M2: '1a', '2b(ii)'; P1 Oct 2023: '7ai'; M2 Jan 2022: '2.a'
MS_LABEL_BARE_LEAD = re.compile(r"^(\d{1,2})\s*([a-h])\s+(?=\S)")    # M1/M2: '7a Use of ...', '3b Resolve ...'
# A label at the start of a line, with the scheme's text after it on the same line (S3: '2. (a) Number all …',
# S1 Oct 2021: '1 (a) [Sum of probs …', no dot).
# Greedy, and only when text follows: a bare '(b)(i)' must not backtrack to '(b)' with '(i)' as its "text"
# (nested (i)/(ii) rows then lost their (i)); text that itself opens with '(' ('(a) (0.2 + …)', S1) still counts.
MS_LABEL_LEAD_RE = re.compile(r"^(?:(\d{1,2})\s*\.?\s*)?((?:\(\s*[a-z]{1,4}\s*\)\s*)+)")


class _Lead:
    @staticmethod
    def match(text):
        m = MS_LABEL_LEAD_RE.match(text)
        return m if m and text[m.end():].strip() else None


MS_LABEL_LEAD = _Lead
# A question with no parts, its number running on into the scheme (S1 Jan 2020: '1. [Sum of probs = 1 gives]').
MS_NUM_LEAD = re.compile(r"^(\d{1,2})\s*\.\s+(?=\S)")
# A question's closing total, in each unit's style: '(7 marks)' (P), '(Total 5 marks)' (FP), 'Total 8' (S1),
# '(6)' (M1, bold), '[8]' (S3, bold), '(9)' (M3, plain, after bold part totals '[5]'). The bracketed forms look
# just like part totals and boldness differs by unit, so they count only when the number is the question's
# total as printed on the question paper.
# Also '7 marks', '[7 marks]', '(7marks)', '7 Marks' in other series.
# Also '[Total 14]' (S2 2023), 'Notes [14]', and 'A1cao [8]' / 'A1A1 (8)' (FP2).
MS_TOTAL = re.compile(
    r"^(?:[(\[]?(?:Total\s+)?(\d{1,2})\s*marks?[)\]]?|[(\[]?Total\s*:?\s*(\d{1,2})(?:\s+marks?)?[)\]]?"
    r"|(?:Notes\s+)?(?:(?:d{0,2}[MABE]\d(?:\*|ft|cao|cso|oe)?\s*,?\s*)+)?[(\[](\d{1,2})[)\]])$",
    re.I)
MARK_CODES = re.compile(r"^(?:d{0,2}[MABE]\d(?:\*|ft|cao|cso|oe)?\s*,?\s*)+(?:ft)?$", re.I)
MS_PART_TOTAL = re.compile(r"^\((\d{1,2})\)$")
MS_PART_SUB = re.compile(r"^(?:(?:d{0,2}[MABE]\d(?:\*|ft|cao|cso|oe)?\s*,?\s*)+)?[(\[](\d{1,2})[)\]]$", re.I)
ALT_LEAD = re.compile(r"^(?:(?:\d{1,2}\s*\.?\s*)?\(\s*[a-h]\s*\)\s*(?:ALT|Alt|Alternative|ALTERNATIVE)\b|ALT\b|Alt\b|ALTERNATIVE\b|Alternative\b|Aliter\b|SC\s*:|Other\s+possible\b|N\.\s?B\.|or\s*$|Way\s*(?:\d|One|Two|Three)|Example\b|(?:e\.g\.?\s*)?Middle\s+(?:Left|Right)\b|e\.g\.?\s*(?:Left|Right)\s+to\s+(?:Left|Right)\b|Notes\s+for\s+part\b)", re.I)
POST_ALT = re.compile(r"^(?:(?:Alt|ALT|Alternative|Aliter|Way\s*(?:\d|One|Two|Three))\s*(?:(?:\d|I{1,3}|IV)\s+(?=\())?(?:\(\s*([a-h]|i|ii|iii)\s*\))?|(?:(?:\d{1,2}\s*\.?\s*)?\(\s*([a-h]|i|ii|iii)\s*\)\s*(?:Alt|ALT|Alternative|Aliter|Way\s*(?:\d|One|Two|Three))))\s*:?\s*$", re.I)
PROSE_NOTE = re.compile(r"^(?:M\d|A\d|B\d|dM\d|ddM\d|Main\s+method|Notes?\b|\([a-h]\)\s*(?:Ignore|Accept|Condone|Allow|Do not|Must))", re.I)


def expand_labs(labs):
    out = []
    for tok in labs:
        if tok not in ROMAN and (cm := re.fullmatch(r"([a-h])(i|ii|iii|iv|v|vi)", tok)):
            out += [cm[1], cm[2]]
        else:
            out.append(tok)
    return out


@dataclass
class MsRow:
    q: int
    path: tuple
    start: tuple        # (page, y)
    end: tuple = None
    total_line: Line = None
    masks: list = None      # [(page, x0, y0, x1, y1)] painted white in this row's crops (a stepped edge)


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
                elif it[0] == "re" and it[1].width < 4.0 and it[1].height > 20:
                    xs.append(it[1].x0)
        xs = sorted(set(round(x) for x in xs))
        if len(xs) < 2:
            continue
        left = xs[0]
        right = next((x for x in xs if x > left + 12), None)
        # a first column sits at the left of the page and is narrow; ignore stray boxes inside notes
        if left < 130 and right is not None and right - left < 150:
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


def titled_table(l, plines):
    """A label under a table header that has its own title above it ('A typical response with an expanded
    denominator:' P3 Jan 2024 7; '8. Scheme – Misread in (a) and/or (b)' P1 Jun 2023 8): a worked example or a
    misread scheme, kept whole in the notes, not an alternative cut into the parts."""
    hdr = [o for o in plines if HDR_WORD.fullmatch(o.text.strip()) and 0 < l.y0 - o.y0 < 45]
    if not hdr:
        return False
    top = min(o.y0 for o in hdr)
    return any(top - 40 < o.y1 <= top + 1 and not HDR_WORD.fullmatch(o.text.strip()) and len(o.text.split()) >= 3
               and not FOOTER.match(o.text) for o in plines)


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
    lines = join_totals(read_lines(ms_doc, skip_cover=False, top=8, ms=True))   # a row label can sit at y 11 (FP3 Jan 2021)
    # an appendix of more methods for an earlier question after the last one ('Some more unusual methods for 3ii':
    # WMA12 Jun 2022): its 'Way 5' rows are no part of the last question; it goes after that question's notes
    qnos = {q.number for q in questions}
    app_head = next((l for l in lines if (am := APP_HEAD.match(l.text)) and int(am[1]) in qnos
                     and int(am[1]) < max(qnos)), None)
    app_pos = app_end = None
    full_lines = lines
    if app_head is not None:
        app_pos = (app_head.page, app_head.y0 - 3)
        foot = next((l for l in lines if (l.page, l.y0) > app_pos and FOOTER.match(l.text)), None)
        app_end = (foot.page, foot.y0 - 4) if foot else (len(ms_doc) - 1, ms_doc[-1].rect.height - 6)
        lines = [l for l in lines if (l.page, l.y0) < app_pos]
    items = content_items(ms_doc, lines, ms=True)
    all_lines, all_items = (full_lines, content_items(ms_doc, full_lines, ms=True)) if app_head is not None \
        else (lines, items)
    columns = fix_columns(label_columns(ms_doc), lines)
    fallback = label_x(lines)
    level1 = {}
    qp_children = {}
    for q in questions:
        first = next((n.path[0] for n in q.parts if n.path), None)
        level1[q.number] = None if first is None else ("roman" if first in ROMAN else "letter")
        for n in q.parts:
            if len(n.path) == 2:
                qp_children.setdefault((q.number, n.path[0]), set()).add(n.path[1])
    page_imgs = {pno: [(im["bbox"][1], im["bbox"][3]) for im in page.get_image_info()]
                 for pno, page in enumerate(ms_doc)}
    lines_by_page = {}
    for l in lines:
        lines_by_page.setdefault(l.page, []).append(l)

    # the table starts on the first page whose 'Question' header sits in the first column
    # the first column's heading: 'Question Number', 'QUESTION', '1Question', or just 'Q' (M2 2021–22)
    hdr_other = {l.page for l in lines if l.x0 >= 100 and re.match(r"^(?:Scheme|Marks|Answer|Solution)\b", l.text, re.I)}

    def is_table_header(l):
        if l.x0 >= 160:
            return False
        pl = lines_by_page.get(l.page, ())
        if re.fullmatch(r"Number\.?", l.text, re.I):
            return any(o is not l and -2 < l.y0 - o.y0 < 28 and o.x0 < 160 and HEADER.match(o.text) for o in pl)
        if not HEADER.match(l.text):
            return False
        if l.text == "Q":
            return any(abs(o.mid - l.mid) < 16 and o.x0 > l.x1 + 2
                       and re.match(r"^(?:Scheme|Marks|Answer|Solution)\b", o.text, re.I) for o in pl)
        return True

    headers = [l for l in lines if is_table_header(l)]
    header_pages = {l.page for l in headers
                    if HEADER.match(l.text) and (l.page in columns or not columns or l.page in hdr_other)}
    totals = {q.number: q.total for q in questions}
    part_labels = {q.number: {x for n in q.parts for x in n.path} for q in questions}
    part_order = {q.number: [tuple(n.path) for n in q.parts if n.path] for q in questions}

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
    # (not the notes' 'M1' / 'A1' printed at the left margin, x≈92 in S1 Jan 2024, which outnumbered the Marks
    # column's on p6 and let '[13]' of the working pass as a part's subtotal)
    codes = [l for l in lines if MARK_CODES.match(l.text) and l.x0 > 150]
    by_page = {}
    for l in codes:
        by_page.setdefault(l.page, []).append(l.x0)
    marks_x = {pg: sorted(xs)[len(xs) // 2] for pg, xs in by_page.items()}
    marks_x_all = sorted(l.x0 for l in codes)[len(codes) // 2] if codes else 0
    rows, notes, problems = [], {}, []
    notes_head_cut = {}     # id(total line) -> y where its 'Notes | Total n' heading row starts
    cur_q, path = None, ()
    expected = 1
    closed = False          # the current question's '(n marks)' line has passed: what follows is its notes
    prev_label = None
    post_alt_prose_y = None
    post_alt_rule_end = None
    post_alt_page = None

    def resolve_path(qn, labs):
        nonlocal path
        for lab in expand_labs(labs):
            kind = "roman" if lab in ROMAN else "letter"
            if lab == "i" and tuple(path) == ("h",) and ("i",) in part_order.get(qn, []):
                kind = "letter"                     # the letter after (h), as the question paper reads it
            outer = level1.get(qn) or kind
            if kind == outer:
                path = (lab,)
            elif path:
                path = (path[0], lab)
            else:
                path = (lab,)
        return path

    for l in lines:
        if l.page < first_page:
            continue
        if post_alt_prose_y is not None and l.page != post_alt_page and not closed and rows and l.page == post_alt_page + 1:
            # the alternative runs on over the page: it goes on while that page's marked rows come before any prose
            # (P4 Jun 2026 7's 'Way Two:')
            cl2 = columns.get(l.page) or fallback
            pl2 = lines_by_page.get(l.page, ())
            prose2 = min((o.y0 for o in pl2 if cl2 and PROSE_NOTE.match(o.text) and o.x0 < cl2[1] + 10
                          and not any(m is not o and m.x0 > cl2[1] + 120 and MARK_CODES.match(m.text)
                                      and abs(m.mid - o.mid) < 9 for m in pl2)), default=None)
            if cl2 and prose2 is not None and any(o.x0 > cl2[1] + 120 and MARK_CODES.match(o.text) and o.y0 < prose2
                                                  for o in pl2):
                post_alt_page, post_alt_prose_y = l.page, prose2
                post_alt_rule_end = max((ry for ry in rule_ys(ms_doc, l.page) if ry <= prose2 + 2), default=None)
        if post_alt_prose_y is not None and (l.page != post_alt_page or l.y0 >= post_alt_prose_y - 1):
            if not closed and rows:
                rows[-1].end = (post_alt_page, post_alt_rule_end or post_alt_prose_y - 1)
                closed = True
            post_alt_prose_y = post_alt_rule_end = None
        col = columns.get(l.page) or fallback
        plines = lines_by_page.get(l.page, ())
        t = MS_TOTAL.match(l.text) if rows and col and l.x0 > col[1] + 120 else None
        if t and t[3] and (int(t[3]) != totals.get(rows[-1].q)
                           or (not l.bold and l.x0 < marks_x.get(l.page, marks_x_all) - 40)):
            t = None    # a part's '(3)', or a '(9)' in the scheme's working (P4 Jan 2026), not the question's total
        if t and t is not True and not t[1] and not t[2] and t[3]:
            cur_tot = totals.get(rows[-1].q)
            next_qy = min((o.y0 for o in plines if o.y0 > l.y0 and col and col[0] <= o.x0 < col[1]
                           and re.match(rf"^{expected}(?:\s*\.|\s*\(?[a-h]\)?|\s|$)", o.text)), default=1e9)
            img_spans = any(im0 < l.y0 and im1 > l.y1 + 5 for im0, im1 in page_imgs.get(l.page, ()))
            later_tot = any(
                o.page == l.page and l.y0 < o.y0 < next_qy and o.x0 > col[1] + 120
                and (mt := MS_TOTAL.match(o.text))
                and ((mt[1] or mt[2]) and int(mt[1] or mt[2]) == cur_tot
                     or (img_spans and mt[3] and int(mt[3]) == cur_tot))
                for o in plines)
            if later_tot:
                t = None
        if (not t and rows and col and l.bold and l.x0 > 480 and re.fullmatch(r"\d{1,2}", l.text)
                and int(l.text) == totals.get(rows[-1].q)):
            t = True    # the total alone, bold, at the foot of the Marks column (S1 Oct 2023, FP3 Jun 2025)
        if (not t and rows and col and not closed and l.bold and l.x0 <= col[1] + 15
                and (bm := re.fullmatch(r"[(\[](\d{1,2})[)\]]", l.text))
                and int(bm[1]) == totals.get(rows[-1].q)):
            t = True    # bold '(10)' inside label column at end of question (M1 Jan 2023)
        if t and closed:
            continue        # a total after this question already closed: a question whose label was missed
        if t:
            r = rows[-1]
            r.total_line = l
            r.end = (l.page, l.y1 + PAD)
            # the same total printed again right under it ('(6)' then '[6]': M2 Jun 2021 4 Alt 2)
            num = re.search(r"\d{1,2}", l.text)
            dup = [o for o in plines if o is not l and l.y0 < o.y0 < l.y1 + 4 and num
                   and re.fullmatch(rf"[(\[]\s*{num[0]}\s*(?:marks?)?[)\]]", o.text.strip())]
            if dup:
                r.end = (l.page, max(o.y1 for o in dup) + PAD)
                r.total_line = max(dup, key=lambda o: o.y1)
            # printed in the notes' own heading row ('Notes | Total 12': S3 Jan 2025 4): the rows end above that
            # row, and the notes start with it
            nh = [o for o in plines if re.fullmatch(r"Notes?:?", o.text) and abs(o.mid - l.mid) < 4 and o.x1 < l.x0]
            if nh:
                top = min(nh[0].y0, l.y0)
                ra = [ry for ry in rule_ys(ms_doc, l.page) if top - 8 <= ry <= top + 1]
                cut = (max(ra) - 0.5) if ra else top - 2
                r.end = (l.page, cut)
                notes_head_cut[id(l)] = cut
            closed = True
            post_alt_prose_y = post_alt_rule_end = None
            continue
        # Nested sub-part label in the Scheme column right of `col` under a parent `(i)` / `(ii)`
        if (cur_q is not None and not closed and path and (cur_q, path[0]) in qp_children
                and col is not None and col[1] <= l.x0 < col[1] + 15):
            if sm := re.match(r"^\(\s*([a-h]|i|ii|iii|iv|v|vi)\s*\)(?:\s|$)", l.text):
                if sm[1] in qp_children[(cur_q, path[0])]:
                    new_path = (path[0], sm[1])
                    path = new_path
                    if (rows and rows[-1].q == cur_q and rows[-1].path == (path[0],)
                            and rows[-1].start[0] == l.page and abs(l.y0 - rows[-1].start[1]) < 25):
                        rows[-1].path = new_path
                    else:
                        rows.append(MsRow(cur_q, new_path, (l.page, cut_above(l, items))))
                    prev_label = l
                    continue
        # A label starts inside the column. Its line may overhang the rule a little when a stray '(' of the
        # scheme's maths is merged onto it ('(b) (i) (' in P1 Jan 2024), or run on with the scheme's text (S3).
        if col is None or not col[0] <= l.x0 < col[1]:
            continue
        ltext = l.text.replace("©", "(c)")
        if (closed and cur_q is not None and l.page in columns
                and ((am := POST_ALT.match(ltext))
                     # 'Alt1' run on with its scheme text in one line ('Alt1 Using N2L parallel and ...': M3 Jan 2024 4)
                     or (am := re.match(r"^(?:Alt|ALT)\s*\d\s+()()(?=[A-Za-z])", ltext))
                     # or the question's own part label opening a marked table after its total: an alternative
                     # for that part ('9(a)' at a page foot, then 'Example Alt' over the page: P3 Oct 2022 9)
                     or ((am := re.fullmatch(rf"{cur_q}\s*\(\s*([a-h])\s*\)()", ltext))
                         and am[1] in part_labels.get(cur_q, ()) and not titled_table(l, plines)))):
            after = [o for o in plines if o.y0 > l.y0 - 2]
            # (the next question's number sits inside the label column: '4 + I² − 4I cos120° = 9' just right of a
            # narrow one is the scheme's maths, M2 Oct 2023 3 alt)
            prose_y = min((o.y0 for o in after if (
                (PROSE_NOTE.match(o.text) and o.x0 < col[1] + 10
                 # (a scheme line has its mark in the Marks column beside it; a prose note has none: FP1 Jun 2026
                 # 8's Way 2 'If 1: f(k+1) ...' with its M1)
                 and not any(m is not o and m.x0 > col[1] + 120 and MARK_CODES.match(m.text)
                             and abs(m.mid - o.mid) < 9 for m in after))
                or (o.x0 < col[1] - 2 and re.match(rf"^{expected}(?:\s*\.|\s*\(?[a-h]\)?|\s|$)", o.text))
                # a centred 'Notes' heading row ends the alternative too (P3 Oct 2023 10)
                or re.fullmatch(r"Notes?\s*:?", o.text.strip(), re.I))),
                default=1e9)
            has_marks = any(o.y0 < prose_y and o.x0 > col[1] + 120 and MARK_CODES.match(o.text) for o in after)
            has_rule = any(l.y0 < ry <= prose_y + 5 for ry in rule_ys(ms_doc, l.page))
            if has_marks and has_rule:
                tot_y = rows[-1].total_line.y1 - 2 if (rows[-1].total_line and rows[-1].total_line.page == l.page) else 0
                alt_start = max((ry for ry in rule_ys(ms_doc, l.page) if tot_y < ry <= l.y0 + 4), default=None)
                start_y = (alt_start - 0.5) if alt_start is not None else cut_above(l, items)
                alt_tok = am[1] or am[2]
                # 'ALT way' under its own label '6 (a)' in the same cell (P4 Jan 2026 6)
                lab_above = [o for o in plines if in_column(o) and 0 < l.y0 - o.y0 < 30 and not any(
                    o.y1 - 1 < ry < l.y0 for ry in rule_ys(ms_doc, l.page))
                    and (lm := re.match(r"^(?:\d{1,2}\s*\.?\s*)?\(\s*([a-h]|i|ii|iii|iv)\s*\)\s*$", o.text))
                    and lm[1] in part_labels.get(cur_q, ())]
                if not alt_tok and lab_above:
                    alt_tok = re.search(r"\(\s*([a-h]|i|ii|iii|iv)\s*\)", lab_above[-1].text)[1]
                    tot_y = max(tot_y, 0)
                    above_lab = [ry for ry in rule_ys(ms_doc, l.page) if tot_y < ry <= lab_above[-1].y0 + 4]
                    if above_lab:
                        start_y = max(above_lab) - 0.5
                if not alt_tok:
                    # the notes' latest part label above it ('(i) Condone ...' then 'Alternative scheme ...',
                    # 'Way Two:': P4 Jun 2026 7)
                    nl = [o for o in plines if o.y0 < l.y0 - 2 and o.y0 > tot_y and o.x0 < col[1] + 50
                          and (nm := re.match(r"^\(\s*([a-h]|i|ii|iii|iv)\s*\)", o.text))
                          and nm[1] in part_labels.get(cur_q, ())]
                    if nl:
                        alt_tok = re.match(r"^\(\s*([a-h]|i|ii|iii|iv)\s*\)", max(nl, key=lambda o: o.y0).text)[1]
                alt_path = resolve_path(cur_q, [alt_tok]) if alt_tok else rows[-1].path
                rows.append(MsRow(cur_q, alt_path, (l.page, start_y)))
                closed = False
                post_alt_prose_y = prose_y
                post_alt_page = l.page
                post_alt_rule_end = max((ry for ry in rule_ys(ms_doc, l.page) if l.y0 < ry <= prose_y + 2), default=None)
                prev_label = l
                continue
        # An alternative labelled with a part, inside the question's table: 'Alt(a)' after part (c)'s rows
        # (P1 Jun 2021 3), 'Alt(ii)' after 'Alt(i)' (P3 Oct 2021 5). It's that part's, from its own cell's top rule.
        if (not closed and cur_q is not None and rows and rows[-1].q == cur_q
                and (am := POST_ALT.match(ltext)) and (alt_tok := am[1] or am[2])
                and alt_tok in part_labels.get(cur_q, ())):
            prev_path = rows[-1].path
            alt_path = resolve_path(cur_q, [alt_tok])
            same_pg = rows[-1].start[0] == l.page
            # (a row border, not a long fraction bar beside the label: P3 Jun 2023 10's Alt II (a))
            rx_a = _RULE_X.get((ms_doc.name, l.page), {})
            mx_a = marks_x.get(l.page, marks_x_all) - 25 if (marks_x or marks_x_all) else col[1] + 120
            above = [ry for ry in rule_ys(ms_doc, l.page)
                     if (not same_pg or ry > rows[-1].start[1] + 2) and ry <= l.y0 + 4
                     and not (ry in rx_a and rx_a[ry][1] < min(ms_x_range(ms_doc)[1] - 60, mx_a - 10))]
            start_y = (max(above) - 0.5) if above else cut_above(l, items)
            # only as the first thing in its cell: '(a)Way2' in '(b) Way 2 follows (a)Way2' describes (b)'s
            # method (FP1 Oct 2020 7)
            if above and any(in_column(o) and o is not l and max(above) < o.y0 < l.y0 - 2 for o in plines):
                path = prev_path
                continue
            if alt_path != prev_path or post_alt_prose_y is not None:
                rows.append(MsRow(cur_q, alt_path, (l.page, start_y)))
            prev_label = l
            continue
        long_line = l.x1 > col[1] + 20
        lead = MS_LABEL_LEAD.match(ltext)                  # also short: '(b) 10' (S1 Jan 2020)
        nlead = MS_NUM_LEAD.match(ltext) if not (lead or MS_LABEL.match(ltext) or MS_LABEL_BARE.match(ltext)) else None
        if nlead and not (int(nlead[1]) == expected and under_header(l)
                          and (l.page in columns or not columns)
                          and not re.search(r"total number of marks|edexcel|general", ltext, re.I)):
            nlead = None                                    # only right under a header, as the next question
        blead = MS_LABEL_BARE_LEAD.match(ltext) if not (lead or nlead) else None
        if blead and not (int(blead[1]) in (cur_q, expected) and blead[2] in part_labels.get(int(blead[1]), ())
                          and not (int(blead[1]) == cur_q and closed)):
            blead = None
        if long_line and not lead and not nlead and not blead and not (MS_LABEL.match(ltext) and "(" in ltext):
            continue                                        # a line of scheme text that merely starts here
            #                                                 (a bare '(a)(ii)' whose box overhangs: P1 Jan 2026)
        if nlead:
            num, labs = nlead[1], []
        elif lead:
            num, labs = lead[1], re.findall(r"\(\s*([a-z]{1,4})\s*\)", lead[2])
        elif blead:
            num, labs = blead[1], [blead[2]]
        elif (b := MS_LABEL_BARE.match(ltext)) and not (
                part_labels.get(int(b[1])) and b[2] not in part_labels[int(b[1])]
                and not b[3] and re.fullmatch(r"\d{1,2}\s*[a-h]", ltext)):
            # not maths in a note: '9e' (9e^(-t/10), P3 Jun 2022 9; P4 Jun 2025 4) when the paper has no 9(e)
            num, labs = b[1], [b[2], *(re.findall(r"\(\s*([a-z]{1,4})\s*\)", b[3]) if "(" in (b[3] or "")
                                       else [b[3]] if b[3] else [])]
        elif (m := MS_LABEL.match(ltext)) and (m[1] or m[2]):
            num, labs = m[1], re.findall(r"\(\s*([a-z]{1,4})\s*\)", m[2] or "")
        elif (MS_LETTER.match(ltext) and cur_q is not None and not closed
              and (ltext in part_labels.get(cur_q, ())
                   or ((lm := re.fullmatch(r"([a-h])(i|ii|iii|iv|v|vi)", ltext))
                       and lm[1] in part_labels.get(cur_q, ())))
              and not any(o.page == l.page and o is not l and abs(o.mid - l.mid) < 6 and o.x0 < col[1] + 2
                          for o in plines)):                # alone in the label column, not maths like 'c' in xy = c^2
            num, labs = None, [ltext]
        else:
            continue                                        # 'Notes', 'Alt', 'Way 2', 'Note 1' …
        if num and not labs and "." not in ltext:
            leftmost = not any(o.page == l.page and abs(o.mid - l.mid) < 6 and o.x1 < l.x0 for o in plines)
            if not (leftmost and (l.page in columns or not columns)):
                continue
            if not l.bold and not (
                    (under_header(l) or (closed and int(num) == expected and l.x1 <= col[1] + 4
                                         and rule_above(ms_doc, l.page, l.y0)))
                    and (cur_q is None or closed)):
                continue    # a lone plain digit, unless it opens a table, or is the next question's number right
                #             after the last one closed (M2 Oct 2021 prints '2' mid-page): else it's maths
        new_q = False
        if num:
            n = int(num)
            if n == cur_q and labs and not closed:
                pass                                        # '3(b)' after '3(a)': the same question (M1)
            elif n != expected:
                continue                                    # a stray number, not the next question
            elif (labs and n in part_order and not part_order[n] and any(
                    l.page < o.page <= l.page + 2 and o.x0 <= (columns.get(o.page) or fallback or (0, 120))[1] + 5
                    and re.fullmatch(rf"{n}\.?", o.text)
                    and any(h.page == o.page and 0 < o.y0 - h.y1 < 30 for h in headers) for o in lines)):
                continue    # '5(a)' for a question with no parts, which starts later at its own '5': the notes
                #             before it are the last question's, mislabelled (FP2 Jun 2021 p15)
            else:
                cur_q, path, expected, closed = n, (), n + 1, False
                post_alt_prose_y = post_alt_rule_end = None
                new_q = True
        if cur_q is None or closed:
            continue                                        # before the table, or a label inside the notes
        resolve_path(cur_q, labs)
        # a plain label that goes back to an earlier part is a notes block's margin label printed between parts
        # ('Notes' then '(a)', '(b)' before part (c): P1 Jan 2026 A 6): that part's notes start at the label (or
        # the 'Notes' heading over it), not at a rule above the previous part's alternatives
        order = part_order.get(cur_q, [])
        if (labs and rows and rows[-1].q == cur_q and rows[-1].path in order and tuple(path) in order
                and order.index(tuple(path)) < order.index(rows[-1].path)):
            start = cut_above(l, items)
            head = [o for o in plines if re.match(r"^Notes?\b", o.text) and 0 < l.y0 - o.y0 < 40
                    and (rows[-1].start[0] != l.page or o.y0 > rows[-1].start[1] + 2)]
            if head:
                start = min(start, head[-1].y0 - 2)
            prev_label = l
            rows.append(MsRow(cur_q, path, (l.page, start)))
            continue
        def lone_axis(it, pno):
            """A graph's thin vertical axis inside the scheme column: not one of a table's column rules, which
            come in sets drawn over the same heights."""
            return (it.kind == "drawing" and it.width < 4 and it.y1 - it.y0 > 60 and col[1] + 10 < it.x0 < mx_cut - 10
                    and not any(o is not it and o.page == pno and o.kind == "drawing" and o.width < 4
                                and abs(o.y0 - it.y0) < 3 and abs(o.y1 - it.y1) < 3 for o in items))

        # A row starts at its cell's top rule, which can sit well above the label: the first M1 row's text is
        # top-aligned, the label lower down (M3 2025: part (b)'s first row went into (a)'s crop)
        start = cut_above(l, items)
        floor = rows[-1].start[1] if rows and rows[-1].start[0] == l.page else 0
        # the previous part's subtotal '(3)' ends it: this part's rows begin right under it (the label can sit
        # in the middle of a tall cell, below this part's first rows: M3 Jun 2025 4(b))
        mx_cut = marks_x.get(l.page, marks_x_all) - 25 if (marks_x or marks_x_all) else col[1] + 120
        # (a label merged into a line with a tall root sign has a tall box: WST01 Oct 2019 2(b)(ii))
        l_top = l.y0 if l.y1 - l.y0 < 30 else l.mid - 8
        sub = [m for m in plines if floor - 3 <= m.y0 < l_top and m.y1 > floor + 6
               and (MS_PART_SUB.match(m.text) and m.x0 >= mx_cut
                    # or merged onto the end of the row's last line: '(awrt 44.4, awrt 55.2) A1 (5)' (S3 Jan 2024 6)
                    or (re.search(r"\s[(\[]\d{1,2}[)\]]$", m.text) and m.x1 >= mx_cut + 45 and m.x0 > col[1] + 100))
               ] if rows and rows[-1].q == cur_q else []
        # ...unless an alternative method ('ALT', 'Way 2', 'Alternative', 'Example') follows that subtotal: it's
        # still the previous part's, and this part starts at its own cell's top rule (FP3 Oct 2020 4, M2 Jan 2026 1)
        rys = rule_ys(ms_doc, l.page)
        # ...but not one that opens a new ruled cell this label sits in, centred lower down: that line is this
        # part's first row (D1's 'middle right' quick-sort row under a centred '(c)': WDM11 Jan 2022 1)
        alt = [m for m in plines if sub and sub[-1].y0 - 8 < m.y0 < l.y0 - 2 and m is not sub[-1]
               and ALT_LEAD.match(m.text)
               and not (any(sub[-1].y1 - 2 < ry <= m.y0 + 2 for ry in rys)
                        and not any(m.y0 + 2 < ry <= l.y0 + 4 for ry in rys))]
        if alt:
            floor = alt[-1].y1
            sub = []
        rys = rule_ys(ms_doc, l.page)
        if sub:
            sub_y = sub[-1].y1
            # a subtotal printed level with the middle of the part's own graph ends the part under the graph (M1
            # Jun 2026 3(c)'s (4) beside the t-axis, its negative velocities further down; P1 Jun 2025 7(b))
            m = sub[-1]
            fig = [it.y1 for it in items if it.page == l.page and it.kind in ("drawing", "image") and it.y0 < m.y0 - 5
                   and it.y1 > m.y1 + 20 and 30 < it.y1 - it.y0 < 400 and it.x0 + it.width < m.x0 and it.y1 < l.y0
                   and (it.width > 60 or lone_axis(it, l.page))]
            if fig:
                sub_y = max(fig)
            rys = row_rule_ys(ms_doc, l.page)
            near = [ry for ry in rys if sub_y - 4 <= ry <= sub_y + 6 and ry <= l.y0 + 4]
            if near:
                start = max(min(near) - 0.5, sub_y - 2.5)
            else:
                mid_rules = [ry for ry in rys if sub_y + 6 < ry <= l.y0 + 4]
                if mid_rules and (any(im0 < sub_y < im1 for im0, im1 in page_imgs.get(l.page, ()))
                                  or not any(MARK_CODES.match(m.text) and sub_y < m.y0 < mid_rules[0] for m in plines)):
                    start = mid_rules[0] - 0.5
                else:
                    start = sub_y + 1
                    # ...below whatever of the part still hangs under its subtotal: a graph's 'O' (P2 Jan 2020 9(a))
                    for _ in range(2):
                        hang = ([o.y1 for o in plines if o.y0 < start - 1 and o.y1 > start + 1 and o.y1 < l.y0 - 6
                                 and o.y0 >= sub[-1].y0 - 2 and o.x1 < sub[-1].x0 - 3 and o.y1 - o.y0 < 20
                                 # a label of the figure it hangs under, not the next part's first line
                                 and any(it.page == l.page and it.kind in ("image", "drawing") and it.width > 30
                                         and it.x0 - 4 <= o.x0 <= it.x0 + it.width + 4
                                         and it.y0 < o.y0 and it.y1 > o.y0 - 6 for it in items)]
                                + [im1 for im0, im1 in page_imgs.get(l.page, ()) if im0 < start - 1 < start + 1 < im1
                                   and im1 < l.y0 - 2])
                        if hang:
                            start = max(hang) + 1
        else:
            prev_lim = (prev_label.y1 - 2) if (prev_label and prev_label.page == l.page and not alt) else 0
            floor_lim = max(floor + 2, prev_lim)
            # (a row border reaches the Marks column: a long fraction bar is no border, FP2 Jan 2021 5(b))
            rx = _RULE_X.get((ms_doc.name, l.page), {})
            tx1 = ms_x_range(ms_doc)[1]
            cands = [ry for ry in rys if floor_lim < ry <= l.y0 + 4 and ry < l.mid
                     and not (ry in rx and rx[ry][1] < min(tx1 - 60, mx_cut - 10))]
            if cands:
                top = max(cands)
                gap = l.y0 - top
                tall_cell = gap < 260 and (
                    not rows or rows[-1].start[0] != l.page
                    or any(im0 < l.y0 and im1 > top - 4 for im0, im1 in page_imgs.get(l.page, ()))
                    or any(MARK_CODES.match(m.text) and top < m.y0 < l.y0 - 4 for m in plines)
                    # under the question's bare number row, the part's table above its centred label (S3 Oct 2020 3)
                    or (rows[-1].q == cur_q and not rows[-1].path and rows[-1].start[1] < top))
                if (gap < 40 or tall_cell) and top - 0.5 < start:
                    start = top - 0.5
        # a question whose first label is already a part's ('1a', with no question-number row) centred in a tall
        # cell (M2 Jun 2023): its rows start at the top of its table, under the header
        if new_q and labs:
            prev_y = 0
            if rows and rows[-1].start[0] == l.page:
                prev_y = rows[-1].start[1]
            if rows and rows[-1].total_line is not None and rows[-1].total_line.page == l.page:
                prev_y = max(prev_y, rows[-1].total_line.y1)   # the last question's '(12)' (M2 Jun 2022 8)
            tt = table_top(ms_doc, l.page, start, prev_y, [h for h in headers if h.page == l.page], items,
                           col=columns.get(l.page))
            # only over rows of this part (marks in the Marks column) or its diagram: a band of text alone may
            # as well be the last question's note running on (M2 Jun 2021 6: 'M1A1M1A1 for 2 independent …')
            mx_new = marks_x.get(l.page, marks_x_all) - 25
            band_rows = any(MARK_CODES.match(o.text) and o.x0 >= mx_new and tt <= o.y0 < start for o in plines)
            band_fig = any(it.page == l.page and it.kind in ("image", "drawing") and it.y1 - it.y0 > 30
                           and tt <= it.y0 and it.y1 <= start + 2 for it in items)
            # or a lead note under the header of a new page when the page before ended on the last question's
            # final subtotal with nothing after it (M2 Jun 2023 3, whose Q2 prints no total)
            band_lead = False
            hb = [h for h in headers if h.page == l.page and h.y1 < start]
            if rows and rows[-1].start[0] < l.page and hb and prev_y == 0:
                # the header row's foot: its lowest word ('Number' under 'Question', 'Marks', 'Notes')
                h_bot = max([h.y1 for h in hb] + [o.y1 for o in plines if o.y0 < max(h.y1 for h in hb) + 4
                                                  and HDR_WORD.fullmatch(o.text)])
                lead = [o for o in plines if h_bot < o.y0 and o.y1 < min(tt, start) + 2 and not HDR_WORD.fullmatch(o.text)]
                pp = [o for o in lines_by_page.get(l.page - 1, ()) if not FOOTER.match(o.text)
                      and not re.fullmatch(r"\d{1,3}", o.text)]
                lastp = max(pp, key=lambda o: o.y1, default=None)
                if (lead and lastp is not None and MS_PART_SUB.match(lastp.text)
                        and not any(MS_PART_SUB.match(o.text) or MS_TOTAL.match(o.text)
                                    or re.fullmatch(r"\d{1,2}", o.text) for o in lead)):
                    band_lead = True
                    tt = min((ry - 0.5 for ry in rule_ys(ms_doc, l.page) if h_bot - 6 <= ry <= h_bot + 10),
                             default=h_bot + 1)
            if tt < start - 1 and (band_rows or band_fig or band_lead):
                # the label printed is a later part's ('2(b)'), the first part's own label missing (M3 Jun 2026 A
                # 2): the marked rows above it are the first part's
                order = part_order.get(cur_q, [])
                if (band_rows and order and tuple(path) in order and order.index(tuple(path)) > 0
                        and len(order[0]) == 1 and len(path) == 1 and path[0] > order[0][0]
                        and any(MS_PART_SUB.match(o.text) and o.x0 >= mx_new and tt <= o.y0 < start for o in plines)):
                    rows.append(MsRow(cur_q, order[0], (l.page, tt)))
                else:
                    start = tt
        # the first label on a page, centred in its cell, after the previous part closed with its subtotal on the
        # page before: this part's rows start at the top of this page's table (M2 Jun 2023 3(b)'s diagram)
        elif (labs and rows and rows[-1].q == cur_q and rows[-1].start[0] < l.page and rows[-1].path != path
              and not any(o.page == l.page and o.y1 < l.y0 and (ALT_LEAD.match(o.text) or POST_ALT.match(o.text))
                          for o in plines)
              and not any(o.page == l.page and in_column(o) and o.y1 < l.y0 - 2
                          and not is_table_header(o) for o in plines)):
            pp = lines_by_page.get(l.page - 1, ())
            mxp = marks_x.get(l.page - 1, marks_x_all) - 25
            last_mark = max((o for o in pp if o.x0 >= mxp and (rows[-1].start[0] < l.page - 1
                                                                or o.y0 > rows[-1].start[1])),
                            key=lambda o: o.y0, default=None)
            hb = [h for h in headers if h.page == l.page and h.y1 < start]
            if last_mark is not None and MS_PART_SUB.match(last_mark.text):
                hw = [o.y1 for o in plines if o.y1 < start and re.fullmatch(
                    r"Question(?:\s+Number)?|Number|Scheme|Notes|Marks|Answer|Mark", o.text, re.I)]
                if hb:
                    h_bot = max([h.y1 for h in hb] + hw)     # 'Number' under 'Question' is the header's foot
                    top = min((ry - 0.5 for ry in rys if h_bot - 6 <= ry <= h_bot + 10), default=h_bot + 1)
                else:       # no header repeated: the table's top border (M2 Jun 2023 4(d)), under any header row
                    floor_y = max(hw) - 2 if hw else -1
                    top = min((ry - 0.5 for ry in rys if floor_y < ry < start), default=start)
                # only over marked rows or a picture: a bare table of working without marks finishes the part
                # before (D1 Jan 2022 6(a)'s table of least distances); a marked row (M2 Jun 2023 4(d)'s 'Change
                # in KE  M1') or a pictured diagram (its 3(b)) opens this one
                mx_here = marks_x.get(l.page, marks_x_all) - 25
                band_ok = (any(MARK_CODES.match(o.text) and o.x0 >= mx_here and top <= o.y0 < start for o in plines)
                           or any(it.page == l.page and it.kind in ("image", "drawing") and it.y1 - it.y0 > 30
                                  and top <= it.y0 and it.y1 <= start + 2 for it in items)
                           and sum(1 for o in plines if top <= o.y0 < start and o.x0 > col[1]) < 10)
                if top < start - 1 and band_ok:
                    start = top
        # text boxes far taller than their glyphs (Word-made FP2 Jan 2025) lift a start set from the text above the
        # cell's own top rule, into the row before: a rule below that start with the earlier row's marks above it
        if start == cut_above(l, items):
            below = [ry for ry in rys if start < ry <= l.y0 + 4]
            if below and any(MARK_CODES.match(m.text) and m.x0 > col[1] + 120 and start < m.mid < max(below)
                             for m in plines):
                start = max(below) - 0.5
        prev_label = l
        if rows and rows[-1].q == cur_q and rows[-1].path and rows[-1].start[0] == l.page and start <= rows[-1].start[1] + 2:
            mid = [ry for ry in rys if rows[-1].start[1] + 2 < ry <= l.y0 + 4]
            start = (mid[-1] - 0.5) if mid else max(rows[-1].start[1] + 2, l.y0 - 1)
        rows.append(MsRow(cur_q, path, (l.page, start)))
    # A combined label '(b)/(c)' heads one cell marking two parts in turn (FP1 Jun 2022 4: 'With (b) first' ...
    # '(5)' ... '(2)'): its first subtotal ends the first part, the second part's rows follow it
    for l in lines:
        cm = re.match(r"^\(([a-h])\)\s*/\s*\(([a-h])\)", l.text)
        if not cm or not (l.page in columns or fallback) or l.x0 > ((columns.get(l.page) or fallback or (0, 120))[1] + 5):
            continue
        i = next((i for i, r in enumerate(rows) if r.start[0] == l.page and l.y0 - 60 < r.start[1] <= l.y0 + 2
                  and r.path and r.path[-1] == cm[1]), None)
        if i is None:
            # a second such cell, an alternative order ('With (c) first'), inside the second part's rows: it opens
            # the first part again
            j = max((j for j, r in enumerate(rows) if r.start <= (l.page, l.y0)), default=None)
            if j is None or not rows[j].path or rows[j].path[-1] != cm[2]:
                continue
            path0 = tuple(rows[j].path[:-1]) + (cm[1],)
            if path0 not in part_order.get(rows[j].q, []):
                continue
            ra = [ry for ry in rule_ys(ms_doc, l.page) if l.y0 - 15 <= ry <= l.y0 + 2]
            rows.insert(j + 1, MsRow(rows[j].q, path0, (l.page, (max(ra) - 0.5) if ra else l.y0 - 2)))
            i = j + 1
        r = rows[i]
        nxt = rows[i + 1] if i + 1 < len(rows) else None
        lim = nxt.start[1] if nxt is not None and nxt.start[0] == l.page else 1e9
        mx = marks_x.get(l.page, marks_x_all) - 25 if (marks_x or marks_x_all) else 400
        subs = sorted((m for m in lines_by_page.get(l.page, ()) if MS_PART_SUB.match(m.text) and m.x0 >= mx
                       and l.y0 < m.y0 and m.y1 < lim), key=lambda m: m.y0)
        if subs and (nxt is None or tuple(nxt.path) != tuple(r.path[:-1]) + (cm[2],) or nxt.start[1] > subs[0].y1):
            new = MsRow(r.q, tuple(r.path[:-1]) + (cm[2],), (l.page, subs[0].y1 + 1))
            # the question's total, read while the first part's row was the open one, closes the second
            if r.total_line is not None and (r.total_line.page, r.total_line.y0) > new.start:
                new.total_line, new.end, r.total_line, r.end = r.total_line, r.end, None, None
            rows.insert(i + 1, new)
    # Drop an empty question-number banner row ('7.') when the question's first part sits right under it
    filtered = []
    for i, r in enumerate(rows):
        nxt = rows[i + 1] if i + 1 < len(rows) else None
        if (not r.path and nxt is not None and nxt.q == r.q and nxt.path and r.start[0] == nxt.start[0]):
            pno = r.start[0]
            col = columns.get(pno) or fallback
            plines = lines_by_page.get(pno, ())
            has_body = any(r.start[1] - 2 <= o.mid <= nxt.start[1] and col and o.x0 > col[1] for o in plines)
            has_img = any(im1 >= r.start[1] and im0 <= nxt.start[1] for im0, im1 in page_imgs.get(pno, ()))
            if not has_body and not has_img:
                continue
        filtered.append(r)
    rows = filtered
    # each row runs to the next row's start; a question's last row to its '(n marks)' line
    gaps = {}
    totaled = set()     # questions whose total was printed before an alternative that follows it
    for i, r in enumerate(rows):
        nxt = rows[i + 1] if i + 1 < len(rows) else None
        if (nxt is not None and nxt.q == r.q and r.total_line is not None and r.end is not None
                and nxt.start > (r.end[0], r.end[1] + 4)):
            # the question closed with its total, then an alternative reopened a part after the notes ('(7 marks)',
            # notes, 'Alt (b)': P4 Oct 2021 8): this row ends at the total, the notes are what lies between
            gaps[r.q] = (r.end, nxt.start)
            r.total_line = None
        elif nxt is not None and nxt.q == r.q:
            if r.total_line is not None:
                totaled.add(r.q)
            r.end = nxt.start
            r.total_line = None
        elif r.end is None and (r.q in gaps or r.q in totaled):
            r.end = nxt.start if nxt else (len(ms_doc) - 1, ms_doc[-1].rect.height - 6)
        elif r.end is None and nxt is not None and nxt.start[0] > r.start[0] and (lastp := max(
                (o for o in lines_by_page.get(nxt.start[0] - 1, ()) if (o.page, o.y0) >= r.start
                 and not FOOTER.match(o.text) and not re.fullmatch(r"\d{1,3}", o.text)),
                key=lambda o: o.y1, default=None)) is not None and MS_PART_SUB.match(lastp.text) and not any(
                o.page == nxt.start[0] and o.y0 < nxt.start[1] - 2 and not HDR_WORD.fullmatch(o.text)
                and (MS_PART_SUB.match(o.text) or MS_TOTAL.match(o.text) or re.fullmatch(r"\d{1,2}", o.text)
                     or any(MARK_CODES.match(w) for w in o.text.split()))
                for o in lines_by_page.get(nxt.start[0], ())):
            # no '(n marks)' printed, but its last part's subtotal ends the page before the next question's
            # (M2 Jun 2023 2)
            r.end = (lastp.page, lastp.y1 + PAD)
        elif r.end is None:
            problems.append(f"MS Q{r.q}: no '(n marks)' line after its last row")
            r.end = nxt.start if nxt else (len(ms_doc) - 1, ms_doc[-1].rect.height - 6)
    # notes: from a question's '(n marks)' line to the top of the next question's table (its first labelled row
    # can sit under an unlabelled preamble row restating the question, which belongs to that question, not to the
    # notes before it); the last question's notes stop at Pearson's publisher footer or 'PAPER TOTAL'
    by_q = {}
    for r in rows:
        by_q.setdefault(r.q, []).append(r)
    qnums = sorted(by_q)
    for i, qn in enumerate(qnums):
        last = by_q[qn][-1]
        if last.total_line is None and last.end is None:
            continue
        start = (last.total_line.page, last.total_line.y1 + 1) if last.total_line is not None else last.end
        if last.total_line is not None and id(last.total_line) in notes_head_cut:
            start = (last.total_line.page, notes_head_cut[id(last.total_line)])
        if i + 1 < len(qnums):
            first = by_q[qnums[i + 1]][0]
            floor = start[1] if first.start[0] == start[0] else 0
            top = table_top(ms_doc, first.start[0], first.start[1], floor,
                            [h for h in headers if h.page == first.start[0]], items,
                            col=columns.get(first.start[0]))
            if top < first.start[1] - 1:
                first.start = (first.start[0], top)
            end = first.start
            # the next table's 'Question | Scheme | Marks' header row is neither these notes nor that question
            # (it ended the notes of WME02 Jun 2026 A, WST02 Oct 2024, WST01 Jun 2026)
            extra = any(l.page == end[0] and end[1] - 220 < l.y0 < end[1] and re.search(r"X015461|Comparison of key", l.text, re.I)
                        for l in lines_by_page.get(end[0], ()))
            win = 220 if extra else 60
            head = [h for h in headers if h.page == end[0] and h.y1 <= end[1] + 4 and end[1] - h.y1 < win
                    and (h.page, h.y0) > start]
            if head:
                hy = min(h.y0 for h in head)
                top_rule = max((ry for ry in rule_ys(ms_doc, end[0]) if hy - win < ry <= hy + 2), default=None)
                end = (end[0], (top_rule - 1) if top_rule is not None and hy - top_rule < (220 if extra else 25) else hy - 1)
                # a short note printed right on top of the next question's header, first thing on its page, is
                # that question's ('Allow column vectors ... throughout.': WME01 Oct 2024 3, Oct 2025 3)
                if end[0] > start[0]:
                    blk = [l for l in lines_by_page.get(end[0], ()) if l.y1 <= hy + 1
                           and not FOOTER.match(l.text) and not re.fullmatch(r"\d{1,3}", l.text)]
                    nq0 = qnums[i + 1]
                    if blk and not any(l in headers for l in blk) and (
                            (len({round(l.y0) for l in blk}) <= 3 and hy - max(l.y1 for l in blk) < 4
                             # a sentence, not the last notes row running on ('A1  awrt 144') or a stray label
                             and not any(MARK_CODES.match(w) for l in blk for w in l.text.split())
                             and any(len(l.text.split()) >= 4 for l in blk))
                            # or a page-top note that names it ('Note that it is possible to answer Q12 ...':
                            # WMA02 Jan 2020 12)
                            or (re.search(rf"\bQ(?:uestion)?\s*{nq0}\b", min(blk, key=lambda o: o.y0).text) and min(l.y0 for l in blk) < 60
                                and hy - max(l.y1 for l in blk) < 25)):
                        bt = min(l.y0 for l in blk) - 2
                        first.start = (end[0], bt)
                        end = (end[0], bt)
            # a heading naming the next question ('Question 8 – General Guidance for marking', '8. Scheme - No
            # Misread') starts that question's part of the scheme (WMA11 Jun 2023 7/8)
            nq = qnums[i + 1]
            hd = next((l for l in lines if start < (l.page, l.y0) < end and len(l.text.split()) <= 8
                       and re.match(rf"^(?:Question\s+{nq}\b(?!\s*\()|{nq}\s*\.\s+Scheme\b)", l.text)), None)
            if hd is not None:
                end = (hd.page, hd.y0 - 3)
                first.start = end
        else:
            def terminal_paper_total(l):
                if not PAPER_TOTAL.match(l.text):
                    return False
                if any((o.page, o.y0) > (l.page, l.y1 + 2) and not FOOTER.match(o.text)
                       and not re.search(r"registered office|Strand, London", o.text, re.I) for o in lines):
                    return False
                if any((pg == l.page and im0 > l.y1 + 2) or pg > l.page
                       for pg, ims in page_imgs.items() for im0, im1 in ims if im1 - im0 > 20):
                    return False
                return True

            foot = next((l for l in lines if ((l.page, l.y0) > start and FOOTER.match(l.text))
                         or ((l.page, l.y0) > (start[0], start[1] - 6) and terminal_paper_total(l))), None)
            end = max(start, (foot.page, foot.y0 - 4)) if foot else (len(ms_doc) - 1, ms_doc[-1].rect.height - 6)
            # an appendix of other methods for an earlier question, after the last one's notes ('Some more unusual
            # methods for 3ii': WMA12 Jun 2022; 'Question 9(a) and (b) using right angled triangles:' WMA11 Jun
            # 2025 A): it goes after that question's own notes
            for l in lines:
                if not (start < (l.page, l.y0) < end) or len(l.text.split()) > 10:
                    continue
                am = re.match(r"^(?:Question\s+(\d{1,2})\s*\(|Some\s+(?:more\s+)?(?:other\s+)?(?:more\s+)?unusual\s+"
                              r"methods\s+for\s+(?:Q(?:uestion)?\s*)?(\d{1,2}))", l.text, re.I)
                if am and int(am[1] or am[2]) in by_q and int(am[1] or am[2]) < qn:
                    APPENDIX_NOTES.setdefault(ms_doc.name, {})[int(am[1] or am[2])] = ((l.page, l.y0 - 3), end)
                    end = (l.page, l.y0 - 3)
                    break
        # The 2026 A mark schemes reprint each question, as a picture of the question paper's page, between one
        # question's notes and the next one's table: the notes stop before such a page (no text, only an image)
        # (WFM02 Jan 2026 A, WME01 Jun 2026 A, WME03 Jan/Jun 2026 A)
        reprint = next((pg for pg in range(start[0] + 1, end[0] + 1) if reprint_page(ms_doc, pg, lines_by_page)), None)
        if reprint is not None:
            end = max(start, (reprint - 1, ms_doc[reprint - 1].rect.height - 6))
        notes[qn] = (start, end)
    for qn, (ga, gb) in gaps.items():
        # the notes between the total and the reopened alternative; any notes after the alternative too
        if not any(ga < (o.page, o.mid) < gb and not FOOTER.match(o.text)
                   and not HDR_WORD.fullmatch(o.text) and not re.fullmatch(r"\d{1,3}", o.text) for o in lines):
            continue                                # nothing between: the notes are after the alternative
        if qn in notes and notes[qn][1] > notes[qn][0]:
            APPENDIX_NOTES.setdefault(ms_doc.name, {}).setdefault(qn, notes[qn])
        notes[qn] = (ga, gb)
    # the previous question's last note printed at the head of this one's notes, before their first part label
    # ('A1 k > 3.6 ...' above Q6's '(a)' notes: WMA13 Jun 2022 5)
    for qn, (ns, ne) in list(notes.items()):
        if qn - 1 not in notes or not any(len(p) == 1 and p[0] in "abcdefgh" for p in part_order.get(qn, [])):
            continue
        pl = [o for o in lines if ns < (o.page, o.y0) < ne and o.page == ns[0]]
        cl = columns.get(ns[0]) or fallback or (0, 120)
        lab = next((o for o in sorted(pl, key=lambda o: o.y0) if o.x0 <= cl[1] + 5
                    and re.fullmatch(r"\(a\)|a|%d\s*\(?a\)?" % qn, o.text)), None)
        if lab is None:
            continue
        head = [o for o in pl if o.y1 <= lab.y0 + 1]
        if not head or lab.y0 - min(o.y0 for o in head) > 60:
            continue
        if any(re.match(r"^Notes?\b", o.text, re.I) or LABELISH.match(o.text) for o in head) or any(
                o.page == ns[0] and ns[1] - 15 < o.y0 < lab.y0 and re.match(r"^Notes?\b", o.text, re.I) for o in lines):
            continue
        real = [o for o in head if len(o.text.strip()) > 2 or re.match(r"^d?[MAB]\d", o.text)]
        if not real:
            continue
        y_first = min(o.y0 for o in real)
        top = min((o for o in real if o.y0 < y_first + 3), key=lambda o: o.x0)
        if re.match(r"^(?:d?[MAB]\d)\b", top.text) and not APPENDIX_NOTES.get(ms_doc.name, {}).get(qn - 1):
            cut = (ns[0], lab.y0 - 3)
            APPENDIX_NOTES.setdefault(ms_doc.name, {})[qn - 1] = (ns, cut)
            notes[qn] = (cut, ne)
    if app_pos is not None:
        for r in rows:
            if r.end is not None and r.end > app_pos:
                r.end = app_pos
        for qn, (ns, ne) in list(notes.items()):
            if ne > app_pos:
                notes[qn] = (min(ns, app_pos), app_pos)
        problems[:] = [p for p in problems if not p.startswith(f"MS Q{max(qnos)}: no '(n marks)'")]
        for qn, (a, b) in list(APPENDIX_NOTES.get(ms_doc.name, {}).items()):
            if b > app_pos:
                APPENDIX_NOTES[ms_doc.name][qn] = (a, max(a, app_pos))
        APPENDIX_NOTES.setdefault(ms_doc.name, {})[int(APP_HEAD.match(app_head.text)[1])] = (app_pos, app_end)
    # a row's end is the next row's start: keep the row before a moved start in step
    for a, b in zip(rows, rows[1:]):
        if a.q == b.q and a.end != b.start and not (a.q in gaps and a.end == gaps[a.q][0]):
            a.end = b.start
    # nor does a row run through a reprinted question page (M3 Jun 2026 A 6, whose '(13)' never closed it)
    for r in rows:
        if r.end and r.end[0] > r.start[0]:
            rp = next((pg for pg in range(r.start[0] + 1, r.end[0] + 1) if reprint_page(ms_doc, pg, lines_by_page)), None)
            if rp is not None:
                r.end = max(r.start, (rp - 1, ms_doc[rp - 1].rect.height - 6))
    clear_ms_edges(ms_doc, rows, notes, lines)
    scan = SCANNED_MS.get(Path(ms_doc.name or "").name)
    if scan:
        for qn, spec in scan.items():
            rows[:] = [r for r in rows if r.q != qn]
            pos = next((i for i, r in enumerate(rows) if r.q > qn), len(rows))
            rows[pos:pos] = [MsRow(qn, tuple(path), (pg, y0), (pg, y1)) for path, pg, y0, y1 in spec["rows"]]
            pg0 = min(pg for _, pg, _, _ in spec["rows"])
            for k, (ns, ne) in list(notes.items()):     # nobody else's notes run over the scanned page
                if k != qn and ne[0] >= pg0 and ns[0] <= pg0:
                    notes[k] = (ns, max(ns, (pg0 - 1, ms_doc[pg0 - 1].rect.height - 6)))
            if spec.get("notes"):
                pg, y0, y1 = spec["notes"]
                notes[qn] = ((pg, y0), (pg, y1))
            problems[:] = [p for p in problems if not re.search(rf"\bQ{qn}\b", p)]
    return rows, notes, problems, all_lines, all_items


# Mark-scheme pages printed as a scanned picture, with no text to read: their rows, cut by the table's drawn rules
# (pages 0-based). M2 Oct 2022 p22 is Q8's whole scheme; without this Q8 had none and Q7's notes ran over it.
SCANNED_MS = {
    "WME02_2022_10_ms.pdf": {8: {"rows": [("a", 21, 61.0, 190.5), ("b", 21, 190.5, 295.5), ("c", 21, 295.5, 364.8),
                                          ("d", 21, 364.8, 503.5)],
                                 "notes": (21, 503.5, 561.0)}},
}


def reprint_page(ms_doc, pg, lines_by_page):
    """A 2026 'A' mark scheme's reprint of the question paper's page: the notes and rows before it stop there."""
    # only those 'A' mark schemes do it: elsewhere a page holding only a picture is a diagram in the notes
    # (P1 Jan 2026 4's Alt IV, P1 Jan 2021 5's sketch at the top of Q6's first page)
    if not re.search(r"_A_ms\.pdf$", ms_doc.name or ""):
        return False
    ims = [pymupdf.Rect(i["bbox"]) for i in ms_doc[pg].get_image_info()]
    if not ims:
        return False
    if not lines_by_page.get(pg):
        return True
    # or the reprint heads the page, full width, with the next question's own notes under it (WFM02 Jan
    # 2026 A p19: Q5's picture, then 'Note that part (a) is now being marked as …')
    top = min(ims, key=lambda r: r.y0)
    return (top.width > 450 and top.y0 < 90
            and all(l.y0 > top.y1 - 5 for l in lines_by_page[pg]))


def ms_safe_y(doc, pno, y, lo, hi, lines=(), reach=5, rule_reach=10):
    """Where a mark-scheme crop edge near y should sit so it cuts no printed glyph (strictly between lo and hi).
    The readers' commonest complaint: a part's rows sliced through a line of working, a '(Total 5)' or '(2)'
    split between two crops. In order: y itself if it is on a table rule or cuts no ink; else the nearest table
    rule within `rule_reach` pt (the cells' real borders); else the nearest ink-free pixel row within `reach`.
    Never by handing a whole line of text to the other crop: a line the edge cuts goes with the side its middle
    is on, and a part's total ('(3)') always stays with the rows above it."""
    rules = [ry for ry in rule_ys(doc, pno) if lo + 3 < ry < hi - 3]
    on_rule = min((ry for ry in rule_ys(doc, pno) if abs(ry - y) <= 3), key=lambda ry: abs(ry - y), default=None)
    w, h, stride, s = page_ink(doc, pno)
    k = 100 / 72
    x0, x1 = ms_x_range(doc)
    c0, c1 = max(0, int(x0 * k)), min(w, int(x1 * k))
    r0 = max(0, int((y - rule_reach - 4) * k))
    r1 = min(h - 1, int((y + rule_reach + 4) * k))
    if r1 - r0 < 4:
        return y
    # a vertical rule: a pixel column inked down (nearly) the whole window
    counts = [0] * (c1 - c0)
    for r in range(r0, r1 + 1):
        row = s[r * stride + c0: r * stride + c1]
        for i, v in enumerate(row):
            if v < 140:
                counts[i] += 1
    n = r1 - r0 + 1
    vert = {i for i, c in enumerate(counts) if c > 0.85 * n}
    vert |= {i + d for i in vert for d in (-2, -1, 1, 2)}

    def safe(r):
        row = s[r * stride + c0: r * stride + c1]
        ink = [i for i, v in enumerate(row) if v < 140 and i not in vert]
        return not ink or len(ink) > 0.6 * (c1 - c0)       # blank, or a horizontal rule across the table

    mine = [l for l in lines if l.page == pno]
    if on_rule is None:
        # a rule drawn in a way rule_ys misses (WME03 Jun 2022, FP1 Jan 2021): a pixel row inked across the table
        for rr in range(int((y - 1.5) * k), int((y + 1.5) * k) + 1):
            if 0 <= rr < h:
                row = s[rr * stride + c0: rr * stride + c1]
                if sum(1 for i, v in enumerate(row) if v < 140 and i not in vert) > 0.6 * (c1 - c0):
                    on_rule = rr / k
                    break
    if on_rule is not None:
        # On a table rule, the cells' border: the usual case. But a denominator or a bracket of the row above
        # can hang over the rule (dx³ over its rule in FP2 Oct 2020 1(a), (1½, π/3) in Jun 2021 3(a)): then
        # the edge goes down past that overhang to the first clear row, handing no line of the next row over.
        below = [rr for rr in range(int((on_rule + 1.5) * k), min(h, int((on_rule + 8) * k)))]
        if not below or safe(below[0]) or below[0] / k > hi - 3:
            return y
        # only ink that crosses the rule: the same columns inked just above it too (else it's the next row's
        # own tall first line starting under its border, WST01 Jan 2024 1(b))
        ra = int((on_rule - 1.5) * k)

        def cols(r):
            return {i for i, v in enumerate(s[r * stride + c0: r * stride + c1]) if v < 140 and i not in vert}
        if ra < 0 or not (cols(ra) & cols(below[0])):
            return y
        # ink of the next row's first line rising over the rule (numerators of 3(b)'s g(x) = 3x - 1 - 2/x …
        # in P4 Oct 2021): the edge goes up past it instead
        crossing = [l for l in mine if l.y0 < on_rule - 0.5 < l.y1]
        if crossing and all(l.mid > on_rule for l in crossing):
            for rr in range(int((on_rule - 1.5) * k), max(0, int((on_rule - 8) * k)), -1):
                if rr / k < lo + 3:
                    break
                if safe(rr):
                    ny = rr / k
                    return y if any(ny < l.mid < y for l in mine) else ny
            return y
        for rr in below[1:]:
            if rr / k > hi - 3:
                break
            if safe(rr):
                ny = rr / k
                if any(y < l.mid < ny and l.y0 > on_rule - 0.5 for l in mine):
                    return y                    # (a line starting above the rule hangs over it: it moves too)
                return ny
        return y
    r = int(round(y * k))
    # a blank pixel row with ink right above and below it is inside a glyph (the waist of a '2': FP2 Oct 2020 7)
    clean = 0 <= r < h and safe(r) and (r - 1 < 0 or r + 1 >= h or safe(r - 1) or safe(r + 1))
    cut = [l for l in mine if l.y0 + 0.5 < y < l.y1 - 0.5]
    # a denominator: a cut line sitting right under another line it overlaps (the dx³ of d³y/dx³, FP2 Oct
    # 2020 1(a)); the text is read as two lines, but the fraction is one thing and belongs to the row above
    def under(l, m):            # l sits right under m and mostly within it, as a denominator under its numerator
        ov = min(l.x1, m.x1) - max(l.x0, m.x0)
        return m is not l and m.y1 <= l.y0 + 3 and l.y0 - m.y1 < 2.5 and ov > 0.5 * (l.x1 - l.x0)

    def bar_over(l):            # a fraction bar drawn just above l and across it: l is a denominator
        a, b = int((l.x0 - x0) * k), int((l.x1 - x0) * k)
        if b - a < 3:
            return False
        for rr in range(int((l.y0 - 2) * k), int((l.y0 + 3) * k) + 1):
            if not 0 <= rr < h:
                continue
            row = s[rr * stride + c0: rr * stride + c1]
            if sum(1 for v in row if v < 140) > 0.6 * (c1 - c0):
                continue                # a table rule across the page, not a fraction bar
            seg = row[max(0, a - 2): min(len(row), b + 2)]
            if seg and sum(1 for v in seg if v < 140) >= 0.5 * len(seg):
                return True
        return False

    denoms = [l for l in cut if any(under(l, m) for m in mine) or (l.y0 < y and bar_over(l))]
    # clean, unless a denominator's box starts above the edge and its ink below (S1 Jan 2021 5(b)(i)'s '/15')
    if clean and not any(l.mid > y and l.y0 < y - 1 for l in denoms):
        return y
    down_only = bool(denoms) or any(MS_PART_TOTAL.match(l.text) or MS_TOTAL.match(l.text) for l in cut)

    def ok(ny):
        if down_only and ny < y:
            return False
        a, b = min(y, ny), max(y, ny)
        for l in mine:
            if l in cut:
                if l not in denoms and not (down_only and ny > y) and a < l.mid < b:
                    return False                # a cut line stays with the side its middle is on
            elif a < l.mid < b:
                return False                    # never hand a whole line to the other crop
        return True

    for ry in sorted(rules, key=lambda ry: abs(ry - y)):
        if abs(ry - y) > rule_reach:
            break
        if ok(ry):
            return ry - 1                       # just above the rule, as row starts are
    for d in range(1, int(max(reach + (3 if denoms else 0), max((l.y1 - y + 2 for l in denoms), default=0)) * k) + 1):
        for rr in (r - d, r + d):
            if 0 <= rr < h and lo + 3 < rr / k < hi - 3 and safe(rr) and ok(rr / k):
                return rr / k
    return y


def clear_ms_edges(doc, rows, notes, lines=()):
    """Move the mark-scheme boundaries two crops share off printed ink: between a question's rows, between its
    last row and its notes, and between its notes and the next question's first row (both sides move together,
    so nothing is lost or shown twice)."""
    for a, b in zip(rows, rows[1:]):
        if a.q == b.q and a.end == b.start and a.end[0] == b.start[0]:
            pno = a.end[0]
            lo = a.start[1] if a.start[0] == pno else 8
            hi = b.end[1] if b.end and b.end[0] == pno else doc[pno].rect.height - 6
            y = ms_safe_y(doc, pno, a.end[1], lo, hi, lines)
            a.end = b.start = (pno, y)
            # the upper part's subtotal '(5)' is level with the top of the next part's first line (a stacked
            # fraction), so no straight cut separates them (P4 Oct 2021 3): the upper crop runs to the subtotal's
            # foot with the text side below the step painted out, the lower one starts above that line with the
            # marks side painted out
            pl = [l for l in lines if l.page == pno]
            sub = [l for l in pl if MS_PART_SUB.match(l.text) and l.y1 - 1 <= y <= l.y1 + 4]
            cross = [l for l in pl if sub and l.y0 < y - 1 and l.y1 > y - 1.5 and l.x1 < sub[-1].x0 - 3
                     and l.y0 >= sub[-1].y0 - 6]
            # (its glyphs well above the edge, not just a line box's padding over a rule)
            cross = cross if any(l.y1 > y + 1 for l in cross) and y - min(l.y0 for l in cross) > 5 else []
            if sub and cross and not glyph_cut(doc, pno, y, min(l.x0 for l in cross) - 1, max(l.x1 for l in cross) + 1):
                cross = []
            if sub and cross:
                s0 = sub[-1]
                ytop = min(l.y0 for l in cross) - 1.5
                if (s0.y0 - 6 < ytop + 1.5 and ytop > lo + 5
                        and not any(l.x1 < s0.x0 - 3 and ytop < l.y1 <= y and l not in cross
                                    and l.y0 < ytop for l in pl)):
                    ybot = max(y, s0.y1 + 1.5)
                    a.end = (pno, ybot)
                    b.start = (pno, ytop)
                    cx0, cx1 = min(l.x0 for l in cross) - 1.5, max(l.x1 for l in cross) + 1.5
                    a.masks = (a.masks or []) + [(pno, cx0, ytop, cx1, ybot + 3)]
                    b.masks = (b.masks or []) + [(pno, s0.x0 - 2, ytop - 3, s0.x1 + 2, ybot)]
    by_q = {}
    for r in rows:
        by_q.setdefault(r.q, []).append(r)
    for qn, (ns, ne) in list(notes.items()):
        last = by_q[qn][-1]
        # the row's end (under its total line) and the notes' start: one edge
        if last.end and last.end[0] == ns[0] and 0 <= ns[1] - last.end[1] < 1 or (
                last.end and last.end[0] == ns[0] and 0 <= last.end[1] - ns[1] <= PAD):
            pno = ns[0]
            lo = last.start[1] if last.start[0] == pno else 8
            hi = ne[1] if ne[0] == pno else doc[pno].rect.height - 6
            y = ms_safe_y(doc, pno, last.end[1], lo, hi, lines)
            last.end, ns = (pno, y), (pno, y)
        nxt = by_q.get(qn + 1)
        if nxt and nxt[0].start == ne:
            pno = ne[0]
            lo = ns[1] if ns[0] == pno else 8
            hi = nxt[0].end[1] if nxt[0].end and nxt[0].end[0] == pno else doc[pno].rect.height - 6
            y = ms_safe_y(doc, pno, ne[1], lo, hi, lines)
            ne = nxt[0].start = (pno, y)
        elif ne[0] < len(doc):
            pno = ne[0]
            lo = ns[1] if ns[0] == pno else 8
            hi = min(ne[1] + 4, nxt[0].start[1] if nxt and nxt[0].start[0] == pno else doc[pno].rect.height - 6)
            if hi > ne[1] + 2:
                y = ms_safe_y(doc, pno, ne[1], lo, hi, lines)
                ne = (pno, y)
        # notes printed between the question's total and an alternative after them (a gap): the row before
        # ends where they start, the alternative starts where they end: those seams move off ink too
        for r in by_q[qn][:-1]:
            if r.end and r.end[0] == ns[0] and abs(r.end[1] - ns[1]) < 1:
                pno = ns[0]
                lo = r.start[1] if r.start[0] == pno else 8
                hi = ne[1] if ne[0] == pno else doc[pno].rect.height - 6
                y = ms_safe_y(doc, pno, ns[1], lo, hi, lines)
                r.end, ns = (pno, y), (pno, y)
        for r in by_q[qn][1:]:
            if r.start[0] == ne[0] and abs(r.start[1] - ne[1]) < 1:
                pno = ne[0]
                lo = ns[1] if ns[0] == pno else 8
                hi = r.end[1] if r.end and r.end[0] == pno else doc[pno].rect.height - 6
                y = ms_safe_y(doc, pno, ne[1], lo, hi, lines)
                ne = r.start = (pno, y)
        notes[qn] = (ns, ne)


FOOTER = re.compile(r"^Pearson Education Limited\. Registered company", re.I)
PAPER_TOTAL = re.compile(r"^(?:PAPER\s+TOTAL|TOTAL\s+FOR\s+PAPER)\b", re.I)


_RULES = {}


def rule_above(doc, pno, y, gap=14):
    """Is there a full-width table rule just above y? A question's first row starts under one; notes don't."""
    return any(0 <= y - ry < gap for ry in rule_ys(doc, pno))


def rule_ys(doc, pno):
    """Heights of a page's full-width table rules."""
    key = (doc.name, pno)
    if key not in _RULES:
        width = {}                      # rules are often drawn cell by cell: pool the pieces at each height
        spans = {}                      # ...and the x extent they cover (a rule drawn twice is no wider)
        for d in doc[pno].get_drawings():
            for it in d["items"]:
                if it[0] == "l" and abs(it[1].y - it[2].y) < 1:
                    width[round(it[1].y)] = width.get(round(it[1].y), 0) + abs(it[1].x - it[2].x)
                    spans.setdefault(round(it[1].y), []).append(tuple(sorted((it[1].x, it[2].x))))
            r = d["rect"]
            if r.height < 5.0:
                ry = round(r.y1 if r.height >= 2.0 else r.y0)
                width[ry] = width.get(ry, 0) + r.width
                spans.setdefault(ry, []).append((r.x0, r.x1))
        _RULES[key] = [y for y, w in width.items() if w > 300]
        cover = {}
        _RULE_X[key] = {y: (min(a for a, _ in spans[y]), max(b for _, b in spans[y]))
                        for y in _RULES[key] if spans.get(y)}
        for y in _RULES[key]:
            tot, end = 0.0, -1e9
            for a, b in sorted(spans.get(y, ())):
                if b > end:
                    tot += b - max(a, end)
                    end = b
            cover[y] = tot
        _RULE_W[key] = cover
    return _RULES[key]


_RULE_W = {}
HDR_WORD = re.compile(r"Question(?:\s+Number)?|Number|Scheme|Notes?|Marks?|Answer|Q", re.I)
APP_HEAD = re.compile(r"^Some\s+(?:more\s+|other\s+)*unusual\s+methods\s+for\s+(?:Q(?:uestion)?\s*)?(\d{1,2})", re.I)
APPENDIX_NOTES = {}     # ms file -> {question: (start, end)} of methods printed after the last question
_RULE_X = {}


def row_rule_ys(doc, pno):
    """The table rules that span (nearly) the whole mark-scheme table: its rows' borders, not the rules of a
    smaller table drawn inside a cell (D1 Jan 2023 4(a)'s precedence table)."""
    rule_ys(doc, pno)
    ws = _RULE_W[(doc.name, pno)]
    # the table's width (a stray page-wide strip, M1 Jan 2021 p14, is not a row border)
    x0, x1 = ms_x_range(doc)
    ref = x1 - x0
    return [y for y, w in ws.items() if 0.75 * ref <= w <= 1.1 * ref]


_COL_VSEGS = {}


def col_rule_spans(doc, pno, col, y0, y1):
    """True when the Question Number column's right vertical rule spans continuously (ignoring tiny horizontal
    rule gaps) from y0 to y1; stops table_top from climbing through full-width notes boxes or diagrams."""
    if y1 - y0 <= 12:
        return True
    key = (doc.name, pno, round(col[1]))
    if key not in _COL_VSEGS:
        rx = col[1] - 2
        segs = []
        for d in doc[pno].get_drawings():
            for it in d["items"]:
                if it[0] == "l" and abs(it[1].x - it[2].x) < 1 and abs(it[1].x - rx) < 6:
                    a, b = sorted((it[1].y, it[2].y))
                    if b > a:
                        segs.append((a, b))
            r = d["rect"]
            if r.width < 4.0 and r.height > 0 and abs(r.x0 - rx) < 6:
                segs.append((r.y0, r.y1))
        segs.sort()
        merged = []
        for a, b in segs:
            if merged and a <= merged[-1][1] + 3:
                merged[-1] = (merged[-1][0], max(merged[-1][1], b))
            else:
                merged.append((a, b))
        _COL_VSEGS[key] = merged
    a0, a1 = y0 + 3, y1 - 3
    if a1 <= a0:
        return True
    covered = sum(max(0.0, min(b, a1) - max(a, a0)) for a, b in _COL_VSEGS[key])
    return covered >= 0.75 * (a1 - a0)


def table_top(doc, pno, y_first, floor, headers=(), items=(), col=None):
    """Top of the ruled table a question's first row is in: directly below the Question Number header if one
    sits on this page above the row, else the highest of the unbroken run of full-width rules ending at that row."""
    ys = set(rule_ys(doc, pno))
    hdr_below = [h for h in headers if floor < h.y0 < y_first]
    if hdr_below:
        h_bot = max(h.y1 for h in hdr_below)
        cand = min((y for y in ys if h_bot - 6 <= y <= h_bot + 10), default=h_bot)
        if col is None or col_rule_spans(doc, pno, col, cand, y_first):
            return min(cand - 0.5, y_first)
        # ...or a merged full-width cell of nothing but the question's diagrams (WME01 Jan 2026 7)
        gap_items = [it for it in items if it.page == pno and cand + 1 < it.y0 and it.y1 < y_first + 1]
        if (gap_items and any(it.kind == "image" and it.y1 - it.y0 > 30 for it in gap_items)
                and not any(it.kind == "text" for it in gap_items)):
            return min(cand - 0.5, y_first)
        floor = max(floor, cand)
    above = sorted((y for y in ys if floor < y <= y_first + 3), reverse=True)
    if not above:
        return y_first
    p_media = [it for it in items if it.page == pno
               and (it.kind == "image" or (it.kind == "drawing" and it.width < 300)) and it.y1 - it.y0 > 30]
    top = above[0]
    for y in above[1:]:
        gap = top - y
        if gap >= 90 and not (gap < 260 and any(it.y0 < top - 4 and it.y1 > y + 4 for it in p_media)):
            break
        if col is not None and not col_rule_spans(doc, pno, col, y, top):
            break
        # a separate table stacked just above, both its edges elsewhere (D1 Jan 2022 4: Q3's notes end with a
        # precedence table 4pt over Q4's table)
        ex = _RULE_X.get((doc.name, pno), {})
        if y in ex and top in ex and abs(ex[y][0] - ex[top][0]) > 3 and abs(ex[y][1] - ex[top][1]) > 3:
            break
        top = y
    return min(top - 0.5, y_first)


def ms_bands(start, end, items, lines, doc=None):
    """Bands of mark-scheme content between two points, skipping each page's repeated table header."""
    bands = []
    for page in range(start[0], end[0] + 1):
        top = start[1] if page == start[0] else 8
        bottom = end[1] if page == end[0] else ((doc[page].rect.height - 6) if doc is not None else 836)
        hdr = [l for l in lines if l.page == page and l.y0 < 130
               and (l.text in ("Question", "Number", "Scheme", "Notes", "Marks", "Q") or l.text.lower() == "scheme")
               and top <= l.mid <= bottom]
        # a header row has its 'Scheme' / 'Marks' cell: a lone 'Q' of the working ('momentum of Q') is not one
        anchor = [l for l in hdr if l.text.lower() in ("scheme", "marks", "notes")]
        hdr = [l for l in hdr if any(abs(l.mid - a.mid) < 15 for a in anchor)]
        if hdr and page != start[0]:
            top = max(l.y1 for l in hdr) + 3
        # an empty 'Question | Scheme | Marks' header at the foot of the page: the next table starts overleaf
        # (WMA02 Oct 2019 8-11, WMA11 Jan 2024 3)
        foot = [l for l in lines if l.page == page and l.y0 > top + 20 and top <= l.mid <= bottom
                and (l.text == "Q" or re.fullmatch(r"Question(?:\s+Number)?|Number|Scheme|Notes|Marks", l.text, re.I))]
        if foot:
            fy = min(l.y0 for l in foot)
            if (not any(l.page == page and l.y0 > fy + 22 and l.mid <= bottom and not re.fullmatch(r"\d{1,3}", l.text)
                        and not FOOTER.match(l.text) for l in lines)
                    and any(l.text == "Q" or re.fullmatch(r"Question.*", l.text, re.I) for l in foot)
                    and any(re.fullmatch(r"Scheme|Marks", l.text, re.I) and abs(l.y0 - fy) < 12 for l in foot)):
                bottom = min(bottom, fy - 4)
        inside = [it for it in items if it.page == page and top <= (it.y0 + it.y1) / 2 <= bottom
                  and not (it.kind == "drawing" and it.y1 - it.y0 > 300)]   # table's long column rules
        # a scanned page: one picture of the whole table spans every row band cut from it (M2 Oct 2022 p22)
        if not inside and doc is not None and not any(l.page == page for l in lines):
            inside = [it for it in items if it.page == page and it.kind == "image" and it.y0 <= top + 1
                      and it.y1 >= bottom - 1]
            if inside:
                bands.append((page, top, bottom))
                continue
        has_content = any(it.kind == "text" or (it.kind == "image" and it.y1 - it.y0 > 20) for it in inside)
        if has_content:
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
            def claimed_by_deeper(r):
                return any(m is not n and len(m.path) > len(n.path) and m.path[:len(n.path)] == n.path
                           and r.path[:len(m.path)] == m.path for m in q.parts)
            # rows for this part (or its sub-parts); a row for a parent ('(i)') only when the part has none of
            # its own: '(i)' then '(b)', '(c)' in the scheme means the '(i)' row is (i)(a)'s, not every sibling's
            own = [r for r in qrows if r.path[:len(n.path)] == n.path and not claimed_by_deeper(r)]
            parent = [r for r in qrows if 0 < len(r.path) < len(n.path) and n.path[:len(r.path)] == r.path]
            whole = [r for r in qrows if not r.path and n.path]       # the question's own rows: as before
            mine = sorted(own + whole + (parent if not own else []), key=qrows.index)
            if not n.path:
                mine = [r for r in qrows if not claimed_by_deeper(r)]
            if not mine:
                problems.append(f"{n.label}: no mark-scheme rows (scheme has "
                                f"{[label_of(q.number, r.path) for r in qrows]})")
            out[n.label] = mine
        for r in qrows:
            if not any(r in v for v in out.values()):
                # a parent's row when every child has its own (a '(i)' header row): it opens the first child
                first = next((n for n in q.parts if r.path and n.path[:len(r.path)] == r.path), None)
                if first is not None:
                    out[first.label] = sorted(out.get(first.label, []) + [r], key=qrows.index)
                else:
                    problems.append(f"MS {label_of(q.number, r.path)}: matches no part of the paper")
    return out, problems


# ---------------------------------------------------------------------------------------------- output

def slug(label, suffix=""):
    """'3(ii)(a)' -> 'q3_ii_a'."""
    return "q" + "_".join(re.findall(r"[0-9]+|[a-z]+", label)) + suffix


_MSX = {}


def ms_x_range(ms_doc):
    """How wide a mark scheme's crops are: its tables' rules and body text, with a little room, within the page.
    A fixed 36-560 clipped the marks column and notes of wider schemes (the 2026 A papers' tables reach x 565,
    their notes x 578); landscape pages (M2 Oct 2022) reach x 770."""
    if ms_doc.name not in _MSX:
        x0, x1, max_w = 36.0, 560.0, 0.0
        for page in ms_doc:
            pw, ph = page.rect.width, page.rect.height
            max_w = max(max_w, pw)
            for d in page.get_drawings():
                r = d["rect"]
                if 8 < r.y0 < ph - 15 and r.width < pw - 20 and r.x0 > 12 and r.x1 < pw - 12:
                    x0, x1 = min(x0, r.x0 - 3), max(x1, r.x1 + 3)
            for b in page.get_text("dict")["blocks"]:          # printed text only: blocks can carry
                for ln in b.get("lines", []):                       # trailing spaces far past their words
                    for s in ln["spans"]:
                        txt = s["text"].strip()
                        if txt and not (txt == "PMT" and s["bbox"][1] < 20) and 8 < s["bbox"][1] < ph - 15:
                            x0, x1 = min(x0, s["bbox"][0] - 3), max(x1, s["bbox"][2] + 3)
        _MSX[ms_doc.name] = (max(4.0, x0), min(max_w - 4, x1))
    return _MSX[ms_doc.name]


def render_bands(doc, bands, name, out_dir, paper_id, x0=COL_X0, x1=None):
    crops = []
    x1 = x1 if x1 is not None else right_edge(doc)
    for i, (page, y0, y1) in enumerate(bands):
        fname = name + (f"_{i + 1}" if len(bands) > 1 else "") + ".webp"
        px1 = min(x1, doc[page].rect.width - 4)
        clip = pymupdf.Rect(x0, y0, px1, y1)
        pix = doc[page].get_pixmap(dpi=DPI, clip=clip, colorspace=pymupdf.csGRAY)
        img = Image.frombytes("L", (pix.width, pix.height), pix.samples)
        mk = MASKS.get((page, y0, y1), []) + MASKS.get((doc.name, page, y0, y1), [])
        if mk:
            draw, sc = ImageDraw.Draw(img), DPI / 72
            for mx0, my0, mx1, my1 in mk:
                draw.rectangle([(mx0 - x0) * sc, (my0 - y0) * sc, (mx1 - x0) * sc, (my1 - y0) * sc], fill=255)
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=QUALITY, method=6)
        (out_dir / fname).write_bytes(buf.getvalue())
        crops.append({"src": f"{SUBJECT}/{paper_id}/{fname}", "w": pix.width, "h": pix.height,
                      "region": {"page": page + 1, "x0": round(x0, 1), "y0": round(y0, 1),
                                 "x1": round(px1, 1), "y1": round(y1, 1)}})
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


def glyph_cut(doc, pno, y, x0, x1):
    """True when a horizontal edge at y runs through printed glyphs between x0 and x1 (not along a table rule,
    nor only across the column's vertical rules)."""
    w, h, stride, s = page_ink(doc, pno)
    k = 100 / 72
    a, b = max(0, int(x0 * k)), min(w, int(x1 * k))
    for r in (int(y * k), int(y * k) + 1):
        if r < 0 or r >= h or b <= a:
            continue
        row = s[r * stride + a: r * stride + b]
        dark = sum(1 for v in row if v < 160)
        if dark > 0.6 * (b - a):
            return False            # on a rule
        if dark > 8:
            return True
    return False


def page_ink(doc, pno):
    """A page as greyscale pixels at 100 dpi, read once."""
    key = (doc.name, pno)
    if key not in _INK:
        pix = doc[pno].get_pixmap(dpi=100, colorspace=pymupdf.csGRAY)
        _INK[key] = (pix.width, pix.height, pix.stride, bytes(pix.samples))
    return _INK[key]


def clear_of_ink(doc, pno, y, limit=16, lines=()):
    """y, or a row above it with nothing printed across the column, so a crop edge there cuts no glyph. Only
    stacked maths moves an edge: a numerator, the n over a Σ, matrix brackets, π/2, a column vector's entries
    (FP3 Jun 2023), which sit above their line's box in narrow pieces. The edge climbs past such narrow ink, up
    to 30 pt, but never through a line of text (ink spread across the column): there it stays where it was,
    so a sentence is never split between two crops (an earlier version did that, FP2 2025-26). Nor into a line
    of `lines` that ends above y: that's the line before, whose denominator (the 4 of π/4) is narrow ink too
    (P3 Jan 2021 10, Jan 2025 10)."""
    w, h, stride, s = page_ink(doc, pno)
    k = 100 / 72
    x0, x1 = int(COL_X0 * k), int(right_edge(doc) * k) - 2
    xm = min(x1, int(MARKS_X * k))              # the marks ('(3)') sit right of this: never a reason to climb

    def spread(r):                              # how far the row's ink reaches across the column, 0 to 1
        row = s[r * stride + x0: r * stride + xm]
        ink = [i for i, v in enumerate(row) if v < 140]
        return (ink[-1] - ink[0]) / max(1, xm - x0) if ink else 0.0

    r = int(y * k)
    if r >= h:
        return y
    top, rr = r, (r if spread(r) > 0 else -1)      # -1: nothing to climb past
    blocked = False
    while rr > 0 and r - rr <= 30 * k:
        if spread(rr) == 0:                     # a clear row: a candidate edge
            if any(l.page == pno and l.y1 <= y + 1 and l.y0 + 1 < rr / k < l.y1 - 3 for l in lines):
                blocked = True                  # inside the line before (its descender space is fine)
                break
            top = rr
            above = [a for a in range(rr - 1, max(0, rr - int(8 * k)), -1) if spread(a) > 0]
            if not above:
                break                           # nothing close above: done
            rr = above[0]
            continue
        if spread(rr) > 0.4:                    # a line of text: don't cut into it or past it
            break
        rr -= 1
    if lines and (top == r or (blocked and r - top <= 2 * k)) and 0 < spread(r) <= 0.4:
        # No way up without entering the line before: the edge is in that line's stacked maths (the 4 of π/4,
        # P3 Jan 2021 10; d²y/dx² with a part's mark beside it, FP2 Jan 2023 9). Go down past it to a clear row
        # instead, if there is one before the next line's text starts.
        nxt = min((l.y0 for l in lines if l.page == pno and l.y0 > y - 0.5 and l.x0 < MARKS_X
                   and l.y1 > y + 1), default=1e9)
        for rd in range(r + 1, min(h, r + int(12 * k) + 1)):
            if spread(rd) > 0.4 or rd / k > nxt + 3:
                break
            if spread(rd) == 0:
                return rd / k
    return top / k if top != r else y


MARKS_X = 470
MASKS = {}      # (page, y0, y1) of a band -> [(x0, y0, x1, y1)] to paint white when it is rendered


def mark_bottom(doc, pno, y):
    """If an edge at y cuts through a part's mark ('(3)', right of MARKS_X), where the mark's ink ends."""
    w, h, stride, s = page_ink(doc, pno)
    k = 100 / 72
    xm, x1 = int(MARKS_X * k), int(right_edge(doc) * k) - 2
    r = int(y * k)
    if r >= h or not any(v < 190 for v in s[r * stride + xm: r * stride + x1]):
        return None
    for rr in range(r + 1, min(h, r + int(16 * k))):
        if not any(v < 190 for v in s[rr * stride + xm: rr * stride + x1]):
            return rr / k + 1.5
    return None


def gap_cut(doc, pno, y, lab, lines=()):
    """Where a part's crop should start, given the line carrying its label ('(a) ...') and a current edge y:
    the middle of the widest blank strip between the last full-width row of text above the label and the
    label's own ink. A denominator under the line above (1 − t of y = 2t/(1 − t): P2 Jan 2020 13) stays above
    it, a numerator over the label's line (the 1 of p^½: P1 Jun 2025 1; the bar of X̄: S3 Jan 2025 6) below.
    None when the edge at y is already in that strip."""
    w, h, stride, s = page_ink(doc, pno)
    k = 100 / 72
    x0, xm = int(COL_X0 * k), min(int(right_edge(doc) * k) - 2, int(MARKS_X * k))

    def spread(r):
        row = s[r * stride + x0: r * stride + xm]
        ink = [i for i, v in enumerate(row) if v < 140]
        return (ink[-1] - ink[0]) / max(1, xm - x0) if ink else 0.0

    # the label's own ink top: the first inked row at the label's left edge, scanning down from its box top
    lx0, lx1 = int(lab.x0 * k), int(min(lab.x0 + 14, lab.x1) * k)
    ltop = None
    for r in range(max(0, int((lab.y0 - 2) * k)), min(h, int((lab.y1 + 2) * k))):
        if any(v < 140 for v in s[r * stride + lx0: r * stride + lx1]):
            ltop = r
            break
    if ltop is None:
        return None
    r_edge = int(y * k)
    # up from the label to the last wide row of text, or 20 pt above the edge
    lo = max(0, min(r_edge, ltop) - int(20 * k))
    # (from above the label's line: its own text, wider than the label, can ink a row before the label does)
    for r in range(min(ltop, int(lab.y0 * k)) - 1, lo, -1):
        if spread(r) > 0.4:
            lo = r
            break
    best, run, start = (0, None), 0, None
    # a text line's middle is ink even where a thin glyph renders too pale to count (the pi of a limit over
    # the integral sign on the label's line: P4 Jun 2021 6(a))
    def core(l):
        return range(int((l.y0 + (l.y1 - l.y0) * 0.3) * k), int((l.y1 - (l.y1 - l.y0) * 0.3) * k) + 1)

    def unseen(l):                      # no dark pixel anywhere in its box's middle
        a, b = int(l.x0 * k), int(l.x1 * k) + 1
        return not any(v < 140 for r in core(l) if 0 <= r < h for v in s[r * stride + a: r * stride + b])
    texty = {r for l in lines if l.page == pno and re.search(r"[^\W_]", l.text) and l.x1 > COL_X0 and l.x0 < MARKS_X
             and unseen(l) for r in core(l)}

    def blank(r):
        return r not in texty and not any(v < 140 for v in s[r * stride + x0: r * stride + xm])

    for r in range(lo + 1, ltop):
        if blank(r):
            if run == 0:
                start = r
            run += 1
            if run > best[0]:
                best = (run, start)
        else:
            run = 0
    if best[0] < 2 or best[1] <= r_edge < best[1] + best[0]:
        return None                                 # the edge is already in the widest blank strip
    return (best[1] + best[0] / 2) / k


def clear_edges(doc, questions, lines=()):
    """Move each question's crop boundaries off printed ink: the top of its first crop, every non-adjacent
    band top (so stacked first-line numerators are never clipped), and every boundary two crops share."""
    for q in questions:
        refs = [(n, i) for n in q.nodes for i in range(len(n.bands))]
        if not refs:
            continue
        n, i = refs[0]
        p, y0, y1 = n.bands[i]
        n.bands[i] = (p, clear_of_ink(doc, p, y0), y1)
        # a part's first band under the band before it on the same page, its label line just below the edge:
        # cut in the blank strip between them (both crops move together)
        for (na, ia), (nb, ib) in zip(refs, refs[1:]):
            pa, y0a, y1a = na.bands[ia]
            pb, y0b, y1b = nb.bands[ib]
            if pa != pb or y1a - y0b > 6 or y0b - y1a > 6:
                continue
            # an answer-book instruction printed after the part's mark is still that part's ('You may use the table
            # on page 30 of the answer book ... The first 2 rows have been completed for you.': P2 Jun 2026 A 10(i))
            lab2 = next((l for l in sorted(lines, key=lambda o: o.y0) if l.page == pb and y0b < l.y0 < y1b
                         and re.match(r"^\(?(?:[a-h]|i{1,3}|iv|v|vi)\)", re.sub(r"^\d{1,2}\.\s*", "", l.text))), None)
            inst = [l for l in lines if l.page == pb and lab2 is not None and y0b - 2 < l.y0 and l.y1 < lab2.y0 + 1]
            if inst and re.match(r"^(?:You (?:may|must|should) use|The first \d+ rows?)", min(inst, key=lambda o: o.y0).text) \
                    and all(re.match(r"^(?:You |The first|answer book|of the answer)", o.text) or o.x0 > 60 for o in inst):
                yb = max(o.y1 for o in inst) + 1
                if y0b < yb < lab2.y0:
                    na.bands[ia] = (pa, y0a, yb)
                    nb.bands[ib] = (pb, yb, y1b)
                    y1a, y0b = yb, yb
            lab = next((l for l in lines if l.page == pb and LABEL.match(l.text) and y0b - 8 < l.y0 < y0b + 25), None)
            if lab is None:
                continue
            g = gap_cut(doc, pb, (y1a + y0b) / 2, lab, lines)
            if g is not None and y0a + 5 < g < y1b - 5 and abs(g - (y1a + y0b) / 2) < 20:
                na.bands[ia] = (pa, y0a, g)
                nb.bands[ib] = (pb, g, y1b)
        for (na, ia), (nb, ib) in zip(refs, refs[1:]):
            pa, y0a, y1a = na.bands[ia]
            pb, y0b, y1b = nb.bands[ib]
            if pa == pb and abs(y1a - y0b) < 0.6:
                y = clear_of_ink(doc, pb, y0b, lines=lines)
                if y0a + 5 < y < y1b - 5 and y != y0b:
                    na.bands[ia] = (pa, y0a, y)
                    nb.bands[ib] = (pb, y, y1b)
                elif (yb := mark_bottom(doc, pb, y0b)) is not None and yb < y1b - 5:
                    # The upper part's mark shares a row with the top of the next part's first line, so no
                    # straight cut separates them: the upper crop runs to the mark's bottom with the text side
                    # below the edge painted out, the lower crop keeps the edge with the marks side painted out.
                    na.bands[ia] = (pa, y0a, yb)
                    MASKS[(pa, y0a, yb)] = [(COL_X0, y0b, MARKS_X, yb)]
                    MASKS[(pb, y0b, y1b)] = MASKS.get((pb, y0b, y1b), []) + [(MARKS_X, y0b, COL_X1 + 5, yb)]
            else:
                floor = y1a + 1 if pa == pb else COL_Y0
                y = max(floor, clear_of_ink(doc, pb, y0b, lines=lines))
                if y < y1b - 5 and y != y0b:
                    nb.bands[ib] = (pb, y, y1b)


# 'Diagram 1', 'Copy of Diagram 1', and a spare 'Copy of Figure 2' (FP2 Jan 2022); a plain 'Figure N' on a later
# page can be the last part's own figure, so it doesn't move
DIAGRAM_CAPTION = re.compile(r"^(?:(?:Copy of )?Diagram|Copy of Figure) (\d+)$", re.I)
SPARE_CAPTION = re.compile(r"\bOnly use\b", re.I)
OPPOSITE_GRID = re.compile(
    r"\b(?:complete (?:the )?tree diagram|tree diagram (?:shown )?on|on the (?:page opposite|opposite page)|"
    r"on the grid opposite|grid (?:provided|below|opposite)|box plot\b.*\b(?:grid|opposite))\b", re.I)


def move_diagram_pages(questions, lines):
    """A figure or grid the student draws on (or its spare copy) often lands on a continuation page at the
    question's last part; move it to the part(s) that ask for it, including same-page trailing Diagram N."""
    for q in questions:
        parts = [n for n in q.nodes if n.role == "part"]
        stem = next((n for n in q.nodes if n.role == "stem"), None)
        # Same-page bottom Diagram N attached to the last part below its mark line (P2 Jun 2025 A Q9)
        if len(parts) > 1 and parts[-1].bands:
            last = parts[-1]
            p, y0, y1 = last.bands[-1]
            caps = [l for l in lines if l.page == p and y0 <= l.y0 <= y1 and DIAGRAM_CAPTION.match(l.text)]
            marks = [l for l in lines if l.page == p and y0 <= l.y0 <= y1 and l.bold and l.x0 > 470 and MARK.match(l.text)]
            if caps and marks and caps[-1].y0 > marks[-1].y1:
                m_bot = marks[-1].y1
                if not any(l.page == p and m_bot < l.y0 < caps[-1].y0 and l.x0 < 120 for l in lines):
                    cm = DIAGRAM_CAPTION.match(caps[-1].text)
                    d = cm[1]
                    kind = "Figure" if "figure" in cm[0].lower() else "Diagram"
                    use = re.compile(rf"\b(?:On|Using|use)\s+{kind}\s+{d}\b", re.I)
                    part_texts = [(m, text_in(m.bands, lines)) for m in parts]
                    target = (next((m for m, s in part_texts if use.search(s)), None)
                              or next((m for m, s in part_texts if re.search(rf"\b{kind}\s+{d}\b", s)), None))
                    if target is not None and target is not last:
                        split_y = m_bot + PAD
                        if split_y > y0 + 5 and y1 > split_y + 5:
                            last.bands[-1] = (p, y0, split_y)
                            target.bands.append((p, split_y, y1))
                            target.bands.sort()
        # a spare page of grids captioned 'Copy of grid for part (b)', 'Copy of grid for part (d)': each copy goes
        # to the part it names (S1 Oct 2020 4)
        by_letter = {n.path[-1]: n for n in parts if n.path}
        for n in parts:
            for band in list(n.bands[1:]):
                p, y0, y1 = band
                caps = sorted((l for l in lines if l.page == p and y0 <= l.y0 <= y1
                               and (cm := re.match(r"^Copy of (?:the )?(?:grid|graph|diagram|table|Figure \d+)"
                                                   r" for part \(([a-h])\)", l.text, re.I))), key=lambda l: l.y0)
                if not caps or not all(re.search(r"\(([a-h])\)", c.text)[1] in by_letter for c in caps):
                    continue
                n.bands.remove(band)
                cuts = [y0] + [c.y0 - 4 for c in caps[1:]] + [y1]
                for c, a, b in zip(caps, cuts, cuts[1:]):
                    tgt = by_letter[re.search(r"\(([a-h])\)", c.text)[1]]
                    tgt.bands.append((p, a, b))
                    tgt.bands.sort()
        part_first = [(m, text_in(m.bands[:1], lines)) for m in parts]
        for n in parts:
            for band in list(n.bands[1:]):              # a continuation page, never a part's own first crop
                p, y0, y1 = band
                blines = [l for l in lines if l.page == p and y0 <= l.y0 <= y1]
                caps = [DIAGRAM_CAPTION.match(l.text) for l in blines if DIAGRAM_CAPTION.match(l.text)]
                if caps:
                    d = caps[0][1]
                    kind = "Figure" if "figure" in caps[0][0].lower() else "Diagram"
                    use = re.compile(rf"\b(?:On|Using|use)\s+{kind}\s+{d}\b", re.I)
                    target = (next((m for m, s in part_first if use.search(s)), None)
                              or next((m for m, s in part_first if re.search(rf"\b{kind}\s+{d}\b", s)), None))
                    if target is not None and target is not n:
                        n.bands.remove(band)
                        target.bands.append(band)
                        target.bands.sort()
                    continue
                if any(LABEL.match(l.text) and l.x0 < 100 for l in blines):
                    continue
                ptxt = " ".join(l.text for l in blines)
                n_txt = text_in(n.bands[:1], lines)
                if fm := re.search(r"\bFigure\s+(\d+)\b", ptxt, re.I):
                    using = [m for m, s in part_first if re.search(rf"\bFigure\s+{fm[1]}\b", s, re.I)]
                    # the stem presents it ('The results are shown on the scatter diagram in Figure 1 on the next
                    # page': S1 Jan 2021 5): it goes with the stem, above every part that uses it
                    if (stem is not None and not SPARE_CAPTION.search(ptxt)
                            and re.search(rf"\bFigure\s+{fm[1]}\b", text_in(stem.bands, lines), re.I)):
                        n.bands.remove(band)
                        stem.bands.append(band)
                        stem.bands.sort()
                        continue
                    if n not in using and using:
                        if SPARE_CAPTION.search(ptxt):
                            target = next((m for m in using if KIND_DRAW.search(text_in(m.bands[:1], lines))), using[0])
                        elif len(using) >= 2 and stem is not None:
                            target = stem
                        else:
                            target = using[0]
                        if target is not n:
                            n.bands.remove(band)
                            target.bands.append(band)
                            target.bands.sort()
                        continue
                if SPARE_CAPTION.search(ptxt) and not KIND_DRAW.search(n_txt):
                    target = next((m for m, s in part_first if m is not n and KIND_DRAW.search(s)), None)
                    if target is not None:
                        n.bands.remove(band)
                        target.bands.append(band)
                        target.bands.sort()
                        continue
                if not OPPOSITE_GRID.search(n_txt):
                    target = next((m for m, s in part_first if m is not n and OPPOSITE_GRID.search(s)), None)
                    if target is not None:
                        n.bands.remove(band)
                        target.bands.append(band)
                        target.bands.sort()


def export(paper_id, doc, questions, lines, ms_doc, rows, notes, ms_lines, ms_items, matched):
    move_diagram_pages(questions, lines)
    clear_edges(doc, questions, lines)
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
                rb = ms_bands(r.start, r.end, ms_items, ms_lines, ms_doc)
                for bp, by0, by1 in rb:
                    mk = [m[1:] for m in (r.masks or []) if m[0] == bp and m[2] < by1 and m[4] > by0]
                    if mk:
                        MASKS[(ms_doc.name, bp, by0, by1)] = mk
                ms_crop_bands += rb
            text = text_in(n.bands, lines)
            parts.append({
                "label": n.label,
                "marks": n.marks,
                "kind": guess_kind((text_in(n.intro.bands, lines) + " " if n.intro else "") + text),
                "topics": [],
                "tagStatus": "none",
                **({"intro": intro} if intro else {}),
                "qp": render_bands(doc, n.bands, slug(n.label), crops, paper_id),
                "ms": render_bands(ms_doc, ms_crop_bands, slug(n.label, "_ms"), crops, paper_id, *ms_x_range(ms_doc)),
                "text": text,
            })
        note = []
        app = APPENDIX_NOTES.get(ms_doc.name, {}).get(q.number)
        if q.number in notes or app:
            nb = ms_bands(*notes[q.number], ms_items, ms_lines, ms_doc) if q.number in notes else []
            nb += ms_bands(*app, ms_items, ms_lines, ms_doc) if app else []
            note = render_bands(ms_doc, nb, slug(str(q.number), "_notes"), crops, paper_id, *ms_x_range(ms_doc))
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
        parts = {p["label"]: p for p in q["parts"]}
        shared = [r for r in risks.text_risks(q) if not (
            r.endswith("text doesn't start at its label")
            and any(h in texts.get(r.split(":")[0], "") for h in risks.label_heads(q["number"], r.split(":")[0])))
            and not (r.endswith("text after the marks") and r.split(":")[0] in parts
                     and risks.benign_after_marks(parts[r.split(":")[0]]))]
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
    entry = next((p for p in json.loads(units.SOURCES.read_text())["papers"] if p["id"] == paper_id), {})
    if entry.get("ms", {}).get("check", {}).get("status", "ok") != "ok":
        # a mark scheme known to be the wrong one (registry/maths/sources.json notes why): show none, and hold
        # every question for a person (the paper's note for students says so)
        rows, notes, ms_lines, ms_items, matched, pair_problems = [], {}, [], [], {}, []
        ms_problems = [f"Q{q.number}: no usable mark scheme for this paper" for q in questions]
    else:
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
