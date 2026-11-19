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
FIXES = Path(__file__).resolve().parent.parent / "registry" / "label-fixes.json"

# '13(b)(i)', '13 (b) (i)', '*15', and the bracketless '12ai', '14cii', '11a' some years use.
# A letter (a–h) always comes before a roman numeral, so '12ai' is (a)(i), never part (ai).
LABEL = re.compile(r"^\*?(\d{1,2})\s*(?:\(?([a-h])\)?)?\s*(?:\(?(i|ii|iii|iv|v|vi)\)?)?\*?$")
# The same label with the start of its answer on the same line: '18(b)(iii) Shorter wire gives…'
LABEL_LEAD = re.compile(r"^\*?(\d{1,2})\s*(?:\(([a-h])\))?\s*(?:\((i|ii|iii|iv|v|vi)\))?\*?(?=\s+\S)")
TOTAL_ROW = re.compile(r"^Total for (question|section|paper)", re.I)
HEADING_WORDS = re.compile(r"^(Question|Number|Question Number|Answer|Additional Guidance|Mark|Marks)$", re.I)
# The wordings Pearson has used: 'The only correct answer is B', 'The only correct answer D because…',
# 'D is the correct answer (as …)', 'B is the only correct answer'. 'A is not the correct answer' never matches.
MCQ_KEY = re.compile(r"correct\s+answer\s+(?:is\s+)?\(?([A-D])\b"
                     r"|\b([A-D])\s+is\s+the\s+(?:only\s+)?correct\s+answer")


@dataclass
class Row:
    page: int
    y0: float
    y1: float
    x0: float
    x1: float
    label: str | None = None      # the question label printed in its first column, if any
    texts: list = field(default_factory=list)
    kind: str = "body"            # 'header' | 'total' | 'restated' | 'body'


def norm(m):
    """A LABEL match -> the standard form: '*15' -> '15', '13 (b) (i)' and '13bi' -> '13(b)(i)'."""
    return m[1] + (f"({m[2]})" if m[2] else "") + (f"({m[3]})" if m[3] else "")


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


def tinted(page):
    """Rectangles filled with a colour (not white or grey). Some mark schemes (WPH14 Jan 2026 A) reprint each
    part's question on a lavender tint between the answer rows; grey fills are headers and totals, everywhere."""
    out = []
    for d in page.get_drawings():
        f = d.get("fill")
        if f and len(f) == 3 and max(f) - min(f) > 0.1 and d["rect"].width > 20 and d["rect"].height > 5:
            out.append(d["rect"])
    return out


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


def split(doc, paper_id=None):
    """Every table row on every page, labelled, in reading order.

    `paper_id` picks up that paper's hand-checked label corrections from registry/label-fixes.json."""
    import json
    fixes = json.loads(FIXES.read_text()).get(paper_id, {}) if paper_id and FIXES.exists() else {}
    rows = []
    for pno, page in enumerate(doc):
        ys, left, right = rules(page)
        if len(ys) < 2:
            continue
        texts = page_texts(page)
        tints = tinted(page)
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
                for i, t in enumerate(firsts):
                    if t[2] in fixes:                       # a misprint checked by a person
                        row.label = fixes[t[2]]
                        break
                    text = re.sub(r"\(\s*([a-z]+)\s*\)", r"(\1)", t[2])   # '17(b)( i)' -> '17(b)(i)'
                    # a label wrapped in its narrow cell: '15(b)' then '(ii)' on the next line
                    if i + 1 < len(firsts) and re.fullmatch(r"\((?:[a-h]|i|ii|iii|iv|v|vi)\)", firsts[i + 1][2]):
                        text += firsts[i + 1][2]
                    if m := LABEL.match(text) or LABEL_LEAD.match(text):
                        row.label = norm(m)
                        break
                # The question reprinted on a tint between the answer rows (2026 A papers). It keeps its label
                # (the part's label cell can start here, the answer rows under it unlabelled) but is not cropped.
                if tints and all(any(r.x0 <= t[0] <= r.x1 and r.y0 <= t[1] <= r.y1 + 1 for r in tints)
                                 for t in row.texts if not (row.label and t[0] < label_x)):
                    row.kind = "restated"
            rows.append(row)
        spills(rows, pno, label_x)
    return rows


def spills(rows, pno, label_x):
    """Let a row keep what hangs over its bottom rule. Pearson sometimes squeezes a worked fraction into its
    cell so that its last line sits on the rule (WPH11 Oct 2023 18(b)(ii): the denominator's baseline is on
    it), and a crop cut at the rule shows that line's lower half at the top of the next row. A row's last
    line normally clears its rule by 5 pt or more (2–3 pt in the guidance pages' tight
    tables); one closer than 2 pt moves the rule down under it, stopping short of the next row's first line."""
    page_rows = [r for r in rows if r.page == pno]
    for above, row in zip(page_rows, page_rows[1:]):
        if above.kind != "body" or not above.texts or above.y1 != row.y0:
            continue
        last = max(t[1] for t in above.texts)
        if above.y1 - last >= 2:
            continue
        # a line on the rule itself is read into both rows (each takes 1 pt past its bottom rule): it is the
        # upper row's, so the next row starts after it
        row.texts = [t for t in row.texts if t[1] > above.y1 + 1]
        nxt = min((t[1] for t in row.texts), default=row.y1)
        y = round(min(last + 3.5, nxt - 9), 1)
        if y > above.y1:
            above.y1 = row.y0 = y


ROMAN = ["", "i", "ii", "iii", "iv", "v", "vi"]


def order(label):
    """'13(b)(ii)' -> (13, 2, 2): labels sort in the order they're printed."""
    m = re.fullmatch(r"(\d+)(?:\(([a-h])\))?(?:\(([ivx]+)\))?", label)
    return int(m[1]), (ord(m[2]) - 96) if m[2] else 0, ROMAN.index(m[3]) if m[3] else 0


def by_label(rows):
    """{label: [Row, …]} — each label's own rows plus the unlabelled rows that follow it."""
    out, current, last = {}, None, (0, 0, 0)
    for row in rows:
        if row.kind == "header":
            continue                        # repeated on every page; a continuation keeps the current label
        if row.kind == "total":
            current = None
            continue
        # Labels are printed in order: a real one comes after the last, and belongs to this question or the
        # next. Anything else in the first column ('27', a '19' from a nuclear equation inside 19(a)(i), a
        # value starting an answer line) is text in a continuing row.
        if row.label and last < order(row.label) and order(row.label)[0] <= last[0] + 1:
            current, last = row.label, order(row.label)
        if current is None or row.kind == "restated":
            continue                        # before the first question (cover, notes); a reprinted question
        out.setdefault(current, []).append(row)
    return out


def related(a, b):
    """True if one label is the other's parent or child: '20(a)' and '20(a)(i)', '15' and '15(a)'."""
    return a != b and (b.startswith(a + "(") or a.startswith(b + "("))


def pair(leaf_labels, labelled):
    """Match the paper's leaves to mark-scheme labels.

    Exact matches first. Then, because Pearson's mark schemes sometimes drop or add a level ('20(a)' for the
    paper's 20(a)(i); '15(a)' for a question with no parts), an unmatched leaf may take an unmatched mark-scheme
    label that is its parent or child — only when that is the one candidate, so nothing is guessed.
    Returns ({leaf: ms label}, leaves with no rows, mark-scheme labels left over, notes)."""
    match = {leaf: leaf for leaf in leaf_labels if leaf in labelled}
    free = [m for m in labelled if m not in match.values()]
    notes = []
    for leaf in [l for l in leaf_labels if l not in match]:
        cands = [m for m in free if related(leaf, m)]
        if len(cands) == 1 and sum(related(l, cands[0]) for l in leaf_labels if l not in match) == 1:
            match[leaf] = cands[0]
            free.remove(cands[0])
            notes.append(f"{leaf}: the mark scheme calls it {cands[0]}")
    missing = [l for l in leaf_labels if l not in match]
    # A leftover label that is a parent of matched leaves (a stem row like '4', a guidance table '1') is
    # harmless: nothing needs it.
    leftover = [m for m in free if not any(match.get(l) and l.startswith(m + "(") for l in leaf_labels)]
    return match, missing, leftover, notes


def mcq_key(rows):
    """'B' from 'The only correct answer is B', or None."""
    for row in rows:
        for _, _, text in row.texts:
            if m := MCQ_KEY.search(text):
                return m[1] or m[2]
    # Some years print just the letter ('C', then '(1)'). Only trusted when it's the one bare letter in the row.
    bare = {text for row in rows for _, _, text in row.texts if re.fullmatch(r"[A-D]", text)}
    return bare.pop() if len(bare) == 1 else None


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
    labelled = by_label(split(doc, paper_id))
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
