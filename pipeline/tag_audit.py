"""Topic-tag audit: check the AI reader's suggested topics spec point by spec point, not question by question.

Usage (meant for an AI agent, one unit's papers at a time):
    pipeline/.venv/bin/python pipeline/tag_audit.py todo <unit>            the unit's tags + points still to check
    pipeline/.venv/bin/python pipeline/tag_audit.py show <unit> <point>    next parts tagged with it: PNG + JSON
    pipeline/.venv/bin/python pipeline/tag_audit.py record <unit> '<json>' each shown part's final tag list
    pipeline/.venv/bin/python pipeline/tag_audit.py stats [subject]        progress per unit

Looking down one spec point's list of parts shows a part that doesn't belong far better than reading each
question alone. `show` stitches up to PAGE parts of <unit>'s papers that are tagged with <point> and not yet
audited: each with its question's opening, the part, and its mark-scheme rows, captioned with its current tags.
The reader decides each part's whole tag list (1-3 ids) and records it:

    {"WMA11_2024_01 3(b)": ["P1.2.1"], "WMA11_2024_06 7(a)": ["P1.1.3", "P1.2.1"]}

Every shown part needs an answer. A recorded part is audited once, whichever point it was shown under, and is
not shown again. Results go to registry/<subject>/tags/<paper id>.json, never to the registry file:
reviews.apply() uses them (tagStatus 'audited') unless a person's own review set the part's topics.
"""

import fcntl
import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import reviews  # noqa: E402
from ai_read import font, topic_list, print_topics, CAPTION_H, GAP  # noqa: E402
from publish import DATA  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(__file__).resolve().parent / "cache" / "tag_audit"
PAGE = 6
SUBJECT = "maths"

GUIDE = """\
How to tag a part (the same rules as the first reading):
  - 1 to 3 ids from the TOPIC TAGS list above: the most specific statements the part actually tests, i.e. what a
    student must know or do to earn its marks. Judge from the mark scheme rows, not just the command word.
  - The first id is the main one. Add a second or third only when the mark scheme gives real marks for it (a
    quadratic solved inside a mechanics part is not tagged unless the scheme marks that work).
  - Own unit first; an earlier unit's id only for a part that genuinely examines that earlier content.
  - A part that is fine as tagged keeps its list: record it unchanged. Change a list only when an id is wrong
    (the part doesn't test it), missing (a main skill the scheme marks has no id), or a more specific id fits."""


def units_papers(unit):
    for f in sorted((ROOT / "registry" / SUBJECT / "papers").glob("*.json")):
        p = json.loads(f.read_text())
        if p["unit"] == unit:
            yield p


def audited(paper_id):
    f = reviews.path(SUBJECT, paper_id, "tags")
    return json.loads(f.read_text())["parts"] if f.exists() else {}


def pending(unit):
    """[(paper, question, part)] of the unit's papers with no audit yet, in paper then question order."""
    for p in units_papers(unit):
        done = audited(p["id"])
        human = reviews.load(SUBJECT, p["id"])["parts"]
        for q in p["questions"]:
            for part in q["parts"]:
                if part["label"] not in done and "topics" not in human.get(part["label"], {}):
                    yield p, q, part


def shorts():
    t = json.loads((ROOT / "registry" / SUBJECT / "topics.json").read_text())
    return {pt["id"]: pt for u in t["units"] for g in u["groups"] for pt in g["points"]}


def todo(unit):
    print(GUIDE + "\n")
    print_topics(SUBJECT, unit)
    left = list(pending(unit))
    by = Counter(t for _, _, part in left for t in part["topics"][:1])
    order = [p["id"] for _, _, p in topic_list(SUBJECT, unit)]
    print(f"POINTS with {unit} parts still to check (by each part's first tag), {len(left)} parts in all:")
    for pid in order:
        if by[pid]:
            print(f"  {pid}  {by[pid]}")
    untagged = [f"{p['id']} {part['label']}" for p, _, part in left if not part["topics"]]
    if untagged:
        print("  (no tags yet:", ", ".join(untagged), ")")


def show(unit, point):
    names = shorts()
    items = [x for x in pending(unit) if x[2]["topics"][:1] == [point]][:PAGE]
    if not items:
        print(json.dumps({"point": point, "parts": [], "note": "nothing left on this point"}))
        return
    blocks = []
    for i, (p, q, part) in enumerate(items, 1):
        tags = ", ".join(part["topics"])
        cap = f"#{i}  {p['id']} {part['label']} ({part['marks']} marks)   now: {tags}"
        whole = len(q["parts"]) == 1 and not q["stem"]
        pieces = []
        if not whole:
            pieces.append((0.45, q["stem"]))
        pieces += [(0.45, part.get("intro", [])), (0.6, part["qp"]), (0.5, part["ms"])]
        imgs = []
        for scale, crops in pieces:
            for c in crops:
                im = Image.open(DATA / c["src"]).convert("L")
                imgs.append(im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale)))))
        blocks.append((cap, imgs))
    width = max(900, max(i.width for _, imgs in blocks for i in imgs))
    height = sum(CAPTION_H + sum(i.height for i in imgs) + GAP for _, imgs in blocks)
    sheet = Image.new("RGB", (width, height), "white")
    draw, f, y = ImageDraw.Draw(sheet), font(18), 0
    for cap, imgs in blocks:
        draw.rectangle((0, y, width, y + CAPTION_H - 4), fill="#1c5fb4")
        draw.text((8, y + 6), cap, fill="white", font=f)
        y += CAPTION_H
        for im in imgs:
            sheet.paste(im, (0, y))
            y += im.height
        y += GAP
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{unit}_{point}.png"
    sheet.save(path)
    pt = names.get(point, {})
    print(json.dumps({
        "point": point, "short": pt.get("short"), "statement": pt.get("text"), "image": str(path),
        "parts": [{"key": f"{p['id']} {part['label']}", "marks": part["marks"], "now": part["topics"],
                   "text": part.get("text", "")[:300]} for p, q, part in items],
        "left_on_point": sum(1 for x in pending(unit) if x[2]["topics"][:1] == [point]),
    }, indent=1, ensure_ascii=False))


def record(unit, raw):
    try:
        said = json.loads(raw)
    except json.JSONDecodeError as e:
        sys.exit(f"not JSON: {e}")
    allowed = {p["id"] for _, _, p in topic_list(SUBJECT, unit)}
    papers = {p["id"]: p for p in units_papers(unit)}
    errors, writes = [], {}
    for key, ids in said.items():
        pid, _, label = key.partition(" ")
        p = papers.get(pid)
        part = p and next((x for q in p["questions"] for x in q["parts"] if x["label"] == label), None)
        if part is None:
            errors.append(f"{key}: no such part in {unit}'s papers")
            continue
        if not isinstance(ids, list) or not 1 <= len(ids) <= 3 or len(set(ids)) != len(ids):
            errors.append(f"{key}: give 1 to 3 different tag ids as a list")
            continue
        bad = [i for i in ids if i not in allowed]
        if bad:
            errors.append(f"{key}: {bad} not tags for {unit} (see todo)")
            continue
        writes.setdefault(pid, {})[label] = {"topics": ids, "was": part["topics"], "at": date.today().isoformat()}
    if errors:
        sys.exit("not recorded:\n  " + "\n  ".join(errors))
    for pid, parts in writes.items():
        f = reviews.path(SUBJECT, pid, "tags")
        f.parent.mkdir(parents=True, exist_ok=True)
        with open(f, "a+") as fh:
            fcntl.flock(fh, fcntl.LOCK_EX)
            fh.seek(0)
            cur = json.loads(fh.read() or '{"parts": {}}')
            cur["parts"].update(parts)
            fh.seek(0)
            fh.truncate()
            fh.write(json.dumps(cur, indent=1, ensure_ascii=False, sort_keys=True) + "\n")
    changed = sum(1 for parts in writes.values() for v in parts.values() if v["topics"] != v["was"])
    print(f"recorded {sum(len(v) for v in writes.values())} parts ({changed} changed); "
          f"{sum(1 for _ in pending(unit))} {unit} parts left")


def stats(subject=SUBJECT):
    tot, done = Counter(), Counter()
    for f in sorted((ROOT / "registry" / subject / "papers").glob("*.json")):
        p = json.loads(f.read_text())
        a = audited(p["id"])
        for q in p["questions"]:
            for part in q["parts"]:
                tot[p["unit"]] += 1
                done[p["unit"]] += part["label"] in a
    for u in sorted(tot):
        print(f"{u}: {done[u]}/{tot[u]}")
    print(f"all: {sum(done.values())}/{sum(tot.values())}")


def main():
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    if a[0] == "todo" and len(a) == 2:
        todo(a[1])
    elif a[0] == "show" and len(a) == 3:
        show(a[1], a[2])
    elif a[0] == "record" and len(a) == 3:
        record(a[1], a[2])
    elif a[0] == "stats":
        stats(*a[1:2])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
