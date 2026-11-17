"""Turn a list of past-paper PDF links into entries in registry/sources.json.

Usage:  pipeline/.venv/bin/python pipeline/import_links.py links.txt      (or pipe the list on stdin)

Each link's file name tells us the paper, e.g.
    IAL_PHYSICS_2026_June_U4_QP_1787503220075.pdf   ->  WPH14_2026_06, question paper
    IAL_PHYSICS_2026_June_U4A_MS_1787503219441.pdf  ->  WPH14_2026_06_A, mark scheme
(The "A" papers are Pearson's second version of a paper, sat in another time zone.)
Links are grouped into papers (QP + MS + examiner report). Papers already in the manifest are left alone;
names we can't read are listed so you can add them by hand. Then run fetch.py.
"""

import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "registry" / "sources.json"

SUBJECTS = {"PHYSICS": ("physics", "WPH1"), "CHEMISTRY": ("chemistry", "WCH1")}
MONTHS = {m: i for i, m in enumerate(
    "January February March April May June July August September October November December".split(), 1)}
MONTHS.update({m[:3]: i for m, i in list(MONTHS.items())})
MONTHS["Sept"] = 9
KINDS = {"QP": "qp", "MS": "ms", "ER": "er"}

NAME = re.compile(
    r"IAL_(?P<subj>[A-Z]+)_(?P<year>\d{4})_(?P<month>[A-Za-z]+)_U(?P<unit>\d)(?P<variant>[A-Z]?)_(?P<kind>QP|MS|ER)", re.I)


def paper_info(subject_name, year, month_name, unit_digit, variant="", prefix=None):
    """('Physics', 2026, 'June', 4, 'A') -> paper fields, or None if a name isn't recognised.

    `prefix` picks the unit code family when it isn't the current IAL spec: 'WPH0' (old IAL spec) or
    '6PH0' (UK A-level)."""
    subj = SUBJECTS.get(subject_name.upper())
    month = MONTHS.get(month_name.capitalize())
    if not subj or not month:
        return None
    subject, current = subj
    unit = f"{prefix or current}{unit_digit}"
    variant = variant.upper()
    return {
        "id": f"{unit}_{year}_{month:02d}" + (f"_{variant}" if variant else ""),
        "subject": subject,
        "unit": unit,
        "series": f"{year}-{month:02d}",
        **({"variant": variant} if variant else {}),
    }


def parse(url):
    m = NAME.search(unquote(Path(urlparse(url).path).name))
    if not m:
        return None
    info = paper_info(m["subj"], m["year"], m["month"], m["unit"], m["variant"])
    if not info:
        return None
    return {**info, "kind": KINDS[m["kind"].upper()], "url": url}


def provider_of(url, providers):
    """Which provider in sources.json a link belongs to, by its host (None if we don't know the host yet)."""
    host = urlparse(url).netloc
    return next((pid for pid, prov in providers.items() if host in prov.get("hosts", [])), None)


def known_ids():
    return {p["id"] for p in json.loads(SOURCES.read_text())["papers"]}


def import_urls(urls):
    """Add papers from bare links; each paper is worked out from its file name."""
    import_links([{"url": u} for u in urls])


def import_links(links):
    """Add the papers these links belong to into sources.json and print what happened.

    Each link is {"url": ..., optionally "label": {"subject", "year", "month", "unit", "variant", "kind"}}.
    A label (what the site's buttons said, from the scraper) beats the file name, which older series don't
    fill in. When both exist and disagree, the site may have put the wrong PDF behind a button: the paper is
    added under the label and marked "suspect" for verify.py to settle from the PDF's own cover."""
    sources = json.loads(SOURCES.read_text())
    papers = {p["id"]: p for p in sources["papers"]}
    known = set(papers)
    added, mirrored, unread, suspects = set(), set(), [], []
    providers = sources.get("providers", {})
    unknown_hosts = set()

    def file_entry(url):
        via = provider_of(url, providers)
        if via is None:
            unknown_hosts.add(urlparse(url).netloc)
        return {"url": url, "via": via}

    for link in links:
        url, label = link["url"], link.get("label")
        by_name = parse(url)
        if label:
            info = paper_info(label["subject"], label["year"], label["month"], label["unit"], label["variant"],
                              label.get("prefix"))
            info = info and {**info, "kind": label["kind"].lower(), "url": url}
        else:
            info = by_name
        if not info:
            unread.append(url)
            continue
        pid = info["id"]
        if pid in known:
            # Already have it. A different link to the same paper is kept as a mirror: a fallback if the
            # first source's file turns out to be wrong or goes missing.
            entry = papers[pid].get(info["kind"])
            if not entry:   # we had the QP but not the MS (or the other way round): fill the gap
                papers[pid][info["kind"]] = file_entry(url)
                added.add(pid)
            elif url != entry["url"] and url not in [m["url"] for m in entry.get("mirrors", [])]:
                entry.setdefault("mirrors", []).append(file_entry(url))
                mirrored.add(pid)
            continue
        paper = papers.setdefault(pid, {k: v for k, v in info.items() if k not in ("kind", "url")})
        entry = paper.setdefault(info["kind"], file_entry(url))
        if label and by_name and (by_name["id"], by_name["kind"]) != (pid, info["kind"]):
            entry["suspect"] = f"file name says {by_name['id']} {by_name['kind'].upper()}"
            suspects.append(f"{pid} {info['kind'].upper()}: {entry['suspect']}")
        added.add(pid)

    sources["papers"] = sorted(papers.values(), key=lambda p: (p["subject"], p["unit"], p["series"]))
    SOURCES.write_text(json.dumps(sources, indent=2, ensure_ascii=False) + "\n")

    for pid in sorted(added):
        p = papers[pid]
        missing = [k.upper() for k in ("qp", "ms") if k not in p]
        print(f"added {pid}" + (f"   (no {' or '.join(missing)} yet)" if missing else ""))
    print(f"\n{len(added)} papers added, {len(links) - len(unread)} links read."
          + (f" {len(mirrored)} papers we already had got a second source." if mirrored else ""))
    if suspects:
        print(f"{len(suspects)} links whose file name disagrees with the site's button (marked suspect):")
        for s_ in suspects:
            print("  " + s_)
    if unknown_hosts:
        print("!! New host(s), so nobody gets credited for these files yet. Add each to \"providers\" in "
              "sources.json:\n  " + "\n  ".join(sorted(unknown_hosts)))
    if unread:
        print(f"{len(unread)} links not recognised, add these by hand:")
        for u in unread:
            print("  " + u)


def main():
    text = Path(sys.argv[1]).read_text() if len(sys.argv) > 1 else sys.stdin.read()
    import_urls([u.strip() for u in text.split() if u.strip().startswith("http")])


if __name__ == "__main__":
    main()
