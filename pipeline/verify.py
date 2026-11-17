"""Check every downloaded PDF against its own cover, and repair what can be repaired from mirrors.

Usage:  pipeline/.venv/bin/python pipeline/verify.py            (after fetch.py)
        pipeline/.venv/bin/python pipeline/verify.py --no-fix   report only, download nothing

The sites we collect from sometimes put the wrong file behind a link. Pearson's covers say what a file really
is, so for each QP and MS we read:

    kind      'Mark Scheme (Results)' on a mark scheme; candidate boxes / 'Paper reference' on a question paper
    code      WPH14/01, WPH14/01A (the A paper), '(WPH11) Paper 01', even Pearson's own typo '(WPH011)'
    series    the exam date on a QP ('Monday 1 June 2026'), the season on an MS ('Summer 2026');
              June-series exams can sit in May, October-series in November, so we compare series, not months

and compare them with what sources.json says. Each file gets a "check" in sources.json:

    ok          everything the cover shows agrees
    mismatch    the cover says something else, e.g. an October 2020 mark scheme filed under June 2020
    unreadable  the cover has no usable text (an old scan), so nothing could be checked

With fixing on (the default), a mismatched file that has mirrors is retried from each mirror in turn; the
first mirror whose cover agrees replaces it, and the wrong file is kept under "rejected" with the reason.
The same file listed under two papers is reported too. Rerunning is cheap: unchanged files aren't re-read.
"""

import argparse
import hashlib
import json
import re
import sys
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch import CACHE, SOURCES, UA, safe_url  # noqa: E402
from import_links import SERIES_ALIASES, paper_id  # noqa: E402

BY_EYE = SOURCES.parent / "covers-by-eye.json"   # covers a person read, for scans with no text

pymupdf.TOOLS.mupdf_display_errors(False)   # some PMT files carry broken layer data; harmless, but noisy

MONTH_SERIES = {"January": "01", "February": "01", "May": "06", "June": "06", "July": "06",
                "October": "10", "November": "10"}
SEASON_SERIES = {"January": "01", "Winter": "01", "Summer": "06", "June": "06", "May": "06",
                 "October": "10", "Autumn": "10", "November": "10"}
MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"

CODE = re.compile(r"\b(WPH|6PH)\s?(\d{2,3})\)?(?:\s*[/_]\s*0?1([A-Z])?\b)?")
EXAM_DATE = re.compile(rf"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s+\d{{1,2}}\s+({MONTHS})\s+(20\d\d)")
SEASON = re.compile(r"Mark Scheme\s*\((?:Results|Provisional|Final)\)\s*(Summer|Winter|Autumn|January|June|May|October|November)\s+(20\d\d)")


def read_cover(path):
    """What the PDF says it is: {'kind', 'code', 'variant', 'series'}; fields it doesn't show are left out."""
    doc = pymupdf.open(path)
    pages = [" ".join(doc[i].get_text().split()) for i in range(min(3, doc.page_count))]
    first, text = pages[0] if pages else "", " ".join(pages)
    cover = {}

    if SEASON.search(first) or first.lstrip().startswith("Mark Scheme"):
        cover["kind"] = "ms"
    elif re.search(r"Candidate Number|Paper Reference|Question Paper", text, re.I):
        cover["kind"] = "qp"

    if m := CODE.search(text):
        digits = m[2][1:] if len(m[2]) == 3 and m[2][0] == "0" else m[2]   # '(WPH011)' means WPH11
        cover["code"] = m[1] + digits
        cover["variant"] = m[3] or ""

    if cover.get("kind") == "ms" and (m := SEASON.search(first)):
        cover["series"] = f"{m[2]}-{SEASON_SERIES[m[1]]}"
    elif m := EXAM_DATE.search(text):
        if m[1] in MONTH_SERIES:
            cover["series"] = f"{m[2]}-{MONTH_SERIES[m[1]]}"
    if "series" in cover:
        cover["series"] = SERIES_ALIASES.get(cover["series"], cover["series"])
    return cover


def compare(paper, kind, cover):
    """('ok' | 'mismatch' | 'unreadable', [what disagreed])."""
    if not cover:
        return "unreadable", []
    want = {"kind": kind, "code": paper["unit"], "series": paper["series"]}
    wrong = [f"{k}: cover says {cover[k]}, expected {v}" for k, v in want.items() if k in cover and cover[k] != v]
    # The A paper says '/01A' on its cover; a main paper has no letter. Only judge when the code was read whole.
    if "code" in cover and cover["code"] == paper["unit"] and cover.get("variant", "") != paper.get("variant", ""):
        wrong.append(f"variant: cover says {cover.get('variant') or 'main paper'}, "
                     f"expected {paper.get('variant') or 'main paper'}")
    return ("mismatch" if wrong else "ok"), wrong


def describe(cover):
    code = cover.get("code", "?") + (cover.get("variant") or "")
    return f"{code} {cover.get('series', '?')} {cover.get('kind', '?').upper()}"


def download(url, path):
    req = urllib.request.Request(safe_url(url), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    time.sleep(0.5)
    if not data.startswith(b"%PDF"):
        raise ValueError("not a PDF")
    path.write_bytes(data)


def try_mirrors(paper, kind, entry, primary_path):
    """Look for a mirror whose cover agrees. On success, swap it in and return the new check."""
    mirror_dir = CACHE.parent / "mirrors"
    mirror_dir.mkdir(exist_ok=True)
    for i, mirror in enumerate(entry.get("mirrors", [])):
        path = mirror_dir / f"{paper['id']}_{kind}_{i}.pdf"
        try:
            if not path.exists():
                download(mirror["url"], path)
        except Exception as e:
            print(f"      mirror {mirror['via']}: download failed ({e})")
            continue
        cover = read_cover(path)
        status, _ = compare(paper, kind, cover)
        if status != "ok":
            print(f"      mirror {mirror['via']}: {status} ({describe(cover)})")
            continue
        # Promote the mirror; keep the wrong file's link on record so it isn't re-added later.
        rejected = {"url": entry["url"], "via": entry["via"], "reason": entry["check"]["problems"]}
        entry.setdefault("rejected", []).append(rejected)
        entry["mirrors"] = [m for m in entry["mirrors"] if m is not mirror]
        if not entry["mirrors"]:
            del entry["mirrors"]
        entry["url"], entry["via"] = mirror["url"], mirror["via"]
        path.replace(primary_path)
        entry["sha256"] = hashlib.sha256(primary_path.read_bytes()).hexdigest()
        print(f"      fixed: using {mirror['via']}'s copy, whose cover agrees")
        return {"status": "ok", "cover": cover, "sha256": entry["sha256"], "fixed_from": rejected["via"]}
    return None


def reject(sources, paper, kind, entry, reason):
    """Record a wrong file's link so imports never bring it back, and take it off the paper."""
    sources.setdefault("rejected", []).append(
        {"url": entry["url"], "via": entry["via"], "filed_as": f"{paper['id']} {kind.upper()}", "reason": reason})
    del paper[kind]


def move_file(src_id, dst_id, kind):
    src, dst = CACHE / f"{src_id}_{kind}.pdf", CACHE / f"{dst_id}_{kind}.pdf"
    if src.exists():
        src.replace(dst)


def merge_aliases(sources):
    """Fold papers filed under an aliased series (June 2020) into the real one (October 2020).

    If the real paper exists, the aliased copy's links become its mirrors (the file is the same paper; keeping
    the link keeps its provider credited). Otherwise the paper is simply renamed."""
    papers = {p["id"]: p for p in sources["papers"]}
    for paper in list(sources["papers"]):
        real = SERIES_ALIASES.get(paper["series"])
        if not real:
            continue
        new_id = paper_id(paper["unit"], real, paper.get("variant", ""))
        target = papers.get(new_id)
        if target is None:
            print(f"  rename {paper['id']} -> {new_id} (series {paper['series']} is really {real})")
            for kind in ("qp", "ms", "er"):
                move_file(paper["id"], new_id, kind)
            del papers[paper["id"]]
            paper["id"], paper["series"] = new_id, real
            papers[new_id] = paper
            continue
        print(f"  merge  {paper['id']} into {new_id} (the same paper; its links become mirrors)")
        for kind in ("qp", "ms", "er"):
            if kind not in paper:
                continue
            entry = paper[kind]
            if kind not in target:
                target[kind] = entry
                move_file(paper["id"], new_id, kind)
                continue
            have = {target[kind]["url"], *(m["url"] for m in target[kind].get("mirrors", []))}
            for link in [{"url": entry["url"], "via": entry["via"]}, *entry.get("mirrors", [])]:
                if link["url"] not in have:
                    target[kind].setdefault("mirrors", []).append(link)
            (CACHE / f"{paper['id']}_{kind}.pdf").unlink(missing_ok=True)
        sources["papers"].remove(paper)
        del papers[paper["id"]]


def relocate(sources, paper, kind, entry):
    """A file whose cover names a different paper: file it there, or drop it if that paper already has it.
    Returns a short description of what happened, or None if the cover didn't say enough to act on."""
    cover = entry["check"]["cover"]
    if not all(k in cover for k in ("code", "series", "kind")):
        return None
    really = paper_id(cover["code"], cover["series"], cover.get("variant", ""))
    papers = {p["id"]: p for p in sources["papers"]}
    target = papers.get(really)
    reason = f"cover says {describe(cover)}"
    if target and cover["kind"] in target:
        reject(sources, paper, kind, entry, reason + f"; {really} already has its own copy")
        (CACHE / f"{paper['id']}_{kind}.pdf").unlink(missing_ok=True)
        return f"dropped: it's {really}'s {cover['kind'].upper()}, which we already have"
    if target is None:
        target = {"id": really, "subject": paper["subject"], "unit": cover["code"], "series": cover["series"]}
        if cover.get("variant"):
            target["variant"] = cover["variant"]
        sources["papers"].append(target)
    target[cover["kind"]] = entry
    entry["check"] = {**entry["check"], "status": "ok", "refiled_from": f"{paper['id']} {kind.upper()}"}
    entry["check"].pop("problems", None)
    entry.pop("mirrors", None)    # mirrors were for the paper it was filed under, not this one
    del paper[kind]
    CACHE.joinpath(f"{paper['id']}_{kind}.pdf").replace(CACHE / f"{really}_{cover['kind']}.pdf")
    return f"refiled as {really} {cover['kind'].upper()}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-fix", action="store_true", help="report only; don't download or swap mirrors")
    args = ap.parse_args()

    sources = json.loads(SOURCES.read_text())
    by_eye = json.loads(BY_EYE.read_text())["covers"] if BY_EYE.exists() else {}
    counts = defaultdict(int)
    problems, by_digest = [], defaultdict(list)

    try:
        if not args.no_fix:
            merge_aliases(sources)
        for paper in list(sources["papers"]):
            for kind in ("qp", "ms"):
                entry = paper.get(kind)
                path = CACHE / f"{paper['id']}_{kind}.pdf"
                if not entry or not path.exists():
                    continue
                sha = entry.get("sha256") or hashlib.sha256(path.read_bytes()).hexdigest()
                old = entry.get("check")
                # Already checked this exact file (or checked by eye): reuse it, unless it's a mismatch we may fix.
                fresh_eye = sha in by_eye and old and not old.get("by_eye")
                if old and old.get("sha256") == sha and not fresh_eye and (old["status"] != "mismatch" or args.no_fix):
                    counts[old["status"]] += 1
                    by_digest[sha].append(f"{paper['id']}_{kind}")
                    if old["status"] != "ok":
                        problems.append((paper["id"], kind, old))
                    continue

                eye = by_eye.get(sha)
                cover = {k: eye[k] for k in ("kind", "code", "variant", "series")} if eye else read_cover(path)
                status, wrong = compare(paper, kind, cover)
                entry["check"] = {"status": status, "cover": cover, "sha256": sha, **({"by_eye": True} if eye else {})}
                if wrong:
                    entry["check"]["problems"] = wrong
                if status == "mismatch":
                    print(f"  !! {paper['id']} {kind.upper()}: " + "; ".join(wrong))
                    if not args.no_fix:
                        fixed = entry.get("mirrors") and try_mirrors(paper, kind, entry, path)
                        if fixed:
                            entry["check"] = fixed
                            sha, status = fixed["sha256"], "ok"
                        elif what := relocate(sources, paper, kind, entry):
                            print(f"      {what}")
                            counts["moved"] += 1
                            continue
                counts[status] += 1
                by_digest[sha].append(f"{paper['id']}_{kind}")
                if status != "ok":
                    problems.append((paper["id"], kind, entry["check"]))
            if not any(k in paper for k in ("qp", "ms", "er")):
                print(f"      {paper['id']} has no files left: removed")
                sources["papers"].remove(paper)
        sources["papers"].sort(key=lambda p: (p["subject"], p["unit"], p["series"], p.get("variant", "")))
    finally:
        SOURCES.write_text(json.dumps(sources, indent=2, ensure_ascii=False) + "\n")

    lonely = [p["id"] for p in sources["papers"] if ("qp" in p) != ("ms" in p)]

    total = sum(counts.values())
    print(f"\n{total} files: {counts['ok']} ok, {counts['mismatch']} mismatched, {counts['unreadable']} unreadable"
          + (f", {counts['moved']} refiled or dropped" if counts["moved"] else ""))
    if mism := [p for p in problems if p[2]["status"] == "mismatch"]:
        print("\nStill wrong (no mirror fixed them):")
        for pid, kind, check in mism:
            print(f"  {pid} {kind.upper()}: really {describe(check['cover'])}")
    if unread := [p for p in problems if p[2]["status"] == "unreadable"]:
        print("\nNo readable cover (check by eye):  " + "  ".join(f"{pid}_{kind}" for pid, kind, _ in unread))
    if lonely:
        print("\nPapers with only a QP or only an MS:  " + "  ".join(lonely))
    if dupes := [names for names in by_digest.values() if len(names) > 1]:
        print("\nSame file under more than one paper:")
        for names in dupes:
            print("  " + "  =  ".join(names))


if __name__ == "__main__":
    main()
