"""Check every downloaded Maths PDF against its own cover, and repair from PMT mirrors (pipeline/verify.py,
pointed at registry/maths/sources.json and the Maths unit codes).

Usage:  pipeline/.venv/bin/python pipeline/maths/verify_covers.py            (after fetch_pdfs.py)
        pipeline/.venv/bin/python pipeline/maths/verify_covers.py --no-fix   report only

Maths covers read like Physics ones: 'Mark Scheme (Results) October 2024 … Mechanics M1 (WME01) Paper 01' on a
mark scheme, the exam date and 'Paper reference WMA11/01' on a question paper. A file whose cover names another
paper is swapped for a PMT mirror that agrees; the wrong link is kept under "rejected" so it isn't re-imported.
(PaperLords' January 2024 M1, M2 and S2 buttons open the October 2024 papers; this is what catches that.)
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import verify  # noqa: E402
import units   # noqa: E402

verify.SOURCES = units.SOURCES
verify.BY_EYE = units.SOURCES.parent / "covers-by-eye.json"
verify.CODE = re.compile(r"\b(WMA|WFM|WME|WST|WDM)\s?(\d{2,3})\)?(?:\s*[/_]\s*0?1([A-Z])?\b)?")

# 2026 mark schemes have a new cover: 'Mark Scheme (Post-standardisation) Summer 2026'.
verify.SEASON = re.compile(r"Mark Scheme\s*\((?:Results|Provisional|Final|Post.standardisation)\)\s*"
                           r"(Summer|Winter|Autumn|January|June|May|October|November)\s+(20\d\d)")

# Maths A papers have their own mark schemes, but Pearson prints them as 'WMA11/01', without the A (the
# question paper's cover does say 'WMA11/01A'). So a mark scheme's cover can't say which variant it is; judge
# only the question paper's. Whether an A mark scheme really is the A one shows when its file differs from the
# main paper's (verify reports identical files filed under two papers).
_compare = verify.compare


def compare(paper, kind, cover):
    if kind == "ms" and cover.get("code") == paper["unit"]:
        cover = {**cover, "variant": paper.get("variant", "")}
    return _compare(paper, kind, cover)


verify.compare = compare

if __name__ == "__main__":
    verify.main()
