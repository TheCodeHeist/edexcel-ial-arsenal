"""Risk signals: the reasons a person should look at a question instead of trusting the pipeline.

Usage:  pipeline/.venv/bin/python pipeline/risks.py                 every current-spec paper (WPH1x)
        pipeline/.venv/bin/python pipeline/risks.py WPH14_2023      any id prefix

Every paper already passes the hard checks (parts add up to the printed totals, every part has mark-scheme rows,
every MCQ has a key), so what's left is whether the crops are *cut* right. Nobody can look at 2,000 questions,
so each question gets a list of risks, and only questions with one go to a person (see reviews.apply):

  content cut by a crop edge   a diagram, image or line of text straddles the top or bottom of a crop
  part runs across pages       the part is in two crops; easy to lose a line or a diagram at the break
  text after the marks         words after the part's '(n)', e.g. graph axes in the answer space; fine for
                               a drawing question, a sign of a wrong boundary otherwise
  doesn't start at its label   the crop's text doesn't open with the part's label
  marks don't match            the '(n)' that ends the part isn't the part's marks
  mark scheme pairing          paired by markscheme.pair()'s parent/child fallback, or through label-fixes.json
  MCQ key from a lone letter   the answer came from a bare 'C' in the row, not a sentence saying so

A question with no risks still isn't shown on the site until the AI reader has looked at it too and reported
nothing (that's 'machine' in reviews.apply). The risks are written into each registry file, so the review tool
can list and sort by them without opening any PDF.
"""

import json
import re
import sys
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parent))
import markscheme as M  # noqa: E402
import reviews  # noqa: E402

pymupdf.TOOLS.mupdf_display_errors(False)
ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(__file__).resolve().parent / "cache" / "pdf"
EDGE_TOL = 3        # points either side of a crop edge before something counts as cut


def label_heads(number, label):
    """What a part's text may open with: '13', '(b)', '(b)(ii)' or '(b) (ii)', '(ii)'."""
    parts = re.findall(r"\([a-z]+\)", label)
    heads = {str(number)}
    for i in range(len(parts)):
        heads.add("".join(parts[i:]))
        heads.add(" ".join(parts[i:]))
    return heads


def text_risks(q):
    out = []
    for p in q["parts"]:
        t = p.get("text", "").strip()
        if p["kind"] != "mcq":              # MCQs carry no '(1)' of their own
            m = re.search(r"\((\d{1,2})\)\s*$", t)
            if not m:
                out.append(f"{p['label']}: text after the marks")
            elif int(m[1]) != p["marks"]:
                out.append(f"{p['label']}: ends with ({m[1]}), not ({p['marks']})")
        bare = re.sub(r"^\*\s*", "", t)
        if not any(bare.startswith(h) for h in label_heads(q["number"], p["label"])):
            out.append(f"{p['label']}: text doesn't start at its label")
        if len({c["region"]["page"] for c in p["qp"]}) > 1:
            out.append(f"{p['label']}: runs across pages")
    return out


BENIGN_TAIL = re.compile(r"Diagram|Figure|grid|redraw|this table|Venn|axes|tree diagram", re.I)


def benign_after_marks(part):
    """Is a part's 'text after the marks' harmless? As the module notes say, it's fine for a drawing question
    (the blank diagram, grid or axes to draw on is printed after the '(n)'). Elsewhere: answer lines
    ('____', '....'), a spare 'Copy of Diagram 1' / redraw grid, or one or two scraps of maths ('(6) 2', the
    n over a sum) that the text extraction put after the mark. Text with no '(n)' at all is never harmless.
    Used by the Maths registry writer, where the AI reader looks at every risky question as well."""
    t = part.get("text", "").strip()
    m = list(re.finditer(r"\((\d{1,2})\)", t))
    if not m:
        return part.get("kind") == "draw"
    if part.get("kind") == "draw":
        return True
    tail = t[m[-1].end():].strip()
    if not re.sub(r"[_.\s`\-]", "", tail):
        return True
    if BENIGN_TAIL.search(tail):
        return True
    toks = tail.split()
    return len(toks) <= 2 and all(len(x) <= 3 for x in toks)


class Pages:
    """What's printed on each page of a question paper, as rectangles, read once per page."""

    def __init__(self, doc):
        self.doc, self.cache = doc, {}

    def things(self, number):
        if number not in self.cache:
            page = self.doc[number - 1]
            # Graph paper is thousands of tiny lines: cluster drawings into the diagrams they make up.
            found = [("diagram", r) for r in page.cluster_drawings() if r.height < 600 and r.width < 600]
            found += [("image", pymupdf.Rect(i["bbox"])) for i in page.get_image_info()]
            found += [("text", pymupdf.Rect(line["bbox"])) for b in page.get_text("dict")["blocks"]
                      for line in b.get("lines", []) if "".join(s["text"] for s in line["spans"]).strip()]
            self.cache[number] = found
        return self.cache[number]

    def inked(self, number, r, g, y):
        """Is anything actually drawn on the edge row, where r is? A picture's box often carries white margins
        well past what it shows, so a box crossing the edge isn't enough."""
        strip = pymupdf.Rect(max(r.x0, g["x0"]), y - 0.5, min(r.x1, g["x1"]), y + 0.5)
        if strip.is_empty:
            return False
        pix = self.doc[number - 1].get_pixmap(dpi=150, clip=strip, colorspace=pymupdf.csGRAY)
        return min(pix.samples) < 160


def edge_risks(q, pages):
    """Anything printed that straddles the top or bottom of one of the question's crops."""
    out = set()
    crops = [("stem", c) for c in q["stem"]]
    for p in q["parts"]:
        crops += [(p["label"], c) for c in p.get("intro", []) + p["qp"]]
    for who, c in crops:
        g = c["region"]
        for kind, r in pages.things(g["page"]):
            if r.x1 <= g["x0"] or r.x0 >= g["x1"]:
                continue
            # Text line boxes run taller than their glyphs (a 't' at the end of an axis can poke 4pt past a
            # crop that shows all of it), so a line only counts when the edge goes well through it.
            tol = max(EDGE_TOL, 0.3 * r.height) if kind == "text" else EDGE_TOL
            for y in (g["y0"], g["y1"]):
                if r.y0 < y - tol and r.y1 > y + tol and (kind == "text" or pages.inked(g["page"], r, g, y)):
                    out.add(f"{who}: {kind} cut by a crop edge")
    return sorted(out)


def ms_risks(paper_id, paper, ms_doc):
    """Per question number: pairings made by the fallback or through a hand fix, and MCQ keys from a lone letter."""
    out = {}
    labelled = M.by_label(M.split(ms_doc, paper_id))
    leaves = [p["label"] for q in paper["questions"] for p in q["parts"]]
    match, _, _, notes = M.pair(leaves, labelled)
    number = {p["label"]: q["number"] for q in paper["questions"] for p in q["parts"]}
    for note in notes:                                  # '13(a): the mark scheme calls it 13'
        leaf = note.split(":", 1)[0]
        out.setdefault(number[leaf], []).append(f"{leaf}: mark scheme pairing by fallback ({note.split(': ', 1)[1]})")
    fixes = json.loads((ROOT / "registry" / "label-fixes.json").read_text()).get(paper_id, {})
    for printed, real in fixes.items():
        if real in number:
            out.setdefault(number[real], []).append(f"{real}: mark-scheme label hand-fixed (printed {printed})")
    for q in paper["questions"]:
        for p in q["parts"]:
            rows = labelled.get(match.get(p["label"]), [])
            if p["kind"] == "mcq" or "answerRead" in p:
                said = any(M.MCQ_KEY.search(text) for row in rows for _, _, text in row.texts)
                if not said:
                    out.setdefault(q["number"], []).append(f"{p['label']}: MCQ key read from a lone letter")
    return out


def assess(paper, qp_doc, ms_doc):
    """Set each question's `risks` in place (removed when there are none)."""
    pages = Pages(qp_doc)
    from_ms = ms_risks(paper["id"], paper, ms_doc)
    for q in paper["questions"]:
        found = edge_risks(q, pages) + text_risks(q) + from_ms.get(q["number"], [])
        if found:
            q["risks"] = found
        else:
            q.pop("risks", None)


def main():
    prefix = sys.argv[1] if len(sys.argv) > 1 else "WPH1"
    files = sorted(f for f in (ROOT / "registry").glob(f"*/papers/{prefix}*.json"))
    total = risky = 0
    for f in files:
        paper = json.loads(f.read_text())
        assess(paper, pymupdf.open(CACHE / f"{paper['id']}_qp.pdf"), pymupdf.open(CACHE / f"{paper['id']}_ms.pdf"))
        reviews.apply(paper, reviews.load(paper["subject"], paper["id"]))
        f.write_text(json.dumps(paper, indent=1, ensure_ascii=False) + "\n")
        n = sum(1 for q in paper["questions"] if q.get("risks"))
        total += len(paper["questions"])
        risky += n
        print(f"{paper['id']}: {n}/{len(paper['questions'])} questions need a person")
    print(f"\n{risky} of {total} questions need a person; the rest wait for the AI reader")


if __name__ == "__main__":
    main()
