"""Run the Maths segmenter's checks over every paper in registry/maths/sources.json, without rendering anything.

Usage:  pipeline/.venv/bin/python pipeline/maths/survey.py              every paper with a QP and an MS
        pipeline/.venv/bin/python pipeline/maths/survey.py WME          any id prefix
        pipeline/.venv/bin/python pipeline/maths/survey.py --by-unit    also a clean count per unit
        pipeline/.venv/bin/python pipeline/maths/survey.py --clean      also list the clean papers (to diff runs)

For each paper: the question tree (do the parts add up to each printed total?), the mark-scheme split and the
pairing (does every part get rows?). A paper is clean when there's nothing to report. Run it after any change to
segment.py: a paper that was clean and isn't any more is a regression. Papers whose files fail their cover
check (see verify_covers.py) are skipped and listed.
"""

import json
import multiprocessing
import os
import sys
from collections import defaultdict
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parent))
import segment as S  # noqa: E402
import units         # noqa: E402

pymupdf.TOOLS.mupdf_display_errors(False)


def survey(paper_id):
    doc = S.open_pdf(S.PDF / f"{paper_id}_qp.pdf")
    lines = S.read_lines(doc)
    items = S.content_items(doc, lines)
    questions = S.outline(lines, items)
    S.regions(questions, items, len(doc))
    problems = S.check(questions)
    rows, notes, ms_problems, _, _ = S.ms_split(S.open_pdf(S.PDF / f"{paper_id}_ms.pdf"), questions)
    _, pair_problems = S.pair(questions, rows)
    if not questions:
        problems.insert(0, "no questions found")
    return len(questions), sum(q.total or 0 for q in questions), problems + ms_problems + pair_problems


def survey_one(pid):
    try:
        return pid, *survey(pid)
    except Exception as e:                           # a crash is a finding too, not a reason to stop
        return pid, 0, 0, [f"{type(e).__name__}: {e}"]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    prefix = args[0] if args else "W"
    papers = json.loads(units.SOURCES.read_text())["papers"]
    skipped, clean, by_unit = [], 0, defaultdict(lambda: [0, 0])
    ids = []
    for p in papers:
        if not p["id"].startswith(prefix):
            continue
        ok = all(k in p and p[k].get("check", {}).get("status") == "ok" for k in ("qp", "ms"))
        (ids if ok else skipped).append(p["id"])
    clean_ids = []
    # papers are independent: read them in parallel, report in order
    with multiprocessing.Pool(max(1, (os.cpu_count() or 2) - 2)) as pool:
        results = pool.imap(survey_one, ids)
        for pid, n, marks, problems in results:
            unit = pid.split("_")[0]
            by_unit[unit][1] += 1
            if problems:
                print(f"{pid}: {n} questions, {marks} marks: " + "; ".join(problems[:3])
                      + (f" (+{len(problems) - 3} more)" if len(problems) > 3 else ""), flush=True)
            else:
                clean += 1
                by_unit[unit][0] += 1
                clean_ids.append(pid)
    print(f"\n{clean}/{len(ids)} clean")
    if "--by-unit" in sys.argv:
        print("  " + "  ".join(f"{u} {c}/{t}" for u, (c, t) in sorted(by_unit.items())))
    if "--clean" in sys.argv:
        print("clean: " + " ".join(clean_ids))
    if skipped:
        print(f"skipped (no QP+MS pair whose covers agree): {len(skipped)}: " + " ".join(skipped))


if __name__ == "__main__":
    main()
