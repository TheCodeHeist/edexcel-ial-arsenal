"""Click through paperlords.org/ial in a visible browser and collect past-paper PDF links.

Usage:
    pipeline/.venv/bin/python pipeline/scrape_paperlords.py                       # every Physics series
    pipeline/.venv/bin/python pipeline/scrape_paperlords.py --series "June 2026" --units U4 U4A
    pipeline/.venv/bin/python pipeline/scrape_paperlords.py --subject Chemistry --dry-run
    pipeline/.venv/bin/python pipeline/scrape_paperlords.py --linger 1            # slow enough to watch

It does what you would do by hand: open the subject, open each series, and for each unit press QP and MS,
read the "Open Original in New Tab" link from the viewer that pops up, close it. It goes at human pace
(--delay), blocks the viewer from loading the PDFs themselves (fetch.py downloads each one once, later), and
skips papers already in registry/sources.json, so a rerun only clicks what is new.

The links go into registry/sources.json via import_links.py (and are saved to pipeline/cache/links/ too).
If the site's layout changes and a step can't find what it expects, it stops with a screenshot and the
page HTML in pipeline/cache/debug/.

The page, as of November 2026:
    details.group/subject                      one per subject; <summary> holds the name ("Physics")
      details.group/session                    one per series;  <summary> holds "June 2026"
        div.group/unit                         one per unit: "U4", then QP / MS buttons
    div.fixed.inset-0 (the viewer)             h3 "Physics - June 2026 - U4 (QP)",
                                               a[title="Open Original in New Tab"], button[aria-label="Close modal"]
Subjects and series are native <details>, so whether one is open is read from its `open` property, never
guessed, and each series' units are looked up inside that series only.
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_links import import_links, known_ids, paper_info, parse  # noqa: E402

START = os.environ.get("PAPERLORDS_START", "https://www.paperlords.org/ial")  # override only to test against a mock page
CACHE = Path(__file__).resolve().parent / "cache"
CHROME = Path.home() / ".cache/ms-playwright/chromium-1148/chrome-linux/chrome"

SUBJECT = 'details[class*="group/subject"]'
SESSION = 'details[class*="group/session"]'
UNIT_ROW = 'div[class*="group/unit"]'
VIEWER_LINK = 'a[title="Open Original in New Tab"]'
VIEWER_CLOSE = 'button[aria-label="Close modal"]'
AD_CLOSE = 'button[aria-label="Close Ad"]'   # the book adverts that slide in at the sides and cover the list's edges

SERIES_RE = re.compile(r"^(Jan|January|Feb|Mar|Apr|May|June?|July?|Aug|Sept?|Oct|Nov|Dec)[a-z]*\s+(\d{4})$", re.I)
UNIT_RE = re.compile(r"^\s*U(\d)([A-Z]?)\s*$")


class LayoutChanged(Exception):
    pass


def text(locator):
    return " ".join(locator.inner_text().split())


def wait_until(check, timeout):
    """Poll `check()` until it is truthy or `timeout` seconds pass; return its last value."""
    end = time.monotonic() + timeout
    while not (ok := check()) and time.monotonic() < end:
        time.sleep(0.25)
    return ok


def settled_count(locator, timeout=15, quiet=1.0):
    """Wait for `locator` to match something, then for its count to stop changing (units can arrive in
    batches). Returns the final count, or 0 if nothing turned up within `timeout` seconds."""
    if not wait_until(locator.count, timeout):
        return 0
    n, since = locator.count(), time.monotonic()
    while time.monotonic() - since < quiet:
        time.sleep(0.25)
        if (m := locator.count()) != n:
            n, since = m, time.monotonic()
    return n


def close_ads(page, wait=0.0):
    """Close any visible side adverts. With `wait`, first give them that many seconds to slide in.

    The × is pressed from inside the page (element.click()) rather than with a mouse click, because a mouse
    click on one advert's × can land on whatever overlaps it, such as the other advert."""
    visible = page.locator(AD_CLOSE).filter(visible=True)
    if wait:
        wait_until(visible.count, wait)
    closed = 0
    for _ in range(3):
        n = visible.count()
        if not n:
            break
        for i in range(n):
            try:
                visible.nth(0).evaluate("b => b.click()")
                closed += 1
            except Exception:
                pass   # it disappeared between counting and clicking: fine
        wait_until(lambda: not visible.count(), 2)
    return closed


def click(page, target):
    """Click after clearing any advert that has slid back over the page."""
    close_ads(page)
    target.scroll_into_view_if_needed()
    target.click()


def ensure_open(details, what, delay):
    """Open a <details> by clicking its summary, only if it isn't open already."""
    if not details.evaluate("d => d.open"):
        click(details.page, details.locator(":scope > summary"))
        if not wait_until(lambda: details.evaluate("d => d.open"), 5):
            raise LayoutChanged(f"{what} didn't open when clicked")
        time.sleep(delay)


def find_subject(page, name):
    subjects = page.locator(SUBJECT)
    try:
        subjects.first.wait_for(state="attached", timeout=15_000)
    except PWTimeout:
        raise LayoutChanged("no subject folders on the page")
    names = [text(subjects.nth(i).locator(":scope > summary")) for i in range(subjects.count())]
    for i, n in enumerate(names):
        if n.lower() == name.lower():
            return subjects.nth(i)
    raise LayoutChanged(f"no subject called {name!r}; the page has: {', '.join(names)}")


def read_link(page, button, expect_title, delay, linger):
    """Press a QP/MS button, read the PDF link from the viewer it opens, close the viewer."""
    click(page, button)
    link = page.locator(VIEWER_LINK)
    try:
        link.wait_for(state="visible", timeout=10_000)
    except PWTimeout:
        raise LayoutChanged(f"the viewer for {expect_title!r} didn't open")
    # The viewer's header holds both the title and this link: check it's the paper we asked for.
    title = text(link.locator("xpath=ancestor::div[.//h3][1]").locator("h3").first)
    if squash(title) != squash(expect_title):
        raise LayoutChanged(f"expected the viewer for {expect_title!r} but it says {title!r}")
    href = urljoin(page.url, link.get_attribute("href"))
    time.sleep(linger)  # only so a person watching can see it; the link is already read
    page.locator(VIEWER_CLOSE).click()
    link.wait_for(state="detached", timeout=10_000)
    time.sleep(delay)
    return href


def squash(s):
    """Compare titles ignoring case and spacing: the site writes both '(MS)' and '(MS )'."""
    return re.sub(r"\s+", "", s).lower()


def save_debug(page):
    """Screenshot + HTML of the page as it is now, for working out what the script didn't expect."""
    dbg = CACHE / "debug"
    dbg.mkdir(parents=True, exist_ok=True)
    stem = dbg / datetime.now().strftime("%Y%m%d-%H%M%S")
    page.screenshot(path=f"{stem}.png", full_page=True)
    Path(f"{stem}.html").write_text(page.content())
    return stem


def scrape(args):
    known = known_ids()
    found = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            executable_path=str(CHROME) if CHROME.exists() else None, headless=args.headless)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        # The viewer would otherwise download every PDF just to show it; we only want the link.
        page.route(re.compile(r"\.pdf(\?|#|$)", re.I), lambda route: route.abort())

        try:
            page.goto(START, wait_until="domcontentloaded")
            if n := close_ads(page, wait=6):
                print(f"closed {n} advert{'s' if n > 1 else ''}")
            subject = find_subject(page, args.subject)
            subject_name = text(subject.locator(":scope > summary"))
            ensure_open(subject, subject_name, args.delay)

            sessions = subject.locator(SESSION)
            if not wait_until(sessions.count, 15):
                raise LayoutChanged(f"no series inside {subject_name}")
            labels = [text(sessions.nth(i).locator(":scope > summary")) for i in range(sessions.count())]
            if args.series:
                wanted = {" ".join(s.split()).lower() for s in args.series}
                picked = [i for i, label in enumerate(labels) if label.lower() in wanted]
            else:
                picked = list(range(len(labels)))
            print(f"{len(picked)} series: {', '.join(labels[i] for i in picked)}")

            for i in picked:
                series, session = labels[i], sessions.nth(i)
                m = SERIES_RE.match(series)
                if not m:
                    print(f"\n{series}: !! can't read a month and year from this label, skipped")
                    continue
                month, year = m[1], m[2]
                ensure_open(session, series, args.delay)

                rows = session.locator(UNIT_ROW)
                if not settled_count(rows):   # a series may load its units over the network
                    print(f"\n{series}: (no units)   saved {save_debug(page)}.* so we can see why")
                    continue

                units, seen = [], set()
                for r in range(rows.count()):
                    row = rows.nth(r)
                    label = row.get_by_text(UNIT_RE)
                    if label.count() and (u := text(label.first)) not in seen:
                        seen.add(u)
                        units.append((u, row))
                if args.units:
                    units = [(u, row) for u, row in units if u in args.units]
                print(f"\n{series}: {' '.join(u for u, _ in units) or '(none matching)'}")

                for unit, row in units:
                    um = UNIT_RE.match(unit)
                    info = paper_info(args.subject, year, month, um[1], um[2])
                    if info and info["id"] in known:
                        print(f"  {unit:4} already have {info['id']}")
                        continue
                    for kind in ("QP", "MS", "ER"):
                        btn = row.get_by_text(kind, exact=True)
                        if not btn.count():
                            continue
                        if args.dry_run:
                            print(f"  {unit:4} {kind} (dry run, not opened)")
                            continue
                        url = read_link(page, btn.first, f"{subject_name} - {series} - {unit} ({kind})",
                                        args.delay, args.linger)
                        label = {"subject": args.subject, "year": year, "month": month,
                                 "unit": um[1], "variant": um[2], "kind": kind}
                        by_name = parse(url)
                        mine = info["id"] if info else "?"
                        if not by_name:
                            note = f"{mine}  (file name has no details; going by the button)"
                        elif (by_name["id"], by_name["kind"]) != (mine, kind.lower()):
                            note = f"{mine}  !! but the file name says {by_name['id']} {by_name['kind'].upper()}"
                        else:
                            note = mine
                        print(f"  {unit:4} {kind}  {note}")
                        found.append({"url": url, "label": label})

        except (LayoutChanged, PWTimeout) as e:
            print(f"\n!! Stopped: {e}\n   Screenshot and HTML saved to {save_debug(page)}.*  (links found so far are kept)")
        except KeyboardInterrupt:
            print("\nStopped by you; keeping the links found so far.")
        finally:
            browser.close()

    return found


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--subject", default="Physics", help="folder name on the site (default Physics)")
    ap.add_argument("--series", nargs="*", help='only these series, e.g. "June 2026" "Jan 2026"')
    ap.add_argument("--units", nargs="*", help="only these units, e.g. U4 U4A")
    ap.add_argument("--delay", type=float, default=1.5, help="seconds to pause after each click (default 1.5)")
    ap.add_argument("--linger", type=float, default=0.0,
                    help="seconds to leave each viewer open so you can watch it work (default 0: closes at once)")
    ap.add_argument("--headless", action="store_true", help="don't show the browser window")
    ap.add_argument("--dry-run", action="store_true", help="walk the menus but open no viewers and save nothing")
    args = ap.parse_args()

    links = scrape(args)
    if not links:
        print("\nNo new links.")
        return
    out = CACHE / "links"
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"{args.subject.lower()}-{datetime.now():%Y%m%d-%H%M%S}.jsonl"
    path.write_text("".join(json.dumps(link) + "\n" for link in links))
    print(f"\n{len(links)} links saved to {path}\n")
    import_links(links)
    print("\nNext: pipeline/.venv/bin/python pipeline/fetch.py")


if __name__ == "__main__":
    main()
