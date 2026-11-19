"""The AI reader's side of checking: look at each question as an image, report anything wrong, set part kinds.

Usage (meant for an AI agent, one question at a time):
    pipeline/.venv/bin/python pipeline/ai_read.py todo [prefix] [--limit N]    questions still to read
    pipeline/.venv/bin/python pipeline/ai_read.py show <paper id> <question>   one question, as an image + JSON
    pipeline/.venv/bin/python pipeline/ai_read.py record <paper id> <question> '<json>'
    pipeline/.venv/bin/python pipeline/ai_read.py carry [prefix]                after a pipeline fix (see carry())

`show` stitches the question's crops (stem, part intros, parts) and each part's mark-scheme rows into one PNG,
with a caption above every piece, and prints what the pipeline decided about each part. The reader looks at the
picture and answers with `record`:

    {"kinds": {"13(a)": "short", "13(b)": "draw"}, "concerns": ["13(b): the graph's x-axis is cut off"]}

Every part needs a kind. MCQs stay "mcq" and nothing else may become one. "concerns" is empty when everything
looks right. A concern sends the question to a person; no concerns (and no risks, see risks.py) makes it
'machine' checked (reviews.status).

Results go to registry/<subject>/ai/<paper id>.json, never to the registry file itself, so this can run while a
person uses the review tool. Each result carries the question's fingerprint: if the question is re-segmented
it goes back on the to-do list.
"""

import fcntl
import json
import sys
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
import reviews  # noqa: E402
from publish import DATA  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(__file__).resolve().parent / "cache" / "ai"
KINDS = {"mcq", "calc", "short", "draw", "extended"}

# How to choose a part's kind. Printed by `todo`, so every reader (and every recheck) works to the same rules.
# Add a rule here when the person reviewing decides one; then re-check the kinds it affects.
KIND_GUIDE = """\
Kinds (judge by what the mark scheme rewards, not only the command word):
  mcq       multiple choice A-D. Only parts the pipeline guessed as mcq; they stay mcq.
  calc      calculate / determine / show that / estimate a value. ALSO a 'deduce', 'determine whether',
            'assess whether' or 'explain whether' part whose mark scheme is mostly calculation (working,
            values, a numerical comparison): the student has to calculate to answer.
  short     short written answer: state, explain, describe, suggest, complete a table with words or numbers.
  draw      the student draws, sketches, plots points, adds arrows/rays/lines/forces, or labels/completes a
            diagram or graph.
  extended  extended writing (usually 5-6 marks, marked on structured reasoning; often labelled with a *).
Maths papers have no mcq and almost no extended: find / solve / show that / prove (algebraic working) is calc;
  sketch a graph or curve, draw a diagram or network, shade a region is draw; state / explain / interpret /
  give a reason / criticise a model in words is short."""
CAPTION_H = 34
GAP = 14


def load_paper(paper_id):
    f = next((ROOT / "registry").glob(f"*/papers/{paper_id}.json"), None)
    if f is None:
        sys.exit(f"no such paper: {paper_id}")
    return json.loads(f.read_text())


def question(paper, number):
    for q in paper["questions"]:
        if q["number"] == int(number):
            return q
    sys.exit(f"{paper['id']} has no question {number}")


def font(size):
    for name in ("DejaVuSans-Bold.ttf", "LiberationSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def stitch(pieces, path):
    """pieces: [(caption, colour, [crop records])] -> one PNG, a caption bar above each piece."""
    blocks = []
    for caption, colour, crops in pieces:
        imgs = [Image.open(DATA / c["src"]).convert("L") for c in crops]
        if imgs:
            blocks.append((caption, colour, imgs))
    width = max(i.width for _, _, imgs in blocks for i in imgs)
    height = sum(CAPTION_H + sum(i.height for i in imgs) + GAP for _, _, imgs in blocks)
    sheet = Image.new("RGB", (width, height), "white")
    draw, f, y = ImageDraw.Draw(sheet), font(20), 0
    for caption, colour, imgs in blocks:
        draw.rectangle((0, y, width, y + CAPTION_H - 4), fill=colour)
        draw.text((10, y + 5), caption, fill="white", font=f)
        y += CAPTION_H
        for i in imgs:
            sheet.paste(i, (0, y))
            y += i.height
        y += GAP
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path)


def show(paper_id, number):
    paper = load_paper(paper_id)
    q = question(paper, number)
    pieces = [(f"Question {q['number']}: shared opening (stem)", "#555555", q["stem"])]
    last_intro = None
    for p in q["parts"]:
        intro = p.get("intro", [])
        if intro and intro != last_intro:
            pieces.append((f"lead-in shared by the parts below", "#555555", intro))
        last_intro = intro
        pieces.append((f"{p['label']}  ({p['marks']} mark{'s' * (p['marks'] != 1)}): QUESTION", "#1c5fb4", p["qp"]))
        pieces.append((f"{p['label']}: MARK SCHEME rows", "#7a3db8", p["ms"]))
    if q.get("msNotes"):        # Maths: the examiners' notes after the question's mark scheme
        pieces.append((f"Question {q['number']}: examiners' NOTES on the mark scheme", "#7a3db8", q["msNotes"]))
    prev = reviews.load_ai(paper["subject"], paper_id)["questions"].get(str(q["number"]))
    if prev and prev.get("fingerprint") == reviews.fingerprint(q):
        prev = None                     # read as it is cut now: nothing to carry
    image = OUT / f"{paper_id}_q{q['number']}.png"
    stitch(pieces, image)
    print(json.dumps({
        "paper": paper_id, "question": q["number"], "image": str(image), "marks": q["marks"],
        "parts": [{"label": p["label"], "marks": p["marks"], "kind_guessed": p.get("kindGuessed", p["kind"]),
                   **({"mcq_answer_read": p["answerRead"]} if "answerRead" in p else {}),
                   "text": p.get("text", "")[:600]} for p in q["parts"]],
        # an earlier reading of this question before it was re-cut: its kinds and topics still hold (they don't
        # depend on the cut); only the crops need checking again
        **({"previous_reading": {k: prev[k] for k in ("kinds", "topics") if k in prev}} if prev else {}),
    }, indent=1, ensure_ascii=False))


def record(paper_id, number, raw):
    paper = load_paper(paper_id)
    q = question(paper, number)
    try:
        said = json.loads(raw)
    except json.JSONDecodeError as e:
        sys.exit(f"not JSON: {e}")
    kinds, concerns, topics = said.get("kinds", {}), said.get("concerns", []), said.get("topics", {})
    labels = [p["label"] for p in q["parts"]]
    errors = [f"unknown part {k}" for k in kinds if k not in labels]
    errors += [f"no kind for {label}" for label in labels if label not in kinds]
    for p in q["parts"]:
        k, was_mcq = kinds.get(p["label"]), p.get("kindGuessed", p["kind"]) == "mcq"
        if k is not None and k not in KINDS:
            errors.append(f"{p['label']}: kind must be one of {sorted(KINDS)}")
        elif k is not None and (k == "mcq") != was_mcq:
            errors.append(f"{p['label']}: {'is' if was_mcq else 'is not'} an MCQ; keep it {'mcq' if was_mcq else 'non-mcq'}")
    allowed = {p["id"] for _, _, p in topic_list(paper["subject"], paper["unit"])}
    errors += [f"unknown part {k} in topics" for k in topics if k not in labels]
    errors += [f"no topics for {label}" for label in labels if not topics.get(label)]
    for label, ids in topics.items():
        if not isinstance(ids, list) or not all(isinstance(i, str) for i in ids):
            errors.append(f"{label}: topics must be a list of tag ids as strings, e.g. [\"86\"]")
        else:
            errors += [f"{label}: {i} is not a tag for {paper['unit']} (see the TOPIC TAGS list from todo)"
                       for i in ids if i not in allowed]
    if not isinstance(concerns, list) or not all(isinstance(c, str) and c.strip() for c in concerns):
        errors.append("concerns must be a list of non-empty strings ([] if all is well)")
    if errors:
        sys.exit("not recorded: " + "; ".join(errors))
    f = reviews.path(paper["subject"], paper_id, "ai")
    f.parent.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    with open(OUT / f"{paper_id}.lock", "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        ai = reviews.load_ai(paper["subject"], paper_id)
        ai["questions"][str(q["number"])] = {
            "fingerprint": reviews.fingerprint(q), "kinds": kinds, "topics": topics,
            "concerns": [c.strip() for c in concerns],
            "at": date.today().isoformat()}
        f.write_text(json.dumps(ai, indent=1, ensure_ascii=False, sort_keys=True) + "\n")
    print(f"recorded {paper_id} q{q['number']}: " + ("; ".join(concerns) if concerns else "no concerns"))


# Which tags a unit's questions may carry: its own content statements; practical papers add their skill bullets
# and the content of the theory units they draw on. Synoptic questions may reach back to earlier units.
DRAWS_ON = {"WPH11": ["WPH11"], "WPH12": ["WPH12", "WPH11"], "WPH13": ["WPH13", "WPH11", "WPH12"],
            "WPH14": ["WPH14", "WPH11", "WPH12"], "WPH15": ["WPH15", "WPH14", "WPH11", "WPH12"],
            "WPH16": ["WPH16", "WPH14", "WPH15", "WPH11", "WPH12"],
            # Maths: each unit, then the units it builds on. C12/C34 (WMA01/02, before 2019) and D1 before 2019
            # (WDM01) take the 2018 spec's tags.
            "WMA11": ["WMA11"], "WMA12": ["WMA12", "WMA11"], "WMA13": ["WMA13", "WMA12", "WMA11"],
            "WMA14": ["WMA14", "WMA13", "WMA12", "WMA11"], "WMA01": ["WMA11", "WMA12"], "WMA02": ["WMA13", "WMA14"],
            "WFM01": ["WFM01", "WMA11", "WMA12"], "WFM02": ["WFM02", "WFM01", "WMA11", "WMA12", "WMA13", "WMA14"],
            "WFM03": ["WFM03", "WFM02", "WFM01", "WMA13", "WMA14"],
            "WME01": ["WME01", "WMA11", "WMA12"], "WME02": ["WME02", "WME01", "WMA11", "WMA12", "WMA13"],
            "WME03": ["WME03", "WME02", "WME01", "WMA13", "WMA14"],
            "WST01": ["WST01", "WMA11", "WMA12"], "WST02": ["WST02", "WST01", "WMA11", "WMA12", "WMA13"],
            "WST03": ["WST03", "WST02", "WST01"], "WDM11": ["WDM11"], "WDM01": ["WDM11"]}


def topic_list(subject, unit):
    """[(unit code, group, point)] a question of this unit may be tagged with, its own unit first."""
    t = json.loads((ROOT / "registry" / subject / "topics.json").read_text())
    by = {u["code"]: u for u in t["units"]}
    return [(code, g, p) for code in DRAWS_ON.get(unit, [unit]) if code in by
            for g in by[code]["groups"] for p in g["points"]]


def print_topics(subject, unit):
    print(f"TOPIC TAGS for {unit} questions (id: label). Own unit first; earlier units only for synoptic parts.")
    last = None
    for code, g, p in topic_list(subject, unit):
        if (code, g["id"]) != last:
            print(f"\n  [{code} {g['id']} {g['title']}]")
            last = (code, g["id"])
        print(f"    {p['id']}: {p['short']}")
    print()


def todo(prefix="WPH1", limit=None):
    """Questions still to read: no reading of the question as it is cut now, or no topic tags yet. Clean ones
    first (those are the ones only the AI will check)."""
    rows, subject = [], "physics"
    for f in sorted((ROOT / "registry").glob(f"*/papers/{prefix}*.json")):
        paper = json.loads(f.read_text())
        subject = paper["subject"]
        ai = reviews.load_ai(paper["subject"], paper["id"])["questions"]
        for q in paper["questions"]:
            read = ai.get(str(q["number"]), {})
            done = (read.get("fingerprint") == reviews.fingerprint(q)          # read as it is cut now
                    and all(read.get("topics", {}).get(p["label"]) for p in q["parts"]))   # and tagged
            if not done:
                rows.append((bool(q.get("risks")), paper["id"], q["number"]))
    rows.sort(key=lambda r: r[0])
    print(KIND_GUIDE + "\n")
    units = {pid[:5] for _, pid, _ in rows}
    if len(units) == 1:
        print_topics(subject, units.pop())
    print(f"{len(rows)} to read")
    for risky, pid, n in rows[:limit]:
        print(f"{pid} {n}" + ("   (risky: a person will look too)" if risky else ""))


def carry(prefix="WPH1"):
    """Keep a person's "looks right" through a pipeline fix, when the AI confirms the fixed question.

    A reviewer may pass a question with a known, already-reported problem, expecting the fix. The fix re-cuts
    the question, its fingerprint changes and the verdict lapses, which would send it back to them. Here a
    lapsed 'ok' verdict is renewed for the question as it is now, but only if the AI reader has read this same
    version and raised no concern; the note says so. Flagged verdicts and anything the AI doubts stay lapsed."""
    renewed = 0
    for f in sorted((ROOT / "registry").glob(f"*/papers/{prefix}*.json")):
        paper = json.loads(f.read_text())
        rv = reviews.load(paper["subject"], paper["id"])
        ai = reviews.load_ai(paper["subject"], paper["id"])["questions"]
        changed = False
        for q in paper["questions"]:
            n, fp = str(q["number"]), reviews.fingerprint(q)
            v, read = rv["questions"].get(n), ai.get(n, {})
            if (v and v["status"] == "ok" and v.get("fingerprint") != fp
                    and read.get("fingerprint") == fp and not read.get("concerns")):
                note = f"carried over after a pipeline fix; AI re-read found nothing wrong ({date.today().isoformat()})"
                v.update(fingerprint=fp, note=(v.get("note", "") + "; " if v.get("note") else "") + note)
                changed = True
                renewed += 1
                print(f"{paper['id']} q{n}: verdict carried over")
        if changed:
            reviews.save(paper["subject"], paper["id"], rv)
            reviews.apply(paper, rv)
            f.write_text(json.dumps(paper, indent=1, ensure_ascii=False) + "\n")
    print(f"{renewed} verdict(s) carried over")


def main():
    args = sys.argv[1:]
    if not args or args[0] not in ("todo", "show", "record", "carry"):
        sys.exit(__doc__)
    if args[0] == "todo":
        limit = int(args[args.index("--limit") + 1]) if "--limit" in args else None
        rest = [a for i, a in enumerate(args[1:], 1) if a != "--limit" and args[i - 1] != "--limit"]
        todo(rest[0] if rest else "WPH1", limit)
    elif args[0] == "carry":
        carry(args[1] if len(args) > 1 else "WPH1")
    elif args[0] == "show" and len(args) == 3:
        show(args[1], args[2])
    elif args[0] == "record" and len(args) == 4:
        record(args[1], args[2], args[3])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
