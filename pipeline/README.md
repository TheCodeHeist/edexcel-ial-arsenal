# Past-paper pipeline

Turns Edexcel IAL past papers (PDF) into the question registry the site reads. Runs offline, on your
machine; the site never touches a PDF. Papers remain Pearson Edexcel's and are credited as such, with a
link to the original on every question.

```
registry/sources.json ─► fetch ─► verify ─► segment ─► pair MS ─► tag ─► review ─► registry/<subject>/papers/*.json
     (links)            (cache)  (covers)   (crops)    (rows)   (Gemini)  (you)        + crops in the data repo
```

| Stage    | Script       | Status |
|----------|--------------|--------|
| fetch    | `fetch.py`   | done   |
| verify   | `verify.py`  | done   |
| segment  | `segment.py` + `markscheme.py` | done on WPH14 June 2026; other layouts next |
| publish  | `publish.py` | done: crops to the data repo, served by GitHub Pages |
| pair MS  | –            |        |
| tag      | –            | Gemini Flash sub-agents via T3 (`antigravity` provider) |
| review   | –            | local-only page in the site |

## Setup

```sh
python3 -m venv pipeline/.venv
pipeline/.venv/bin/pip install -r pipeline/requirements.txt
```

## Adding papers

**From paperlords.org, automatically:** `scrape_paperlords.py` opens the IAL page in a visible browser and
clicks through it the way you would: subject → each series → QP / MS on each unit. From each viewer that
opens it reads the "open in new tab" link, then adds the papers to `sources.json`.

```sh
pipeline/.venv/bin/python pipeline/scrape_paperlords.py --dry-run              # walk the menus, open nothing
pipeline/.venv/bin/python pipeline/scrape_paperlords.py --series "June 2026"   # one series
pipeline/.venv/bin/python pipeline/scrape_paperlords.py                        # every Physics series
```

It pauses 1.5 s after each click, stops the viewer from loading the PDFs (fetch.py downloads each one once),
and skips papers already listed, so reruns only click what's new. If the site changes and a step fails, it
stops and saves a screenshot and the page HTML to `cache/debug/`. Run it yourself, not through an AI agent:
the site's robots.txt blocks AI agents.

**From Physics & Maths Tutor:** `scrape_pmt.py` reads PMT's six Edexcel Physics unit pages (plain HTML, allowed
by its robots.txt). It adds the old IAL spec (WPH01–06, 2014–2019) and attaches PMT's copies of current-spec
papers as `mirrors`, a fallback when the first source has the wrong file. UK A-level papers (6PH01–06) are
skipped unless you pass `--include-uk`.

Unit codes tell the qualifications apart: `WPH1n` current IAL spec (2018), `WPH0n` old IAL spec, `6PH0n` UK.

**By hand, in bulk:** open a past-paper listing in your browser, expand the series you want, and paste
`collect-links.js` into the dev-tools console. It copies every PDF link on the page. Save that to a file and run

```sh
pipeline/.venv/bin/python pipeline/import_links.py links.txt
```

It reads unit, series and QP/MS/ER from file names like `IAL_PHYSICS_2026_June_U4_QP_….pdf`, groups them
into papers, skips papers already listed and prints any names it couldn't read.

Both ways go through the site's own pages at a human pace. Don't swap them for a crawler that calls the
site's `/api` directly: its robots.txt blocks that.

**One at a time:** add an entry to `registry/sources.json` by hand (omit `sha256`).

Then download:

```sh
pipeline/.venv/bin/python pipeline/fetch.py
```

PDFs land in `pipeline/cache/pdf/` (git-ignored). The first download records each file's checksum in the
manifest; later runs flag any source whose file has changed.

Paper ids are `<UNIT>_<YEAR>_<MONTH>`, e.g. `WPH14_2026_06`.

## Checking the files are what they claim

Sites sometimes put the wrong PDF behind a link. After fetching, run

```sh
pipeline/.venv/bin/python pipeline/verify.py
```

It reads each PDF's cover (paper code such as `WPH14/01A`, the exam date or mark-scheme season, QP or MS)
and compares it with the manifest. Each file gets a `check` (`ok` / `mismatch` / `unreadable`). Then it repairs
what it can:

- **mirror swap:** a wrong file is replaced by a mirror whose cover agrees.
- **refile:** a file whose cover names another paper moves there, or is dropped if that paper has its own copy.
- **aliases:** June 2020 papers (cancelled, then sat in October 2020) are merged into October 2020.
- wrong links go to `rejected` in sources.json, so imports never bring them back.

Old scans with no text are read by a person and recorded in `registry/covers-by-eye.json`, keyed by checksum.
`--no-fix` reports without changing anything.

## Segmenting and publishing a paper

```sh
pipeline/.venv/bin/python pipeline/segment.py WPH14_2026_06 --preview   # overlays to check by eye
pipeline/.venv/bin/python pipeline/segment.py WPH14_2026_06 --write     # crops + registry/<subject>/papers/<id>.json
pipeline/.venv/bin/python pipeline/publish.py WPH14_2026_06             # crops to the data repo
```

`pipeline/survey.py` runs the same checks over every paper without rendering. Run it after any change to the
segmenter: as of November 2026 it reports 136/137 current-spec papers clean (the one left is WPH16 June 2021, a
scan) and 53/90 old-spec ones (old spec not tuned for yet).

`--write` refuses while any marks don't add up or any label is missing from the paper or the mark scheme.
Crops go to [TheCodeHeist/edexcel-ial-arsenal-data](https://github.com/TheCodeHeist/edexcel-ial-arsenal-data),
cloned next to this repo, and are served from `https://thecodeheist.github.io/edexcel-ial-arsenal-data/`
(`src/lib/papers/crops.ts`). Questions are written `check: "pending"` and stay off the site until checked.

## Checking: who looks at what

Nobody reviews 2,000 questions by hand. The hard checks above already pass on every paper, so what's left is
whether the crops are *cut* right, and that's split three ways (`check` in `types.ts`, set by `reviews.status`):

- **Risky questions go to a person.** `risks.py` lists the reasons to look closely: content cut by a crop edge
  (pixels confirm images and diagrams), a part running across pages, text after a part's `(n)`, text not
  starting at its label, mark-scheme pairings by fallback or hand fix, MCQ keys read from a lone letter. About
  350 of 1,945 questions have one. `segment.py --write` runs it; to re-run on its own:
  `pipeline/.venv/bin/python pipeline/risks.py [prefix]`.
- **Clean questions go to the AI reader** (Gemini, during tagging). It writes `registry/<subject>/ai/<id>.json`
  with any concerns per question; a concern sends the question to a person, none makes it `machine`.
- **A person's verdict beats both**: `human` or `flagged`.

Only `machine` and `human` questions reach the site.

## Reviewing

```sh
pipeline/.venv/bin/python pipeline/review.py      # then open http://127.0.0.1:8765
```

By default it shows only the papers and questions that need you (a risk, an AI concern, or a verdict from
before the question changed), with the reasons in an orange box; untick "my questions" to see the rest. It
shows each question as the site will (stem, part intro, part) with its mark-scheme rows, and what the pipeline
decided: labels, marks, kind, MCQ answer. Keys: `J`/`K` move, `R` looks right (and jump to the next question
that needs you), `F` flag with a note, `U` clear, `N` next paper that needs you. Kind and MCQ answer can be corrected from
their dropdowns. Hover a crop for a link to its page in the source PDF.

Verdicts and corrections are saved in `registry/<subject>/reviews/<id>.json` (`reviews.py`), separate from the
generated registry files, and applied whenever those are written. Each verdict is tied to a fingerprint of the
question's labels, marks, keys and crop regions: if re-segmenting changes the question, it comes back for review.

## After changing the segmenter

```sh
pipeline/.venv/bin/python pipeline/recut.py            # which questions would change (nothing written)
pipeline/.venv/bin/python pipeline/recut.py --write    # re-cut just those papers
pipeline/.venv/bin/python pipeline/publish.py <ids…>   # the ids recut.py prints
```

Only the changed questions get new fingerprints, so every other review and AI reading stays valid. The changed
ones go back to the AI reader (`ai_read.py todo` lists them); once it has read them with no concern,
`ai_read.py carry` renews a person's earlier "looks right" (a reviewer may pass a known issue expecting the fix).

## The AI reader: checks, kinds and topics

`ai_read.py todo <paper>` prints the kind guide and the paper's topic tags, then the questions still to read:
those not read as they are cut now, or not tagged yet. For each, `show` stitches the question and its mark
scheme into one image, and `record` takes back kinds, concerns and topic tags (checked against the unit's tags:
its own statements, earlier units for synoptic parts, and on WPH13/16 the practical-skill tags). Results go to
`registry/<subject>/ai/<id>.json`; `reviews.apply` turns them into each part's `kind`, `topics` and
`tagStatus: "suggested"`, with a person's correction always winning.

## Files

- `registry/sources.json`: every PDF we read, with its URL and checksum.
- `registry/<subject>/topics.json`: the spec turned into tags: content statement numbers ("106") and, for the
  practical units, skill bullets ("3.5i").
- `src/lib/papers/types.ts`: the registry format, shared by the pipeline and the site.

## What the papers look like (WPH14, June 2026)

Layout facts the segmenter relies on, measured in PDF points on A4 (595 × 842):

- Question numbers start a line at x ≈ 43 (x ≈ 36 when prefixed `*` for an extended-writing question).
- Every question ends with `(Total for Question N = M marks)`; Section A questions are 1 mark MCQs.
- Part marks are a `(n)` at x ≈ 496, right-aligned after the answer space.
- Page furniture to strip: barcode `*P79350A0232*`, the rotated `DO NOT WRITE IN THIS AREA` margins,
  page numbers at y ≈ 798, blank pages and the formula sheet at the back.
- Mark scheme: a table of Question Number | Answer | (Additional Guidance) | Mark. MCQ rows read
  `The only correct answer is B`, so MCQ keys can be read reliably. All other text extracts with mangled
  maths fonts, so mark schemes are shown as crops too.
