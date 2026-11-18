"""Collect IAL Mathematics / Further Mathematics links from Physics & Maths Tutor into registry/maths/sources.json.

Usage:  pipeline/.venv/bin/python pipeline/maths/pmt_links.py             import (mirrors of papers we have)
        pipeline/.venv/bin/python pipeline/maths/pmt_links.py --dry-run   show what it would import

PMT's module pages are plain HTML and its robots.txt allows fetching them, so this reads them one second apart.
Each page mixes qualifications; only the Edexcel-IAL folder is used, laid out as

    Edexcel-IAL/Pure/P1/QP/January 2024 QP.pdf            WMA11_2024_01 question paper
    Edexcel-IAL/Further-Pure/F2/MS/June 2019 MS.pdf       WFM02_2019_06 mark scheme
    Edexcel-IAL/Decision/D1/AB/January 2024 AB.pdf        D1 answer book   (skipped for now)
    …/MA/…                                                PMT's model answers   (not Pearson's: skipped)

PaperLords is the primary source. A paper we already have from it gets these links as mirrors, which
verify_covers.py falls back on when PaperLords put the wrong PDF behind a button (it does: its January 2024
M1, M2 and S2 links open the October 2024 papers). By default only those mirrors are added, so PaperLords
stays the primary source for papers you haven't scraped yet; --add-new also adds the papers PaperLords doesn't
have (run it after the full PaperLords scrape, so only true gaps come from PMT).
Specimens and the papers PMT marks "(Unused)" are skipped.
"""

import argparse
import re
import sys
import time
import urllib.request
from pathlib import Path
from urllib.parse import unquote

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import import_links as il  # noqa: E402
import units               # noqa: E402

units.use_maths_manifest()

PAGE = "https://www.physicsandmathstutor.com/a-level-maths-papers/{slug}-edexcel/"
SLUGS = ["c1", "c2", "c3", "c4", "fp1", "fp2", "fp3", "m1", "m2", "m3", "s1", "s2", "s3", "d1"]
UA = "edexcel-ial-arsenal past-paper fetcher"
MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"
LINK = re.compile(r"/Edexcel-IAL/+(?:Pure|Further-Pure|Mechanics|Statistics|Decision)/(?P<unit>[A-Z]+\d+)/"
                  rf"(?P<kind>QP|MS)/(?P<month>{MONTHS}) (?P<year>\d{{4}}) (?P=kind)\.pdf$")


def classify(url):
    """(link for import_links, None) or (None, why it was skipped)."""
    path = unquote(url)
    if "/Edexcel-IAL/" not in path:
        return None, "not IAL"
    m = LINK.search(path)
    if not m:
        name = Path(path).name
        why = ("specimen" if "Specimen" in name else "unused paper" if "Unused" in name
               else "model answers" if "/MA/" in path else "answer book" if "/AB/" in path
               else f"unrecognised: {name}")
        return None, why
    label = {"subject": "Maths", "year": m["year"], "month": m["month"], "unit": m["unit"], "variant": "",
             "kind": m["kind"]}
    return {"url": url, "label": label}, None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="list what would be imported, change nothing")
    ap.add_argument("--add-new", action="store_true",
                    help="also add papers we don't have yet (after the full PaperLords scrape)")
    args = ap.parse_args()

    links, skipped, seen = [], {}, set()
    for slug in SLUGS:
        req = urllib.request.Request(PAGE.format(slug=slug), headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            html = r.read().decode("utf-8", "replace")
        urls = sorted(set(re.findall(r'href="(https://pmt\.physicsandmathstutor\.com/download/[^"]+\.pdf)"', html)))
        kept = 0
        for url in urls:
            if url in seen:
                continue
            seen.add(url)
            link, why = classify(url)
            if link:
                links.append(link)
                kept += 1
            elif why != "not IAL":
                skipped[why] = skipped.get(why, 0) + 1
        print(f"{slug}: {kept} IAL links kept")
        time.sleep(1)

    if not args.add_new:
        known = {p["id"] for p in il.json.loads(units.SOURCES.read_text())["papers"]}
        def pid(link):
            lab = link["label"]
            info = units.paper_info(lab["subject"], lab["year"], lab["month"], lab["unit"], lab["variant"])
            return info and info["id"]
        new = [l for l in links if pid(l) not in known]
        links = [l for l in links if pid(l) in known]
        skipped["not in the manifest yet (use --add-new)"] = len(new)
    if skipped:
        print("skipped: " + ", ".join(f"{n} {why}" for why, n in sorted(skipped.items())))
    if args.dry_run:
        units_seen = {}
        for link in links:
            u = link["label"]["unit"]
            units_seen[u] = units_seen.get(u, 0) + 1
        print("would import: " + ", ".join(f"{u} {n}" for u, n in sorted(units_seen.items())))
        return
    print()
    il.import_links(links)
    print("\nNext: pipeline/.venv/bin/python pipeline/maths/fetch_pdfs.py, then verify_covers.py")


if __name__ == "__main__":
    main()
