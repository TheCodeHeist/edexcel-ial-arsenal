"""Split a question paper into questions, parts and sub-parts, with where each sits on the page.

Usage:  pipeline/.venv/bin/python pipeline/segment.py WPH14_2026_06          (prints the outline)

Work in progress, built one step at a time on WPH14 June 2026:
  1. read every line of text with its position, and drop page furniture       <- done
  2. find questions, parts, sub-parts, marks and totals; check the marks add up <- done
  3. work out each node's region on each page (text + diagrams, minus answer space)  <- done
  4. render crops and an overlay preview to check by eye                         <- done
  5. pair each leaf with its mark-scheme rows (markscheme.py)                     <- done
  6. write the registry file (src/lib/papers/types.ts)                            <- done (--write)

Usage:  segment.py WPH14_2026_06 --preview   overlay of every region, one PNG per page
        segment.py WPH14_2026_06 --render    crops (WebP) + paper.json in pipeline/cache/segments/<id>/
        segment.py WPH14_2026_06 --write     also registry/<subject>/papers/<id>.json (implies --render)

Layout of a current-spec IAL Physics paper (PDF points, A4 = 595 x 842; see README for how it was measured):
    question number   x ~ 36-50    '13\\t In the Proton…'   ('*15' for an extended-writing question)
    part label        x ~ 55-66    '(a)\\t …'
    part, extended    x ~ 42       '*(b)\\t …' (marked on structure, like a '*' question)
    part + sub-part                '(a)\\t (i)\\t …' both start on one line
    sub-part label    x ~ 70-85    '(i)\\t …', '(ii)\\t …'; sometimes tab-indented from the part column,
                                   '\\t (iii)\\t …' at x ~ 61, so the level comes from the label, not x'
    mark              x > 480      '(2)', at the end of a leaf's prompt; its answer space comes after
    total                          '(Total for Question 13 = 7 marks)'
    answer lines                   lines of dots across the page
    furniture                      rotated 'DO NOT WRITE IN THIS AREA', barcode and page number at y > 795
"""

import io
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

import pymupdf
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import markscheme  # noqa: E402
import reviews  # noqa: E402
import risks  # noqa: E402

pymupdf.TOOLS.mupdf_display_errors(False)

CACHE = Path(__file__).resolve().parent / "cache" / "pdf"

FOOTER_Y = 795      # barcode, page number, 'Turn over' all sit below this
HEADER_Y = 40       # nothing but furniture above this

# '13\t In…', '13 In…', '1:\t A cube…', or the number alone on its line; see outline()
Q_START = re.compile(r"^(\*?)(\d{1,2}):?(?:\t|\s+(?=[A-Z(*])|$)")
PART = re.compile(r"^(\*?)\(([a-h])\)(?=\s|$)")         # '*(b)' is an extended-writing part
SUBPART = re.compile(r"^(\*?)\((i|ii|iii|iv|v|vi)\)(?=\s|$)")
MARK = re.compile(r"^\((\d{1,2})\)$")
TOTAL = re.compile(r"^\(Total for Question \*?(\d{1,2}) = (\d{1,2}) marks?\)")   # '*15' in some A papers
DOTS = re.compile(r"^[.\s…]{20,}$")
ANSWER_LINE = re.compile(r"\.{10,}")          # dotted answer space, incl. 'speed = ..........'
NOT_CONTENT = re.compile(r"^(BLANK PAGE|SECTION [AB]|Answer ALL questions|TOTAL FOR (SECTION|PAPER))", re.I)

# The printable column, inside the page frame. Everything outside is margins, crop marks and barcode.
COL_X0, COL_X1 = 36, 559
COL_Y0, COL_Y1 = 37, 793
PAD = 4                                       # breathing room around a crop, in points

# Crops: greyscale WebP at 150 dpi, quality 70. Tested on the 20(b) graph: grid and scale stay readable on a
# high-density screen, about 25 KB for a third of a page. The papers have no colour.
DPI, QUALITY = 150, 70
CALC = re.compile(r"\b(Calculate|Determine|Show that|Estimate|Find)\b")


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


STD_FRAME = pymupdf.Rect(35.0, 36.0, 560.3, 793.7)   # the page frame of a standard A4 paper (WPH14 June 2026)


class Frame:
    """Maps one page's positions onto the standard A4 layout, and back.

    Most papers put their page frame (a rectangle around the printable area) at STD_FRAME. Some PDFs keep the
    printer's bleed (652 x 899 pt pages, everything ~28 pt further in); the first new-spec papers (January 2019)
    use a smaller frame (479 x 692 at 58, 70). Mapping each page's own frame onto the standard one lets every
    position threshold in this module stay written for one layout; crops are cut with the exact inverse."""

    def __init__(self, rect):
        self.r = rect
        self.sx = STD_FRAME.width / rect.width
        self.sy = STD_FRAME.height / rect.height

    def to_std(self, x0, y0, x1, y1):
        return (STD_FRAME.x0 + (x0 - self.r.x0) * self.sx, STD_FRAME.y0 + (y0 - self.r.y0) * self.sy,
                STD_FRAME.x0 + (x1 - self.r.x0) * self.sx, STD_FRAME.y0 + (y1 - self.r.y0) * self.sy)

    def from_std(self, x0, y0, x1, y1):
        return pymupdf.Rect(self.r.x0 + (x0 - STD_FRAME.x0) / self.sx, self.r.y0 + (y0 - STD_FRAME.y0) / self.sy,
                            self.r.x0 + (x1 - STD_FRAME.x0) / self.sx, self.r.y0 + (y1 - STD_FRAME.y0) / self.sy)


def page_frame(page):
    """The page's frame, or (no frame drawn) the standard one centred on the page."""
    frames = [d["rect"] for d in page.get_drawings()
              if 400 < d["rect"].width < 560 and 600 < d["rect"].height < 800]
    if frames:
        return Frame(max(frames, key=lambda r: r.width * r.height))
    dx, dy = (page.rect.width - 595.3) / 2, (page.rect.height - 841.9) / 2
    return Frame(STD_FRAME + (dx, dy, dx, dy))


def frames(doc):
    return [page_frame(page) for page in doc]


def unshift(text):
    """Undo the +29 shift of fonts with no character map (some 2019 papers): '$\x03VSKHUH' -> 'A sphere'.
    Such spans always contain chr(3) (their space), which never occurs in real text."""
    if "\x03" not in text:
        return text
    # An ordinary space or tab in such a span is a real one, not a shifted '=' (their space is chr(3)).
    return "".join(chr(ord(c) + 29) if ord(c) < 94 and c not in " \t" else c for c in text)


def question_pages(doc):
    """How many pages belong to the question paper itself.

    Some papers (the 2025–26 'A' papers) come as one PDF holding the question paper and then a separate
    Answer Book, with its own cover, repeating every label and total beside the answer spaces. Only the
    question paper is read: it stops at a cover page (a 'Paper reference' box) that comes after a question's
    total. (A cover *before* any question is the real cover behind a stapled-on clarification notice.)"""
    seen_total = False
    for pno in range(doc.page_count):
        text = doc[pno].get_text()
        if seen_total and re.search(r"Paper\s+reference", text, re.I):
            return pno
        seen_total = seen_total or "Total for Question" in text
    return doc.page_count


def read_lines(doc):
    """Every horizontal text line on every page, minus page furniture, in reading order."""
    lines = []
    fr = frames(doc)
    last = question_pages(doc)
    for pno, page in enumerate(doc):
        if pno >= last:
            break
        for block in page.get_text("dict")["blocks"]:
            for l in block.get("lines", []):
                if l["dir"] != (1.0, 0.0):          # the rotated 'DO NOT WRITE IN THIS AREA' margins
                    continue
                text = "".join(unshift(s["text"]) for s in l["spans"]).strip()
                x0, y0, x1, y1 = l["bbox"]
                x0, y0, x1, y1 = fr[pno].to_std(x0, y0, x1, y1)
                if not text or y0 > FOOTER_Y or y1 < HEADER_Y:
                    continue
                lines.append(Line(pno, x0, y0, x1, y1, text))
    lines.sort(key=lambda l: (l.page, round(l.y0), l.x0))
    return lines


def outline(lines):
    """Build the question tree from the labelled lines.

    A line can open with a chain of labels, each optional and each possibly starred (extended writing):
    '15\t (a)\t (i)\t …', '(a)\t (i)\t …', '*(ii)\t …', or just '(a)' alone. They're read left to right."""
    questions, q, part = [], None, None
    for line in lines:
        t = line.text
        rest, at_question = t.lstrip(), False
        # A question starts only with the next number in sequence, so a stray number at the left edge
        # (a table value, a page number) can't start one.
        if (m := Q_START.match(t)) and line.x0 < 52 and int(m[2]) == len(questions) + 1:
            q = Node(m[2], 0, line, extended=bool(m[1]))
            questions.append(q)
            part = None
            rest, at_question = t[m.end():].lstrip(), True
        elif m and q is not None and line.x0 < 52 and m[2] == q.label and PART.match(t[m.end():].lstrip()):
            # Some papers (2026 'A' papers) print the full label on every line: '13\t (a)\t (ii)\t …'.
            # The repeated question number is skipped; the labels after it are read as usual.
            rest = t[m.end():].lstrip()
        if q is None:
            continue                                  # cover page, instructions
        if line.x0 < 100 or at_question:
            # roman sub-part of the current part ('(i)' straight after part (h) is the letter i: a new part)
            if not at_question and part is not None and (m := SUBPART.match(rest)) \
                    and not (m[2] == "i" and part.label.endswith("(h)") and not part.children):
                part.children.append(Node(f"{part.label}({m[2]})", 2, line, extended=bool(m[1])))
                continue
            if m := PART.match(rest):
                label = f"{q.label}({m[2]})"
                if part is None or part.label != label:   # a repeated '(a)' before '(ii)' is the same part
                    part = Node(label, 1, line, extended=bool(m[1]))
                    q.children.append(part)
                rest = rest[m.end():].lstrip()
                if m := SUBPART.match(rest):          # '(a)\t (i)\t Determine…'
                    part.children.append(Node(f"{part.label}({m[2]})", 2, line, extended=bool(m[1])))
                continue
            if at_question:
                continue
        if (m := MARK.match(t)) and line.x0 > 480:
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
    fr = frames(doc)
    for pno, page in enumerate(doc):
        for d in page.get_drawings():
            r = pymupdf.Rect(fr[pno].to_std(*d["rect"]))
            if r.x1 < COL_X0 or r.x0 > COL_X1 or r.y1 < COL_Y0 or r.y0 > COL_Y1:
                continue                                  # margins, crop marks
            if r.width > 500 and r.height > 700:
                continue                                  # the page frame
            if r.width > 480 and r.height < 1.5:
                continue                                  # hairline between questions
            items.append(Item(pno, max(r.y0, COL_Y0), min(r.y1, COL_Y1), "drawing"))
        for img in page.get_image_info():
            x0, y0, x1, y1 = img["bbox"]
            x0, y0, x1, y1 = fr[pno].to_std(x0, y0, x1, y1)
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
        frame = page_frame(pg)
        shape = pg.new_shape()
        for label, level, y0, y1 in boxes:
            r = frame.from_std(COL_X0, y0, COL_X1, y1)
            shape.draw_rect(r)
            shape.finish(color=colours[level], fill=colours[level], fill_opacity=0.08, width=1.2)
            shape.insert_text((r.x1 - 70, r.y0 + 10), label, fontsize=9, color=colours[level])
        shape.commit()
        path = out_dir / f"p{page + 1:02}.png"
        pg.get_pixmap(dpi=60).save(path)
        paths.append(path)
    return paths


def slug(label, suffix=""):
    """'13(b)(i)' -> 'q13_b_i'; the file name of a node's crop."""
    return "q" + "_".join(re.findall(r"[0-9]+|[a-z]+", label)) + suffix


def render(doc, node, paper_dir, subject, paper_id, suffix=""):
    """Cut node.bands out of the pages as WebP files and return their Crop records (see types.ts)."""
    crops = []
    for i, (page, y0, y1) in enumerate(node.bands):
        name = slug(node.label, suffix) + (f"_{i + 1}" if len(node.bands) > 1 else "") + ".webp"
        clip = page_frame(doc[page]).from_std(COL_X0, y0, COL_X1, y1)
        pix = doc[page].get_pixmap(dpi=DPI, clip=clip, colorspace=pymupdf.csGRAY)
        img = Image.frombytes("L", (pix.width, pix.height), pix.samples)
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=QUALITY, method=6)
        (paper_dir / name).write_bytes(buf.getvalue())
        crops.append({"src": f"{subject}/{paper_id}/{name}", "w": pix.width, "h": pix.height,
                      "region": {"page": page + 1, "x0": round(clip.x0, 1), "y0": round(clip.y0, 1),
                                 "x1": round(clip.x1, 1), "y1": round(clip.y1, 1)}})
    return crops


def render_ms(ms_doc, label, rows, paper_dir, subject, paper_id):
    """Cut a part's mark-scheme rows (one band per page, full table width) as WebP crops."""
    crops = []
    bands = markscheme.bands(rows)
    for i, (page, x0, y0, x1, y1) in enumerate(bands):
        name = slug(label, "_ms") + (f"_{i + 1}" if len(bands) > 1 else "") + ".webp"
        clip = pymupdf.Rect(x0 - 1, y0 - 1, x1 + 1, y1 + 1)
        pix = ms_doc[page].get_pixmap(dpi=DPI, clip=clip, colorspace=pymupdf.csGRAY)
        img = Image.frombytes("L", (pix.width, pix.height), pix.samples)
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=QUALITY, method=6)
        (paper_dir / name).write_bytes(buf.getvalue())
        crops.append({"src": f"{subject}/{paper_id}/{name}", "w": pix.width, "h": pix.height,
                      "region": {"page": page + 1, "x0": round(clip.x0, 1), "y0": round(clip.y0, 1),
                                 "x1": round(clip.x1, 1), "y1": round(clip.y1, 1)}})
    return crops


def text_of(node, lines):
    """The node's printed words, for search and tagging (never shown: maths comes out mangled)."""
    out = []
    for page, y0, y1 in node.bands:
        out += [l.text for l in lines if l.page == page and y0 <= (l.y0 + l.y1) / 2 <= y1
                and not ANSWER_LINE.search(l.text)]
    return " ".join(" ".join(out).split())


def guess_kind(q, leaf, text):
    """A first guess at the part's kind; the review step can correct it."""
    if leaf.extended or (q.extended and leaf is q):
        return "extended"
    if leaf is q and q.total == 1 and not q.children:
        return "mcq"
    return "calc" if CALC.search(text) else "short"


def export(doc, questions, lines, paper_id, subject="physics"):
    """Render every crop and write paper.json: the registry record minus what later steps add
    (mark-scheme crops, MCQ answers, topics)."""
    out = CACHE.parent / "segments" / paper_id
    crops_dir = out / "crops"
    crops_dir.mkdir(parents=True, exist_ok=True)
    for old in crops_dir.glob("*.webp"):
        old.unlink()
    ms_doc = pymupdf.open(CACHE / f"{paper_id}_ms.pdf")
    ms_rows = markscheme.by_label(markscheme.split(ms_doc, paper_id))
    leaf_labels = [leaf.label for q in questions for leaf in leaves(q)]
    match, missing, leftover, notes = markscheme.pair(leaf_labels, ms_rows)
    unmatched = [f"{label}: no mark-scheme rows" for label in missing]
    unmatched += [f"{label}: in the mark scheme but not found in the paper" for label in leftover]
    for n in notes:
        print("  note: " + n)
    qs = []
    for q in questions:
        stem = render(doc, q, crops_dir, subject, paper_id, "_stem") if q.children else []
        parts = []
        for part in (q.children or [q]):
            intro = render(doc, part, crops_dir, subject, paper_id, "_intro") if part.children else []
            for leaf in (part.children or [part]):
                text = text_of(leaf, lines)
                rows = ms_rows.get(match.get(leaf.label), [])
                kind = guess_kind(q, leaf, text)
                answer = markscheme.mcq_key(rows) if kind == "mcq" else None
                if kind == "mcq" and not answer:
                    unmatched.append(f"{leaf.label}: MCQ without 'The only correct answer is …' in its MS row")
                parts.append({
                    "label": leaf.label,
                    "marks": leaf.marks or (q.total if leaf is q else 0),
                    "kind": kind,
                    **({"answer": answer} if answer else {}),
                    "topics": [],
                    "tagStatus": "none",
                    **({"intro": intro} if intro else {}),
                    "qp": render(doc, leaf, crops_dir, subject, paper_id),
                    "ms": render_ms(ms_doc, leaf.label, rows, crops_dir, subject, paper_id),
                    "text": text,
                })
        qs.append({"id": f"{paper_id}_q{q.label}", "number": int(q.label), "marks": q.total,
                   "stem": stem, "parts": parts, "check": "pending"})
    paper = {"id": paper_id, "subject": subject, "questions": qs}
    (out / "paper.json").write_text(json.dumps(paper, indent=1, ensure_ascii=False) + "\n")
    size = sum(f.stat().st_size for f in crops_dir.glob("*.webp"))
    return out, len(list(crops_dir.glob("*.webp"))), size, unmatched


ROOT = Path(__file__).resolve().parent.parent
DURATION = re.compile(r"Time:\s*(?:(\d)\s*hours?)?\s*(?:(\d{1,2})\s*minutes?)?", re.I)


def duration_min(doc):
    """Exam length from the cover, e.g. '(Time: 1 hour 45 minutes)' -> 105."""
    text = " ".join(doc[0].get_text().split())
    m = DURATION.search(text)
    if not m or not (m[1] or m[2]):
        return None
    return int(m[1] or 0) * 60 + int(m[2] or 0)


def write_registry(paper_id, doc, out_dir):
    """registry/<subject>/papers/<id>.json: paper.json plus what the manifest knows (unit, series, sources
    with their providers' credit). Questions start 'pending', so nothing reaches the site before it has
    been checked (see reviews.status)."""
    sources = json.loads((ROOT / "registry" / "sources.json").read_text())
    entry = next(p for p in sources["papers"] if p["id"] == paper_id)
    providers = sources["providers"]

    def source(kind):
        f = entry[kind]
        prov = providers[f["via"]]
        return {"url": f["url"], "via": {"name": prov["name"], "url": prov["url"], "credit": prov["credit"]}}

    seg = json.loads((out_dir / "paper.json").read_text())
    paper = {
        "id": paper_id,
        "subject": entry["subject"],
        "unit": entry["unit"],
        "series": entry["series"],
        **({"variant": entry["variant"]} if entry.get("variant") else {}),
        "totalMarks": sum(q["marks"] for q in seg["questions"]),
        "durationMin": duration_min(doc),
        "source": {"qp": source("qp"), "ms": source("ms")},
        "questions": seg["questions"],
    }
    risks.assess(paper, doc, pymupdf.open(CACHE / f"{paper_id}_ms.pdf"))
    lapsed = reviews.apply(paper, reviews.load(entry["subject"], paper_id))
    if lapsed:
        print(f"  {lapsed} question review(s) no longer match the paper (it changed): they need reviewing again")
    path = ROOT / "registry" / entry["subject"] / "papers" / f"{paper_id}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(paper, indent=1, ensure_ascii=False) + "\n")
    return path


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
    if "--render" in sys.argv or "--write" in sys.argv:
        out, n, size, unmatched = export(doc, questions, lines, paper_id)
        print(f"render: {n} crops, {size / 1024:.0f} KB, in {out}")
        for u in unmatched:
            print("  !! " + u)
        if "--write" in sys.argv:
            if problems or unmatched:
                print("not writing the registry file: fix the problems above first")
            else:
                print(f"registry: {write_registry(paper_id, doc, out).relative_to(ROOT)}")


if __name__ == "__main__":
    main()
