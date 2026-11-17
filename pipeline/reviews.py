"""Review state: a person's verdict on each question, kept apart from the generated registry files.

registry/<subject>/reviews/<paper id>.json:
    {
      "questions": { "13": { "status": "ok" | "flagged", "note": "...", "fingerprint": "…", "at": "2026-11-18" } },
      "parts":     { "13(b)(i)": { "kind": "calc", "answer": "B" } }       # corrections to what was guessed/read
    }

The registry files are rebuilt whenever segment.py --write runs, so a verdict stored in them would be lost.
Here it survives, tied to a fingerprint of what the reviewer actually saw: the question's labels, marks,
answer keys and crop regions. If a later segmenter change alters any of that, the verdict no longer applies
and the question comes back for review; an untouched question keeps it.
"""

import hashlib
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def path(subject, paper_id):
    return ROOT / "registry" / subject / "reviews" / f"{paper_id}.json"


def load(subject, paper_id):
    p = path(subject, paper_id)
    return json.loads(p.read_text()) if p.exists() else {"questions": {}, "parts": {}}


def save(subject, paper_id, reviews):
    p = path(subject, paper_id)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(reviews, indent=1, ensure_ascii=False, sort_keys=True) + "\n")


def fingerprint(question):
    """What a reviewer judged: labels, marks, read answer keys and every crop region (not kinds or topics,
    which are corrected or tagged separately)."""
    def regions(crops):
        return [(c["src"].rsplit("/", 1)[-1], c["region"]) for c in crops]
    seen = {
        "stem": regions(question["stem"]),
        "parts": [(p["label"], p["marks"], p.get("answerRead", p.get("answer")),
                   regions(p.get("intro", [])), regions(p["qp"]), regions(p["ms"])) for p in question["parts"]],
    }
    return hashlib.sha1(json.dumps(seen, sort_keys=True).encode()).hexdigest()[:12]


def apply(paper, reviews):
    """Set each question's `reviewed` and apply part corrections, in place. Returns how many reviews lapsed
    (the question changed since it was judged)."""
    lapsed = 0
    for q in paper["questions"]:
        for p in q["parts"]:
            # Keep what the pipeline read and guessed, so a correction can be undone and the fingerprint
            # doesn't move when a person corrects something.
            if "answer" in p and "answerRead" not in p:
                p["answerRead"] = p["answer"]
            p.setdefault("kindGuessed", p["kind"])
            fix = reviews["parts"].get(p["label"], {})
            p["kind"] = fix.get("kind", p["kindGuessed"])
            if "answerRead" in p or "answer" in fix:
                p["answer"] = fix.get("answer", p.get("answerRead"))
            if p.get("answer") is None:
                p.pop("answer", None)
        verdict = reviews["questions"].get(str(q["number"]))
        current = verdict is not None and verdict.get("fingerprint") == fingerprint(q)
        if verdict is not None and not current:
            lapsed += 1
        q["reviewed"] = bool(current and verdict["status"] == "ok")
    return lapsed


def judge(reviews, question, status, note=""):
    """Record a verdict on a question as it stands now."""
    reviews["questions"][str(question["number"])] = {
        "status": status, "note": note, "fingerprint": fingerprint(question), "at": date.today().isoformat()}
