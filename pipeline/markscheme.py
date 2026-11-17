"""Split a mark scheme into the rows belonging to each question label.

Usage:  pipeline/.venv/bin/python pipeline/markscheme.py WPH14_2026_06 [--preview]

A current-spec IAL mark scheme is one table per question: Question Number | Answer | (Additional Guidance) | Mark,
with a header row repeated on every page and a 'Total for question N' row closing each question. Section A
sits on portrait pages, the rest on landscape ones.

Text positions can't be used to find the rows: the maths fonts (Cambria Math) report line boxes far taller than
the text, so on some lines "Or Lepton number" claims to sit above the "Antilepton" printed over it. Instead:
  - rows are the gaps between the table's ruled horizontal lines (its drawn cell borders),
  - text is placed by its baseline, which those fonts don't distort,
  - a row belongs to the question label printed in it; a row with no label continues the previous one
    (a long answer split over rows or pages), and header and 'Total for question' rows belong to nobody.
"""

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

import pymupdf

pymupdf.TOOLS.mupdf_display_errors(False)

CACHE = Path(__file__).resolve().parent / "cache" / "pdf"

LABEL = re.compile(r"^\*?(\d{1,2}(?:\s*\([a-h]\))?(?:\s*\((?:i|ii|iii|iv|v|vi)\))?)\*?$")
TOTAL_ROW = re.compile(r"^Total for (question|section|paper)", re.I)
HEADING_WORDS = re.compile(r"^(Question|Number|Question Number|Answer|Additional Guidance|Mark|Marks)$", re.I)
MCQ_KEY = re.compile(r"(?:only correct|correct) answer is\s*\(?([A-D])\b")


@dataclass
class Row:
    page: int
    y0: float
    y1: float
    x0: float
    x1: float
    label: str | None = None      # the question label printed in its first column, if any
    texts: list = field(default_factory=list)
    kind: str = "body"            # 'header' | 'total' | 'body'


def norm(label):
    """'*15' -> '15', '13 (b) (i)' -> '13(b)(i)'."""
    return re.sub(r"[\s*]", "", label)


def rules(page):
    """y positions of the table's horizontal borders, and the table's left/right edges.

    Borders are often drawn cell by cell, so segments at the same height are pooled: a height counts as a
    row border when its segments together span most of the table."""
    segs = []
    for d in page.get_drawings():
        for item in d["items"]:
            if item[0] == "l":
                p, q = item[1], item[2]
                if abs(p.y - q.y) < 1 and abs(p.x - q.x) > 8:
                    segs.append((min(p.x, q.x), max(p.x, q.x), (p.y + q.y) / 2))
            elif item[0] == "re":
                r = item[1]
                if r.height < 2.5 and r.width > 8:       # hairline drawn as a thin filled rectangle
                    segs.append((r.x0, r.x1, (r.y0 + r.y1) / 2))
                elif r.height >= 2.5 and r.width > 8:    # a cell drawn as a box: its top and bottom edges
                    segs += [(r.x0, r.x1, r.y0), (r.x0, r.x1, r.y1)]
    if not segs:
        return [], None, None
    left, right = min(s[0] for s in segs), max(s[1] for s in segs)
    by_y = {}
    for x0, x1, y in segs:
        by_y.setdefault(round(y), []).append((x0, x1))
    ys = []
    for y, spans in sorted(by_y.items()):
        covered = sum(x1 - x0 for x0, x1 in spans)
        if covered > 0.5 * (right - left):
            if ys and y - ys[-1] < 3:            # double-drawn border: keep one
                continue
            ys.append(y)
    return ys, left, right


def page_texts(page):
    """(x0, baseline y, text) for each line; the baseline is reliable even where the line box isn't."""
    out = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            spans = [s for s in l["spans"] if s["text"].strip()]
            if not spans:
                continue
            text = " ".join("".join(s["text"] for s in l["spans"]).split())
            out.append((l["bbox"][0], spans[0]["origin"][1], text))
    return out


def split(doc):
    """Every table row on every page, labelled, in reading order."""
    rows = []
    for pno, page in enumerate(doc):
        ys, left, right = rules(page)
        if len(ys) < 2:
            continue
        texts = page_texts(page)
        label_x = left + 0.12 * (right - left)          # the Question Number column
        for y0, y1 in zip(ys, ys[1:]):
            row = Row(pno, y0, y1, left, right)
            row.texts = [t for t in texts if y0 < t[1] <= y1 + 1]
            firsts = [t for t in row.texts if t[0] < label_x]
            words = " ".join(t[2] for t in row.texts)
            # The column headings, repeated on each page ('Question Number' may be one line or two).
            if re.search(r"\bQuestion\b", words) and re.search(r"\bAnswer\b", words) and not any(
                    LABEL.match(t[2]) for t in firsts):
                row.kind = "header"
            elif not row.texts or all(HEADING_WORDS.match(t[2]) for t in row.texts):
                # empty slivers and leftovers of the header cell (its shading adds ruled lines inside it,
                # e.g. a slice holding just 'Number')
                row.kind = "header"
            elif any(TOTAL_ROW.match(t[2]) for t in row.texts):
                row.kind = "total"
            else:
                for t in firsts:
                    if m := LABEL.match(t[2]):
                        row.label = norm(m[1])
                        break
            rows.append(row)
    return rows


def by_label(rows):
    """{label: [Row, …]} — each label's own rows plus the unlabelled rows that follow it."""
    out, current = {}, None
    for row in rows:
        if row.kind == "header":
            continue                        # repeated on every page; a continuation keeps the current label
        if row.kind == "total":
            current = None
            continue
        if row.label:
            current = row.label
        if current is None:
            continue                        # before the first question: cover, notes
        out.setdefault(current, []).append(row)
    return out


def mcq_key(rows):
    """'B' from 'The only correct answer is B', or None."""
    for row in rows:
        for _, _, text in row.texts:
            if m := MCQ_KEY.search(text):
                return m[1]
    return None


def bands(rows):
    """Merge a label's rows into one band per page: (page, x0, y0, x1, y1).

    A label's rows run one after another, so everything between its first and last row on a page is its own,
    including the empty slivers some cell borders leave (which belong to no row, and would split the band)."""
    out = []
    for row in rows:
        if out and out[-1][0] == row.page:
            p, x0, y0, x1, _ = out[-1]
            out[-1] = (p, x0, y0, x1, row.y1)
        else:
            out.append((row.page, row.x0, row.y0, row.x1, row.y1))
    return out


def preview(doc, labelled, out_dir):
    out_dir.mkdir(parents=True, exist_ok=True)
    colours = [(0.9, 0.45, 0.0), (0.1, 0.45, 0.9)]
    marked = {}
    for i, (label, rows) in enumerate(labelled.items()):
        for page, x0, y0, x1, y1 in bands(rows):
            marked.setdefault(page, []).append((label, colours[i % 2], x0, y0, x1, y1))
    for page, boxes in sorted(marked.items()):
        pg = doc[page]
        shape = pg.new_shape()
        for label, c, x0, y0, x1, y1 in boxes:
            shape.draw_rect(pymupdf.Rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1))
            shape.finish(color=c, fill=c, fill_opacity=0.10, width=1.5)
            shape.insert_text((x1 - 60, y0 + 11), label, fontsize=9, color=c)
        shape.commit()
        pg.get_pixmap(dpi=50).save(out_dir / f"ms_p{page + 1:02}.png")
    return sorted(marked)


def main():
    paper_id = sys.argv[1] if len(sys.argv) > 1 else "WPH14_2026_06"
    doc = pymupdf.open(CACHE / f"{paper_id}_ms.pdf")
    labelled = by_label(split(doc))
    for label, rows in labelled.items():
        key = mcq_key(rows)
        pages = sorted({r.page + 1 for r in rows})
        print(f"{label:<11} {len(rows)} row(s) on p{','.join(map(str, pages))}" + (f"   answer {key}" if key else ""))
    print(f"\n{len(labelled)} labels")
    if "--preview" in sys.argv:
        out = CACHE.parent / "segments" / paper_id / "preview"
        pages = preview(pymupdf.open(CACHE / f"{paper_id}_ms.pdf"), labelled, out)
        print(f"preview: {len(pages)} pages in {out}")


if __name__ == "__main__":
    main()
