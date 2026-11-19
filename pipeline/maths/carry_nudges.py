"""After a re-cut: keep clean AI readings of questions whose crops only nudged.

Usage:  pipeline/.venv/bin/python pipeline/maths/carry_nudges.py [--write]

Compares each registry/maths/papers/<id>.json with its committed version (git HEAD). A question whose fingerprint
changed keeps its AI reading (the fingerprint is renewed) when the reading raised no concerns, the parts, marks
and crop counts are the same, and every crop edge moved at most 4 pt up or down (a crop made wider at the sides
is fine: that only shows more of what was clipped). Anything else lapses and is read again: in particular a
reading with concerns, so the fixed crop gets a fresh look.
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))
import reviews  # noqa: E402

TOL = 4.0


def crops(q):
    out = [("stem", c) for c in q["stem"]] + [("notes", c) for c in q.get("msNotes", [])]
    for p in q["parts"]:
        out += [(p["label"] + ":intro", c) for c in p.get("intro", [])]
        out += [(p["label"] + ":qp", c) for c in p["qp"]] + [(p["label"] + ":ms", c) for c in p["ms"]]
    return out


def nudged(old, new):
    if [(p["label"], p["marks"]) for p in old["parts"]] != [(p["label"], p["marks"]) for p in new["parts"]]:
        return False
    a, b = crops(old), crops(new)
    if [k for k, _ in a] != [k for k, _ in b]:
        return False
    for (_, ca), (_, cb) in zip(a, b):
        ra, rb = ca["region"], cb["region"]
        if ra["page"] != rb["page"] or abs(ra["y0"] - rb["y0"]) > TOL or abs(ra["y1"] - rb["y1"]) > TOL:
            return False
        if rb["x0"] > ra["x0"] + 0.5 or rb["x1"] < ra["x1"] - 0.5:     # narrower: something may now be cut
            return False
    return True


def main():
    write = "--write" in sys.argv
    carried = lapsed = 0
    for f in sorted((ROOT / "registry" / "maths" / "papers").glob("*.json")):
        rel = f.relative_to(ROOT)
        old_raw = subprocess.run(["git", "-C", str(ROOT), "show", f"HEAD:{rel}"], capture_output=True, text=True).stdout
        if not old_raw:
            continue
        old, new = json.loads(old_raw), json.loads(f.read_text())
        ai = reviews.load_ai("maths", new["id"])
        oldq = {q["number"]: q for q in old["questions"]}
        changed = False
        for q in new["questions"]:
            o = oldq.get(q["number"])
            read = ai["questions"].get(str(q["number"]))
            if o is None or read is None:
                continue
            fo, fn = reviews.fingerprint(o), reviews.fingerprint(q)
            if fo == fn or read.get("fingerprint") != fo:
                continue
            if not read.get("concerns") and nudged(o, q):
                read["fingerprint"] = fn
                carried += 1
                changed = True
            else:
                lapsed += 1
        if write and changed:
            path = reviews.path("maths", new["id"], "ai")
            path.write_text(json.dumps(ai, indent=1, ensure_ascii=False) + "\n")
    print(f"carried {carried}, lapsed {lapsed}" + ("" if write else " (dry run)"))


if __name__ == "__main__":
    main()
