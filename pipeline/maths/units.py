"""IAL Mathematics / Further Mathematics: unit names as sites print them -> Pearson unit codes, and the
paper fields import_links.py expects (same shape as Physics, so the shared tools work unchanged).

    P1–P4   WMA11–WMA14   Pure Mathematics (2018 spec, first sat 2019)
    C12 C34 WMA01 WMA02   Core Mathematics (old spec, up to 2019)
    FP1–FP3 WFM01–WFM03   Further Pure (F1–F3 on PMT; same codes in both specs)
    M1–M3   WME01–WME03   Mechanics
    S1–S3   WST01–WST03   Statistics
    D1      WDM11         Decision (2018 spec);  WDM01 before 2019

A trailing 'A' (P1A, FP2A) is Pearson's second paper for another time zone, as in Physics.
Labels from the site are trusted only until verify reads each PDF's cover.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import import_links as il  # noqa: E402   (the shared Physics importer: read-only reuse)

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "registry" / "maths" / "sources.json"

UNIT = re.compile(r"^\s*(C12|C34|FP[1-3]|F[1-3]|P[1-4]|M[1-3]|S[1-3]|D1)(A?)\s*$", re.I)
SERIES = re.compile(
    r"^(?:[A-Za-z]+\s*/\s*)?(Jan|January|Feb|Mar|Apr|May|June?|July?|Aug|Sept?|Oct|Nov|Dec)[a-z]*\s+(\d{4})$", re.I)
# 'May/June 2025' -> June 2025


def unit_code(name, series):
    """('FP2', '2026-06') -> 'WFM02'; None if unknown."""
    name = name.upper()
    if name.startswith("F") and not name.startswith("FP"):
        name = "FP" + name[1:]
    if name == "C12":
        return "WMA01"
    if name == "C34":
        return "WMA02"
    kind, n = name[:-1], int(name[-1])
    if kind == "P":
        return f"WMA1{n}"
    if kind == "D":
        return "WDM11" if series >= "2019-01" else "WDM01"
    return {"FP": "WFM0", "M": "WME0", "S": "WST0"}[kind] + str(n)


def paper_info(subject_name, year, month_name, unit, variant="", prefix=None):
    """('Maths', 2025, 'June', 'FP1', 'A') -> paper fields, or None if not recognised."""
    month = il.MONTHS.get(str(month_name).capitalize())
    if not month or not UNIT.match(str(unit)):
        return None
    series = f"{year}-{month:02d}"
    series = il.SERIES_ALIASES.get(series, series)
    code = unit_code(str(unit), series)
    variant = (variant or "").upper()
    return {"id": il.paper_id(code, series, variant), "subject": "maths", "unit": code, "series": series,
            **({"variant": variant} if variant else {})}


NAME = re.compile(r"IAL_MATH[A-Z]*_(?P<year>\d{4})_(?P<month>[A-Za-z]+)_(?P<unit>C12|C34|FP\d|P\d|M\d|S\d|D\d)"
                  r"(?P<variant>A?)_(?P<kind>QP|MS|ER)", re.I)


def parse(url):
    """Read a paper from a file name like IAL_MATHS_2026_June_FP1A_QP_….pdf (a guess at PaperLords' naming:
    when it doesn't match, the scraper goes by the site's button, as it does for older Physics series)."""
    from urllib.parse import unquote, urlparse
    m = NAME.search(unquote(Path(urlparse(url).path).name))
    if not m:
        return None
    info = paper_info("Maths", m["year"], m["month"], m["unit"], m["variant"])
    return info and {**info, "kind": il.KINDS[m["kind"].upper()], "url": url}


def use_maths_manifest():
    """Point the shared importer at registry/maths/sources.json and the Maths unit names."""
    il.SOURCES = SOURCES
    il.paper_info = paper_info
    il.parse = parse
