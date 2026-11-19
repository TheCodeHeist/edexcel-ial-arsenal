"""Publish rendered crops to the data repo, which GitHub Pages serves to the site.

Usage:  pipeline/.venv/bin/python pipeline/publish.py WPH14_2026_06 [more ids…] [--no-push]

The crops of a paper (pipeline/cache/segments/<id>/crops/) are copied to <data repo>/<subject>/<id>/, replacing
that folder, so a re-render never leaves stale images behind. Only papers with a registry file are published
(segment.py --write makes one only once the paper's checks pass). The data repo is committed and pushed
only when a file actually changed, so re-publishing an unchanged paper adds nothing to its history.

The data repo is TheCodeHeist/edexcel-ial-arsenal-data, cloned next to this repo (override with ARSENAL_DATA).
Images are then at  https://thecodeheist.github.io/edexcel-ial-arsenal-data/<subject>/<id>/<file>.webp
"""

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEGMENTS = ROOT / "pipeline" / "cache" / "segments"
DATA = Path(os.environ.get("ARSENAL_DATA", ROOT.parent / "edexcel-ial-arsenal-data"))
PAGES = "https://thecodeheist.github.io/edexcel-ial-arsenal-data"


def git(*args):
    return subprocess.run(["git", "-C", str(DATA), *args], check=True, capture_output=True, text=True).stdout


def publish(paper_id):
    registry = next((ROOT / "registry").glob(f"*/papers/{paper_id}.json"), None)
    if registry is None:
        print(f"{paper_id}: no registry file; run segment.py {paper_id} --write first")
        return False
    subject = json.loads(registry.read_text())["subject"]
    src = SEGMENTS / paper_id / "crops"
    files = sorted(src.glob("*.webp"))
    # Every crop the registry names must exist, or the site would show broken images.
    named = {Path(c["src"]).name for q in json.loads(registry.read_text())["questions"]
             for c in q["stem"] + q.get("msNotes", [])            # Maths: the mark scheme's notes for examiners
             + [c for p in q["parts"] for c in p.get("intro", []) + p["qp"] + p["ms"]]}
    missing = named - {f.name for f in files}
    if missing:
        print(f"{paper_id}: {len(missing)} crops named in the registry aren't rendered, e.g. {sorted(missing)[0]}")
        return False
    dest = DATA / subject / paper_id
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    for f in files:
        if f.name in named:                 # anything else is a leftover the registry doesn't use
            shutil.copy2(f, dest / f.name)
    size = sum(f.stat().st_size for f in dest.iterdir())
    print(f"{paper_id}: {len(named)} crops, {size / 1024:.0f} KB -> {dest.relative_to(DATA)}/")
    return True


def main():
    ids = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not DATA.joinpath(".git").exists():
        sys.exit(f"data repo not found at {DATA} (clone TheCodeHeist/edexcel-ial-arsenal-data there, or set ARSENAL_DATA)")
    done = [pid for pid in ids if publish(pid)]
    if not done:
        return
    git("add", "-A")
    if not git("status", "--porcelain").strip():
        print("nothing changed; not committing")
        return
    git("commit", "-q", "-m", f"Publish crops: {', '.join(done)}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>")
    if "--no-push" not in sys.argv:
        # Large pushes over HTTPS sometimes drop (it happened twice in the first bulk publish); retry.
        for attempt in range(3):
            try:
                git("push", "-q")
                break
            except subprocess.CalledProcessError:
                if attempt == 2:
                    raise
                print("push failed; retrying")
                time.sleep(10)
        print(f"pushed. e.g. {PAGES}/{next(DATA.glob('*/' + done[0])).relative_to(DATA)}/")


if __name__ == "__main__":
    main()
