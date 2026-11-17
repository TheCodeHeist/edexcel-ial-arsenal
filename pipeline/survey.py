"""Run the segmenter's checks over every paper in the manifest, without rendering anything.

Usage:  pipeline/.venv/bin/python pipeline/survey.py            current spec (WPH1x)
        pipeline/.venv/bin/python pipeline/survey.py WPH0       old spec
        pipeline/.venv/bin/python pipeline/survey.py WPH14_2023 any id prefix

For each paper: the question tree (do the parts add up to each printed total?) and the pairing with the mark
scheme (does every part have rows, is any mark-scheme label left over?). A paper is clean when there's nothing
to report; notes are pairings made by markscheme.pair()'s parent/child fallback, worth knowing but fine.

Run it after any change to segment.py or markscheme.py: a paper that was clean and isn't any more is a
regression. It takes about a minute for all current-spec papers.
"""

import json
import sys
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parent))
import markscheme as M  # noqa: E402
import segment as S  # noqa: E402

pymupdf.TOOLS.mupdf_display_errors(False)
ROOT = Path(__file__).resolve().parent.parent


def survey(paper_id):
    doc = pymupdf.open(S.CACHE / f"{paper_id}_qp.pdf")
    questions = S.outline(S.read_lines(doc))
    problems = S.check(questions)
    labelled = M.by_label(M.split(pymupdf.open(S.CACHE / f"{paper_id}_ms.pdf"), paper_id))
    leaves = [leaf.label for q in questions for leaf in S.leaves(q)]
    _, missing, leftover, notes = M.pair(leaves, labelled)
    problems += [f"{label}: no mark-scheme rows" for label in missing]
    # every MCQ needs its answer key, or the paper can't be marked (segment.py --write refuses it)
    match = M.pair(leaves, labelled)[0]
    for q in questions:
        if not q.children and q.total == 1 and match.get(q.label) and not M.mcq_key(labelled[match[q.label]]):
            problems.append(f"{q.label}: MCQ with no answer key in its mark-scheme row")
    problems += [f"{label}: in the mark scheme but not found in the paper" for label in leftover]
    if not questions:
        problems.insert(0, "no questions found")
    return len(questions), sum(q.total or 0 for q in questions), problems, notes


def main():
    prefix = sys.argv[1] if len(sys.argv) > 1 else "WPH1"
    sources = json.loads((ROOT / "registry" / "sources.json").read_text())
    ids = [p["id"] for p in sources["papers"] if p["id"].startswith(prefix)]
    clean = 0
    for pid in ids:
        try:
            n, marks, problems, notes = survey(pid)
        except Exception as e:                         # a crash is a finding too, not a reason to stop
            n, marks, problems, notes = 0, 0, [f"{type(e).__name__}: {e}"], []
        for note in notes:
            print(f"{pid}: note: {note}")
        if problems:
            print(f"{pid}: {n} questions, {marks} marks: " + "; ".join(problems[:3])
                  + (f" (+{len(problems) - 3} more)" if len(problems) > 3 else ""))
        else:
            clean += 1
    print(f"\n{clean}/{len(ids)} clean")


if __name__ == "__main__":
    main()
