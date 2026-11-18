"""Review tool: check by eye the questions the pipeline isn't sure of, and mark them right or flag them.

Usage:  pipeline/.venv/bin/python pipeline/review.py            then open http://127.0.0.1:8765
        pipeline/.venv/bin/python pipeline/review.py --port 9000

It shows every question the way the site will (stem, part intro, part) with its mark-scheme rows, plus what
the pipeline decided: labels, marks, kind, MCQ answer. You mark each question "looks right" or flag it with a
note, and can correct a part's kind or MCQ answer. Verdicts go to registry/<subject>/reviews/<id>.json (see
reviews.py) and the paper's registry file is updated at once, so `check` is always current.

You don't review everything. By default only questions that need a person are shown: those with a risk signal
(risks.py), an AI concern, or a verdict made before the question changed. Clean questions are left to the AI
reader; you can still show them all and judge any of them.

Images come from the local clone of the data repo, so they appear instantly. Source PDFs come from the
pipeline cache, so a crop can be compared with its page. Local only: it listens on 127.0.0.1.
"""

import argparse
import json
import mimetypes
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

sys.path.insert(0, str(Path(__file__).resolve().parent))
import reviews  # noqa: E402
from publish import DATA  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PAGE = Path(__file__).resolve().parent / "review.html"
PDFS = ROOT / "pipeline" / "cache" / "pdf"
ID = r"[A-Z0-9_]+"


def registry_file(paper_id):
    return next((ROOT / "registry").glob(f"*/papers/{paper_id}.json"), None)


def load_paper(paper_id):
    f = registry_file(paper_id)
    return (json.loads(f.read_text()), f) if f else (None, None)


def queue(q, verdict, ai):
    """Where a question stands for the reviewer: 'you' when it waits on a person (a risk, an AI concern, or a
    verdict that no longer matches), 'ai' when it only waits for the AI reader, else its check status."""
    if q["check"] != "pending":
        return q["check"]
    stale = verdict is not None and verdict.get("fingerprint") != reviews.fingerprint(q)
    return "you" if q.get("risks") or (ai or {}).get("concerns") or stale else "ai"


def decorate(paper):
    """Each question's queue, its AI concerns and its saved verdict (and whether that still applies)."""
    rv = reviews.load(paper["subject"], paper["id"])
    ai_file = reviews.load_ai(paper["subject"], paper["id"])
    reviews.apply(paper, rv, ai_file)       # work `check` out afresh: the file may predate a review or a rerun
    ai = ai_file["questions"]
    for q in paper["questions"]:
        n = str(q["number"])
        v = rv["questions"].get(n)
        q["verdict"] = v and {**v, "current": v.get("fingerprint") == reviews.fingerprint(q)}
        q["concerns"] = (ai.get(n) or {}).get("concerns", [])
        q["queue"] = queue(q, v, ai.get(n))
    return rv


def counts(paper):
    out = {"questions": len(paper["questions"])}
    for q in paper["questions"]:
        out[q["queue"]] = out.get(q["queue"], 0) + 1
    return out


def summary():
    """Every paper with where its questions stand, for the sidebar."""
    out = []
    for f in sorted((ROOT / "registry").glob("*/papers/*.json")):
        paper = json.loads(f.read_text())
        decorate(paper)
        out.append({"id": paper["id"], "subject": paper["subject"], "unit": paper["unit"], "series": paper["series"],
                    "variant": paper.get("variant"), **counts(paper)})
    return out


def with_reviews(paper):
    rv = decorate(paper)
    return {"paper": paper, "parts": rv["parts"], "counts": counts(paper)}


def update(paper_id, change):
    """Apply one change from the page, save the review file and rewrite the registry file."""
    paper, f = load_paper(paper_id)
    rv = reviews.load(paper["subject"], paper_id)
    if change["action"] == "judge":
        q = next(q for q in paper["questions"] if q["number"] == change["number"])
        reviews.judge(rv, q, change["status"], change.get("note", ""))
    elif change["action"] == "clear":
        rv["questions"].pop(str(change["number"]), None)
    elif change["action"] == "part":
        fix = rv["parts"].setdefault(change["label"], {})
        for key in ("kind", "answer"):
            if key in change:
                if change[key] in (None, ""):
                    fix.pop(key, None)
                else:
                    fix[key] = change[key]
        if not fix:
            del rv["parts"][change["label"]]
    else:
        raise ValueError(f"unknown action {change['action']!r}")
    reviews.save(paper["subject"], paper_id, rv)
    reviews.apply(paper, rv)
    for q in paper["questions"]:            # decorate()'s additions must not be written to the registry
        for key in ("verdict", "concerns", "queue"):
            q.pop(key, None)
    f.write_text(json.dumps(paper, indent=1, ensure_ascii=False) + "\n")
    return with_reviews(paper)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):      # keep the terminal quiet; errors still print
        pass

    def send(self, status, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def send_file(self, base, rel):
        f = (base / rel).resolve()
        if not str(f).startswith(str(base.resolve())) or not f.is_file():
            return self.send(404, {"error": "not found"})
        self.send(200, f.read_bytes(), mimetypes.guess_type(f.name)[0] or "application/octet-stream")

    def do_GET(self):
        path = unquote(self.path.split("?")[0])
        if path == "/":
            return self.send(200, PAGE.read_bytes(), "text/html; charset=utf-8")
        if path == "/api/papers":
            return self.send(200, summary())
        if m := re.fullmatch(rf"/api/paper/({ID})", path):
            paper, _ = load_paper(m[1])
            return self.send(200, with_reviews(paper)) if paper else self.send(404, {"error": "no such paper"})
        if path.startswith("/crops/"):
            return self.send_file(DATA, path[len("/crops/"):])
        if m := re.fullmatch(rf"/pdf/({ID}_(?:qp|ms)\.pdf)", path):
            return self.send_file(PDFS, m[1])
        self.send(404, {"error": "not found"})

    def do_POST(self):
        m = re.fullmatch(rf"/api/paper/({ID})", unquote(self.path))
        if not m or not registry_file(m[1]):
            return self.send(404, {"error": "no such paper"})
        try:
            change = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            self.send(200, update(m[1], change))
        except (ValueError, KeyError, StopIteration) as e:
            self.send(400, {"error": str(e)})


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=8765)
    args = ap.parse_args()
    if not DATA.exists():
        sys.exit(f"data repo not found at {DATA}: crops can't be shown")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Review tool on http://127.0.0.1:{args.port}  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
