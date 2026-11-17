"""Download every PDF listed in registry/sources.json into pipeline/cache/pdf/.

Usage:  pipeline/.venv/bin/python pipeline/fetch.py

A file already in the cache is not downloaded again. The first download of a source records its
sha256 in sources.json; every later run checks the cached file against it, so a source that changes
under us (a re-issued paper, a different file behind the same link) is reported instead of silently used.
"""

import hashlib
import json
import sys
import time
import urllib.request
from collections import defaultdict
from urllib.parse import quote
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "registry" / "sources.json"
CACHE = ROOT / "pipeline" / "cache" / "pdf"
UA = "edexcel-ial-arsenal past-paper fetcher"


def entries(sources):
    """Yield (cache filename, source dict) for every PDF in the manifest."""
    for spec in sources["specs"]:
        yield f"{spec['id']}.pdf", spec
    for paper in sources["papers"]:
        for kind in ("qp", "ms", "er"):
            if kind in paper:
                yield f"{paper['id']}_{kind}.pdf", paper[kind]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def safe_url(url):
    """Percent-encode what a raw link may contain (spaces in 'June 2026/') without double-encoding '%20'."""
    return quote(url, safe=":/?#[]@!$&'()*+,;=%")


def main():
    sources = json.loads(SOURCES.read_text())
    CACHE.mkdir(parents=True, exist_ok=True)
    changed, bad = False, 0
    by_digest = defaultdict(list)

    try:
        for name, src in entries(sources):
            path = CACHE / name
            if not path.exists():
                print(f"get   {name}")
                try:
                    req = urllib.request.Request(safe_url(src["url"]), headers={"User-Agent": UA})
                    with urllib.request.urlopen(req, timeout=60) as r:
                        data = r.read()
                except Exception as e:   # one bad link shouldn't stop the rest
                    print(f"  !! download failed: {e}")
                    bad += 1
                    continue
                finally:
                    time.sleep(0.5)      # be gentle with the host
                if not data.startswith(b"%PDF"):
                    print(f"  !! not a PDF (got {data[:20]!r}); skipped")
                    bad += 1
                    continue
                path.write_bytes(data)

            digest = sha256(path)
            by_digest[digest].append(name)
            if "sha256" not in src:
                src["sha256"] = digest
                changed = True
                print(f"new   {name}  {digest[:12]}")
            elif src["sha256"] != digest:
                print(f"  !! {name}: checksum differs from sources.json — the source changed")
                bad += 1
            else:
                print(f"ok    {name}")
    finally:
        # Save checksums even if interrupted, so finished downloads are recorded.
        if changed:
            SOURCES.write_text(json.dumps(sources, indent=2, ensure_ascii=False) + "\n")

    dupes = [names for names in by_digest.values() if len(names) > 1]
    if dupes:
        print("\n!! The same file is listed under more than one name (a viewer served the wrong PDF?):")
        for names in dupes:
            print("   " + "  =  ".join(names))
    sys.exit(1 if bad or dupes else 0)


if __name__ == "__main__":
    main()
