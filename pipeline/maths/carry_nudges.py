"""After a re-cut: keep clean AI readings of questions whose crops only nudged.

Usage:  pipeline/.venv/bin/python pipeline/maths/carry_nudges.py [--write] [--base DIR]

--base DIR compares with saved copies of the papers (DIR/<id>.json) instead of git HEAD: for a second re-cut
before committing, when the readings were made on the first.

Compares each registry/maths/papers/<id>.json with its committed version (git HEAD). A question whose fingerprint
changed keeps its AI reading (the fingerprint is renewed) when the reading raised no concerns, the parts, marks
and crop counts are the same, and every crop edge moved at most 4 pt up or down (a crop made wider at the sides
is fine: that only shows more of what was clipped). Anything else lapses and is read again: in particular a
reading with concerns, so the fixed crop gets a fresh look.

The seam between a question's last mark-scheme rows and its notes may move further (up to 30 pt) when both sides
move together: nothing is gained or lost, a row ('Notes | Total 12') only changes crops. A person's 'ok' review is
carried by the same rules.
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))
import reviews  # noqa: E402

TOL = 4.0
SEAM_TOL = 30.0


def crops(q):
    out = [("stem", c) for c in q["stem"]] + [("notes", c) for c in q.get("msNotes", [])]
    for p in q["parts"]:
        out += [(p["label"] + ":intro", c) for c in p.get("intro", [])]
        out += [(p["label"] + ":qp", c) for c in p["qp"]] + [(p["label"] + ":ms", c) for c in p["ms"]]
    return out


def seam_edges(old, new):
    """The last part's last mark-scheme crop bottom and the first notes crop top, when they meet in both versions
    on the same page and moved by the same amount."""
    if not old.get("msNotes") or not new.get("msNotes") or not old["parts"][-1]["ms"] or not new["parts"][-1]["ms"]:
        return set()
    oa, ob = old["parts"][-1]["ms"][-1]["region"], old["msNotes"][0]["region"]
    na, nb = new["parts"][-1]["ms"][-1], new["msNotes"][0]
    ra, rb = na["region"], nb["region"]
    if not (oa["page"] == ob["page"] == ra["page"] == rb["page"]):
        return set()
    if abs(oa["y1"] - ob["y0"]) > 1 or abs(ra["y1"] - rb["y0"]) > 1:
        return set()
    if abs((ra["y1"] - oa["y1"]) - (rb["y0"] - ob["y0"])) > 1:
        return set()
    return {(id(na), "y1"), (id(nb), "y0")}


def nudged(old, new):
    if [(p["label"], p["marks"]) for p in old["parts"]] != [(p["label"], p["marks"]) for p in new["parts"]]:
        return False
    a, b = crops(old), crops(new)
    if [k for k, _ in a] != [k for k, _ in b]:
        return False
    seam = seam_edges(old, new)
    for (ka, ca), (_, cb) in zip(a, b):
        ra, rb = ca["region"], cb["region"]
        if ra["page"] != rb["page"]:
            return False
        for e in ("y0", "y1"):
            tol = SEAM_TOL if (id(cb), e) in seam else TOL
            if abs(ra[e] - rb[e]) > tol:
                return False
        if rb["x0"] > ra["x0"] + 0.5 or rb["x1"] < ra["x1"] - 0.5:     # narrower: something may now be cut
            return False
    return True


def main():
    write = "--write" in sys.argv
    base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else None
    carried = lapsed = hcarried = hlapsed = 0
    for f in sorted((ROOT / "registry" / "maths" / "papers").glob("*.json")):
        rel = f.relative_to(ROOT)
        if base is not None:                    # a saved copy of the papers the readings were made on
            bf = Path(base) / f.name
            old_raw = bf.read_text() if bf.exists() else ""
        else:
            old_raw = subprocess.run(["git", "-C", str(ROOT), "show", f"HEAD:{rel}"], capture_output=True, text=True).stdout
        if not old_raw:
            continue
        old, new = json.loads(old_raw), json.loads(f.read_text())
        ai = reviews.load_ai("maths", new["id"])
        hum = reviews.load("maths", new["id"])
        oldq = {q["number"]: q for q in old["questions"]}
        changed = hchanged = False
        for q in new["questions"]:
            o = oldq.get(q["number"])
            if o is None:
                continue
            fo, fn = reviews.fingerprint(o), reviews.fingerprint(q)
            if fo == fn:
                continue
            read = ai["questions"].get(str(q["number"]))
            if read is not None and read.get("fingerprint") == fo:
                if not read.get("concerns") and nudged(o, q):
                    read["fingerprint"] = fn
                    carried += 1
                    changed = True
                else:
                    lapsed += 1
            v = hum.get("questions", {}).get(str(q["number"]))
            if v is not None and v.get("fingerprint") == fo:
                if v.get("status") == "ok" and nudged(o, q):
                    v["fingerprint"] = fn
                    hcarried += 1
                    hchanged = True
                else:
                    hlapsed += 1
        if write and changed:
            path = reviews.path("maths", new["id"], "ai")
            path.write_text(json.dumps(ai, indent=1, ensure_ascii=False) + "\n")
        if write and hchanged:
            reviews.save("maths", new["id"], hum)
    print(f"AI readings: carried {carried}, lapsed {lapsed}; reviews: carried {hcarried}, lapsed {hlapsed}"
          + ("" if write else " (dry run)"))


if __name__ == "__main__":
    main()
