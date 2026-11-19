"""Review state: a person's verdict on each question, kept apart from the generated registry files.

registry/<subject>/reviews/<paper id>.json:
    {
      "questions": { "13": { "status": "ok" | "flagged", "note": "...", "fingerprint": "…", "at": "2026-11-18" } },
      "parts":     { "13(b)(i)": { "kind": "calc", "answer": "B" } }       # corrections to what was guessed/read
    }

registry/<subject>/ai/<paper id>.json (written by the AI reader during tagging):
    { "questions": { "13": { "concerns": ["13(b): diagram looks cut off"], "fingerprint": "…" } } }

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


def path(subject, paper_id, kind="reviews"):
    return ROOT / "registry" / subject / kind / f"{paper_id}.json"


def load_ai(subject, paper_id):
    """What the AI reader said about each question, or nothing if it hasn't read this paper yet."""
    p = path(subject, paper_id, "ai")
    return json.loads(p.read_text()) if p.exists() else {"questions": {}}


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
    if question.get("msNotes"):         # Maths: the mark scheme's notes after a question (Physics has none, so
        seen["notes"] = regions(question["msNotes"])    # its fingerprints are unchanged)
    return hashlib.sha1(json.dumps(seen, sort_keys=True).encode()).hexdigest()[:12]


def status(question, verdict, ai):
    """pending | machine | human | flagged: see CheckStatus in src/lib/papers/types.ts.

    A person's verdict counts while the question is still what they saw. Without one, a question is 'machine'
    only when the pipeline found no risk (risks.py) and the AI reader looked at this same question and raised
    no concern; anything else waits for a person."""
    fp = fingerprint(question)
    if verdict is not None and verdict.get("fingerprint") == fp:
        return "human" if verdict["status"] == "ok" else "flagged"
    if not question.get("risks") and ai is not None and ai.get("fingerprint") == fp and not ai.get("concerns"):
        return "machine"
    return "pending"


def apply(paper, reviews, ai=None):
    """Set each question's `check` and apply part corrections, in place. Returns how many reviews lapsed
    (the question changed since it was judged)."""
    if ai is None:
        ai = load_ai(paper["subject"], paper["id"])
    lapsed = 0
    for q in paper["questions"]:
        for p in q["parts"]:
            # Keep what the pipeline read and guessed, so a correction can be undone and the fingerprint
            # doesn't move when a person corrects something.
            if "answer" in p and "answerRead" not in p:
                p["answerRead"] = p["answer"]
            p.setdefault("kindGuessed", p["kind"])
            fix = reviews["parts"].get(p["label"], {})
            # a person's correction, else the AI reader's kind (if it read this same question), else the guess
            read = ai["questions"].get(str(q["number"]), {})
            ai_kind = read.get("kinds", {}).get(p["label"]) if read.get("fingerprint") == fingerprint(q) else None
            p["kind"] = fix.get("kind", ai_kind or p["kindGuessed"])
            # topics: a person's, else the AI reader's suggestion (tags don't depend on how the crops are cut,
            # so a reading of an earlier cut still counts)
            ai_topics = read.get("topics", {}).get(p["label"])
            if "topics" in fix:
                p["topics"], p["tagStatus"] = fix["topics"], "reviewed"
            elif ai_topics:
                p["topics"], p["tagStatus"] = ai_topics, "suggested"
            else:
                p["topics"], p["tagStatus"] = [], "none"
            if "answerRead" in p or "answer" in fix:
                p["answer"] = fix.get("answer", p.get("answerRead"))
            if p.get("answer") is None:
                p.pop("answer", None)
        verdict = reviews["questions"].get(str(q["number"]))
        if verdict is not None and verdict.get("fingerprint") != fingerprint(q):
            lapsed += 1
        q.pop("reviewed", None)                 # the old yes/no field, before 'check'
        q["check"] = status(q, verdict, ai["questions"].get(str(q["number"])))
    return lapsed


def judge(reviews, question, status, note=""):
    """Record a verdict on a question as it stands now."""
    reviews["questions"][str(question["number"])] = {
        "status": status, "note": note, "fingerprint": fingerprint(question), "at": date.today().isoformat()}
