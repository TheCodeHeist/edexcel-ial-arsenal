"""Collect Edexcel Physics past-paper links from Physics & Maths Tutor (physicsandmathstutor.com).

Usage:
    pipeline/.venv/bin/python pipeline/scrape_pmt.py                 # old IAL spec + mirrors of the current one
    pipeline/.venv/bin/python pipeline/scrape_pmt.py --include-uk    # also the UK A-level papers (6PH0x)
    pipeline/.venv/bin/python pipeline/scrape_pmt.py --dry-run       # show what it would add

PMT's unit pages are plain HTML (and its robots.txt allows fetching them), so this just reads the six pages,
one second apart. Each page mixes three qualifications; the folder and file name tell them apart:

    Edexcel-IAL/2018-spec/Unit-4/QP/June 2023 (IAL) QP.pdf          current IAL spec   WPH14_2023_06
    Edexcel-IAL/Unit-4/June 2016 (IAL) QP - Unit 4 Edexcel ….pdf     old IAL spec       WPH04_2016_06
    Edexcel-IAL/Unit-4/June 2014 QP - Unit 4 Edexcel ….pdf           UK A-level         6PH04_2014_06
    Edexcel-IAL/Unit-4/June 2014 (R) QP - Unit 4 Edexcel ….pdf       UK, R paper        6PH04_2014_06_R

Current-spec papers we already have (from paperlords) are added as mirrors: a second copy to fall back on
when one source has the wrong file. Specimens, combined booklets and grade boundaries are skipped.
"""

import argparse
import re
import sys
import time
import urllib.request
from pathlib import Path
from urllib.parse import unquote

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_links import import_links  # noqa: E402

PAGE = "https://www.physicsandmathstutor.com/past-papers/a-level-physics/edexcel-unit-{n}/"
UA = "edexcel-ial-arsenal past-paper fetcher"

SERIES = r"(?P<month>January|February|March|April|May|June|July|August|September|October|November|December) (?P<year>\d{4})"
CURRENT = re.compile(r"/2018-spec/Unit-(?P<unit>\d)/(?:QP|MS)/" + SERIES + r" \(IAL\) (?P<kind>QP|MS)\.pdf$")
OLD = re.compile(r"/Edexcel-IAL/Unit-(?P<unit>\d)/" + SERIES + r"(?: \((?P<tag>IAL|R)\))? (?P<kind>QP|MS)\s+-")


def classify(url):
    """(link for import_links, None) or (None, why it was skipped)."""
    path = unquote(url)
    if m := CURRENT.search(path):
        prefix, variant = "WPH1", ""
    elif m := OLD.search(path):
        tag = m["tag"] or ""
        prefix, variant = ("WPH0", "") if tag == "IAL" else ("6PH0", tag)
    else:
        name = Path(path).name
        return None, ("specimen" if "Specimen" in name else "combined" if "Combined" in name
                      else "grade boundaries" if "Grade Boundaries" in name else f"unrecognised: {name}")
    label = {"subject": "Physics", "year": m["year"], "month": m["month"], "unit": m["unit"],
             "variant": variant, "kind": m["kind"], "prefix": prefix}
    return {"url": url, "label": label}, None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--include-uk", action="store_true", help="also import the UK A-level papers (6PH01–06)")
    ap.add_argument("--units", nargs="*", type=int, default=[1, 2, 3, 4, 5, 6])
    ap.add_argument("--dry-run", action="store_true", help="list what would be imported, change nothing")
    args = ap.parse_args()

    links, skipped = [], {}
    for n in args.units:
        req = urllib.request.Request(PAGE.format(n=n), headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            html = r.read().decode("utf-8", "replace")
        urls = sorted(set(re.findall(r'href="(https://pmt\.physicsandmathstutor\.com/download/[^"]+\.pdf)"', html)))
        kept = 0
        for url in urls:
            link, why = classify(url)
            if link and link["label"]["prefix"] == "6PH0" and not args.include_uk:
                why = "UK A-level (use --include-uk)"
                link = None
            if link:
                links.append(link)
                kept += 1
            else:
                skipped[why] = skipped.get(why, 0) + 1
        print(f"unit {n}: {len(urls)} PDF links, {kept} kept")
        time.sleep(1)

    if skipped:
        print("skipped: " + ", ".join(f"{n} {why}" for why, n in sorted(skipped.items())))
    if args.dry_run:
        by_prefix = {}
        for link in links:
            by_prefix[link["label"]["prefix"]] = by_prefix.get(link["label"]["prefix"], 0) + 1
        print("would import: " + ", ".join(f"{n} {p}x links" for p, n in sorted(by_prefix.items())))
        return
    print()
    import_links(links)
    print("\nNext: pipeline/.venv/bin/python pipeline/fetch.py")


if __name__ == "__main__":
    main()
