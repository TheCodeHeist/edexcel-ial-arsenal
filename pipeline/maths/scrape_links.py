"""Collect IAL Maths / Further Maths past-paper links from PaperLords into registry/maths/sources.json.

Usage (run it yourself, not through an AI agent: the site's robots.txt blocks AI agents):
    pipeline/.venv/bin/python pipeline/maths/scrape_links.py --dry-run               # walk menus only
    pipeline/.venv/bin/python pipeline/maths/scrape_links.py --series "Jan 2024"     # one series
    pipeline/.venv/bin/python pipeline/maths/scrape_links.py                         # every series

The clicking is pipeline/scrape_paperlords.py, unchanged. This only tells it about the Maths folder: unit rows
'P1', 'FP2A', 'M3', 'S1', 'D1', 'C12' …, series like 'May/June 2025', and the Maths manifest.
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import import_links as il      # noqa: E402
import scrape_paperlords as sp  # noqa: E402
import units                    # noqa: E402

units.use_maths_manifest()
sp.UNIT_RE = units.UNIT
sp.SERIES_RE = units.SERIES
sp.paper_info = units.paper_info
sp.parse = units.parse
sp.known_ids = lambda: {p["id"] for p in json.loads(units.SOURCES.read_text())["papers"]}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--subject", default="Maths", help="folder name on the site (default Maths)")
    ap.add_argument("--series", nargs="*", help='only these series, e.g. "June 2026" "May/June 2025"')
    ap.add_argument("--units", nargs="*", help="only these units, e.g. P1 FP1A")
    ap.add_argument("--delay", type=float, default=1.5, help="seconds to pause after each click (default 1.5)")
    ap.add_argument("--linger", type=float, default=0.0, help="seconds to leave each viewer open (default 0)")
    ap.add_argument("--headless", action="store_true", help="don't show the browser window")
    ap.add_argument("--dry-run", action="store_true", help="walk the menus but open no viewers and save nothing")
    args = ap.parse_args()

    links = sp.scrape(args)
    if not links:
        print("\nNo new links.")
        return
    out = sp.CACHE / "links"
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"maths-{datetime.now():%Y%m%d-%H%M%S}.jsonl"
    path.write_text("".join(json.dumps(link) + "\n" for link in links))
    print(f"\n{len(links)} links saved to {path}\n")
    il.import_links(links)
    print("\nNext: pipeline/.venv/bin/python pipeline/maths/fetch_pdfs.py")


if __name__ == "__main__":
    main()
