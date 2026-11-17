"""Split a question paper into questions, parts and sub-parts, with where each sits on the page.

Usage:  pipeline/.venv/bin/python pipeline/segment.py WPH14_2026_06          (prints the outline)

Work in progress, built one step at a time on WPH14 June 2026:
  1. read every line of text with its position, and drop page furniture       <- done
  2. find questions, parts, sub-parts, marks and totals; check the marks add up <- done
  3. work out each node's region on each page (text + diagrams, minus answer space)  <- done
  4. render crops and an overlay preview to check by eye                         <- preview done

Layout of a current-spec IAL Physics paper (PDF points, A4 = 595 x 842; see README for how it was measured):
    question number   x ~ 36-50    '13\\t In the Proton…'   ('*15' for an extended-writing question)
    part label        x ~ 55-66    '(a)\\t …'
    sub-part label    x ~ 70-85    '(i)\\t …', '(ii)\\t …'; sometimes tab-indented from the part column,
                                   '\\t (iii)\\t …' at x ~ 61, so the level comes from the label, not x'
    mark              x > 480      '(2)', at the end of a leaf's prompt; its answer space comes after
    total                          '(Total for Question 13 = 7 marks)'
    answer lines                   lines of dots across the page
    furniture                      rotated 'DO NOT WRITE IN THIS AREA', barcode and page number at y > 795
"""

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

import pymupdf

pymupdf.TOOLS.mupdf_display_errors(False)

CACHE = Path(__file__).resolve().parent / "cache" / "pdf"

FOOTER_Y = 795      # barcode, page number, 'Turn over' all sit below this
HEADER_Y = 40       # nothing but furniture above this

Q_START = re.compile(r"^(\*?)(\d{1,2})\t")
PART = re.compile(r"^\(([a-h])\)\t")
SUBPART = re.compile(r"^\((i|ii|iii|iv|v|vi)\)\t")
MARK = re.compile(r"^\((\d{1,2})\)$")
TOTAL = re.compile(r"^\(Total for Question (\d{1,2}) = (\d{1,2}) marks?\)")
DOTS = re.compile(r"^[.\s…]{20,}$")
ANSWER_LINE = re.compile(r"\.{10,}")          # dotted answer space, incl. 'speed = ..........'
NOT_CONTENT = re.compile(r"^(BLANK PAGE|SECTION [AB]|Answer ALL questions|TOTAL FOR (SECTION|PAPER))", re.I)

# The printable column, inside the page frame. Everything outside is margins, crop marks and barcode.
COL_X0, COL_X1 = 36, 559
COL_Y0, COL_Y1 = 37, 793
PAD = 4                                       # breathing room around a crop, in points


@dataclass
class Line:
    page: int           # 0-based
    x0: float
    y0: float
    x1: float
    y1: float
    text: str


@dataclass
class Node:
    """A question, part or sub-part. `label` is the full label: '13', '13(b)', '13(b)(i)'."""
    label: str
    level: int                      # 0 question, 1 part, 2 sub-part
    start: Line
    marks: int = 0                  # from its '(n)' (leaves only)
    mark_lines: list = field(default_factory=list)
    children: list = field(default_factory=list)
    extended: bool = False          # '*' question, marked on structure
    total: int | None = None        # questions only: from '(Total for Question …)'
    end: Line | None = None         # questions only: the total line


def read_lines(doc):
    """Every horizontal text line on every page, minus page furniture, in reading order."""
    lines = []
    for pno, page in enumerate(doc):
        for block in page.get_text("dict")["blocks"]:
            for l in block.get("lines", []):
                if l["dir"] != (1.0, 0.0):          # the rotated 'DO NOT WRITE IN THIS AREA' margins
                    continue
                text = "".join(s["text"] for s in l["spans"]).strip()
                x0, y0, x1, y1 = l["bbox"]
                if not text or y0 > FOOTER_Y or y1 < HEADER_Y:
                    continue
                lines.append(Line(pno, x0, y0, x1, y1, text))
    lines.sort(key=lambda l: (l.page, round(l.y0), l.x0))
    return lines


def outline(lines):
    """Build the question tree from the labelled lines."""
    questions, q, part = [], None, None
    for line in lines:
        t = line.text
        if (m := Q_START.match(t)) and line.x0 < 52:
            q = Node(m[2], 0, line, extended=bool(m[1]))
            questions.append(q)
            part = None
        elif q is None:
            continue                                  # cover page, instructions
        elif line.x0 < 100 and (m := SUBPART.match(t.lstrip())) and part is not None \
                and not (m[1] == "i" and part.label.endswith("(h)") and not part.children):
            # roman sub-part; '(i)' straight after part (h) would be the letter i, i.e. the next part
            part.children.append(Node(f"{part.label}({m[1]})", 2, line))
        elif line.x0 < 100 and (m := PART.match(t.lstrip())):
            part = Node(f"{q.label}({m[1]})", 1, line)
            q.children.append(part)
        elif (m := MARK.match(t)) and line.x0 > 480:
            leaf = (part.children[-1] if part and part.children else part) or q
            leaf.marks += int(m[1])
            leaf.mark_lines.append(line)
        elif m := TOTAL.match(t):
            if m[1] != q.label:
                raise ValueError(f"total for question {m[1]} found inside question {q.label}")
            q.total, q.end = int(m[2]), line
    return questions


@dataclass
class Item:
    """Something printed on a page that belongs in a crop: a text line, a drawing or an image."""
    page: int
    y0: float
    y1: float
    kind: str           # 'text' | 'drawing' | 'image'


def content_items(doc, lines):
    """What's actually printed in the column, page by page: text (minus answer lines and section
    headers), vector drawings (minus the page frame and question-separating hairlines) and images
    (minus the margin strips)."""
    items = []
    for l in lines:
        if ANSWER_LINE.search(l.text) or NOT_CONTENT.match(l.text) or TOTAL.match(l.text):
            continue
        items.append(Item(l.page, l.y0, l.y1, "text"))
    for pno, page in enumerate(doc):
        for d in page.get_drawings():
            r = d["rect"]
            if r.x1 < COL_X0 or r.x0 > COL_X1 or r.y1 < COL_Y0 or r.y0 > COL_Y1:
                continue                                  # margins, crop marks
            if r.width > 500 and r.height > 700:
                continue                                  # the page frame
            if r.width > 480 and r.height < 1.5:
                continue                                  # hairline between questions
            items.append(Item(pno, max(r.y0, COL_Y0), min(r.y1, COL_Y1), "drawing"))
        for img in page.get_image_info():
            x0, y0, x1, y1 = img["bbox"]
            if x1 < COL_X0 + 5 or x0 > COL_X1 - 5:
                continue                                  # 'DO NOT WRITE' margin strips
            items.append(Item(pno, y0, y1, "image"))
    return items


def flatten(questions):
    """All nodes in reading order."""
    out = []
    for q in questions:
        out.append(q)
        for part in q.children:
            out.append(part)
            out.extend(part.children)
    return out


def regions(questions, items):
    """Set node.bands = [(page, y0, y1), …]: the part of each page that shows this node's own content.

    A node runs from its label to wherever the next label starts (or its question's total line). For a node
    with children that's just its stem / intro; for a leaf it's its prompt, any diagram, and its answer space.
    Only real content counts, so dotted answer lines and blank space fall away at the edges."""
    order = flatten(questions)
    owner = {}
    for q in questions:
        for n in [q, *q.children, *[s for p in q.children for s in p.children]]:
            owner[id(n)] = q
    for i, node in enumerate(order):
        q = owner[id(node)]
        start = (node.start.page, node.start.y0 - 1)
        nxt = order[i + 1] if i + 1 < len(order) else None
        if nxt is not None and owner[id(nxt)] is q:
            end = (nxt.start.page, nxt.start.y0 - 1)
        else:
            end = (q.end.page, q.end.y0 - 1) if q.end else (start[0], COL_Y1)
        node.bands = []
        for page in range(start[0], end[0] + 1):
            top = start[1] if page == start[0] else COL_Y0
            bottom = end[1] if page == end[0] else COL_Y1
            inside = [it for it in items if it.page == page and top <= (it.y0 + it.y1) / 2 <= bottom]
            if inside:
                y0 = max(top, min(it.y0 for it in inside) - PAD)
                y1 = min(bottom, max(it.y1 for it in inside) + PAD)
                node.bands.append((page, y0, y1))


def leaves(node):
    if not node.children:
        return [node]
    return [leaf for child in node.children for leaf in leaves(child)]


def check(questions):
    """Problems found: marks that don't add up to the printed total, missing totals, gaps in numbering."""
    problems = []
    for i, q in enumerate(questions, 1):
        if q.label != str(i):
            problems.append(f"question {q.label} found where {i} was expected")
        if q.total is None:
            problems.append(f"question {q.label}: no '(Total for Question …)' line")
            continue
        got = sum(leaf.marks for leaf in leaves(q))
        # A question with no parts may print no '(n)' of its own (every MCQ; some 6-mark questions):
        # then its total is its mark.
        if got == 0 and not q.children:
            q.marks = q.total
            continue
        if got != q.total:
            problems.append(f"question {q.label}: parts add to {got}, paper says {q.total}")
    return problems


def print_outline(questions):
    for q in questions:
        star = "*" if q.extended else ""
        print(f"{star}{q.label:>3}  total {q.total}  (p{q.start.page + 1}–{q.end.page + 1 if q.end else '?'})")
        for leaf in leaves(q):
            if leaf is q:
                continue
            print(f"      {leaf.label:<12} {leaf.marks} mark{'s' if leaf.marks != 1 else ''}"
                  f"   p{leaf.start.page + 1} y{leaf.start.y0:.0f}")


def preview(doc, questions, out_dir):
    """Draw every node's bands on its pages (question stems blue, part intros green, leaves orange) and save
    one PNG per page that has any, for checking by eye."""
    colours = {0: (0.1, 0.35, 0.9), 1: (0.1, 0.6, 0.25), 2: (0.95, 0.5, 0.0)}
    out_dir.mkdir(parents=True, exist_ok=True)
    marked = {}
    for node in flatten(questions):
        level = 2 if not node.children else node.level   # every leaf orange, whatever its depth
        for page, y0, y1 in node.bands:
            marked.setdefault(page, []).append((node.label, level, y0, y1))
    paths = []
    for page, boxes in sorted(marked.items()):
        pg = doc[page]
        shape = pg.new_shape()
        for label, level, y0, y1 in boxes:
            r = pymupdf.Rect(COL_X0, y0, COL_X1, y1)
            shape.draw_rect(r)
            shape.finish(color=colours[level], fill=colours[level], fill_opacity=0.08, width=1.2)
            shape.insert_text((COL_X1 - 70, y0 + 10), label, fontsize=9, color=colours[level])
        shape.commit()
        path = out_dir / f"p{page + 1:02}.png"
        pg.get_pixmap(dpi=60).save(path)
        paths.append(path)
    return paths


def main():
    paper_id = sys.argv[1] if len(sys.argv) > 1 else "WPH14_2026_06"
    doc = pymupdf.open(CACHE / f"{paper_id}_qp.pdf")
    lines = read_lines(doc)
    questions = outline(lines)
    regions(questions, content_items(doc, lines))
    print_outline(questions)
    problems = check(questions)
    print(f"\n{len(questions)} questions, {sum(q.total or 0 for q in questions)} marks")
    for p in problems:
        print("  !! " + p)
    if "--preview" in sys.argv:
        out = CACHE.parent / "segments" / paper_id / "preview"
        paths = preview(pymupdf.open(CACHE / f"{paper_id}_qp.pdf"), questions, out)
        print(f"preview: {len(paths)} pages in {out}")


if __name__ == "__main__":
    main()
