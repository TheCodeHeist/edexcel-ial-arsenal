"""After a change to the segmenter: find the papers whose question crops it changes, and re-cut only those.

Usage:  pipeline/.venv/bin/python pipeline/recut.py [prefix]            list what would change (nothing written)
        pipeline/.venv/bin/python pipeline/recut.py [prefix] --write    re-cut those papers (segment.py --write)

The check needs no rendering: it runs the segmenter's layout steps and compares every crop region with the
registry file, the same way the registry lists them (stem, then each part's intro and crops; a part's intro is
repeated for each of its sub-parts). Re-cutting a paper rewrites all its crops, but only the changed questions
get new fingerprints, so reviews and AI readings of the rest stay valid (reviews.fingerprint).

Afterwards: publish.py the re-cut papers, then ai_read.py todo lists exactly the changed questions to re-read.
"""

import json
import subprocess
import sys
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parent))
import segment as S  # noqa: E402

pymupdf.TOOLS.mupdf_display_errors(False)
ROOT = Path(__file__).resolve().parent.parent


def regions(doc, bands):
    out = []
    for page, y0, y1 in bands:
        c = S.page_frame(doc[page]).from_std(S.COL_X0, y0, S.COL_X1, y1)
        out.append((page + 1, round(c.y0, 1), round(c.y1, 1)))
    return out


def changed_questions(paper):
    """Question numbers whose crop regions the current segmenter would change."""
    doc = pymupdf.open(S.CACHE / f"{paper['id']}_qp.pdf")
    lines = S.read_lines(doc)
    qs = S.outline(lines)
    items = S.content_items(doc, lines)
    S.regions(qs, items, doc)
    S.reattach_grids(qs, items, lines)
    S.shared_leads(qs, lines, items)
    old = {q["number"]: [(c["region"]["page"], c["region"]["y0"], c["region"]["y1"])
                         for c in q["stem"] + [c for p in q["parts"] for c in p.get("intro", []) + p["qp"]]]
           for q in paper["questions"]}
    out = []
    for q in qs:
        new = regions(doc, q.lead) + (regions(doc, q.bands) if q.children else [])
        for part in (q.children or [q]):
            intro = regions(doc, part.bands) if part.children else []
            for leaf in (part.children or [part]):
                new += intro + regions(doc, leaf.bands)
        if new != old.get(int(q.label)):
            out.append(int(q.label))
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    prefix = args[0] if args else "WPH1"
    write = "--write" in sys.argv
    papers, total = [], 0
    for f in sorted((ROOT / "registry").glob(f"*/papers/{prefix}*.json")):
        paper = json.loads(f.read_text())
        qs = changed_questions(paper)
        if qs:
            papers.append(paper["id"])
            total += len(qs)
            print(f"{paper['id']}: q{','.join(map(str, qs))}", flush=True)
    print(f"\n{total} questions change in {len(papers)} papers")
    if write:
        failed = []
        for pid in papers:
            r = subprocess.run([sys.executable, str(Path(__file__).parent / "segment.py"), pid, "--write"],
                               capture_output=True, text=True)
            ok = r.returncode == 0 and "registry:" in r.stdout
            print(f"{'re-cut' if ok else 'FAILED'} {pid}", flush=True)
            if not ok:
                failed.append(pid)
                print(r.stdout[-800:] + r.stderr[-800:])
        print(f"\nre-cut {len(papers) - len(failed)}/{len(papers)}; next: publish.py " + " ".join(papers))
        if failed:
            sys.exit(f"failed: {' '.join(failed)}")


if __name__ == "__main__":
    main()
